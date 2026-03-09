from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from uuid import UUID

class TenantInviteRequest(BaseModel):
    name: str = Field(..., min_length=2)
    email: EmailStr
    room_id: UUID
    phone: Optional[str] = None
    monthly_rent: Optional[float] = 0.0

class TenantActivateRequest(BaseModel):
    token: str
    password: str = Field(..., min_length=6)
