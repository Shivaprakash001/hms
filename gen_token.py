from jose import jwt
import os

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"

def create_test_token(user_id: str, role: str, email: str = "admin@hms.com"):
    payload = {
        "sub": user_id,
        "role": role,
        "email": email
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

# Profile ID for admin (we can use a dummy one for testing service-level logic if DB doesn't exist, 
# but for full integration we need a real ID if the DB check is enabled)
admin_token = create_test_token("d8e2d7e2-1234-5678-abcd-1234567890ab", "admin")
print(f"Admin Token: {admin_token}")
