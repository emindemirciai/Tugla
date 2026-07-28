'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AuthForm } from '../../../components/AuthForm';
import { authApi } from '../../../lib/api';

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';

  if (!token) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <h1>Bağlantı eksik</h1>
          <p className="auth-subtitle">
            Bu sayfa yalnızca e-postadaki sıfırlama bağlantısıyla açılabilir.
          </p>
          <Link className="button" href="/auth/forgot">
            Yeni bağlantı iste
          </Link>
        </div>
      </main>
    );
  }

  return (
    <AuthForm
      title="Yeni parola belirle"
      subtitle="Parolan güncellendiğinde diğer tüm cihazlardaki oturumlar kapatılır."
      submitLabel="Parolayı güncelle"
      fields={[
        {
          name: 'password',
          label: 'Yeni parola',
          type: 'password',
          autoComplete: 'new-password',
          required: true,
          hint: 'En az 10 karakter; harf + rakam veya sembol.',
        },
      ]}
      onSubmit={async (values) => {
        await authApi.confirmReset(token, String(values.password));
        router.push('/auth/login?reset=done');
      }}
    />
  );
}

export default function ResetPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
