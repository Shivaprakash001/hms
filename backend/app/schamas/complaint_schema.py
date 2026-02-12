from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from enum import Enum


class ComplaintStatus(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    REJECTED = "REJECTED"


class ComplaintPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


class ComplaintCategory(str, Enum):
    ELECTRICAL = "ELECTRICAL"
    PLUMBING = "PLUMBING"
    CLEANING = "CLEANING"
    CARPENTRY = "CARPENTRY"
    INTERNET = "INTERNET"
    OTHER = "OTHER"


class ComplaintCreate(BaseModel):
    student_id: UUID
    title: str = Field(..., min_length=5, max_length=100)
    description: str = Field(..., min_length=10)
    category: ComplaintCategory = ComplaintCategory.OTHER
    priority: ComplaintPriority = ComplaintPriority.MEDIUM


class ComplaintUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[ComplaintCategory] = None
    priority: Optional[ComplaintPriority] = None


class ComplaintStatusUpdate(BaseModel):
    status: ComplaintStatus
    staff_remarks: Optional[str] = None


class ComplaintResponse(BaseModel):
    id: UUID
    student_id: UUID
    title: str
    description: str
    category: ComplaintCategory
    status: ComplaintStatus
    priority: ComplaintPriority
    staff_remarks: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    
    # Optional nested data
    student: Optional[dict] = None

    class Config:
        from_attributes = True


class ComplaintListResponse(BaseModel):
    complaints: List[ComplaintResponse]
    total: int
    limit: int
    offset: int
