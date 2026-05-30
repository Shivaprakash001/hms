import crypto from "crypto";

export const CSRF_COOKIE_NAME = "hms_csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

export function generateCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function getCsrfCookieOptions(maxAge: number) {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: false,
    secure: isProd,
    sameSite: "lax" as const,
    maxAge,
    path: "/",
  };
}

export function setCsrfCookie(response: { cookies: { set: Function } }, maxAge: number) {
  response.cookies.set(CSRF_COOKIE_NAME, generateCsrfToken(), getCsrfCookieOptions(maxAge));
}

export function isUnsafeMethod(method: string) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

export function isValidCsrfPair(cookieToken?: string | null, headerToken?: string | null) {
  if (!cookieToken || !headerToken) return false;
  if (cookieToken.length < 32 || headerToken.length < 32) return false;
  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);
  if (cookieBuffer.length !== headerBuffer.length) return false;
  return crypto.timingSafeEqual(cookieBuffer, headerBuffer);
}
