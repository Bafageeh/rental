import { useEffect, useState } from 'react';
import { getAuthUser, isLoggedIn, subscribeAuthSession } from '../lib/auth';

export type AuthUser = {
  id?: number;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  owner_id?: number | null;
  is_admin?: boolean;
};

export type AuthState = {
  user: AuthUser | null;
  loggedIn: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  loading: boolean;
};

function effectiveRole(user: AuthUser | null): string {
  const role = String(user?.role ?? '').trim().toLowerCase();
  const ownerId = user?.owner_id ?? null;

  if (!role || role === 'null') return 'admin';
  if (role === 'owner' && (ownerId === null || ownerId === undefined || ownerId === 0)) return 'admin';

  return role;
}

function makeState(user: AuthUser | null, loggedIn: boolean, loading: boolean): AuthState {
  const role = effectiveRole(user);
  return {
    user,
    loggedIn,
    isAdmin: ['admin', 'manager', 'super_admin'].includes(role),
    isOwner: role === 'owner',
    loading,
  };
}

/** Returns current auth state and refreshes when login/logout changes. */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(makeState(null, false, true));

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      const logged = await isLoggedIn();

      if (!active) return;

      if (!logged) {
        setState(makeState(null, false, false));
        return;
      }

      const user = await getAuthUser();

      if (!active) return;
      setState(makeState(user, true, false));
    };

    void refresh();
    const unsubscribe = subscribeAuthSession(() => void refresh());

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return state;
}
