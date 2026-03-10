import sys
import os
from pathlib import Path

# Add backend to path
sys.path.append("/Users/valurothusharan/Desktop/hms/hms/backend")
from app.db import supabase

def run_sql_file(filepath):
    print(f"Running migration: {filepath}")
    with open(filepath, 'r') as file:
        sql = file.read()
    
    # We can't directly execute raw SQL text via the Supabase Data API client.
    # We need to use the Postgres REST API (rpc) or Postgres connection.
    # Since we only have the supabase-py client which wraps PostgREST,
    # and PostgREST doesn't allow raw DDL execution (CREATE TABLE, ALTER TABLE, etc)
    # for security reasons, we HAVE to ask the user to run it via the Supabase Dashboard SQL Editor
    print("Cannot run raw SQL DDL directly via supabase-py client.")
    print(f"Please copy the contents of {filepath} and run it in the Supabase SQL Editor.")

print("Please run these files in your Supabase SQL Editor:")
print("1. migrations/017_fix_rent_obligations_owner_id.sql")
print("2. migrations/018_add_owner_due_day.sql")
