from app.db import supabase
from typing import Optional, Dict, Any, List
from datetime import date, datetime, timedelta
import calendar
from decimal import Decimal
from app.utils.responses import ServiceResponse, ErrorCode
from app.utils.logger import get_logger
from app.utils.hooks import trigger_hook
from uuid import UUID
import razorpay
import os

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
        # Normalize to 1st of month
        target_month = rent_month.replace(day=1)
        _, last_day = calendar.monthrange(target_month.year, target_month.month)
        month_end_date = target_month.replace(day=last_day)
        
        logger.info(f"Generating monthly rent for {target_month.strftime('%Y-%m')}")
        
        # 1. Fetch all allocations overlapping with this month
        alloc_res = supabase.table("room_allocations")\
            .select("*, students(id, monthly_rent, status)")\
            .lte("start_date", month_end_date.isoformat())\
            .or_(f"end_date.is.null,end_date.gte.{target_month.isoformat()}")\
            .execute()
        
        allocations = alloc_res.data
        if not allocations:
            return ServiceResponse.success([], "No active allocations found for this month.")
            
        # Group allocations by student
        student_allocs = {}
        for a in allocations:
            if not a.get("students"): continue
            s_id = a["students"]["id"]
            if s_id not in student_allocs:
                student_allocs[s_id] = []
            student_allocs[s_id].append(a)

        generated_count = 0
        updated_count = 0
        skipped_count = 0
        errors = []
        for student_id, alloc_list in student_allocs.items():
            student = alloc_list[0]["students"]
            monthly_rent = Decimal(str(student.get("monthly_rent", 0)))
            
            # 2. Calculate Total Days of occupancy in the month across all segments
            total_days = 0
            for alloc in alloc_list:
                start_str = alloc["start_date"].split('T')[0] if alloc.get("start_date") else None
                end_str = alloc["end_date"].split('T')[0] if alloc.get("end_date") else None
                
                if not start_str: continue

                start = max(target_month, date.fromisoformat(start_str))
                end = min(month_end_date, date.fromisoformat(end_str)) if end_str else month_end_date
                
                if start <= end:
                    total_days += (end - start).days + 1
            
            if total_days <= 0:
                continue
            
            # Since it's monthly based, we charge the full monthly_rent if any days were stayed
            total_amount = monthly_rent
            
            # 3. Check for existing obligation
            existing_res = supabase.table("rent_obligations")\
                .select("*")\
                .eq("student_id", student_id)\
                .eq("rent_month", target_month.isoformat())\
                .execute()
            
            if existing_res.data:
                existing = existing_res.data[0]
                # If it is already paid or waived, don't touch it
                if existing["status"] != "PENDING":
                    skipped_count += 1
                    continue
                
                # If amount is different, update it
                if Decimal(str(existing["amount"])) != total_amount.quantize(Decimal('0.01')):
                    supabase.table("rent_obligations")\
                        .update({"amount": float(total_amount)})\
                        .eq("id", existing["id"])\
                        .execute()
                    updated_count += 1
                else:
                    skipped_count += 1
                continue
                
            # 4. Create Obligation
            # Use the latest allocation ID as reference
            latest_alloc = sorted(alloc_list, key=lambda x: x["start_date"])[-1]
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
            "generated": generated_count,
            "updated": updated_count,
            "skipped": skipped_count,
            "errors": errors
        }, f"Processed rent obligations: {generated_count} new, {updated_count} updated.")

    except Exception as e:
        logger.exception(f"Error generating monthly rent: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "Failed to generate rent", str(e))


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
def get_all_payments(user_id: str, limit: int = 50, offset: int = 0) -> Dict[str, Any]:
    """
    Get all payments with student details.
    """
    try:
        # Join with student names for UI
        query = supabase.table("payments")\
            .select("*, students(profiles!students_profile_id_fkey(name)), rent_obligations(rent_month)", count="exact")\
            .eq("owner_id", user_id)\
            .order("payment_date", desc=True)\
            .limit(limit)\
            .offset(offset)
            
        result = query.execute()
        
        payments = []
        for p in result.data:
            # Flatten structure slightly for easier frontend consumption
            p["student_name"] = p.get("students", {}).get("profiles", {}).get("name", "Unknown")
            p["rent_month"] = p.get("rent_obligations", {}).get("rent_month")
            payments.append(p)
            
        return ServiceResponse.success({
            "payments": payments,
            "total": result.count if hasattr(result, 'count') else len(payments)
        })
    except Exception as e:
        logger.exception(f"Error fetching payments: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to fetch payments")


def create_razorpay_order(obligation_id: str, amount: Decimal, student_id: str) -> Dict[str, Any]:
    """
    Create a Razorpay order for a student obligation.
    Optimized for UPI Intent by setting appropriate notes and gathering prefill info.
    """
    if not razorpay_client:
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "Razorpay client not configured")
    
    try:
        # 1. Fetch Obligation to verify balance
        ob_res = supabase.table("rent_obligations").select("*").eq("id", obligation_id).execute()
        if not ob_res.data:
            return ServiceResponse.not_found("Rent Obligation")
        
        obligation = ob_res.data[0]
        
        # 2. Fetch existing payments to verify amount doesn't exceed balance
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
        
        order_data = {
            "amount": amount_paise,
            "currency": "INR",
            "payment_capture": 1, # Automatic capture
            "notes": {
                "obligation_id": str(obligation_id),
                "student_id": str(student_id),
                "type": "rent_payment"
            }
        }
        
        # Mobile UPI Optimization: Razorpay handles intent better if we specify the method in some frontend SDKs,
        # but here we ensure notes are strictly typed for the webhook to recover context.
        razorpay_order = razorpay_client.order.create(data=order_data)
        
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


def handle_razorpay_webhook(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process Razorpay webhook events. 
    Handles 'order.paid' to update the database atomically.
    """
    event_type = event.get("event")
    if event_type != "order.paid":
        logger.info(f"Webhook received, but even '{event_type}' is not handled.")
        return ServiceResponse.success({}, f"Event {event_type} acknowledged")
    
    try:
        payload = event.get("payload", {})
        order = payload.get("order", {}).get("entity", {})
        payment = payload.get("payment", {}).get("entity", {})
        
        notes = order.get("notes", {})
        obligation_id = notes.get("obligation_id")
        student_id = notes.get("student_id")
        
        razorpay_payment_id = payment.get("id")
        amount_paid_paise = payment.get("amount")
        amount_paid = Decimal(amount_paid_paise) / 100
        
        if not obligation_id or not student_id:
            logger.error(f"Webhook payload missing student/obligation metadata: {notes}")
            return ServiceResponse.error(ErrorCode.INVALID_INPUT, "Missing metadata in order notes")

        # Atomic check: Ensure we haven't already processed this payment ID
        existing_check = supabase.table("payments")\
            .select("id")\
            .eq("reference_number", razorpay_payment_id)\
            .execute()
            
        if existing_check.data:
            logger.info(f"Payment {razorpay_payment_id} already processed. Skipping.")
            return ServiceResponse.success({}, "Payment already processed")

        # Record the payment using the standard business logic
        # This will update obligation status and trigger hooks
        return record_payment(
            obligation_id=obligation_id,
            amount_paid=amount_paid,
            payment_method="UPI", # Razorpay UPI
            reference_number=razorpay_payment_id,
            payment_date=date.today()
        )

    except Exception as e:
        logger.exception(f"Error handling Razorpay webhook: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "Failed to process webhook", str(e))
