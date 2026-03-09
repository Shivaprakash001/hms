import sys
sys.path.append("/Users/valurothusharan/Desktop/hms/hms/backend")
from app.db import supabase

# First check if owner_id exists in room_allocations
try:
    res = supabase.table("room_allocations").select("*").limit(1).execute()
    if res.data and "owner_id" not in res.data[0]:
        print("owner_id column is missing from room_allocations!")
    else:
        print("owner_id exists in room_allocations or table is empty.")
except Exception as e:
    print(f"Error checking room_allocations: {e}")
