"""
Dataset Upload and Management Routes
"""
import os
import uuid
import json
import asyncio
from pathlib import Path
from typing import Optional, List
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.utils.auth import get_current_user
from app.models import Dataset, DatasetVersion, ActivityLog
from app.services.data_processor import DataProcessor
from app.services.insights_engine import SmartInsightsEngine

router = APIRouter()
processor = DataProcessor()
_insights_engine = SmartInsightsEngine()


class DatasetResponse(BaseModel):
    id: str
    name: str
    file_size: int
    file_type: str
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    columns: Optional[list] = None
    status: str
    quality_score: Optional[float] = None
    created_at: str


@router.post("/upload")
async def upload_dataset(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Upload and process a dataset file"""
    allowed_types = {
        'text/csv': 'csv',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'application/vnd.ms-excel': 'xls',
        'application/json': 'json',
    }

    file_ext = Path(file.filename or '').suffix.lower().lstrip('.')
    if file_ext not in ['csv', 'xlsx', 'xls', 'json']:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file_ext}")

    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > settings.MAX_FILE_SIZE_MB:
        raise HTTPException(status_code=400, detail=f"File too large. Max {settings.MAX_FILE_SIZE_MB}MB allowed.")

    dataset_id = str(uuid.uuid4())
    upload_path = Path(settings.UPLOAD_DIR) / dataset_id
    upload_path.mkdir(parents=True, exist_ok=True)
    file_path = upload_path / (file.filename or f"dataset.{file_ext}")

    with open(file_path, 'wb') as f:
        f.write(content)

    # Insert into PostgreSQL database
    db_dataset = Dataset(
        id=dataset_id,
        name=file.filename or "dataset",
        file_path=str(file_path),
        file_size=len(content),
        file_type=file_ext,
        status="processing",
        user_id=user.id
    )
    db.add(db_dataset)
    db.commit()
    db.refresh(db_dataset)

    # Return immediately with processing status
    result = {
        "id": db_dataset.id,
        "name": db_dataset.name,
        "file_size": db_dataset.file_size,
        "file_type": db_dataset.file_type,
        "file_path": db_dataset.file_path,
        "status": db_dataset.status,
        "created_at": db_dataset.created_at.isoformat(),
    }

    # Process in background
    background_tasks.add_task(processor.process_dataset, dataset_id, str(file_path), file_ext)

    return result


@router.get("/")
async def list_datasets(
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """List all datasets for current user"""
    # Filter datasets by authenticated user
    db_datasets = db.query(Dataset).filter(Dataset.user_id == user.id).order_by(Dataset.created_at.desc()).all()
    
    # If empty, also scan uploads folder for any orphaned files to populate (backward compatibility)
    if not db_datasets:
        upload_dir = Path(settings.UPLOAD_DIR)
        if upload_dir.exists():
            for dataset_dir in upload_dir.iterdir():
                if dataset_dir.is_dir():
                    meta_file = dataset_dir / "metadata.json"
                    if meta_file.exists():
                        try:
                            with open(meta_file) as f:
                                meta = json.load(f)
                                # Sync into DB for current user
                                db_ds = Dataset(
                                    id=meta.get("id"),
                                    name=meta.get("name", "Unknown"),
                                    file_path=meta.get("file_path", ""),
                                    file_size=meta.get("file_size", 0),
                                    file_type=meta.get("file_type", "csv"),
                                    row_count=meta.get("row_count"),
                                    column_count=meta.get("column_count"),
                                    columns=meta.get("columns"),
                                    status=meta.get("status", "ready"),
                                    quality_score=meta.get("quality_score"),
                                    missing_values=meta.get("missing_values"),
                                    duplicate_rows=meta.get("duplicate_rows"),
                                    memory_usage=meta.get("memory_usage"),
                                    user_id=user.id
                                )
                                db.add(db_ds)
                                db.commit()
                                db_datasets.append(db_ds)
                        except Exception:
                            pass
                            
    datasets = []
    for d in db_datasets:
        datasets.append({
            "id": d.id,
            "name": d.name,
            "file_size": d.file_size,
            "file_type": d.file_type,
            "row_count": d.row_count,
            "column_count": d.column_count,
            "columns": d.columns,
            "status": d.status,
            "quality_score": d.quality_score,
            "missing_values": d.missing_values,
            "duplicate_rows": d.duplicate_rows,
            "memory_usage": d.memory_usage,
            "created_at": d.created_at.isoformat(),
        })

    return {"datasets": datasets, "total": len(datasets)}


@router.get("/{dataset_id}")
async def get_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Get dataset details"""
    d = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dataset not found")

    return {
        "id": d.id,
        "name": d.name,
        "file_size": d.file_size,
        "file_type": d.file_type,
        "file_path": d.file_path,
        "row_count": d.row_count,
        "column_count": d.column_count,
        "columns": d.columns,
        "status": d.status,
        "quality_score": d.quality_score,
        "missing_values": d.missing_values,
        "duplicate_rows": d.duplicate_rows,
        "memory_usage": d.memory_usage,
        "created_at": d.created_at.isoformat(),
    }


@router.get("/{dataset_id}/preview")
async def preview_dataset(
    dataset_id: str,
    rows: int = 10,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Get dataset preview rows"""
    d = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        import pandas as pd
        file_path = d.file_path
        ext = d.file_type

        # Check if there's a cleaned version to preview instead
        cleaned_file = Path(file_path).parent / "cleaned.csv"
        if cleaned_file.exists():
            file_path = str(cleaned_file)
            ext = 'csv'

        if ext == 'csv':
            df = pd.read_csv(file_path, nrows=rows)
        elif ext in ('xlsx', 'xls'):
            df = pd.read_excel(file_path, nrows=rows)
        elif ext == 'json':
            df = pd.read_json(file_path).head(rows)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")

        return {
            "columns": df.columns.tolist(),
            "rows": df.where(df.notna(), None).values.tolist(),
            "total_rows": d.row_count or len(df),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{dataset_id}/clean")
async def clean_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Clean dataset missing values/duplicates and generate new version"""
    try:
        results = processor.auto_clean(dataset_id)
        return results
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{dataset_id}/download")
async def download_dataset(
    dataset_id: str,
    cleaned: bool = True,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Download original or cleaned dataset file"""
    d = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    file_path = d.file_path
    if cleaned:
        cleaned_file = Path(file_path).parent / "cleaned.csv"
        if cleaned_file.exists():
            file_path = str(cleaned_file)
            
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server")
        
    filename = Path(file_path).name
    return FileResponse(file_path, filename=filename, media_type="application/octet-stream")


@router.delete("/{dataset_id}")
async def delete_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Delete a dataset"""
    import shutil
    d = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dataset not found")

    dataset_dir = Path(settings.UPLOAD_DIR) / dataset_id
    if dataset_dir.exists():
        shutil.rmtree(dataset_dir)

    db.delete(d)
    db.commit()
    return {"message": "Dataset deleted successfully"}


@router.get("/{dataset_id}/auto-dashboard")
async def get_auto_dashboard(
    dataset_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Return auto-generated dashboard configuration: charts, KPIs, and suggested analyses."""
    import pandas as pd
    import numpy as np

    d = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Load file
    try:
        file_path = d.file_path
        ext = d.file_type
        cleaned_file = Path(file_path).parent / "cleaned.csv"
        if cleaned_file.exists():
            file_path = str(cleaned_file)
            ext = "csv"

        if ext == "csv":
            df = pd.read_csv(file_path)
        elif ext in ("xlsx", "xls"):
            df = pd.read_excel(file_path)
        elif ext == "json":
            df = pd.read_json(file_path)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset file not found on server")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Load metadata
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
        }

    try:
        dashboard = _insights_engine.build_auto_dashboard_config(df, meta)
        return {
            "dataset_id": dataset_id,
            "dataset_name": d.name,
            **dashboard,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
