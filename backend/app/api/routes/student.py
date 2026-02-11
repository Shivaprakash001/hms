from fastapi import APIRouter
from db import supabase

router = APIRouter()

@router.post("/add_student")
def add_student(student: dict):
    return supabase.table("students").insert(student).execute()
