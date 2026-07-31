import { ImageResponse } from 'next/og';
import { localizedShortDescription, seoConfig } from '../lib/seo';

export const alt = 'Tuğla';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Social/answer-engine preview card, rendered from the same brand values as the
 * rest of the app so a rename needs no new artwork.
 */
export default function OpengraphImage() {
  const config = seoConfig();
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #f6f3ff 0%, #ece8ff 46%, #ffe9df 100%)',
          color: '#1b1533',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 34, letterSpacing: 6 }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              border: '6px solid #5b4be1',
              display: 'flex',
            }}
          />
          {config.appName.toUpperCase()}
        </div>
        <div style={{ fontSize: 78, fontWeight: 700, marginTop: 34, lineHeight: 1.1 }}>
          {config.tagline}
        </div>
        <div style={{ fontSize: 32, color: '#6a6390', marginTop: 26, maxWidth: 900 }}>
          {localizedShortDescription[config.defaultLocale]}
        </div>
        <div style={{ display: 'flex', gap: 28, marginTop: 44, fontSize: 26, color: '#5b4be1' }}>
          <span>10 WORLDS</span>
          <span>500 LEVELS</span>
          <span>500 BALLS</span>
          <span>120 HZ</span>
        </div>
      </div>
    ),
    size,
  );
}
