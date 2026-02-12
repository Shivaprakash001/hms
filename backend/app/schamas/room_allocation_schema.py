from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime


class RoomAllocationBase(BaseModel):
    student_id: UUID
    room_id: UUID
    start_date: date


class RoomAllocationCreate(RoomAllocationBase):
    @field_validator('start_date')
    @classmethod
    def validate_start_date(cls, v):
        # Optional: Prevent old dates if needed, but for now we follow blueprint
        return v


class RoomAllocationEnd(BaseModel):
    end_date: date = Field(default_factory=date.today)

    @field_validator('end_date')
    @classmethod
    def validate_end_date(cls, v):
        # Will be checked against start_date in service
        return v


class RoomAllocationShift(BaseModel):
    student_id: UUID
    new_room_id: UUID
    shift_date: date = Field(default_factory=date.today)


class RoomResponse(BaseModel):
    id: UUID
    room_no: str
    capacity: int
    created_at: datetime
    updated_at: Optional[datetime] = None


class RoomAllocationResponse(BaseModel):
    id: UUID
    student_id: UUID
    room_id: UUID
    start_date: date
    end_date: Optional[date] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Optional nested data
    student: Optional[dict] = None
    room: Optional[RoomResponse] = None

    class Config:
        from_attributes = True


class RoomOccupantsResponse(BaseModel):
    room: RoomResponse
    occupancy_count: int
    remaining_capacity: int
    occupants: List[dict] # Profile info
