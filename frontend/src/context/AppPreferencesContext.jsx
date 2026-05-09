import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ownerService } from '../api/services';
import { useAuth } from './AuthContext';
import { getDefaultPreferences, resolvePreferences } from '../utils/format';

const LEGACY_STORAGE_KEY = 'ownerPreferences';

const getPreferenceStorageKey = (user, hostelId) => {
    const ownerId = user?.owner_id || (String(user?.role || '').toLowerCase() === 'owner' ? user?.id : null) || 'anonymous';
    return `ownerPreferences:${ownerId}:${hostelId}`;
};

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
            const stored = localStorage.getItem(LEGACY_STORAGE_KEY);
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
        const hostelId = nextPreferences?.hostel_id || nextPreferences?.hostelId || user?.hostel_id || 'portfolio';
        localStorage.setItem(getPreferenceStorageKey(user, hostelId), JSON.stringify(merged));
    }, [user]);

    const refreshPreferences = useCallback(async (hostelId) => {
        if (!user || !['owner', 'admin'].includes(String(user.role || '').toLowerCase())) return null;
        if (!hostelId) return null;
        setLoading(true);
        try {
            const response = await ownerService.getHostelPreferences(hostelId);
            const next = resolvePreferences(response?.compatibility_preferences || {});
            setPreferences(next);
            localStorage.setItem(getPreferenceStorageKey(user, hostelId), JSON.stringify(next));
            localStorage.removeItem(LEGACY_STORAGE_KEY);
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
    }, [user]);

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
