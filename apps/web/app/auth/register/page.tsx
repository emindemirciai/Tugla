'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthForm } from '../../../components/AuthForm';
import { authApi } from '../../../lib/api';
import { useSession } from '../../../lib/session';

export default function RegisterPage() {
  const router = useRouter();
  const { setUser } = useSession();

  return (
    <AuthForm
      title="Hesabını oluştur"
      subtitle="500 bölüm, haftalık ligler ve bulut kayıt tek hesapla açılır."
      submitLabel="Kayıt ol"
      fields={[
        { name: 'displayName', label: 'Görünen ad', type: 'text', autoComplete: 'nickname', required: true },
        { name: 'email', label: 'E-posta', type: 'email', autoComplete: 'email', required: true },
        {
          name: 'password',
          label: 'Parola',
          type: 'password',
          autoComplete: 'new-password',
          required: true,
          hint: 'En az 10 karakter; harf + rakam veya sembol.',
        },
        {
          name: 'acceptedTerms',
          label: 'Kullanım şartlarını ve gizlilik politikasını kabul ediyorum.',
          type: 'checkbox',
          required: true,
        },
        { name: 'marketingConsent', label: 'Yeni içerik duyurularını e-postayla almak istiyorum.', type: 'checkbox' },
      ]}
      onSubmit={async (values) => {
        const result = await authApi.register({
          email: String(values.email),
          password: String(values.password),
          displayName: String(values.displayName),
          acceptedTerms: true,
          marketingConsent: Boolean(values.marketingConsent),
          locale: 'tr',
        });
        setUser(result.user);
        router.push(result.verificationEmailSent ? '/play?verify=sent' : '/play');
      }}
      footer={
        <span>
          Zaten hesabın var mı? <Link href="/auth/login">Giriş yap</Link>
        </span>
      }
    />
  );
}
