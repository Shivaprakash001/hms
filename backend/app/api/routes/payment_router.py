from fastapi import APIRouter, HTTPException, Depends, status
from app.schamas.payment_schema import (
    RentGenerationRequest, PaymentCreate, PaymentResponse,
    ObligationResponse, StudentPaymentHistory, DuesReportItem, WaiveRequest
)
from app.services import payment_service
from app.utils.auth import get_current_user, UserContext, require_admin, require_admin_or_warden
from app.utils.responses import ErrorCode
from typing import List, Optional
from datetime import date

router = APIRouter(prefix="/payments", tags=["Payments & Billing"])


def _handle_service_response(result: dict, success_status: int = status.HTTP_200_OK):
    """Helper to convert service response to HTTP response"""
    if not result.get("success"):
        error = result.get("error", {})
        error_code = error.get("code", ErrorCode.UNKNOWN_ERROR.value)
        
        status_map = {
            ErrorCode.RESOURCE_NOT_FOUND.value: status.HTTP_404_NOT_FOUND,
            ErrorCode.RESOURCE_ALREADY_EXISTS.value: status.HTTP_409_CONFLICT,
            ErrorCode.FORBIDDEN.value: status.HTTP_403_FORBIDDEN,
            ErrorCode.INVALID_INPUT.value: status.HTTP_422_UNPROCESSABLE_ENTITY,
            ErrorCode.UNAUTHORIZED.value: status.HTTP_401_UNAUTHORIZED,
        }
        
        http_status = status_map.get(error_code, status.HTTP_400_BAD_REQUEST)
        raise HTTPException(status_code=http_status, detail=error)
    
    return result.get("data")


@router.post(
    "/generate-monthly",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    summary="Generate rent obligations for the month",
    dependencies=[Depends(require_admin)]
)
def generate_rent(
    data: RentGenerationRequest,
    user: UserContext = Depends(get_current_user)
):
    """
    **Administrative Task**: Generate rent records for all active room stays.
    
    - Calculates prorated rent for mid-month entries/exits.
    - Skips records where obligation already exists.
    - Sets default due date (10th of month).
    """
    result = payment_service.generate_monthly_rent(data.rent_month, user_id=user.user_id)
    return _handle_service_response(result, status.HTTP_201_CREATED)


@router.post(
    "/",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    summary="Record a student payment",
    dependencies=[Depends(require_admin_or_warden)]
)
def record_payment(
    data: PaymentCreate,
    user: UserContext = Depends(get_current_user)
):
    """
    Record money received from a student against a specific obligation.
    
    - Validates that payment doesn't exceed obligation balance.
    - Automatically updates obligation status to PARTIAL or PAID.
    """
    result = payment_service.record_payment(
        str(data.obligation_id),
        data.amount_paid,
        data.payment_method.value,
        data.reference_number,
        data.payment_date,
        user_id=user.user_id
    )
    return _handle_service_response(result, status.HTTP_201_CREATED)


@router.get(
    "/student/{student_id}",
    response_model=StudentPaymentHistory,
    summary="Get payment history for a student"
)
def get_student_history(
    student_id: str,
    user: UserContext = Depends(get_current_user)
):
    """
    Retrieve all rent obligations, individual payments, and total outstanding balance.
    
    **Authorization**: 
    - Admin/Warden: Any student.
    - Student: Only their own record.
    """
    if user.is_student() and str(user.user_id) != str(student_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own payment history."
        )
        
    result = payment_service.get_student_payment_history(student_id)
    return _handle_service_response(result)


@router.get(
    "/dues",
    response_model=List[DuesReportItem],
    summary="Get dues report",
    dependencies=[Depends(require_admin_or_warden)]
)
def get_dues_report(
    rent_month: Optional[date] = None,
    status: Optional[str] = None
):
    """
    Filterable report of all student dues.
    
    - Default: Shows all non-PAID obligations.
    - Can filter by specific month (YYYY-MM-01).
    """
    result = payment_service.get_dues_report(rent_month, status)
    return _handle_service_response(result)


@router.post(
    "/obligations/{obligation_id}/waive",
    response_model=ObligationResponse,
    summary="Waive a rent obligation",
    dependencies=[Depends(require_admin)]
)
def waive_obligation(
    obligation_id: str,
    data: Optional[WaiveRequest] = None,
    user: UserContext = Depends(get_current_user)
):
    """
    **Admin Only**: Mark an obligation as WAIVED (e.g. for errors or special cases).
    
    - Only possible if NO payments have been recorded for the obligation.
    """
    result = payment_service.waive_obligation(obligation_id, user_id=user.user_id)
    return _handle_service_response(result)
