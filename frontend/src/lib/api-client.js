import axios from 'axios';

// Force production traffic to the primary API domain.
// This avoids stale/misconfigured VITE_API_URL values.
const PRODUCTION_API_URL = 'https://api.sriadithyahostels.in/api';
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);
const isLocalDev = typeof window !== 'undefined' && LOCAL_HOSTNAMES.has(window.location.hostname);

let baseURL;
if (isLocalDev) {
    baseURL = '/api';
} else {
    baseURL = PRODUCTION_API_URL;
}


const api = axios.create({
    baseURL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});


const CSRF_COOKIE_NAME = 'hms_csrf';

const getCookieValue = (name) => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie
        .split('; ')
        .find((part) => part.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
};

const isUnsafeMethod = (method) =>
    ['post', 'put', 'patch', 'delete'].includes(String(method || 'get').toLowerCase());

const attachCsrfHeader = (headers, method) => {
    if (!isUnsafeMethod(method)) return;
    const csrfToken = getCookieValue(CSRF_COOKIE_NAME);
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
};

// Add a request interceptor to include the auth token
api.interceptors.request.use(
    (config) => {
        // For multipart requests, let the browser/axios set the boundary automatically.
        if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
            if (config.headers) {
                delete config.headers['Content-Type'];
            }
        }

        // Check both potential storage keys used in AuthContext
        const ownerData = localStorage.getItem('ownerUser');
        const tenantData = localStorage.getItem('tenantUser');

        let token = null;
        if (ownerData) {
            token = JSON.parse(ownerData).token;
        } else if (tenantData) {
            token = JSON.parse(tenantData).token;
        }

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Attach CSRF token for state-mutating requests
        if (config.headers) attachCsrfHeader(config.headers, config.method);

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add a response interceptor to handle errors
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const requestUrl = originalRequest?.url || '';
        const isPublicAuthFlow = [
            '/auth/login',
            '/auth/register',
            '/auth/send-otp',
            '/auth/verify-otp',
            '/auth/refresh',
        ].some((path) => requestUrl.includes(path));

        if (error.response && error.response.status === 401 && !isPublicAuthFlow && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                // Attempt to refresh the token using the httpOnly cookie
                const refreshResponse = await axios.post(`${baseURL}/auth/refresh`, {}, {
                    withCredentials: true // Important: send the httpOnly cookie
                });

                const newAccessToken = refreshResponse.data.access_token;

                // Update localStorage with the new token
                const ownerData = localStorage.getItem('ownerUser');
                const tenantData = localStorage.getItem('tenantUser');

                if (ownerData) {
                    const parsed = JSON.parse(ownerData);
                    parsed.token = newAccessToken;
                    localStorage.setItem('ownerUser', JSON.stringify(parsed));
                } else if (tenantData) {
                    const parsed = JSON.parse(tenantData);
                    parsed.token = newAccessToken;
                    localStorage.setItem('tenantUser', JSON.stringify(parsed));
                }

                // Update the authorization header and retry the original request
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                attachCsrfHeader(originalRequest.headers, originalRequest.method);
                return api(originalRequest);
            } catch (refreshError) {
                // Refresh failed (e.g. refresh token expired or invalid)
                localStorage.removeItem('ownerUser');
                localStorage.removeItem('tenantUser');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }
        
        return Promise.reject(error);
    }
);

export default api;

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const requestWithRetry = async (fn, { retries = 2, delayMs = 1500 } = {}) => {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const status = error?.response?.status;
            const shouldRetry = !status || [502, 503, 504].includes(status);
            if (!shouldRetry || attempt === retries) {
                throw error;
            }
            await sleep(delayMs * (attempt + 1));
        }
    }
    throw lastError;
};
