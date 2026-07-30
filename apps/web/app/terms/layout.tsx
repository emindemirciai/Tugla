import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { seoConfig } from '../../lib/seo';

const config = seoConfig();
const tr = {
  title: 'Kullanım koşulları',
  description:
    'Pulse kullanım koşulları: hesap kuralları, dijital ürünler ve hizmet değişiklikleri.',
};
const en = {
  title: 'Terms of service',
  description: 'Pulse terms of service: account rules, digital goods and service changes.',
};
const copy = config.defaultLocale === 'tr' ? tr : en;

export const metadata: Metadata = {
  title: copy.title,
  description: copy.description,
  alternates: {
    canonical: '/terms',
    languages: {
      tr: `${config.webUrl}/terms?lang=tr`,
      en: `${config.webUrl}/terms?lang=en`,
      'x-default': `${config.webUrl}/terms`,
    },
  },
  openGraph: { title: copy.title, description: copy.description, url: '/terms' },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
