from app.db import supabase
from typing import Optional, Dict, Any, List
from app.utils.responses import ServiceResponse, ErrorCode
from app.utils.logger import get_logger

logger = get_logger(__name__)

def get_floors_with_rooms(owner_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Get all rooms grouped by floor.
    Structure: [ { id: 'f1', number: 1, rooms: [ ... ] } ]
    Uses two separate queries to avoid deep-nested join timeouts.
    """
    try:
        # Query 1: Fetch rooms (flat, fast)
        rooms_query = supabase.table("rooms").select("*").order("room_no")
        if owner_id:
            rooms_query = rooms_query.eq("owner_id", owner_id)
        rooms_res = rooms_query.execute()

        if not rooms_res.data:
            return ServiceResponse.success([])

        rooms_data = rooms_res.data
        room_ids = [r["id"] for r in rooms_data]

        # Query 2: Fetch active allocations with student + profile for all rooms at once
        allocs_res = supabase.table("room_allocations")\
            .select("id, room_id, start_date, students!inner(id, status, profiles!students_profile_id_fkey(id, name, email, phone))")\
            .in_("room_id", room_ids)\
            .is_("end_date", "null")\
            .execute()

        # Build a lookup: room_id -> list of tenant dicts
        tenants_by_room: Dict[str, list] = {r["id"]: [] for r in rooms_data}
        for alloc in (allocs_res.data or []):
            room_id = alloc.get("room_id")
            student = alloc.get("students") or {}
            profile = student.get("profiles") or {}
            if room_id and profile:
                tenants_by_room.setdefault(room_id, []).append({
                    "id": student.get("id"),
                    "name": profile.get("name"),
                    "email": profile.get("email"),
                    "phone": profile.get("phone"),
                    "joinDate": alloc.get("start_date"),
                    "status": student.get("status", "ACTIVE")
                })

        floors_map = {}
        for room in rooms_data:
            try:
                floor_num = int(room["room_no"][:-2]) if len(room["room_no"]) >= 3 and room["room_no"][:-2].isdigit() else 0
            except:
                floor_num = 0

            floor_key = f"f{floor_num}"
            if floor_key not in floors_map:
                floors_map[floor_key] = {"id": floor_key, "number": floor_num, "rooms": []}

            tenants = tenants_by_room.get(room["id"], [])
            floors_map[floor_key]["rooms"].append({
                "id": room["id"],
                "number": room["room_no"],
                "capacity": room["capacity"],
                "occupied": len(tenants),
                "floor": floor_num,
                "tenants": tenants
            })

        floors_list = sorted(list(floors_map.values()), key=lambda x: x["number"])
        return ServiceResponse.success(floors_list)

    except Exception as e:
        logger.exception(f"Error fetching floors: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, str(e))


def get_all_rooms(limit: int = 50, offset: int = 0, owner_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Get all rooms with pagination.
    """
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
        
        if rooms:
            room_ids = [r["id"] for r in rooms]
            # Fetch active allocations to calculate occupancy
            allocs_res = supabase.table("room_allocations")\
                .select("room_id")\
                .in_("room_id", room_ids)\
                .is_("end_date", "null")\
                .execute()
            
            # Map occupancy count
            occupancy_map = {}
            for alloc in (allocs_res.data or []):
                rid = alloc["room_id"]
                occupancy_map[rid] = occupancy_map.get(rid, 0) + 1
            
            for room in rooms:
                room["occupied"] = occupancy_map.get(room["id"], 0)

        return ServiceResponse.success({
            "rooms": rooms,
            "total": result.count if hasattr(result, "count") else len(rooms)
        })
    except Exception as e:
        logger.exception(f"Error fetching rooms: {e}")
        return ServiceResponse.error(ErrorCode.DB_QUERY_ERROR, str(e))

def create_room(data: dict) -> Dict[str, Any]:
    """
    Create a new room.
    """
    try:
        # Check if room already exists for this owner
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
