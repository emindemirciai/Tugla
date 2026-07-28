'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { authApi } from '../../../lib/api';

function VerifyInner() {
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
        {state === 'working' && <h1>E-posta doğrulanıyor…</h1>}
        {state === 'done' && (
          <>
            <h1>E-posta doğrulandı ✓</h1>
            <p className="auth-subtitle">Hesabın tam yetkili. İyi oyunlar!</p>
            <Link className="button button-primary" href="/play">
              Oynamaya başla
            </Link>
          </>
        )}
        {state === 'failed' && (
          <>
            <h1>Bağlantı geçersiz</h1>
            <p className="auth-subtitle">
              Doğrulama bağlantısı süresi dolmuş veya daha önce kullanılmış olabilir. Hesap
              sayfandan yeni bir bağlantı isteyebilirsin.
            </p>
            <Link className="button" href="/account">
              Hesabıma git
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
