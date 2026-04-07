import os
import time
from typing import Dict, Any, List
from app.db import supabase
from app.utils.responses import ServiceResponse, ErrorCode
from app.utils.logger import get_logger

logger = get_logger(__name__)

DEFAULT_PREFERENCES = {
    "currency": "INR",
    "rent_cycle": "MONTHLY",
    "receipt_prefix": "HMS",
    "timezone": "Asia/Kolkata",
    "auto_rent_day": 1,
}

HOSTEL_ASSETS_BUCKET = os.getenv("HOSTEL_ASSETS_BUCKET", "hostel-assets")
MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024
ALLOWED_LOGO_CONTENT_TYPES = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
}


def _escape_ilike(value: str) -> str:
    return value.replace('%', '\\%').replace('_', '\\_')


def _normalize_hostel_row(row: dict) -> dict:
    return {
        "name": row.get("name"),
        "phone": row.get("phone"),
        "address": row.get("address"),
        "city": row.get("city"),
        "state": row.get("state"),
        "pincode": row.get("pincode"),
        "upi_id": row.get("upi_id"),
        "gst_number": row.get("gst_number"),
        "currency": row.get("currency"),
        "rent_cycle": row.get("rent_cycle"),
        "receipt_prefix": row.get("receipt_prefix"),
        "timezone": row.get("timezone"),
        "auto_rent_day": row.get("auto_rent_day"),
        "logo_url": row.get("logo_url"),
    }


