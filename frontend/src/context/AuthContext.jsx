import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { MOCK_OWNER } from '../utils/mockData';
import { getFloors, getTenantHistory } from '../utils/storageUtils';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

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
            const response = await axios.post('/api/auth/login', { email, password });
            const { access_token, role, name, user_id } = response.data;

            const userData = { email, role, name, id: user_id, token: access_token };
            setUser(userData);

            if (role === 'owner' || role === 'admin' || role === 'warden') {
                localStorage.setItem('ownerUser', JSON.stringify(userData));
                localStorage.removeItem('studentUser');
            } else {
                localStorage.setItem('studentUser', JSON.stringify(userData));
                localStorage.removeItem('ownerUser');
            }

            return userData;
        } catch (error) {
            console.error("Login failed:", error);
            throw new Error(error.response?.data?.detail?.message || 'Invalid credentials');
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
