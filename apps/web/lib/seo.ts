/**
 * Discoverability layer: classic SEO plus the newer "answer/generative engine"
 * conventions (llms.txt, explicit AI-crawler policy, entity-rich JSON-LD).
 *
 * Everything is derived from environment variables so a brand rename or a new
 * domain needs no code change. These are pure functions on purpose: the route
 * handlers stay one-liners and the rules below are unit-tested.
 */
export type Locale = 'tr' | 'en';

export interface SeoConfig {
  appName: string;
  tagline: string;
  webUrl: string;
  defaultLocale: Locale;
  indexable: boolean;
  allowAiCrawlers: boolean;
  twitter?: string;
  googleVerification?: string;
  bingVerification?: string;
}

const clean = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/** Reads the SEO contract from the environment, with safe local defaults. */
export const seoConfig = (env: NodeJS.ProcessEnv = process.env): SeoConfig => {
  const webUrl = (clean(env.WEB_URL) ?? 'http://localhost:3000').replace(/\/+$/, '');
  const defaultLocale: Locale = clean(env.DEFAULT_LOCALE) === 'en' ? 'en' : 'tr';
  return {
    appName: clean(env.APP_NAME) ?? clean(env.NEXT_PUBLIC_APP_NAME) ?? 'Tuğla',
    tagline: clean(env.APP_TAGLINE) ?? 'Break the grid',
    webUrl,
    defaultLocale,
    // Staging and preview environments must never outrank production.
    indexable: clean(env.SEO_INDEXABLE) === 'true' || clean(env.NODE_ENV) === 'production',
    allowAiCrawlers: clean(env.AI_CRAWLERS_ALLOWED) !== 'false',
    twitter: clean(env.SOCIAL_TWITTER),
    googleVerification: clean(env.GOOGLE_SITE_VERIFICATION),
    bingVerification: clean(env.BING_SITE_VERIFICATION),
  };
};

/** Public, crawlable routes. Everything behind auth is intentionally excluded. */
export const PUBLIC_ROUTES = [
  '/',
  '/auth/register',
  '/auth/login',
  '/support',
  '/privacy',
  '/terms',
] as const;

/** Routes that must never be indexed (player data or staff tooling). */
export const PRIVATE_ROUTES = [
  '/play',
  '/progress',
  '/leagues',
  '/social',
  '/shop',
  '/inbox',
  '/replays',
  '/create',
  '/account',
  '/auth/reset',
  '/auth/verify',
  '/auth/forgot',
] as const;

/** Well-known AI crawlers we answer explicitly instead of leaving to defaults. */
export const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Bytespider',
  'meta-externalagent',
] as const;

export const localizedDescription: Record<Locale, string> = {
  tr: 'Tuğla; 10 dünya ve 500 el yapımı bölümden oluşan, boss savaşları, günlük görevler, haftalık ligler ve topluluk bölümleri içeren modern bir tuğla kırma oyunudur. Tarayıcıda, PWA olarak, Android ve iOS üzerinde oynanır; her skor sunucuda yeniden simüle edilerek doğrulanır.',
  en: 'Tuğla is a modern brick breaker with 10 worlds and 500 handcrafted levels, boss fights, daily tasks, weekly leagues and community levels. It runs in the browser, as a PWA and on Android and iOS, and every score is verified by re-simulating the run on the server.',
};

export const localizedShortDescription: Record<Locale, string> = {
  tr: '500 bölüm, boss savaşları ve 500 topa kadar zincir reaksiyonlar. Doğrulanmış skorlar, haftalık ligler.',
  en: '500 levels, boss fights and chain reactions up to 500 balls. Verified scores, weekly leagues.',
};

/**
 * Questions real players (and answer engines) ask. Rendered as FAQPage JSON-LD
 * and mirrored in llms.txt so generative engines can quote something accurate
 * instead of inventing details.
 */
