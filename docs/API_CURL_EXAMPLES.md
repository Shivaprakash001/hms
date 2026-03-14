# 🌐 API cURL Examples

```bash
# Obtain Token
TOKEN=$(curl -s -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePassword123!"
  }' | jq -r '.access_token')

# Get Current Account Details
curl -X GET "http://localhost:8000/api/v1/auth/me" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Create New Room
curl -X POST "http://localhost:8000/api/v1/rooms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "room_no": "101",
    "floor": 1,
    "capacity": 3,
    "rent": 5000,
    "amenities": ["WiFi", "AC", "Attached Bathroom"],
    "status": "AVAILABLE"
  }' | jq .
```
