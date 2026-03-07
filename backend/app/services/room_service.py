from app.db import supabase
from typing import Optional, Dict, Any, List
from app.utils.responses import ServiceResponse, ErrorCode
from app.utils.logger import get_logger

logger = get_logger(__name__)

def get_floors_with_rooms() -> Dict[str, Any]:
    """
    Get all rooms grouped by floor.
    Structure: [ { id: 'f1', number: 1, rooms: [ ... ] } ]
    """
    try:
        # Fetch all rooms with active allocations and tenant profiles
        # We need to join: rooms -> room_allocations -> students -> profiles
        # Supabase-py might not support deep nested select easily in one go with standard postgrest if relationships aren't perfect.
        # Let's try: select *, room_allocations(*, students(*, profiles(*)))
        
        response = supabase.table("rooms")\
            .select("*, room_allocations(id, start_date, end_date, students(id, profiles(id, name, email, phone)))")\
            .order("room_no")\
            .execute()
        
        if not response.data:
            return ServiceResponse.success([])

        rooms_data = response.data
        floors_map = {}

        for room in rooms_data:
            # Determine floor from room_no (e.g. 101 -> 1, 205 -> 2, G1 -> 0?)
            # Assuming standard numeric 3-digit: 1xx, 2xx
            try:
                floor_num = int(room["room_no"][:-2]) if len(room["room_no"]) >= 3 and room["room_no"][:-2].isdigit() else 0
            except:
                floor_num = 0

            floor_key = f"f{floor_num}"

            if floor_key not in floors_map:
                floors_map[floor_key] = {
                    "id": floor_key,
                    "number": floor_num,
                    "rooms": []
                }

            # Process tenants
            tenants = []
            allocations = room.get("room_allocations", [])
            # Filter active allocations
            active_allocs = [a for a in allocations if a.get("end_date") is None]
            
            for alloc in active_allocs:
                student = alloc.get("students")
                if student:
                    profile = student.get("profiles")
                    if profile:
                        tenants.append({
                            "id": student["id"], # Use student ID or profile ID? mock uses t1.
                            "name": profile.get("name"),
                            "email": profile.get("email"),
                            "phone": profile.get("phone"),
                            "joinDate": alloc.get("start_date"),
                            "status": student.get("status", "ACTIVE")
                        })

            # Add room to floor
            floors_map[floor_key]["rooms"].append({
                "id": room["id"],
                "number": room["room_no"],
                "capacity": room["capacity"],
                "occupied": len(tenants), # Calculate specifically from active tenants
                "floor": floor_num,
                "tenants": tenants
            })

        # Convert map to sorted list
        floors_list = sorted(list(floors_map.values()), key=lambda x: x["number"])
        return ServiceResponse.success(floors_list)

    except Exception as e:
        logger.exception(f"Error fetching floors: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, str(e))


def get_all_rooms(limit: int = 50, offset: int = 0) -> Dict[str, Any]:
    """
    Get all rooms with pagination.
    """
    try:
        # Fetch rooms sorted by room_no
        result = supabase.table("rooms")\
            .select("*", count="exact")\
            .order("room_no")\
            .limit(limit)\
            .offset(offset)\
            .execute()

        return ServiceResponse.success({
            "rooms": result.data,
            "total": result.count if hasattr(result, "count") else len(result.data)
        })
    except Exception as e:
        logger.exception(f"Error fetching rooms: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, str(e))

def create_room(data: dict) -> Dict[str, Any]:
    """
    Create a new room.
    """
    try:
        # Check if room already exists
        existing = supabase.table("rooms").select("id").eq("room_no", data["room_no"]).execute()
        if existing.data:
            return ServiceResponse.error(ErrorCode.RESOURCE_ALREADY_EXISTS, f"Room {data['room_no']} already exists")

        result = supabase.table("rooms").insert(data).execute()
        
        if not result.data:
             return ServiceResponse.error(ErrorCode.DB_002, "Failed to create room")

        return ServiceResponse.success(result.data[0], "Room created successfully")
    except Exception as e:
        logger.exception(f"Error creating room: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, str(e))

def get_room(room_id: str) -> Dict[str, Any]:
    """
    Get generic room details.
    For occupancy details, use room_allocation_service.get_room_occupants
    """
    try:
        result = supabase.table("rooms").select("*").eq("id", room_id).execute()
        
        if not result.data:
            return ServiceResponse.not_found("Room")
            
        return ServiceResponse.success(result.data[0])
    except Exception as e:
        logger.exception(f"Error fetching room: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, str(e))

def update_room(room_id: str, data: dict) -> Dict[str, Any]:
    """
    Update room details (e.g. capacity).
    """
    try:
        result = supabase.table("rooms").update(data).eq("id", room_id).execute()
        
        if not result.data:
            return ServiceResponse.not_found("Room")
            
        return ServiceResponse.success(result.data[0], "Room updated successfully")
    except Exception as e:
        logger.exception(f"Error updating room: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, str(e))

def delete_room(room_id: str) -> Dict[str, Any]:
    """
    Delete a room.
    """
    try:
        # Check for active allocations before deleting? 
        # Database Foreign key might handle this (ON DELETE CASCADE or RESTRICT).
        # Assuming CASCADE for now based on migration 007.
        
        result = supabase.table("rooms").delete().eq("id", room_id).execute()
        
        if not result.data:
             return ServiceResponse.not_found("Room")
             
        return ServiceResponse.success(None, "Room deleted successfully")
    except Exception as e:
        logger.exception(f"Error deleting room: {e}")
        return ServiceResponse.error(ErrorCode.INTERNAL_ERROR, str(e))