export const faq: Record<Locale, { question: string; answer: string }[]> = {
  tr: [
    {
      question: 'Tuğla nedir?',
      answer:
        'Tuğla, mobil öncelikli dikey ekran için tasarlanmış modern bir tuğla kırma oyunudur. Görüntü Three.js ile üç boyutludur, fizik ise sabit 120 Hz deterministik 2B düzlemde çalışır.',
    },
    {
      question: 'Tuğla ücretsiz mi?',
      answer:
        'Evet, oyunun tamamı ücretsiz oynanır. Mağazada yalnızca görsel öğeler bulunur ve rekabet modlarında satın alınabilir güç avantajı yoktur.',
    },
    {
      question: 'Hangi platformlarda oynanır?',
      answer:
        'Tarayıcıda, yüklenebilir PWA olarak ve Capacitor tabanlı Android ile iOS uygulamalarında oynanır. İlerleme bulutta saklandığı için tüm cihazlarda aynı hesapla devam edilir.',
    },
    {
      question: 'Skorlar nasıl doğrulanıyor?',
      answer:
        'Sunucu her oturum için imzalı bir tohum verir, oyuncu girdileri kaydedilir ve bitişte sunucu aynı motoru aynı tohumla yeniden simüle eder. Uyuşmayan sonuçlar hiçbir skor tablosuna yazılmaz.',
    },
    {
      question: 'Çevrim dışı oynanabilir mi?',
      answer:
        'Sınırlı biçimde evet. Önbelleğe alınmış bölümler çevrim dışı oynanabilir; bu oyunlar bağlantı geri geldiğinde sırasız ilerleme olarak eşitlenir ve liderlik tablolarını etkilemez.',
    },
    {
      question: 'Kendi bölümümü tasarlayabilir miyim?',
      answer:
        'Evet. Görsel bölüm editörüyle kendi bölümlerini hazırlayıp test edebilir, incelemeye gönderdikten sonra paylaşabilirsin; topluluk bölümleri moderasyondan geçer, yayınlananlar beğeni alır ve bildirilebilir.',
    },
    {
      question: 'Günün bölümü nedir?',
      answer:
        'Her gün yayınlanmış kampanya bölümlerinden biri tarihe göre seçilir ve herkes aynı bölümü oynar. Günlük skor tablosu her gece sıfırlanır.',
    },
    {
      question: 'Nasıl hesap açılır?',
      answer:
        'E-posta ve parolayla ya da Google hesabınla saniyeler içinde. E-posta ile kayıtta adresine 6 haneli bir doğrulama kodu gönderilir; misafir hesap yoktur, böylece ilerlemen tüm cihazlarında saklanır.',
    },
  ],
  en: [
    {
      question: 'What is Tuğla?',
      answer:
        'Tuğla is a modern brick breaker built for portrait, one-handed play. The presentation is 3D via Three.js while the physics runs on a fixed 120 Hz deterministic 2D plane.',
    },
    {
      question: 'Is Tuğla free to play?',
      answer:
        'Yes, the whole game is free. The shop sells cosmetics only and competitive modes never sell power advantages.',
    },
    {
      question: 'Which platforms are supported?',
      answer:
        'The browser, an installable PWA, and Capacitor-based Android and iOS apps. Progress is stored in the cloud, so the same account continues on every device.',
    },
    {
      question: 'How are scores verified?',
      answer:
        'The server issues a signed seed per session, the client records inputs, and on completion the server re-simulates the same engine with the same seed. Mismatching results never reach a leaderboard.',
    },
    {
      question: 'Can I play offline?',
      answer:
        'In a limited way. Cached levels can be played offline; those runs sync as unranked progress once you reconnect and never affect leaderboards.',
    },
    {
      question: 'Can I build my own levels?',
      answer:
        'Yes. The visual level editor lets you design and test levels, then submit them for review; community levels pass through moderation, and published ones can be rated and reported.',
    },
    {
      question: 'What is the daily challenge?',
      answer:
        'Each day one published campaign level is selected from the date, so everyone plays the same level. The daily leaderboard resets every night.',
    },
    {
      question: 'How do I create an account?',
      answer:
        'With an email address and password, or with your Google account. Email sign-up sends a six digit verification code; there are no guest accounts, so your progress is kept across all your devices.',
    },
  ],
};

