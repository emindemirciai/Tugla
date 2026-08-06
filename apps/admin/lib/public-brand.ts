export const DEFAULT_PUBLIC_APP_NAME = 'Tuğla.fun';

/** Display-only brand resolver; identifiers and deployment slugs remain unchanged. */
export function publicAppName(value?: string): string {
  const configured = value?.trim();
  if (!configured) return DEFAULT_PUBLIC_APP_NAME;
  const legacyName = configured.toLocaleLowerCase('tr-TR');
  return legacyName === 'tuğla' || legacyName === 'tugla' ? DEFAULT_PUBLIC_APP_NAME : configured;
}
