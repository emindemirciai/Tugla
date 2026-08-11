'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { authApi } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import { GoogleSignIn } from './GoogleSignIn';

/**
 * Sign-in on the landing page.
 *
 * The header used to link to a separate login screen, which put a page load
 * between a returning player and the game. The form lives here instead; players
 * who are already signed in see a "continue" button rather than fields they do
 * not need, and registration keeps its own page because it asks for more.
 */
export function LandingSignIn() {
  const { t } = useI18n();
  const router = useRouter();
  const { user, setUser } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (user) {
    return (
      <div className="landing-auth">
        <p className="muted">{t('landing.auth.welcomeBack', { name: user.displayName })}</p>
        <Link className="button button-primary landing-auth-submit" href="/play">
          {t('landing.hero.cta')} <span aria-hidden>↗</span>
        </Link>
      </div>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await authApi.login({ email: email.trim().toLowerCase(), password });
      setUser(result.user);
      router.push('/play');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : t('common.unexpectedError'));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="landing-auth">
      <form onSubmit={submit}>
        <label className="auth-field">
          <span>{t('auth.field.email')}</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="auth-field">
          <span>{t('auth.field.password')}</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="button button-primary landing-auth-submit"
          disabled={pending}
        >
          {pending ? t('common.processing') : t('landing.nav.signIn')}
        </button>
      </form>

      <GoogleSignIn onDone={() => router.push('/play')} />

      <div className="landing-auth-links">
        <Link href="/auth/forgot">{t('auth.login.forgot')}</Link>
        <span>
          {t('landing.auth.noAccount')}{' '}
          <Link href="/auth/register">{t('landing.nav.register')}</Link>
        </span>
        <Link href="/play">{t('landing.auth.guestPeek')}</Link>
      </div>
    </div>
  );
}
