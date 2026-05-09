import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ownerService } from '../api/services';
import { useAuth } from './AuthContext';
import { getDefaultPreferences, resolvePreferences } from '../utils/format';
import { getActiveHostelId } from '../lib/hostel/activeHostel';

const LEGACY_STORAGE_KEY = 'ownerPreferences';

const getPreferenceStorageKey = (user) => {
    const ownerId = user?.owner_id || (String(user?.role || '').toLowerCase() === 'owner' ? user?.id : null) || 'anonymous';
    const hostelId = getActiveHostelId(user) || 'all-hostels';
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
        localStorage.setItem(getPreferenceStorageKey(user), JSON.stringify(merged));
    }, [user]);

    const refreshPreferences = useCallback(async () => {
        if (!user || !['owner', 'admin'].includes(String(user.role || '').toLowerCase())) return null;
        setLoading(true);
        try {
            const activeHostelId = getActiveHostelId(user);
            if (!activeHostelId) return null;
            const response = await ownerService.getHostelPreferences(activeHostelId);
            const next = resolvePreferences(response?.compatibility_preferences || {});
            setPreferences(next);
            localStorage.setItem(getPreferenceStorageKey(user), JSON.stringify(next));
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
        try {
            const scoped = localStorage.getItem(getPreferenceStorageKey(user));
            if (scoped) setPreferences(resolvePreferences(JSON.parse(scoped)));
        } catch {}
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
