'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState, type FormEvent } from 'react';
import { authApi } from '../../../lib/api';
import { LanguageSwitcher, useI18n } from '../../../lib/i18n';
import { useSession } from '../../../lib/session';

const CODE_LENGTH = 6;

/**
 * Email verification.
 *
 * The address arrives in the query string right after sign-up, and the emailed
 * link prefills the code as well — so the common path is a single click, while
 * typing the six digits works from any other device.
 */
function VerifyInner() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const { user, refresh } = useSession();

  const [email, setEmail] = useState(params.get('email') ?? '');
  const [code, setCode] = useState(params.get('code') ?? '');
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'failed'>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const legacyToken = params.get('token');

  useEffect(() => {
    if (!email && user?.email) setEmail(user.email);
  }, [email, user]);

  const submit = useCallback(
    async (submittedCode: string, submittedEmail: string) => {
      if (!submittedEmail) {
        setNotice(t('auth.verify.emailMissing'));
        return;
      }
      setState('working');
      setNotice(null);
      try {
        await authApi.confirmVerificationCode(submittedEmail, submittedCode);
        await refresh().catch(() => undefined);
        setState('done');
      } catch {
        setState('failed');
        setNotice(t('auth.verify.codeInvalid'));
      }
    },
    [refresh, t],
  );

  // Links from older emails still carry a one-click token.
  useEffect(() => {
    if (!legacyToken) return;
    setState('working');
    authApi
      .confirmVerification(legacyToken)
      .then(() => setState('done'))
      .catch(() => {
        setState('failed');
        setNotice(t('auth.verify.codeInvalid'));
      });
  }, [legacyToken, t]);

  // A prefilled code from the email means the player already clicked: submit it.
  useEffect(() => {
    const prefilled = params.get('code');
    const prefilledEmail = params.get('email');
    if (prefilled?.length === CODE_LENGTH && prefilledEmail) {
      void submit(prefilled, prefilledEmail);
    }
    // Intentionally runs once: this handles the emailed link on first paint.
  }, [params, submit]);

  if (state === 'done') {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <h1>{t('auth.verify.doneTitle')}</h1>
          <p className="auth-subtitle">{t('auth.verify.doneBody')}</p>
          <Link className="button button-primary" href="/play">
            {t('auth.verify.play')}
          </Link>
        </div>
      </main>
    );
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit(code.trim(), email.trim().toLowerCase());
  };

  const resend = async () => {
    if (!email) {
      setNotice(t('auth.verify.emailMissing'));
      return;
    }
    const result = await authApi.requestVerification(email.trim().toLowerCase());
    setNotice(result.sent ? t('auth.verify.resent') : t('auth.verify.resendUnavailable'));
  };

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-card-top">
          <Link href="/" className="brand">
            <span className="brand-mark">◇</span>
            {process.env.NEXT_PUBLIC_APP_NAME ?? 'Tuğla.fun'}
          </Link>
          <LanguageSwitcher compact />
        </div>
        <h1>{t('auth.verify.codeTitle')}</h1>
        <p className="auth-subtitle">{t('auth.verify.codeBody', { email: email || '—' })}</p>

        <form onSubmit={handleSubmit}>
          {!params.get('email') && (
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
          )}
          <label className="auth-field">
            <span>{t('auth.verify.codeLabel')}</span>
            <input
              className="code-input"
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={CODE_LENGTH}
              required
              autoFocus
            />
          </label>

          {notice && (
            <p className={state === 'failed' ? 'form-error' : 'muted'} role="status">
              {notice}
            </p>
          )}

          <button
            type="submit"
            className="button button-primary auth-submit"
            disabled={state === 'working' || code.length !== CODE_LENGTH}
          >
            {state === 'working' ? t('common.processing') : t('auth.verify.codeSubmit')}
          </button>
        </form>

        <div className="auth-footer">
          <button type="button" className="button-quiet" onClick={() => void resend()}>
            {t('auth.verify.resend')}
          </button>
          <button type="button" className="button-quiet" onClick={() => router.push('/play')}>
            {t('auth.verify.later')}
          </button>
        </div>
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
