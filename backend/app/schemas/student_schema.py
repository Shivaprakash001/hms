from pydantic import BaseModel, Field, field_validator, EmailStr
from typing import Optional, Literal
from uuid import UUID
from datetime import date, datetime
from enum import Enum
from decimal import Decimal
import re


class StudentStatus(str, Enum):
    """Student lifecycle status - finite state machine"""
    INVITED = "INVITED"
    ACTIVE = "ACTIVE"
    LEFT = "LEFT"


# Valid status transitions
VALID_STATUS_TRANSITIONS = {
    StudentStatus.INVITED: [StudentStatus.ACTIVE, StudentStatus.LEFT],
    StudentStatus.ACTIVE: [StudentStatus.LEFT],
    StudentStatus.LEFT: [StudentStatus.ACTIVE],
}


class ReactivationRequestStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class ReactivationDecisionRequest(BaseModel):
    action: Literal["approve", "reject"]
    notes: Optional[str] = Field(default=None, max_length=500)


class StudentCreate(BaseModel):
    """Schema for creating a new student enrollment"""
    profile_id: UUID = Field(..., description="Profile ID to enroll as student")
    monthly_rent: Decimal = Field(..., gt=0, description="Monthly rent amount (must be > 0)")
    joined_on: date = Field(..., description="Date student joined hostel")
    status: StudentStatus = Field(default=StudentStatus.INVITED, description="Initial student status")
    owner_id: Optional[UUID] = Field(None, description="Owner ID who invited")
    
    @field_validator('joined_on')
    @classmethod
    def validate_joined_date(cls, v):
        """Joined date cannot be in the future"""
        if v > date.today():
            raise ValueError('Joined date cannot be in the future')
        return v
    
    @field_validator('monthly_rent')
    @classmethod
    def validate_rent(cls, v):
        """Ensure rent is positive and reasonable"""
        if v <= 0:
            raise ValueError('Monthly rent must be greater than 0')
        if v > 1000000:  # Sanity check
            raise ValueError('Monthly rent seems unreasonably high')
        return v


def _validate_phone(v: Optional[str]) -> Optional[str]:
    """Validate and clean phone number format."""
    if v is None:
        return v
    cleaned = re.sub(r'[\s\-\(\)]', '', v)
    if not re.match(r'^\+?\d{10,15}$', cleaned):
        raise ValueError('Phone number must be 10-15 digits, optionally starting with +')
    return cleaned


class StudentUpdate(BaseModel):
    """Schema for updating student information (includes extended profile fields)"""
    monthly_rent: Optional[Decimal] = Field(None, gt=0, description="Updated monthly rent")
    status: Optional[StudentStatus] = Field(None, description="Updated status (must follow state machine rules)")
    joined_on: Optional[date] = Field(None, description="Updated join date (restricted)")

    # Extended profile fields
    photo_url: Optional[str] = Field(None, description="Profile photo URL")
    phone_1: Optional[str] = Field(None, max_length=15, description="Tenant primary phone")
    phone_2: Optional[str] = Field(None, max_length=15, description="Parent/guardian phone")
    phone_3: Optional[str] = Field(None, max_length=15, description="Optional additional phone")
    personal_email: Optional[EmailStr] = Field(None, description="Personal email address")
    college_name: Optional[str] = Field(None, max_length=200, description="College/university name")
    roll_number: Optional[str] = Field(None, max_length=50, description="Academic roll number")
    course: Optional[str] = Field(None, max_length=100, description="Course name")
    year_of_study: Optional[int] = Field(None, ge=1, le=6, description="Year of study (1-6)")
    section: Optional[str] = Field(None, max_length=20, description="Class section")
    branch: Optional[str] = Field(None, max_length=100, description="Branch/department")
    office_name: Optional[str] = Field(None, max_length=200, description="Office/company name")
    office_location: Optional[str] = Field(None, max_length=200, description="Office location")
    job_role: Optional[str] = Field(None, max_length=100, description="Job title/role")
    permanent_address: Optional[str] = Field(None, max_length=1000, description="Permanent address")
    temporary_address: Optional[str] = Field(None, max_length=1000, description="Temporary/current address")

    @field_validator('monthly_rent')
    @classmethod
    def validate_rent(cls, v):
        if v is not None and v <= 0:
            raise ValueError('Monthly rent must be greater than 0')
        return v

    @field_validator('phone_1', 'phone_2', 'phone_3')
    @classmethod
    def validate_phones(cls, v):
        return _validate_phone(v)


