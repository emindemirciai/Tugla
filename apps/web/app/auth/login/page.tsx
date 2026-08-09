'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthForm } from '../../../components/AuthForm';
import { GoogleSignIn } from '../../../components/GoogleSignIn';
import { authApi } from '../../../lib/api';
import { useSession } from '../../../lib/session';
import { useI18n } from '../../../lib/i18n';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { setUser } = useSession();

  return (
    <AuthForm
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
      submitLabel={t('auth.login.submit')}
      fields={[
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
          autoComplete: 'current-password',
          required: true,
        },
      ]}
      onSubmit={async (values) => {
        const result = await authApi.login({
          email: String(values.email),
          password: String(values.password),
        });
        setUser(result.user);
        router.push('/play');
      }}
      afterForm={<GoogleSignIn onDone={() => router.push('/play')} />}
      footer={
        <>
          <Link href="/auth/forgot">{t('auth.login.forgot')}</Link>
          <span>
            {t('auth.login.noAccount')}{' '}
            <Link href="/auth/register">{t('auth.login.registerLink')}</Link>
          </span>
        </>
      }
    />
  );
}
