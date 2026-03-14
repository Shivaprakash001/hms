# 📚 HMS API Documentation

Professional Hostel Management System API with JWT authentication, role-based access control, and comprehensive endpoint documentation.

## 🔐 Authentication
- **Method**: JWT Bearer Token
- **Token Expiration**: 1 hour
- **Obtain Token**: `POST /api/v1/auth/login`

## ⏱️ Rate Limiting
- **Default Limit**: 100 requests/hour/user
- **Authentication Routes**: 5 requests/15 minutes
- **Endpoints**: Return proper HTTP 429 when limits are breached

## 👥 Roles
1. **Admin / Property Owner**: Full access across all module actions
2. **Student**: Scoped access restricted to own records

## 📖 Available Modules
- **Authentication**: Login, Registration, Password Changes
- **Profiles**: Profile Management
- **Students**: User details config
- **Rooms**: Room tracking, statuses
- **Room Allocations**: Managing tenant placements
- **Payments**: Webhooks tracking & verifications
- **Complaints**: Resolutions & ticketing
- **Notifications**: Automated triggers
- **Expenses**: Spending tracker
- **Dashboard**: Analytic views

Refer to the Swagger spec `/docs` locally to interact with the API interface.
