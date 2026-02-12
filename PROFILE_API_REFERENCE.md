# Profile API - Quick Reference

## 🔧 Setup Required

### 1. Run Database Migration
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);
```

### 2. Restart Server
```bash
cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 📡 API Endpoints

### Create Profile
```http
POST /profiles/
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "1234567890",
  "role": "student",
  "address": "Room 101",
  "emergency_contact": "9876543210"
}
```

### Get All Profiles
```http
GET /profiles/?role=student&limit=10&offset=0&include_inactive=false
```

### Get Profile by ID
```http
GET /profiles/{profile_id}
```

### Get Profile by Email
```http
GET /profiles/email/john@example.com
```

### Update Profile (Regular User)
```http
PUT /profiles/{profile_id}
Headers: x-user-role: student
Content-Type: application/json

{
  "name": "John Updated",
  "phone": "9999999999"
}
```

### Update Profile with Role (Admin Only)
```http
PUT /profiles/{profile_id}/admin
Headers: x-user-role: admin
Content-Type: application/json

{
  "role": "warden",
  "name": "John Admin Updated"
}
```

### Soft Delete Profile
```http
DELETE /profiles/{profile_id}
```

### Restore Deleted Profile
```http
POST /profiles/{profile_id}/restore
Headers: x-user-role: admin
```

---

## 🎯 Error Codes

| Code | Meaning | HTTP Status |
|------|---------|-------------|
| `DB_001` | Database connection error | 400 |
| `DB_002` | Database query error | 400 |
| `DB_003` | Constraint violation | 400 |
| `RES_001` | Resource not found | 404 |
| `RES_002` | Resource already exists | 409 |
| `RES_003` | Resource inactive | 400 |
| `VAL_001` | Validation error | 422 |
| `VAL_002` | Invalid input | 422 |
| `AUTH_001` | Unauthorized | 401 |
| `AUTH_002` | Forbidden | 403 |
| `AUTH_003` | Insufficient permissions | 403 |
| `SYS_001` | Internal error | 400 |

---

## 📝 Logging

Logs are written to:
- `logs/app_YYYYMMDD.log` - All logs
- `logs/errors_YYYYMMDD.log` - Errors only

Log levels:
- `DEBUG`: Detailed information
- `INFO`: Successful operations
- `WARNING`: Not found, validation issues
- `ERROR`: Database errors
- `EXCEPTION`: Unexpected errors with stack trace

---

## 🔐 Authorization

### Header-Based (Current)
```http
x-user-role: admin|student|warden
```

### Operations by Role

| Operation | Student | Warden | Admin |
|-----------|---------|--------|-------|
| Create profile | ✅ | ✅ | ✅ |
| View profiles | ✅ | ✅ | ✅ |
| Update own profile | ✅ | ✅ | ✅ |
| Change role | ❌ | ❌ | ✅ |
| Delete profile | ✅ | ✅ | ✅ |
| Restore profile | ❌ | ❌ | ✅ |
| View inactive | ❌ | ❌ | ✅ |

---

## 🧪 Testing Examples

### Test Soft Delete
```bash
# Delete
curl -X DELETE http://localhost:8000/profiles/{id}

# Verify deleted (should return 404)
curl http://localhost:8000/profiles/{id}

# View with inactive flag (admin)
curl "http://localhost:8000/profiles/?include_inactive=true"

# Restore
curl -X POST http://localhost:8000/profiles/{id}/restore \
  -H "x-user-role: admin"
```

### Test Role Change Authorization
```bash
# Should FAIL (non-admin)
curl -X PUT http://localhost:8000/profiles/{id} \
  -H "Content-Type: application/json" \
  -H "x-user-role: student" \
  -d '{"role": "admin"}'

# Should SUCCEED (admin endpoint)
curl -X PUT http://localhost:8000/profiles/{id}/admin \
  -H "Content-Type: application/json" \
  -H "x-user-role: admin" \
  -d '{"role": "warden"}'
```

---

## 🐛 Troubleshooting

### Server won't start
1. Check logs in `logs/errors_*.log`
2. Verify database connection in `.env`
3. Ensure all dependencies installed: `uv pip install -r requirements.txt`

### Soft delete not working
1. Run migration: `ALTER TABLE profiles ADD COLUMN is_active BOOLEAN DEFAULT true;`
2. Restart server
3. Check `logs/app_*.log` for errors

### Role changes not working
1. Verify using `/admin` endpoint
2. Check `x-user-role: admin` header
3. Review logs for authorization errors

---

## 📚 Documentation

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Full Summary**: `IMPROVEMENTS_SUMMARY.md`
- **Migrations**: `migrations/` directory
