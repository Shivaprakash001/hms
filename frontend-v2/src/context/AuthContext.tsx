import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '@lib/api-client';
import { queryClient } from '@lib/queryClient';

export interface AuthUser {
  email?: string;
  role: string;
  name?: string;
  id?: string;
  owner_id?: string;
  tenant_id?: string;
  hostel_id?: string;
  is_profile_completed?: boolean;
  token?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  loginWithGoogle: (code: string, redirectUri: string) => Promise<AuthUser>;
  logout: () => void | Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const normalizeRole = (role: unknown) => (role || '').toString().toLowerCase();

const LOGIN_ERROR_MAP: Record<number, string> = {
  401: 'Incorrect email or password',
  403: 'You do not have access to this account.',
  404: 'Account not found',
  429: 'Too many login attempts. Try again later.',
  500: 'Something went wrong. Please try again.',
};

const getApiErrorMessage = (error: unknown): string | null => {
  const data = (error as { response?: { data?: Record<string, unknown> } })?.response?.data;
  if (!data) return null;
  if (data.error && typeof data.error === 'object' && 'message' in data.error)
    return (data.error as { message: string }).message;
  if (typeof data.message === 'string') return data.message;
  return null;
};

const clearSessionScopedStorage = () => {
  localStorage.removeItem('tenantUser');
  localStorage.removeItem('ownerUser');
  localStorage.removeItem('hms_onboarding_step');
  localStorage.removeItem('sri_adithya_onboarding_complete');
  sessionStorage.clear();
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* clear local session even if server logout fails */
    }
    setUser(null);
    queryClient.clear();
    clearSessionScopedStorage();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    const publicPaths = ['/login'];
    if (user && publicPaths.includes(location.pathname)) {
      const role = user.role?.toLowerCase();
      if (role === 'owner' || role === 'admin') {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, location.pathname, navigate]);

  useEffect(() => {
    const initAuth = async () => {
      const storedOwner = localStorage.getItem('ownerUser');
      const storedTenant = localStorage.getItem('tenantUser');
      const storedData: AuthUser | null = storedOwner
        ? JSON.parse(storedOwner)
        : storedTenant
        ? JSON.parse(storedTenant)
        : null;

      if (storedData?.token) {
        try {
          const response = await api.get('/auth/me');
          const updatedUser: AuthUser = {
            ...storedData,
            ...response.data,
            role: normalizeRole(response.data.role ?? storedData.role),
            id: response.data.user_id,
            owner_id: response.data.owner_id,
            hostel_id: response.data.hostel_id,
            tenant_id: response.data.tenant_id,
            is_profile_completed: response.data.is_profile_completed,
          };
          setUser(updatedUser);
          const key =
            normalizeRole(updatedUser.role) === 'owner' ||
            normalizeRole(updatedUser.role) === 'admin'
              ? 'ownerUser'
              : 'tenantUser';
          localStorage.setItem(key, JSON.stringify(updatedUser));
        } catch (error: unknown) {
          const status = (error as { response?: { status?: number } })?.response?.status;
          if (status === 401) {
            clearSessionScopedStorage();
          } else {
            setUser(storedData);
          }
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email: string, password: string): Promise<AuthUser> => {
    try {
      const normalizedEmail = (email || '').trim().toLowerCase();
      const response = await api.post('/auth/login', {
        email: normalizedEmail,
        password,
      });
      queryClient.clear();
      clearSessionScopedStorage();

      const { access_token, role, name, user_id, owner_id, tenant_id, hostel_id, is_profile_completed } =
        response.data;
      const normalizedRole = normalizeRole(role);
      const userData: AuthUser = {
        email: normalizedEmail,
        role: normalizedRole,
        name,
        id: user_id,
        owner_id,
        tenant_id,
        hostel_id,
        is_profile_completed,
        token: access_token,
      };
      setUser(userData);

      if (normalizedRole === 'owner' || normalizedRole === 'admin') {
        localStorage.setItem('ownerUser', JSON.stringify(userData));
        localStorage.removeItem('tenantUser');
      } else {
        localStorage.setItem('tenantUser', JSON.stringify(userData));
        localStorage.removeItem('ownerUser');
      }

      return userData;
    } catch (error: unknown) {
      if (!(error as { response?: unknown })?.response) {
        throw new Error('Unable to connect. Check your internet.');
      }
      const status = (error as { response?: { status?: number } })?.response?.status;
      const serverMessage = getApiErrorMessage(error);
      throw new Error(
        serverMessage || LOGIN_ERROR_MAP[status ?? 0] || 'Something went wrong.',
      );
    }
  };

  const loginWithGoogle = async (code: string, redirectUri: string): Promise<AuthUser> => {
    try {
      const response = await api.post('/auth/google-callback', { code, redirect_uri: redirectUri });
      queryClient.clear();
      clearSessionScopedStorage();

      const { access_token, role, name, user_id, owner_id, tenant_id, hostel_id, is_profile_completed } =
        response.data;
      const normalizedRole = normalizeRole(role);
      const userData: AuthUser = {
        role: normalizedRole,
        name,
        id: user_id,
        owner_id,
        tenant_id,
        hostel_id,
        is_profile_completed,
        token: access_token,
      };
      setUser(userData);

      if (normalizedRole === 'owner' || normalizedRole === 'admin') {
        localStorage.setItem('ownerUser', JSON.stringify(userData));
        localStorage.removeItem('tenantUser');
      } else {
        localStorage.setItem('tenantUser', JSON.stringify(userData));
        localStorage.removeItem('ownerUser');
      }

      return userData;
    } catch (error: unknown) {
      console.error("Google login failed:", error);
      throw new Error(getApiErrorMessage(error) || 'Google authentication failed');
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, loginWithGoogle, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
