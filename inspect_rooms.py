import sys
sys.path.append("/Users/valurothusharan/Desktop/hms/hms/backend")
from app.db import supabase
from app.services import room_service
import json

admin_users = supabase.table("profiles").select("*").eq("role", "admin").execute()
owner_id = admin_users.data[0]['id']
print(f"Testing for owner_id: {owner_id}")
res = room_service.get_all_rooms_grouped(owner_id)
# Print just the first tenant found
found = False
for floor in res.get('data', []):
    for room in floor.get('rooms', []):
        for tenant in room.get('tenants', []):
            print("TENANT OBJECT:")
            print(json.dumps(tenant, indent=2))
            found = True
            break
    if found: break
