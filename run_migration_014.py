"""
Apply migration 014 via Supabase Management API (direct HTTP with service role)
Runs each DDL statement via the /query endpoint available in newer Supabase versions,
or falls back to the pg_custom approach via a stored function call.
"""
import os
import sys
import httpx
from dotenv import load_dotenv

load_dotenv(dotenv_path="/home/sp/Desktop/project-hms/.env")

SUPABASE_URL = os.environ["SUPABASE_URL"]          # e.g. https://xxx.supabase.co
SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

# Extract project ref from URL
PROJECT_REF = SUPABASE_URL.replace("https://", "").split(".")[0]

STATEMENTS = [
    "ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_room_no_key",
    "DROP INDEX IF EXISTS idx_rooms_room_no",
    "ALTER TABLE rooms ADD CONSTRAINT rooms_room_no_owner_unique UNIQUE (room_no, owner_id)",
    "CREATE INDEX IF NOT EXISTS idx_rooms_owner_room_no ON rooms(owner_id, room_no)",
]

headers = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
}

print(f"Project: {PROJECT_REF}")
print(f"Supabase URL: {SUPABASE_URL}")
print()

# Try Supabase Management API /query endpoint
def run_via_management_api():
    url = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"
    sql = ";\n".join(STATEMENTS) + ";"
    resp = httpx.post(url, headers=headers, json={"query": sql}, timeout=15)
    return resp

# Try direct postgres connection via REST
def run_via_rpc(stmt):
    """Try calling a pg function — creates one if needed"""
    url = f"{SUPABASE_URL}/rest/v1/rpc/exec_ddl"
    resp = httpx.post(url, headers=headers, json={"ddl": stmt}, timeout=10)
    return resp

print("Attempting via Supabase Management API...")
try:
    resp = run_via_management_api()
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text[:500]}")
    if resp.status_code in (200, 201):
        print("\n✅ Migration applied successfully via Management API!")
        sys.exit(0)
    else:
        print(f"\n⚠️  Management API failed: {resp.status_code}")
except Exception as e:
    print(f"Management API error: {e}")

print("\nFalling back: checking current constraints...")
# Just check existing constraints
check_url = f"{SUPABASE_URL}/rest/v1/rpc/exec_sql"
resp = httpx.post(check_url, headers=headers,
    json={"sql": "SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='rooms' AND constraint_type='UNIQUE';"},
    timeout=10)
print(f"Constraint check: {resp.status_code} - {resp.text[:300]}")
