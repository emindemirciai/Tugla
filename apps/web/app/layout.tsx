import type { Metadata, Viewport } from 'next';
import { PwaRegistration } from '../components/PwaRegistration';
import { SiteAnalytics } from '../components/SiteAnalytics';
import { LocaleProvider } from '../lib/i18n';
import {
  absolute,
  faq,
  localizedDescription,
  localizedShortDescription,
  seoConfig,
} from '../lib/seo';
import { SessionProvider } from '../lib/session';
import { themeBootstrapScript } from '../lib/theme';
import './styles.css';

const config = seoConfig();
const description = localizedDescription[config.defaultLocale];

export const metadata: Metadata = {
  metadataBase: new URL(config.webUrl),
  title: {
    default: `${config.appName} — ${config.tagline}`,
    template: `%s | ${config.appName}`,
  },
  description,
  applicationName: config.appName,
  generator: 'Next.js',
  manifest: '/manifest.webmanifest',
  keywords: [
    'brick breaker',
    'tuğla kırma oyunu',
    'arcade game',
    'browser game',
    'PWA game',
    'boss fight',
    'weekly league',
    config.appName,
  ],
  authors: [{ name: config.appName }],
  creator: config.appName,
  publisher: config.appName,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    title: `${config.appName} — ${config.tagline}`,
    description: localizedShortDescription[config.defaultLocale],
    url: config.webUrl,
    siteName: config.appName,
    locale: config.defaultLocale === 'tr' ? 'tr_TR' : 'en_US',
    images: [
      {
        url: '/brand/cover-1200x630.png',
        width: 1200,
        height: 630,
        alt: `${config.appName} — ${config.tagline}`,
      },
    ],
    alternateLocale: config.defaultLocale === 'tr' ? 'en_US' : 'tr_TR',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${config.appName} — ${config.tagline}`,
    description: localizedShortDescription[config.defaultLocale],
    images: ['/brand/cover-1200x630.png'],
    ...(config.twitter ? { site: config.twitter, creator: config.twitter } : {}),
  },
  robots: config.indexable
    ? {
        index: true,
        follow: true,
        googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
      }
    : { index: false, follow: false },
  verification: {
    ...(config.googleVerification ? { google: config.googleVerification } : {}),
    ...(config.bingVerification ? { other: { 'msvalidate.01': config.bingVerification } } : {}),
  },
  appleWebApp: { capable: true, title: config.appName, statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
  category: 'game',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#f6f3ff',
  colorScheme: 'light',
};

/**
 * Entity graph for search and answer engines: what the product is, who
 * publishes it, how to search it, and the questions people actually ask.
 * Answer engines quote FAQPage entries directly, so the copy lives in one
 * place (lib/seo.ts) and is shared with /llms.txt.
 */
function structuredData() {
  const game = {
    '@type': ['VideoGame', 'SoftwareApplication'],
    '@id': `${config.webUrl}/#game`,
    name: config.appName,
    url: config.webUrl,
    description: localizedDescription[config.defaultLocale],
    applicationCategory: 'GameApplication',
    gamePlatform: ['Web browser', 'PWA', 'Android', 'iOS'],
    operatingSystem: 'Web, Android, iOS',
    inLanguage: ['tr', 'en'],
    genre: ['Arcade', 'Brick breaker', 'Casual'],
    playMode: 'SinglePlayer',
    isAccessibleForFree: true,
    isFamilyFriendly: true,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    publisher: { '@id': `${config.webUrl}/#publisher` },
  };

  const publisher = {
    '@type': 'Organization',
    '@id': `${config.webUrl}/#publisher`,
    name: config.appName,
    url: config.webUrl,
    logo: absolute(config, '/brand/logo.svg'),
  };

  const website = {
    '@type': 'WebSite',
    '@id': `${config.webUrl}/#website`,
    url: config.webUrl,
    name: config.appName,
    inLanguage: ['tr', 'en'],
    publisher: { '@id': `${config.webUrl}/#publisher` },
  };

  const faqPage = {
    '@type': 'FAQPage',
    '@id': `${config.webUrl}/#faq`,
    inLanguage: config.defaultLocale,
    mainEntity: faq[config.defaultLocale].map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  };

  return { '@context': 'https://schema.org', '@graph': [publisher, website, game, faqPage] };
}

/**
 * Notice shown to anyone who opens "view source".
 *
 * Client-side code is delivered to the browser by definition, so it cannot be
 * hidden — anything claiming otherwise would be theatre. What is honest and
 * useful is stating who owns the work and under what terms, in the two places
 * a curious visitor actually looks: the top of the HTML and the console.
 */
const sourceNotice = `
  ${config.appName} — © ${new Date().getFullYear()} ${config.owner}
  ${config.webUrl}

  Kaynak kodu MIT lisansı altındadır: kullanabilir, değiştirebilir ve
  dağıtabilirsiniz; telif ve lisans bildirimini korumanız gerekir.
  Marka adı, logo ve görseller lisansın kapsamı dışındadır.

  Source code is MIT licensed: use, modify and distribute it, provided the
  copyright and licence notice are kept. The brand name, logo and artwork are
  not covered by that licence.
`;

const consoleNotice = `%c${config.appName}%c © ${new Date().getFullYear()} ${config.owner} — MIT licensed source, brand assets reserved. ${config.webUrl}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={config.defaultLocale}>
      <head>
        {/* Rendered verbatim into the served HTML, so it is the first thing in
            "view source"; the surrounding braces keep it out of the visible page. */}
        <meta name="copyright" content={`© ${new Date().getFullYear()} ${config.owner}`} />
        <meta name="license" content="MIT" />
        {/* Applies the stored appearance before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        {/* Explicit home-page hreflang set: the ?lang parameter is honoured by
            the locale provider, so these URLs resolve to real translations. */}
        <link rel="alternate" hrefLang="tr" href={`${config.webUrl}/?lang=tr`} />
        <link rel="alternate" hrefLang="en" href={`${config.webUrl}/?lang=en`} />
        <link rel="alternate" hrefLang="x-default" href={`${config.webUrl}/`} />
      </head>
      <body>
        {/* Raw HTML comment: this is what a visitor sees at the top of the
            document when they choose "view source". */}
        <script dangerouslySetInnerHTML={{ __html: `</script><!--${sourceNotice}--><script>` }} />
        <LocaleProvider>
          <SessionProvider>{children}</SessionProvider>
        </LocaleProvider>
        <PwaRegistration />
        <script
          dangerouslySetInnerHTML={{
            __html: `console.info(${JSON.stringify(consoleNotice)}, 'font-weight:700;color:#5b4be1', 'color:inherit');`,
          }}
        />
        <SiteAnalytics />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()) }}
        />
      </body>
    </html>
  );
}
