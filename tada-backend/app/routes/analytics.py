"""
Analytics Engine Routes
"""
import json
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
import pandas as pd
import numpy as np

from app.config import settings
from app.database import get_db
from app.utils.auth import get_current_user
from app.models import Dataset, AnalysisJob, ActivityLog
from app.services.insights_engine import SmartInsightsEngine

router = APIRouter()
_engine = SmartInsightsEngine()


@router.post("/{dataset_id}/run")
async def run_analytics(
    dataset_id: str,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Run full analytics pipeline on a dataset"""
    d = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        # Load dataset
        ext = d.file_type
        file_path = d.file_path

        # If a cleaned version exists, use it
        cleaned_file = Path(file_path).parent / "cleaned.csv"
        if cleaned_file.exists():
            file_path = str(cleaned_file)
            ext = 'csv'

        if ext == 'csv':
            df = pd.read_csv(file_path)
        elif ext in ("xlsx", "xls"):
            df = pd.read_excel(file_path)
        elif ext == "json":
            df = pd.read_json(file_path)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")

        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

        # Descriptive statistics
        desc_stats = {}
        if numeric_cols:
            stats_df = df[numeric_cols].describe()
            desc_stats = stats_df.to_dict()

        # Correlation matrix (numeric only)
        correlation = {}
        if len(numeric_cols) > 1:
            corr_df = df[numeric_cols].corr()
            correlation = corr_df.to_dict()

        # Missing values per column
        missing = {col: int(df[col].isnull().sum()) for col in df.columns}

        # Top anomalies (values > 3 std from mean for numeric cols)
        anomalies = []
        for col in numeric_cols[:3]:
            mean, std = df[col].mean(), df[col].std()
            if std > 0:
                outliers = df[abs(df[col] - mean) > 3 * std][col]
                if len(outliers) > 0:
                    anomalies.append({
                        "column": col,
                        "count": len(outliers),
                        "mean": round(float(mean), 2),
                        "std": round(float(std), 2),
                    })

        results = {
            "dataset_id": dataset_id,
            "row_count": len(df),
            "column_count": len(df.columns),
            "numeric_columns": numeric_cols,
            "descriptive_stats": {k: {kk: (round(float(vv), 4) if vv is not None and not (isinstance(vv, float) and np.isnan(vv)) else None) for kk, vv in v.items()} for k, v in desc_stats.items()},
            "correlation": correlation,
            "missing_values": missing,
            "anomalies": anomalies,
        }

        # Insert analysis job record
        db_job = AnalysisJob(
            dataset_id=dataset_id,
            job_type="profile_stats",
            status="completed",
            results=results
        )
        db.add(db_job)

        # Log activity
        log = ActivityLog(
            user_id=user.id,
            action="analytics",
            details=f"Calculated statistics & correlation matrix for: {d.name}"
        )
        db.add(log)
        db.commit()

        return results

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _load_df(d) -> pd.DataFrame:
    """Helper to load a Dataset ORM record into a DataFrame."""
    file_path = d.file_path
    ext = d.file_type
    cleaned_file = Path(file_path).parent / "cleaned.csv"
    if cleaned_file.exists():
        file_path = str(cleaned_file)
        ext = "csv"
    if ext == "csv":
        return pd.read_csv(file_path)
    elif ext in ("xlsx", "xls"):
        return pd.read_excel(file_path)
    elif ext == "json":
        return pd.read_json(file_path)
    raise HTTPException(status_code=400, detail="Unsupported file type")


@router.get("/{dataset_id}/kpi")
async def get_kpis(
    dataset_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Return top KPIs computed from the dataset's numeric columns."""
    d = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        df = _load_df(d)
        meta = {
            "id": d.id,
            "name": d.name,
            "row_count": d.row_count,
            "column_count": d.column_count,
            "quality_score": d.quality_score or 0,
        }
        kpis = _engine.generate_kpis(df, meta)
        return {"dataset_id": dataset_id, "kpis": kpis, "count": len(kpis)}
    except HTTPException:
        raise
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset file not found on server")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{dataset_id}/anomalies")
async def get_anomalies(
    dataset_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Return anomaly list detected from dataset numeric columns (Z-score + IQR)."""
    d = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        df = _load_df(d)
        anomalies = _engine.detect_anomalies(df)
        return {
            "dataset_id": dataset_id,
            "anomaly_count": len(anomalies),
            "anomalies": anomalies,
        }
    except HTTPException:
        raise
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset file not found on server")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{dataset_id}/smart-insights")
async def get_smart_insights(
    dataset_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Return AI-generated smart findings, risks, and opportunities for a dataset."""
    d = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Load metadata from JSON file if available
    meta_path = Path(settings.UPLOAD_DIR) / dataset_id / "metadata.json"
    meta: dict = {}
    if meta_path.exists():
        try:
            with open(meta_path) as f:
                meta = json.load(f)
        except Exception:
            pass
    if not meta:
        meta = {
            "id": d.id,
            "name": d.name,
            "row_count": d.row_count,
            "column_count": d.column_count,
            "quality_score": d.quality_score or 0,
            "missing_values": d.missing_values or 0,
            "duplicate_rows": d.duplicate_rows or 0,
            "columns": d.columns or [],
        }

    try:
        df = _load_df(d)
        findings = _engine.generate_smart_findings(df, meta, dataset_name=d.name)
        return {"dataset_id": dataset_id, **findings}
    except HTTPException:
        raise
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset file not found on server")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
