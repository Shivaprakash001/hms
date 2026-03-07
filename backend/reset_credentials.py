import sys
import os
import asyncio

# Add the current directory to sys.path
sys.path.append(os.getcwd())

from app.db import supabase
from app.utils.auth import get_password_hash

def reset_passwords():
    print("Resetting passwords...")
    
    users = [
        {"email": "admin@hms.com", "password": "password123"},
        {"email": "student@hms.com", "password": "password123"}
    ]
    
    for user in users:
        print(f"Processing {user['email']}...")
        
        # Calculate hash
        hashed = get_password_hash(user["password"])
        
        # Update directly in DB
        res = supabase.table("profiles").update({
            "password_hash": hashed
        }).eq("email", user["email"]).execute()
        
        if res.data:
            print(f"✅ Password updated for {user['email']}")
        else:
            print(f"⚠️ User {user['email']} not found. Creating it...")
            # If not found, we should probably run the seed logic or just insert here
            # But wait, we need other fields (role, name). 
            # Let's assume the seed script did its job partially or we just need to fix the password.
            # If it doesn't exist, we can't just set the password.
            # Let's try to insert if missing.
            new_user = {
                "email": user["email"],
                "password_hash": hashed,
                "name": "Admin" if "admin" in user["email"] else "Student",
                "role": "admin" if "admin" in user["email"] else "student",
                "is_active": True,
                "phone": "9999999999" # Ensure phone is there
            }
            try:
                create_res = supabase.table("profiles").insert(new_user).execute()
                print(f"✅ Created user {user['email']}")
            except Exception as e:
                print(f"❌ Failed to create {user['email']}: {e}")

if __name__ == "__main__":
    reset_passwords()
