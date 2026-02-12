from supabase import create_client
from dotenv import load_dotenv
import os
from pathlib import Path

# Load .env from project root (2 levels up from this file)
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

if __name__ == "__main__":
    print("Supabase connected successfully")
    data = supabase.table("students").select("*").execute()
    print(data)
