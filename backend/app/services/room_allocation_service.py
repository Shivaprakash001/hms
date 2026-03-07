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
        
        # 2. End current allocation
        from datetime import timedelta
        prev_end_date = shift_date - timedelta(days=1)
        
        # Validate shift_date
        old_start_date = datetime.strptime(old_allocation.get("start_date"), "%Y-%m-%d").date()
        if shift_date <= old_start_date:
             return ServiceResponse.error(
                ErrorCode.INVALID_INPUT,
                "Invalid shift date",
                f"Shift date {shift_date} must be after current allocation start date {old_start_date}."
            )

        # Note: We simulate a transaction here by catching failures and log them.
        # Ideally we'd use an RPC for this.
        
        # End old
        end_res = supabase.table("room_allocations")\
            .update({"end_date": prev_end_date.isoformat()})\
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
            .select("*, students(profile_id, profiles(*))")\
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
            allocation_id = active_res.data[0]["id"]
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
        # Join room_allocations with students -> profiles AND rooms
        # Supabase syntax for nested joins: students(id, profiles(name)), rooms(room_no)
        res = supabase.table("room_allocations")\
            .select("*, students(id, profiles(name)), rooms(room_no, capacity, id)")\
            .eq("owner_id", user_id)\
            .is_("end_date", "null")\
            .execute()
        
        data = []
        for item in res.data:
            # Map Supabase structure to Schema structure
            if "students" in item:
                item["student"] = item.pop("students")
            if "rooms" in item:
                item["room"] = item.pop("rooms")
            data.append(item)
            
        return ServiceResponse.success(data)
    except Exception as e:
        logger.exception(f"Error fetching active allocations: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, str(e))
