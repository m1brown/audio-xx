import { ImageResponse } from 'next/og';

/**
 * Homepage / default social card (pre-beta item 6).
 *
 * Static composition in the editorial identity: warm paper field,
 * rubric rules, masthead wordmark with the restrained brand red on
 * "XX", headline pair + standfirst. Deliberately contains NO dynamic
 * data — the same card serves every page that doesn't declare its own,
 * so no user content can ever leak through image generation.
 */
export const runtime = 'edge';
export const alt = 'Audio XX — Notes on Your System';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const PAPER = '#F8F3E7';
const INK = '#1F1D1A';
const INK_MUTED = '#5A5651';
const ACCENT = '#A6432C';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: PAPER,
          padding: '64px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 28 }}>
          <div style={{ width: 44, height: 3, background: ACCENT, display: 'flex' }} />
          <div
            style={{
              display: 'flex',
              fontSize: 24,
              letterSpacing: 10,
              color: INK_MUTED,
              textTransform: 'uppercase',
            }}
          >
            System Assessment
          </div>
          <div style={{ width: 44, height: 3, background: ACCENT, display: 'flex' }} />
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 104,
            fontWeight: 700,
            color: INK,
            lineHeight: 1.05,
            textAlign: 'center',
          }}
        >
          Notes on Your System
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 34,
            fontSize: 30,
            color: INK_MUTED,
            textAlign: 'center',
            maxWidth: 900,
            lineHeight: 1.4,
          }}
        >
          A system-level listening advisor for hi-fi enthusiasts — and it
          tells you when nothing needs changing.
        </div>

        <div style={{ display: 'flex', marginTop: 48, fontSize: 34, fontWeight: 700, color: INK, letterSpacing: 4 }}>
          AUDIO&nbsp;<span style={{ color: ACCENT }}>XX</span>
        </div>
      </div>
    ),
    size,
  );
}
