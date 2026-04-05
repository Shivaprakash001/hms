from fastapi import APIRouter, HTTPException, Depends, status
from app.utils.auth import get_current_user, UserContext
from app.services import owner_service
from app.schemas.owner_schema import OwnerProfileUpdate, HostelUpdate
from app.utils.responses import ErrorCode

router = APIRouter(prefix="/owner", tags=["Owner"])


def _handle_service_response(result: dict, success_status: int = status.HTTP_200_OK):
    if not result.get("success"):
        error = result.get("error", {})
        error_code = error.get("code", ErrorCode.UNKNOWN_ERROR.value)

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


@router.get("/me/profile", response_model=dict, summary="Get owner profile + hostel details")
def get_my_owner_profile(user: UserContext = Depends(get_current_user)):
    if not user.is_owner():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner/admin can access this endpoint.")
    result = owner_service.get_owner_profile(str(user.user_id))
    return _handle_service_response(result)


@router.patch("/me/profile", response_model=dict, summary="Update owner profile")
def patch_my_owner_profile(
    data: OwnerProfileUpdate,
    user: UserContext = Depends(get_current_user)
):
    if not user.is_owner():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner/admin can access this endpoint.")
    result = owner_service.update_owner_profile(str(user.user_id), data.model_dump(exclude_unset=True))
    return _handle_service_response(result)


@router.patch("/me/hostel", response_model=dict, summary="Update owner hostel details")
def patch_my_owner_hostel(
    data: HostelUpdate,
    user: UserContext = Depends(get_current_user)
):
    if not user.is_owner():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner/admin can access this endpoint.")
    result = owner_service.update_owner_hostel(str(user.user_id), data.model_dump(exclude_unset=True))
    return _handle_service_response(result)
