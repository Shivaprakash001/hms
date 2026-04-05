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


def get_owner_subscription(owner_id: str) -> Dict[str, Any]:
    try:
        current_subscription = None
        current_plan = DEFAULT_STARTER_PLAN.copy()

        # Active subscription, if available
        sub_res = supabase.table("owner_subscriptions") \
            .select("*") \
            .eq("owner_id", owner_id) \
            .in_("status", ["TRIAL", "ACTIVE"]) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()

        if sub_res.data:
            current_subscription = sub_res.data[0]
            plan_id = current_subscription.get("plan_id")
            if plan_id:
                plan_res = supabase.table("plans") \
                    .select("id, code, name, price, currency, room_limit, hostel_limit, storage_limit_mb, features, is_active") \
                    .eq("id", plan_id) \
                    .limit(1) \
                    .execute()
                if plan_res.data:
                    current_plan = plan_res.data[0]

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

        # Usage (lightweight counts)
        rooms_used = _safe_count("rooms", owner_id)
        tenants_used = _safe_count("students", owner_id, [{"op": "neq", "field": "status", "value": "LEFT"}])
        hostels_used = _safe_count("hostels", owner_id, [{"op": "eq", "field": "is_active", "value": True}])

        # Storage: keep placeholder-friendly for MVP
        storage_used_mb = 10
        storage_limit_mb = current_plan.get("storage_limit_mb") or 500

        room_limit = current_plan.get("room_limit")
        hostel_limit = current_plan.get("hostel_limit")

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
                    "limit_mb": storage_limit_mb,
                }
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
