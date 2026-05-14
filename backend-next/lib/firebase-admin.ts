import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function getFirebaseAdminApp() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin environment variables are not configured");
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export async function verifyFirebasePhoneToken(idToken: string, expectedPhone: string) {
  const decoded = await getAuth(getFirebaseAdminApp()).verifyIdToken(idToken, true);
  if (!decoded.phone_number || decoded.phone_number !== expectedPhone) {
    throw new Error("PHONE_VERIFICATION_FAILED: Verified phone does not match submitted phone");
  }
  return decoded.phone_number;
}

export function normalizeIndianPhone(value: string | null | undefined) {
  const cleaned = String(value || "").replace(/\D/g, "");
  if (cleaned.length === 10) return `+91${cleaned}`;
  if (cleaned.length === 12 && cleaned.startsWith("91")) return `+${cleaned}`;
  if (cleaned.length === 13 && cleaned.startsWith("091")) return `+${cleaned.substring(1)}`;
  return null;
}
