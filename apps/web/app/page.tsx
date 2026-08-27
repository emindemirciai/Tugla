'use client';

import Image from 'next/image';
import Link from 'next/link';
import { LandingSignIn } from '../components/LandingSignIn';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { LanguageSwitcher, useI18n } from '../lib/i18n';

/**
 * The demo board's brick wall, 7 columns × 5 rows.
 *
 * Tone families mirror the renderer: a warm/cool pair with three depth steps by
 * row band, so the card and the real game are recognisably the same wall. One
 * cell (row 3, column 3) is the dynamite.
 */
const TONES = [
  'a1',
  'b1',
  'a1',
  'a1',
  'b1',
  'a1',
  'a1',
  'a1',
  'a1',
  'b1',
  'a1',
  'a1',
  'b1',
  'a1',
  'b2',
  'a2',
  'a2',
  'a2',
  'b2',
  'a2',
  'b2',
  'a2',
  'b2',
  'a2',
  'dyn',
  'a2',
  'a2',
  'b2',
  'a3',
  'a3',
  'b3',
  'a3',
  'a3',
  'b3',
  'a3',
];

/**
 * Which brick breaks when, and to which keyframe.
 *
 * The old card popped all 35 bricks on a stagger, so bricks vanished with
 * nothing touching them while nine sparks orbited past. Here only the eleven
 * bricks the ball actually reaches break, each at the moment it arrives — and
 * `pop-c` is the dynamite's chain: four neighbours inside the blast radius.
 */
const POPS: Record<number, string> = {
  31: 'pop-a',
  24: 'pop-b',
  17: 'pop-c',
  23: 'pop-c',
  25: 'pop-c',
  32: 'pop-c',
  33: 'pop-d',
  21: 'pop-e',
  19: 'pop-f',
  15: 'pop-g',
  10: 'pop-h',
};

/** Score as the rally lands each hit; the strip steps, so digits never blur. */
const SCORES = [
  '8.420',
  '8.570',
  '9.770',
  '10.370',
  '10.520',
  '10.670',
  '10.820',
  '10.970',
  '11.120',
];

/** Active balls: one, three after the multiball capsule, two after the miss. */
const BALL_COUNTS = ['1', '3', '2'];

/** Comet trail behind the lead ball: same path, a few frames late. */
const TRAIL = [
  { size: 8, opacity: 0.28, delay: '-12.76s' },
  { size: 9, opacity: 0.34, delay: '-12.84s' },
  { size: 10, opacity: 0.42, delay: '-12.92s' },
];

