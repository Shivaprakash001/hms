from app.db import supabase
from app.utils.responses import ServiceResponse, ErrorCode
from app.utils.logger import get_logger
from datetime import date
from decimal import Decimal

logger = get_logger(__name__)

def get_dashboard_stats(user_id: str):
    try:
        today = date.today()
        month_start = today.replace(day=1)
        # next month calculation
        if today.month == 12:
            next_month = today.replace(year=today.year + 1, month=1, day=1)
        else:
            next_month = today.replace(month=today.month + 1, day=1)
        
        # 1. Base query for owner's students
        all_owner_students = supabase.table("students").select("id, status").eq("owner_id", user_id).execute()
        all_student_ids = [s['id'] for s in all_owner_students.data]
        active_tenants = len([s for s in all_owner_students.data if s['status'] == 'ACTIVE'])

        # 2. Total Capacity
        rooms_res = supabase.table("rooms").select("capacity").eq("owner_id", user_id).execute()
        total_capacity = sum(r['capacity'] for r in rooms_res.data)
        
        occupancy_rate = 0
        if total_capacity > 0:
            # We should probably count occupied beds properly via allocations, but active students is a good proxy for now
            # Actually, let's use allocations for accuracy if possible, but active students is faster.
            # Logic: Active students = Active allocations usually.
            occupancy_rate = round((active_tenants / total_capacity) * 100)

        # 3. Revenue (Current Month)
        payments_res = supabase.table("payments")\
            .select("amount_paid")\
            .gte("payment_date", month_start.isoformat())\
            .lt("payment_date", next_month.isoformat())\
            .eq("owner_id", user_id)\
            .execute()

        current_revenue = sum(Decimal(str(p['amount_paid'])) for p in payments_res.data)

        # 4. Expenses (Current Month)
        expenses_res = supabase.table("expenses")\
            .select("amount")\
            .gte("date", month_start.isoformat())\
            .lt("date", next_month.isoformat())\
            .eq("owner_id", user_id)\
            .execute()
            
        current_expenses = sum(Decimal(str(e['amount'])) for e in expenses_res.data)

        # 5. Pending Dues
        if not all_student_ids:
            pending_total = Decimal(0)
            obligations_res_data = []
        else:
            obligations_res = supabase.table("rent_obligations")\
                .select("id, amount")\
                .neq("status", "PAID")\
                .neq("status", "WAIVED")\
                .in_("student_id", all_student_ids)\
                .execute()
            obligations_res_data = obligations_res.data
            
        pending_total = Decimal(0)
        for ob in obligations_res_data:
            amount = Decimal(str(ob['amount']))
            # Get payments for this ob
            p_res = supabase.table("payments").select("amount_paid").eq("obligation_id", ob['id']).execute()
            paid = sum(Decimal(str(p['amount_paid'])) for p in p_res.data)
            pending_total += (amount - paid)

        return ServiceResponse.success({
            "active_tenants": active_tenants,
            "total_capacity": total_capacity,
            "occupancy_rate": occupancy_rate,
            "revenue": float(current_revenue),
            "expenses": float(current_expenses),
            "net_profit": float(current_revenue - current_expenses),
            "pending_dues": float(pending_total)
        })

    except Exception as e:
        logger.exception(f"Error fetching dashboard stats: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, str(e))

def get_monthly_stats(user_id: str, months: int = 6):
    try:
        from dateutil.relativedelta import relativedelta
        import calendar
        
        today = date.today()
        # Ensure we start exactly at the beginning of the month for the oldest month
        start_date = (today - relativedelta(months=months-1)).replace(day=1)
        end_date = (today + relativedelta(months=1)).replace(day=1) # up to start of next month

        # 1. Fetch payments for those months
        payments_res = supabase.table("payments")\
            .select("amount_paid, payment_date")\
            .gte("payment_date", start_date.isoformat())\
            .lt("payment_date", end_date.isoformat())\
            .execute()
            
        # 2. Fetch expenses for those months
        expenses_res = supabase.table("expenses")\
            .select("amount, date")\
            .gte("date", start_date.isoformat())\
            .lt("date", end_date.isoformat())\
            .eq("owner_id", user_id)\
            .execute()

        # 3. Aggregate by month
        monthly_data = {}
        for i in range(months):
            d = today - relativedelta(months=i)
            # Short month name e.g. 'Oct'
            month_key = f"{d.year}-{d.month:02d}"
            month_name = calendar.month_abbr[d.month]
            monthly_data[month_key] = {
                "month": month_name,
                "income": Decimal(0),
                "expenses": Decimal(0),
                "sort_key": month_key
            }

        # Process payments
        for p in payments_res.data:
            p_date = date.fromisoformat(p['payment_date'].split('T')[0])
            month_key = f"{p_date.year}-{p_date.month:02d}"
            if month_key in monthly_data:
                monthly_data[month_key]['income'] += Decimal(str(p['amount_paid']))

        # Process expenses
        for e in expenses_res.data:
            e_date = date.fromisoformat(e['date'].split('T')[0])
            month_key = f"{e_date.year}-{e_date.month:02d}"
            if month_key in monthly_data:
                monthly_data[month_key]['expenses'] += Decimal(str(e['amount']))

        # Convert to list and sort chronologically
        result = list(monthly_data.values())
        result.sort(key=lambda x: x['sort_key'])
        
        # Clean up Decimal to float and sort_key
        for r in result:
            r['income'] = float(r['income'])
            r['expenses'] = float(r['expenses'])
            del r['sort_key']

        return ServiceResponse.success(result)

    except Exception as e:
        logger.exception(f"Error fetching monthly stats: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, str(e))
