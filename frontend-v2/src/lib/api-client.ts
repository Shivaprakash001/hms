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

api.interceptors.request.use(
  (config) => {
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      if (config.headers) delete config.headers['Content-Type'];
    }
    const ownerData = localStorage.getItem('ownerUser');
    const tenantData = localStorage.getItem('tenantUser');
    let token: string | null = null;
    if (ownerData) token = JSON.parse(ownerData).token;
    else if (tenantData) token = JSON.parse(tenantData).token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
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

        const ownerRaw = localStorage.getItem('ownerUser');
        const tenantRaw = localStorage.getItem('tenantUser');
        if (ownerRaw) {
          const parsed = JSON.parse(ownerRaw);
          parsed.token = newAccessToken;
          localStorage.setItem('ownerUser', JSON.stringify(parsed));
        } else if (tenantRaw) {
          const parsed = JSON.parse(tenantRaw);
          parsed.token = newAccessToken;
          localStorage.setItem('tenantUser', JSON.stringify(parsed));
        }

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch {
        localStorage.removeItem('ownerUser');
        localStorage.removeItem('tenantUser');
        window.location.href = '/login';
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
