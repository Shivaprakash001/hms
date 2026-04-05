from collections import defaultdict
from decimal import Decimal
from typing import Optional, Dict, Any, List

from app.db import supabase
from app.utils.logger import get_logger
from app.utils.responses import ServiceResponse, ErrorCode

logger = get_logger(__name__)


def _get_floor_number(room_no: str) -> int:
    try:
        if len(room_no) >= 3 and room_no[:-2].isdigit():
            return int(room_no[:-2])
    except Exception:
        pass
    return 0


def _fetch_rooms(owner_id: Optional[str] = None, room_id: Optional[str] = None) -> List[dict]:
    query = supabase.table("rooms").select("*").order("room_no")
    if owner_id:
        query = query.eq("owner_id", owner_id)
    if room_id:
        query = query.eq("id", room_id)
    return query.execute().data or []


def _fetch_room_allocations(room_ids: List[str]) -> List[dict]:
    if not room_ids:
        return []

    return supabase.table("room_allocations")\
        .select("id, room_id, student_id, start_date, students!inner(id, monthly_rent, status, profiles!students_profile_id_fkey(id, name, email, phone))")\
        .in_("room_id", room_ids)\
        .is_("end_date", "null")\
        .execute().data or []


def _fetch_student_financials(student_ids: List[str]) -> Dict[str, Any]:
    latest_payment_by_student: Dict[str, dict] = {}
    payments_by_obligation: Dict[str, Decimal] = defaultdict(lambda: Decimal(0))
    pending_due_by_student: Dict[str, Decimal] = defaultdict(lambda: Decimal(0))
    obligations_by_student: Dict[str, List[dict]] = defaultdict(list)

    if not student_ids:
        return {
            "latest_payment_by_student": latest_payment_by_student,
            "pending_due_by_student": pending_due_by_student,
            "obligations_by_student": obligations_by_student
        }

    payments = supabase.table("payments")\
        .select("id, student_id, obligation_id, amount_paid, payment_date, payment_method, reference_number")\
        .in_("student_id", student_ids)\
        .order("payment_date", desc=True)\
        .execute().data or []

    for payment in payments:
        student_id = payment.get("student_id")
        obligation_id = payment.get("obligation_id")

        if student_id:
            if student_id not in latest_payment_by_student:
                latest_payment_by_student[student_id] = payment

        if obligation_id:
            payments_by_obligation[obligation_id] += Decimal(str(payment.get("amount_paid") or 0))

    obligations = supabase.table("rent_obligations")\
        .select("id, student_id, amount, status, rent_month, due_date")\
        .in_("student_id", student_ids)\
        .neq("status", "WAIVED")\
        .order("due_date", desc=False)\
        .execute().data or []

    for obligation in obligations:
        student_id = obligation.get("student_id")
        if not student_id:
            continue

        obligation_amount = Decimal(str(obligation.get("amount") or 0))
        paid_amount = payments_by_obligation.get(obligation.get("id"), Decimal(0))
        remaining_due = max(obligation_amount - paid_amount, Decimal(0))

        enriched = {
            **obligation,
            "remaining_due": float(remaining_due)
        }
        obligations_by_student[student_id].append(enriched)
        pending_due_by_student[student_id] += remaining_due

    return {
        "latest_payment_by_student": latest_payment_by_student,
        "pending_due_by_student": pending_due_by_student,
        "obligations_by_student": obligations_by_student
    }


def _build_room_overview(room: dict, allocations: List[dict], financials: Dict[str, Any]) -> Dict[str, Any]:
    latest_payment_by_student = financials["latest_payment_by_student"]
    pending_due_by_student = financials["pending_due_by_student"]
    obligations_by_student = financials["obligations_by_student"]

    tenants = []
    latest_payments = []

    for allocation in allocations:
        student = allocation.get("students") or {}
        profile = student.get("profiles") or {}
        student_id = student.get("id")
        pending_due = pending_due_by_student.get(student_id, Decimal(0))
        obligations = obligations_by_student.get(student_id, [])
        latest_payment = latest_payment_by_student.get(student_id)

        if pending_due <= 0:
            payment_status = "PAID" if latest_payment else "NO_HISTORY"
        elif latest_payment:
            payment_status = "PARTIAL"
        else:
            payment_status = "PENDING"

        tenant = {
            "student_id": student_id,
            "profile_id": profile.get("id"),
            "name": profile.get("name"),
            "email": profile.get("email"),
            "phone": profile.get("phone"),
            "joined_date": allocation.get("start_date"),
            "rent": float(student.get("monthly_rent") or 0),
            "payment_status": payment_status,
            "last_payment": latest_payment.get("payment_date") if latest_payment else None,
            "last_payment_amount": float(latest_payment.get("amount_paid") or 0) if latest_payment else 0,
            "pending_dues": float(pending_due),
            "status": student.get("status", "ACTIVE"),
            "obligations": obligations
        }
        tenants.append(tenant)

        if latest_payment:
            latest_payments.append({
                "student_id": student_id,
                "student_name": profile.get("name"),
                **latest_payment
            })

    tenants.sort(key=lambda item: item.get("name") or "")
    latest_payments.sort(key=lambda item: item.get("payment_date") or "", reverse=True)

    floor_number = _get_floor_number(room.get("room_no", ""))
    occupancy_count = len(tenants)
    capacity = room.get("capacity", 0) or 0

    return {
        "room": {
            "id": room.get("id"),
            "room_id": room.get("id"),
            "room_no": room.get("room_no"),
            "floor": floor_number,
            "capacity": capacity,
            "occupied": occupancy_count,
            "remaining_capacity": max(capacity - occupancy_count, 0),
            "status": "Vacant" if occupancy_count == 0 else ("Full" if occupancy_count >= capacity else "Occupied")
        },
        "tenants": tenants,
        "payments": latest_payments,
        "pending_dues": float(sum((Decimal(str(t["pending_dues"])) for t in tenants), Decimal(0)))
    }


