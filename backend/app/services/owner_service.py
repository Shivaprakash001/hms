from typing import Dict, Any
from app.db import supabase
from app.utils.responses import ServiceResponse, ErrorCode
from app.utils.logger import get_logger

logger = get_logger(__name__)

DEFAULT_PREFERENCES = {
    "currency": "INR",
    "rent_cycle": "MONTHLY",
    "receipt_prefix": "HMS",
    "timezone": "Asia/Kolkata"
}


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
    }


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
            },
            "preferences": {
                "currency": hostel.get("currency") or DEFAULT_PREFERENCES["currency"],
                "rent_cycle": hostel.get("rent_cycle") or DEFAULT_PREFERENCES["rent_cycle"],
                "receipt_prefix": hostel.get("receipt_prefix") or DEFAULT_PREFERENCES["receipt_prefix"],
                "timezone": hostel.get("timezone") or DEFAULT_PREFERENCES["timezone"],
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
            "name": data.get("hostel_name"),
            "phone": data.get("hostel_phone"),
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
        allowed = {"currency", "rent_cycle", "receipt_prefix", "timezone"}
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
