from app.db import supabase
from typing import Optional, Dict, Any, List
from datetime import date, datetime, timedelta, timezone
import calendar
from decimal import Decimal
from app.utils.responses import ServiceResponse, ErrorCode
from app.utils.logger import get_logger
from app.utils.hooks import trigger_hook
from uuid import UUID
import razorpay
import os
import time
import hmac
import hashlib
import threading

logger = get_logger(__name__)

# Razorpay Configuration
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET")

razorpay_client = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    try:
        razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    except Exception as e:
        logger.error(f"Failed to initialize Razorpay client: {e}")


def _calculate_prorated_rent(monthly_rent: Decimal, start_date: date, end_date: date, target_month: date) -> Decimal:
    """
    Calculate prorated rent for a specific month based on occupancy period.
    """
    # Find overlapping period between [start_date, end_date] and the target_month
    month_start = target_month.replace(day=1)
    _, last_day = calendar.monthrange(target_month.year, target_month.month)
    month_end = target_month.replace(day=last_day)
    
    actual_start = max(start_date, month_start)
    actual_end = min(end_date, month_end) if end_date else month_end
    
    if actual_start > actual_end:
        return Decimal(0)
    
    days_occupied = (actual_end - actual_start).days + 1
    total_days_in_month = last_day
    
    if days_occupied == total_days_in_month:
        return monthly_rent
        
    return (monthly_rent * Decimal(days_occupied) / Decimal(total_days_in_month)).quantize(Decimal('0.01'))


