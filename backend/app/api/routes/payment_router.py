from fastapi import APIRouter, HTTPException, Depends, status, Request
from app.schemas.payment_schema import PaymentCreate, PaymentResponse, \
    ObligationResponse, StudentPaymentHistory, DuesReportItem, WaiveRequest, RentGenerationRequest, \
    PaymentInitiate, RazorpayOrderResponse
from app.services import payment_service
from app.utils.auth import get_current_user, UserContext, require_admin, require_admin_or_owner
from app.utils.responses import ErrorCode
from app.utils.logger import get_logger
from typing import List, Optional
from datetime import date

logger = get_logger(__name__)
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
    dependencies=[Depends(require_admin_or_owner)]
)
def generate_rent(
    data: RentGenerationRequest,
    user: UserContext = Depends(get_current_user)
):
    """
    **Owner/Admin Task**: Generate rent records for all active room stays.
    
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
)
def record_payment(
    data: PaymentCreate,
    user: UserContext = Depends(get_current_user)
):
    """
    Record money received from a student against a specific obligation.
    
    - Validates that payment doesn't exceed obligation balance.
    - Automatically updates obligation status to PARTIAL or PAID.
    - Students can pay their own obligations; admin/owner can pay for anyone.
    """
    # For students: validate that the obligation belongs to them
    if user.is_student():
        from app.db import supabase
        ob_res = supabase.table("rent_obligations").select("student_id").eq("id", str(data.obligation_id)).execute()
        if not ob_res.data:
            raise HTTPException(status_code=404, detail={"message": "Obligation not found"})
        ob_student_id = ob_res.data[0].get("student_id")
        if str(ob_student_id) != str(user.student_id):
            raise HTTPException(status_code=403, detail={"message": "You can only pay your own obligations."})

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
    "/",
    response_model=dict,
    summary="Get all payments",
    dependencies=[Depends(require_admin_or_owner)]
)
def get_all_payments(
    limit: int = 50,
    offset: int = 0,
    user: UserContext = Depends(get_current_user)
):
    """
    Get recent payments.
    """
    result = payment_service.get_all_payments(user.user_id, limit, offset)
    return _handle_service_response(result)


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
    if user.is_student() and str(user.student_id) != str(student_id):
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
    dependencies=[Depends(require_admin_or_owner)]
)
def get_dues_report(
    rent_month: Optional[date] = None,
    status: Optional[str] = None,
    user: UserContext = Depends(get_current_user)
):
    """
    Filterable report of all student dues.
    
    - Default: Shows all non-PAID obligations.
    - Can filter by specific month (YYYY-MM-01).
    """
    result = payment_service.get_dues_report(user.user_id, rent_month, status)
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


@router.post(
    "/initiate",
    response_model=RazorpayOrderResponse,
    summary="Initiate a Razorpay payment order"
)
def initiate_razorpay_payment(
    data: PaymentInitiate,
    user: UserContext = Depends(get_current_user)
):
    """
    **Student Only**: Create a Razorpay order to pay for an obligation.
    Used for mobile-first UPI intent flow.
    """
    if not user.is_student():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can initiate payments."
        )
        
    result = payment_service.create_razorpay_order(
        str(data.obligation_id),
        data.amount,
        str(user.student_id)
    )
    return _handle_service_response(result)


@router.post(
    "/webhook",
    status_code=status.HTTP_200_OK,
    summary="Razorpay Webhook handler",
    include_in_schema=False
)
async def razorpay_webhook(request: Request):
    """
    **Public Endpoint**: Receives payment notifications from Razorpay.
    Verifies signature and updates database atomically.
    """
    payload = await request.body()
    signature = request.headers.get("X-Razorpay-Signature")
    
    if not signature:
        logger.error("Webhook received without X-Razorpay-Signature")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing signature")
        
    # Verify authenticity
    is_valid = payment_service.verify_webhook_signature(payload, signature)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature")
        
    # Process event
    import json
    try:
        event = json.loads(payload)
        result = payment_service.handle_razorpay_webhook(event)
        
        # We always return 200 to Razorpay as long as we received the payload,
        # unless it's a critical system error.
        if not result.get("success"):
            # Log the error but don't necessarily fail the HTTP response 
            # if it's a business logic error (like duplicate payment)
            from app.utils.logger import get_logger
            webhook_logger = get_logger("payment_webhook")
            webhook_logger.error(f"Webhook processing error: {result.get('error')}")
            
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
