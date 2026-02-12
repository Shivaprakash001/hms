from app.db import supabase
from app.utils.auth import verify_password, create_access_token, get_password_hash
from app.utils.responses import ServiceResponse, ErrorCode
from app.utils.logger import get_logger
from typing import Dict, Any

logger = get_logger(__name__)


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


def set_initial_password(profile_id: str, plain_password: str) -> Dict[str, Any]:
    """Helper to set password for a profile (e.g. during manual setup)"""
    hashed = get_password_hash(plain_password)
    supabase.table("profiles").update({"password_hash": hashed}).eq("id", profile_id).execute()
    return ServiceResponse.success({}, "Password set successfully")
