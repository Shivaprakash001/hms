/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/axios';

const AuthContext = createContext(null);

const normalizeRole = (role) => (role || '').toString().toLowerCase();
const LOGIN_ERROR_MAP = {
    401: 'Incorrect email or password',
    404: 'Account not found',
    429: 'Too many login attempts. Try again later.',
    500: 'Something went wrong. Please try again.',
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const location = useLocation();
    const navigate = useNavigate();

    const logout = () => {
        setUser(null);
        localStorage.removeItem('studentUser');
        localStorage.removeItem('ownerUser');
    };

    useEffect(() => {
        // If user is already logged in, redirect unless on public page
        const publicPaths = ['/login', '/register', '/', '/payment-return'];
        const isPaymentReturnPath = location.pathname === '/payment-return';
        if (user && publicPaths.includes(location.pathname) && !isPaymentReturnPath) {
            const role = user.role?.toLowerCase();
            if (role === 'owner' || role === 'admin') {
                if (!location.pathname.startsWith('/owner')) {
                    navigate('/owner/dashboard', { replace: true });
                }
            } else if (role === 'tenant') {
                if (!location.pathname.startsWith('/tenant')) {
                    navigate('/tenant/dashboard', { replace: true });
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
                    // Force refresh user info from backend to ensure tenant_id and other fields are present
                    const response = await api.get('/auth/me');
                    const updatedUser = {
                        ...storedData,
                        ...response.data,
                        role: normalizeRole(response.data.role ?? storedData.role),
                        id: response.data.user_id,
                        tenant_id: response.data.tenant_id,
                        due_day: response.data.due_day,
                        room_no: response.data.room_no,
                        monthly_rent: response.data.monthly_rent,
                        room_capacity: response.data.room_capacity,
                        room_id: response.data.room_id,
                        is_profile_completed: response.data.is_profile_completed,
                    };
                    setUser(updatedUser);

                    if (normalizeRole(updatedUser.role) === 'owner' || normalizeRole(updatedUser.role) === 'admin') {
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
            const normalizedEmail = (email || '').trim().toLowerCase();
            const response = await api.post('/auth/login', { email: normalizedEmail, password });
            const { access_token, role, name, user_id, tenant_id, is_profile_completed } = response.data;
            const normalizedRole = normalizeRole(role);
            const userData = { email: normalizedEmail, role: normalizedRole, name, id: user_id, tenant_id, is_profile_completed, token: access_token };
            setUser(userData);

            if (normalizedRole === 'owner' || normalizedRole === 'admin') {
                localStorage.setItem('ownerUser', JSON.stringify(userData));
                localStorage.removeItem('studentUser');
            } else {
                localStorage.setItem('studentUser', JSON.stringify(userData));
                localStorage.removeItem('ownerUser');
            }

            return userData;
        } catch (error) {
            console.error("Login failed:", error);
            if (!error?.response) {
                throw new Error('Unable to connect. Check your internet.');
            }
            const status = error.response?.status;
            const detail = error.response?.data?.detail;
            const fallback = typeof detail === 'object' ? detail.message : detail;
            throw new Error(LOGIN_ERROR_MAP[status] || fallback || 'Something went wrong. Please try again.');
        }
    };

    const loginWithGoogle = async (code, redirectUri) => {
        try {
            // Pass the redirect_uri so the backend can use the same value when exchanging the code with Google
            const response = await api.post('/auth/google-callback', { code, redirect_uri: redirectUri });
            const { access_token, role, name, user_id, tenant_id, is_profile_completed } = response.data;
            const normalizedRole = normalizeRole(role);
            const userData = { role: normalizedRole, name, id: user_id, tenant_id, is_profile_completed, token: access_token };
            setUser(userData);

            if (normalizedRole === 'owner' || normalizedRole === 'admin') {
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

    return (
        <AuthContext.Provider value={{ user, login, logout, loginWithGoogle, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
