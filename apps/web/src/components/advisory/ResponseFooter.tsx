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
  fontSize: '0.6875rem',
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
  fontSize: '0.95rem',
  lineHeight: 1.7,
};

const commerceLinkStyle: React.CSSProperties = {
  color: EDITORIAL.inkMuted,
  textDecoration: 'none',
  borderBottom: `1px solid ${EDITORIAL.hairline}`,
  fontSize: '0.82rem',
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
              <div key={g.title}>
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
            <div key={r.title} style={{ marginBottom: '0.55rem' }}>
              <span
                style={{
                  fontSize: '0.85rem',
                  color: EDITORIAL.inkMuted,
                  marginRight: '0.6rem',
                }}
              >
                {r.title}
              </span>
              {r.links.map((l, i) => (
                <React.Fragment key={l.label}>
                  {i > 0 && <span style={{ color: COLOR.textMuted, margin: '0 0.4rem' }}>·</span>}
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
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
