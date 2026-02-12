from fastapi import APIRouter, HTTPException, Query, status, Header
from app.schamas.profile_schema import (
    ProfileCreate, ProfileUpdate, ProfileAdminUpdate,
    ProfileResponse, RoleEnum
)
from app.services import profile_service
from app.utils.responses import ErrorCode
from app.utils.logger import get_logger
from typing import List, Optional

router = APIRouter(prefix="/profiles", tags=["Profiles"])
logger = get_logger(__name__)


def _handle_service_response(result: dict, success_status: int = status.HTTP_200_OK):
    """Helper to convert service response to HTTP response"""
    if not result.get("success"):
        error = result.get("error", {})
        error_code = error.get("code", ErrorCode.UNKNOWN_ERROR.value)
        message = error.get("message", "An error occurred")
        
        # Map error codes to HTTP status codes
        status_map = {
            ErrorCode.RESOURCE_NOT_FOUND.value: status.HTTP_404_NOT_FOUND,
            ErrorCode.RESOURCE_ALREADY_EXISTS.value: status.HTTP_409_CONFLICT,
            ErrorCode.FORBIDDEN.value: status.HTTP_403_FORBIDDEN,
            ErrorCode.VALIDATION_ERROR.value: status.HTTP_422_UNPROCESSABLE_ENTITY,
            ErrorCode.UNAUTHORIZED.value: status.HTTP_401_UNAUTHORIZED,
        }
        
        http_status = status_map.get(error_code, status.HTTP_400_BAD_REQUEST)
        raise HTTPException(status_code=http_status, detail=result.get("error"))
    
    return result.get("data")


@router.post(
    "/",
    response_model=ProfileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new profile",
    description="Create a new user profile with role (student, admin, or warden)"
)
def create_new_profile(profile: ProfileCreate):
    """
    Create a new profile with the following information:
    - **name**: Full name of the user
    - **email**: Email address (must be unique)
    - **phone**: Phone number (10-15 digits)
    - **role**: User role (student, admin, or warden)
    - **address**: Optional residential address
    - **emergency_contact**: Optional emergency contact number
    """
    result = profile_service.create_profile(profile.model_dump())
    return _handle_service_response(result, status.HTTP_201_CREATED)


@router.get(
    "/",
    response_model=dict,
    summary="Get all profiles",
    description="Retrieve all active profiles with optional filtering and pagination"
)
def read_all_profiles(
    role: Optional[RoleEnum] = Query(None, description="Filter by role"),
    limit: Optional[int] = Query(None, ge=1, le=100, description="Maximum number of results"),
    offset: Optional[int] = Query(0, ge=0, description="Number of results to skip"),
    include_inactive: bool = Query(False, description="Include soft-deleted profiles (admin only)")
):
    """
    Get all profiles with optional filters:
    - **role**: Filter by user role (student, admin, warden)
    - **limit**: Maximum number of results (1-100)
    - **offset**: Number of results to skip for pagination
    - **include_inactive**: Include deleted profiles (requires admin)
    """
    result = profile_service.get_all_profiles(
        role=role.value if role else None,
        limit=limit,
        offset=offset,
        include_inactive=include_inactive
    )
    return _handle_service_response(result)


@router.get(
    "/by-role/{role}",
    response_model=List[ProfileResponse],
    summary="Get profiles by role",
    description="Retrieve all active profiles with a specific role"
)
def read_profiles_by_role(role: RoleEnum):
    """Get all active profiles with a specific role (student, admin, or warden)."""
    result = profile_service.get_profiles_by_role(role.value)
    data = _handle_service_response(result)
    return data.get("profiles", [])


@router.get(
    "/email/{email}",
    response_model=ProfileResponse,
    summary="Get profile by email",
    description="Retrieve an active profile by email address"
)
def read_profile_by_email(email: str):
    """Get an active profile by email address."""
    result = profile_service.get_profile_by_email(email)
    return _handle_service_response(result)


@router.get(
    "/{profile_id}",
    response_model=ProfileResponse,
    summary="Get profile by ID",
    description="Retrieve a specific active profile by its ID"
)
def read_profile(profile_id: str):
    """Get a single active profile by its unique ID."""
    result = profile_service.get_profile(profile_id)
    return _handle_service_response(result)


@router.put(
    "/{profile_id}",
    response_model=ProfileResponse,
    summary="Update profile",
    description="Update an existing profile by ID (regular users cannot change roles)"
)
def modify_profile(
    profile_id: str,
    profile: ProfileUpdate,
    x_user_role: Optional[str] = Header(None, description="User role for authorization")
):
    """
    Update a profile. Only provided fields will be updated.
    Regular users cannot change roles - use the admin endpoint for that.
    
    - **name**: Full name
    - **email**: Email address
    - **phone**: Phone number
    - **address**: Residential address
    - **emergency_contact**: Emergency contact number
    """
    is_admin = x_user_role == "admin" if x_user_role else False
    
    result = profile_service.update_profile(
        profile_id,
        profile.model_dump(exclude_unset=True),
        is_admin=is_admin
    )
    return _handle_service_response(result)


@router.put(
    "/{profile_id}/admin",
    response_model=ProfileResponse,
    summary="Admin: Update profile with role change",
    description="Admin-only endpoint to update profile including role changes"
)
def admin_modify_profile(
    profile_id: str,
    profile: ProfileAdminUpdate,
    x_user_role: Optional[str] = Header(None, description="User role (must be admin)")
):
    """
    Admin-only profile update that allows role changes.
    
    All fields from regular update plus:
    - **role**: User role (student, admin, warden) - admin only
    """
    # Check if user is admin
    if x_user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": ErrorCode.FORBIDDEN.value, "message": "Admin access required"}
        )
    
    result = profile_service.update_profile(
        profile_id,
        profile.model_dump(exclude_unset=True),
        is_admin=True
    )
    return _handle_service_response(result)


@router.delete(
    "/{profile_id}",
    status_code=status.HTTP_200_OK,
    summary="Soft delete profile",
    description="Soft delete a profile by ID (sets is_active=false, data is preserved)"
)
def remove_profile(profile_id: str):
    """
    Soft delete a profile by its ID.
    The profile is marked as inactive but data is preserved and can be restored.
    """
    result = profile_service.delete_profile(profile_id)
    return _handle_service_response(result)


@router.post(
    "/{profile_id}/restore",
    response_model=ProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Restore deleted profile",
    description="Restore a soft-deleted profile"
)
def restore_deleted_profile(
    profile_id: str,
    x_user_role: Optional[str] = Header(None, description="User role (admin recommended)")
):
    """
    Restore a soft-deleted profile.
    This reactivates a profile that was previously deleted.
    """
    result = profile_service.restore_profile(profile_id)
    return _handle_service_response(result)
