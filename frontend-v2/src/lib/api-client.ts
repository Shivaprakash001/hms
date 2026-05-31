import axios from 'axios';

const PRODUCTION_API_URL = 'https://api.sriadithyahostels.in/api';
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);
const isLocalDev =
  typeof window !== 'undefined' && LOCAL_HOSTNAMES.has(window.location.hostname);

const baseURL = isLocalDev ? '/api' : PRODUCTION_API_URL;

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

const notifySessionExpired = (message?: string) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('hms:session-expired', {
      detail: {
        message:
          message ||
          'You were signed out because your secure session ended. Please sign in again.',
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
        notifySessionExpired(
          refreshError?.response?.data?.error?.message ||
            refreshError?.response?.data?.message,
        );
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
