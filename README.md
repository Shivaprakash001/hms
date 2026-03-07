# Hostel Management System (HMS)

A professional, secure, and production-ready backend for a modern Hostel Management System. Built with **FastAPI** and **Supabase**, this project follows an industry-standard service-oriented architecture with strict business rules and atomic database operations.

## 🚀 Key Features

### 🔐 Authentication & Authorization
- **JWT Bearer Authentication**: Secure stateless authentication using `python-jose`.
- **Role-Based Access Control (RBAC)**: Fine-grained permissions for `Admin`, `Warden`, and `Student` roles.
- **Secure Password Hashing**: Utilizes `Passlib` with `Bcrypt` and automatic salt management.
- **Ownership Validation**: Students are restricted to accessing only their own data (profiles, payments, allocations).

### 🏠 Room Allocation & Management
- **Atomic Operations**: Core allocation logic is implemented via PostgreSQL RPCs with row-level locking (`FOR UPDATE`) to prevent double-booking or race conditions.
- **Historical Tracking**: Maintains a complete audit trail of all student-room shifts and residencies.
- **Smart Shifting**: Atomic room-to-room shifts that ensure data integrity.

### 💳 Payments & Billing
- **Obligation-Based Accounting**: Separates rent obligations from actual payments for robust accounting.
- **Prorated Rent**: Automatic calculation of rent based on stay duration for mid-month entries or exits.
- **Dues Reporting**: Real-time tracking of outstanding balances and payment statuses (Paid, Partial, Overdue).

### 🛠️ Complaints & Maintenance
- **Student Portal**: Students can report maintenance issues with categories (Electric, Plumbing, etc.) and priority levels.
- **Resolution Tracking**: Wardens/Admins can track issues from `Pending` to `Resolved` with staff remarks.

### 📡 Core Infrastructure
- **Lightweight Event Hooks**: A decoupled internal messaging system for side effects (e.g., student exit automatically ends room allocation).
- **Standardized Responses**: Consistent API response structure for success and error handling.
- **Database Migrations**: Comprehensive SQL scripts for all schema changes and ENUM types.

---

## 🛠️ Tech Stack

- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Validation**: [Pydantic v2](https://docs.pydantic.dev/)
- **Auth**: JWT with `python-jose` & `passlib`
- **Dependency Management**: `uv` or `pip`

---

## 🏗️ Architecture

The project follows a modular, service-based pattern:

```text
backend/app/
├── api/             # FastAPI Routers & HTTP Handlers
├── services/        # Business Logic & Core Domain Operations
├── schamas/         # Pydantic Request/Response Models
├── utils/           # Shared Utilities (Auth, Hooks, Transactions)
└── db.py            # Database client initialization
```

---

## ⚙️ Setup & Installation

### 1. Prerequisites
- Python 3.10 or higher
- A Supabase project (URL and Secret Key)

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_role_key
JWT_SECRET_KEY=your_secure_random_key
```

### 3. Install Dependencies
```bash
# Using pip
pip install -r requirements.txt

# Or using uv (recommended)
uv pip install -r requirements.txt
```

### 4. Database Setup
Execute the SQL migration scripts located in the `migrations/` directory in sequential order using the Supabase SQL Editor.

### 5. Run the Server
```bash
cd backend
python3 -m uvicorn app.main:app --reload
```
The API documentation will be available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

---

## 📖 Module Documentation

Detailed guides for specific modules:
- [Room Allocation Guide](ROOM_ALLOCATION_GUIDE.md)
- [Payments & Billing Guide](PAYMENTS_MODULE_GUIDE.md)
- [Complaints & Maintenance Guide](COMPLAINTS_MODULE_GUIDE.md)

---

## 📝 License
Proprietary. All rights reserved.
