from typing import Dict, Any, Optional, List

from app.db import supabase
from app.utils.responses import ServiceResponse, ErrorCode
from app.utils.logger import get_logger

logger = get_logger(__name__)


DEFAULT_STARTER_PLAN = {
    "id": None,
    "code": "STARTER",
    "name": "Starter",
    "price": 0,
    "currency": "INR",
    "room_limit": 50,
    "hostel_limit": 1,
    "storage_limit_mb": 500,
    "features": ["1 Hostel", "50 Rooms"],
    "is_active": True,
}


def _safe_count(table: str, owner_id: str, extra_filters: Optional[List[dict]] = None) -> int:
    try:
        query = supabase.table(table).select("id", count="exact")
        query = query.eq("owner_id", owner_id)
        for f in (extra_filters or []):
            if f.get("op") == "neq":
                query = query.neq(f["field"], f["value"])
            elif f.get("op") == "eq":
                query = query.eq(f["field"], f["value"])

        res = query.execute()
        if isinstance(getattr(res, "count", None), int):
            return res.count
        return len(res.data or [])
    except Exception as e:
        logger.warning(f"Count query failed for {table}: {e}")
        return 0


def _compute_owner_usage(owner_id: str, room_limit: Optional[int], hostel_limit: Optional[int], storage_limit_mb: Optional[int]) -> Dict[str, Any]:
    rooms_used = _safe_count("rooms", owner_id)
    tenants_used = _safe_count("students", owner_id, [{"op": "neq", "field": "status", "value": "LEFT"}])
    hostels_used = _safe_count("hostels", owner_id, [{"op": "eq", "field": "is_active", "value": True}])

    # MVP placeholder until storage accounting is wired from Supabase Storage metadata
    storage_used_mb = 10

    return {
        "rooms": {
            "used": rooms_used,
            "limit": room_limit,
        },
        "tenants": {
            "used": tenants_used,
            "limit": None,
        },
        "hostels": {
            "used": hostels_used,
            "limit": hostel_limit,
        },
        "storage": {
            "used_mb": storage_used_mb,
            "limit_mb": storage_limit_mb or 500,
        }
    }


def list_plans() -> Dict[str, Any]:
    try:
        res = supabase.table("plans") \
            .select("id, code, name, price, currency, room_limit, hostel_limit, storage_limit_mb, features, is_active, display_order") \
            .eq("is_active", True) \
            .order("display_order") \
            .execute()

        plans = res.data or []
        if not plans:
            plans = [DEFAULT_STARTER_PLAN]

        return ServiceResponse.success(plans)
    except Exception as e:
        logger.exception(f"Error fetching plans: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to fetch plans", str(e))


def ensure_owner_starter_subscription(owner_id: str) -> Dict[str, Any]:
    """
    Ensure each owner has at least one subscription row.
    Safe to call multiple times.
    """
    try:
        existing = supabase.table("owner_subscriptions") \
            .select("id") \
            .eq("owner_id", owner_id) \
            .limit(1) \
            .execute()

        if existing.data:
            return ServiceResponse.success(existing.data[0], "Subscription already exists")

        starter = supabase.table("plans") \
            .select("id") \
            .eq("code", "STARTER") \
            .eq("is_active", True) \
            .limit(1) \
            .execute()

        if not starter.data:
            return ServiceResponse.validation_error("Starter plan not found")

        payload = {
            "owner_id": owner_id,
            "plan_id": starter.data[0]["id"],
            "status": "FREE",
        }
        created = supabase.table("owner_subscriptions").insert(payload).execute()
        if not created.data:
            return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to create starter subscription")

        return ServiceResponse.success(created.data[0], "Starter subscription created")
    except Exception as e:
        logger.warning(f"Starter subscription ensure skipped: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to ensure starter subscription", str(e))


