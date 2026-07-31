'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthForm } from '../../../components/AuthForm';
import { GoogleSignIn } from '../../../components/GoogleSignIn';
import { authApi } from '../../../lib/api';
import { useSession } from '../../../lib/session';
import { useI18n } from '../../../lib/i18n';

export default function RegisterPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { setUser } = useSession();

  return (
    <AuthForm
      title={t('auth.register.title')}
      subtitle={t('auth.register.subtitle')}
      submitLabel={t('auth.register.submit')}
      fields={[
        {
          name: 'displayName',
          label: t('auth.field.displayName'),
          type: 'text',
          autoComplete: 'nickname',
          required: true,
        },
        {
          name: 'email',
          label: t('auth.field.email'),
          type: 'email',
          autoComplete: 'email',
          required: true,
        },
        {
          name: 'password',
          label: t('auth.field.password'),
          type: 'password',
          autoComplete: 'new-password',
          required: true,
          hint: t('auth.field.passwordHint'),
        },
        {
          name: 'acceptedTerms',
          label: t('auth.field.terms'),
          type: 'checkbox',
          required: true,
        },
        {
          name: 'marketingConsent',
          label: t('auth.field.marketing'),
          type: 'checkbox',
        },
      ]}
      onSubmit={async (values) => {
        const result = await authApi.register({
          email: String(values.email),
          password: String(values.password),
          displayName: String(values.displayName),
          acceptedTerms: true,
          marketingConsent: Boolean(values.marketingConsent),
          locale,
        });
        setUser(result.user);
        // Verification is a code now: send the player straight to the code screen.
        router.push(
          result.verificationEmailSent
            ? `/auth/verify?email=${encodeURIComponent(String(values.email).toLowerCase())}`
            : '/play',
        );
      }}
      afterForm={<GoogleSignIn onDone={() => router.push('/play')} />}
      footer={
        <span>
          {t('auth.register.haveAccount')}{' '}
          <Link href="/auth/login">{t('auth.register.loginLink')}</Link>
        </span>
      }
    />
  );
}
