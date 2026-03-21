/**
 * Source reference list — review attributions and trusted sources.
 * Small, subdued text — secondary reference material.
 *
 * Two-tier filtering (see source-whitelist.ts):
 *   - If Tier 1 (preferred) sources exist → show only those
 *   - If not → fall back to Tier 2 (acceptable) sources
 *   - Non-whitelisted sources are never shown
 */

import type { SourceReference } from '../../lib/advisory-response';
import { filterSourcesForDisplay } from '../../lib/evidence/source-whitelist';

interface AdvisorySourcesProps {
  sources: SourceReference[];
}

export default function AdvisorySources({ sources }: AdvisorySourcesProps) {
  const filtered = filterSourcesForDisplay(sources);
  if (filtered.length === 0) return null;

  return (
    <div style={{ fontSize: '0.82rem', color: '#888', lineHeight: 1.7 }}>
      {filtered.map((s, i) => (
        <div key={i} style={{ marginBottom: '0.25rem' }}>
          {s.url ? (
            <a
              href={s.url}
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
      ))}
    </div>
  );
}
