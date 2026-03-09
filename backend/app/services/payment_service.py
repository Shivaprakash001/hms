from app.db import supabase
from typing import Optional, Dict, Any, List
from datetime import date, datetime, timedelta
import calendar
from decimal import Decimal
from app.utils.responses import ServiceResponse, ErrorCode
from app.utils.logger import get_logger
from app.utils.hooks import trigger_hook
from uuid import UUID

logger = get_logger(__name__)


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
        
        # 1. Fetch students with active or overlapping allocations in this month
        # We need students(*) and room_allocations(*)
        # Filter: overlap [start_date, month_end] AND (end_date IS NULL OR end_date >= month_start)
        alloc_res = supabase.table("room_allocations")\
            .select("*, students(id, monthly_rent, status)")\
            .lte("start_date", month_end_date.isoformat())\
            .or_(f"end_date.is.null,end_date.gte.{target_month.isoformat()}")\
            .execute()
        
        allocations = alloc_res.data
        if not allocations:
            return ServiceResponse.success([], "No active allocations found for this month.")
            
        generated_count = 0
        skipped_count = 0
        errors = []

        for alloc in allocations:
            student = alloc.get("students")
            if not student: continue
            
            student_id = student["id"]
            monthly_rent = Decimal(str(student.get("monthly_rent", 0)))
            
            # 2. Check if obligation already exists for this student/month
            existing = supabase.table("rent_obligations")\
                .select("id")\
                .eq("student_id", student_id)\
                .eq("rent_month", target_month.isoformat())\
                .execute()
            
            if existing.data:
                skipped_count += 1
                continue
                
            # 3. Calculate Prorated Amount
            amount = _calculate_prorated_rent(
                monthly_rent,
                datetime.strptime(alloc["start_date"], "%Y-%m-%d").date(),
                datetime.strptime(alloc["end_date"], "%Y-%m-%d").date() if alloc.get("end_date") else None,
                target_month
            )
            
            if amount <= 0:
                continue
                
            # 4. Create Obligation
            obligation_data = {
                "student_id": student_id,
                "allocation_id": alloc["id"],
                "rent_month": target_month.isoformat(),
                "amount": float(amount),
                "due_date": (target_month + timedelta(days=9)).isoformat(), # Default 10th of month
                "status": "PENDING"
            }
            
            res = supabase.table("rent_obligations").insert(obligation_data).execute()
            if res.data:
                generated_count += 1
                trigger_hook("rent_obligation_created", 
                             obligation_id=res.data[0]["id"], 
                             student_id=student_id, 
                             amount=float(amount))
            else:
                errors.append(f"Failed to create for student {student_id}")

        return ServiceResponse.success({
            "target_month": target_month.isoformat(),
            "generated": generated_count,
            "skipped_already_exists": skipped_count,
            "errors": errors
        }, f"Generated {generated_count} rent obligations.")

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
        query = supabase.table("rent_obligations")\
            .select("*, students(profiles!students_profile_id_fkey(name), room_number)", count="exact")\
            .eq("owner_id", user_id)

        if rent_month:
            # Filter by specific month
            query = query.eq("rent_month", rent_month.isoformat())
            
        if status:
            query = query.eq("status", status)
        else:
            # Default: Show everything not WAIVED/PAID? Or just show all?
            # Typically dues report shows PENDING/PARTIAL
            # But let's return all and let frontend filter, or filter here.
            pass

        result = query.execute()
        
        dues = []
        for d in result.data:
            student = d.get("students", {})
            profile = student.get("profiles", {})
            
            d["student_name"] = profile.get("name", "Unknown")
            d["room_no"] = student.get("room_number", "N/A")
            d["outstanding"] = float(Decimal(str(d["amount"])) - Decimal(0)) # Simplified, should subtract payments ideally but obligations check status
            
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
