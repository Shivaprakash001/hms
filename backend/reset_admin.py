import sys
import os

# Add the current directory to sys.path
sys.path.append(os.getcwd())

from app.db import supabase
from app.utils.auth import get_password_hash

def reset_admin():
    email = "admin@hms.com"
    new_password = "password123"
    
    print(f"Checking for user: {email}")
    
    # 1. Check if user exists
    res = supabase.table("profiles").select("*").eq("email", email).execute()
    
    if not res.data:
        print("User not found! Creating new admin user...")
        # Create if not exists
        hashed = get_password_hash(new_password)
        new_user = {
            "email": email,
            "password_hash": hashed,
            "name": "Admin User",
            "role": "admin",
            "is_active": True,
            "phone": "9999999999"
        }
        create_res = supabase.table("profiles").insert(new_user).execute()
        if create_res.data:
            print("✅ Admin user created successfully.")
        else:
            print(f"❌ Failed to create admin user: {create_res}")
    else:
        user = res.data[0]
        print(f"User found: {user['id']} (Role: {user['role']})")
        
        # 2. Update password
        hashed = get_password_hash(new_password)
        update_data = {
            "password_hash": hashed,
            "is_active": True,
            "role": "admin" # Ensure role is admin
        }
        
        update_res = supabase.table("profiles").update(update_data).eq("id", user['id']).execute()
        
        if update_res.data:
            print("✅ Admin password and role updated successfully.")
        else:
            print(f"❌ Failed to update admin user: {update_res}")

if __name__ == "__main__":
    reset_admin()
