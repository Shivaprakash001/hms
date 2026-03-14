# Environment Setup Guide

This guide details the required environment variables for running the Hostel Management System (HMS) locally and in production.

## 🔒 Security Best Practices

- **Never** commit `.env` files to version control.
- Use the `.env.example` files provided in both `frontend` and `backend` directories as templates.
- Keep your secrets strictly confidential.

---

## 🛠 Backend Environment Variables (`/.env` or `/backend/.env`)

The backend requires the following configuration variables:

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `SUPABASE_URL` | Your Supabase project URL | `https://your-project.supabase.co` |
| `SUPABASE_KEY` | Public anon key for Supabase client | `eyJhbGciOiJIUzI1Ni...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret service role key for admin tasks | `eyJhbGci...` |
| `SMTP_HOST` | Hostname for your email provider's SMTP server | `smtp.gmail.com` |
| `SMTP_PORT` | Port for the SMTP server | `587` |
| `SMTP_USER` | Email address used for authentication | `youremail@example.com` |
| `SMTP_PASS` | Password or app-specific password for the email | `your-smtp-password` |
| `RAZORPAY_WEBHOOK_SECRET` | Secret used to verify incoming webhooks | `hms_webhook_secret` |
| `RAZORPAY_KEY_ID` | Your Razorpay account Key ID | `rzp_test_...` |
| `RAZORPAY_KEY_SECRET` | Your Razorpay account Key Secret | `your_secret_key` |

> **Note:** For Gmail SMTP, it is highly recommended to use App Passwords.

---

## 💻 Frontend Environment Variables (`/frontend/.env`)

The frontend applications config uses Vite and requires these values:

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `VITE_GOOGLE_CLIENT_ID` | Your Google OAuth Client ID for sign-in | `12345-abc.apps.google.com` |
| `VITE_API_URL` | Base URL of your backend API | `http://localhost:8000` |

---

## 🚀 Environment Validation Script

You can verify that you have configured your `.env` files correctly by running the validation script:

```bash
bash scripts/validate_env.sh
```
This will check if the required variables are populated in your `.env` files.