def _extract_public_url(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        data = value.get("data") if isinstance(value.get("data"), dict) else {}
        return (
            value.get("publicURL")
            or value.get("publicUrl")
            or data.get("publicURL")
            or data.get("publicUrl")
            or ""
        )
    return ""


def get_owner_profile(user_id: str) -> Dict[str, Any]:
    try:
        prof_res = supabase.table("profiles") \
            .select("id, name, email, phone, role") \
            .eq("id", user_id) \
            .eq("is_active", True) \
            .execute()

        if not prof_res.data:
            return ServiceResponse.not_found("Owner profile")

        owner = prof_res.data[0]

        hostel = {
            "name": None,
            "phone": None,
            "address": None,
            "city": None,
            "state": None,
            "pincode": None,
            "upi_id": None,
            "gst_number": None,
            "currency": None,
            "rent_cycle": None,
            "receipt_prefix": None,
            "timezone": None,
            "auto_rent_day": None,
            "logo_url": None,
        }

        try:
            h_res = supabase.table("hostels") \
                .select("*") \
                .eq("owner_id", user_id) \
                .eq("is_active", True) \
                .limit(1) \
                .execute()
            if h_res.data:
                hostel = _normalize_hostel_row(h_res.data[0])
        except Exception as hostel_err:
            logger.warning(f"Hostels table unavailable or query failed: {hostel_err}")

        return ServiceResponse.success({
            "owner": owner,
            "hostel": {
                "name": hostel.get("name"),
                "phone": hostel.get("phone"),
                "address": hostel.get("address"),
                "city": hostel.get("city"),
                "state": hostel.get("state"),
                "pincode": hostel.get("pincode"),
                "upi_id": hostel.get("upi_id"),
                "gst_number": hostel.get("gst_number"),
                "logo_url": hostel.get("logo_url"),
            },
            "preferences": {
                "currency": hostel.get("currency") or DEFAULT_PREFERENCES["currency"],
                "rent_cycle": hostel.get("rent_cycle") or DEFAULT_PREFERENCES["rent_cycle"],
                "receipt_prefix": hostel.get("receipt_prefix") or DEFAULT_PREFERENCES["receipt_prefix"],
                "timezone": hostel.get("timezone") or DEFAULT_PREFERENCES["timezone"],
                "auto_rent_day": hostel.get("auto_rent_day") or DEFAULT_PREFERENCES["auto_rent_day"],
            }
        })
    except Exception as e:
        logger.exception(f"Error fetching owner profile: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to fetch owner profile", str(e))


def update_owner_profile(user_id: str, data: dict) -> Dict[str, Any]:
    try:
        allowed = {"name", "phone"}
        update_data = {k: v for k, v in data.items() if k in allowed and v is not None}
        if not update_data:
            return ServiceResponse.validation_error("No valid fields to update")

        res = supabase.table("profiles") \
            .update(update_data) \
            .eq("id", user_id) \
            .eq("is_active", True) \
            .execute()

        if not res.data:
            return ServiceResponse.not_found("Owner profile")

        return get_owner_profile(user_id)
    except Exception as e:
        logger.exception(f"Error updating owner profile: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to update owner profile", str(e))


def update_owner_hostel(user_id: str, data: dict) -> Dict[str, Any]:
    try:
        mapped = {
            "name": data.get("name") if data.get("name") is not None else data.get("hostel_name"),
            "phone": data.get("phone") if data.get("phone") is not None else data.get("hostel_phone"),
            "address": data.get("address"),
            "city": data.get("city"),
            "state": data.get("state"),
            "pincode": data.get("pincode"),
            "upi_id": data.get("upi_id"),
            "gst_number": data.get("gst_number"),
        }
        update_data = {k: v for k, v in mapped.items() if v is not None}
        if not update_data:
            return ServiceResponse.validation_error("No valid hostel fields to update")

        try:
            existing = supabase.table("hostels") \
                .select("id") \
                .eq("owner_id", user_id) \
                .limit(1) \
                .execute()

            if existing.data:
                hostel_id = existing.data[0]["id"]
                res = supabase.table("hostels") \
                    .update(update_data) \
                    .eq("id", hostel_id) \
                    .execute()
            else:
                payload = {"owner_id": user_id, "is_active": True, **update_data}
                res = supabase.table("hostels").insert(payload).execute()

            if not res.data:
                return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to save hostel details")
        except Exception as hostel_err:
            logger.exception(f"Error saving hostels row: {hostel_err}")
            return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Hostel details storage is unavailable", str(hostel_err))

        return get_owner_profile(user_id)
    except Exception as e:
        logger.exception(f"Error updating owner hostel details: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to update hostel details", str(e))


def update_owner_preferences(user_id: str, data: dict) -> Dict[str, Any]:
    try:
        allowed = {"currency", "rent_cycle", "receipt_prefix", "timezone", "auto_rent_day"}
        update_data = {k: v for k, v in data.items() if k in allowed and v is not None}
        if not update_data:
            return ServiceResponse.validation_error("No valid preference fields to update")

        try:
            existing = supabase.table("hostels") \
                .select("id") \
                .eq("owner_id", user_id) \
                .eq("is_active", True) \
                .limit(1) \
                .execute()

            if not existing.data:
                return ServiceResponse.validation_error("Please complete Hostel Details before setting preferences")

            hostel_id = existing.data[0]["id"]
            res = supabase.table("hostels") \
                .update(update_data) \
                .eq("id", hostel_id) \
                .execute()

            if not res.data:
                return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to save preferences")

        except Exception as pref_err:
            logger.exception(f"Error saving hostel preferences: {pref_err}")
            return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Preferences storage is unavailable", str(pref_err))

        return get_owner_profile(user_id)
    except Exception as e:
        logger.exception(f"Error updating owner preferences: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to update owner preferences", str(e))


def search_tenants(user_id: str, query: str, limit: int = 10) -> Dict[str, Any]:
    try:
        search_term = (query or "").strip()
        if len(search_term) < 2:
            return ServiceResponse.success([])

        safe_limit = max(1, min(limit, 10))
        like_term = f"%{_escape_ilike(search_term)}%"

        profile_map = {}
        for field in ("name", "email", "phone"):
            profile_matches = supabase.table("profiles") \
                .select("id, name, email, phone") \
                .ilike(field, like_term) \
                .limit(25) \
                .execute()

            for row in (profile_matches.data or []):
                profile_map[row["id"]] = {
                    "id": row.get("id"),
                    "name": row.get("name") or "Unknown",
                    "email": row.get("email"),
                    "phone": row.get("phone")
                }

        profile_ids = list(profile_map.keys())

        students: List[dict] = []
        seen_student_ids = set()

        if profile_ids:
            student_result = supabase.table("students") \
                .select("id, profile_id, owner_id, roll_number, year_of_study, room_allocations(end_date, rooms(room_no))") \
                .eq("owner_id", user_id) \
                .in_("profile_id", profile_ids) \
                .limit(25) \
                .execute()

            for student in (student_result.data or []):
                seen_student_ids.add(student.get("id"))
                students.append(student)

        room_matches = supabase.table("rooms") \
            .select("id, room_no") \
            .ilike("room_no", like_term) \
            .limit(10) \
            .execute()

        room_ids = [room.get("id") for room in (room_matches.data or []) if room.get("id")]
        if room_ids:
            allocation_result = supabase.table("room_allocations") \
                .select("student_id, room_id, end_date, students(id, profile_id, owner_id), rooms(room_no)") \
                .in_("room_id", room_ids) \
                .is_("end_date", "null") \
                .limit(25) \
                .execute()

            for allocation in (allocation_result.data or []):
                student = allocation.get("students") or {}
                student_id = student.get("id")
                if not student_id or student.get("owner_id") != user_id or student_id in seen_student_ids:
                    continue

                students.append({
                    "id": student_id,
                    "profile_id": student.get("profile_id"),
                    "roll_number": student.get("roll_number"),
                    "year_of_study": student.get("year_of_study"),
                    "room_allocations": [{
                        "end_date": allocation.get("end_date"),
                        "rooms": allocation.get("rooms")
                    }]
                })
                seen_student_ids.add(student_id)

        normalized_query = search_term.lower()
        results = []
        for student in students:
            profile = profile_map.get(student.get("profile_id"))
            if not profile:
                profile_result = supabase.table("profiles") \
                    .select("id, name, email, phone") \
                    .eq("id", student.get("profile_id")) \
                    .limit(1) \
                    .execute()
                if profile_result.data:
                    profile = profile_result.data[0]
                    profile_map[student.get("profile_id")] = profile
                else:
                    profile = {"name": "Unknown", "email": None, "phone": None}

            active_room = next(
                (allocation.get("rooms") for allocation in (student.get("room_allocations") or []) if allocation.get("end_date") is None),
                None
            ) or {}
            room_no = active_room.get("room_no")

            score = 0
            name = (profile.get("name") or "").lower()
            email = (profile.get("email") or "").lower()
            phone = str(profile.get("phone") or "").lower()
            room = str(room_no or "").lower()
            roll_number = str(student.get("roll_number") or "").lower()

            if name.startswith(normalized_query):
                score += 5
            elif normalized_query in name:
                score += 3
            if room.startswith(normalized_query):
                score += 4
            elif normalized_query in room:
                score += 2
            if phone.startswith(normalized_query):
                score += 3
            elif normalized_query in phone:
                score += 1
            if email.startswith(normalized_query):
                score += 2
            elif normalized_query in email:
                score += 1
            if roll_number.startswith(normalized_query):
                score += 4
            elif normalized_query in roll_number:
                score += 2

            results.append({
                "id": student.get("id"),
                "name": profile.get("name") or "Unknown",
                "phone": profile.get("phone"),
                "email": profile.get("email"),
                "room": room_no,
                "roll_number": student.get("roll_number"),
                "year_of_study": student.get("year_of_study"),
                "_score": score
            })

        deduped = {}
        for item in results:
            existing = deduped.get(item["id"])
            if not existing or item["_score"] > existing["_score"]:
                deduped[item["id"]] = item

        sorted_results = sorted(
            deduped.values(),
            key=lambda item: (-item["_score"], item["name"].lower(), str(item.get("room") or ""))
        )[:safe_limit]

        return ServiceResponse.success([
            {
                "id": item["id"],
                "name": item["name"],
                "phone": item["phone"],
                "email": item["email"],
                "room": item["room"],
                "roll_number": item.get("roll_number"),
                "year_of_study": item.get("year_of_study")
            }
            for item in sorted_results
        ])
    except Exception as e:
        logger.exception(f"Error searching owner tenants: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to search tenants", str(e))


def upload_hostel_logo(user_id: str, file_bytes: bytes, content_type: str | None) -> Dict[str, Any]:
    try:
        if not file_bytes:
            return ServiceResponse.validation_error("Logo file is empty")

        if len(file_bytes) > MAX_LOGO_SIZE_BYTES:
            return ServiceResponse.validation_error("Logo file must be 2MB or smaller")

        normalized_content_type = (content_type or "").lower()
        ext = ALLOWED_LOGO_CONTENT_TYPES.get(normalized_content_type)
        if not ext:
            return ServiceResponse.validation_error("Only PNG, JPG, or WEBP logo files are supported")

        hostel_row = supabase.table("hostels") \
            .select("id") \
            .eq("owner_id", user_id) \
            .eq("is_active", True) \
            .limit(1) \
            .execute()

        if hostel_row.data:
            hostel_id = hostel_row.data[0]["id"]
        else:
            create_res = supabase.table("hostels").insert({
                "owner_id": user_id,
                "is_active": True,
            }).execute()
            if not create_res.data:
                return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to prepare hostel record for logo upload")
            hostel_id = create_res.data[0]["id"]

        for existing_ext in ("png", "jpg", "webp"):
            if existing_ext != ext:
                stale_path = f"{user_id}/logo.{existing_ext}"
                try:
                    supabase.storage.from_(HOSTEL_ASSETS_BUCKET).remove([stale_path])
                except Exception:
                    pass

        file_path = f"{user_id}/logo.{ext}"
        supabase.storage.from_(HOSTEL_ASSETS_BUCKET).upload(
            path=file_path,
            file=file_bytes,
            file_options={
                "content-type": normalized_content_type,
                "upsert": "true",
                "cache-control": "3600",
            }
        )

        public_url_result = supabase.storage.from_(HOSTEL_ASSETS_BUCKET).get_public_url(file_path)
        public_url = _extract_public_url(public_url_result)
        if not public_url:
            return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to generate logo public URL")

        versioned_url = f"{public_url}?v={int(time.time())}"

        update_res = supabase.table("hostels") \
            .update({"logo_url": versioned_url}) \
            .eq("id", hostel_id) \
            .execute()

        if not update_res.data:
            return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to save hostel logo")

        return ServiceResponse.success({"logo_url": versioned_url}, "Hostel logo uploaded successfully")
    except Exception as e:
        logger.exception(f"Error uploading hostel logo for owner {user_id}: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, "Failed to upload hostel logo", str(e))
