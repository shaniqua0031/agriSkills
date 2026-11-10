import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ApiError, apiFetch } from '@/lib/api';
import { clearToken, loadToken, saveToken } from '@/lib/session-storage';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: 'LEARNER' | 'ISSUER' | 'EMPLOYER' | 'ADMIN';
  emailVerified: boolean;
  /** Only set for issuers: whether they may issue credentials yet. */
  issuerApproved?: boolean;
};

type Session = { token: string; user: AuthUser };

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  /** True while a saved login is being checked on start-up. */
  isRestoring: boolean;
  isLoading: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<AuthUser>;
  /** Creates the account and logs the user straight in. */
  register: (
    input: { name: string; email: string; password: string; role: 'LEARNER' | 'ISSUER' | 'EMPLOYER'; acceptedPrivacy: boolean },
    remember: boolean,
  ) => Promise<AuthUser>;
  /** Stores a session returned by the server (e.g. after email verification). */
  startSession: (session: Session, remember: boolean) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Restore a saved login. The token is checked with the server, so an expired or
  // revoked token (or a deleted account) simply leads back to the login page.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadToken();
      if (!saved) return;
      try {
        const { user: me } = await apiFetch<{ user: AuthUser }>('/me', { headers: { Authorization: `Bearer ${saved}` } });
        if (!cancelled) {
          setToken(saved);
          setUser(me);
        }
      } catch (error) {
        // Only forget the token if the server rejected it; keep it when offline or unreachable.
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) await clearToken();
      }
    })().finally(() => {
      if (!cancelled) setIsRestoring(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const startSession = useCallback(async (session: Session, remember: boolean) => {
    await saveToken(session.token, remember);
    setToken(session.token);
    setUser(session.user);
  }, []);

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    setIsLoading(true);
    try {
      const session = await apiFetch<Session>('/auth/login', { method: 'POST', body: { email, password } });
      await startSession(session, remember);
      return session.user;
    } finally {
      setIsLoading(false);
    }
  }, [startSession]);

  const register = useCallback<AuthContextValue['register']>(async (input, remember) => {
    setIsLoading(true);
    try {
      const session = await apiFetch<Session>('/auth/register', { method: 'POST', body: input });
      await startSession(session, remember);
      return session.user;
    } finally {
      setIsLoading(false);
    }
  }, [startSession]);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    const { user: me } = await apiFetch<{ user: AuthUser }>('/me', { headers: { Authorization: `Bearer ${token}` } });
    setUser(me);
  }, [token]);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    void clearToken();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, isRestoring, isLoading, login, register, startSession, refreshUser, logout }),
    [user, token, isRestoring, isLoading, login, register, startSession, refreshUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
}
