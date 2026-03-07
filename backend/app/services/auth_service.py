from app.db import supabase
from app.utils.auth import verify_password, create_access_token, get_password_hash
from app.utils.responses import ServiceResponse, ErrorCode
from app.utils.logger import get_logger
from typing import Dict, Any

logger = get_logger(__name__)


import secrets
from datetime import datetime, timedelta

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
                .select("status")\
                .eq("profile_id", profile["id"])\
                .execute()
            
            if enrollment.data and enrollment.data[0]["status"] == "INVITED":
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
            "email": profile["email"]
        }
        
        token = create_access_token(token_data)
        
        logger.info(f"Login successful: {email}")
        return ServiceResponse.success({
            "access_token": token,
            "token_type": "bearer",
            "role": profile["role"],
            "name": profile["name"]
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
            
        user_id = auth_response.user.id
        
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

def invite_tenant(data: dict, owner_id: str) -> Dict[str, Any]:
    """
    Create a tenant invitation.
    """
    try:
        email = data.get("email")
        name = data.get("name")
        room_id = data.get("room_id")

        # 1. Create Profile first (without password)
        existing = supabase.table("profiles").select("id").eq("email", email).execute()
        if existing.data:
            return ServiceResponse.already_exists("User", f"Email {email} is already registered")

        new_profile = {
            "email": email,
            "name": name,
            "role": "student",
            "is_active": True,
            "owner_id": owner_id
        }
        prof_res = supabase.table("profiles").insert(new_profile).execute()
        if not prof_res.data:
            return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to create profile")
        
        profile_id = prof_res.data[0]["id"]

        # 2. Create Student enrollment
        new_student = {
            "profile_id": profile_id,
            "owner_id": owner_id,
            "room_id": room_id,
            "status": "INVITED",
            "joined_on": datetime.now().date().isoformat(),
            "monthly_rent": 0 # Default, can be updated later
        }
        stu_res = supabase.table("students").insert(new_student).execute()
        if not stu_res.data:
             # Cleanup profile if student creation fails
             supabase.table("profiles").delete().eq("id", profile_id).execute()
             return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to create student enrollment")

        # 3. Generate Invitation Token
        token = secrets.token_urlsafe(32)
        expires_at = (datetime.now() + timedelta(hours=24)).isoformat()
        
        inv_res = supabase.table("invitation_tokens").insert({
            "profile_id": profile_id,
            "token": token,
            "expires_at": expires_at
        }).execute()

        if not inv_res.data:
            return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to generate invitation token")

        # 4. In a real app, send email here. 
        # For now, we return the token/link so the user can see it in logs/UI
        activation_link = f"http://localhost:5173/activate?token={token}"
        logger.info(f"INVITATION CREATED: {activation_link}")

        return ServiceResponse.success({
            "profile_id": profile_id,
            "token": token,
            "activation_link": activation_link
        }, "Invitation sent successfully")

    except Exception as e:
        logger.exception(f"Error inviting tenant: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, str(e))

def activate_tenant(token: str, password: str) -> Dict[str, Any]:
    """
    Activate tenant account using token.
    """
    try:
        # 1. Verify token
        res = supabase.table("invitation_tokens")\
            .select("profile_id, expires_at")\
            .eq("token", token)\
            .execute()
        
        if not res.data:
            return ServiceResponse.error(ErrorCode.NOT_FOUND, "Invalid or expired token")
        
        invitation = res.data[0]
        profile_id = invitation["profile_id"]
        
        if datetime.fromisoformat(invitation["expires_at"]) < datetime.now():
            return ServiceResponse.error(ErrorCode.FORBIDDEN, "Token has expired")

        # 2. Update Profile Password
        hashed_password = get_password_hash(password)
        prof_res = supabase.table("profiles")\
            .update({"password_hash": hashed_password})\
            .eq("id", profile_id)\
            .execute()
        
        if not prof_res.data:
            return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to update password")

        # 3. Update Student Status to ACTIVE
        stu_res = supabase.table("students")\
            .update({"status": "ACTIVE"})\
            .eq("profile_id", profile_id)\
            .execute()
        
        if not stu_res.data:
            return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to activate enrollment")

        # 4. Delete Token
        supabase.table("invitation_tokens").delete().eq("token", token).execute()

        return ServiceResponse.success(None, "Account activated successfully. You can now login.")

    except Exception as e:
        logger.exception(f"Error activating account: {e}")
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
