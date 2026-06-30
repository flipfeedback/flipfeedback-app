import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { api, getToken, setToken } from '../lib/api';
import type { Session } from '../lib/types';

interface AuthState {
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; organizationName: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // On boot, if a token exists, resolve the current session.
  useEffect(() => {
    let active = true;
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((s) => {
        if (active) setSession(s);
      })
      .catch(() => {
        setToken(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login({ email, password });
    setToken(res.token);
    setSession({ user: res.user, organization: res.organization });
  }, []);

  const register = useCallback(
    async (data: { name: string; email: string; password: string; organizationName: string }) => {
      const res = await api.register(data);
      setToken(res.token);
      setSession({ user: res.user, organization: res.organization });
    },
    [],
  );

  const logout = useCallback(() => {
    setToken(null);
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ session, loading, login, register, logout }),
    [session, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
