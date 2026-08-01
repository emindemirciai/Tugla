'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { LanguageSwitcher, useI18n } from '../lib/i18n';

/** Marketing landing page; every visible string flows through the dictionary. */
export default function HomePage() {
  const { t } = useI18n();
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Tuğla.fun';

  const stats = [
    { number: '10', label: t('landing.stats.worlds') },
    { number: '500', label: t('landing.stats.levels') },
    { number: '500', label: t('landing.stats.balls') },
    { number: '120 Hz', label: t('landing.stats.fps') },
  ];

  const features = [
    { title: t('landing.feature1.title'), body: t('landing.feature1.body') },
    { title: t('landing.feature2.title'), body: t('landing.feature2.body') },
    { title: t('landing.feature3.title'), body: t('landing.feature3.body') },
  ];

  return (
    <main className="landing">
      <nav className="nav shell">
        <Link className="brand" href="/" aria-label={appName}>
          <Image src="/brand/logo.svg" alt="" width={30} height={30} priority />
          {appName.toUpperCase()}
        </Link>
        <div className="nav-links">
          <Link href="/auth/login">{t('landing.nav.signIn')}</Link>
          <Link href="/auth/register">{t('landing.nav.register')}</Link>
          <LanguageSwitcher compact />
        </div>
        <Link className="button button-quiet" href="/play">
          {t('landing.nav.play')}
        </Link>
      </nav>

      <section className="hero shell">
        <div className="hero-copy">
          <span className="eyebrow">{t('landing.hero.eyebrow')}</span>
          <h1>{t('landing.hero.title')}</h1>
          <p>{t('landing.hero.body')}</p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/play">
              {t('landing.hero.cta')} <span aria-hidden>↗</span>
            </Link>
            <Link className="button button-quiet" href="/auth/register">
              {t('landing.hero.secondary')}
            </Link>
          </div>
          <div className="trust-row">
            <span>WEB</span>
            <span>PWA</span>
            <span>ANDROID</span>
            <span>iOS</span>
          </div>
        </div>
        <div className="hero-visual" aria-hidden>
          <div className="orb orb-one" />
          <div className="orb orb-two" />
          {/*
            Animated demo board. The ball path and the paddle share one 6s
            timeline, so the paddle is always where the ball lands: the bounce
            reads as a real rally rather than two independent loops. Bricks pop
            when the ball reaches them. Pure CSS, so the landing page ships no
            extra JavaScript, and prefers-reduced-motion freezes it.
          */}
          <div className="game-preview">
            <div className="preview-hud">
              <span>WORLD 01</span>
              <strong>LEVEL 24</strong>
              <span>♥ 3</span>
            </div>
            <div className="preview-grid">
              {Array.from({ length: 35 }, (_, index) => (
                <span
                  className={`preview-block tone-${(index + Math.floor(index / 7)) % 5}`}
                  key={index}
                  style={{ '--brick': index } as CSSProperties}
                />
              ))}
            </div>
            <div className="preview-field">
              <i className="preview-ball" />
              <i className="preview-ball preview-ball-two" />
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
        <div>
          <span className="eyebrow">{t('landing.worlds.title')}</span>
          <h2>{t('landing.worlds.body')}</h2>
        </div>
        <div className="world-cards">
          {features.map((feature, index) => (
            <article key={feature.title} className={`world-card world-${index + 1}`}>
              <span>0{index + 1}</span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
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
          © {new Date().getFullYear()} {appName}. {t('landing.footer.rights')}
        </p>
        <div>
          <Link href="/privacy">{t('landing.footer.privacy')}</Link>
          <Link href="/terms">{t('landing.footer.terms')}</Link>
          <Link href="/support">{t('landing.footer.support')}</Link>
        </div>
      </footer>
    </main>
  );
}
