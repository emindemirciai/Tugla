/** The product name shown to players, crawlers and installed PWA surfaces. */
export const DEFAULT_PUBLIC_APP_NAME = 'Tuğla.fun';

/**
 * Keeps custom deployments renameable while upgrading the legacy Tuğla/Tugla
 * display value used by existing production environment variables.
 */
export function publicAppName(value?: string): string {
  const configured = value?.trim();
  if (!configured) return DEFAULT_PUBLIC_APP_NAME;
  const legacyName = configured.toLocaleLowerCase('tr-TR');
  return legacyName === 'tuğla' || legacyName === 'tugla' ? DEFAULT_PUBLIC_APP_NAME : configured;
}
