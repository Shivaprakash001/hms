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


class OnlinePaymentProvider(str, Enum):
    PHONEPE = "PHONEPE"
    RAZORPAY = "RAZORPAY"


class PaymentAttemptStatus(str, Enum):
    CREATED = "CREATED"
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


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


class PaymentIntentCreate(BaseModel):
    obligation_id: UUID
    amount: Optional[Decimal] = Field(default=None, gt=0)


class PaymentIntentResponse(BaseModel):
    attempt_id: UUID
    provider: OnlinePaymentProvider
    merchant_txn_id: str
    checkout_url: Optional[str] = None
    upi_intent_url: Optional[str] = None
    qr_payload: Optional[str] = None
    status: PaymentAttemptStatus
    expires_at: Optional[datetime] = None


class PaymentAttemptResponse(BaseModel):
    attempt_id: UUID
    status: PaymentAttemptStatus
    provider: OnlinePaymentProvider
    merchant_txn_id: Optional[str] = None
    checkout_url: Optional[str] = None
    upi_intent_url: Optional[str] = None
    qr_payload: Optional[str] = None
    amount: Decimal
    expires_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    gateway_txn_id: Optional[str] = None


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
    payment_attempt_id: Optional[UUID] = None
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
