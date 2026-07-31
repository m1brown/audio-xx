import { ImageResponse } from 'next/og';

/**
 * Shared-assessment social card (pre-beta item 6).
 *
 * Served for every /artifact link (including saved public artifacts).
 * Static by design: the card names the FORM (a system assessment), not
 * the user's gear — no query params or stored payload data reach image
 * generation, so nothing user-specific can leak through the card.
 */
export const runtime = 'edge';
export const alt = 'An Audio XX System Assessment';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const PAPER = '#F8F3E7';
const INK = '#1F1D1A';
const INK_MUTED = '#5A5651';
const ACCENT = '#A6432C';

export default function ArtifactOpengraphImage() {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 30 }}>
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
            Audio XX
          </div>
          <div style={{ width: 44, height: 3, background: ACCENT, display: 'flex' }} />
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 96,
            fontWeight: 700,
            color: INK,
            lineHeight: 1.08,
            textAlign: 'center',
          }}
        >
          A System Assessment
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 34,
            fontSize: 30,
            color: INK_MUTED,
            textAlign: 'center',
            maxWidth: 880,
            lineHeight: 1.4,
          }}
        >
          How these components work together, where the real bottleneck
          sits — and whether anything needs changing at all.
        </div>
      </div>
    ),
    size,
  );
}
