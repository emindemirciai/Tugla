'use client';

import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';
import { ApiError } from '../lib/api';
import { LanguageSwitcher, useI18n } from '../lib/i18n';

interface Field {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'checkbox';
  autoComplete?: string;
  required?: boolean;
  hint?: string;
}

/**
 * Shared auth form shell: renders fields, funnels submit through the API and
 * surfaces server-side validation errors next to a human-readable message.
 */
export function AuthForm({
  title,
  subtitle,
  fields,
  submitLabel,
  onSubmit,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  fields: Field[];
  submitLabel: string;
  onSubmit: (values: Record<string, string | boolean>) => Promise<void>;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<{ path: string; message: string }[]>([]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const values: Record<string, string | boolean> = {};
    for (const field of fields) {
      values[field.name] =
        field.type === 'checkbox'
          ? form.get(field.name) === 'on'
          : String(form.get(field.name) ?? '');
    }
    setPending(true);
    setError(null);
    setDetails([]);
    try {
      await onSubmit(values);
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        setError(submitError.message);
        setDetails(submitError.details ?? []);
      } else {
        setError(
          submitError instanceof Error ? submitError.message : 'Beklenmeyen bir hata oluştu',
        );
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-card-top">
          <Link href="/" className="brand">
            <span className="brand-mark">◇</span>
            {process.env.NEXT_PUBLIC_APP_NAME ?? 'Tuğla'}
          </Link>
          <LanguageSwitcher compact />
        </div>
        <h1>{title}</h1>
        <p className="auth-subtitle">{subtitle}</p>

        <form onSubmit={handleSubmit} noValidate>
          {fields.map((field) =>
            field.type === 'checkbox' ? (
              <label key={field.name} className="checkbox">
                <input type="checkbox" name={field.name} required={field.required} />
                <span>{field.label}</span>
              </label>
            ) : (
              <label key={field.name} className="auth-field">
                <span>{field.label}</span>
                <input
                  name={field.name}
                  type={field.type}
                  autoComplete={field.autoComplete}
                  required={field.required}
                />
                {field.hint && <small>{field.hint}</small>}
              </label>
            ),
          )}

          {error && (
            <div className="form-error" role="alert">
              <strong>{error}</strong>
              {details.length > 0 && (
                <ul>
                  {details.map((detail) => (
                    <li key={`${detail.path}-${detail.message}`}>
                      {detail.path ? `${detail.path}: ` : ''}
                      {detail.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {children}

          <button type="submit" className="button button-primary auth-submit" disabled={pending}>
            {pending ? t('common.processing') : submitLabel}
          </button>
        </form>

        {footer && <div className="auth-footer">{footer}</div>}
      </div>
    </main>
  );
}
