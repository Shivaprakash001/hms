from fastapi import APIRouter, HTTPException, Depends, status
from app.schemas.auth_schema import LoginRequest, TokenResponse, RegisterRequest, PasswordChangeRequest
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
    from app.db import supabase
    
    student_id = user.student_id
    extra = {}

    if user.is_student():
        if not student_id:
            # Fallback for old tokens: fetch from DB
            res = supabase.table("students").select("id").eq("profile_id", user.user_id).execute()
            if res.data:
                student_id = res.data[0]["id"]
        
        # Fetch due_day from profile
        prof_res = supabase.table("profiles").select("due_day").eq("id", user.user_id).execute()
        if prof_res.data:
            extra["due_day"] = prof_res.data[0].get("due_day")
        
        # Fetch active allocation → room info
        if student_id:
            alloc_res = supabase.table("room_allocations")\
                .select("room_id, rooms(room_no, capacity)")\
                .eq("student_id", student_id)\
                .is_("end_date", "null")\
                .execute()
            if alloc_res.data:
                alloc = alloc_res.data[0]
                room = alloc.get("rooms") or {}
                extra["room_no"] = room.get("room_no")
                extra["room_capacity"] = room.get("capacity")
                extra["room_id"] = alloc.get("room_id")
            
            # Fetch monthly_rent from student record
            stu_res = supabase.table("students").select("monthly_rent").eq("id", student_id).execute()
            if stu_res.data:
                extra["monthly_rent"] = stu_res.data[0].get("monthly_rent")
        
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
    data: PasswordChangeRequest,
    user: UserContext = Depends(get_current_user)
):
    """
    Update password for the currently authenticated user.
    """
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
