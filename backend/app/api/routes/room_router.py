from fastapi import APIRouter, HTTPException, Depends, status, Query
from app.schemas.room_schema import RoomCreate, RoomResponse, RoomListResponse, RoomUpdate
from app.services import room_service
from app.utils.auth import get_current_user, UserContext, require_admin_or_owner
from app.utils.responses import ErrorCode
from typing import List, Optional

router = APIRouter(prefix="/rooms", tags=["Rooms"])

def _handle_service_response(result: dict, success_status: int = status.HTTP_200_OK):
    """Helper to convert service response to HTTP response"""
    if not result.get("success"):
        error = result.get("error", {})
        status_map = {
            ErrorCode.RESOURCE_NOT_FOUND.value: status.HTTP_404_NOT_FOUND,
            ErrorCode.RESOURCE_ALREADY_EXISTS.value: status.HTTP_409_CONFLICT,
            ErrorCode.FORBIDDEN.value: status.HTTP_403_FORBIDDEN,
            ErrorCode.INVALID_INPUT.value: status.HTTP_422_UNPROCESSABLE_ENTITY,
        }
        http_status = status_map.get(error.get("code"), status.HTTP_400_BAD_REQUEST)
        raise HTTPException(status_code=http_status, detail=error)
    return result.get("data")

@router.get("/", response_model=List[dict]) 
def list_rooms(
    grouped: bool = Query(True, description="Return rooms grouped by floor (default: True)"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: UserContext = Depends(get_current_user)
):
    """
    List all rooms.
    If grouped=true, returns floors with nested rooms.
    """
    owner_id = user.user_id if user.role in ("admin", "owner") else None
    if grouped:
        result = room_service.get_floors_with_rooms(owner_id=owner_id)
        return _handle_service_response(result)
    
    result = room_service.get_all_rooms(limit=limit, offset=offset, owner_id=owner_id)
    return result.get("data", {}).get("rooms", [])

@router.post("/", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
def create_room(
    room: RoomCreate,
    user: UserContext = Depends(require_admin_or_owner)
):
    """
    Create a new room.
    """
    room_data = room.model_dump()
    room_data["owner_id"] = user.user_id
    result = room_service.create_room(room_data)
    return _handle_service_response(result, status.HTTP_201_CREATED)

@router.get("/{room_id}", response_model=dict)
def get_room(
    room_id: str,
    user: UserContext = Depends(require_admin_or_owner)
):
    """
    Get room details.
    """
    result = room_service.get_room(room_id, owner_id=user.user_id if user.role in ("admin", "owner") else None)
    return _handle_service_response(result)

@router.get("/{room_id}/overview", response_model=dict)
def get_room_overview(
    room_id: str,
    user: UserContext = Depends(require_admin_or_owner)
):
    """
    Get room overview for drawer UI.
    """
    result = room_service.get_room_overview(room_id, owner_id=user.user_id if user.role in ("admin", "owner") else None)
    return _handle_service_response(result)

@router.put("/{room_id}", response_model=RoomResponse)
def update_room(
    room_id: str,
    room: RoomUpdate,
    user: UserContext = Depends(require_admin_or_owner)
):
    """
    Update room details.
    """
    result = room_service.update_room(room_id, room.model_dump(exclude_unset=True))
    return _handle_service_response(result)

@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_room(
    room_id: str,
    user: UserContext = Depends(require_admin_or_owner)
):
    """
    Delete a room.
    """
    result = room_service.delete_room(room_id)
    if not result.get("success"):
         _handle_service_response(result) # Will raise exception
    return None
