import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const role = user?.role ?? null;

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const { data } = await api.get('/api/auth/profile');
        if (data?.success) {
          setUser(data.user);
        }
      } catch {
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/api/auth/login', { email, password });

    if (data.success) {
      setUser(data.user);
      setToken(data.token);
    }

    return data;
  }, []);

  const signup = useCallback(async (name, email, password, role) => {
    const { data } = await api.post('/api/auth/signup', { name, email, password, role });

    if (data.success) {
      setUser(data.user);
      setToken(data.token);
    }

    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // swallow — cookie might already be gone
    } finally {
      setUser(null);
      setToken(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, token, role, loading, login, signup, logout }),
    [user, token, role, loading, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
