from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class RoomBase(BaseModel):
    room_no: str
    capacity: int = 4

class RoomCreate(RoomBase):
    owner_id: Optional[str] = None

class RoomUpdate(BaseModel):
    room_no: Optional[str] = None
    capacity: Optional[int] = None
    
class RoomResponse(RoomBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class RoomListResponse(BaseModel):
    rooms: List[RoomResponse]
    total: int
