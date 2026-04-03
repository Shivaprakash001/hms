from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.responses import StreamingResponse
from app.schemas.payment_schema import PaymentCreate, PaymentResponse, \
    ObligationResponse, StudentPaymentHistory, DuesReportItem, WaiveRequest, RentGenerationRequest, \
    PaymentInitiate, RazorpayOrderResponse, PaymentVerifyRequest, ReconcileRequest, ReconcileResult, BulkGenerateRequest
from app.services import payment_service
from app.services.receipt_service import ReceiptService
from app.utils.auth import get_current_user, UserContext, require_admin, require_admin_or_owner
from app.utils.responses import ErrorCode
from app.utils.logger import get_logger
from typing import List, Optional
from datetime import date
from collections import defaultdict
import time
import threading

logger = get_logger(__name__)
router = APIRouter(prefix="/payments", tags=["Payments & Billing"])

# ---------------------------------------------------------------------------
# Webhook rate-limiter (in-memory, per IP, thread-safe)
# ---------------------------------------------------------------------------
_webhook_request_times: dict = defaultdict(list)
_webhook_rate_lock = threading.Lock()
_WEBHOOK_RATE_LIMIT = 60    # max requests per window
_WEBHOOK_RATE_WINDOW = 60   # seconds


def _is_rate_limited(client_ip: str) -> bool:
    """Return True when the caller has exceeded the webhook rate limit."""
    now = time.time()
    window_start = now - _WEBHOOK_RATE_WINDOW
    with _webhook_rate_lock:
        # Discard timestamps outside the sliding window
        _webhook_request_times[client_ip] = [
            t for t in _webhook_request_times[client_ip] if t > window_start
        ]
        if len(_webhook_request_times[client_ip]) >= _WEBHOOK_RATE_LIMIT:
            return True
        _webhook_request_times[client_ip].append(now)
    return False


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
            ErrorCode.VALIDATION_ERROR.value: status.HTTP_400_BAD_REQUEST,
            ErrorCode.UNAUTHORIZED.value: status.HTTP_401_UNAUTHORIZED,
            ErrorCode.INTERNAL_ERROR.value: status.HTTP_500_INTERNAL_SERVER_ERROR,
        }
        
        http_status = status_map.get(error_code, status.HTTP_400_BAD_REQUEST)
        raise HTTPException(status_code=http_status, detail=error)
    
    return result.get("data")


@router.post(
    "/bulk-generate",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    summary="Bulk generate monthly payments",
    dependencies=[Depends(require_admin_or_owner)]
)
async def bulk_generate_payments(
    data: BulkGenerateRequest,
    user: UserContext = Depends(get_current_user)
):
    from app.jobs.payment_generation_job import PaymentGenerationJob
    # Normally this would be handled within the service, but since we already built the Job, 
    # we can call it. The job currently generates for all active tenants. 
    # For dry_run and specific target_tenants, we usually need custom logic.
    # We will invoke the job logic as the fundamental generation step.
    result = await PaymentGenerationJob.generate_monthly_payments(target_date=data.month_year)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error"))
    return {"count": result.get("count"), "errors": result.get("errors", 0)}


