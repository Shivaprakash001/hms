import sys
import os

# Add the current directory to sys.path
sys.path.append(os.getcwd())

from app.services import auth_service
from app.utils.auth import verify_password
from app.db import supabase

def test_login():
    email = "admin@hms.com"
    password = "password123"
    
    print(f"Testing login for {email} / {password}")
    
    # 1. Check DB directly
    print("1. Direct DB Check:")
    res = supabase.table("profiles").select("*").eq("email", email).execute()
    if not res.data:
        print("❌ User not found in DB!")
        return
    
    user = res.data[0]
    print(f"   Found user: {user['email']}, Active: {user['is_active']}, Role: {user['role']}")
    print(f"   Stored Hash: {user['password_hash']}")
    
    # 2. Check Password Verify
    print("\n2. Password Verification:")
    is_valid = verify_password(password, user['password_hash'])
    print(f"   verify_password('password123', hash) -> {is_valid}")
    
    if not is_valid:
        print("❌ Password verification failed!")
        # Debug hash
        import bcrypt
        try:
            # Re-hash to see what it looks like
            new_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            print(f"   New Hash would be: {new_hash}")
        except Exception as e:
            print(f"   hashing error: {e}")
    else:
        print("✅ Password verified locally.")

    # 3. Check Service
    print("\n3. Service Call:")
    response = auth_service.login(email, password)
    print(f"   Service Response: {response}")

if __name__ == "__main__":
    test_login()
