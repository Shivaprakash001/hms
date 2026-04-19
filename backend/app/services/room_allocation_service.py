from app.db import supabase
from typing import Optional, Dict, Any, List
from datetime import date, datetime
from postgrest.exceptions import APIError
from app.utils.responses import ServiceResponse, ErrorCode
from app.utils.logger import get_logger
from app.utils.hooks import trigger_hook
from uuid import UUID

logger = get_logger(__name__)


def allocate_room(
    student_id: str,
    room_id: str,
    start_date: date,
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Assign a student to a room using atomic RPC.
    
    This replaces Python-level checks with a PostgreSQL function 
    that uses FOR UPDATE locking to prevent race conditions.
    """
    try:
        logger.info(f"Attempting atomic allocation: Room {room_id} -> Student {student_id}")

        # Call the safe RPC function
        # Note: Supabase RPC calls use the function name
        rpc_params = {
            "p_student_id": student_id,
            "p_room_id": room_id,
            "p_start_date": start_date.isoformat()
        }
        
        rpc_res = supabase.rpc("allocate_room_safely", rpc_params).execute()
        
        # Parse RPC response
        # The function returns a single JSONB object
        result = rpc_res.data
        
        if not result or not result.get("success"):
            error_msg = result.get("message", "Allocation failed")
            error_code_val = result.get("error_code", "VAL_002")
            
            # Map back to ErrorCode enum if possible
            error_code = next((e for e in ErrorCode if e.value == error_code_val), ErrorCode.INVALID_INPUT)
            
            logger.warning(f"Allocation rejected by RPC: {error_msg}")
            return ServiceResponse.error(error_code, error_msg)

        allocation_result = result.get("data", {})
        
        # Side Effects (Hooks)
        trigger_hook("student_allocated_room", 
                     student_id=student_id, 
                     room_id=room_id, 
                     allocation_id=allocation_result.get("allocation_id"),
                     user_id=user_id)
        
        return ServiceResponse.success(allocation_result, "Room allocated successfully")

    except Exception as e:
        # postgrest-py often raises an APIError if the returned JSON contains keys like 'message'
        # The raw JSON dict returned by the RPC is accessible via e.json()
        if hasattr(e, "json"):
            try:
                result = e.json()
                if isinstance(result, dict) and "success" in result and not result.get("success"):
                    error_msg = result.get("message", "Allocation failed")
                    error_code_val = result.get("error_code", "VAL_002")
                    error_code = next((err for err in ErrorCode if err.value == error_code_val), ErrorCode.INVALID_INPUT)
                    logger.warning(f"Allocation rejected by RPC: {error_msg}")
                    return ServiceResponse.error(error_code, error_msg)
            except Exception:
                pass

        logger.exception(f"Error calling allocation RPC: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, "An unexpected error occurred", str(e))


def end_allocation(
    allocation_id: str,
    end_date: date,
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    """End an active room allocation."""
    try:
        # Check if allocation exists and is active
        current_res = supabase.table("room_allocations")\
            .select("*")\
            .eq("id", allocation_id)\
            .execute()
        
        if not current_res.data:
            return ServiceResponse.not_found("Allocation")
        
        allocation = current_res.data[0]
        
        if allocation.get("end_date"):
            return ServiceResponse.error(
                ErrorCode.INVALID_INPUT,
                "Allocation already ended",
                f"Allocation was ended on {allocation.get('end_date')}."
            )
        
        start_date = datetime.strptime(allocation.get("start_date"), "%Y-%m-%d").date()
        if end_date < start_date:
            return ServiceResponse.error(
                ErrorCode.INVALID_INPUT,
                "Invalid end date",
                f"End date {end_date} cannot be before start date {start_date}."
            )

        # Update
        result = supabase.table("room_allocations")\
            .update({"end_date": end_date.isoformat()})\
            .eq("id", allocation_id)\
            .execute()
        
        if not result.data:
            return ServiceResponse.error(ErrorCode.DB_002, "Failed to end allocation")
        
        # Side Effects
        trigger_hook("student_room_left", 
                     student_id=allocation["student_id"], 
                     room_id=allocation["room_id"], 
                     allocation_id=allocation_id,
                     user_id=user_id)
        
        return ServiceResponse.success(result.data[0], "Allocation ended successfully")

    except Exception as e:
        logger.exception(f"Error ending allocation: {e}")
        return ServiceResponse.error(ErrorCode.SYS_001, "An unexpected error occurred", str(e))


def shift_room(
    student_id: str,
    new_room_id: str,
    shift_date: date,
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Atomic room shift.
    1. End old allocation (end_date = shift_date - 1)
    2. Create new allocation (start_date = shift_date)
    
    Warning: This implementation in Python is not fully atomic at the DB level.
    For production, an RPC is recommended.
    """
    try:
        # 1. Find active allocation
        active_res = supabase.table("room_allocations")\
            .select("id, room_id, start_date")\
            .eq("student_id", student_id)\
            .is_("end_date", "null")\
            .execute()
        
        if not active_res.data:
            return ServiceResponse.error(
                ErrorCode.RESOURCE_NOT_FOUND,
                "No active allocation found for this student",
                "Student must have an active room to perform a shift."
            )
        
        old_allocation = active_res.data[0]
        
        old_start_date = datetime.strptime(old_allocation.get("start_date"), "%Y-%m-%d").date()
        
        if shift_date < old_start_date:
             return ServiceResponse.error(
                ErrorCode.INVALID_INPUT,
                "Invalid shift date",
                f"Shift date {shift_date} must be on or after current allocation start date {old_start_date}."
            )

        # Handle same-day shift (CORRECTION)
        if shift_date == old_start_date:
            logger.info(f"Same-day shift detected for student {student_id}. Updating current allocation.")
            # Check capacity manually as a correction flow
            room_res = supabase.table("rooms").select("capacity").eq("id", new_room_id).execute()
            if not room_res.data:
                return ServiceResponse.not_found("Room")
            
            capacity = room_res.data[0]["capacity"]
            occupants_res = supabase.table("room_allocations").select("id", count="exact").eq("room_id", new_room_id).is_("end_date", "null").execute()
            active_occupants = occupants_res.count if hasattr(occupants_res, 'count') else len(occupants_res.data)
            
            if active_occupants >= capacity:
                return ServiceResponse.error(ErrorCode.INVALID_INPUT, "Target room is at full capacity")
            
            # Update current allocation's room_id
            update_res = supabase.table("room_allocations")\
                .update({"room_id": new_room_id})\
                .eq("id", old_allocation["id"])\
                .execute()
            
            if not update_res.data:
                return ServiceResponse.error(ErrorCode.DB_002, "Failed to update room assignment")
                
            return ServiceResponse.success(update_res.data[0], "Room assignment corrected successfully")

        # Standard shift for future/later dates
        from datetime import timedelta

        # Note: We simulate a transaction here by catching failures and log them.
        # End old
        end_res = supabase.table("room_allocations")\
            .update({"end_date": shift_date.isoformat()})\
            .eq("id", old_allocation["id"])\
            .execute()
            
        if not end_res.data:
             return ServiceResponse.error(ErrorCode.DB_002, "Failed to end old allocation during shift")
        
        # Allocate new
        alloc_res = allocate_room(student_id, new_room_id, shift_date, user_id)
        
        if not alloc_res.get("success"):
            # ROLLBACK end_res (highly manual)
            supabase.table("room_allocations")\
                .update({"end_date": None})\
                .eq("id", old_allocation["id"])\
                .execute()
            return alloc_res # Forward the error from allocate_room
            
        return ServiceResponse.success(alloc_res["data"], "Room shifted successfully")

    except Exception as e:
        logger.exception(f"Error shifting room: {e}")
        return ServiceResponse.error(ErrorCode.SYS_001, "An unexpected error occurred", str(e))


def get_student_allocation_history(student_id: str) -> Dict[str, Any]:
    """Get all room allocations for a student."""
    try:
        res = supabase.table("room_allocations")\
            .select("*, rooms(*)")\
            .eq("student_id", student_id)\
            .order("start_date", desc=True)\
            .execute()
        
        return ServiceResponse.success(res.data)
    except Exception as e:
        logger.exception(f"Error fetching allocation history: {e}")
        return ServiceResponse.error(ErrorCode.DB_002, "Failed to fetch history")


def get_room_occupants(room_id: str) -> Dict[str, Any]:
    """Get active occupants of a room."""
    try:
        # Get room info
        room_res = supabase.table("rooms").select("*").eq("id", room_id).execute()
        if not room_res.data:
            return ServiceResponse.not_found("Room")
        
        room = room_res.data[0]
        
        # Get active occupants with profile info
        # Note: We join across room_allocations -> students -> profiles
        # But Supabase select syntax needs to be correct for joins.
        # Assuming RLS/foreign keys allow:
        res = supabase.table("room_allocations")\
            .select("*, students(profile_id, profiles!students_profile_id_fkey(*))")\
            .eq("room_id", room_id)\
            .is_("end_date", "null")\
            .execute()
            
        occupants = []
        for item in res.data:
            student_profile = item.get("students", {}).get("profiles", {})
            if student_profile:
                occupants.append(student_profile)
        
        occupancy_count = len(occupants)
        capacity = room.get("capacity", 0)
        
        return ServiceResponse.success({
            "room": room,
            "occupancy_count": occupancy_count,
            "remaining_capacity": capacity - occupancy_count,
            "occupants": occupants
        })
    except Exception as e:
        logger.exception(f"Error fetching room occupants: {e}")
        return ServiceResponse.error(ErrorCode.DB_002, "Failed to fetch occupants")


def handle_student_left(student_id: str, **kwargs):
    """
    Hook handler: When a student leaves the hostel, 
    automatically end their active room allocation.
    """
    try:
        logger.info(f"Auto-ending allocation for student {student_id} (Student LEFT)")
        
        # Find active allocation
        active_res = supabase.table("room_allocations")\
            .select("id")\
            .eq("student_id", student_id)\
            .is_("end_date", "null")\
            .execute()
        
        if active_res.data:
            allocation = active_res.data[0]
            allocation_id = allocation["id"]
            
            # To allow same-day re-allocation, we end the old one "yesterday" if it started before today.
            # If it started today, we must end it today (and re-allocation will need to wait for tomorrow or use shift_room).
            try:
                from datetime import timedelta
                start_date = datetime.strptime(allocation.get("start_date"), "%Y-%m-%d").date()
                if start_date < date.today():
                    end_date = date.today() - timedelta(days=1)
                else:
                    end_date = date.today()
            except:
                end_date = date.today()
            
            res = end_allocation(allocation_id, end_date, user_id=kwargs.get("user_id"))
            if res.get("success"):
                logger.info(f"Successfully auto-ended allocation {allocation_id}")
            else:
                logger.error(f"Failed to auto-end allocation: {res.get('error')}")
        else:
            logger.debug(f"No active allocation to end for student {student_id}")
            
    except Exception as e:
        logger.error(f"Error in handle_student_left hook: {e}")

def get_active_allocations(user_id: str) -> Dict[str, Any]:
    """Get all active room allocations with student and room details."""
    try:
        # Fetch all active allocations with student profile and room info
        # Filter by owner in Python since PostgREST nested filtering (students.owner_id)
        # is not reliably supported in supabase-py
        res = supabase.table("room_allocations")\
            .select("*, students(id, owner_id, profiles!students_profile_id_fkey(name)), rooms(*)")\
            .is_("end_date", "null")\
            .execute()

        data = []
        for item in (res.data or []):
            student = item.get("students") or {}
            # Filter by owner_id
            if str(student.get("owner_id", "")) != str(user_id):
                continue
            # Rename keys to match schema
            item["student"] = item.pop("students")
            item["room"] = item.pop("rooms", None)
            data.append(item)

        return ServiceResponse.success(data)
    except Exception as e:
        logger.exception(f"Error fetching active allocations: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, str(e))


def get_all_allocations_history(user_id: str) -> Dict[str, Any]:
    """Get all past and current allocations for an owner's students."""
    try:
        # Fetch allocations with student and room info
        res = supabase.table("room_allocations")\
            .select("*, students(id, owner_id, profiles!students_profile_id_fkey(name)), rooms(*)")\
            .order("start_date", desc=True)\
            .execute()

        data = []
        for item in (res.data or []):
            student = item.get("students") or {}
            # Filter by owner_id
            if str(student.get("owner_id", "")) != str(user_id):
                continue
            
            # Map student profile for UI
            item["student"] = student
            item["room"] = item.pop("rooms", None)
            data.append(item)

        return ServiceResponse.success(data)
    except Exception as e:
        logger.exception(f"Error fetching allocation history: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, str(e))

