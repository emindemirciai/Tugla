import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { seoConfig } from '../../../lib/seo';

const config = seoConfig();
const copy =
  config.defaultLocale === 'tr'
    ? {
        title: 'Hesap oluştur',
        description:
          '500 bölüm, haftalık ligler ve bulut kayıt için ücretsiz Tuğla hesabı oluştur.',
      }
    : {
        title: 'Create account',
        description: 'Create a free Tuğla account for 500 levels, weekly leagues and cloud saves.',
      };

export const metadata: Metadata = {
  title: copy.title,
  description: copy.description,
  alternates: {
    canonical: '/auth/register',
    languages: {
      tr: `${config.webUrl}/auth/register?lang=tr`,
      en: `${config.webUrl}/auth/register?lang=en`,
      'x-default': `${config.webUrl}/auth/register`,
    },
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
