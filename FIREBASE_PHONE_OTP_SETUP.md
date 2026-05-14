# Firebase Phone OTP Setup

## Scope

Firebase is used only as an additional mobile verification layer. It does not replace the existing app authentication, session cookies, Supabase/local password flow, or tenant onboarding login.

## Firebase Console

1. Create or open a Firebase project.
2. Go to **Authentication > Sign-in method**.
3. Enable **Phone** provider.
4. Add your local and production domains in **Authentication > Settings > Authorized domains**:
   - `localhost`
   - your deployed frontend domain
5. Go to **Project settings > General > Your apps** and create/select a Web app.
6. Copy the Web SDK config values.
7. Go to **Project settings > Service accounts** and generate a private key for backend token verification.

## Frontend environment variables

Add these to the Vite frontend environment:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

For the current Firebase project:

```env
VITE_FIREBASE_API_KEY=AIzaSyC8dFXYqptsGOcrAfopEnJ1XZoMb6vpD0o
VITE_FIREBASE_AUTH_DOMAIN=trishul-sol.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=trishul-sol
VITE_FIREBASE_STORAGE_BUCKET=trishul-sol.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=521463125627
VITE_FIREBASE_APP_ID=1:521463125627:web:123475887151827a1d34de
VITE_FIREBASE_MEASUREMENT_ID=G-DS4LT4XKF8
```

These are Firebase client identifiers and are safe to expose in browser builds when Firebase Authentication authorized domains and provider settings are configured correctly.

## Backend environment variables

Add these to the backend/Next environment:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Do not expose the service account private key in frontend code.

## Database migration

Run the migration:

```sql
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS mobile_verified boolean NOT NULL DEFAULT false;

ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS mobile_verified boolean NOT NULL DEFAULT false;
```

The migration file is `migrations/058_add_mobile_verified.sql`.

## Owner flow

1. Owner enters name, email, mobile number, and password.
2. Frontend sends OTP using Firebase Phone Authentication with invisible reCAPTCHA.
3. Owner enters OTP.
4. Firebase returns an ID token for the verified phone number.
5. `/api/auth/register` verifies the Firebase ID token server-side using Firebase Admin.
6. Backend normalizes the submitted mobile to `+91XXXXXXXXXX` and checks it matches `decoded.phone_number`.
7. Owner profile is created only after verification and stores `mobile_verified = true`.

## Tenant flow

1. Tenant logs in/opens onboarding through the existing flow.
2. Tenant enters profile details and mobile number.
3. Frontend sends and verifies OTP through Firebase.
4. `tenantService.completeMyProfile` includes the Firebase phone ID token in `profile_data`.
5. `/api/tenants/me/complete-profile` verifies the token server-side and checks the phone match.
6. Tenant profile completion proceeds only after verification and stores `profiles.mobile_verified = true` and `tenants.mobile_verified = true`.

## Abuse controls

Firebase Phone Authentication provides built-in throttling and reCAPTCHA protection. The UI also includes a 60-second resend countdown. For stricter production controls, configure Firebase quotas/alerts and monitor phone-auth usage in Firebase Console.
