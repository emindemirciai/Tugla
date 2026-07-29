'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AdminLanguageSwitcher } from '../../components/AdminLanguageSwitcher';
import { useAdminSession } from '../../lib/session';
import { t } from '../../lib/i18n';

export default function AdminLoginPage() {
  const router = useRouter();
  const { signIn } = useAdminSession();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      await signIn(String(form.get('email') ?? ''), String(form.get('password') ?? ''));
      router.push('/');
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : t('login.failed'));
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="admin-login">
      <form onSubmit={handleSubmit} className="admin-login-card">
        <div className="admin-brand">
          <span className="brand-mark">◇</span>
          <div>
            <strong>{process.env.NEXT_PUBLIC_APP_NAME ?? 'Tuğla'}</strong>
            <span>{t('login.panel')}</span>
          </div>
        </div>
        <label>
          {t('login.email')}
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          {t('login.password')}
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <AdminLanguageSwitcher />
        {error && <p className="admin-error">{error}</p>}
        <button type="submit" disabled={pending}>
          {pending ? t('login.pending') : t('login.submit')}
        </button>
        <p className="admin-note">{t('login.note')}</p>
      </form>
    </main>
  );
}