def _build_room_overviews(rooms: List[dict]) -> List[Dict[str, Any]]:
    if not rooms:
        return []

    room_ids = [room["id"] for room in rooms]
    allocations = _fetch_room_allocations(room_ids)
    allocations_by_room: Dict[str, List[dict]] = defaultdict(list)
    student_ids: List[str] = []

    for allocation in allocations:
        room_id = allocation.get("room_id")
        student_id = allocation.get("student_id")
        if room_id:
            allocations_by_room[room_id].append(allocation)
        if student_id:
            student_ids.append(student_id)

    financials = _fetch_student_financials(student_ids)

    return [
        _build_room_overview(room, allocations_by_room.get(room["id"], []), financials)
        for room in rooms
    ]


def get_floors_with_rooms(owner_id: Optional[str] = None) -> Dict[str, Any]:
    try:
        rooms = _fetch_rooms(owner_id=owner_id)
        if not rooms:
            return ServiceResponse.success([])

        overviews = _build_room_overviews(rooms)
        floors_map: Dict[str, dict] = {}

        for overview in overviews:
            room = overview["room"]
            room_id = room["id"]
            floor_num = room["floor"]
            floor_key = f"f{floor_num}"

            if floor_key not in floors_map:
                floors_map[floor_key] = {"id": floor_key, "number": floor_num, "rooms": []}

            floors_map[floor_key]["rooms"].append({
                "id": room_id,
                "room_id": room_id,
                "number": room["room_no"],
                "room_no": room["room_no"],
                "capacity": room["capacity"],
                "occupied": room["occupied"],
                "floor": floor_num,
                "status": room["status"],
                "tenants": overview["tenants"],
                "pending_dues": overview["pending_dues"],
                "payments": overview["payments"]
            })

        return ServiceResponse.success(sorted(floors_map.values(), key=lambda item: item["number"]))
    except Exception as e:
        logger.exception(f"Error fetching floors: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, str(e))


def get_all_rooms(limit: int = 50, offset: int = 0, owner_id: Optional[str] = None) -> Dict[str, Any]:
    try:
        query = supabase.table("rooms")\
            .select("*", count="exact")\
            .order("room_no")\
            .limit(limit)\
            .offset(offset)

        if owner_id:
            query = query.eq("owner_id", owner_id)

        result = query.execute()
        rooms = result.data or []
        overviews = _build_room_overviews(rooms)

        compact_rooms = []
        for overview in overviews:
            compact_rooms.append({
                **overview["room"],
                "tenants": overview["tenants"],
                "pending_dues": overview["pending_dues"]
            })

        return ServiceResponse.success({
            "rooms": compact_rooms,
            "total": result.count if hasattr(result, "count") else len(compact_rooms)
        })
    except Exception as e:
        logger.exception(f"Error fetching rooms: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, str(e))


def create_room(data: dict) -> Dict[str, Any]:
    try:
        existing_query = supabase.table("rooms").select("id").eq("room_no", data["room_no"])
        if data.get("owner_id"):
            existing_query = existing_query.eq("owner_id", data["owner_id"])
        existing = existing_query.execute()
        if existing.data:
            return ServiceResponse.error(ErrorCode.RESOURCE_ALREADY_EXISTS, f"Room {data['room_no']} already exists")

        result = supabase.table("rooms").insert(data).execute()
        if not result.data:
            return ServiceResponse.error(ErrorCode.DB_002, "Failed to create room")
        return ServiceResponse.success(result.data[0], "Room created successfully")
    except Exception as e:
        logger.exception(f"Error creating room: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, str(e))


def get_room(room_id: str, owner_id: Optional[str] = None) -> Dict[str, Any]:
    try:
        rooms = _fetch_rooms(owner_id=owner_id, room_id=room_id)
        if not rooms:
            return ServiceResponse.not_found("Room")
        return ServiceResponse.success(rooms[0])
    except Exception as e:
        logger.exception(f"Error fetching room: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, str(e))


def get_room_overview(room_id: str, owner_id: Optional[str] = None) -> Dict[str, Any]:
    try:
        rooms = _fetch_rooms(owner_id=owner_id, room_id=room_id)
        if not rooms:
            return ServiceResponse.not_found("Room")

        overview = _build_room_overviews(rooms)[0]
        return ServiceResponse.success(overview)
    except Exception as e:
        logger.exception(f"Error fetching room overview: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, str(e))


def update_room(room_id: str, data: dict) -> Dict[str, Any]:
    try:
        result = supabase.table("rooms").update(data).eq("id", room_id).execute()
        if not result.data:
            return ServiceResponse.not_found("Room")
        return ServiceResponse.success(result.data[0], "Room updated successfully")
    except Exception as e:
        logger.exception(f"Error updating room: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, str(e))


def delete_room(room_id: str) -> Dict[str, Any]:
    try:
        result = supabase.table("rooms").delete().eq("id", room_id).execute()
        if not result.data:
            return ServiceResponse.not_found("Room")
        return ServiceResponse.success(None, "Room deleted successfully")
    except Exception as e:
        logger.exception(f"Error deleting room: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, str(e))
