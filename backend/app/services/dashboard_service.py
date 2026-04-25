from app.db import supabase
from app.utils.responses import ServiceResponse, ErrorCode
from app.utils.logger import get_logger
from datetime import date
from decimal import Decimal

logger = get_logger(__name__)


def _rows(response) -> list:
    return response.data if response and getattr(response, "data", None) else []


def _to_decimal(value) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except Exception:
        return Decimal(0)


def _safe_execute(label: str, fn, default=None):
    try:
        return fn()
    except Exception as exc:
        logger.error("Dashboard query failed for %s: %s", label, exc)
        return default

def get_dashboard_stats(user_id: str):
    logger.info(f"ENTERING get_dashboard_stats for user_id: {user_id}")
    # TEMPORARY TEST: If the dashboard shows exactly 123 in Revenue, we know this code is active.
    # return ServiceResponse.success({"revenue": 123.0, "total_rooms": 1, "total_tenants": 1, ...})
    # Actually, I'll just proceed but with hardcoded 0s for everything if it fails.
    try:
        today = date.today()
        month_start = today.replace(day=1)
        # next month calculation
        if today.month == 12:
            next_month = today.replace(year=today.year + 1, month=1, day=1)
        else:
            next_month = today.replace(month=today.month + 1, day=1)
        
        # 1. Base query for owner's students
        students_data = _safe_execute(
            "students",
            lambda: _rows(
                supabase.table("students").select("id, status").eq("owner_id", user_id).execute()
            ),
            [],
        )
        all_student_ids = [s.get('id') for s in students_data if s.get('id')]
        total_tenants = len(students_data)
        active_tenants = len([
            s for s in students_data if str(s.get('status') or '').upper() == 'ACTIVE'
        ])

        # 2. Total Capacity & Rooms
        rooms_data = _safe_execute(
            "rooms",
            lambda: _rows(
                supabase.table("rooms").select("capacity").eq("owner_id", user_id).execute()
            ),
            [],
        )
        total_rooms = len(rooms_data)
        total_capacity = sum(int(r.get('capacity') or 0) for r in rooms_data)
        
        occupancy_rate = 0
        if total_capacity > 0:
            occupancy_rate = round((active_tenants / total_capacity) * 100)
        vacant_beds = max(total_capacity - active_tenants, 0)

        # 3. Revenue (Current Month Collected)
        payments_curr_data = _safe_execute(
            "current_month_payments",
            lambda: _rows(
                supabase.table("payments")
                .select("amount_paid")
                .gte("payment_date", month_start.isoformat())
                .lt("payment_date", next_month.isoformat())
                .eq("owner_id", user_id)
                .execute()
            ),
            [],
        )
        current_revenue = sum(_to_decimal(p.get('amount_paid')) for p in payments_curr_data)

        # 4. Expenses (Current Month)
        expenses_data = _safe_execute(
            "current_month_expenses",
            lambda: _rows(
                supabase.table("expenses")
                .select("amount")
                .gte("date", month_start.isoformat())
                .lt("date", next_month.isoformat())
                .eq("owner_id", user_id)
                .execute()
            ),
            [],
        )
        current_expenses = sum(_to_decimal(e.get('amount')) for e in expenses_data)

        # Defaults for remaining metrics if no students
        pending_total = Decimal(0)
        overdue_total = Decimal(0)
        overdue_count = 0

        # 5. Pending Dues (Total Unpaid across all time)
        if all_student_ids:
            try:
                obligations_data = _rows(
                    supabase.table("rent_obligations")
                    .select("id, amount, due_date, status")
                    .in_("student_id", all_student_ids)
                    .neq("status", "PAID")
                    .neq("status", "WAIVED")
                    .execute()
                )
                
                for ob in obligations_data:
                    rem = _to_decimal(ob.get('amount'))
                    # Check for partial payments
                    ob_id = ob.get('id')
                    if ob_id:
                        p_res = _safe_execute(
                            f"payments_for_obligation:{ob_id}",
                            lambda: _rows(
                                supabase.table("payments").select("amount_paid").eq("obligation_id", ob_id).execute()
                            ),
                            [],
                        )
                        if p_res:
                            paid = sum(_to_decimal(p.get('amount_paid')) for p in p_res)
                            rem -= paid
                    
                    if rem > 0:
                        pending_total += rem
                        due_date_raw = ob.get('due_date')
                        if due_date_raw:
                            try:
                                d_date = date.fromisoformat(str(due_date_raw).split('T')[0])
                                if d_date < today:
                                    overdue_total += rem
                                    overdue_count += 1
                            except: pass
            except Exception as inner_e:
                logger.error(f"Error in obligations sub-query: {inner_e}")

        return ServiceResponse.success({
            "total_rooms": total_rooms,
            "total_tenants": total_tenants,
            "active_tenants": active_tenants,
            "total_capacity": total_capacity,
            "vacant_beds": vacant_beds,
            "occupancy_rate": occupancy_rate,
            "revenue": float(current_revenue),
            "rent_collected_this_month": float(current_revenue),
            "expenses": float(current_expenses),
            "net_profit": float(current_revenue - current_expenses),
            "pending_dues": float(pending_total),
            "overdue_amount": float(overdue_total),
            "overdue_count": overdue_count
        })

    except Exception as e:
        logger.exception(f"Fatal error fetching dashboard stats: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, f"Dashboard system error: {str(e)}")

def get_monthly_stats(user_id: str, months: int = 6):
    try:
        from dateutil.relativedelta import relativedelta
        import calendar
        
        today = date.today()
        # Ensure we start exactly at the beginning of the month for the oldest month
        start_date = (today - relativedelta(months=months-1)).replace(day=1)
        end_date = (today + relativedelta(months=1)).replace(day=1) # up to start of next month

        # 1. Fetch payments for those months
        payments_data = _safe_execute(
            "monthly_payments",
            lambda: _rows(
                supabase.table("payments")
                .select("amount_paid, payment_date")
                .gte("payment_date", start_date.isoformat())
                .lt("payment_date", end_date.isoformat())
                .eq("owner_id", user_id)
                .execute()
            ),
            [],
        )
            
        # 2. Fetch obligations (due) for those months
        obligations_data = _safe_execute(
            "monthly_obligations",
            lambda: _rows(
                supabase.table("rent_obligations")
                .select("amount, rent_month, status")
                .gte("rent_month", start_date.isoformat())
                .lt("rent_month", end_date.isoformat())
                .eq("owner_id", user_id)
                .execute()
            ),
            [],
        )

        # 3. Aggregate by month
        monthly_data = {}
        for i in range(months):
            d = today - relativedelta(months=i)
            # Short month name e.g. 'Oct'
            month_key = f"{d.year}-{d.month:02d}"
            month_name = calendar.month_abbr[d.month]
            monthly_data[month_key] = {
                "month": month_name,
                "collected": Decimal(0),
                "due": Decimal(0),
                "sort_key": month_key
            }

        # Process payments
        for p in payments_data:
            payment_date_raw = str(p.get('payment_date') or '').split('T')[0]
            if not payment_date_raw:
                continue
            p_date = date.fromisoformat(payment_date_raw)
            month_key = f"{p_date.year}-{p_date.month:02d}"
            if month_key in monthly_data:
                monthly_data[month_key]['collected'] += _to_decimal(p.get('amount_paid'))

        # Process obligations (excluding waived)
        for e in obligations_data:
            if str(e.get('status') or '').upper() == 'WAIVED':
                continue
            month_key = str(e.get('rent_month') or '').split('T')[0][:7]
            if month_key in monthly_data:
                monthly_data[month_key]['due'] += _to_decimal(e.get('amount'))

        # Convert to list and sort chronologically
        result = list(monthly_data.values())
        result.sort(key=lambda x: x['sort_key'])
        
        # Clean up Decimal to float and sort_key
        for r in result:
            collected = float(r['collected'])
            due = float(r['due'])
            r['collected'] = collected
            r['due'] = due
            # Backward compatibility keys used in old UI
            r['income'] = collected
            r['expenses'] = max(due - collected, 0)
            r['collection_rate'] = round((collected / due) * 100, 2) if due > 0 else 0
            del r['sort_key']

        return ServiceResponse.success(result)

    except Exception as e:
        logger.exception(f"Error fetching monthly stats: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, str(e))

def get_student_dashboard_stats(profile_id: str):
    """
    Fetch dashboard stats specifically for a student.
    Includes: Room details, Monthly Rent, Pending Dues, Next Payment.
    """
    try:
        # 1. Fetch Student record with Profile and Current Allocation
        student_res = supabase.table("students")\
            .select("*, profiles!students_profile_id_fkey(name, email, phone), room_allocations(*, rooms(*))")\
            .eq("profile_id", profile_id)\
            .execute()
        
        if not student_res.data:
            return ServiceResponse.not_found("Student enrollment not found for this profile.")
        
        student = student_res.data[0]
        student_id = student["id"]
        monthly_rent = Decimal(str(student.get("monthly_rent") or 0))
        
        # 2. Extract Room Info
        allocations = student.get("room_allocations", [])
        active_alloc = next((a for a in allocations if a.get("end_date") is None), None)
        room_info = active_alloc.get("rooms") if active_alloc else None
        
        # 3. Calculate Pending Dues
        obligations_res = supabase.table("rent_obligations")\
            .select("id, amount, due_date, status")\
            .eq("student_id", student_id)\
            .neq("status", "PAID")\
            .neq("status", "WAIVED")\
            .order("due_date", desc=False)\
            .execute()
            
        pending_total = Decimal(0)
        next_payment = None
        oldest_obligation_id = None
        
        if obligations_res.data:
            for ob in obligations_res.data:
                amount = Decimal(str(ob['amount']))
                # Get payments for this ob
                p_res = supabase.table("payments").select("amount_paid").eq("obligation_id", ob['id']).execute()
                paid = sum(Decimal(str(p['amount_paid'])) for p in p_res.data)
                
                due = amount - paid
                if due > 0:
                    pending_total += due
                    if not next_payment:
                        next_payment = ob['due_date']
                        oldest_obligation_id = ob['id']

        return ServiceResponse.success({
            "student_id": student_id,
            "room_no": room_info.get("room_no") if room_info else "Not Assigned",
            "room_id": room_info.get("id") if room_info else None,
            "monthly_rent": float(monthly_rent),
            "pending_dues": float(pending_total),
            "next_payment_date": next_payment or "N/A",
            "oldest_obligation_id": oldest_obligation_id,
            "status": student.get("status")
        })

    except Exception as e:
        logger.exception(f"Error fetching student dashboard stats: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, str(e))
