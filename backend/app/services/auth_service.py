from app.db import supabase
from app.utils.auth import verify_password, create_access_token, get_password_hash
from app.utils.responses import ServiceResponse, ErrorCode
from app.utils.logger import get_logger
from typing import Dict, Any
from app.services.email_service import EmailService

logger = get_logger(__name__)


import secrets
from datetime import datetime, timedelta, timezone

def login(email: str, password: str) -> Dict[str, Any]:
    """
    Authenticate user and return JWT token.
    """
    try:
        logger.info(f"Login attempt for: {email}")
        
        # 1. Fetch profile by email
        result = supabase.table("profiles")\
            .select("id, email, password_hash, role, name, is_active")\
            .eq("email", email)\
            .execute()
        
        if not result.data:
            logger.warning(f"Login failed: Email not found: {email}")
            return ServiceResponse.error(ErrorCode.UNAUTHORIZED, "Invalid email or password")
        
        profile = result.data[0]
        
        if not profile.get("is_active"):
            return ServiceResponse.error(ErrorCode.FORBIDDEN, "Account is disabled")
            
        # 1.1 Check Enrollment Status if student
        role = profile.get("role")
        if role == "student":
            enrollment = supabase.table("students")\
                .select("id, status")\
                .eq("profile_id", profile["id"])\
                .execute()
            
            if enrollment.data:
                profile["student_id"] = enrollment.data[0]["id"]
                if enrollment.data[0]["status"] == "INVITED":
                    return ServiceResponse.error(ErrorCode.FORBIDDEN, "Account not activated. Please check your email.")

        # 2. Verify password
        hashed_password = profile.get("password_hash")
        if not hashed_password or not verify_password(password, hashed_password):
            logger.warning(f"Login failed: Incorrect password for: {email}")
            return ServiceResponse.error(ErrorCode.UNAUTHORIZED, "Invalid email or password")
            
        # 3. Create token
        token_data = {
            "sub": str(profile["id"]),
            "role": profile["role"],
            "email": profile["email"],
            "student_id": str(profile.get("student_id")) if profile.get("student_id") else None
        }
        
        token = create_access_token(token_data)
        
        logger.info(f"Login successful: {email}")
        return ServiceResponse.success({
            "access_token": token,
            "token_type": "bearer",
            "role": profile["role"],
            "name": profile["name"],
            "user_id": str(profile["id"]),
            "student_id": str(profile.get("student_id")) if profile.get("student_id") else None
        })
        
    except Exception as e:
        logger.exception(f"Error during login: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "Authentication failed")

def register_user(data: dict) -> Dict[str, Any]:
    """
    Register a new user (Create Profile and Supabase Auth User).
    """
    try:
        email = data.get("email")
        password = data.get("password")
        
        # 1. Check if profile already exists
        existing = supabase.table("profiles").select("id").eq("email", email).execute()
        if existing.data:
            return ServiceResponse.already_exists("User", f"Email {email} is already registered")
            
        # 2. Sign up in Supabase Auth to get a user ID
        auth_response = supabase.auth.sign_up({
            "email": email,
            "password": password
        })
        
        if not auth_response.user:
            return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "Failed to create user in Auth")
            
        user_id = str(auth_response.user.id)  # Convert UUID -> str
        
        # 3. Create Profile using the Auth User ID
        hashed_password = get_password_hash(password)
        
        new_profile = {
            "id": user_id,
            "email": email,
            "password_hash": hashed_password,
            "name": data.get("name"),
            "role": data.get("role", "admin"),
            "is_active": data.get("is_active", True),
            "phone": data.get("phone"),
            "owner_id": data.get("owner_id")
        }
        
        res = supabase.table("profiles").insert(new_profile).execute()
        
        if not res.data:
             return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to create profile")
             
        return ServiceResponse.success(res.data[0], "User registered successfully")
    except Exception as e:
        logger.exception(f"Error registering user: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, str(e))


def change_password(user_id: str, current_password: str, new_password: str) -> Dict[str, Any]:
    """
    Change user password after verifying current one.
    """
    try:
        logger.info(f"Password change attempt for user: {user_id}")
        
        # 1. Fetch profile
        result = supabase.table("profiles")\
            .select("password_hash")\
            .eq("id", user_id)\
            .execute()
            
        if not result.data:
            return ServiceResponse.not_found("User")
            
        profile = result.data[0]
        
        # 2. Verify current password
        if not verify_password(current_password, profile.get("password_hash")):
            return ServiceResponse.error(ErrorCode.UNAUTHORIZED, "Current password is incorrect")
            
        # 3. Hash and update
        new_hash = get_password_hash(new_password)
        update_res = supabase.table("profiles")\
            .update({"password_hash": new_hash})\
            .eq("id", user_id)\
            .execute()
            
        if not update_res.data:
            return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to update password")
            
        return ServiceResponse.success(None, "Password updated successfully")
        
    except Exception as e:
        logger.exception(f"Error changing password: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "Failed to change password")
