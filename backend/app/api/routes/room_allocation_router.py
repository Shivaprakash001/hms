from fastapi import APIRouter, HTTPException, Depends, status, Header
from app.schemas.room_allocation_schema import (
    RoomAllocationCreate, RoomAllocationEnd, RoomAllocationResponse,
    RoomAllocationShift, RoomOccupantsResponse
)
from app.services import room_allocation_service
from app.utils.auth import get_current_user, UserContext, require_admin_or_owner
from app.utils.responses import ErrorCode
from typing import List, Optional

router = APIRouter(prefix="/allocations", tags=["Room Allocation"])


def _handle_service_response(result: dict, success_status: int = status.HTTP_200_OK):
    """Helper to convert service response to HTTP response"""
    if not result.get("success"):
        error = result.get("error", {})
        error_code = error.get("code", ErrorCode.UNKNOWN_ERROR.value)
        
        # Map error codes to HTTP status codes
        status_map = {
            ErrorCode.RESOURCE_NOT_FOUND.value: status.HTTP_404_NOT_FOUND,
            ErrorCode.RESOURCE_ALREADY_EXISTS.value: status.HTTP_409_CONFLICT,
            ErrorCode.FORBIDDEN.value: status.HTTP_403_FORBIDDEN,
            ErrorCode.INVALID_INPUT.value: status.HTTP_422_UNPROCESSABLE_ENTITY,
            ErrorCode.UNAUTHORIZED.value: status.HTTP_401_UNAUTHORIZED,
        }
        
        http_status = status_map.get(error_code, status.HTTP_400_BAD_REQUEST)
        raise HTTPException(status_code=http_status, detail=result.get("error"))
    
    return result.get("data")


@router.get(
    "/active",
    response_model=List[RoomAllocationResponse],
    summary="Get all active allocations with student and room info",
    dependencies=[Depends(require_admin_or_owner)]
)
def get_active_allocations(
    user: UserContext = Depends(get_current_user)
):
    """
    Get list of all currently active room assignments.

    **Authorization:** Admin or Warden only.
    """
    result = room_allocation_service.get_active_allocations(user.user_id)
    return _handle_service_response(result)


@router.get(
    "/owner-history",
    response_model=List[RoomAllocationResponse],
    summary="Get all past and current allocations for the owner's students",
    dependencies=[Depends(require_admin_or_owner)]
)
def get_owner_allocation_history(
    user: UserContext = Depends(get_current_user)
):
    """
    Get a complete list of all room assignments (past and present) for your students.
    """
    result = room_allocation_service.get_all_allocations_history(user.user_id)
    return _handle_service_response(result)


@router.post(
    "/",
    response_model=dict, # Returns detailed success summary
    status_code=status.HTTP_201_CREATED,
    summary="Allocate a room to a student",
    dependencies=[Depends(require_admin_or_owner)]
)
def create_allocation(
    data: RoomAllocationCreate,
    user: UserContext = Depends(get_current_user)
):
    """
    Assign a student to a room.
    
    **Authorization:** Admin or Warden only.
    
    **Rules:**
    - Student must exist and be ACTIVE.
    - Student must not already have an active allocation.
    - Room must exist and have remaining capacity.
    """
    result = room_allocation_service.allocate_room(
        str(data.student_id),
        str(data.room_id),
        data.start_date,
        user_id=user.user_id
    )
    return _handle_service_response(result, status.HTTP_201_CREATED)


@router.patch(
    "/{allocation_id}/end",
    response_model=RoomAllocationResponse,
    summary="End an active room allocation",
    dependencies=[Depends(require_admin_or_owner)]
)
def end_allocation(
    allocation_id: str,
    data: RoomAllocationEnd,
    user: UserContext = Depends(get_current_user)
):
    """
    Set an end date for an active allocation.
    
    **Authorization:** Admin or Warden only.
    """
    result = room_allocation_service.end_allocation(
        allocation_id,
        data.end_date,
        user_id=user.user_id
    )
    return _handle_service_response(result)


@router.post(
    "/shift",
    response_model=dict, # Returns new allocation info
    summary="Shift a student to a new room",
    dependencies=[Depends(require_admin_or_owner)]
)
def shift_student(
    data: RoomAllocationShift,
    user: UserContext = Depends(get_current_user)
):
    """
    End current allocation and start a new one in a different room atomically.
    
    **Authorization:** Admin or Warden only.
    """
    result = room_allocation_service.shift_room(
        str(data.student_id),
        str(data.new_room_id),
        data.shift_date,
        user_id=user.user_id
    )
    return _handle_service_response(result)


@router.get(
    "/student/{student_id}",
    response_model=List[RoomAllocationResponse],
    summary="Get allocation history for a student"
)
def get_student_history(
    student_id: str,
    user: UserContext = Depends(get_current_user)
):
    """
    Retrieve all past and current allocations for a student.
    
    **Authorization:** 
    - Admin/Warden can view any student.
    - Student can only view their own history.
    """
    if user.is_student() and str(user.user_id) != str(student_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own allocation history."
        )
        
    result = room_allocation_service.get_student_allocation_history(student_id)
    return _handle_service_response(result)


@router.get(
    "/rooms/{room_id}/occupants",
    response_model=RoomOccupantsResponse,
    summary="Get active occupants of a room",
    tags=["Rooms"]
)
def get_occupants(
    room_id: str,
    user: UserContext = Depends(require_admin_or_owner)
):
    """
    Get detailed occupancy info for a room.
    
    **Authorization:** Admin or Warden only.
    """
    result = room_allocation_service.get_room_occupants(room_id)
    return _handle_service_response(result)


@router.get(
    "/my-room",
    response_model=dict,
    summary="Get current student's room details and roommates"
)
def get_my_room(user: UserContext = Depends(get_current_user)):
    """
    Get the current room details and roommates for the logged-in student.
    **Authorization:** Students only.
    """
    if not user.is_student():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can access this endpoint."
        )
    from app.db import supabase

    student_id = user.student_id
    if not student_id:
        res = supabase.table("students").select("id").eq("profile_id", user.user_id).execute()
        if res.data:
            student_id = res.data[0]["id"]

    if not student_id:
        raise HTTPException(status_code=404, detail="Student record not found")

    # Get current allocation
    alloc_res = supabase.table("room_allocations")\
        .select("room_id, rooms(room_no, capacity)")\
        .eq("student_id", student_id)\
        .is_("end_date", "null")\
        .execute()

    if not alloc_res.data:
        return {"room": None, "roommates": []}

    alloc = alloc_res.data[0]
    room = alloc.get("rooms") or {}
    room_id = alloc.get("room_id")

    # Get all occupants in this room (excluding self)
    occupants_res = supabase.table("room_allocations")\
        .select("student_id, students!room_allocations_student_id_fkey(profile_id, profiles!students_profile_id_fkey(name))")\
        .eq("room_id", room_id)\
        .is_("end_date", "null")\
        .neq("student_id", student_id)\
        .execute()

    roommates = []
    for occ in (occupants_res.data or []):
        student_rec = occ.get("students") or {}
        profile = student_rec.get("profiles!students_profile_id_fkey") or student_rec.get("profiles") or {}
        name = profile.get("name")
        if name:
            roommates.append({"name": name})

    return {
        "room": {
            "room_no": room.get("room_no"),
            "capacity": room.get("capacity"),
        },
        "roommates": roommates
    }
