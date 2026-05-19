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
