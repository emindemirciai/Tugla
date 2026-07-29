'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from './session';

/**
 * There are no guest accounts: every hub screen redirects anonymous visitors to
 * the sign-in page and renders nothing until the session is confirmed.
 */
export function useRequirePlayer() {
  const { user, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  return { ready: Boolean(user) && !loading, user };
}
