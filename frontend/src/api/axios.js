import axios from 'axios';

// Determine the API base URL:
// In production (browser not on localhost), ALWAYS use the Render backend URL
// to prevent any accidental localhost references from build-time env vars.
// In development (localhost), use the env var or fall back to localhost:8000.
const PRODUCTION_API_URL = 'https://trishul-solutions1.onrender.com/api/v1';
const isLocalDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';

let baseURL;
if (isLocalDev) {
    const rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    baseURL = rawUrl.includes('/api/v1') ? rawUrl : `${rawUrl}/api/v1`;
} else {
    // In production, only use VITE_API_URL if it's NOT pointing to localhost
    const envUrl = import.meta.env.VITE_API_URL;
    const prodUrl = (envUrl && !envUrl.includes('localhost')) ? envUrl : PRODUCTION_API_URL;
    baseURL = prodUrl.includes('/api/v1') ? prodUrl : `${prodUrl}/api/v1`;
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
