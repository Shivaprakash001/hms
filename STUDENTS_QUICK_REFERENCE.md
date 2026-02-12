# Students API - Quick Reference Card

## 🚀 Quick Start

### 1. Run Migration
```sql
-- Supabase SQL Editor
-- Run: migrations/005_create_students_table.sql
```

### 2. Test Endpoints
Swagger UI: http://localhost:8000/docs

---

## 📡 Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/students/` | Admin/Warden | Create enrollment |
| GET | `/students/` | Admin/Warden | List all |
| GET | `/students/{id}` | All* | Get by ID |
| GET | `/students/by-profile/{id}` | All* | Get by profile |
| PUT | `/students/{id}` | Admin/Warden | Update |
| DELETE | `/students/{id}` | Admin only | Soft delete |
| POST | `/students/{id}/reactivate` | Admin/Warden | Reactivate |

*Students can only view own record

---

## 🔐 Headers

```http
x-user-role: admin|warden|student
x-user-id: {profile-uuid}
```

---

## ⭐ Status State Machine

```
APPLIED → ACTIVE → LEFT → ARCHIVED
            ↓
       BLACKLISTED → ARCHIVED
```

**Invalid:** LEFT → ACTIVE (use reactivate instead)

---

## 📝 Create Student

```bash
curl -X POST http://localhost:8000/students/ \
  -H "Content-Type: application/json" \
  -H "x-user-role: admin" \
  -d '{
    "profile_id": "uuid",
    "monthly_rent": 5000,
    "joined_on": "2024-01-15",
    "status": "ACTIVE"
  }'
```

**Validation:**
- ✅ Profile exists & active
- ✅ Profile role = student
- ✅ Not already enrolled
- ✅ joined_on not future
- ✅ rent > 0

---

## 📚 List Students

```bash
curl "http://localhost:8000/students/?status=ACTIVE&limit=50" \
  -H "x-user-role: admin"
```

**Filters:**
- `status` - APPLIED, ACTIVE, LEFT, etc.
- `joined_after` - Date
- `joined_before` - Date
- `search` - Name/email
- `limit` - 1-100 (default 50)
- `offset` - Pagination

---

## ✏️ Update Student

```bash
curl -X PUT http://localhost:8000/students/{id} \
  -H "Content-Type: application/json" \
  -H "x-user-role: admin" \
  -d '{
    "monthly_rent": 6000,
    "status": "LEFT"
  }'
```

**Rules:**
- Status must follow state machine
- Rent must be > 0
- Status → LEFT ends room allocation

---

## 🗑️ Soft Delete

```bash
curl -X DELETE http://localhost:8000/students/{id} \
  -H "x-user-role: admin"
```

**Result:** Sets status = LEFT (never removes row)

---

## 🔁 Reactivate

```bash
curl -X POST http://localhost:8000/students/{id}/reactivate \
  -H "Content-Type: application/json" \
  -H "x-user-role: admin" \
  -d '{
    "monthly_rent": 5500,
    "joined_on": "2024-06-01"
  }'
```

**Requires:** Student status = LEFT

---

## ❌ Common Errors

| Code | Status | Meaning |
|------|--------|---------|
| RES_001 | 404 | Student not found |
| RES_002 | 409 | Already enrolled |
| VAL_001 | 422 | Invalid transition |
| AUTH_002 | 403 | Forbidden |

---

## 🧪 Test Scenarios

### ✅ Valid
```bash
# Create → Update → Soft Delete → Reactivate
```

### ❌ Invalid
```bash
# Create for admin role → 403
# Duplicate enrollment → 409
# LEFT → ACTIVE → 422 (use reactivate)
# Student view all → 403
```

---

## 📊 Database

**Table:** `students`

**Key Columns:**
- `id` - UUID (PK)
- `profile_id` - UUID (UNIQUE, FK)
- `monthly_rent` - DECIMAL (> 0)
- `joined_on` - DATE
- `status` - TEXT (enum)

**Indexes:**
- profile_id
- status
- joined_on

---

## 🔄 Integration Points

**Current:** Standalone

**Future:**
- Room Allocation (auto-close on LEFT)
- Payments (generate on create)
- Attendance (track student)
- Complaints (link to student)

---

## 📁 Files

```
backend/app/
├── schamas/student_schema.py
├── services/student_service.py
└── api/routes/student_router.py

migrations/
└── 005_create_students_table.sql

Documentation:
├── STUDENTS_MODULE_GUIDE.md
└── STUDENTS_IMPLEMENTATION_SUMMARY.md
```

---

**Status:** ✅ READY FOR TESTING  
**Next:** Run migration → Test in Swagger → Create room allocation module
