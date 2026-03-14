from app.db import supabase
from app.utils.auth import verify_password, create_access_token, get_password_hash
from app.utils.responses import ServiceResponse, ErrorCode
from app.utils.logger import get_logger
from typing import Dict, Any
from app.services.email_service import EmailService

logger = get_logger(__name__)


import secrets
import os
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


import httpx

async def google_login(code: str) -> Dict[str, Any]:
    """
    Exchange Google OAuth code for tokens and user information.
    """
    try:
        # 1. Exchange code for tokens
        # Note: You must ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are in .env
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:3000/callback")
        
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            
            if token_response.status_code != 200:
                logger.error(f"Google token exchange failed: {token_response.text}")
                return ServiceResponse.error(ErrorCode.UNAUTHORIZED, "Failed to exchange Google code")
            
            tokens = token_response.json()
            access_token = tokens.get("access_token")
            
            # 2. Get user info
            user_info_response = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            
            if user_info_response.status_code != 200:
                return ServiceResponse.error(ErrorCode.UNAUTHORIZED, "Failed to get Google user info")
            
            user_info = user_info_response.json()
            email = user_info.get("email")
            name = user_info.get("name")
            
            if not email:
                return ServiceResponse.error(ErrorCode.UNAUTHORIZED, "Google account missing email")

            # 3. Find or Create Profile
            # Note: For production, you may want to restrict registration if needed.
            result = supabase.table("profiles").select("*").eq("email", email).execute()
            
            if result.data:
                profile = result.data[0]
            else:
                # Create new profile if it doesn't exist
                # generate a UUID for the user
                import uuid
                new_user_id = str(uuid.uuid4())
                
                new_profile = {
                    "id": new_user_id,
                    "email": email,
                    "name": name,
                    "role": "admin", # Defaulting to admin/owner for new registrations via Google
                    "is_active": True
                }
                insert_res = supabase.table("profiles").insert(new_profile).execute()
                if not insert_res.data:
                    return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to create Google profile")
                profile = insert_res.data[0]

            # 4. Create local JWT
            token_data = {
                "sub": str(profile["id"]),
                "role": profile["role"],
                "email": profile["email"]
            }
            
            # Check if they are a student to add student_id
            if profile["role"] == "student":
                stu_res = supabase.table("students").select("id").eq("profile_id", profile["id"]).execute()
                if stu_res.data:
                    token_data["student_id"] = str(stu_res.data[0]["id"])
            
            token = create_access_token(token_data)
            
            return ServiceResponse.success({
                "access_token": token,
                "token_type": "bearer",
                "role": profile["role"],
                "name": profile["name"],
                "user_id": str(profile["id"]),
                "student_id": token_data.get("student_id")
            })

    except Exception as e:
        logger.exception(f"Error during Google login: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "Google login failed")
