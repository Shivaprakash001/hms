from pydantic import BaseModel
from typing import Optional, Union
from datetime import date

class ExpenseCreate(BaseModel):
    title: str
    amount: float
    category: str
    date: date
    status: str = "pending"

class ExpenseUpdate(BaseModel):
    title: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    date: Optional[str] = None   # Accept ISO date string from frontend (e.g. "2026-03-09")
    status: Optional[str] = None

class ExpenseResponse(BaseModel):
    id: Union[str, int]  # DB uses UUID (str)
    title: str
    amount: float
    category: str
    date: Union[date, str]   # Accept both from DB
    status: str

    class Config:
        from_attributes = True

