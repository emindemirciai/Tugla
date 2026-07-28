'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi, gameApi, restoreSession, type PublicUser, type RemoteConfig } from './api';

interface SessionState {
  user: PublicUser | null;
  config: RemoteConfig | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: PublicUser | null) => void;
}

const SessionContext = createContext<SessionState | null>(null);

/**
 * Restores the session on first paint using the httpOnly refresh cookie, so a
 * reload keeps the player signed in without ever storing a token on disk.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [config, setConfig] = useState<RemoteConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const profile = await authApi.me();
      setUser(profile);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [restored, remoteConfig] = await Promise.all([
        restoreSession(),
        gameApi.config().catch(() => null),
      ]);
      if (cancelled) return;
      setConfig(remoteConfig);
      if (restored) await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const signOut = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, config, loading, refresh, signOut, setUser }),
    [user, config, loading, refresh, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider');
  return context;
}
