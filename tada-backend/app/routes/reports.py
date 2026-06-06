"""
Reports Router - Handles generation and listing of PDF and Excel reports
"""
import os
import json
from pathlib import Path
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.utils.auth import get_current_user
from app.models import Dataset, Report, ActivityLog
from app.services.report_generator import ReportGenerator

router = APIRouter()
report_gen = ReportGenerator()


class ReportGenerateRequest(BaseModel):
    dataset_id: str
    title: str
    format: str = "PDF"  # PDF, Excel


class ReportResponse(BaseModel):
    id: str
    title: str
    dataset_id: str
    dataset_name: str
    format: str
    created_at: str
    file_path: str
    download_url: str


@router.post("/generate", response_model=ReportResponse)
async def generate_report(
    request: ReportGenerateRequest,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Generate a data report (PDF or Excel) and return details"""
    d = db.query(Dataset).filter(Dataset.id == request.dataset_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dataset not found")

    meta_path = Path(settings.UPLOAD_DIR) / request.dataset_id / "metadata.json"
    meta = {}
    if meta_path.exists():
        with open(meta_path) as f:
            meta = json.load(f)
    else:
        # Load from DB record
        meta = {
            "id": d.id,
            "name": d.name,
            "file_size": d.file_size,
            "file_type": d.file_type,
            "row_count": d.row_count,
            "column_count": d.column_count,
            "quality_score": d.quality_score,
            "missing_values": d.missing_values,
            "duplicate_rows": d.duplicate_rows,
            "columns": d.columns or []
        }

    try:
        # Generate the report based on format
        if request.format.upper() == "PDF":
            file_path_str = report_gen.generate_pdf_report(
                dataset_id=request.dataset_id,
                title=request.title,
                meta=meta
            )
            file_ext = ".pdf"
        elif request.format.upper() == "EXCEL":
            file_path_str = report_gen.generate_excel_report(
                dataset_id=request.dataset_id,
                title=request.title,
                meta=meta
            )
            file_ext = ".xlsx"
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format: {request.format}")
        
        filename = Path(file_path_str).name
        # Build clean download url
        download_url = f"/uploads/{request.dataset_id}/reports/{filename}"
        
        # Save to database
        db_report = Report(
            title=request.title,
            dataset_id=request.dataset_id,
            format=request.format.upper(),
            file_path=file_path_str,
            download_url=download_url
        )
        db.add(db_report)
        
        # Log activity
        log = ActivityLog(
            user_id=user.id,
            action="report",
            details=f"Generated {request.format.upper()} report: {request.title}"
        )
        db.add(log)
        db.commit()
        db.refresh(db_report)

        report_meta = {
            "id": db_report.id,
            "title": db_report.title,
            "dataset_id": db_report.dataset_id,
            "dataset_name": d.name,
            "format": db_report.format,
            "created_at": db_report.created_at.isoformat(),
            "file_path": db_report.file_path,
            "download_url": db_report.download_url
        }
        
        # Keep local JSON metadata too for backup
        meta_out = Path(file_path_str).with_suffix(".json")
        with open(meta_out, 'w') as f:
            json.dump(report_meta, f, indent=2)

        return ReportResponse(**report_meta)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")


@router.get("/", response_model=List[ReportResponse])
async def list_reports(
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """List all generated reports for datasets belonging to the current user"""
    dataset_ids = db.query(Dataset.id).filter(Dataset.user_id == user.id)
    db_reports = db.query(Report).filter(Report.dataset_id.in_(dataset_ids)).order_by(Report.created_at.desc()).all()
    
    reports = []
    for r in db_reports:
        d = db.query(Dataset).filter(Dataset.id == r.dataset_id).first()
        reports.append({
            "id": r.id,
            "title": r.title,
            "dataset_id": r.dataset_id,
            "dataset_name": d.name if d else "Unknown Dataset",
            "format": r.format,
            "created_at": r.created_at.isoformat(),
            "file_path": r.file_path,
            "download_url": r.download_url
        })
        
    # Fallback to local files if DB is empty
    if not reports:
        upload_dir = Path(settings.UPLOAD_DIR)
        if upload_dir.exists():
            for dataset_dir in upload_dir.iterdir():
                if dataset_dir.is_dir():
                    report_dir = dataset_dir / "reports"
                    if report_dir.exists() and report_dir.is_dir():
                        for f in report_dir.glob("*.json"):
                            try:
                                with open(f) as file_obj:
                                    meta = json.load(file_obj)
                                    reports.append(meta)
                            except Exception:
                                pass
        reports.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    return reports
