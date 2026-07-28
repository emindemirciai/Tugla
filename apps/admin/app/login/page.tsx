'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useAdminSession } from '../../lib/session';

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
      setError(signInError instanceof Error ? signInError.message : 'Giriş başarısız');
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
            <strong>{process.env.NEXT_PUBLIC_APP_NAME ?? 'Pulse'}</strong>
            <span>YÖNETİM PANELİ</span>
          </div>
        </div>
        <label>
          E-posta
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Parola
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {error && <p className="admin-error">{error}</p>}
        <button type="submit" disabled={pending}>
          {pending ? 'Doğrulanıyor…' : 'Giriş yap'}
        </button>
        <p className="admin-note">Yalnızca personel rollerine açıktır. Tüm işlemler audit log'a yazılır.</p>
      </form>
    </main>
  );
}
