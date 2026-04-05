from pydantic import BaseModel, Field, field_validator
from typing import Optional
import re


class OwnerProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, max_length=15)

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        if v is None:
            return v
        cleaned = re.sub(r'[\s\-\(\)]', '', v)
        if not re.match(r'^\+?\d{10,15}$', cleaned):
            raise ValueError('Phone number must be 10-15 digits, optionally starting with +')
        return cleaned


class HostelUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    phone: Optional[str] = Field(None, max_length=15)
    hostel_name: Optional[str] = Field(None, min_length=2, max_length=200)
    hostel_phone: Optional[str] = Field(None, max_length=15)
    address: Optional[str] = Field(None, max_length=500)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    pincode: Optional[str] = Field(None, max_length=10)
    upi_id: Optional[str] = Field(None, max_length=100)
    gst_number: Optional[str] = Field(None, max_length=30)

    @field_validator('phone', 'hostel_phone')
    @classmethod
    def validate_hostel_phone(cls, v):
        if v is None:
            return v
        cleaned = re.sub(r'[\s\-\(\)]', '', v)
        if not re.match(r'^\+?\d{10,15}$', cleaned):
            raise ValueError('Hostel phone number must be 10-15 digits, optionally starting with +')
        return cleaned


class OwnerPreferencesUpdate(BaseModel):
    currency: Optional[str] = Field(None, min_length=3, max_length=3)
    rent_cycle: Optional[str] = Field(None, min_length=3, max_length=20)
    receipt_prefix: Optional[str] = Field(None, min_length=2, max_length=20)
    timezone: Optional[str] = Field(None, min_length=3, max_length=100)
    auto_rent_day: Optional[int] = Field(None, ge=1, le=28)

    @field_validator('currency')
    @classmethod
    def validate_currency(cls, v):
        if v is None:
            return v
        return v.upper()

    @field_validator('rent_cycle')
    @classmethod
    def validate_rent_cycle(cls, v):
        if v is None:
            return v
        normalized = v.upper()
        allowed = {'MONTHLY', 'QUARTERLY', 'YEARLY'}
        if normalized not in allowed:
            raise ValueError('Rent cycle must be one of MONTHLY, QUARTERLY, YEARLY')
        return normalized

    @field_validator('receipt_prefix')
    @classmethod
    def validate_receipt_prefix(cls, v):
        if v is None:
            return v
        normalized = re.sub(r'\s+', '', v).upper()
        if not re.match(r'^[A-Z0-9_-]{2,20}$', normalized):
            raise ValueError('Receipt prefix must be 2-20 characters (A-Z, 0-9, _, -)')
        return normalized
