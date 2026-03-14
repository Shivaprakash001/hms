from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from uuid import UUID

class TenantInviteRequest(BaseModel):
    full_name: str = Field(..., min_length=2)
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=15)
    room_id: UUID
    monthly_rent: Optional[float] = None

class TenantInviteResponse(BaseModel):
    success: bool
    invitation_id: str
    email: str
    student_id: str
    activation_link: str
    expires_in_hours: int

class TenantActivateRequest(BaseModel):
    token: str
    password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)

class TenantResendRequest(BaseModel):
    email: EmailStr
