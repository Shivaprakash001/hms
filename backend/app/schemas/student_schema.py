from pydantic import BaseModel, Field, field_validator
from typing import Optional
from uuid import UUID
from datetime import date, datetime
from enum import Enum
from decimal import Decimal


class StudentStatus(str, Enum):
    """Student lifecycle status - finite state machine"""
    INVITED = "INVITED"
    ACTIVE = "ACTIVE"
    LEFT = "LEFT"
    BLACKLISTED = "BLACKLISTED"
    ARCHIVED = "ARCHIVED"


# Valid status transitions
VALID_STATUS_TRANSITIONS = {
    StudentStatus.INVITED: [StudentStatus.ACTIVE],
    StudentStatus.ACTIVE: [StudentStatus.LEFT, StudentStatus.BLACKLISTED],
    StudentStatus.LEFT: [StudentStatus.ARCHIVED],  # Cannot go back to ACTIVE without re-admission
    StudentStatus.BLACKLISTED: [StudentStatus.ARCHIVED],
    StudentStatus.ARCHIVED: []  # Terminal state
}


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


class StudentUpdate(BaseModel):
    """Schema for updating student information"""
    monthly_rent: Optional[Decimal] = Field(None, gt=0, description="Updated monthly rent")
    status: Optional[StudentStatus] = Field(None, description="Updated status (must follow state machine rules)")
    joined_on: Optional[date] = Field(None, description="Updated join date (restricted)")
    
    @field_validator('monthly_rent')
    @classmethod
    def validate_rent(cls, v):
        if v is not None and v <= 0:
            raise ValueError('Monthly rent must be greater than 0')
        return v


class StudentResponse(BaseModel):
    """Complete student response with profile info"""
    id: UUID
    profile_id: UUID
    monthly_rent: Decimal
    joined_on: date
    status: StudentStatus
    owner_id: Optional[UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
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
