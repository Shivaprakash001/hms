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
from app.utils.logger import get_logger

logger = get_logger(__name__)

# JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"

# Security scheme
security = HTTPBearer()


class UserContext(BaseModel):
    """User context extracted from JWT token"""
    user_id: str  # Profile ID from token
    email: str
    role: str  # student, admin, warden
    
    def is_admin(self) -> bool:
        return self.role == "admin"
    
    def is_warden(self) -> bool:
        return self.role == "warden"
    
    def is_student(self) -> bool:
        return self.role == "student"
    
    def can_manage_students(self) -> bool:
        """Check if user can create/update students"""
        return self.role in ["admin", "warden"]
    
    def can_delete_students(self) -> bool:
        """Check if user can delete students"""
        return self.role == "admin"
    
    def can_view_all_students(self) -> bool:
        """Check if user can view all students"""
        return self.role in ["admin", "warden"]


def decode_jwt_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate JWT token.
    
    Args:
        token: JWT token string
        
    Returns:
        Decoded token payload
        
    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        logger.error(f"JWT validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> UserContext:
    """
    Dependency to extract current user from JWT token.
    
    Usage:
        @router.get("/protected")
        def protected_route(user: UserContext = Depends(get_current_user)):
            return {"user_id": user.user_id, "role": user.role}
    
    Args:
        credentials: HTTP Bearer credentials from request
        
    Returns:
        UserContext with user information
        
    Raises:
        HTTPException: If token is invalid or missing required claims
    """
    token = credentials.credentials
    payload = decode_jwt_token(token)
    
    # Extract required claims
    user_id = payload.get("sub")  # Standard JWT claim for user ID
    email = payload.get("email")
    role = payload.get("role")
    
    if not user_id or not role:
        logger.error("JWT token missing required claims")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token claims",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    logger.debug(f"Authenticated user: {user_id} with role: {role}")
    
    return UserContext(
        user_id=user_id,
        email=email or "",
        role=role
    )


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[UserContext]:
    """
    Dependency to extract user from JWT token if present (optional auth).
    
    Returns None if no token provided.
    """
    if not credentials:
        return None
    
    try:
        return get_current_user(credentials)
    except HTTPException:
        return None


def require_admin(user: UserContext = Depends(get_current_user)) -> UserContext:
    """
    Dependency that requires admin role.
    
    Usage:
        @router.delete("/students/{id}")
        def delete_student(user: UserContext = Depends(require_admin)):
            # Only admins can reach here
    """
    if not user.is_admin():
        logger.warning(f"User {user.user_id} with role {user.role} attempted admin-only action")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return user


def require_admin_or_warden(user: UserContext = Depends(get_current_user)) -> UserContext:
    """Dependency that requires admin or warden role."""
    if not user.can_manage_students():
        logger.warning(f"User {user.user_id} with role {user.role} attempted admin/warden-only action")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or warden privileges required"
        )
    return user


# For backward compatibility during migration
def get_user_from_headers(
    x_user_id: Optional[str] = None,
    x_user_role: Optional[str] = None
) -> Optional[UserContext]:
    """
    DEPRECATED: Temporary helper for header-based auth during migration.
    Use get_current_user() instead.
    """
    if x_user_id and x_user_role:
        logger.warning("Using deprecated header-based authentication")
        return UserContext(
            user_id=x_user_id,
            email="",
            role=x_user_role
        )
    return None
