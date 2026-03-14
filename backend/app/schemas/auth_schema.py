from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str
    user_id: str
    student_id: Optional[str] = None


class PasswordChangeRequest(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=6)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=64)
    name: str = Field(..., min_length=2)
    phone: Optional[str] = None
    role: str = "admin"  # Public registration is only for Owners
    is_active: bool = True

class GoogleLoginRequest(BaseModel):
    code: str
    redirect_uri: Optional[str] = Field(
        default=None,
        description="The redirect URI used in the initial Google OAuth request. "
                    "Must match exactly so Google can validate the token exchange."
    )
