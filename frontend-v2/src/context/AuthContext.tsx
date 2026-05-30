import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api, { clearAccessToken, setAccessToken } from '@lib/api-client';
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
  updateUser: (patch: Partial<AuthUser>) => void;
  logout: (redirect?: boolean) => void | Promise<void>;
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
  clearAccessToken();
  localStorage.removeItem('tenantUser');
  localStorage.removeItem('ownerUser');
  localStorage.removeItem('hms_onboarding_step');
  localStorage.removeItem('sri_adithya_onboarding_complete');
  sessionStorage.clear();
};

const SESSION_WARNING_MS = 25 * 60 * 1000;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_PING_MS = 4 * 60 * 1000;

const persistUser = (user: AuthUser) => {
  const safeUser = { ...user };
  delete safeUser.token;
  const key =
    normalizeRole(safeUser.role) === 'owner' || normalizeRole(safeUser.role) === 'admin'
      ? 'ownerUser'
      : 'tenantUser';
  localStorage.setItem(key, JSON.stringify(safeUser));
  localStorage.removeItem(key === 'ownerUser' ? 'tenantUser' : 'ownerUser');
};

const readStoredUser = (): AuthUser | null => {
  try {
    const storedOwner = localStorage.getItem('ownerUser');
    const storedTenant = localStorage.getItem('tenantUser');
    return storedOwner
      ? JSON.parse(storedOwner)
      : storedTenant
      ? JSON.parse(storedTenant)
      : null;
  } catch {
    clearSessionScopedStorage();
    return null;
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initialStoredUser] = useState<AuthUser | null>(() => readStoredUser());
  const [user, setUser] = useState<AuthUser | null>(initialStoredUser);
  const [loading, setLoading] = useState(() => Boolean(initialStoredUser));
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [expiredMessage, setExpiredMessage] = useState<string | null>(null);
  const idleWarningRef = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();

  const logout = async (redirect = true) => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* clear local session even if server logout fails */
    }
    setUser(null);
    queryClient.clear();
    clearSessionScopedStorage();
    if (redirect) navigate('/login', { replace: true });
  };

  useEffect(() => {
    idleWarningRef.current = showIdleWarning;
  }, [showIdleWarning]);

  const updateUser = (patch: Partial<AuthUser>) => {
    setUser((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      persistUser(next);
      return next;
    });
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
      const storedData = readStoredUser();

      if (storedData) {
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
          persistUser(updatedUser);
        } catch {
          clearSessionScopedStorage();
          setUser(null);
        }
      } else {
        setUser(null);
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
      setAccessToken(access_token);
      const userData: AuthUser = {
        email: normalizedEmail,
        role: normalizedRole,
        name,
        id: user_id,
        owner_id,
        tenant_id,
        hostel_id,
        is_profile_completed,
      };
      setUser(userData);
      persistUser(userData);

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
      setAccessToken(access_token);
      const userData: AuthUser = {
        role: normalizedRole,
        name,
        id: user_id,
        owner_id,
        tenant_id,
        hostel_id,
        is_profile_completed,
      };
      setUser(userData);
      persistUser(userData);

      return userData;
    } catch (error: unknown) {
      console.error("Google login failed:", error);
      throw new Error(getApiErrorMessage(error) || 'Google authentication failed');
    }
  };

  useEffect(() => {
    if (!user) return;

    let warningTimer: number | undefined;
    let logoutTimer: number | undefined;
    let lastPing = 0;
    let lastReset = 0;

    const clearTimers = () => {
      window.clearTimeout(warningTimer);
      window.clearTimeout(logoutTimer);
    };

    const pingActivity = () => {
      const now = Date.now();
      if (now - lastPing < ACTIVITY_PING_MS) return;
      lastPing = now;
      api.post('/auth/activity').catch(() => {
        /* response interceptor handles expired sessions */
      });
    };

    const resetTimers = () => {
      setShowIdleWarning(false);
      clearTimers();
      warningTimer = window.setTimeout(() => setShowIdleWarning(true), SESSION_WARNING_MS);
      logoutTimer = window.setTimeout(() => {
        setExpiredMessage(
          'You were signed out because your account was inactive for more than 30 minutes.',
        );
        logout(false);
      }, SESSION_TIMEOUT_MS);
      pingActivity();
    };

    const onActivity = () => {
      const now = Date.now();
      if (!idleWarningRef.current && now - lastReset < 10_000) {
        pingActivity();
        return;
      }
      lastReset = now;
      resetTimers();
    };
    const onExpired = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setExpiredMessage(
        detail?.message ||
          'You were signed out because your secure session ended. Please sign in again.',
      );
      setUser(null);
      queryClient.clear();
      clearSessionScopedStorage();
    };

    const events = ['mousemove', 'keydown', 'touchstart', 'pointerdown', 'visibilitychange'];
    events.forEach((eventName) => window.addEventListener(eventName, onActivity, { passive: true }));
    window.addEventListener('hms:session-expired', onExpired);
    resetTimers();

    return () => {
      clearTimers();
      events.forEach((eventName) => window.removeEventListener(eventName, onActivity));
      window.removeEventListener('hms:session-expired', onExpired);
    };
  }, [user, location.pathname]);

  const staySignedIn = async () => {
    setShowIdleWarning(false);
    try {
      await api.post('/auth/activity');
    } catch {
      /* response interceptor handles expired sessions */
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, loginWithGoogle, updateUser, logout, loading }}>
      {children}
      {showIdleWarning && user && (
        <SessionSecurityModal
          title="You’ll be signed out soon"
          message="You have been inactive for a while. For your security, this session will end in 5 minutes."
          details={[
            'This helps protect payment information.',
            'Tenant records stay protected on shared devices.',
            'Financial activity requires an active session.',
          ]}
          primaryLabel="Stay signed in"
          secondaryLabel="Sign out"
          onPrimary={staySignedIn}
          onSecondary={() => logout()}
        />
      )}
      {expiredMessage && !user && (
        <SessionSecurityModal
          title="Session expired for your security"
          message={expiredMessage}
          details={[
            'This helps protect payment information.',
            'Tenant records stay private.',
            'Financial activity stays secure.',
          ]}
          primaryLabel="Sign in again"
          secondaryLabel="Return to homepage"
          onPrimary={() => {
            setExpiredMessage(null);
            navigate('/login', { replace: true, state: { sessionExpired: true } });
          }}
          onSecondary={() => {
            setExpiredMessage(null);
            navigate('/', { replace: true });
          }}
        />
      )}
    </AuthContext.Provider>
  );
}

function SessionSecurityModal({
  title,
  message,
  details,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
}: {
  title: string;
  message: string;
  details: string[];
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 px-4 pb-4 sm:items-center sm:pb-0">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>
        <div className="mt-4 space-y-2 rounded-xl bg-muted/40 p-3">
          {details.map((detail) => (
            <div key={detail} className="flex gap-2 text-xs text-foreground">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>{detail}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onSecondary}
            className="rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground"
          >
            {secondaryLabel}
          </button>
          <button
            type="button"
            onClick={onPrimary}
            className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
