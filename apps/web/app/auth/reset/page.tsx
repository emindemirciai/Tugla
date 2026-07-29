'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AuthForm } from '../../../components/AuthForm';
import { authApi } from '../../../lib/api';
import { useI18n } from '../../../lib/i18n';

function ResetForm() {
  const router = useRouter();
  const { t } = useI18n();
  const token = useSearchParams().get('token') ?? '';

  if (!token) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <h1>{t('auth.reset.missingTitle')}</h1>
          <p className="auth-subtitle">{t('auth.reset.missingBody')}</p>
          <Link className="button" href="/auth/forgot">
            {t('auth.reset.requestNew')}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <AuthForm
      title={t('auth.reset.title')}
      subtitle={t('auth.reset.subtitle')}
      submitLabel={t('auth.reset.submit')}
      fields={[
        {
          name: 'password',
          label: t('auth.field.newPassword'),
          type: 'password',
          autoComplete: 'new-password',
          required: true,
          hint: t('auth.field.passwordHint'),
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
