import axios from 'axios';

// Determine the API base URL:
// In production (browser not on localhost), ALWAYS use the Render backend URL
// to prevent any accidental localhost references from build-time env vars.
// In development (localhost), use the env var or fall back to localhost:8000.
// Backend is now Next.js on Vercel — all API routes live under /api/
const PRODUCTION_API_URL = '/api';
const isLocalDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';

let baseURL;
if (isLocalDev) {
    baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
} else {
    baseURL = import.meta.env.VITE_API_URL || PRODUCTION_API_URL;
}


const api = axios.create({
    baseURL,
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
