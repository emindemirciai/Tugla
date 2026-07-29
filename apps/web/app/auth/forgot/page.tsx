'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AuthForm } from '../../../components/AuthForm';
import { authApi } from '../../../lib/api';
import { useI18n } from '../../../lib/i18n';

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <h1>{t('auth.forgot.sentTitle')}</h1>
          <p className="auth-subtitle">{t('auth.forgot.sentBody')}</p>
          <Link className="button" href="/auth/login">
            {t('auth.forgot.backToLogin')}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <AuthForm
      title={t('auth.forgot.title')}
      subtitle={t('auth.forgot.subtitle')}
      submitLabel={t('auth.forgot.submit')}
      fields={[
        { name: 'email', label: 'E-posta', type: 'email', autoComplete: 'email', required: true },
      ]}
      onSubmit={async (values) => {
        await authApi.requestReset(String(values.email));
        setSent(true);
      }}
      footer={<Link href="/auth/login">{t('auth.forgot.backToLogin')}</Link>}
    />
  );
}
