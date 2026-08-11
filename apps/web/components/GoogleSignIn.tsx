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
/** Google's four-colour mark, drawn to their brand guidelines. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

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

  return (
    <div className="oauth-block">
      {enabled && (
        <Script src="https://accounts.google.com/gsi/client" onLoad={() => setScriptReady(true)} />
      )}
      <div className="oauth-divider">
        <span>{t('auth.or')}</span>
      </div>

      {/*
        The button is always on the page. Hiding it until the provider happened
        to be configured meant the sign-in screen looked different on every
        deployment and nobody could tell whether Google sign-in existed at all.
        When it is not configured the same button says so on click instead of
        doing nothing — a visible control that explains itself beats an invisible
        one.
      */}
      {enabled ? (
        <div ref={container} className="oauth-button" aria-busy={pending} />
      ) : (
        <button
          type="button"
          className="google-button"
          onClick={() => setError(t('auth.google.unavailable'))}
        >
          <GoogleMark />
          <span>{t('auth.google.continue')}</span>
        </button>
      )}
      {pending && <p className="muted">{t('auth.google.pending')}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
