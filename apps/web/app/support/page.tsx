'use client';

import { FormEvent, useState } from 'react';

export default function SupportPage() {
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'}/support`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: form.get('email'),
          category: form.get('category'),
          subject: form.get('subject'),
          body: form.get('body'),
          deviceInfo: { userAgent: navigator.userAgent },
        }),
      },
    );
    setMessage(response.ok ? 'Talebiniz alındı.' : 'Talep gönderilemedi. Lütfen tekrar deneyin.');
  }

  return (
    <main className="legal">
      <a className="brand" href="/">
        <span className="brand-mark" /> PULSE
      </a>
      <h1>Oyuncu desteği</h1>
      <p>Hesaba erişemeseniz bile bu formu kullanabilirsiniz.</p>
      <form onSubmit={submit} className="support-form">
        <label>
          E-posta
          <input name="email" type="email" required />
        </label>
        <label>
          Kategori
          <select name="category" defaultValue="account">
            <option value="account">Hesap</option>
            <option value="gameplay">Oynanış</option>
            <option value="purchase">Satın alma</option>
            <option value="report">Şikâyet</option>
          </select>
        </label>
        <label>
          Konu
          <input name="subject" minLength={3} maxLength={120} required />
        </label>
        <label>
          Açıklama
          <textarea name="body" minLength={10} maxLength={5000} rows={8} required />
        </label>
        <button className="button button-primary" type="submit">
          Talebi gönder
        </button>
        {message && <p>{message}</p>}
      </form>
    </main>
  );
}
