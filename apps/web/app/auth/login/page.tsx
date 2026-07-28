'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthForm } from '../../../components/AuthForm';
import { authApi } from '../../../lib/api';
import { useSession } from '../../../lib/session';

export default function LoginPage() {
  const router = useRouter();
  const { setUser, config } = useSession();
  const oauthReady = config?.providers.googleAuth || config?.providers.appleAuth;

  return (
    <AuthForm
      title="Tekrar hoş geldin"
      subtitle="Kaldığın dünyadan devam et; ilerlemen tüm cihazlarında seninle."
      submitLabel="Giriş yap"
      fields={[
        { name: 'email', label: 'E-posta', type: 'email', autoComplete: 'email', required: true },
        {
          name: 'password',
          label: 'Parola',
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
      footer={
        <>
          <Link href="/auth/forgot">Parolanı mı unuttun?</Link>
          <span>
            Hesabın yok mu? <Link href="/auth/register">Kayıt ol</Link>
          </span>
          {!oauthReady && (
            <small className="provider-note">
              Google / Apple ile giriş, sağlayıcı anahtarları yapılandırıldığında burada görünür.
            </small>
          )}
        </>
      }
    />
  );
}
