"""
Data Processing Service - Pandas-based data profiling and analysis
"""
import os
import json
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional
import logging

from app.database import SessionLocal
from app.models import Dataset, DatasetVersion, ActivityLog

logger = logging.getLogger(__name__)


class DataProcessor:
    """Handles dataset processing, profiling, and quality scoring"""

    def process_dataset(self, dataset_id: str, file_path: str, file_ext: str) -> Dict[str, Any]:
        """Main processing pipeline for uploaded datasets"""
        db = SessionLocal()
        try:
            # Load data
            df = self._load_file(file_path, file_ext)

            # Profile the dataset
            profile = self._profile_dataset(df)

            # Compute quality score
            quality_score = self._compute_quality_score(df, profile)

            # Build metadata
            metadata = {
                "id": dataset_id,
                "file_path": file_path,
                "file_type": file_ext,
                "row_count": int(len(df)),
                "column_count": int(len(df.columns)),
                "columns": profile["columns"],
                "status": "ready",
                "quality_score": round(quality_score, 1),
                "missing_values": int(df.isnull().sum().sum()),
                "duplicate_rows": int(df.duplicated().sum()),
                "memory_usage": int(df.memory_usage(deep=True).sum()),
                "processed_at": datetime.utcnow().isoformat(),
            }

            # Update database record
            dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
            if dataset:
                dataset.row_count = metadata["row_count"]
                dataset.column_count = metadata["column_count"]
                dataset.columns = metadata["columns"]
                dataset.status = "ready"
                dataset.quality_score = metadata["quality_score"]
                dataset.missing_values = metadata["missing_values"]
                dataset.duplicate_rows = metadata["duplicate_rows"]
                dataset.memory_usage = metadata["memory_usage"]
                
                # Log upload activity
                log = ActivityLog(
                    user_id=dataset.user_id,
                    action="upload",
                    details=f"Uploaded and profiled dataset: {dataset.name}"
                )
                db.add(log)
                db.commit()
                db.refresh(dataset)
                
                # Update metadata dict with DB created_at
                metadata["name"] = dataset.name
                metadata["created_at"] = dataset.created_at.isoformat()
                metadata["file_size"] = dataset.file_size

            # Save metadata.json file
            meta_path = Path(file_path).parent / "metadata.json"
            if meta_path.exists():
                with open(meta_path) as f:
                    existing = json.load(f)
                existing.update(metadata)
                metadata = existing

            with open(meta_path, 'w') as f:
                json.dump(metadata, f, indent=2, default=str)

            return metadata

        except Exception as e:
            logger.error(f"Failed to process dataset {dataset_id}: {e}")
            # Update status to error in database
            dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
            if dataset:
                dataset.status = "error"
                db.commit()

            # Update status to error in metadata.json
            meta_path = Path(file_path).parent / "metadata.json"
            if meta_path.exists():
                with open(meta_path) as f:
                    meta = json.load(f)
                meta["status"] = "error"
                meta["error"] = str(e)
                with open(meta_path, 'w') as f:
                    json.dump(meta, f, indent=2)
            raise
        finally:
            db.close()

    def _load_file(self, file_path: str, file_ext: str) -> pd.DataFrame:
        """Load file into DataFrame"""
        if file_ext == 'csv':
            return pd.read_csv(file_path)
        elif file_ext in ('xlsx', 'xls'):
            return pd.read_excel(file_path)
        elif file_ext == 'json':
            return pd.read_json(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_ext}")

    def _profile_dataset(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Generate detailed column profiles"""
        columns = []
        for col in df.columns:
            col_data = df[col]
            dtype = str(col_data.dtype)
            null_count = int(col_data.isnull().sum())
            unique_count = int(col_data.nunique())

            profile = {
                "name": col,
                "type": self._map_dtype(dtype),
                "dtype_raw": dtype,
                "null_count": null_count,
                "null_pct": round(null_count / len(df) * 100, 2),
                "unique_count": unique_count,
                "unique_pct": round(unique_count / len(df) * 100, 2),
            }

            # Add numeric stats
            if pd.api.types.is_numeric_dtype(col_data):
                profile.update({
                    "min": self._safe_val(col_data.min()),
                    "max": self._safe_val(col_data.max()),
                    "mean": self._safe_val(col_data.mean()),
                    "median": self._safe_val(col_data.median()),
                    "std": self._safe_val(col_data.std()),
                    "sample_values": [self._safe_val(v) for v in col_data.dropna().head(3).tolist()],
                })
            else:
                profile["sample_values"] = [str(v) for v in col_data.dropna().head(3).tolist()]

            columns.append(profile)

        return {"columns": columns}

    def _compute_quality_score(self, df: pd.DataFrame, profile: Dict) -> float:
        """Compute overall dataset quality score (0-100)"""
        total_cells = df.shape[0] * df.shape[1]
        if total_cells == 0:
            return 0.0

        # Completeness (40% weight) — penalize missing values
        missing_pct = df.isnull().sum().sum() / total_cells
        completeness = max(0, 1 - missing_pct) * 40

        # Uniqueness (20% weight) — penalize duplicates
        dup_pct = df.duplicated().sum() / len(df)
        uniqueness = max(0, 1 - dup_pct) * 20

        # Consistency (20% weight) — check type uniformity
        type_scores = []
        for col_info in profile["columns"]:
            if col_info["null_pct"] < 50:
                type_scores.append(1.0)
            else:
                type_scores.append(0.5)
        consistency = (sum(type_scores) / max(len(type_scores), 1)) * 20

        # Size adequacy (20% weight) — prefer datasets with decent row count
        row_score = min(1.0, len(df) / 1000)
        adequacy = row_score * 20

        return completeness + uniqueness + consistency + adequacy

    def _map_dtype(self, dtype: str) -> str:
        """Map pandas dtype to human-readable type"""
        if 'int' in dtype:
            return 'INTEGER'
        elif 'float' in dtype:
            return 'FLOAT'
        elif 'bool' in dtype:
            return 'BOOLEAN'
        elif 'datetime' in dtype:
            return 'DATETIME'
        elif 'object' in dtype:
            return 'VARCHAR'
        else:
            return dtype.upper()

    def _safe_val(self, val):
        """Convert numpy types to Python natives safely"""
        if val is None or (isinstance(val, float) and np.isnan(val)):
            return None
        if isinstance(val, (np.integer,)):
            return int(val)
        if isinstance(val, (np.floating,)):
            return float(val)
        return val

    def auto_clean(self, dataset_id: str) -> Dict[str, Any]:
        """Run automatic data cleaning on a dataset"""
        meta_path = Path("uploads") / dataset_id / "metadata.json"
        if not meta_path.exists():
            raise ValueError(f"Dataset {dataset_id} not found")

        with open(meta_path) as f:
            meta = json.load(f)

        df = self._load_file(meta["file_path"], meta["file_type"])

        issues_fixed = {}

        # 1. Drop duplicate rows
        dup_count = df.duplicated().sum()
        df = df.drop_duplicates()
        issues_fixed["duplicates_removed"] = int(dup_count)

        # 2. Fill numeric missing values with median
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        for col in numeric_cols:
            null_count = df[col].isnull().sum()
            if null_count > 0:
                df[col] = df[col].fillna(df[col].median())
                issues_fixed[f"filled_{col}_nulls"] = int(null_count)

        # 3. Fill categorical missing values with mode
        cat_cols = df.select_dtypes(include=['object']).columns
        for col in cat_cols:
            null_count = df[col].isnull().sum()
            if null_count > 0 and df[col].mode().shape[0] > 0:
                df[col] = df[col].fillna(df[col].mode()[0])
                issues_fixed[f"filled_{col}_nulls"] = int(null_count)

        # Save cleaned dataset
        clean_path = Path("uploads") / dataset_id / "cleaned.csv"
        df.to_csv(clean_path, index=False)

        # Recompute quality score
        profile = self._profile_dataset(df)
        new_quality = self._compute_quality_score(df, profile)

        # DB updates for dataset cleaning and versioning
        db = SessionLocal()
        try:
            dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
            if dataset:
                version_count = db.query(DatasetVersion).filter(DatasetVersion.dataset_id == dataset_id).count()
                version = DatasetVersion(
                    dataset_id=dataset_id,
                    version_num=version_count + 1,
                    file_path=str(clean_path),
                    file_size=os.path.getsize(clean_path),
                    row_count=len(df),
                    columns=profile["columns"],
                    change_summary=f"Automated cleaning: filled nulls, removed {issues_fixed.get('duplicates_removed', 0)} duplicates"
                )
                db.add(version)
                
                dataset.quality_score = round(new_quality, 1)
                dataset.missing_values = int(df.isnull().sum().sum())
                dataset.duplicate_rows = int(df.duplicated().sum())
                
                log = ActivityLog(
                    user_id=dataset.user_id,
                    action="clean",
                    details=f"Cleaned dataset: {dataset.name} (Quality score: {dataset.quality_score}%)"
                )
                db.add(log)
                db.commit()

                # Update local metadata.json too
                meta["quality_score"] = dataset.quality_score
                meta["missing_values"] = dataset.missing_values
                meta["duplicate_rows"] = dataset.duplicate_rows
                with open(meta_path, 'w') as f:
                    json.dump(meta, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Failed to save clean status in DB: {e}")
        finally:
            db.close()

        return {
            "dataset_id": dataset_id,
            "original_quality": meta.get("quality_score", 0),
            "new_quality": round(new_quality, 1),
            "issues_fixed": issues_fixed,
            "rows_after_cleaning": len(df),
            "clean_file_path": str(clean_path),
        }
