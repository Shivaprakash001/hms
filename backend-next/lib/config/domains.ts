export const PRODUCTION_FRONTEND_URL = "https://sriadithyahostels.in";
export const PRODUCTION_FRONTEND_WWW_URL = "https://www.sriadithyahostels.in";
export const PRODUCTION_BACKEND_URL = "https://api.sriadithyahostels.in";

const TEMPORARY_LEGACY_FRONTEND_ORIGINS = [
  "https://trishul.solutions",
  "https://www.trishul.solutions",
  "https://hms-sand-five.vercel.app",
  "https://hms-r68g.vercel.app",
  "https://hms-ep3rw8fe2-shivaprakash001s-projects.vercel.app",
];

function normalizeUrl(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    return parsed.origin;
  } catch {
    return withProtocol.replace(/\/+$/, "");
  }
}

function normalizeFullUrl(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw === "postmessage") return raw;

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.pathname === "/" && !parsed.search && !parsed.hash) return parsed.origin;
    return parsed.toString();
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

function envList(value?: string | null) {
  return String(value || "")
    .split(",")
    .map((item) => normalizeUrl(item))
    .filter(Boolean);
}

function joinUrl(base: string, path = "") {
  const cleanBase = normalizeUrl(base);
  if (!path) return cleanBase;
  return `${cleanBase}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getFrontendUrl() {
  return normalizeUrl(process.env.NEXT_PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL) || PRODUCTION_FRONTEND_URL;
}

export function getBackendUrl() {
  return normalizeUrl(
    process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.API_URL ||
      process.env.BACKEND_URL
  ) || PRODUCTION_BACKEND_URL;
}

export function frontendUrl(path = "") {
  return joinUrl(getFrontendUrl(), path);
}

export function backendUrl(path = "") {
  return joinUrl(getBackendUrl(), path);
}

export function getGoogleRedirectUri() {
  return normalizeFullUrl(process.env.GOOGLE_REDIRECT_URI) || frontendUrl("/callback");
}

export function getAllowedFrontendOrigins() {
  return Array.from(new Set([
    PRODUCTION_FRONTEND_URL,
    PRODUCTION_FRONTEND_WWW_URL,
    getFrontendUrl(),
    ...envList(process.env.CORS_ALLOWED_ORIGINS),
    ...envList(process.env.LEGACY_FRONTEND_ORIGINS),
    ...TEMPORARY_LEGACY_FRONTEND_ORIGINS,
  ].map((origin) => normalizeUrl(origin)).filter(Boolean)));
}

export function getCorsAllowOrigin(requestOrigin?: string | null) {
  const origin = normalizeUrl(requestOrigin);
  if (!origin) return PRODUCTION_FRONTEND_URL;
  return getAllowedFrontendOrigins().includes(origin) ? origin : PRODUCTION_FRONTEND_URL;
}
