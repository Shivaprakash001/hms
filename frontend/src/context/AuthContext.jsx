import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        // If user is already logged in, redirect unless on public page
        const publicPaths = ['/login', '/register', '/'];
        if (user && publicPaths.includes(location.pathname)) {
            const role = user.role?.toLowerCase();
            if (role === 'owner' || role === 'admin') {
                if (!location.pathname.startsWith('/owner')) {
                    navigate('/owner/dashboard', { replace: true });
                }
            } else if (role === 'student') {
                if (!location.pathname.startsWith('/student')) {
                    navigate('/student/dashboard', { replace: true });
                }
            }
        }
    }, [user, location.pathname, navigate]);

    useEffect(() => {
        const initAuth = async () => {
            const storedStudent = localStorage.getItem('studentUser');
            const storedOwner = localStorage.getItem('ownerUser');
            const storedData = storedOwner ? JSON.parse(storedOwner) : (storedStudent ? JSON.parse(storedStudent) : null);

            if (storedData?.token) {
                try {
                    // Force refresh user info from backend to ensure student_id and other fields are present
                    const response = await api.get('/auth/me');
                    const updatedUser = {
                        ...storedData,
                        ...response.data,
                        id: response.data.user_id,
                        student_id: response.data.student_id,
                        due_day: response.data.due_day,
                        room_no: response.data.room_no,
                        monthly_rent: response.data.monthly_rent,
                        room_capacity: response.data.room_capacity,
                        room_id: response.data.room_id,
                    };
                    setUser(updatedUser);

                    if (updatedUser.role?.toLowerCase() === 'owner' || updatedUser.role?.toLowerCase() === 'admin') {
                        localStorage.setItem('ownerUser', JSON.stringify(updatedUser));
                    } else {
                        localStorage.setItem('studentUser', JSON.stringify(updatedUser));
                    }
                } catch (error) {
                    console.error("Session verification failed:", error);
                    // Only logout if it's a 401/403 (handled by interceptor usually, but here for safety)
                    if (error.response?.status === 401) {
                        logout();
                    } else {
                        setUser(storedData);
                    }
                }
            }
            setLoading(false);
        };
        initAuth();
    }, []);

    const login = async (email, password) => {
        try {
            const response = await api.post('/auth/login', { email, password });
            const { access_token, role, name, user_id, student_id } = response.data;
            const userData = { email, role, name, id: user_id, student_id, token: access_token };
            setUser(userData);

            if (role === 'owner' || role === 'admin') {
                localStorage.setItem('ownerUser', JSON.stringify(userData));
                localStorage.removeItem('studentUser');
            } else {
                localStorage.setItem('studentUser', JSON.stringify(userData));
                localStorage.removeItem('ownerUser');
            }

            return userData;
        } catch (error) {
            console.error("Login failed:", error);
            const detail = error.response?.data?.detail;
            const message = typeof detail === 'object' ? detail.message : detail;
            throw new Error(message || error.message || 'Login failed');
        }
    };

    const loginWithGoogle = async (code, redirectUri) => {
        try {
            // Pass the redirect_uri so the backend can use the same value when exchanging the code with Google
            const response = await api.post('/auth/google-callback', { code, redirect_uri: redirectUri });
            const { access_token, role, name, user_id, student_id } = response.data;
            const userData = { role, name, id: user_id, student_id, token: access_token };
            setUser(userData);

            if (role === 'owner' || role === 'admin') {
                localStorage.setItem('ownerUser', JSON.stringify(userData));
                localStorage.removeItem('studentUser');
            } else {
                localStorage.setItem('studentUser', JSON.stringify(userData));
                localStorage.removeItem('ownerUser');
            }

            return userData;
        } catch (error) {
            console.error("Google login failed:", error);
            throw new Error(error.response?.data?.detail || 'Google authentication failed');
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('studentUser');
        localStorage.removeItem('ownerUser');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loginWithGoogle, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
