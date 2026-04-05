from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import Optional
from uuid import UUID
from datetime import datetime
from enum import Enum
import re


class RoleEnum(str, Enum):
    student = "student"
    admin = "admin"
    warden = "warden"


# Utility function to avoid duplicate validators
def validate_phone_number(v: Optional[str]) -> Optional[str]:
    """Validate and clean phone number format."""
    if v is None:
        return v
    # Remove spaces, dashes, and parentheses
    cleaned = re.sub(r'[\s\-\(\)]', '', v)
    # Check if it contains only digits and optional + at start
    if not re.match(r'^\+?\d{10,15}$', cleaned):
        raise ValueError('Phone number must be 10-15 digits, optionally starting with +')
    return cleaned


class ProfileCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Full name of the user")
    email: EmailStr = Field(..., description="Email address")
    phone: str = Field(..., min_length=10, max_length=15, description="Phone number")
    role: RoleEnum = Field(..., description="User role in the system")
    address: Optional[str] = Field(None, max_length=500, description="Residential address")
    emergency_contact: Optional[str] = Field(None, max_length=15, description="Emergency contact number")
    
    @field_validator('phone', 'emergency_contact')
    @classmethod
    def validate_phone(cls, v):
        return validate_phone_number(v)


class ProfileUpdate(BaseModel):
    """Update profile - regular users cannot change role"""
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, min_length=10, max_length=15)
    address: Optional[str] = Field(None, max_length=500)
    emergency_contact: Optional[str] = Field(None, max_length=15)
    
    @field_validator('phone', 'emergency_contact')
    @classmethod
    def validate_phone(cls, v):
        return validate_phone_number(v)


class ProfileAdminUpdate(ProfileUpdate):
    """Admin-only update schema that allows role changes"""
    role: Optional[RoleEnum] = Field(None, description="User role (admin only)")


class CompleteProfileRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    college_roll_number: str = Field(...)
    section: Optional[str] = None
    branch: Optional[str] = None
    year_of_study: Optional[str] = None
    address: Optional[str] = None
    parent_phone: str = Field(...)

    @field_validator('parent_phone')
    @classmethod
    def validate_parent_phone(cls, v):
        return validate_phone_number(v)


class ProfileResponse(BaseModel):
    id: UUID
    name: str
    email: str
    phone: str
    role: RoleEnum
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    is_active: bool = True
    is_profile_completed: bool = False
    college_roll_number: Optional[str] = None
    section: Optional[str] = None
    branch: Optional[str] = None
    year_of_study: Optional[str] = None
    parent_phone: Optional[str] = None
    owner_id: Optional[UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

