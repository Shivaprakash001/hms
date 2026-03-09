import sys
sys.path.append("/Users/valurothusharan/Desktop/hms/hms/backend")
from app.db import supabase

# If the master schema fix (migration 016) has not been run in the Supabase SQL editor, the owner_id column won't exist in room_allocations.
# Let's verify if the column exists by trying to select it.
try:
    res = supabase.table("room_allocations").select("owner_id").limit(1).execute()
    print("MIGRATION 016 WAS APPLIED! Owner ID exists.")
except Exception as e:
    print(f"MIGRATION 016 WAS NOT FULLY APPLIED! Error: {e}")
    print("The user needs to run 016_master_schema_fix.sql in their Supabase editor.")
