import sys
import os

# Crucial: Add backend to path before importing app
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.services.auth_service import set_initial_password
from app.db import supabase

def main():
    if len(sys.argv) < 3:
        print("Usage: python set_password.py <email_or_id> <new_password>")
        sys.exit(1)

    identifier = sys.argv[1]
    password = sys.argv[2]

    # 1. Resolve identifier to profile ID if email is provided
    if "@" in identifier:
        res = supabase.table("profiles").select("id").eq("email", identifier).execute()
        if not res.data:
            print(f"Error: No profile found with email {identifier}")
            sys.exit(1)
        profile_id = res.data[0]["id"]
    else:
        profile_id = identifier

    # 2. Set password
    print(f"Setting password for profile {profile_id}...")
    result = set_initial_password(profile_id, password)
    
    if result.get("success"):
        print("✅ Password updated successfully! You can now login.")
    else:
        print(f"❌ Failed to set password: {result}")

if __name__ == "__main__":
    main()
