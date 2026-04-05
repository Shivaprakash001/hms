from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
import re


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
    new_password: str = Field(..., min_length=8)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=64)
    name: str = Field(..., min_length=2)
    phone: Optional[str] = None
    hostel_name: str = Field(..., min_length=2, max_length=200)
    hostel_phone: str = Field(..., min_length=10, max_length=15)
    hostel_address: str = Field(..., min_length=5, max_length=500)
    hostel_city: str = Field(..., min_length=2, max_length=100)
    hostel_state: str = Field(..., min_length=2, max_length=100)
    hostel_pincode: str = Field(..., min_length=4, max_length=10)
    upi_id: Optional[str] = Field(None, max_length=100)
    gst_number: Optional[str] = Field(None, max_length=30)
    role: str = "admin"  # Public registration is only for Owners
    is_active: bool = True

    @field_validator('hostel_phone')
    @classmethod
    def validate_hostel_phone(cls, v):
        cleaned = re.sub(r'[\s\-\(\)]', '', v or '')
        if not re.match(r'^\+?\d{10,15}$', cleaned):
            raise ValueError('Hostel phone number must be 10-15 digits, optionally starting with +')
        return cleaned

    @field_validator('hostel_pincode')
    @classmethod
    def validate_pincode(cls, v):
        if not re.match(r'^[A-Za-z0-9\- ]{4,10}$', v or ''):
            raise ValueError('Hostel pincode must be 4-10 characters')
        return v.strip()

class GoogleLoginRequest(BaseModel):
    code: str
    redirect_uri: Optional[str] = Field(
        default=None,
        description="The redirect URI used in the initial Google OAuth request. "
                    "Must match exactly so Google can validate the token exchange."
    )
