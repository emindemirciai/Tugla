import type { Metadata, Viewport } from 'next';
import { PwaRegistration } from '../components/PwaRegistration';
import './styles.css';

const title = process.env.APP_NAME ?? 'Tuğla';
const rootUrl = process.env.WEB_URL ?? 'https://example.com';

export const metadata: Metadata = {
  metadataBase: new URL(rootUrl),
  title: {
    default: `${title} — Break the grid`,
    template: `%s | ${title}`,
  },
  description:
    'A modern 2.5D arcade brick breaker with hundreds of levels, bosses, weekly leagues and community creations.',
  applicationName: title,
  manifest: '/manifest.webmanifest',
  alternates: {
    canonical: '/',
    languages: { tr: '/?lang=tr', en: '/?lang=en' },
  },
  openGraph: {
    type: 'website',
    title: `${title} — Break the grid`,
    description: 'Master the rebound. Multiply the storm. Break every core.',
    url: rootUrl,
    siteName: title,
    locale: 'tr_TR',
    alternateLocale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${title} — Break the grid`,
    description: 'A premium 2.5D arcade brick breaker.',
  },
  robots: { index: true, follow: true },
  category: 'game',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#07111f',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': ['VideoGame', 'SoftwareApplication'],
    name: title,
    applicationCategory: 'GameApplication',
    operatingSystem: 'Web, Android, iOS',
    inLanguage: ['tr', 'en'],
    genre: ['Arcade', 'Brick breaker'],
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };

  return (
    <html lang="tr">
      <body>
        {children}
        <PwaRegistration />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </body>
    </html>
  );
}
