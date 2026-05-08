/**
 * Source reference list — review attributions and trusted sources.
 * Small, subdued text — secondary reference material.
 *
 * Two-tier filtering (see source-whitelist.ts):
 *   - If Tier 1 (preferred) sources exist → show only those
 *   - If not → fall back to Tier 2 (acceptable) sources
 *   - Non-whitelisted sources are never shown
 *
 * URL resolution (renderer-side, no data changes):
 *   1. SourceReference.url (per-citation deep link, when curated)
 *   2. SOURCE_WHITELIST entry's homepage url (publication landing page)
 *   3. Plain text — when neither is available (rare; non-whitelisted
 *      sources are filtered out above)
 *
 * The whitelist already curates a homepage URL for every approved
 * publication, so the second tier nearly always resolves. This means
 * sources without a per-review URL still render as a clickable link
 * to the publication, instead of as plain prose.
 */

import type { SourceReference } from '../../lib/advisory-response';
import {
  filterSourcesForDisplay,
  getSourceEntry,
} from '../../lib/evidence/source-whitelist';

interface AdvisorySourcesProps {
  sources: SourceReference[];
}

export default function AdvisorySources({ sources }: AdvisorySourcesProps) {
  const filtered = filterSourcesForDisplay(sources);
  if (filtered.length === 0) return null;

  return (
    <div style={{ fontSize: '0.82rem', color: '#888', lineHeight: 1.7 }}>
      {filtered.map((s, i) => {
        // Per-citation URL takes precedence over the whitelist homepage
        // fallback. Both are renderer concerns — the engine never sees
        // the resolved href.
        const href = s.url ?? getSourceEntry(s.source)?.url;
        return (
          <div key={i} style={{ marginBottom: '0.25rem' }}>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontWeight: 600, color: '#4a7a8a', textDecoration: 'none' }}
              >
                {s.source} ↗
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
}
