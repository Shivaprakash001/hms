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
    amount_paid: Decimal = Field(..., gt=0, le=1000000, description="Amount must be between 0 and 10,00,000")
    payment_method: PaymentMethod
    reference_number: Optional[str] = Field(None, max_length=100)
    payment_date: date = Field(default_factory=date.today)
    
    @field_validator('amount_paid')
    @classmethod
    def validate_amount(cls, v):
        if v <= 0:
            raise ValueError('Amount must be greater than 0')
        if v > Decimal('1000000'):
            raise ValueError('Amount cannot exceed ₹10,00,000')
        return v.quantize(Decimal('0.01'))
    
    @field_validator('payment_date')
    @classmethod
    def validate_payment_date(cls, v):
        if v > date.today():
            raise ValueError('Payment date cannot be in the future')
        return v


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
    amount: Optional[Decimal] = Field(None, gt=0)
    notes: Optional[dict] = None


class RazorpayOrderResponse(BaseModel):
    order_id: str
    amount: int
    currency: str
    key_id: str
    name: str
    description: str
    prefill: Optional[dict] = None
    notes: Optional[dict] = None


class PaymentVerifyRequest(BaseModel):
    razorpay_order_id: str = Field(..., description="Razorpay order ID returned after payment")
    razorpay_payment_id: str = Field(..., description="Razorpay payment ID")
    razorpay_signature: str = Field(..., description="HMAC signature from Razorpay callback")
    obligation_id: Optional[UUID] = Field(None, description="Obligation being paid (for record linking)")


class ReconcileRequest(BaseModel):
    payment_ids: Optional[List[UUID]] = Field(None, description="Specific payment IDs to reconcile; omit to reconcile all pending")


class ReconcileResult(BaseModel):
    reconciled: int
    already_captured: int
    failed: int
    errors: List[str]


class BulkGenerateRequest(BaseModel):
    month_year: date = Field(..., description="Target month for generation (e.g. 2026-04-01)")
    target_tenants: Optional[List[UUID]] = Field(None, description="List of tenant UUIDs. Null/empty means ALL active.")
    dry_run: bool = Field(False, description="If true, returns counts but doesn't insert.")

    @field_validator('month_year')
    @classmethod
    def validate_month_year(cls, v):
        return v.replace(day=1)
