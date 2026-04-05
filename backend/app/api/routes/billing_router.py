from fastapi import APIRouter, HTTPException, Depends, status

from app.services import billing_service
from app.utils.auth import get_current_user, UserContext
from app.utils.responses import ErrorCode

router = APIRouter(tags=["Billing & Plans"])


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


@router.get("/plans", response_model=list, summary="Get available pricing plans")
def get_plans():
    result = billing_service.list_plans()
    return _handle_service_response(result)


@router.get("/owner/me/subscription", response_model=dict, summary="Get current owner subscription and usage")
def get_my_subscription(user: UserContext = Depends(get_current_user)):
    if not user.is_owner():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner/admin can access this endpoint.")

    result = billing_service.get_owner_subscription(str(user.user_id))
    return _handle_service_response(result)
