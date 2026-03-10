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
        # Fetch the role and owner_id of the user
        prof_res = supabase.table("profiles").select("role, owner_id").eq("id", user_id).execute()
        owner_id = None
        if prof_res.data:
            profile = prof_res.data[0]
            if profile.get("role") in ("admin", "owner"):
                owner_id = user_id
            else:
                owner_id = profile.get("owner_id")

        data = {
            "user_id": user_id,
            "owner_id": owner_id,
            "title": title,
            "message": message,
            "type": n_type.lower()
        }
        
        try:
            res = supabase.table("notifications").insert(data).execute()
        except Exception as e:
            # Check for missing column error (PGRST204)
            if "PGRST204" in str(e) or "column" in str(e).lower() and "type" in str(e).lower():
                logger.warning(f"Database 'notifications' table is missing 'type' column. Retrying without it.")
                data.pop("type")
                res = supabase.table("notifications").insert(data).execute()
            else:
                raise e
        
        if not res.data:
            return ServiceResponse.error(ErrorCode.DB_INSERT_ERROR, "Failed to create notification")
            
        return ServiceResponse.success(res.data[0], "Notification created")
    except Exception as e:
        logger.exception(f"Error creating notification for user {user_id}: {e}")
        return ServiceResponse.error(ErrorCode.DB_INSERT_ERROR, str(e))
