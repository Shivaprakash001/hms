from pydantic import BaseModel, Field, field_validator
from typing import Optional
from uuid import UUID
from datetime import datetime
from enum import Enum


class DocumentType(str, Enum):
    """Supported identification document types"""
    AADHAR = "AADHAR"
    DRIVING_LICENSE = "DRIVING_LICENSE"
    PASSPORT = "PASSPORT"


class DocumentCreate(BaseModel):
    """Schema for uploading a new identification document"""
    doc_type: DocumentType = Field(..., description="Type of identification document")
    document_number: Optional[str] = Field(None, max_length=50, description="Document ID number (e.g. Aadhar number)")

    @field_validator('document_number')
    @classmethod
    def validate_document_number(cls, v):
        if v is not None:
            v = v.strip()
            if len(v) < 4:
                raise ValueError('Document number must be at least 4 characters')
        return v


class DocumentResponse(BaseModel):
    """Response schema for identification documents"""
    id: UUID
    tenant_id: UUID
    doc_type: DocumentType
    document_number: Optional[str] = None
    document_image_url: Optional[str] = None
    signed_url: Optional[str] = None
    verified: bool = False
    rejected: Optional[bool] = False
    rejection_reason: Optional[str] = None
    verified_by: Optional[UUID] = None
    verified_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DocumentUpdate(BaseModel):
    """Schema for updating a document record"""
    document_number: Optional[str] = Field(None, max_length=50)
    verified: Optional[bool] = None

    @field_validator('document_number')
    @classmethod
    def validate_document_number(cls, v):
        if v is not None:
            v = v.strip()
            if len(v) < 4:
                raise ValueError('Document number must be at least 4 characters')
        return v


class DocumentRejectRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=300, description="Reason for rejection shown to tenant")
