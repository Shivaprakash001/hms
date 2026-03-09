"""
JWT Authentication and Authorization Utilities

This module provides JWT token validation and user context extraction
for securing API endpoints with proper authentication.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from pydantic import BaseModel
import os
import bcrypt
from datetime import datetime, timedelta
from app.utils.logger import get_logger

logger = get_logger(__name__)

# JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 hours

# Security scheme
security = HTTPBearer()


class UserContext(BaseModel):
    """User context extracted from JWT token"""
    user_id: str  # Profile ID from token
    email: str
    role: str  # student, admin
    student_id: Optional[str] = None
    
    def is_admin(self) -> bool:
        return self.role == "admin"
    
    def is_warden(self) -> bool:
        return self.role == "warden"
    
    def is_student(self) -> bool:
        return self.role == "student"
    
    def is_owner(self) -> bool:
        return self.role == "owner"
    
    def can_manage_students(self) -> bool:
        return self.role in ("admin", "owner")
    
    def can_delete_students(self) -> bool:
        return self.role in ("admin", "owner")
    
    def can_view_all_students(self) -> bool:
        return self.role in ("admin", "owner")

# Password Hashing
# pwd_context removed

# ...

def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_jwt_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate JWT token.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        logger.error(f"JWT validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> UserContext:
    """
    Dependency to extract current user from JWT token.
    """
    token = credentials.credentials
    payload = decode_jwt_token(token)
    
    # Extract required claims
    user_id = payload.get("sub")  # Standard JWT claim for user ID
    email = payload.get("email")
    role = payload.get("role")
    student_id = payload.get("student_id")
    
    if not user_id or not role:
        logger.error("JWT token missing required claims")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token claims",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify profile exists in DB to prevent stale session errors
    from app.db import supabase
    try:
        profile_check = supabase.table("profiles").select("id").eq("id", user_id).execute()
        if not profile_check.data:
            logger.warning(f"Authenticated user {user_id} not found in profiles table. Session stale.")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User profile not found. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except Exception as e:
        logger.error(f"Error verifying profile existence: {e}")
        # If DB is down, we still trust the JWT for now to avoid complete outage
        pass

    return UserContext(
        user_id=user_id,
        email=email or "",
        role=role,
        student_id=student_id
    )


def require_admin(user: UserContext = Depends(get_current_user)) -> UserContext:
    if not user.is_admin():
        logger.warning(f"User {user.user_id} with role {user.role} attempted admin-only action")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return user


def require_admin_or_owner(user: UserContext = Depends(get_current_user)) -> UserContext:
    if not user.can_manage_students():
        logger.warning(f"User {user.user_id} with role {user.role} attempted admin/owner-only action")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Owner privileges required"
        )
    return user