def generate_monthly_rent(rent_month: date, user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Generate rent obligations for all active students in a given month.
    """
    try:
        import traceback
        # Normalize to 1st of month
        target_month = rent_month.replace(day=1)
        _, last_day = calendar.monthrange(target_month.year, target_month.month)
        month_end_date = target_month.replace(day=last_day)
        
        logger.info(f"Generating monthly rent for {target_month.strftime('%Y-%m')} for owner {user_id}")
        
        # 0. Fetch all students belonging to this owner first
        # This is a safer way to isolate than relying on owner_id on all tables
        student_query = supabase.table("students").select("id, monthly_rent, status")
        if user_id:
            student_query = student_query.eq("owner_id", user_id)
        
        student_res = student_query.execute()
        owner_student_map = {s["id"]: s for s in student_res.data}
        owner_student_ids = list(owner_student_map.keys())
        
        if not owner_student_ids:
            return ServiceResponse.success({
                "target_month": target_month.isoformat(),
                "generated_count": 0,
                "updated_count": 0,
                "skipped_count": 0,
                "errors": []
            }, "No students found for this owner.")

        # 1. Fetch ALL allocations for these specific students
        # We perform the date filtering in Python to avoid Supabase library syntax issues (.or_ / .filter)
        query = supabase.table("room_allocations")\
            .select("*")\
            .in_("student_id", owner_student_ids)
            
        alloc_res = query.execute()
        all_allocations = alloc_res.data
        if not all_allocations:
            return ServiceResponse.success({
                "target_month": target_month.isoformat(),
                "generated_count": 0,
                "updated_count": 0,
                "skipped_count": 0,
                "errors": []
            }, "No allocations found for your students.")
            
        # Group allocations by student and filter for those overlapping this month
        student_allocs = {}
        for a in all_allocations:
            s_id = a.get("student_id")
            
            # Date filter in Python (Start <= MonthEnd) AND (End is NULL OR End >= MonthStart)
            start_val = str(a.get("start_date") or "").split('T')[0]
            end_val = str(a.get("end_date") or "").split('T')[0] if a.get("end_date") else None
            
            if not start_val: continue
            
            try:
                alloc_start = date.fromisoformat(start_val)
                # Overlap condition
                is_after_start = end_val is None or date.fromisoformat(end_val) >= target_month
                is_before_end = alloc_start <= month_end_date
                
                if is_after_start and is_before_end:
                    if s_id not in student_allocs:
                        student_allocs[s_id] = []
                    
                    # Attach student info from our map
                    a["_student"] = owner_student_map.get(s_id)
                    student_allocs[s_id].append(a)
            except Exception as de:
                logger.error(f"Error checking dates for allocation {a.get('id')}: {de}")
                continue

        generated_count = 0
        updated_count = 0
        skipped_count = 0
        errors = []
        
        for student_id, alloc_list in student_allocs.items():
            student = alloc_list[0].get("_student")
            if not student: continue
            
            monthly_rent_val = student.get("monthly_rent", 0)
            monthly_rent = Decimal(str(monthly_rent_val)) if monthly_rent_val is not None else Decimal(0)
            
            # Skip students with no rent configured
            if monthly_rent <= 0:
                skipped_count += 1
                continue
            
            # 2. Calculate Total Days of occupancy in the month across all segments
            total_days = 0
            for alloc in alloc_list:
                start_val = alloc.get("start_date")
                end_val = alloc.get("end_date")
                
                # Robustly handle Supabase dates which might have timestamps
                start_str = str(start_val).split('T')[0] if start_val else None
                end_str = str(end_val).split('T')[0] if end_val else None
                
                if not start_str: continue

                try:
                    start = max(target_month, date.fromisoformat(start_str))
                    end = min(month_end_date, date.fromisoformat(end_str)) if end_str else month_end_date
                    
                    if start <= end:
                        total_days += (end - start).days + 1
                except Exception as de:
                    logger.error(f"Date parsing error for student {student_id}: {de}")
                    continue
            
            if total_days <= 0:
                continue
            
            # Monthly rent is currently fixed amount regardless of days stayed (simple model)
            # You can easily change this to (monthly_rent * total_days / last_day) for prorated
            total_amount = monthly_rent
            
            # 3. Check for existing obligation
            existing_res_query = supabase.table("rent_obligations")\
                .select("*")\
                .eq("student_id", student_id)\
                .eq("rent_month", target_month.isoformat())
            
            # Again, use owner_id IF it exists, but don't crash if it doesn't
            # (Service role will find the record anyway)
            existing_res = existing_res_query.execute()
            
            if existing_res.data:
                existing = existing_res.data[0]
                # If it is already paid or waived, don't touch it
                if existing["status"] != "PENDING":
                    skipped_count += 1
                    continue
                
                # If amount is different, update it
                # Convert both to float/decimal for comparison
                current_amount = Decimal(str(existing["amount"]))
                target_amount = total_amount.quantize(Decimal('0.01'))
                
                if current_amount != target_amount:
                    supabase.table("rent_obligations")\
                        .update({"amount": float(target_amount)})\
                        .eq("id", existing["id"])\
                        .execute()
                    updated_count += 1
                else:
                    skipped_count += 1
                continue
                
            # 4. Create Obligation
            # Use the latest allocation ID as reference
            latest_alloc = sorted(alloc_list, key=lambda x: str(x.get("start_date") or "0001-01-01"))[-1]
            obligation_data = {
                "student_id": student_id,
                "allocation_id": latest_alloc["id"],
                "owner_id": user_id,
                "rent_month": target_month.isoformat(),
                "amount": float(total_amount),
                "due_date": (target_month + timedelta(days=9)).isoformat(),
                "status": "PENDING"
            }
            
            res = supabase.table("rent_obligations").insert(obligation_data).execute()
            if res.data:
                generated_count += 1
                trigger_hook("rent_obligation_created", 
                             obligation_id=res.data[0]["id"], 
                             student_id=student_id, 
                             owner_id=user_id,
                             amount=float(total_amount))
            else:
                errors.append(f"Failed to create for student {student_id}")

        return ServiceResponse.success({
            "target_month": target_month.isoformat(),
            "generated_count": generated_count,
            "updated_count": updated_count,
            "skipped_count": skipped_count,
            "errors": errors
        }, f"Processed rent obligations: {generated_count} new, {updated_count} updated.")

    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"Error generating monthly rent: {e}\n{tb}")
        return ServiceResponse.error(
            ErrorCode.INTERNAL_ERROR, 
            f"Failed to generate rent: {str(e)}", 
            tb
        )


def record_payment(
    obligation_id: str,
    amount_paid: Decimal,
    payment_method: str,
    reference_number: Optional[str] = None,
    payment_date: Optional[date] = None,
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Record a payment and update obligation status.
    Rules:
    - Obligation must exist
    - Total payments cannot exceed obligation amount? (Business choice: usually yes, or store as credit)
    - Default: Sum of payments updates status (PAID/PARTIAL)
    """
    try:
        # 1. Fetch Obligation
        ob_res = supabase.table("rent_obligations")\
            .select("*")\
            .eq("id", obligation_id)\
            .execute()
        
        if not ob_res.data:
            return ServiceResponse.not_found("Rent Obligation")
        
        obligation = ob_res.data[0]
        if obligation["status"] == "WAIVED":
            return ServiceResponse.error(ErrorCode.INVALID_INPUT, "Cannot pay for a waived obligation.")
            
        total_amount = Decimal(str(obligation["amount"]))
        
        # 2. Fetch existing payments for this obligation
        p_res = supabase.table("payments")\
            .select("amount_paid")\
            .eq("obligation_id", obligation_id)\
            .execute()
        
        existing_paid = sum(Decimal(str(p["amount_paid"])) for p in p_res.data)
        remaining_balance = total_amount - existing_paid
        
        if remaining_balance <= 0 and amount_paid > 0:
             return ServiceResponse.error(ErrorCode.INVALID_INPUT, "Obligation is already fully paid.")

        if amount_paid > remaining_balance:
            # Note: In a smarter system, we'd take the excess and credit it to next month
            return ServiceResponse.error(
                ErrorCode.INVALID_INPUT, 
                f"Payment exceeds balance. Remaining balance: {remaining_balance}"
            )

        # 3. Insert Payment
        payment_data = {
            "obligation_id": obligation_id,
            "student_id": obligation["student_id"],
            "owner_id": obligation.get("owner_id") or user_id,
            "amount_paid": float(amount_paid),
            "payment_method": payment_method,
            "reference_number": reference_number,
            "payment_date": (payment_date or date.today()).isoformat()
        }

        if reference_number:
            # Use upsert with ignore_duplicates to atomically prevent duplicate payments
            # for reference-backed payments (e.g. Razorpay). Requires a UNIQUE constraint
            # on payments.reference_number in the database.
            res = supabase.table("payments").upsert(
                payment_data,
                on_conflict="reference_number",
                ignore_duplicates=True
            ).execute()
            if not res.data:
                # No data returned means the row was silently ignored due to duplicate reference
                logger.info(f"Duplicate payment reference detected: {reference_number}. Skipping insert.")
                return ServiceResponse.already_exists("Payment", f"Reference {reference_number} already recorded")
        else:
            res = supabase.table("payments").insert(payment_data).execute()
            if not res.data:
                return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to record payment.")
        
        new_payment = res.data[0]
        
        # 4. Update Obligation Status
        new_total_paid = existing_paid + amount_paid
        new_status = "PAID" if new_total_paid >= total_amount else "PARTIAL"
        
        supabase.table("rent_obligations")\
            .update({"status": new_status})\
            .eq("id", obligation_id)\
            .execute()
            
        # Side Effects
        trigger_hook("payment_recorded", 
                     payment_id=new_payment["id"], 
                     obligation_id=obligation_id, 
                     amount=float(amount_paid),
                     user_id=user_id)
        
        return ServiceResponse.success({
            "payment": new_payment,
            "obligation_status": new_status,
            "remaining_balance": float(total_amount - new_total_paid) if new_status == "PARTIAL" else 0
        }, "Payment recorded successfully.")

    except Exception as e:
        logger.exception(f"Error recording payment: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "Failed to record payment", str(e))


def get_student_payment_history(student_id: str) -> Dict[str, Any]:
    """
    Get all obligations and payments for a student with balance summary.
    """
    try:
        start_time = time.time()
        # Fetch Obligations
        ob_res = supabase.table("rent_obligations")\
            .select("*")\
            .eq("student_id", student_id)\
            .order("rent_month", desc=True)\
            .execute()
        
        # Fetch Payments
        pay_res = supabase.table("payments")\
            .select("*")\
            .eq("student_id", student_id)\
            .order("payment_date", desc=True)\
            .execute()
            
        obligations = ob_res.data
        payments = pay_res.data
        
        query_duration = time.time() - start_time
        logger.info("Fetched student history", extra={
            "metric_type": "db_query_performance", 
            "duration": query_duration,
            "operation": "get_student_history"
        })

        total_due = sum(Decimal(str(o["amount"])) for o in obligations if o["status"] != "WAIVED")
        total_paid = sum(Decimal(str(p["amount_paid"])) for p in payments)
        
        return ServiceResponse.success({
            "student_id": student_id,
            "obligations": obligations,
            "payments": payments,
            "total_due": float(total_due),
            "total_paid": float(total_paid),
            "outstanding_balance": float(total_due - total_paid)
        })
    except Exception as e:
        logger.exception(f"Error fetching history: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to fetch student history")


def waive_obligation(obligation_id: str, user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Administrative waiver of a rent obligation.
    """
    try:
        # Check if payments already exist
        p_res = supabase.table("payments").select("id").eq("obligation_id", obligation_id).execute()
        if p_res.data:
            return ServiceResponse.error(ErrorCode.INVALID_INPUT, "Cannot waive an obligation that has payments.")
            
        res = supabase.table("rent_obligations")\
            .update({"status": "WAIVED"})\
            .eq("id", obligation_id)\
            .execute()
            
        if not res.data:
            return ServiceResponse.not_found("Obligation")
            
        trigger_hook("rent_waived", obligation_id=obligation_id, user_id=user_id)
        
        return ServiceResponse.success(res.data[0], "Obligation waived successfully.")
    except Exception as e:
        logger.exception(f"Error waiving obligation: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "Failed to waive obligation", str(e))


def get_dues_report(user_id: str, rent_month: Optional[date] = None, status: Optional[str] = None) -> Dict[str, Any]:
    """
    Get all outstanding dues.
    """
    try:
        # Fetch obligations with student profile and THEIR LATEST ROOM via allocations
        # We need to reach rooms table: rent_obligations -> room_allocations -> rooms
        query = supabase.table("rent_obligations")\
            .select("*, students(profiles!students_profile_id_fkey(name)), room_allocations(rooms(room_no))")\
            .eq("owner_id", user_id)

        if rent_month:
            # Filter by specific month
            query = query.eq("rent_month", rent_month.isoformat())
            
        if status:
            query = query.eq("status", status)

        result = query.execute()
        
        dues = []
        for d in result.data:
            student = d.get("students", {})
            profile = student.get("profiles", {})
            
            # Extract room_no from the nested join
            alloc = d.get("room_allocations", {})
            room = alloc.get("rooms", {}) if alloc else {}
            
            d["student_name"] = profile.get("name", "Unknown")
            d["room_no"] = room.get("room_no", "N/A")
            d["obligation_id"] = d["id"]
            d["outstanding"] = float(Decimal(str(d["amount"])) - Decimal(0)) # Simplified
            
            dues.append(d)
            
        return ServiceResponse.success(dues)

    except Exception as e:
        logger.exception(f"Error fetching dues report: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to fetch dues report")
def get_all_payments(
    user_id: str, 
    tenant_id: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    payment_method: Optional[str] = None,
    sort_by: str = "date",
    limit: int = 50, 
    offset: int = 0
) -> Dict[str, Any]:
    """
    Get all payments with student details and enhanced filtering.
    """
    try:
        # Join with student names and rent_obligations status
        query = supabase.table("payments")\
            .select("*, students(profiles!students_profile_id_fkey(name)), rent_obligations(rent_month, status)", count="exact")\
            .eq("owner_id", user_id)

        if tenant_id:
            query = query.eq("student_id", tenant_id)
        if date_from:
            query = query.gte("payment_date", date_from.isoformat())
        if date_to:
            query = query.lte("payment_date", date_to.isoformat())
        if min_amount is not None:
            query = query.gte("amount_paid", min_amount)
        if max_amount is not None:
            query = query.lte("amount_paid", max_amount)
        if payment_method:
            query = query.eq("payment_method", payment_method)
            
        # Due to join limitations in basic supabase-py, filtering on joined table (rent_obligations.status)
        # may require filtering in python or advanced syntax if supported. We'll filter in python if status is provided.
            
        if sort_by == "amount":
            query = query.order("amount_paid", desc=True)
        else:
            query = query.order("payment_date", desc=True)
            
        # For python-side status filtering, we might need to fetch more records initially.
        if status:
            query = query.limit(1000) # Fetch more to filter in python
        else:
            query = query.limit(limit).offset(offset)
            
        result = query.execute()
        
        payments = []
        for p in result.data:
            ob_status = p.get("rent_obligations", {}).get("status")
            if status and ob_status != status:
                continue
                
            # Flatten structure slightly for easier frontend consumption
            p["student_name"] = p.get("students", {}).get("profiles", {}).get("name", "Unknown")
            p["rent_month"] = p.get("rent_obligations", {}).get("rent_month")
            p["status"] = ob_status
            payments.append(p)
            
        # Apply pagination after in-memory filter if status was used
        if status:
            total = len(payments)
            payments = payments[offset:offset+limit]
        else:
            total = result.count if hasattr(result, 'count') else len(payments)
            
        return ServiceResponse.success({
            "payments": payments,
            "total": total
        })
    except Exception as e:
        logger.exception(f"Error fetching payments: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to fetch payments")


def create_razorpay_order(obligation_id: str, amount: Decimal, student_id: str, extra_notes: Optional[Dict] = None) -> Dict[str, Any]:
    """
    Create a Razorpay order for a student obligation.
    Optimized for UPI Intent by setting appropriate notes and gathering prefill info.
    """
    if not razorpay_client:
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "Razorpay client not configured")
    
    try:
        # 1. Handle Missing Obligation ID
        if not obligation_id:
             return ServiceResponse.error(ErrorCode.INVALID_INPUT, "Obligation ID is required")

        # 2. Fetch Obligation to verify balance
        ob_res = supabase.table("rent_obligations").select("*").eq("id", obligation_id).execute()
        if not ob_res.data:
            return ServiceResponse.not_found("Rent Obligation")
        
        obligation = ob_res.data[0]
        
        # 3. Fetch existing payments to verify amount doesn't exceed balance
        p_res = supabase.table("payments").select("amount_paid").eq("obligation_id", obligation_id).execute()
        existing_paid = sum(Decimal(str(p["amount_paid"])) for p in p_res.data)
        remaining_balance = Decimal(str(obligation["amount"])) - existing_paid
        
        if amount > remaining_balance:
            return ServiceResponse.error(
                ErrorCode.INVALID_INPUT, 
                f"Amount exceeds balance. Remaining: {remaining_balance}"
            )

        # 3. Create Razorpay Order
        # amount is in paise (1 INR = 100 paise)
        amount_paise = int(amount * 100)
        
        notes = extra_notes or {}
        notes.update({
            "obligation_id": str(obligation_id),
            "student_id": str(student_id),
            "type": "rent_payment"
        })

        order_data = {
            "amount": amount_paise,
            "currency": "INR",
            "payment_capture": 1, # Automatic capture
            "notes": notes
        }
        
        # Mobile UPI Optimization: Razorpay handles intent better if we specify the method in some frontend SDKs,
        # but here we ensure notes are strictly typed for the webhook to recover context.
        razorpay_order = razorpay_client.order.create(data=order_data)
        
        logger.info("Razorpay order created", extra={
            "metric_type": "razorpay_order_created",
            "amount": float(amount),
            "order_id": razorpay_order["id"]
        })
        
        # 4. Get student profile for frontend prefill
        student_res = supabase.table("students")\
            .select("*, profiles!students_profile_id_fkey(*)")\
            .eq("id", student_id)\
            .execute()
            
        profile = {}
        if student_res.data:
            profile = student_res.data[0].get("profiles", {})

        return ServiceResponse.success({
            "order_id": razorpay_order["id"],
            "amount": razorpay_order["amount"],
            "currency": razorpay_order["currency"],
            "key_id": RAZORPAY_KEY_ID,
            "name": "Hostel Management System",
            "description": f"Rent Payment - {obligation.get('rent_month')}",
            "prefill": {
                "name": profile.get("name", ""),
                "email": profile.get("email", ""),
                "contact": profile.get("phone", "")
            },
            "notes": order_data["notes"]
        })

    except Exception as e:
        logger.exception(f"Error creating Razorpay order: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "Failed to create Razorpay order", str(e))


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """
    Verify the authenticity of a Razorpay webhook request.
    """
    if not razorpay_client or not RAZORPAY_WEBHOOK_SECRET:
        logger.error("Razorpay client or Webhook Secret not configured")
        return False
        
    try:
        razorpay_client.utility.verify_webhook_signature(
            payload.decode("utf-8"),
            signature,
            RAZORPAY_WEBHOOK_SECRET
        )
        return True
    except Exception as e:
        logger.error(f"Webhook signature verification failed: {e}")
        return False


def verify_razorpay_signature(payload_str: str, signature: str) -> bool:
    """
    Verify Razorpay webhook signature using HMAC-SHA256.

    Unlike verify_webhook_signature, this function only requires
    RAZORPAY_WEBHOOK_SECRET and does not depend on the Razorpay client
    being initialised (i.e. it works even when API keys are absent).

    Args:
        payload_str: Raw request body as a string.
        signature: X-Razorpay-Signature header value.

    Returns:
        True if the signature is valid, False otherwise.
    """
    if not RAZORPAY_WEBHOOK_SECRET:
        logger.error("RAZORPAY_WEBHOOK_SECRET not configured")
        return False

    try:
        computed = hmac.new(
            RAZORPAY_WEBHOOK_SECRET.encode(),
            payload_str.encode(),
            hashlib.sha256
        ).hexdigest()
        is_valid = hmac.compare_digest(computed, signature)
        if not is_valid:
            logger.warning("Razorpay webhook signature mismatch")
        return is_valid
    except Exception as e:
        logger.exception(f"Error verifying Razorpay webhook signature: {e}")
        return False


# ---------------------------------------------------------------------------
# Webhook event deduplication.
# Primary store: payment_webhook_events DB table (cross-process safe).
# Fast-path cache: in-memory set per process (avoids redundant DB round-trips).
# ---------------------------------------------------------------------------
_processed_event_ids: set = set()
_event_id_lock = threading.Lock()

# State-machine: valid forward transitions for obligation status
_OBLIGATION_TRANSITIONS: Dict[str, set] = {
    "PENDING":  {"PARTIAL", "PAID", "WAIVED"},
    "PARTIAL":  {"PAID"},
    "PAID":     set(),      # terminal – no further transitions
    "WAIVED":   set(),      # terminal
}


def _is_valid_transition(current: str, target: str) -> bool:
    """Return True only when the transition from current→target is permitted."""
    return target in _OBLIGATION_TRANSITIONS.get(current, set())


def _build_event_id(event: Dict[str, Any]) -> str:
    """
    Derive a stable, unique identifier for a Razorpay webhook event.
    Prefers the Razorpay payment ID (most stable) and falls back to
    account_id + created_at + event_type when the payment entity is absent.
    """
    event_type = event.get("event", "unknown")
    payment_entity = (event.get("payload") or {}).get("payment", {}).get("entity", {})
    payment_id = (payment_entity or {}).get("id")

    if payment_id:
        return f"{payment_id}:{event_type}"

    # Fallback: use account_id + created_at; warn if both are missing
    account_id = event.get("account_id", "")
    created_at = event.get("created_at", "")
    if not account_id and not created_at:
        logger.warning("[Webhook] Cannot derive stable event_id; deduplication may be incomplete.")
    return f"{account_id}:{created_at}:{event_type}"


def _record_webhook_event(event_id: str, event_type: str, payment_id: Optional[str],
                          order_id: Optional[str], obligation_id: Optional[str]) -> bool:
    """
    Persist the webhook event in the DB for cross-process deduplication.
    Returns True if the event is new (should be processed), False if duplicate.
    """
    try:
        supabase.table("payment_webhook_events").insert({
            "event_id": event_id,
            "event_type": event_type,
            "razorpay_payment_id": payment_id,
            "razorpay_order_id": order_id,
            "obligation_id": obligation_id,
            "status": "processed",
        }).execute()
        return True
    except Exception as e:
        err_str = str(e)
        # Unique constraint violation → duplicate event
        if "duplicate" in err_str.lower() or "unique" in err_str.lower() or "23505" in err_str:
            return False
        # Table doesn't exist yet (migration pending) – fall through to in-memory check only
        if "does not exist" in err_str or "42P01" in err_str:
            logger.warning("[Webhook] payment_webhook_events table not found; using in-memory dedup only.")
            return True  # allow processing; in-memory lock handles same-process dupes
        logger.error(f"[Webhook] Unexpected error recording event: {e}")
        return True  # allow processing on unknown error to avoid silently dropping events


def handle_razorpay_webhook(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process Razorpay webhook events idempotently.
    Handles 'order.paid' and 'payment.captured' to update the database atomically.
    Duplicate event IDs are detected and safely skipped using both an in-memory
    cache (fast, per-process) and a DB table (cross-process safe).
    """
    event_type = event.get("event")
    event_id = _build_event_id(event)

    # Fast-path: in-memory dedup (avoids DB round-trip for same-process duplicates)
    with _event_id_lock:
        if event_id in _processed_event_ids:
            logger.info(f"[Webhook] Duplicate event skipped (in-memory): {event_id}")
            return ServiceResponse.success({}, "Duplicate event – already processed")
        _processed_event_ids.add(event_id)

    handled_events = {"order.paid", "payment.captured"}
    if event_type not in handled_events:
        logger.info(f"[Webhook] Event '{event_type}' acknowledged but not handled.")
        return ServiceResponse.success({}, f"Event {event_type} acknowledged")

    try:
        payload = event.get("payload", {})
        order = payload.get("order", {}).get("entity", {})
        payment = payload.get("payment", {}).get("entity", {})

        notes = order.get("notes") or payment.get("notes") or {}
        obligation_id = notes.get("obligation_id")
        student_id = notes.get("student_id")

        razorpay_payment_id = payment.get("id")
        razorpay_order_id = order.get("id")
        amount_paid_paise = payment.get("amount")
        if amount_paid_paise is None:
            return ServiceResponse.error(ErrorCode.INVALID_INPUT, "Missing payment amount in webhook")
        try:
            amount_paid = Decimal(str(int(amount_paid_paise))) / 100
        except (ValueError, TypeError) as conv_err:
            logger.error(f"[Webhook] Invalid payment amount: {amount_paid_paise} – {conv_err}")
            return ServiceResponse.error(ErrorCode.INVALID_INPUT, "Invalid payment amount in webhook")

        if not obligation_id or not student_id:
            logger.error(f"[Webhook] Missing metadata in order notes: {notes}")
            return ServiceResponse.error(ErrorCode.INVALID_INPUT, "Missing metadata in order notes")

        # DB-level deduplication (cross-process safe)
        is_new = _record_webhook_event(
            event_id=event_id,
            event_type=event_type,
            payment_id=razorpay_payment_id,
            order_id=razorpay_order_id,
            obligation_id=obligation_id,
        )
        if not is_new:
            logger.info(f"[Webhook] Duplicate event skipped (DB): {event_id}")
            return ServiceResponse.success({}, "Duplicate event – already processed")

        # Verify obligation ownership
        ob_check = supabase.table("rent_obligations")\
            .select("id, student_id, status")\
            .eq("id", obligation_id)\
            .execute()
        if not ob_check.data:
            logger.error(f"[Webhook] Unknown obligation_id: {obligation_id}")
            return ServiceResponse.error(ErrorCode.INVALID_INPUT, "Obligation not found")

        obligation = ob_check.data[0]
        if str(obligation.get("student_id")) != str(student_id):
            logger.error(
                f"[Webhook] student_id mismatch: expected {obligation.get('student_id')}, got {student_id}"
            )
            return ServiceResponse.error(ErrorCode.FORBIDDEN, "Student does not own this obligation")

        # State machine guard – don't process payment for a terminal obligation
        current_status = obligation.get("status", "PENDING")
        if current_status == "PAID":
            logger.info(f"[Webhook] Obligation {obligation_id} already PAID – skipping.")
            return ServiceResponse.success({}, "Obligation already fully paid")
        if current_status == "WAIVED":
            logger.warning(f"[Webhook] Obligation {obligation_id} is WAIVED – ignoring payment capture.")
            return ServiceResponse.success({}, "Obligation is waived")

        logger.info("[Webhook] Processing payment", extra={
            "metric_type": "razorpay_payment_processed",
            "amount": float(amount_paid),
            "reference": razorpay_payment_id,
            "obligation_id": obligation_id
        })

        result = record_payment(
            obligation_id=obligation_id,
            amount_paid=amount_paid,
            payment_method="UPI",
            reference_number=razorpay_payment_id,
            payment_date=date.today()
        )

        if not result.get("success"):
            error_code = result.get("error", {}).get("code", "")
            if error_code == ErrorCode.RESOURCE_ALREADY_EXISTS.value:
                logger.info(f"[Webhook] Payment {razorpay_payment_id} already recorded – idempotent skip.")
                return ServiceResponse.success({}, "Payment already processed")

        return result

    except Exception as e:
        logger.exception(f"[Webhook] Error processing event: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "Failed to process webhook", str(e))


def verify_razorpay_payment(
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
    obligation_id: Optional[str],
    student_id: str
) -> Dict[str, Any]:
    """
    Verify a Razorpay payment from the frontend callback.

    Steps:
    1. Validate HMAC signature using Razorpay key secret.
    2. Confirm the obligation belongs to the student.
    3. Idempotently record the payment (skip if already recorded by webhook).
    4. Return updated obligation + payment status.
    """
    if not razorpay_client or not RAZORPAY_KEY_SECRET:
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "Razorpay not configured")

    # 1. Signature verification
    try:
        razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature,
        })
    except Exception:
        logger.warning(
            f"[Verify] Invalid signature for order {razorpay_order_id} / payment {razorpay_payment_id}"
        )
        return ServiceResponse.error(ErrorCode.FORBIDDEN, "Payment signature verification failed")

    try:
        # 2. If obligation_id is provided, confirm ownership
        if obligation_id:
            ob_res = supabase.table("rent_obligations")\
                .select("id, student_id, amount, status")\
                .eq("id", obligation_id)\
                .execute()
            if not ob_res.data:
                return ServiceResponse.not_found("Rent obligation")
            ob = ob_res.data[0]
            if str(ob.get("student_id")) != str(student_id):
                return ServiceResponse.error(ErrorCode.FORBIDDEN, "Obligation does not belong to this student")

            # State guard – nothing to do for terminal states
            if ob.get("status") == "PAID":
                return ServiceResponse.success(
                    {"obligation_status": "PAID", "razorpay_payment_id": razorpay_payment_id},
                    "Payment already recorded"
                )
        else:
            # Discover obligation from Razorpay order notes
            try:
                order_data = razorpay_client.order.fetch(razorpay_order_id)
                notes = order_data.get("notes", {})
                obligation_id = notes.get("obligation_id")
            except Exception as fetch_err:
                logger.warning(f"[Verify] Could not fetch order notes: {fetch_err}")

        # 3. Fetch payment amount from Razorpay
        amount_paise = None
        payment_method = "UPI"
        try:
            rp_payment = razorpay_client.payment.fetch(razorpay_payment_id)
            amount_paise = rp_payment.get("amount")
            payment_method = rp_payment.get("method", "UPI").upper()
        except Exception as fetch_err:
            logger.warning(f"[Verify] Could not fetch payment details: {fetch_err}")

        if not amount_paise and obligation_id:
            ob_res2 = supabase.table("rent_obligations").select("amount").eq("id", obligation_id).execute()
            if ob_res2.data:
                amount_paise = int(Decimal(str(ob_res2.data[0]["amount"])) * 100)

        if not amount_paise:
            return ServiceResponse.error(ErrorCode.INVALID_INPUT, "Could not determine payment amount")

        amount = Decimal(str(amount_paise)) / 100

        # 4. Idempotently record payment
        if obligation_id:
            result = record_payment(
                obligation_id=obligation_id,
                amount_paid=amount,
                payment_method=payment_method,
                reference_number=razorpay_payment_id,
                payment_date=date.today()
            )
            if not result.get("success"):
                err_code = result.get("error", {}).get("code", "")
                if err_code == ErrorCode.RESOURCE_ALREADY_EXISTS.value:
                    # Already recorded (e.g. by webhook) – fetch current state
                    ob_final = supabase.table("rent_obligations").select("status").eq("id", obligation_id).execute()
                    final_status = ob_final.data[0]["status"] if ob_final.data else "UNKNOWN"
                    return ServiceResponse.success(
                        {"obligation_status": final_status, "razorpay_payment_id": razorpay_payment_id},
                        "Payment already recorded"
                    )
                return result
            return ServiceResponse.success(
                {
                    "obligation_status": result["data"]["obligation_status"],
                    "razorpay_payment_id": razorpay_payment_id,
                    "amount": float(amount),
                },
                "Payment verified and recorded successfully"
            )

        return ServiceResponse.success(
            {"razorpay_payment_id": razorpay_payment_id, "amount": float(amount)},
            "Payment signature verified (no obligation linked)"
        )

    except Exception as e:
        logger.exception(f"[Verify] Error verifying payment: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "Payment verification failed", str(e))


def reconcile_pending_payments(payment_ids: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Reconcile pending/initiated payments by querying Razorpay for their current status.
    Resolves stale 'PENDING' obligations whose Razorpay payments were already captured.
    """
    if not razorpay_client:
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "Razorpay not configured")

    reconciled = 0
    already_captured = 0
    failed = 0
    errors: List[str] = []

    try:
        # Find payments that have a reference_number (Razorpay payment ID) but whose
        # obligation is still PENDING or PARTIAL – these are candidates for reconciliation.
        query = supabase.table("payments")\
            .select("id, reference_number, obligation_id, amount_paid")\
            .neq("reference_number", None)

        if payment_ids:
            query = query.in_("id", [str(pid) for pid in payment_ids])

        pay_res = query.execute()
        payments_to_check = pay_res.data or []

        for p in payments_to_check:
            ref = p.get("reference_number")
            ob_id = p.get("obligation_id")
            if not ref or not ob_id:
                continue

            # Check if obligation still needs reconciliation
            ob_check = supabase.table("rent_obligations")\
                .select("status, amount, student_id")\
                .eq("id", ob_id)\
                .execute()
            if not ob_check.data:
                continue

            ob = ob_check.data[0]
            if ob["status"] in ("PAID", "WAIVED"):
                already_captured += 1
                continue

            # Query Razorpay for live payment status
            try:
                rp_payment = razorpay_client.payment.fetch(ref)
                rp_status = rp_payment.get("status")  # e.g. 'captured', 'failed', 'refunded'
            except Exception as rp_err:
                logger.warning(f"[Reconcile] Razorpay fetch failed for {ref}: {rp_err}")
                errors.append(f"Could not fetch {ref}: {rp_err}")
                failed += 1
                continue

            if rp_status == "captured":
                # Payment was captured – make sure our obligation reflects it
                amount_paise = rp_payment.get("amount", 0)
                amount = Decimal(str(amount_paise)) / 100
                result = record_payment(
                    obligation_id=ob_id,
                    amount_paid=amount,
                    payment_method=(rp_payment.get("method") or "UPI").upper(),
                    reference_number=ref,
                    payment_date=date.today()
                )
                if result.get("success") or result.get("error", {}).get("code") == ErrorCode.RESOURCE_ALREADY_EXISTS.value:
                    reconciled += 1
                    logger.info(f"[Reconcile] Obligation {ob_id} reconciled via payment {ref}")
                else:
                    failed += 1
                    errors.append(f"record_payment failed for {ref}: {result.get('error')}")
            elif rp_status in ("failed", "refunded"):
                logger.info(f"[Reconcile] Payment {ref} is {rp_status} – no obligation update needed")
                already_captured += 1
            else:
                logger.info(f"[Reconcile] Payment {ref} status={rp_status} – still pending")

        return ServiceResponse.success({
            "reconciled": reconciled,
            "already_captured": already_captured,
            "failed": failed,
            "errors": errors,
            "checked": len(payments_to_check)
        }, f"Reconciliation complete: {reconciled} updated, {already_captured} already final, {failed} errors")

    except Exception as e:
        logger.exception(f"[Reconcile] Unexpected error: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "Reconciliation failed", str(e))


def get_payment_status(payment_id: str, user_id: str) -> Dict[str, Any]:
    """
    Get current payment status with real-time Razorpay polling.

    Steps:
    1. Get payment record from database
    2. Verify ownership (user_id → owner_id)
    3. If status not completed, poll Razorpay for latest
    4. Update database with new status if changed
    5. Calculate time elapsed
    6. Return detailed status
    """
    try:
        # 1. Get payment record
        payment_res = supabase.table("payments")\
            .select("*")\
            .eq("id", payment_id)\
            .execute()

        if not payment_res.data:
            logger.warning(f"Payment {payment_id} not found")
            return ServiceResponse.error(ErrorCode.RESOURCE_NOT_FOUND, "Payment not found")

        payment = payment_res.data[0]

        # 2. Verify ownership
        if payment["owner_id"] != user_id:
            logger.warning(f"Unauthorized access to payment {payment_id} by user {user_id}")
            return ServiceResponse.error(ErrorCode.FORBIDDEN, "Not authorized to view this payment")

        # 3. Poll Razorpay if payment not yet completed
        current_status = payment["status"]

        if current_status != "COMPLETED" and razorpay_client:
            try:
                razorpay_payment_id = payment.get("razorpay_payment_id")
                if razorpay_payment_id:
                    razorpay_payment = razorpay_client.payment.fetch(razorpay_payment_id)
                    razorpay_status = razorpay_payment.get("status")

                    status_map = {
                        "authorized": "COMPLETED",
                        "captured": "COMPLETED",
                        "failed": "FAILED",
                        "rejected": "FAILED",
                        "pending": "PENDING",
                    }

                    new_status = status_map.get(razorpay_status, "PENDING")

                    if new_status != current_status:
                        logger.info(f"Payment {payment_id} status updated: {current_status} → {new_status}")

                        supabase.table("payments")\
                            .update({
                                "status": new_status,
                                "updated_at": datetime.now(timezone.utc).isoformat()
                            })\
                            .eq("id", payment_id)\
                            .execute()

                        current_status = new_status

                        if new_status == "COMPLETED":
                            obligation_id = payment.get("obligation_id")
                            supabase.table("rent_obligations")\
                                .update({
                                    "status": "PAID",
                                    "updated_at": datetime.now(timezone.utc).isoformat()
                                })\
                                .eq("id", obligation_id)\
                                .execute()

                            logger.info(f"Obligation {obligation_id} marked as PAID")

            except Exception as e:
                logger.warning(f"Failed to poll Razorpay for payment {payment_id}: {e}")

        # 4. Calculate time elapsed
        created_at_str = payment.get("created_at")
        time_elapsed_seconds = 0

        if created_at_str:
            try:
                created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                time_elapsed_seconds = int((datetime.now(timezone.utc) - created_at).total_seconds())
            except Exception:
                pass

        # 5. Return detailed response
        return ServiceResponse.success({
            "id": payment_id,
            "status": current_status,
            "amount": payment.get("amount"),
            "reference_number": payment.get("reference_number"),
            "razorpay_payment_id": payment.get("razorpay_payment_id"),
            "method": payment.get("method"),
            "created_at": payment.get("created_at"),
            "updated_at": payment.get("updated_at"),
            "time_elapsed_seconds": time_elapsed_seconds,
            "student_id": payment.get("student_id"),
            "obligation_id": payment.get("obligation_id")
        }, f"Payment status: {current_status}")

    except Exception as e:
        logger.exception(f"Error getting payment status: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, str(e))