class StudentSelfProfileUpdate(BaseModel):
    """Schema for student self-service profile updates from student portal."""
    # Profile fields
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=15)
    address: Optional[str] = Field(None, max_length=500)
    emergency_contact: Optional[str] = Field(None, max_length=15)

    # Extended student fields
    photo_url: Optional[str] = Field(None, description="Profile photo URL")
    phone_1: Optional[str] = Field(None, max_length=15, description="Tenant primary phone")
    phone_2: Optional[str] = Field(None, max_length=15, description="Parent/guardian phone")
    phone_3: Optional[str] = Field(None, max_length=15, description="Optional additional phone")
    personal_email: Optional[EmailStr] = Field(None, description="Personal email address")
    college_name: Optional[str] = Field(None, max_length=200, description="College/university name")
    roll_number: Optional[str] = Field(None, max_length=50, description="Academic roll number")
    course: Optional[str] = Field(None, max_length=100, description="Course name")
    year_of_study: Optional[int] = Field(None, ge=1, le=6, description="Year of study (1-6)")
    section: Optional[str] = Field(None, max_length=20, description="Class section")
    branch: Optional[str] = Field(None, max_length=100, description="Branch/department")
    office_name: Optional[str] = Field(None, max_length=200, description="Office/company name")
    office_location: Optional[str] = Field(None, max_length=200, description="Office location")
    job_role: Optional[str] = Field(None, max_length=100, description="Job title/role")
    permanent_address: Optional[str] = Field(None, max_length=1000, description="Permanent address")
    temporary_address: Optional[str] = Field(None, max_length=1000, description="Temporary/current address")

    @field_validator('phone', 'emergency_contact', 'phone_1', 'phone_2', 'phone_3')
    @classmethod
    def validate_phones(cls, v):
        return _validate_phone(v)


class StudentResponse(BaseModel):
    """Complete student response with profile info and extended fields"""
    id: UUID
    profile_id: UUID
    monthly_rent: Decimal
    joined_on: date
    status: StudentStatus
    owner_id: Optional[UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    # Extended profile fields
    photo_url: Optional[str] = None
    phone_1: Optional[str] = None
    phone_2: Optional[str] = None
    phone_3: Optional[str] = None
    personal_email: Optional[str] = None
    college_name: Optional[str] = None
    roll_number: Optional[str] = None
    course: Optional[str] = None
    year_of_study: Optional[int] = None
    section: Optional[str] = None
    branch: Optional[str] = None
    office_name: Optional[str] = None
    office_location: Optional[str] = None
    job_role: Optional[str] = None
    permanent_address: Optional[str] = None
    temporary_address: Optional[str] = None
    document_verified: Optional[bool] = False
    profile_completed: Optional[bool] = False

    # Joined profile information
    profile: Optional[dict] = None
    
    # Current allocation summary (optional)
    current_room: Optional[dict] = None
    
    # Payment summary (optional)
    payment_summary: Optional[dict] = None
    
    class Config:
        from_attributes = True


class StudentListResponse(BaseModel):
    """Paginated list of students"""
    students: list[StudentResponse]
    total: int
    limit: Optional[int]
    offset: int


class StudentReactivate(BaseModel):
    """Schema for reactivating a student"""
    monthly_rent: Decimal = Field(..., gt=0, description="Monthly rent for reactivation")
    joined_on: date = Field(default_factory=date.today, description="Re-admission date")
