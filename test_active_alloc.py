import sys
sys.path.append("/Users/valurothusharan/Desktop/hms/hms/backend")
from app.db import supabase
from app.services import room_allocation_service

admin_users = supabase.table("profiles").select("*").eq("role", "admin").execute()
if not admin_users.data:
    print("No admins found")
    sys.exit(1)
owner_id = admin_users.data[0]['id']
print(f"Getting active allocations for {owner_id}")
try:
    res = room_allocation_service.get_active_allocations(owner_id)
    print(res)
except Exception as e:
    import traceback
    traceback.print_exc()

