import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { seoConfig } from '../../lib/seo';

const config = seoConfig();
const tr = {
  title: 'Oyuncu desteği',
  description: 'Tuğla destek formu: hesap, oynanış, satın alma ve şikâyet talepleri.',
};
const en = {
  title: 'Player support',
  description: 'Tuğla support form: account, gameplay, purchase and report requests.',
};
const copy = config.defaultLocale === 'tr' ? tr : en;

export const metadata: Metadata = {
  title: copy.title,
  description: copy.description,
  alternates: {
    canonical: '/support',
    languages: {
      tr: `${config.webUrl}/support?lang=tr`,
      en: `${config.webUrl}/support?lang=en`,
      'x-default': `${config.webUrl}/support`,
    },
  },
  openGraph: { title: copy.title, description: copy.description, url: '/support' },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