def get_owner_subscription(owner_id: str) -> Dict[str, Any]:
    try:
        current_subscription = None
        current_plan = DEFAULT_STARTER_PLAN.copy()

        # Active subscription (joined with plan in one query when possible)
        sub_res = supabase.table("owner_subscriptions") \
            .select("status, start_date, next_billing_date, payment_method_type, payment_method_last4, payment_upi_id, plans:plan_id(id, code, name, price, currency, room_limit, hostel_limit, storage_limit_mb, features, is_active)") \
            .eq("owner_id", owner_id) \
            .in_("status", ["TRIAL", "ACTIVE", "FREE"]) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()

        if sub_res.data:
            current_subscription = sub_res.data[0]
            joined_plan = current_subscription.get("plans")
            if isinstance(joined_plan, list):
                joined_plan = joined_plan[0] if joined_plan else None
            if joined_plan:
                current_plan = joined_plan

        # If no active subscription row, try DB starter plan first
        if not current_subscription:
            starter_res = supabase.table("plans") \
                .select("id, code, name, price, currency, room_limit, hostel_limit, storage_limit_mb, features, is_active") \
                .eq("code", "STARTER") \
                .eq("is_active", True) \
                .limit(1) \
                .execute()
            if starter_res.data:
                current_plan = starter_res.data[0]

        room_limit = current_plan.get("room_limit")
        hostel_limit = current_plan.get("hostel_limit")
        storage_limit_mb = current_plan.get("storage_limit_mb") or 500
        usage = _compute_owner_usage(owner_id, room_limit, hostel_limit, storage_limit_mb)

        # Recent billing history (if table has data)
        history = []
        try:
            inv_res = supabase.table("owner_invoices") \
                .select("id, invoice_number, amount, currency, status, billing_month, created_at, pdf_url") \
                .eq("owner_id", owner_id) \
                .order("created_at", desc=True) \
                .limit(5) \
                .execute()
            history = inv_res.data or []
        except Exception as inv_err:
            logger.warning(f"Invoice history fetch skipped: {inv_err}")

        # Payment method placeholder (future Razorpay)
        payment_method = {
            "type": None,
            "label": "No payment method added"
        }
        if current_subscription:
            pm_type = current_subscription.get("payment_method_type")
            pm_last4 = current_subscription.get("payment_method_last4")
            pm_upi = current_subscription.get("payment_upi_id")
            if pm_type == "CARD" and pm_last4:
                payment_method = {"type": "CARD", "label": f"Card ending in {pm_last4}"}
            elif pm_type == "UPI" and pm_upi:
                payment_method = {"type": "UPI", "label": f"UPI: {pm_upi}"}

        data = {
            "current_plan": {
                "name": current_plan.get("name", "Starter"),
                "code": current_plan.get("code", "STARTER"),
                "price": current_plan.get("price", 0),
                "currency": current_plan.get("currency", "INR"),
                "room_limit": room_limit,
                "hostel_limit": hostel_limit,
                "next_billing_date": current_subscription.get("next_billing_date") if current_subscription else None,
            },
            "usage": {
                **usage
            },
            "subscription": {
                "status": (current_subscription or {}).get("status", "FREE"),
                "start_date": (current_subscription or {}).get("start_date"),
                "next_billing_date": (current_subscription or {}).get("next_billing_date"),
                "renewal_required": bool((current_subscription or {}).get("next_billing_date")),
            },
            "billing_history": history,
            "payment_method": payment_method,
        }

        return ServiceResponse.success(data)
    except Exception as e:
        logger.exception(f"Error fetching owner subscription: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to fetch subscription", str(e))


def get_owner_usage(owner_id: str) -> Dict[str, Any]:
    try:
        room_limit = DEFAULT_STARTER_PLAN["room_limit"]
        hostel_limit = DEFAULT_STARTER_PLAN["hostel_limit"]
        storage_limit_mb = DEFAULT_STARTER_PLAN["storage_limit_mb"]

        sub_res = supabase.table("owner_subscriptions") \
            .select("plans:plan_id(room_limit, hostel_limit, storage_limit_mb)") \
            .eq("owner_id", owner_id) \
            .in_("status", ["TRIAL", "ACTIVE", "FREE"]) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()

        if sub_res.data:
            joined_plan = sub_res.data[0].get("plans")
            if isinstance(joined_plan, list):
                joined_plan = joined_plan[0] if joined_plan else None
            if joined_plan:
                room_limit = joined_plan.get("room_limit")
                hostel_limit = joined_plan.get("hostel_limit")
                storage_limit_mb = joined_plan.get("storage_limit_mb") or DEFAULT_STARTER_PLAN["storage_limit_mb"]

        usage = _compute_owner_usage(owner_id, room_limit, hostel_limit, storage_limit_mb)
        return ServiceResponse.success(usage)
    except Exception as e:
        logger.exception(f"Error fetching owner usage: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to fetch usage", str(e))
