'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { platformApi } from '../../lib/api';
import { LanguageSwitcher, useI18n } from '../../lib/i18n';

const COPY = {
  tr: {
    title: 'Oyuncu desteği',
    intro: 'Hesabına erişemesen bile bu formu kullanabilirsin.',
    email: 'E-posta',
    category: 'Kategori',
    subject: 'Konu',
    body: 'Açıklama',
    submit: 'Talebi gönder',
    sending: 'Gönderiliyor…',
    ok: 'Talebin alındı. Destek ekibi e-posta ile dönüş yapacak.',
    fail: 'Talep gönderilemedi. Lütfen tekrar dene.',
    categories: {
      account: 'Hesap',
      gameplay: 'Oynanış',
      purchase: 'Satın alma',
      report: 'Şikâyet',
    },
  },
  en: {
    title: 'Player support',
    intro: 'You can use this form even if you cannot access your account.',
    email: 'Email',
    category: 'Category',
    subject: 'Subject',
    body: 'Description',
    submit: 'Send request',
    sending: 'Sending…',
    ok: 'Your request was received. The support team will reply by email.',
    fail: 'Could not send the request. Please try again.',
    categories: {
      account: 'Account',
      gameplay: 'Gameplay',
      purchase: 'Purchase',
      report: 'Report',
    },
  },
} as const;

export default function SupportPage() {
  const { locale } = useI18n();
  const copy = COPY[locale];
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setMessage('');
    try {
      await platformApi.support({
        email: form.get('email'),
        category: form.get('category'),
        subject: form.get('subject'),
        body: form.get('body'),
        deviceInfo: { userAgent: navigator.userAgent, locale },
      });
      setMessage(copy.ok);
    } catch {
      setMessage(copy.fail);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="legal">
      <div className="legal-top">
        <Link className="brand" href="/">
          <span className="brand-mark" /> {process.env.NEXT_PUBLIC_APP_NAME ?? 'Tuğla.fun'}
        </Link>
        <LanguageSwitcher compact />
      </div>
      <h1>{copy.title}</h1>
      <p>{copy.intro}</p>
      <form onSubmit={submit} className="support-form">
        <label>
          {copy.email}
          <input name="email" type="email" required />
        </label>
        <label>
          {copy.category}
          <select name="category" defaultValue="account">
            {(Object.keys(copy.categories) as (keyof typeof copy.categories)[]).map((key) => (
              <option key={key} value={key}>
                {copy.categories[key]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {copy.subject}
          <input name="subject" minLength={3} maxLength={120} required />
        </label>
        <label>
          {copy.body}
          <textarea name="body" minLength={10} maxLength={5000} rows={8} required />
        </label>
        <button className="button button-primary" type="submit" disabled={pending}>
          {pending ? copy.sending : copy.submit}
        </button>
        {message && <p>{message}</p>}
      </form>
    </main>
  );
}
