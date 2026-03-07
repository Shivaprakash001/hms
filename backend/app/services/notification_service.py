from app.db import supabase
from typing import Dict, Any, List
from app.utils.responses import ServiceResponse, ErrorCode
from app.utils.logger import get_logger

logger = get_logger(__name__)

def get_user_notifications(user_id: str) -> Dict[str, Any]:
    """Fetch all notifications for a specific user."""
    try:
        res = supabase.table("notifications")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .execute()
        
        return ServiceResponse.success(res.data)
    except Exception as e:
        logger.exception(f"Error fetching notifications for user {user_id}: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, str(e))

def mark_as_read(notification_id: str, user_id: str) -> Dict[str, Any]:
    """Mark a notification as read."""
    try:
        res = supabase.table("notifications")\
            .update({"is_read": True})\
            .eq("id", notification_id)\
            .eq("user_id", user_id)\
            .execute()
        
        if not res.data:
            return ServiceResponse.not_found("Notification")
            
        return ServiceResponse.success(res.data[0], "Notification marked as read")
    except Exception as e:
        logger.exception(f"Error marking notification {notification_id} as read: {e}")
        return ServiceResponse.error(ErrorCode.DB_UPDATE_ERROR, str(e))

def create_notification(user_id: str, title: str, message: str, n_type: str) -> Dict[str, Any]:
    """Internal helper to create a notification."""
    try:
        data = {
            "user_id": user_id,
            "title": title,
            "message": message,
            "type": n_type
        }
        res = supabase.table("notifications").insert(data).execute()
        
        if not res.data:
            return ServiceResponse.error(ErrorCode.DB_INSERT_ERROR, "Failed to create notification")
            
        return ServiceResponse.success(res.data[0], "Notification created")
    except Exception as e:
        logger.exception(f"Error creating notification for user {user_id}: {e}")
        return ServiceResponse.error(ErrorCode.DB_INSERT_ERROR, str(e))