@router.get(
    "/{payment_id}/receipt",
    summary="Download payment receipt"
)
async def download_receipt(
    payment_id: str,
    user: UserContext = Depends(get_current_user)
):
    try:
        from app.db import supabase
        
        # Input validation
        if not payment_id or len(payment_id) > 100:
            raise HTTPException(status_code=400, detail="Invalid payment ID format")
        
        logger.info(f"Receipt download requested for payment_id: {payment_id} by user: {user.user_id}")
        
        # Support both internal payment UUID and external reference number
        res = supabase.table("payments").select("id, student_id, owner_id, amount_paid, reference_number").eq("id", payment_id).execute()
        if not res.data:
            logger.info(f"Payment not found by ID, trying reference_number: {payment_id}")
            res = supabase.table("payments").select("id, student_id, owner_id, amount_paid, reference_number").eq("reference_number", payment_id).execute()
        
        # If still not found, try checking if this is an obligation_id
        if not res.data:
            logger.info(f"Payment not found by reference_number, checking if this is an obligation_id: {payment_id}")
            # Try to find payment by obligation_id
            res = supabase.table("payments").select("id, student_id, owner_id, amount_paid, reference_number, obligation_id").eq("obligation_id", payment_id).execute()
            if res.data:
                # Found payment by obligation_id - use the most recent one if multiple exist
                if len(res.data) > 1:
                    logger.warning(f"Multiple payments found for obligation {payment_id}, using most recent")
                    # Sort by created_at if available, otherwise use first
                    res.data = [sorted(res.data, key=lambda x: x.get('created_at', ''), reverse=True)[0]]
        
        if not res.data:
            logger.warning(f"Receipt download failed: Payment {payment_id} not found in database (tried id, reference_number, and obligation_id)")
            raise HTTPException(
                status_code=404, 
                detail={
                    "message": "Receipt not found",
                    "details": "The payment may not exist yet. If you just made a payment, please wait a few seconds and try again.",
                    "payment_id": payment_id
                }
            )
        
        payment = res.data[0]
        resolved_payment_id = payment.get("id")
        
        logger.info(f"Found payment: {resolved_payment_id} for requested ID: {payment_id}")
        
        # Ownership check
        if user.is_student():
            if str(payment.get("student_id")) != str(user.student_id):
                logger.warning(f"Unauthorized receipt access attempt by student {user.student_id} for payment {payment_id}")
                raise HTTPException(status_code=403, detail="You are not authorized to download this receipt")
        elif user.is_owner():
            payment_owner_id = payment.get("owner_id")
            if payment_owner_id is None:
                # Backward compatibility: older rows may not have payments.owner_id
                student_id = payment.get("student_id")
                s_res = supabase.table("students").select("owner_id").eq("id", student_id).execute()
                if not s_res.data:
                    raise HTTPException(status_code=403, detail="Unable to verify ownership of this receipt")
                payment_owner_id = s_res.data[0].get("owner_id")

            if str(payment_owner_id) != str(user.user_id):
                logger.warning(f"Unauthorized receipt access attempt by owner {user.user_id} for payment {payment_id}")
                raise HTTPException(status_code=403, detail="You are not authorized to download this receipt")
        
        # Audit logging
        logger.info(f"Receipt downloaded by user {user.user_id} (role: {user.role}) for payment {resolved_payment_id}, amount: ₹{payment.get('amount_paid', 0)}")

        pdf_bytes = await ReceiptService.generate_receipt_pdf(str(resolved_payment_id))
        
        # Verify PDF was generated
        if not pdf_bytes or pdf_bytes.getbuffer().nbytes == 0:
            logger.error(f"Empty PDF generated for payment {resolved_payment_id}")
            raise HTTPException(status_code=500, detail="Failed to generate receipt PDF")
        
        return StreamingResponse(
            pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=receipt_{resolved_payment_id}.pdf",
                "Content-Length": str(pdf_bytes.getbuffer().nbytes)
            }
        )
    except HTTPException:
        raise
    except ValueError as ve:
        logger.error(f"Validation error generating receipt for {payment_id}: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.exception(f"Unexpected error generating receipt for {payment_id}: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred while generating the receipt. Please try again later.")


@router.get(
    "/verify/receipt/{payment_id}",
    summary="Verify receipt authenticity (public)"
)
async def verify_receipt(payment_id: str):
    """
    Public endpoint to verify whether a receipt is genuine.
    Returns basic receipt metadata when valid.
    """
    try:
        return await ReceiptService.verify_receipt(payment_id)
    except Exception as e:
        logger.error(f"Error verifying receipt: {e}")
        raise HTTPException(status_code=500, detail="Failed to verify receipt")

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
    tenant_id: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    payment_method: Optional[str] = None,
    sort_by: str = "date",
    limit: int = 50,
    offset: int = 0,
    user: UserContext = Depends(get_current_user)
):
    """
    Get recent payments with enhanced filtering.
    """
    result = payment_service.get_all_payments(
        user.user_id, 
        tenant_id=tenant_id, 
        status=status,
        date_from=date_from,
        date_to=date_to,
        min_amount=min_amount,
        max_amount=max_amount,
        payment_method=payment_method,
        sort_by=sort_by,
        limit=limit, 
        offset=offset
    )
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
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    summary="Initiate Razorpay payment",
    description="Create Razorpay order and return checkout details"
)
def initiate_payment(
    data: PaymentInitiate,
    user: UserContext = Depends(get_current_user)
):
    """
    Initiate a payment by creating a Razorpay order.

    - **Owner/Admin**: Provide `obligation_id`; ownership is verified and a payment
      record is created in the database before checkout begins.
    - **Student**: Provide `obligation_id` (optional) and `amount`; uses the
      student-centric order creation flow.
    """
    if user.is_student():
        # Student flow: requirement for obligation_id
        if not data.obligation_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="obligation_id is required for student payment initiation"
            )
        if not data.amount:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="amount is required for student payment initiation"
            )
            
        result = payment_service.create_razorpay_order(
            str(data.obligation_id),
            data.amount,
            str(user.student_id),
            extra_notes=data.notes
        )
    else:
        # Owner/Admin flow: obligation_id is required, amount is taken from obligation
        if not data.obligation_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="obligation_id is required for owner payment initiation"
            )
        result = payment_service.initiate_razorpay_payment(
            str(data.obligation_id),
            str(user.user_id)
        )
    return _handle_service_response(result, status.HTTP_201_CREATED)


