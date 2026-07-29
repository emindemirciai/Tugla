'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { authApi } from '../../../lib/api';
import { useI18n } from '../../../lib/i18n';

function VerifyInner() {
  const { t } = useI18n();
  const token = useSearchParams().get('token');
  const [state, setState] = useState<'working' | 'done' | 'failed'>('working');

  useEffect(() => {
    if (!token) {
      setState('failed');
      return;
    }
    authApi
      .confirmVerification(token)
      .then(() => setState('done'))
      .catch(() => setState('failed'));
  }, [token]);

  return (
    <main className="auth-page">
      <div className="auth-card">
        {state === 'working' && <h1>{t('auth.verify.working')}</h1>}
        {state === 'done' && (
          <>
            <h1>{t('auth.verify.doneTitle')}</h1>
            <p className="auth-subtitle">{t('auth.verify.doneBody')}</p>
            <Link className="button button-primary" href="/play">
              {t('auth.verify.play')}
            </Link>
          </>
        )}
        {state === 'failed' && (
          <>
            <h1>{t('auth.verify.failedTitle')}</h1>
            <p className="auth-subtitle">{t('auth.verify.failedBody')}</p>
            <Link className="button" href="/account">
              {t('auth.verify.goAccount')}
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}
