'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';
import { authApi } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            ux_mode?: 'popup' | 'redirect';
            auto_select?: boolean;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

/**
 * Google sign-in / sign-up.
 *
 * Uses Google Identity Services: the browser receives a signed ID token and the
 * API verifies it against Google's JWKS before trusting anything — the client
 * never asserts who the player is. The same button covers sign-up and sign-in
 * because the server links or creates the account from the verified address.
 *
 * Renders nothing unless a client id is configured *and* the API reports the
 * provider as ready, so an unconfigured deployment says so instead of showing a
 * button that cannot work.
 */
export function GoogleSignIn({ onDone }: { onDone: () => void }) {
  const { t, locale } = useI18n();
  const { setUser, config } = useSession();
  const container = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  const enabled = Boolean(clientId) && config?.providers.googleAuth === true;

  const handleCredential = useCallback(
    async (credential: string) => {
      setPending(true);
      setError(null);
      try {
        const result = await authApi.oauth('google', credential);
        setUser(result.user);
        onDone();
      } catch (signInError) {
        setError(signInError instanceof Error ? signInError.message : t('common.unexpectedError'));
      } finally {
        setPending(false);
      }
    },
    [onDone, setUser, t],
  );

  useEffect(() => {
    if (!enabled || !scriptReady || !container.current || !window.google) return;
    window.google.accounts.id.initialize({
      client_id: String(clientId),
      ux_mode: 'popup',
      callback: (response) => {
        if (response.credential) void handleCredential(response.credential);
      },
    });
    // Google's own button, sized to the form.
    //
    // The mark and its four colours have to come from Google — a hand-drawn
    // gradient button with a white "G" would break their branding rules and is
    // the kind of thing that gets an OAuth client suspended. What we can
    // control is the shape, the width and where it sits, so the button matches
    // the rest of the form instead of floating at a fixed 320px.
    const width = Math.min(400, Math.max(240, container.current.offsetWidth || 320));
    window.google.accounts.id.renderButton(container.current, {
      type: 'standard',
      theme: 'filled_blue',
      size: 'large',
      shape: 'rectangular',
      text: 'continue_with',
      logo_alignment: 'left',
      locale,
      width,
    });
  }, [enabled, scriptReady, clientId, locale, handleCredential]);

  if (!enabled) return null;

  return (
    <div className="oauth-block">
      <Script src="https://accounts.google.com/gsi/client" onLoad={() => setScriptReady(true)} />
      <div className="oauth-divider">
        <span>{t('auth.or')}</span>
      </div>
      <div ref={container} className="oauth-button" aria-busy={pending} />
      {pending && <p className="muted">{t('auth.google.pending')}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
