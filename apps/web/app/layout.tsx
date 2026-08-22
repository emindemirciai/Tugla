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

/**
 * Site ownership verification.
 *
 * Google will not show an app's logo on the consent screen until it can confirm
 * the home page belongs to the developer, proved through Search Console. This
 * page is statically rendered, so the token is inlined at build time like every
 * other public value: changing it means a redeploy, not a restart. DNS
 * verification avoids the rebuild entirely and is the better route.
 */
const siteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: new URL(config.webUrl),
  // `verification.google` is the documented field, but it did not survive into
  // the rendered head here; `other` emits the tag literally, which is what
  // Search Console actually looks for.
  ...(siteVerification ? { other: { 'google-site-verification': siteVerification } } : {}),
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
/**
 * Ownership notice.
 *
 * This is what someone sees when they choose "view source". Client code is
 * delivered to the browser by definition and cannot be hidden — a right-click
 * blocker would only break copy, paste and accessibility while stopping nobody.
 * What can be done honestly is to state, in the first thing they read, who owns
 * the work, under which licence the code may be reused, and what is not covered
 * by that licence at all.
 */
const year = new Date().getFullYear();

const sourceNotice = `
  ============================================================
   ${config.appName}
   © ${year} ${config.owner}. Tüm hakları saklıdır / All rights reserved.
   ${config.webUrl}
  ============================================================

  TÜRKÇE

  Bu site ve üzerindeki oyun ${config.owner} tarafından geliştirilmiştir ve
  ${config.owner}'ye aittir.

  · Kaynak kodu MIT lisanslıdır. Kodu kullanabilir, değiştirebilir ve
    dağıtabilirsiniz; tek şart telif ve lisans bildirimini korumanızdır.
    Lisans metni: ${config.webUrl}/terms
  · Marka adı, alan adı, logo, görseller, bölüm tasarımları, metinler ve
    oyuncu verileri lisansın kapsamı DIŞINDADIR ve izinsiz kullanılamaz.
  · Bu siteyi taklit eden, markayı kullanan veya oyuncu verisini kazıyan
    kopyalar telif ihlalidir.

  ENGLISH

  This site and the game on it were built by and belong to ${config.owner}.

  · The source code is MIT licensed: use, modify and distribute it, provided
    the copyright and licence notice are kept.
  · The brand name, domain, logo, artwork, level designs, copy and player data
    are NOT covered by that licence and may not be used without permission.
  · Clones that impersonate this site, reuse the brand or scrape player data
    are infringements.

  İletişim / Contact: ${config.webUrl}/support
  ============================================================
`;

const consoleNotice = `%c${config.appName}%c
© ${year} ${config.owner} — ${config.webUrl}
Kaynak kodu MIT lisanslıdır; marka, görseller ve oyuncu verisi kapsam dışıdır.
Source is MIT licensed; brand, artwork and player data are not.`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={config.defaultLocale}>
      <head>
        {/* Rendered verbatim into the served HTML, so it is the first thing in
            "view source"; the surrounding braces keep it out of the visible page. */}
        <meta name="copyright" content={`© ${year} ${config.owner}. All rights reserved.`} />
        <meta name="author" content={config.owner} />
        <meta name="license" content="MIT" />
        {/* Machine-readable pointers next to the human-readable banner. */}
        <link rel="license" href={`${config.webUrl}/terms`} />
        <meta name="dcterms.rightsHolder" content={config.owner} />
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
