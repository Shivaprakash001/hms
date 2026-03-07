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
        // Check for stored user on mount
        const storedStudent = localStorage.getItem('studentUser');
        const storedOwner = localStorage.getItem('ownerUser');

        if (storedOwner) {
            setUser(JSON.parse(storedOwner));
        } else if (storedStudent) {
            setUser(JSON.parse(storedStudent));
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        try {
            const response = await api.post('/auth/login', { email, password });
            const { access_token, role, name, user_id } = response.data;

            const userData = { email, role, name, id: user_id, token: access_token };
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

    const logout = () => {
        setUser(null);
        localStorage.removeItem('studentUser');
        localStorage.removeItem('ownerUser');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
