/**
 * Source reference list — review attributions and trusted sources.
 * Small, subdued text — secondary reference material.
 *
 * Two-tier filtering (see source-whitelist.ts):
 *   - If Tier 1 (preferred) sources exist → show only those
 *   - If not → fall back to Tier 2 (acceptable) sources
 *   - Non-whitelisted sources are never shown
 *
 * URL resolution (Stage 6.2):
 *   1. SourceReference.url (per-citation deep link, when curated) →
 *      render as a clickable link.
 *   2. No per-citation URL → render as plain text (bold, not a link).
 *
 * Stage 6.2 rule: do not surface publication homepages as
 * "Reference review" links. The previous homepage fallback made every
 * URL-less citation read as a clickable publication link (e.g.
 * "6moons ↗ → https://6moons.com/"), which violated reviewer-trust
 * UX. When the curated set lacks a specific URL, the citation is
 * still useful as text — but it must not pretend to be a deep link.
 *
 * Link label: when a citation carries a `title`, the link text reads
 * "Publication — Title" so the destination is clear at a glance.
 * Without a title the link reads "Publication review" (e.g.
 * "6moons review") to avoid the bare publication name reading as a
 * homepage handle.
 */

import type { SourceReference } from '../../lib/advisory-response';
import { filterSourcesForDisplay } from '../../lib/evidence/source-whitelist';

interface AdvisorySourcesProps {
  sources: SourceReference[];
}

/**
 * F4 gate (private beta, 2026-05-18):
 *   This component must not render reviewer-derived sources under the
 *   F4 reviewer-data exclusion rule. The component returns null
 *   regardless of input; upstream callers may still pass a sources
 *   array, but it is intentionally never surfaced to users.
 *
 *   The original rendering logic is preserved below behind a
 *   compile-time-dead `if (false)` block so the two-tier filtering
 *   + Stage 6.2 URL-resolution behavior can be re-evaluated post-beta.
 */
export default function AdvisorySources({ sources }: AdvisorySourcesProps) {
  void sources;
  void filterSourcesForDisplay;
  return null;

  // eslint-disable-next-line no-constant-condition
  if (false) {
  const filtered = filterSourcesForDisplay(sources);
  if (filtered.length === 0) return null;

  return (
    <div style={{ fontSize: '0.82rem', color: '#888', lineHeight: 1.7 }}>
      {filtered.map((s, i) => {
        // Stage 6.2: only render as a link when a specific URL is
        // curated. No homepage fallback — bare publication links are
        // misleading as "Reference review."
        const href = s.url;
        const linkLabel = s.title
          ? `${s.source} — ${s.title}`
          : `${s.source} review`;
        return (
          <div key={i} style={{ marginBottom: '0.25rem' }}>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontWeight: 600, color: '#4a7a8a', textDecoration: 'none' }}
              >
                {linkLabel} ↗
              </a>
            ) : (
              <span style={{ fontWeight: 600, color: '#777' }}>{s.source}</span>
            )}
            <span style={{ margin: '0 0.35rem', color: '#bbb' }}>—</span>
            <span>{s.note}</span>
          </div>
        );
      })}
    </div>
  );
  } // end if (false) — F4 gate dormant block
}
