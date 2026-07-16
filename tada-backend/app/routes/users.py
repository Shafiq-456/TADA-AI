"""
Users routes - queries PostgreSQL database statistics
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from app.database import get_db
from app.utils.auth import get_current_user
from app.models import User, Dataset, Report, Forecast, ActivityLog

router = APIRouter()


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None


@router.get("/me")
async def get_me(user = Depends(get_current_user), db: Session = Depends(get_db)):
    """Retrieve detailed stats and activity timeline for the authenticated user"""
    datasets_count = db.query(Dataset).filter(Dataset.user_id == user.id).count()
    
    dataset_ids = db.query(Dataset.id).filter(Dataset.user_id == user.id)
    reports_count = db.query(Report).filter(Report.dataset_id.in_(dataset_ids)).count()
    forecasts_count = db.query(Forecast).filter(Forecast.dataset_id.in_(dataset_ids)).count()
    
    logs = db.query(ActivityLog).filter(ActivityLog.user_id == user.id).order_by(ActivityLog.created_at.desc()).limit(10).all()
    
    activity_timeline = []
    for log in logs:
        icon = "📁"
        if log.action == "clean":
            icon = "🧹"
        elif log.action == "forecast":
            icon = "📈"
        elif log.action == "report":
            icon = "📄"
        elif log.action == "chat":
            icon = "🤖"
            
        activity_timeline.append({
            "icon": icon,
            "text": log.details,
            "time": log.created_at.strftime("%b %d, %Y %H:%M")
        })
        
    if not activity_timeline:
        activity_timeline = [
            {"icon": "⚡", "text": "Created profile session", "time": user.created_at.strftime("%b %d, %Y %H:%M")}
        ]

    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "avatar_url": user.avatar_url,
        "created_at": user.created_at.isoformat(),
        "stats": {
            "datasets": datasets_count,
            "reports": reports_count,
            "forecasts": forecasts_count,
            "analyses": datasets_count * 3
        },
        "activity_timeline": activity_timeline
    }


@router.patch("/me")
async def update_profile(
    body: UpdateProfileRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update the authenticated user's display name"""
    db_user = db.query(User).filter(User.id == user.id).first()
    if not db_user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")
    if body.full_name is not None:
        db_user.full_name = body.full_name.strip()
    db.commit()
    db.refresh(db_user)
    return {"full_name": db_user.full_name, "email": db_user.email}
