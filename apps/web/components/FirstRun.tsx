'use client';

import { useI18n } from '../lib/i18n';

/**
 * How to play.
 *
 * This started as a first-run card that hid itself after the first cleared
 * level. It stays now: the rules are short, players come back after weeks away,
 * and three lines of text cost nothing to leave on screen — whereas guidance
 * that vanishes is guidance you cannot find when you need it.
 */
export function FirstRun() {
  const { t } = useI18n();

  const steps = [
    { icon: '👆', title: t('firstRun.controlTitle'), body: t('firstRun.controlBody') },
    { icon: '🧱', title: t('firstRun.goalTitle'), body: t('firstRun.goalBody') },
    { icon: '🏆', title: t('firstRun.progressTitle'), body: t('firstRun.progressBody') },
  ];

  return (
    <section className="card first-run" aria-label={t('firstRun.title')}>
      <div className="card-head">
        <strong>{t('firstRun.title')}</strong>
      </div>

      <ol className="first-run-steps">
        {steps.map((step) => (
          <li key={step.title}>
            <span aria-hidden>{step.icon}</span>
            <div>
              <strong>{step.title}</strong>
              <p className="muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
