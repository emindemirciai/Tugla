'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n';

const DISMISSED_KEY = 'tugla.firstRunDismissed';

/**
 * First-run guidance in the hub.
 *
 * A new account previously landed on a grid of 500 levels with no explanation
 * of how the game is controlled or what ends a level — the in-game hint appears
 * only after starting, which is too late to answer "what is this?". Three lines
 * are enough; anything longer is a manual nobody reads.
 *
 * It disappears for good once the player clears their first level, so it never
 * becomes furniture, and can be dismissed before that.
 */
export function FirstRun({ hasCleared }: { hasCleared: boolean }) {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(true);

  // Read on mount rather than during render: localStorage does not exist while
  // the server renders, and reading it there would break hydration.
  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISSED_KEY) === 'true');
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed || hasCleared) return null;

  const steps = [
    { icon: '👆', title: t('firstRun.controlTitle'), body: t('firstRun.controlBody') },
    { icon: '🧱', title: t('firstRun.goalTitle'), body: t('firstRun.goalBody') },
    { icon: '🏆', title: t('firstRun.progressTitle'), body: t('firstRun.progressBody') },
  ];

  return (
    <section className="card first-run" aria-label={t('firstRun.title')}>
      <div className="card-head">
        <strong>{t('firstRun.title')}</strong>
        <button
          type="button"
          className="button-quiet"
          onClick={() => {
            setDismissed(true);
            try {
              window.localStorage.setItem(DISMISSED_KEY, 'true');
            } catch {
              /* private mode: dismissing for this session is enough */
            }
          }}
        >
          {t('firstRun.dismiss')}
        </button>
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
