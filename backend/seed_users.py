import sys
import os

# Add the current directory to sys.path to ensure 'app' can be imported
sys.path.append(os.getcwd())

from app.services import auth_service

def seed():
    users = [
        {
            "email": "admin@hms.com", 
            "password": "password123", 
            "name": "Admin User", 
            "role": "admin",
            "phone": "9999999999"
        },
        {
            "email": "student@hms.com", 
            "password": "password123", 
            "name": "Test Student", 
            "role": "student",
            "phone": "8888888888"
        }
    ]

    print("--- Seeding Users ---")
    for user in users:
        print(f"Attempting to create {user['role']} user: {user['email']}")
        
        # auth_service.register_user expects a dict and returns a ServiceResponse dict
        result = auth_service.register_user(user)
        
        if result.get("success"):
            print(f"✅ Success: Created {user['email']}")
        else:
            # Check for existing user error safely
            error = result.get("error", {})
            msg = error if isinstance(error, str) else error.get("message", str(error))
            print(f"⚠️  Skipped: {msg}")

    print("\n--- Summary ---")
    print("Admin:   admin@hms.com / password123")
    print("Student: student@hms.com / password123")

if __name__ == "__main__":
    seed()
