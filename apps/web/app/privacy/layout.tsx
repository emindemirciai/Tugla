import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { seoConfig } from '../../lib/seo';

const config = seoConfig();
const tr = {
  title: 'Gizlilik bildirimi',
  description:
    'Pulse gizlilik bildirimi: toplanan veriler, saklama süreleri, KVKK ve GDPR hakları.',
};
const en = {
  title: 'Privacy notice',
  description: 'Pulse privacy notice: data collected, retention windows, GDPR and KVKK rights.',
};
const copy = config.defaultLocale === 'tr' ? tr : en;

export const metadata: Metadata = {
  title: copy.title,
  description: copy.description,
  alternates: {
    canonical: '/privacy',
    languages: {
      tr: `${config.webUrl}/privacy?lang=tr`,
      en: `${config.webUrl}/privacy?lang=en`,
      'x-default': `${config.webUrl}/privacy`,
    },
  },
  openGraph: { title: copy.title, description: copy.description, url: '/privacy' },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
