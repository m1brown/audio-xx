'use client';

/**
 * The trailing block on an assessment, recommendation, comparison or
 * purchase answer: "Continue Exploring" (editorial) then, quieter,
 * "Product Resources" (commerce).
 *
 * Order and weight are deliberate. The editorial section leads, sets in the
 * body face at reading size, with the accent eyebrow every other editorial
 * section uses. The commerce block follows in muted grey at a smaller size
 * with no accent — present for the reader who wants it, never competing
 * with the argument above it.
 *
 * Both halves render only what resolves. `groups` and `resources` arrive
 * already existence-checked by `buildContinueExploring` and
 * `buildProductResources`; if both are empty this renders nothing at all
 * rather than an empty heading.
 */
import React from 'react';
import Link from 'next/link';
import { EDITORIAL, COLOR, sectionHeadingStyle } from '@/lib/editorial-tokens';
import type { ExploreGroup } from '@/lib/continue-exploring';
import type { ProductResource } from '@/lib/product-resources';
import { TrackedAnchor } from './CardTelemetry';

export interface ResponseFooterProps {
  groups: ExploreGroup[];
  /**
   * Omit (or pass empty) on formats that already render purchase links per
   * product — the recommendation and comparison cards do, and repeating
   * them here would be the duplication the brief rules out.
   */
  resources?: ProductResource[];
}

const groupLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--face-grotesque, inherit)',
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: EDITORIAL.inkMuted,
  margin: '0 0 0.4rem',
};

const linkStyle: React.CSSProperties = {
  color: EDITORIAL.ink,
  textDecoration: 'none',
  borderBottom: `1px solid ${EDITORIAL.hairline}`,
  fontSize: '1.0625rem',
  lineHeight: 1.7,
};

/* Commerce links render as chips (2026-08-13, founder direction to lean into
 * the proposal-document devices): a bordered chip reads as an action and
 * separates cleanly from the editorial links above, which stay underlined
 * text. Deliberately quiet — commerce must never out-shout the assessment. */
const commerceLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  color: EDITORIAL.inkMuted,
  textDecoration: 'none',
  fontFamily: 'var(--face-grotesque, inherit)',
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  border: `1px solid ${EDITORIAL.hairline}`,
  borderRadius: 2,
  padding: '0.22rem 0.55rem',
};

/** Bordered card for a Continue Exploring group. */
const cardStyle: React.CSSProperties = {
  border: `1px solid ${EDITORIAL.hairline}`,
  borderRadius: 2,
  padding: '0.9rem 1rem 1rem',
};

/** One product's resource row — ruled, name left, chips right. */
const resourceRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '0.5rem 1rem',
  padding: '0.6rem 0',
  borderTop: `1px solid ${EDITORIAL.hairline}`,
};

export default function ResponseFooter({ groups, resources }: ResponseFooterProps) {
  const hasGroups = groups.length > 0;
  const hasResources = (resources?.length ?? 0) > 0;
  if (!hasGroups && !hasResources) return null;

  return (
    <div style={{ marginTop: '2.75rem' }}>
      {hasGroups && (
        <section
          aria-labelledby="continue-exploring"
          style={{ borderTop: `1px solid ${EDITORIAL.hairline}`, paddingTop: '1.4rem' }}
        >
          <h3 id="continue-exploring" style={{ ...sectionHeadingStyle, marginBottom: '1rem' }}>
            Continue Exploring
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))',
              gap: '1.35rem',
            }}
          >
            {groups.map((g) => (
              <div key={g.title} style={cardStyle}>
                <p style={groupLabelStyle}>{g.title}</p>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {g.links.map((l) => (
                    <li key={l.href} style={{ marginBottom: '0.3rem' }}>
                      <Link href={l.href} style={linkStyle}>
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {hasResources && (
        <section
          aria-labelledby="product-resources"
          style={{
            borderTop: `1px solid ${EDITORIAL.hairline}`,
            marginTop: hasGroups ? '1.75rem' : 0,
            paddingTop: '1.1rem',
          }}
        >
          <h3
            id="product-resources"
            style={{ ...groupLabelStyle, color: COLOR.textMuted, marginBottom: '0.75rem' }}
          >
            Product Resources
          </h3>
          {resources!.map((r) => (
            <div key={r.title} style={resourceRowStyle}>
              <span
                style={{
                  fontSize: '1.0625rem',
                  color: EDITORIAL.ink,
                }}
              >
                {r.title}
              </span>
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {r.links.map((l) => (
                <React.Fragment key={l.label}>
                  <TrackedAnchor
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    product={r.title}
                    role={undefined}
                    kind={l.label === 'Buy New' ? 'buy_new' : l.label === 'Used Market' ? 'buy_used' : 'manufacturer'}
                    label={l.label}
                    style={commerceLinkStyle}
                  >
                    {l.label}
                  </TrackedAnchor>
                </React.Fragment>
              ))}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
