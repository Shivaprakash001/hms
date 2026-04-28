import axios from 'axios';

// Force production traffic to the Vercel API deployment.
// This avoids stale/misconfigured VITE_API_URL values causing requests to hit
// legacy backends (which return errors like: permission denied for schema public).
const PRODUCTION_API_URL = 'https://hms-r68g.vercel.app/api';
const isLocalDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';

let baseURL;
if (isLocalDev) {
    baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
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
        // A forced JSON content-type causes FastAPI to miss UploadFile fields.
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
    (error) => {
        if (error.response && error.response.status === 401) {
            // Clear local storage on unauthorized
            localStorage.removeItem('ownerUser');
            localStorage.removeItem('tenantUser');
            // Allow the application state to handle the redirect naturally
            // rather than forcing a full page reload which causes flickering loops
        }
        return Promise.reject(error);
    }
);

export default api;
