import os
import requests
from dotenv import load_dotenv

load_dotenv('../../.env')
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")

res = requests.get(f"{url}/rest/v1/", headers={"apikey": key, "Authorization": f"Bearer {key}"})
if res.ok:
    data = res.json()
    paths = data.get("paths", {})
    # Look for room_allocations
    if "/room_allocations" in paths:
        methods = paths["/room_allocations"].get("get", {})
        print("Definitions for room_allocations relationships:")
        print(data.get("definitions", {}).get("room_allocations", {}))
    print("\nForeign Keys or Relationships in OpenAPI spec:")
    for d, props in data.get("definitions", {}).items():
        if d in ["rooms", "room_allocations"]:
            print(f"--- {d} ---")
            print(props.get("properties", {}).keys())
    
else:
    print(res.text)
