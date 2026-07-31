'use client';

import Link from 'next/link';
import { LanguageSwitcher, useI18n } from '../lib/i18n';

export interface LegalSection {
  heading: string;
  body: string;
}

export interface LegalCopy {
  title: string;
  updated: string;
  sections: LegalSection[];
}

/**
 * Legal pages carry long prose, so their copy lives next to the page instead of
 * the UI dictionary — but they still switch with the same locale selection.
 */
export function LegalPage({ copy }: { copy: Record<'tr' | 'en', LegalCopy> }) {
  const { locale } = useI18n();
  const content = copy[locale];

  return (
    <main className="legal">
      <div className="legal-top">
        <Link className="brand" href="/">
          <span className="brand-mark" /> {process.env.NEXT_PUBLIC_APP_NAME ?? 'Tuğla'}
        </Link>
        <LanguageSwitcher compact />
      </div>
      <h1>{content.title}</h1>
      <p>{content.updated}</p>
      {content.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          <p>{section.body}</p>
        </section>
      ))}
    </main>
  );
}
