from datetime import datetime
from dateutil.relativedelta import relativedelta
from app.db import supabase
from app.utils.logger import get_logger
from app.services import payment_service

logger = get_logger(__name__)

class PaymentGenerationJob:
    @staticmethod
    def run_monthly_rent_cycle(target_date=None, owner_id=None):
        """
        Use the main payment service to generate the month's rent obligations.
        This keeps manual and automated generation on the same code path.
        """
        if not target_date:
            target_month = datetime.now().date().replace(day=1)
        elif isinstance(target_date, str):
            target_month = datetime.strptime(target_date, "%Y-%m-%d").date().replace(day=1)
        elif hasattr(target_date, "date"):
            target_month = target_date.date().replace(day=1)  # type: ignore[attr-defined]
        else:
            target_month = target_date.replace(day=1)

        logger.info(f"Starting monthly rent cycle for {target_month.isoformat()} owner={owner_id or 'ALL'}")
        return payment_service.generate_monthly_rent(target_month, user_id=owner_id)

    @staticmethod
    async def generate_monthly_payments(target_date=None):
        """
        - Get all active allocations/tenants
        - For each: calculate rent
        - Create rent_obligation record with due_date = configured due_day of next month
        - Log execution
        """
        if not target_date:
            target_date = datetime.now()
        elif isinstance(target_date, str):
            target_date = datetime.strptime(target_date, "%Y-%m-%d")
            
        logger.info(f"Starting monthly payment generation for {target_date.strftime('%Y-%m')}")
        
        from typing import cast
        
        # Ensure we are working with a datetime or date that supports relativedelta
        # Next month for the rent obligation
        next_month = cast(datetime, target_date + relativedelta(months=1))
        # Store as YYYY-MM-01
        # If it's a datetime, use .date(), if it's already a date, just use it
        next_month_date = next_month.date() if hasattr(next_month, 'date') else next_month # type: ignore
        rent_month = next_month_date.replace(day=1).isoformat()
        
        try:
            # 1. Get active students with room allocations and owners
            response = supabase.table("students") \
                .select("id, profile_id, monthly_rent, joined_on, owner_id, profiles!students_owner_id_fkey(due_day), room_allocations!inner(id, end_date)") \
                .eq("status", "ACTIVE") \
                .is_("room_allocations.end_date", "null") \
                .execute()
                
            students = response.data
            
            if not students:
                logger.info("No active students found with allocations for payment generation.")
                return {"success": True, "count": 0}
                
            count = 0
            errors = 0
            
            for student in students:
                student_id = student["id"]
                owner_id = student["owner_id"]
                # There should be exactly one active allocation due to inner join + null check
                allocation_id = student["room_allocations"][0]["id"]
                rent_amount = float(student["monthly_rent"])
                
                # Fetch Owner due_day (fallback to 5th if not set)
                profiles_data = student.get("profiles", {}) or {}
                due_day = int(profiles_data.get("due_day") or 5)
                
                # Calculate real due date
                try:
                    due_date = cast(datetime, next_month).replace(day=due_day).date().isoformat() # pyre-ignore
                except ValueError: # handle 31st on month with 30 days
                    # if due_day is too big for the month, cap it
                    import calendar
                    _next_dt = cast(datetime, next_month)
                    last_day = calendar.monthrange(_next_dt.year, _next_dt.month)[1]
                    capped_day = min(due_day, last_day)
                    due_date = _next_dt.replace(day=capped_day).date().isoformat()

                # See if already generated
                existing = supabase.table("rent_obligations") \
                    .select("id") \
                    .eq("student_id", student_id) \
                    .eq("rent_month", rent_month) \
                    .execute()
                    
                if existing.data:
                    continue
                
                # Create obligation
                new_obligation = {
                    "student_id": student_id,
                    "allocation_id": allocation_id,
                    "rent_month": rent_month,
                    "amount": rent_amount,
                    "due_date": due_date,
                    "status": "PENDING",
                    "owner_id": owner_id
                }
                
                res = supabase.table("rent_obligations").insert(new_obligation).execute()
                if res.data:
                    count += 1
                else:
                    errors += 1
                    
            logger.info(f"Payment generation complete. Generated: {count}, Errors: {errors}")
            return {"success": True, "count": count, "errors": errors}
            
        except Exception as e:
            logger.exception(f"Error in payment generation job: {e}")
            return {"success": False, "error": str(e)}
