import axios from 'axios';

// Production frontend and backend are deployed as separate apps right now.
// Until `api.trishul.solutions` is fully pointed at the Vercel backend,
// the frontend should target the direct Vercel API deployment.
const PRODUCTION_API_URL = 'https://hms-r68g.vercel.app/api';
const isLocalDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';

const normalizeProductionApiUrl = (rawUrl) => {
    if (!rawUrl) {
        return PRODUCTION_API_URL;
    }

    // Temporary safety: if env still points to legacy API domain,
    // route production traffic to the known-good Vercel backend.
    if (rawUrl.includes('api.trishul.solutions')) {
        return PRODUCTION_API_URL;
    }

    // Preserve relative paths for same-origin setups.
    if (rawUrl.startsWith('/')) {
        return rawUrl.endsWith('/api') ? rawUrl : `${rawUrl.replace(/\/$/, '')}/api`;
    }

    try {
        const parsed = new URL(rawUrl);
        const normalizedPath = parsed.pathname.endsWith('/api')
            ? parsed.pathname
            : `${parsed.pathname.replace(/\/$/, '')}/api`;

        return `${parsed.origin}${normalizedPath}`;
    } catch {
        return rawUrl;
    }
};

let baseURL;
if (isLocalDev) {
    baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
} else {
    baseURL = normalizeProductionApiUrl(import.meta.env.VITE_API_URL);
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
        const studentData = localStorage.getItem('studentUser');

        let token = null;
        if (ownerData) {
            token = JSON.parse(ownerData).token;
        } else if (studentData) {
            token = JSON.parse(studentData).token;
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
            localStorage.removeItem('studentUser');
            // Allow the application state to handle the redirect naturally
            // rather than forcing a full page reload which causes flickering loops
        }
        return Promise.reject(error);
    }
);

export default api;
