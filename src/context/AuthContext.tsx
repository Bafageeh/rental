import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  getAuthUser,
  isLoggedIn,
  clearAuthSession,
  subscribeAuthSession,
  shouldRequireBiometricUnlock,
  isAuthSessionUnlocked,
} from '../lib/auth';

export type AuthUser = {
  id?: number;
  name?: string | null;
  username?: string | null;
  email?: string | null;
  role?: string | null;
  owner_id?: number | null;
  is_admin?: boolean;
};

type AuthState = {
  user: AuthUser | null;
  loggedIn: boolean;
  locked: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null, loggedIn: false, locked: false, isAdmin: false, isOwner: false, loading: true,
  refresh: async () => {}, logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const logged = await isLoggedIn();

    if (!logged) {
      setUser(null);
      setLoggedIn(false);
      setLocked(false);
      setLoading(false);
      return;
    }

    const requiresUnlock = await shouldRequireBiometricUnlock();
    const sessionLocked = requiresUnlock && !isAuthSessionUnlocked();

    setLocked(sessionLocked);

    if (sessionLocked) {
      setUser(null);
      setLoggedIn(false);
      setLoading(false);
      return;
    }

    const u = await getAuthUser();
    setUser(u);
    setLoggedIn(true);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    await clearAuthSession();
    setUser(null);
    setLoggedIn(false);
    setLocked(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    const runRefresh = () => {
      if (!active) return;
      void refresh();
    };

    runRefresh();
    const unsubscribe = subscribeAuthSession(runRefresh);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [refresh]);

  const role = String(user?.role ?? '').trim().toLowerCase();
  const ownerId = user?.owner_id ?? null;
  const effectiveRole = !role || role === 'null' || (role === 'owner' && (ownerId === null || ownerId === undefined || ownerId === 0))
    ? 'admin'
    : role;
  const isAdmin = Boolean(user?.is_admin) || ['admin', 'manager', 'super_admin'].includes(effectiveRole);
  const isOwner = effectiveRole === 'owner';

  return (
    <AuthContext.Provider value={{ user, loggedIn, locked, isAdmin, isOwner, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
