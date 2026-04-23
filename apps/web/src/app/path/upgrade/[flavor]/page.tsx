import BackLink from '@/components/BackLink';
import AdvisoryProductCards from '@/components/advisory/AdvisoryProductCard';
import {
  DIRECTION_CONTENT,
  type DirectionKey,
} from '@/lib/upgrade-path-content';
import { getProductImage } from '@/lib/product-images';

/**
 * Audio XX — Upgrade direction.
 *
 * Reached from a follow-up chip ("See upgrade options", "Hear what this
 * change does", "Compare paths"). Renders a short direction explanation
 * followed by a small, hand-curated list of catalog products that
 * illustrate the direction.
 *
 * Selection is deliberately static ("Hardcode product arrays for now").
 * No filtering on the user's current system — these are direction-general
 * picks meant to show what the direction LOOKS LIKE in products people
 * can actually buy, not a personalised recommendation. The filtered /
 * personalised view lives on the backlog.
 *
 * Visual identity is mirrored from the brand page — same COLOR token set,
 * same container width, same typographic hierarchy.
 */

// ── Design tokens ───────────────────────────────────────
//
// Mirrored from /brand/[slug] page. Keep in sync — no shared module yet.

const COLOR = {
  textPrimary: '#1F1D1B',
  textSecondary: '#5C5852',
  textMuted: '#8C877F',
  accent: '#B08D57',
  borderLight: '#E8E3D7',
  cardBg: '#FFFEFA',
} as const;

// ── Direction content ──────────────────────────────────
//
// DIRECTION_CONTENT lives in `@/lib/upgrade-path-content` so that both
// this full-page direction view and the in-chat follow-up chips in
// AdvisoryMessage render from the same curated list. Keeping the data
// in one place avoids drift between surfaces.
//
// IMPORTANT: these are direction exemplars, not personalised picks.
// Selection is not engine output — it is a curated illustration of the
// direction. See Playbook §8 (engine vs domain boundary): this file is a
// domain-specific page, so direct product references are appropriate.

interface PageProps {
  params: Promise<{ flavor: string }>;
}

export default async function UpgradeDirectionPage({ params }: PageProps) {
  const { flavor } = await params;
  const key = flavor.toLowerCase() as DirectionKey;
  const content = DIRECTION_CONTENT[key];

  const display = flavor
    .split('-')
    .map((part) => (part.length ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* ── Back link ── */}
      <p style={{
        fontSize: '0.82rem',
        color: COLOR.textMuted,
        marginBottom: '1.25rem',
      }}>
        <BackLink style={{ color: COLOR.textMuted, textDecoration: 'none' }} />
      </p>

      {/* ── Header ── */}
      <header style={{ marginBottom: '1.5rem' }}>
        <p style={{
          margin: '0 0 0.4rem',
          fontSize: '0.78rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: COLOR.textMuted,
        }}>
          Direction
        </p>
        <h1 style={{
          fontSize: '1.85rem',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: COLOR.textPrimary,
          margin: 0,
          lineHeight: 1.2,
        }}>
          {content ? content.title : display}
        </h1>
      </header>

      {content ? (
        <>
          {/* ── Direction explanation ── */}
          <section style={{
            padding: '1.25rem 1.4rem',
            background: COLOR.cardBg,
            border: `1px solid ${COLOR.borderLight}`,
            borderLeft: `3px solid ${COLOR.accent}`,
            borderRadius: '4px',
            color: COLOR.textSecondary,
            fontSize: '0.95rem',
            lineHeight: 1.7,
            marginBottom: '1.75rem',
          }}>
            <p style={{ margin: 0 }}>{content.blurb}</p>
          </section>

          {/* ── Direction exemplars ──
            * Hand-curated catalog products that illustrate the direction.
            * Selection is static — there is no filtering against the
            * user's current system yet. Rendered via the existing
            * AdvisoryProductCards component; no new card type. */}
          <section>
            <p style={{
              margin: '0 0 1rem',
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: COLOR.textMuted,
            }}>
              Direction exemplars
            </p>
            <AdvisoryProductCards options={content.options.map((o) => ({
              ...o,
              imageUrl: o.imageUrl ?? getProductImage(o.brand, o.name),
            }))} />
          </section>
        </>
      ) : (
        /* ── Unknown flavor — honest placeholder ── */
        <section style={{
          padding: '1.25rem 1.4rem',
          background: COLOR.cardBg,
          border: `1px solid ${COLOR.borderLight}`,
          borderLeft: `3px solid ${COLOR.accent}`,
          borderRadius: '4px',
          color: COLOR.textSecondary,
          fontSize: '0.95rem',
          lineHeight: 1.7,
        }}>
          <p style={{
            margin: '0 0 0.6rem',
            fontStyle: 'italic',
            color: COLOR.textMuted,
          }}>
            Filtered recommendation view &mdash; coming soon.
          </p>
          <p style={{ margin: 0 }}>
            This page will narrow the catalog to candidates that fit the{' '}
            <strong style={{ color: COLOR.textPrimary }}>{display}</strong>{' '}
            direction for your current chain &mdash; what it optimises, what
            it trades off, and the gear families that typically express it.
          </p>
        </section>
      )}
    </div>
  );
}
