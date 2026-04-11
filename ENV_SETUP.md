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
| `APP_ENV` | Runtime environment (`development`/`production`) | `production` |
| `SMTP_HOST` | Hostname for your email provider's SMTP server | `smtp.gmail.com` |
| `SMTP_PORT` | Port for the SMTP server | `587` |
| `SMTP_USER` | Email address used for authentication | `youremail@example.com` |
| `SMTP_PASS` | Password or app-specific password for the email | `your-smtp-password` |
| `RESEND_API_KEY` | Resend API key for invitation/notification emails | `re_...` |
| `FRONTEND_URL` | Public frontend base URL used in activation links | `https://trishul.solutions` |
| `EXPOSE_ACTIVATION_LINK` | Expose activation links in API response (testing only) | `false` |
| `RAZORPAY_WEBHOOK_SECRET` | Secret used to verify incoming webhooks | `hms_webhook_secret` |
| `RAZORPAY_KEY_ID` | Your Razorpay account Key ID | `rzp_test_...` |
| `RAZORPAY_KEY_SECRET` | Your Razorpay account Key Secret | `your_secret_key` |
| `RECEIPT_VERIFY_BASE_URL` | Public API base URL for receipt verification links/QR (`/{payment_id}` is appended automatically) | `https://trishul-solutions1.onrender.com/payments/verify/receipt` |
| `UPI_ID` | Optional global fallback UPI ID for direct UPI mode (if owner UPI not used) | `hostel@oksbi` |
| `PHONEPE_UPI_PAYEE_NAME` | Payee name shown in direct UPI intents | `Trishul Hostel` |
| `PHONEPE_MERCHANT_ID` | PhonePe merchant ID (Hosted PG mode) | `M23JHAKJOAJAC` |
| `PHONEPE_CLIENT_ID` | PhonePe OAuth client id (Hosted PG mode) | `...` |
| `PHONEPE_CLIENT_SECRET` | PhonePe OAuth client secret (Hosted PG mode) | `...` |
| `PHONEPE_BASE_URL` | PhonePe API base URL | `https://api-preprod.phonepe.com/apis/pg-sandbox` |
| `PHONEPE_REDIRECT_URL` | Frontend redirect URL after payment | `https://trishul.solutions/payment-return` |
| `PHONEPE_CALLBACK_URL` | Backend webhook callback URL | `https://api.trishul.solutions/webhooks/phonepe` |

> **Note:** For Gmail SMTP, it is highly recommended to use App Passwords.

### ✅ Minimum setup for successful tenant payments

At owner level (in app):
- Hostel Details → `upi_id` (required for direct UPI fallback)
- Preferences → `phonepe_merchant_id` (recommended for PhonePe PG mapping)

At backend deployment:
- For direct UPI fallback only: no PhonePe OAuth credentials required.
- For Hosted PhonePe checkout: set `PHONEPE_CLIENT_ID`, `PHONEPE_CLIENT_SECRET`, `PHONEPE_BASE_URL` and callback/redirect URLs.

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
