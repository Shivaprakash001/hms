import axios from 'axios';

const configuredApiUrl = import.meta.env.VITE_API_URL;
const DEFAULT_PRODUCTION_API_URL = 'https://api.sriadithyahostels.in/api';
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);
const isLocalDev =
  typeof window !== 'undefined' && LOCAL_HOSTNAMES.has(window.location.hostname);
const isSriAdithyaProduction =
  typeof window !== 'undefined' &&
  ['sriadithyahostels.in', 'www.sriadithyahostels.in'].includes(window.location.hostname);

const normalizeApiUrl = (value?: string) => {
  const trimmed = typeof value === 'string' ? value.trim().replace(/\/$/, '') : '';
  if (!trimmed) return DEFAULT_PRODUCTION_API_URL;
  if (/\/api$/i.test(trimmed)) return trimmed;

  try {
    const parsed = new URL(trimmed);
    if (!parsed.pathname || parsed.pathname === '/') return `${parsed.origin}/api`;
  } catch {
    return DEFAULT_PRODUCTION_API_URL;
  }

  return trimmed;
};

const baseURL = isLocalDev
  ? '/api'
  : isSriAdithyaProduction
    ? DEFAULT_PRODUCTION_API_URL
    : normalizeApiUrl(configuredApiUrl);

const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let inMemoryAccessToken: string | null = null;
let inMemoryCsrfToken: string | null = null;
let csrfBootstrapPromise: Promise<string | null> | null = null;
const CSRF_COOKIE_NAME = 'hms_csrf';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

const getCookieValue = (name: string) => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
};

const isUnsafeMethod = (method?: string) =>
  ['post', 'put', 'patch', 'delete'].includes(String(method || 'get').toLowerCase());

const attachCsrfHeader = (headers: any, method?: string) => {
  if (!isUnsafeMethod(method)) return;
  const csrfToken = getCookieValue(CSRF_COOKIE_NAME) || inMemoryCsrfToken;
  if (csrfToken) headers[CSRF_HEADER_NAME] = csrfToken;
};

const rememberCsrfToken = (headers?: any) => {
  const token =
    headers?.[CSRF_HEADER_NAME] ||
    headers?.[CSRF_HEADER_NAME.toLowerCase()] ||
    headers?.get?.(CSRF_HEADER_NAME) ||
    headers?.get?.(CSRF_HEADER_NAME.toLowerCase());
  if (token) inMemoryCsrfToken = String(token);
  return inMemoryCsrfToken;
};

const ensureCsrfToken = async () => {
  const existing = getCookieValue(CSRF_COOKIE_NAME) || inMemoryCsrfToken;
  if (existing) return existing;
  if (!csrfBootstrapPromise) {
    csrfBootstrapPromise = axios
      .get(`${baseURL}/auth/me`, {
        withCredentials: true,
        headers: inMemoryAccessToken ? { Authorization: `Bearer ${inMemoryAccessToken}` } : undefined,
      })
      .then((response) => rememberCsrfToken(response.headers) || getCookieValue(CSRF_COOKIE_NAME))
      .catch(() => null)
      .finally(() => {
        csrfBootstrapPromise = null;
      });
  }
  return csrfBootstrapPromise;
};

export const setAccessToken = (token: string | null) => {
  inMemoryAccessToken = token;
};

export const clearAccessToken = () => {
  inMemoryAccessToken = null;
  inMemoryCsrfToken = null;
};

type SessionExpiryReason = 'inactive' | 'max_age' | 'reuse' | 'expired';

type SessionExpiryNotice = {
  message: string;
  reason: SessionExpiryReason;
};

const getSessionExpiryNotice = (data?: any): SessionExpiryNotice => {
  const error = data?.error || {};
  const code = String(error.code || data?.code || '').toUpperCase();
  const serverMessage = String(error.message || data?.message || '');

  if (code === 'SESSION_INACTIVE' || /inactive|30 minutes/i.test(serverMessage)) {
    return {
      reason: 'inactive',
      message: 'You were signed out because your account was inactive for more than 30 minutes.',
    };
  }

  if (code === 'SESSION_MAX_AGE_REACHED') {
    return {
      reason: 'max_age',
      message: 'You were signed out because this secure session reached its maximum duration.',
    };
  }

  if (code === 'SESSION_REUSE_DETECTED') {
    return {
      reason: 'reuse',
      message:
        'You were signed out because we detected unusual session activity. Please sign in again.',
    };
  }

  return {
    reason: 'expired',
    message:
      serverMessage ||
      'You were signed out because your secure session ended. Please sign in again.',
  };
};

const notifySessionExpired = (notice?: Partial<SessionExpiryNotice> | string) => {
  if (typeof window === 'undefined') return;
  const normalizedNotice =
    typeof notice === 'string'
      ? { message: notice, reason: 'expired' as SessionExpiryReason }
      : notice;
  window.dispatchEvent(
    new CustomEvent('hms:session-expired', {
      detail: {
        message:
          normalizedNotice?.message ||
          'You were signed out because your secure session ended. Please sign in again.',
        reason: normalizedNotice?.reason || 'expired',
      },
    }),
  );
};

api.interceptors.request.use(
  async (config) => {
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      if (config.headers) delete config.headers['Content-Type'];
    }
    if (inMemoryAccessToken) config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
    if (isUnsafeMethod(config.method)) await ensureCsrfToken();
    if (config.headers) attachCsrfHeader(config.headers, config.method);
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => {
    rememberCsrfToken(response.headers);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const requestUrl: string = originalRequest?.url || '';
    const isPublicAuthFlow = [
      '/auth/login',
      '/auth/register',
      '/auth/send-otp',
      '/auth/verify-otp',
      '/auth/refresh',
    ].some((path) => requestUrl.includes(path));

    if (
      error.response?.status === 401 &&
      !isPublicAuthFlow &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      try {
        const refreshResponse = await axios.post(
          `${baseURL}/auth/refresh`,
          {},
          { withCredentials: true },
        );
        const newAccessToken: string = refreshResponse.data.access_token;

        setAccessToken(newAccessToken);
        rememberCsrfToken(refreshResponse.headers);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        await ensureCsrfToken();
        attachCsrfHeader(originalRequest.headers, originalRequest.method);
        return api(originalRequest);
      } catch (refreshError: any) {
        clearAccessToken();
        localStorage.removeItem('ownerUser');
        localStorage.removeItem('tenantUser');
        notifySessionExpired(getSessionExpiryNotice(refreshError?.response?.data));
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);

export default api;

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export const requestWithRetry = async <T>(
  fn: () => Promise<T>,
  { retries = 2, delayMs = 1500 }: { retries?: number; delayMs?: number } = {},
): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status = (error as { response?: { status?: number } })?.response?.status;
      const shouldRetry = !status || [502, 503, 504].includes(status);
      if (!shouldRetry || attempt === retries) throw error;
      await sleep(delayMs * (attempt + 1));
    }
  }
  throw lastError;
};