/** Marketing landing page; every visible string flows through the dictionary. */
export default function HomePage() {
  const { t } = useI18n();
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Tuğla.fun';
  const owner = process.env.NEXT_PUBLIC_SITE_OWNER ?? appName;

  const stats = [
    { number: '10', label: t('landing.stats.worlds') },
    { number: '500', label: t('landing.stats.levels') },
    { number: '500', label: t('landing.stats.balls') },
    { number: '120 Hz', label: t('landing.stats.fps') },
  ];

  // Six cards, three across. The detail line is revealed on hover and on
  // keyboard focus — it must never be the only place a fact lives.
  const features = [1, 2, 3, 4, 5, 6].map((index) => ({
    title: t(`landing.feature${index}.title` as 'landing.feature1.title'),
    body: t(`landing.feature${index}.body` as 'landing.feature1.body'),
    detail: t(`landing.feature${index}.detail` as 'landing.feature1.detail'),
  }));

  return (
    <main className="landing">
      <div className="landing-backdrop" aria-hidden>
        <i />
        <i />
        <i />
      </div>

      {/*
        Brand on the left, preferences on the right, nothing in between. Sign in
        and register moved into the hero: the form is the reason to be here, so
        it should not be a link to somewhere else.
      */}
      <nav className="nav shell">
        <Link className="brand" href="/" aria-label={appName}>
          <Image src="/brand/logo.svg" alt="" width={30} height={30} priority />
          {appName.toUpperCase()}
        </Link>
        <div className="nav-links">
          <LanguageSwitcher compact />
          <ThemeSwitcher />
        </div>
      </nav>

      <section className="hero shell">
        <div className="hero-pitch">
          <span className="eyebrow">{t('landing.hero.eyebrow')}</span>
          <h1>{t('landing.hero.title')}</h1>
          <p>{t('landing.hero.body')}</p>
        </div>

        <div className="hero-copy">
          <LandingSignIn />
          <div className="trust-row">
            <span>WEB</span>
            <span>PWA</span>
            <span>ANDROID</span>
            <span>iOS</span>
          </div>
        </div>
        <div className="hero-visual" aria-hidden>
          {/*
            One 13-second rally, authored as a single timeline.

            Everything on this card obeys the game's rules rather than
            decorating it: the ball moves at constant speed and turns instantly
            (linear, not eased), the paddle arrives at the landing point BEFORE
            the ball does and waits there, a brick breaks only where the ball
            reaches it, the dynamite takes its four neighbours, the capsule it
            drops starts multiball, and one of the three balls is missed — the
            floor flashes and the counter falls. The HUD numbers step with those
            events, so the card can be read as a game in progress.

            Pure CSS, so the landing page still ships no extra JavaScript, and
            prefers-reduced-motion freezes it to a legible still.
          */}
          <div className="game-preview">
            <div className="preview-hud">
              <span className="preview-strip-window">
                <span className="preview-strip preview-strip-score">
                  {SCORES.map((score) => (
                    <span key={score}>{score}</span>
                  ))}
                </span>
              </span>
              <strong>LEVEL 24</strong>
              <span className="preview-hud-right">
                <span className="preview-strip-window">
                  <span className="preview-strip preview-strip-balls">
                    {BALL_COUNTS.map((count, index) => (
                      <span key={index}>{count}</span>
                    ))}
                  </span>
                </span>
                <span className="preview-hearts">♥ 3</span>
              </span>
            </div>

            <div className="preview-grid">
              {TONES.map((tone, index) => (
                <span
                  key={index}
                  className={`preview-block ${tone === 'dyn' ? 'dynamite' : `tone-${tone}`}`}
                  style={
                    POPS[index] ? { animation: `${POPS[index]} 13s linear infinite` } : undefined
                  }
                >
                  {tone === 'dyn' ? (
                    <>
                      <i className="dyn-cap dyn-cap-l" />
                      <i className="dyn-cap dyn-cap-r" />
                      <i className="dyn-band dyn-band-l" />
                      <i className="dyn-band dyn-band-r" />
                      <i className="dyn-fuse" />
                      <i className="dyn-spark" />
                    </>
                  ) : null}
                </span>
              ))}
            </div>

            <div className="preview-field">
              {/* Blast ring, at the dynamite's own radius. */}
              <span className="preview-blast" />
              {/* Multiball capsule: falls from the dynamite, caught at 7.4s. */}
              <span className="preview-capsule" />
              {TRAIL.map((trail) => (
                <i
                  key={trail.delay}
                  className="preview-trail"
                  style={{
                    width: trail.size,
                    height: trail.size,
                    marginTop: -trail.size / 2,
                    marginLeft: -trail.size / 2,
                    opacity: trail.opacity,
                    animationDelay: trail.delay,
                  }}
                />
              ))}
              <i className="preview-ball" />
              <i className="preview-ball-2" />
              <i className="preview-ball-3" />
              {/* The miss: floor flashes as ball 2 goes past it. */}
              <span className="preview-ball-lost" />
              <span className="preview-multiball">ÇOKLU TOP ×3</span>
            </div>

            <div className="preview-paddle" />
          </div>
        </div>
      </section>

      <section className="stats shell" id="systems">
        {stats.map((stat) => (
          <article key={stat.label}>
            <strong>{stat.number}</strong>
            <h2>{stat.label}</h2>
          </article>
        ))}
      </section>

      <section className="world-section shell" id="features">
        <div className="world-cards">
          {features.map((feature, index) => (
            <article key={feature.title} className={`world-card world-${index + 1}`} tabIndex={0}>
              <span>0{index + 1}</span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
              <div className="world-card-detail">
                <p>{feature.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer shell">
        <div className="brand">
          <Image src="/brand/logo.svg" alt="" width={26} height={26} />
          {appName.toUpperCase()}
        </div>
        <p>
          © {new Date().getFullYear()} {owner}. {t('landing.footer.rights')}
          <br />
          <span className="muted">{t('landing.footer.licence')}</span>
        </p>
        <div>
          <Link href="/privacy">{t('landing.footer.privacy')}</Link>
          <Link href="/terms">{t('landing.footer.terms')}</Link>
          <Link href="/support">{t('landing.footer.support')}</Link>
          <span className="version-tag" title={t('landing.footer.version')}>
            v{process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev'}
          </span>
        </div>
      </footer>
    </main>
  );
}
