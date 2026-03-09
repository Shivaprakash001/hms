from fastapi import APIRouter, HTTPException, Depends, status, Query
from app.services import complaint_service
from app.utils.auth import get_current_user, UserContext, require_admin_or_owner
from app.utils.responses import ErrorCode
from typing import List, Optional

router = APIRouter(prefix="/complaints", tags=["Complaints & Maintenance"])


def _handle_service_response(result: dict, success_status: int = status.HTTP_200_OK):
    """Helper to convert service response to HTTP response"""
    if not result.get("success"):
        error = result.get("error", {})
        status_map = {
            ErrorCode.RESOURCE_NOT_FOUND.value: status.HTTP_404_NOT_FOUND,
            ErrorCode.FORBIDDEN.value: status.HTTP_403_FORBIDDEN,
            ErrorCode.INVALID_INPUT.value: status.HTTP_422_UNPROCESSABLE_ENTITY,
        }
        http_status = status_map.get(error.get("code"), status.HTTP_400_BAD_REQUEST)
        raise HTTPException(status_code=http_status, detail=error)
    return result.get("data")


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_new_complaint(
    data: dict,
    user: UserContext = Depends(get_current_user)
):
    """
    Submit a new maintenance request or complaint.
    """
    result = complaint_service.create_complaint(data, created_by=user.user_id)
    return _handle_service_response(result, status.HTTP_201_CREATED)


@router.get("/")
def list_complaints(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    student_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: UserContext = Depends(get_current_user)
):
    """
    List complaints. 
    """
    result = complaint_service.get_all_complaints(
        student_id=student_id,
        status=status,
        category=category,
        limit=limit,
        offset=offset,
        owner_id=user.user_id if user.is_owner() else None
    )
    return _handle_service_response(result)


@router.get("/{complaint_id}")
def get_complaint_details(
    complaint_id: str,
    user: UserContext = Depends(get_current_user)
):
    """Get detailed info about a specific complaint."""
    result = complaint_service.get_complaint(complaint_id, user.user_id, user.role)
    return _handle_service_response(result)


@router.patch("/{complaint_id}/status")
def update_complaint_status(
    complaint_id: str,
    data: dict,
    user: UserContext = Depends(require_admin_or_owner)
):
    """
    **Admin/Warden only**: Update status and add remarks to a complaint.
    """
    result = complaint_service.update_complaint_status(
        complaint_id,
        data.get("status"),
        remarks=data.get("staff_remarks"),
        updated_by=user.user_id,
        requesting_user_role=user.role
    )
    return _handle_service_response(result)
