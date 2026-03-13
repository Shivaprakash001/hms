from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal
from enum import Enum


class ObligationStatus(str, Enum):
    PENDING = "PENDING"
    PAID = "PAID"
    PARTIAL = "PARTIAL"
    WAIVED = "WAIVED"


class PaymentMethod(str, Enum):
    CASH = "CASH"
    BANK_TRANSFER = "BANK_TRANSFER"
    UPI = "UPI"
    OTHER = "OTHER"


class RentGenerationRequest(BaseModel):
    rent_month: date = Field(..., description="The month to generate rent for (usually 1st of month)")
    
    @field_validator('rent_month')
    @classmethod
    def validate_rent_month(cls, v):
        # Normalize to 1st of the month
        return v.replace(day=1)


class PaymentCreate(BaseModel):
    obligation_id: UUID
    amount_paid: Decimal = Field(..., gt=0)
    payment_method: PaymentMethod
    reference_number: Optional[str] = None
    payment_date: date = Field(default_factory=date.today)


class WaiveRequest(BaseModel):
    reason: Optional[str] = None


class PaymentResponse(BaseModel):
    id: UUID
    obligation_id: UUID
    student_id: UUID
    amount_paid: Decimal
    payment_date: date
    payment_method: str
    reference_number: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ObligationResponse(BaseModel):
    id: UUID
    student_id: UUID
    allocation_id: UUID
    rent_month: date
    amount: Decimal
    due_date: date
    status: ObligationStatus
    generated_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StudentPaymentHistory(BaseModel):
    student_id: UUID
    obligations: List[ObligationResponse]
    payments: List[PaymentResponse]
    total_due: Decimal
    total_paid: Decimal
    outstanding_balance: Decimal


class DuesReportItem(BaseModel):
    obligation_id: UUID
    student_name: str
    room_no: str
    rent_month: date
    amount: Decimal
    status: ObligationStatus
    outstanding: Decimal


class PaymentInitiate(BaseModel):
    obligation_id: Optional[UUID] = None
    amount: Decimal = Field(..., gt=0)


class RazorpayOrderResponse(BaseModel):
    order_id: str
    amount: int
    currency: str
    key_id: str
    name: str
    description: str
    prefill: Optional[dict] = None
    notes: Optional[dict] = None
