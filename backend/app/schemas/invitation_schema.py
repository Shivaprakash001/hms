from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class TenantInviteRequest(BaseModel):
    name: str = Field(..., min_length=2)
    email: EmailStr
    phone: Optional[str] = None
    room_id: Optional[str] = None  # UUID as string to avoid JSON serialization issues
    monthly_rent: Optional[float] = None  # Optional rent at invite time

class TenantActivateRequest(BaseModel):
    token: str
    password: str = Field(..., min_length=6)