/** robots.txt body — mirrors the Next metadata route, kept testable. */
export const robotsRules = (config: SeoConfig) => {
  if (!config.indexable) {
    return [{ userAgent: '*', disallow: '/' }];
  }
  const shared = { allow: '/', disallow: [...PRIVATE_ROUTES, '/api/'] };
  const rules: { userAgent: string | string[]; allow?: string; disallow: string | string[] }[] = [
    { userAgent: '*', ...shared },
  ];
  rules.push(
    config.allowAiCrawlers
      ? { userAgent: [...AI_CRAWLERS], ...shared }
      : { userAgent: [...AI_CRAWLERS], disallow: '/' },
  );
  return rules;
};

/**
 * llms.txt — the emerging convention that lets answer engines read a short,
 * authoritative summary instead of scraping a client-rendered game shell.
 */
export const llmsTxt = (config: SeoConfig, locale: Locale = config.defaultLocale) => {
  const { appName, webUrl } = config;
  const lines = [
    `# ${appName}`,
    '',
    `> ${localizedDescription[locale]}`,
    '',
    `## ${locale === 'tr' ? 'Temel bilgiler' : 'Key facts'}`,
    `- ${locale === 'tr' ? 'Tür' : 'Genre'}: arcade / brick breaker`,
    `- ${locale === 'tr' ? 'Platformlar' : 'Platforms'}: Web, PWA, Android, iOS`,
    `- ${locale === 'tr' ? 'Fiyat' : 'Price'}: ${locale === 'tr' ? 'ücretsiz (yalnızca kozmetik mağaza)' : 'free (cosmetics-only shop)'}`,
    `- ${locale === 'tr' ? 'İçerik' : 'Content'}: ${locale === 'tr' ? '10 dünya, 500 bölüm, her 10. bölümde mini boss, her 50. bölümde dünya bossu' : '10 worlds, 500 levels, a mini boss every 10th level and a world boss every 50th'}`,
    `- ${locale === 'tr' ? 'Diller' : 'Languages'}: Türkçe, English`,
    `- ${locale === 'tr' ? 'Hesap' : 'Accounts'}: ${locale === 'tr' ? 'e-posta + parola, Google, Apple (misafir hesap yok)' : 'email + password, Google, Apple (no guest accounts)'}`,
    '',
    `## ${locale === 'tr' ? 'Sayfalar' : 'Pages'}`,
    `- [${locale === 'tr' ? 'Ana sayfa' : 'Home'}](${webUrl}/): ${localizedShortDescription[locale]}`,
    `- [${locale === 'tr' ? 'Kayıt' : 'Sign up'}](${webUrl}/auth/register)`,
    `- [${locale === 'tr' ? 'Destek' : 'Support'}](${webUrl}/support)`,
    `- [${locale === 'tr' ? 'Gizlilik' : 'Privacy'}](${webUrl}/privacy)`,
    `- [${locale === 'tr' ? 'Koşullar' : 'Terms'}](${webUrl}/terms)`,
    '',
    `## ${locale === 'tr' ? 'Sık sorulanlar' : 'FAQ'}`,
  ];
  for (const entry of faq[locale]) {
    lines.push(`### ${entry.question}`, entry.answer, '');
  }
  lines.push(
    `## ${locale === 'tr' ? 'Kullanım' : 'Usage'}`,
    config.allowAiCrawlers
      ? locale === 'tr'
        ? 'Bu sayfalar yapay zekâ arama ve yanıt motorları tarafından alıntılanabilir. Lütfen kaynak olarak alan adını belirtin ve oyun içi verileri (skorlar, kullanıcı adları) kopyalamayın.'
        : 'These pages may be quoted by AI search and answer engines. Please cite the domain as the source and do not copy in-game data such as scores or usernames.'
      : locale === 'tr'
        ? 'Yapay zekâ tarayıcıları bu site için devre dışı bırakılmıştır.'
        : 'AI crawlers are disabled for this site.',
    '',
  );
  return lines.join('\n');
};

/** Absolute URL helper that keeps trailing slashes consistent. */
export const absolute = (config: SeoConfig, path: string) =>
  `${config.webUrl}${path === '/' ? '/' : path}`;
