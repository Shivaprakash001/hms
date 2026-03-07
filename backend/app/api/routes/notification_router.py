from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.utils.auth import get_current_user, UserContext
from app.schemas.notification_schema import NotificationResponse, NotificationUpdate
from app.services import notification_service
from app.utils.responses import ErrorCode

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("/", response_model=List[NotificationResponse])
async def list_notifications(current_user: UserContext = Depends(get_current_user)):
    """Get all notifications for the current user."""
    result = notification_service.get_user_notifications(str(current_user.user_id))
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result["data"]

@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_as_read(notification_id: str, current_user: UserContext = Depends(get_current_user)):
    """Mark a specific notification as read."""
    result = notification_service.mark_as_read(notification_id, str(current_user.user_id))
    if not result["success"]:
        status_code = 404 if result["error_code"] == ErrorCode.RESOURCE_NOT_FOUND else 400
        raise HTTPException(status_code=status_code, detail=result["message"])
    return result["data"]
