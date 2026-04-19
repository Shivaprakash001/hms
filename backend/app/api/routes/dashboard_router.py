from fastapi import APIRouter, Depends, HTTPException, status
from app.services import dashboard_service
from app.utils.auth import get_current_user, UserContext, require_admin_or_owner
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

def _handle_response(result: dict):
    if not result.get("success"):
        logger.error(f"Dashboard Stats Error: {result.get('error')} | Msg: {result.get('message')}")
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


@router.get("/summary")
def get_dashboard_summary(user: UserContext = Depends(require_admin_or_owner)):
    """
    Consolidated owner dashboard summary payload.
    """
    result = dashboard_service.get_dashboard_stats(user_id=user.user_id)
    return _handle_response(result)

@router.get("/monthly-stats")
def get_monthly_dashboard_stats(months: int = 6, user: UserContext = Depends(require_admin_or_owner)):
    """
    Get aggregated monthly dashboard statistics for charts.
    """
    result = dashboard_service.get_monthly_stats(user_id=user.user_id, months=months)
    return _handle_response(result)

@router.get("/student/stats")
def get_student_dashboard_stats(user: UserContext = Depends(get_current_user)):
    """
    Get student-specific dashboard statistics.
    """
    if user.role != "student":
         raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can access student dashboard stats"
        )
    result = dashboard_service.get_student_dashboard_stats(profile_id=user.user_id)
    return _handle_response(result)
