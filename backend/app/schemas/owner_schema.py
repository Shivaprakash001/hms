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
    hostel_name: Optional[str] = Field(None, min_length=2, max_length=200)
    hostel_phone: Optional[str] = Field(None, max_length=15)
    address: Optional[str] = Field(None, max_length=500)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    pincode: Optional[str] = Field(None, max_length=10)
    upi_id: Optional[str] = Field(None, max_length=100)
    gst_number: Optional[str] = Field(None, max_length=30)

    @field_validator('hostel_phone')
    @classmethod
    def validate_hostel_phone(cls, v):
        if v is None:
            return v
        cleaned = re.sub(r'[\s\-\(\)]', '', v)
        if not re.match(r'^\+?\d{10,15}$', cleaned):
            raise ValueError('Hostel phone number must be 10-15 digits, optionally starting with +')
        return cleaned
