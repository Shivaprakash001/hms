from datetime import date, datetime
from typing import Any, Dict, List, Optional

from app.db import supabase
from app.utils.logger import get_logger
from app.utils.responses import ErrorCode, ServiceResponse

logger = get_logger(__name__)


def _to_datetime(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    raw = str(value).replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(raw)
    except Exception:
        return None


def _to_date(value: Any) -> Optional[date]:
    dt = _to_datetime(value)
    if dt:
        return dt.date()
    if not value:
        return None
    try:
        return date.fromisoformat(str(value).split("T")[0])
    except Exception:
        return None


def _matches_search(event: Dict[str, Any], search: Optional[str]) -> bool:
    if not search:
        return True
    q = search.strip().lower()
    if not q:
        return True
    haystack = " ".join(
        [
            str(event.get("title") or ""),
            str(event.get("detail") or ""),
            str(event.get("tenant_name") or ""),
            str(event.get("room_no") or ""),
            str(event.get("event_type") or ""),
        ]
    ).lower()
    return q in haystack


def _in_date_range(event_day: Optional[date], start_date: Optional[date], end_date: Optional[date]) -> bool:
    if not event_day:
        return False
    if start_date and event_day < start_date:
        return False
    if end_date and event_day > end_date:
        return False
    return True


def get_owner_activity(
    user_id: str,
    search: Optional[str] = None,
    event_type: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = 20,
    offset: int = 0,
) -> Dict[str, Any]:
    try:
        normalized_type = (event_type or "").strip().upper() or None
        events: List[Dict[str, Any]] = []

        # Payments
        if normalized_type in (None, "PAYMENT_RECEIVED"):
            payments_q = (
                supabase.table("payments")
                .select("id, amount_paid, payment_date, payment_method, reference_number, created_at, students(profiles!students_profile_id_fkey(name))")
                .eq("owner_id", user_id)
                .order("payment_date", desc=True)
            )
            if start_date:
                payments_q = payments_q.gte("payment_date", start_date.isoformat())
            if end_date:
                payments_q = payments_q.lte("payment_date", end_date.isoformat())

            payments_res = payments_q.limit(400).execute()
            for p in payments_res.data or []:
                event_at = _to_datetime(p.get("payment_date") or p.get("created_at"))
                event_day = event_at.date() if event_at else None
                if not _in_date_range(event_day, start_date, end_date):
                    continue
                
                amount = float(p.get("amount_paid") or 0)
                method = p.get("payment_method") or "payment"
                ref = p.get("reference_number")
                
                # Extract name from join
                tenant_name = "Tenant"
                stu_obj = p.get("students")
                if stu_obj:
                    # Handle both list and object results from supabase
                    prof = stu_obj.get("profiles") if isinstance(stu_obj, dict) else None
                    if prof:
                        tenant_name = prof.get("name") or "Tenant"

                detail = f"Received ₹{amount:,.0f} via {method}"
                if ref:
                    detail = f"{detail} (Ref: {ref})"
                events.append(
                    {
                        "id": f"payment_{p.get('id')}",
                        "event_type": "PAYMENT_RECEIVED",
                        "title": "Payment Received",
                        "detail": detail,
                        "tenant_name": tenant_name,
                        "room_no": None,
                        "amount": amount,
                        "event_at": event_at.isoformat() if event_at else None,
                    }
                )

        # Allocation lifecycle events
        if normalized_type in (None, "TENANT_JOINED", "TENANT_LEFT"):
            allocations_res = (
                supabase.table("room_allocations")
                .select("id, start_date, end_date, students(owner_id, profiles!students_profile_id_fkey(name)), rooms(room_no)")
                .order("start_date", desc=True)
                .limit(600)
                .execute()
            )

            for a in allocations_res.data or []:
                student_obj = a.get("students") or {}
                if str(student_obj.get("owner_id") or "") != str(user_id):
                    continue

                tenant_name = ((student_obj.get("profiles") or {}).get("name") or "Tenant")
                room_no = (a.get("rooms") or {}).get("room_no")

                if normalized_type in (None, "TENANT_JOINED"):
                    joined_day = _to_date(a.get("start_date"))
                    if _in_date_range(joined_day, start_date, end_date):
                        joined_at = _to_datetime(a.get("start_date"))
                        
                        # Fix nested data access
                        tenant_name = "Tenant"
                        stu_obj = a.get("students")
                        if stu_obj:
                            prof = stu_obj.get("profiles")
                            if prof:
                                tenant_name = prof.get("name") or "Tenant"
                        
                        room_no = (a.get("rooms") or {}).get("room_no")

                        events.append(
                            {
                                "id": f"join_{a.get('id')}",
                                "event_type": "TENANT_JOINED",
                                "title": "Tenant Joined",
                                "detail": f"{tenant_name} moved into Room {room_no or 'N/A'}",
                                "tenant_name": tenant_name,
                                "room_no": room_no,
                                "amount": None,
                                "event_at": (joined_at.isoformat() if joined_at else f"{joined_day.isoformat()}T00:00:00"),
                            }
                        )

                if normalized_type in (None, "TENANT_LEFT") and a.get("end_date"):
                    left_day = _to_date(a.get("end_date"))
                    if _in_date_range(left_day, start_date, end_date):
                        left_at = _to_datetime(a.get("end_date"))
                        events.append(
                            {
                                "id": f"left_{a.get('id')}",
                                "event_type": "TENANT_LEFT",
                                "title": "Tenant Left",
                                "detail": f"{tenant_name} left Room {room_no or 'N/A'}",
                                "tenant_name": tenant_name,
                                "room_no": room_no,
                                "amount": None,
                                "event_at": (left_at.isoformat() if left_at else f"{left_day.isoformat()}T00:00:00"),
                            }
                        )

        # Search filter
        filtered = [e for e in events if _matches_search(e, search)]

        # Sort newest first
        filtered.sort(key=lambda e: e.get("event_at") or "", reverse=True)

        total = len(filtered)
        items = filtered[offset: offset + limit]

        return ServiceResponse.success(
            {
                "items": items,
                "total": total,
                "limit": limit,
                "offset": offset,
            }
        )
    except Exception as exc:
        logger.exception(f"Error fetching owner activity: {exc}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, str(exc))
