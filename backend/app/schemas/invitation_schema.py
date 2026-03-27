from pydantic import BaseModel, EmailStr, Field, model_validator
from typing import Optional
from uuid import UUID

class TenantInviteRequest(BaseModel):
    full_name: str = Field(..., min_length=2)
    email: EmailStr
    phone: Optional[str] = Field(default="", max_length=15)
    room_id: UUID
    monthly_rent: Optional[float] = None

    @model_validator(mode='before')
    @classmethod
    def normalize_name_field(cls, values):
        """Accept both 'name' and 'full_name' from the frontend."""
        if isinstance(values, dict):
            if 'name' in values and 'full_name' not in values:
                values['full_name'] = values.pop('name')
            elif 'full_name' in values and 'name' not in values:
                values['name'] = values['full_name']  # Keep both for compatibility
        return values

class TenantInviteResponse(BaseModel):
    """Response returned when tenant is successfully invited"""
    success: bool = True
    invitation_id: str
    email: str
    student_id: str
    activation_link: str  # ← CRITICAL: Frontend expects this
    expires_in_hours: int = 24
    
    class Config:
        from_attributes = True

class TenantActivateRequest(BaseModel):
    token: str
    password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)

class TenantResendRequest(BaseModel):
    email: EmailStr
