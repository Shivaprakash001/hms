import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

def check_table(table_name):
    print(f"--- Checking {table_name} ---")
    try:
        # Just try a simple select
        res = supabase.table(table_name).select("*").limit(1).execute()
        print(f"Table {table_name} exists.")
        if res.data:
            print(f"Sample row keys: {list(res.data[0].keys())}")
        else:
            print("Table is empty.")
    except Exception as e:
        print(f"Table {table_name} error: {e}")

check_table("profiles")
check_table("students")
check_table("rooms")
check_table("room_allocations")
check_table("payments")
check_table("rent_obligations")
