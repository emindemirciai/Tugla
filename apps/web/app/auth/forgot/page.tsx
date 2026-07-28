'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AuthForm } from '../../../components/AuthForm';
import { authApi } from '../../../lib/api';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <h1>Bağlantı yolda</h1>
          <p className="auth-subtitle">
            Bu e-posta kayıtlıysa, parola sıfırlama bağlantısı gönderildi. Bağlantı 1 saat geçerlidir.
          </p>
          <Link className="button" href="/auth/login">
            Girişe dön
          </Link>
        </div>
      </main>
    );
  }

  return (
    <AuthForm
      title="Parolanı sıfırla"
      subtitle="Hesabına bağlı e-posta adresini gir; sana tek kullanımlık bir bağlantı gönderelim."
      submitLabel="Sıfırlama bağlantısı gönder"
      fields={[{ name: 'email', label: 'E-posta', type: 'email', autoComplete: 'email', required: true }]}
      onSubmit={async (values) => {
        await authApi.requestReset(String(values.email));
        setSent(true);
      }}
      footer={<Link href="/auth/login">Girişe dön</Link>}
    />
  );
}
