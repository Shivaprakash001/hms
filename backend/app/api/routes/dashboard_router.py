from fastapi import APIRouter, Depends, HTTPException, status
from app.services import dashboard_service
from app.utils.auth import get_current_user, UserContext, require_admin_or_owner

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

def _handle_response(result: dict):
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error")
        )
    return result.get("data")

@router.get("/stats")
def get_dashboard_stats(user: UserContext = Depends(require_admin_or_owner)):
    """
    Get aggregated dashboard statistics.
    """
    result = dashboard_service.get_dashboard_stats(user_id=user.user_id)
    return _handle_response(result)