@router.post(
    "/verify",
    response_model=dict,
    summary="Verify a Razorpay payment from the frontend callback"
)
def verify_razorpay_payment(
    data: PaymentVerifyRequest,
    user: UserContext = Depends(get_current_user)
):
    """
    **Student Only**: Verify the HMAC signature of a completed Razorpay payment and
    idempotently record/confirm the payment in the database.

    - Call this immediately after the Razorpay checkout `handler` callback fires.
    - Safe to call multiple times for the same payment (idempotent).
    """
    if not user.is_student():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can verify payments."
        )

    result = payment_service.verify_razorpay_payment(
        razorpay_order_id=data.razorpay_order_id,
        razorpay_payment_id=data.razorpay_payment_id,
        razorpay_signature=data.razorpay_signature,
        obligation_id=str(data.obligation_id) if data.obligation_id else None,
        student_id=str(user.student_id)
    )
    return _handle_service_response(result)


@router.post(
    "/reconcile",
    response_model=dict,
    summary="Reconcile pending payments with Razorpay",
    dependencies=[Depends(require_admin_or_owner)]
)
def reconcile_payments(
    data: Optional[ReconcileRequest] = None,
    user: UserContext = Depends(get_current_user)
):
    """
    **Admin/Owner**: Query Razorpay for the current status of pending payments and
    update local records accordingly. Resolves stale PENDING obligations whose
    Razorpay payments were already captured.

    - Omit `payment_ids` to reconcile **all** pending payments for your account.
    - Provide specific `payment_ids` to reconcile only those payments.
    """
    payment_ids = [str(pid) for pid in data.payment_ids] if data and data.payment_ids else None
    result = payment_service.reconcile_pending_payments(payment_ids)
    return _handle_service_response(result)


@router.get(
    "/{payment_id}/status",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="Get payment status",
    description="Poll current payment status from Razorpay"
)
def get_payment_status(
    payment_id: str,
    user: UserContext = Depends(get_current_user)
):
    """
    Get current payment status.
    - Verifies payment ownership
    - Polls Razorpay for latest status
    - Updates local database
    - Returns time elapsed
    """
    result = payment_service.get_payment_status(payment_id, user.user_id)
    return _handle_service_response(result)


@router.post(
    "/webhook",
    status_code=status.HTTP_200_OK,
    summary="Razorpay webhook receiver",
    include_in_schema=False
)
async def razorpay_webhook(request: Request):
    """
    **Public Endpoint**: Receives payment notifications from Razorpay.
    - Verifies HMAC-SHA256 signature (primary security gate).
    - Applies per-IP rate limiting to prevent DDoS.
    - Delegates event processing (with ownership checks and idempotency) to the service layer.
    """
    # Rate limiting - protect against flood / DDoS
    client_ip = request.client.host if request.client else "unknown"
    if _is_rate_limited(client_ip):
        logger.warning(f"Webhook rate limit exceeded for IP: {client_ip}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "RATE_LIMITED", "message": "Too many requests"}
        )

    body_bytes = await request.body()
    signature = request.headers.get("X-Razorpay-Signature")

    if not signature:
        logger.warning("Webhook received without X-Razorpay-Signature")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Missing signature"}
        )

    # Verify authenticity using pure HMAC-SHA256 (no Razorpay client dependency)
    is_valid = payment_service.verify_razorpay_signature(
        body_bytes.decode("utf-8") if isinstance(body_bytes, bytes) else body_bytes,
        signature
    )
    if not is_valid:
        logger.warning(f"Invalid Razorpay signature from IP: {client_ip}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Invalid signature"}
        )

    # Parse and process the verified event
    import json
    try:
        event = json.loads(body_bytes)
        # Sanitize event type before logging to prevent log injection
        raw_event_type = event.get("event", "")
        safe_event_type = raw_event_type if isinstance(raw_event_type, str) and raw_event_type.replace(".", "").isalnum() else "unknown"
        logger.info(f"Valid Razorpay webhook received. Event: {safe_event_type}")
        result = payment_service.handle_razorpay_webhook(event)

        # Always return 200 so Razorpay does not retry; log any business-logic errors.
        if not result.get("success"):
            logger.error(f"Webhook processing error: {result.get('error')}")

        return {"status": "ok"}
    except Exception as e:
        logger.exception(f"Unexpected error in webhook handler: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_ERROR", "message": "Webhook processing failed"}
        )
