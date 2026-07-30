import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { seoConfig } from '../../../lib/seo';

const config = seoConfig();
const copy =
  config.defaultLocale === 'tr'
    ? { title: 'Giriş yap', description: 'Tuğla hesabına giriş yap ve kaldığın bölümden devam et.' }
    : {
        title: 'Sign in',
        description: 'Sign in to your Tuğla account and continue where you left off.',
      };

export const metadata: Metadata = {
  title: copy.title,
  description: copy.description,
  alternates: {
    canonical: '/auth/login',
    languages: {
      tr: `${config.webUrl}/auth/login?lang=tr`,
      en: `${config.webUrl}/auth/login?lang=en`,
      'x-default': `${config.webUrl}/auth/login`,
    },
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
