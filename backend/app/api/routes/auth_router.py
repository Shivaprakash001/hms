from fastapi import APIRouter, HTTPException, Depends, status
from app.schamas.auth_schema import LoginRequest, TokenResponse
from app.services import auth_service
from app.utils.auth import get_current_user, UserContext
from app.utils.responses import ErrorCode

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse, summary="Login and get access token")
def login(data: LoginRequest):
    """
    Authenticate with email and password to receive a JWT Bearer token.
    """
    result = auth_service.login(data.email, data.password)
    
    if not result.get("success"):
        error = result.get("error", {})
        status_code = status.HTTP_401_UNAUTHORIZED
        if error.get("code") == ErrorCode.FORBIDDEN.value:
            status_code = status.HTTP_403_FORBIDDEN
            
        raise HTTPException(
            status_code=status_code,
            detail=error
        )
        
    return result.get("data")


@router.get("/me", response_model=dict, summary="Get current user info from token")
def get_me(user: UserContext = Depends(get_current_user)):
    """
    Returns information about the user currently authenticated by the token.
    """
    return {
        "user_id": user.user_id,
        "email": user.email,
        "role": user.role,
        "is_admin": user.is_admin(),
        "is_warden": user.is_warden(),
        "is_student": user.is_student()
    }
