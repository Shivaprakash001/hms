from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.schemas.auth_schema import LoginRequest, TokenResponse, RegisterRequest, PasswordChangeRequest, GoogleLoginRequest
from app.services import auth_service
from app.utils.auth import get_current_user, UserContext, validate_password_strength, decode_jwt_token
from app.utils.responses import ErrorCode
from app.utils.rate_limit import check_login_rate_limit, record_login_failure, check_password_change_rate_limit
from app.db import supabase
import datetime

security = HTTPBearer()
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse, summary="Login and get access token")
def login(request: Request, data: LoginRequest):
    """
    Authenticate with email and password to receive a JWT Bearer token.
    """
    check_login_rate_limit(request)
    
    result = auth_service.login(data.email, data.password)
    
    if not result.get("success"):
        record_login_failure(request)
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
    from app.db import supabase
    
    student_id = user.student_id
    extra = {}

    if user.is_student():
        # Retrieve missing student_id for backwards compatibility or fresh loads
        if not student_id:
            res = supabase.table("students").select("id").eq("profile_id", user.user_id).execute()
            if res.data:
                student_id = res.data[0]["id"]
                
        # Fast query execution combining profiles and possible room data
        # We perform one call for profile due_day + student's monthly_rent using the student_id
        if student_id:
            # Single join across students --> profiles and students --> room_allocations --> rooms
            res = supabase.table("students").select(
                "monthly_rent, profiles:profile_id(due_day, is_profile_completed), room_allocations(room_id, end_date, rooms(room_no, capacity))"
            ).eq("id", student_id).execute()
            
            if res.data and len(res.data) > 0:
                student_data = res.data[0]
                extra["monthly_rent"] = student_data.get("monthly_rent")
                
                profile_rel = student_data.get("profiles")
                if profile_rel:
                    p_dict = profile_rel[0] if isinstance(profile_rel, list) else profile_rel
                    extra["due_day"] = p_dict.get("due_day")
                    extra["is_profile_completed"] = p_dict.get("is_profile_completed", False)
                    
                allocations = student_data.get("room_allocations", [])
                if isinstance(allocations, list):
                    active_allocs = [a for a in allocations if a.get("end_date") is None]
                    if active_allocs:
                        alloc = active_allocs[0]
                        extra["room_id"] = alloc.get("room_id")
                        
                        room_rel = alloc.get("rooms")
                        if room_rel:
                            rm_dict = room_rel[0] if isinstance(room_rel, list) else room_rel
                            extra["room_no"] = rm_dict.get("room_no")
                            extra["room_capacity"] = rm_dict.get("capacity")
        else:
            # Fallback if somehow there's still no student ID (shouldn't happen on pure students)
            prof_res = supabase.table("profiles").select("due_day, is_profile_completed").eq("id", user.user_id).execute()
            if prof_res.data:
                extra["due_day"] = prof_res.data[0].get("due_day")
                extra["is_profile_completed"] = prof_res.data[0].get("is_profile_completed", False)
    else:
        # Non-students don't need profile completion flow
        extra["is_profile_completed"] = True
        
    return {
        "user_id": str(user.user_id),
        "email": user.email,
        "role": user.role,
        "student_id": str(student_id) if student_id else None,
        "is_admin": user.is_admin(),
        "is_warden": user.is_warden(),
        "is_student": user.is_student(),
        **extra
    }

@router.post("/register", response_model=dict, summary="Register a new Property Owner")
def register(data: RegisterRequest):
    """
    Register a new property owner (Admin).
    Students/Tenants must be invited by an owner and cannot register themselves publicly.
    """
    validate_password_strength(data.password)
    
    # Force role to admin regardless of input
    reg_data = data.model_dump()
    reg_data["role"] = "admin" 
    
    result = auth_service.register_user(reg_data)
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error")
        )
        
    return result.get("data")

@router.post("/change-password", summary="Change user password")
def change_password(
    request: Request,
    data: PasswordChangeRequest,
    user: UserContext = Depends(get_current_user)
):
    """
    Update password for the currently authenticated user.
    """
    check_password_change_rate_limit(request)
    validate_password_strength(data.new_password)
    
    result = auth_service.change_password(
        str(user.user_id),
        data.old_password,
        data.new_password
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error")
        )
        
    return result.get("data")
    
@router.post("/google-callback", response_model=TokenResponse, summary="Handle Google OAuth callback")
async def google_callback(data: GoogleLoginRequest):
    """
    Exchange Google OAuth code for local HMS token.
    """
    result = await auth_service.google_login(data.code, redirect_uri=data.redirect_uri)
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=result.get("error", "Google authentication failed")
        )
        
    return result.get("data")

@router.post("/logout", summary="Logout user by invalidating the token")
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    user: UserContext = Depends(get_current_user)
):
    """
    Invalidates the current JWT token by adding it to a blacklist database table.
    """
    token = credentials.credentials
    try:
        # Extract expiration date from the token
        payload = decode_jwt_token(token)
        exp_timestamp = payload.get("exp")
        if not exp_timestamp:
            expires_at = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1)).isoformat()
        else:
            expires_at = datetime.datetime.fromtimestamp(exp_timestamp, tz=datetime.timezone.utc).isoformat()
            
        supabase.table("token_blacklist").insert({
            "token": token,
            "expires_at": expires_at
        }).execute()
        return {"success": True, "message": "Successfully logged out."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Logout failed: {str(e)}")
