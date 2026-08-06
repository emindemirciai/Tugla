import { describe, expect, it } from 'vitest';
import { MAIL_COPY } from './mail';

/**
 * Transactional mail is the one place where a missing translation reaches a
 * player outside the app, so both languages are checked here too.
 */
describe('transactional mail speaks both languages', () => {
  it('covers every message in Turkish and English', () => {
    expect(Object.keys(MAIL_COPY.en).sort()).toEqual(Object.keys(MAIL_COPY.tr).sort());
  });

  it('fills every field a message renders', () => {
    for (const locale of ['tr', 'en'] as const) {
      for (const [name, copy] of Object.entries(MAIL_COPY[locale])) {
        expect(copy.subject.trim(), `${locale}:${name}.subject`).not.toHaveLength(0);
        expect(copy.title.trim(), `${locale}:${name}.title`).not.toHaveLength(0);
        expect(copy.body.trim(), `${locale}:${name}.body`).not.toHaveLength(0);
      }
    }
  });

  it('translates rather than repeating the English text', () => {
    for (const name of Object.keys(MAIL_COPY.tr) as (keyof typeof MAIL_COPY.tr)[]) {
      expect(MAIL_COPY.tr[name].body, `${name} is not translated`).not.toBe(
        MAIL_COPY.en[name].body,
      );
    }
  });

  it('gives the verification mail a code label in both languages', () => {
    expect(MAIL_COPY.tr.verification.codeLabel?.length ?? 0).toBeGreaterThan(0);
    expect(MAIL_COPY.en.verification.codeLabel?.length ?? 0).toBeGreaterThan(0);
  });
});
