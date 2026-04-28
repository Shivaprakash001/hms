import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ownerService } from '../api/services';
import { useAuth } from './AuthContext';
import { getDefaultPreferences, resolvePreferences } from '../utils/format';

const STORAGE_KEY = 'ownerPreferences';

const AppPreferencesContext = createContext({
    preferences: getDefaultPreferences(),
    loading: false,
    refreshPreferences: async () => {},
    updatePreferencesLocal: () => {},
});

export const AppPreferencesProvider = ({ children }) => {
    const { user } = useAuth();
    const [preferences, setPreferences] = useState(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return getDefaultPreferences();
            return resolvePreferences(JSON.parse(stored));
        } catch {
            return getDefaultPreferences();
        }
    });
    const [loading, setLoading] = useState(false);

    const updatePreferencesLocal = useCallback((nextPreferences) => {
        const merged = resolvePreferences(nextPreferences);
        setPreferences(merged);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    }, []);

    const refreshPreferences = useCallback(async () => {
        if (!user || !['owner', 'admin'].includes(String(user.role || '').toLowerCase())) return null;
        setLoading(true);
        try {
            const profile = await ownerService.getProfile();
            const next = resolvePreferences(profile?.preferences || {});
            setPreferences(next);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (!user || !['owner', 'admin'].includes(String(user.role || '').toLowerCase())) {
            setPreferences(getDefaultPreferences());
            return;
        }
        refreshPreferences();
    }, [user, refreshPreferences]);

    const value = useMemo(() => ({
        preferences,
        loading,
        refreshPreferences,
        updatePreferencesLocal,
    }), [preferences, loading, refreshPreferences, updatePreferencesLocal]);

    return (
        <AppPreferencesContext.Provider value={value}>
            {children}
        </AppPreferencesContext.Provider>
    );
};

export const useAppPreferences = () => useContext(AppPreferencesContext);
