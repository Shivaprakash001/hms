# 🏨 Room Allocation Module - Technical Reference

## 🎯 Purpose
Manages student-to-room assignments, capacity enforcement, and allocation history.

---

## 🔧 Setup

### 1. Database Migration
Run `migrations/007_create_room_allocation_tables.sql` in Supabase SQL Editor.

### 2. Required Data
Ensure `profiles` and `students` modules are working.
Add rooms manually or via API:
```sql
INSERT INTO rooms (room_no, capacity) VALUES ('101', 4), ('102', 4);
```

---

## 📡 API Endpoints

### Allocation Management

| Method | Endpoint | Description | Auth Role |
|--------|----------|-------------|-----------|
| `POST` | `/allocations/` | Allocate room to student | Admin/Warden |
| `PATCH` | `/allocations/{id}/end` | End an active allocation | Admin/Warden |
| `POST` | `/allocations/shift` | Move student to new room | Admin/Warden |
| `GET` | `/allocations/student/{id}`| Student's history | Admin/Warden/Own |

### Room Intelligence

| Method | Endpoint | Description | Auth Role |
|--------|----------|-------------|-----------|
| `GET` | `/allocations/rooms/{id}/occupants` | List active occupants | Admin/Warden |

---

## 🧠 Core Business Logic

### 1. Allocation Rules
- **Rule 1 — Student Active**: Only profiles with `status = 'ACTIVE'` can be allocated rooms.
- **Rule 2 — Single Allocation**: A student can possess exactly **one** room where `end_date IS NULL`. Enforced by DB Unique Index.
- **Rule 3 — Capacity Protection**: Service layer validates `COUNT(active) < capacity` before insertion.
- **Rule 4 — Immutable History**: We never delete rows. We set `end_date`.

### 2. Atomic Shifting
The `/shift` endpoint performs two steps:
1. Ends the current allocation at `shift_date - 1`.
2. Starts a new allocation at `shift_date`.
*Rolls back the first step if the second fails (simulated transaction).*

### 3. Auto-Deallocation ⚡
When a student's status is changed to `LEFT` (via `PUT /students/{id}` or soft delete):
1. The `student_left` hook is triggered.
2. The system automatically finds the active allocation and sets `end_date = today`.

---

## 🔒 Security & Authorization
- Uses **JWT Authentication**.
- Roles: `admin`, `warden`, `student`.
- **RBAC**: Management operations restricted to `admin` and `warden`.
- **Ownership**: Students can only view their own history.

---

## 📁 File Structure
- `backend/app/schamas/room_allocation_schema.py`: Pydantic models.
- `backend/app/services/room_allocation_service.py`: Business logic.
- `backend/app/api/routes/room_allocation_router.py`: API endpoints.
- `backend/app/utils/hooks.py`: Domain event system.

---

## 🧪 Quick Test Scenarios
1. **Double Allocate**: Try to allocate a student who already has a room (Should fail).
2. **Room Full**: Overfill room 101 (Should fail on last attempt).
3. **Student Left**: Change a student to `LEFT` and verify their room is now empty.
4. **Shift Room**: Shift student A from 101 to 102 and check dates.
