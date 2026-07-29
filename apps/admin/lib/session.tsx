'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { adminApi, restoreAdminSession, setAccessToken, STAFF_ROLES, type AdminUser } from './api';
import { t } from '../lib/i18n';

interface AdminSessionState {
  user: AdminUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AdminSessionContext = createContext<AdminSessionState | null>(null);

/** Gates the panel: only staff roles pass; players are signed straight out. */
export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (await restoreAdminSession()) {
        try {
          const profile = await adminApi<AdminUser>('/auth/me');
          if (!cancelled && STAFF_ROLES.includes(profile.role)) setUser(profile);
        } catch {
          /* stays signed out */
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await adminApi<{ user: AdminUser; accessToken: string }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    if (!STAFF_ROLES.includes(result.user.role)) {
      setAccessToken(null);
      throw new Error(t('login.forbidden'));
    }
    setAccessToken(result.accessToken);
    setUser(result.user);
  }, []);

  const signOut = useCallback(async () => {
    await adminApi('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signOut }),
    [user, loading, signIn, signOut],
  );
  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession() {
  const context = useContext(AdminSessionContext);
  if (!context) throw new Error('useAdminSession must be used inside AdminSessionProvider');
  return context;
}

/** Redirects unauthenticated visitors to the login page. */
export function useRequireStaff() {
  const { user, loading } = useAdminSession();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);
  return { user, loading };
}
