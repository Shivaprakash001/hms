from app.db import supabase
from app.utils.auth import verify_password, create_access_token, get_password_hash
from app.utils.responses import ServiceResponse, ErrorCode
from app.utils.logger import get_logger
from typing import Dict, Any
from app.services.email_service import EmailService
from app.services import billing_service

logger = get_logger(__name__)


import secrets
import os
from datetime import datetime, timedelta, timezone


def _verify_or_migrate_legacy_password(profile: dict, input_password: str) -> bool:
    """
    Verify password with graceful fallback for legacy/malformed stored values.

    If the stored value is plain text (legacy bad data), allow one-time match and
    migrate it to bcrypt hash immediately.
    """
    stored = profile.get("password_hash")
    if not stored:
        return False

    try:
        return verify_password(input_password, stored)
    except Exception as verify_err:
        logger.warning(f"Password hash verification failed for profile={profile.get('id')}: {verify_err}")

        # Legacy fallback: plain-text password stored by mistake
        if stored == input_password:
            try:
                new_hash = get_password_hash(input_password)
                supabase.table("profiles") \
                    .update({"password_hash": new_hash}) \
                    .eq("id", profile.get("id")) \
                    .execute()
                logger.info(f"Migrated legacy plain-text password to bcrypt for profile={profile.get('id')}")
            except Exception as migrate_err:
                logger.warning(f"Failed to migrate legacy password hash for profile={profile.get('id')}: {migrate_err}")
            return True

        return False

def login(email: str, password: str) -> Dict[str, Any]:
    """
    Authenticate user and return JWT token.
    """
    try:
        normalized_email = (email or "").strip().lower()
        logger.info(f"Login attempt for: {normalized_email}")

        if not normalized_email:
            return ServiceResponse.error(ErrorCode.UNAUTHORIZED, "Invalid email or password")
        
        # 1. Fetch profile by email
        result = supabase.table("profiles")\
            .select("id, email, password_hash, role, name, is_active, is_profile_completed")\
            .ilike("email", normalized_email)\
            .limit(1)\
            .execute()
        
        if not result.data:
            logger.warning(f"Login failed: Email not found: {normalized_email}")
            return ServiceResponse.error(ErrorCode.UNAUTHORIZED, "Invalid email or password")
        
        profile = result.data[0]
        
        if not profile.get("is_active"):
            return ServiceResponse.error(ErrorCode.FORBIDDEN, "Account is disabled")
            
        # 1.1 Check Enrollment Status if student
        role = profile.get("role")
        student_profile_completed = None
        if role == "student":
            enrollment = supabase.table("students")\
                .select("id, status, profile_completed")\
                .eq("profile_id", profile["id"])\
                .execute()
            
            if enrollment.data:
                profile["student_id"] = enrollment.data[0]["id"]
                student_profile_completed = enrollment.data[0].get("profile_completed")
                if enrollment.data[0]["status"] == "INVITED":
                    return ServiceResponse.error(ErrorCode.FORBIDDEN, "Account not activated. Please check your email.")

        # 2. Verify password
        if not _verify_or_migrate_legacy_password(profile, password):
            logger.warning(f"Login failed: Incorrect password for: {normalized_email}")
            return ServiceResponse.error(ErrorCode.UNAUTHORIZED, "Invalid email or password")
            
        # 3. Create token
        token_data = {
            "sub": str(profile["id"]),
            "role": profile["role"],
            "email": profile["email"],
            "student_id": str(profile.get("student_id")) if profile.get("student_id") else None
        }
        
        token = create_access_token(token_data)
        
        logger.info(f"Login successful: {normalized_email}")
        return ServiceResponse.success({
            "access_token": token,
            "token_type": "bearer",
            "role": profile["role"],
            "name": profile["name"],
            "user_id": str(profile["id"]),
            "student_id": str(profile.get("student_id")) if profile.get("student_id") else None,
            "is_profile_completed": bool(student_profile_completed) if student_profile_completed is not None else profile.get("is_profile_completed", False)
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

        created_profile = res.data[0]

        # 4. Create hostel record (non-blocking if migration not applied yet)
        hostel_payload = {
            "owner_id": user_id,
            "name": data.get("hostel_name"),
            "phone": data.get("hostel_phone"),
            "address": data.get("hostel_address"),
            "city": data.get("hostel_city"),
            "state": data.get("hostel_state"),
            "pincode": data.get("hostel_pincode"),
            "upi_id": data.get("upi_id"),
            "gst_number": data.get("gst_number"),
            "is_active": True,
        }

        try:
            if hostel_payload["name"] and hostel_payload["phone"] and hostel_payload["address"]:
                hostel_res = supabase.table("hostels").insert(hostel_payload).execute()
                if hostel_res.data:
                    created_profile["hostel"] = hostel_res.data[0]
        except Exception as hostel_err:
            logger.warning(f"Hostel record creation skipped (table may be pending migration): {hostel_err}")

        # 5. Ensure default Starter subscription for owner/admin (non-blocking)
        try:
            if created_profile.get("role") in ("owner", "admin"):
                billing_service.ensure_owner_starter_subscription(user_id)
        except Exception as sub_err:
            logger.warning(f"Starter subscription ensure skipped: {sub_err}")

        return ServiceResponse.success(created_profile, "User registered successfully")
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

async def google_login(code: str, redirect_uri: str = None) -> Dict[str, Any]:
    """
    Exchange Google OAuth code for tokens and user information.
    """
    try:
        # 1. Exchange code for tokens
        # Note: You must ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are in .env
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        # Use the redirect_uri provided by the frontend (must match the one used in the initial auth request).
        # Fall back to the env variable. If neither is set, default to the primary production deployment URL.
        # IMPORTANT: Set GOOGLE_REDIRECT_URI explicitly in all deployment environments.
        effective_redirect_uri = redirect_uri or os.getenv("GOOGLE_REDIRECT_URI", "https://hms-sand-five.vercel.app/callback")
        logger.debug(f"Google OAuth: using redirect_uri={effective_redirect_uri}")
        if "localhost" in effective_redirect_uri:
            logger.warning("Google OAuth redirect_uri is pointing to localhost. This will fail in production.")
        
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": effective_redirect_uri,
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
            result = supabase.table("profiles").select("id, email, name, role, is_active, is_profile_completed").eq("email", email).execute()
            
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
                "student_id": token_data.get("student_id"),
                "is_profile_completed": profile.get("is_profile_completed", False)
            })

    except Exception as e:
        logger.exception(f"Error during Google login: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "Google login failed")
