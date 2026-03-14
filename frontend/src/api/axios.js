import axios from 'axios';

const api = axios.create({
    baseURL: (import.meta.env.VITE_API_URL || 'https://trishul-solutions1.onrender.com') + '/api/v1', 
    headers: {
        'Content-Type': 'application/json',
    },
});

console.log('API Base URL:', api.defaults.baseURL);

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
