import sys
import os
import asyncio

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db import supabase
from app.utils.auth import get_password_hash

def create_or_update_user(email, password, role, name, phone):
    print(f"Checking user: {email}")
    try:
        # Check if user exists
        res = supabase.table("profiles").select("*").eq("email", email).execute()
        
        hashed = get_password_hash(password)
        
        if res.data:
            print(f"User {email} exists (ID: {res.data[0]['id']}). Updating password...")
            user_id = res.data[0]['id']
            # We don't update phone here to avoid conflict if already set
            update_res = supabase.table("profiles").update({
                "password_hash": hashed,
                "role": role,
                "is_active": True
            }).eq("id", user_id).execute()
            
            if update_res.data:
                print(f"Successfully updated {email}")
            else:
                print(f"Failed to update {email}")
        else:
            print(f"User {email} does not exist. Creating...")
            new_user = {
                "email": email,
                "password_hash": hashed,
                "role": role,
                "name": name,
                "phone": phone,
                "is_active": True
            }
            insert_res = supabase.table("profiles").insert(new_user).execute()
            if insert_res.data:
                print(f"Successfully created {email}")
            else:
                print(f"Failed to create {email}")
                
    except Exception as e:
        print(f"Error processing {email}: {str(e)}")

if __name__ == "__main__":
    print("Creating/Updating test users...")
    create_or_update_user("admin@example.com", "password123", "admin", "Admin User", "9999999990")
    create_or_update_user("student@example.com", "password123", "student", "Student User", "9999999991")
    create_or_update_user("warden@example.com", "password123", "warden", "Warden User", "9999999992")
    print("Done!")
