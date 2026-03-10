/**
 * Source reference list — review attributions and trusted sources.
 * Small, subdued text — secondary reference material.
 */

import type { SourceReference } from '../../lib/advisory-response';

interface AdvisorySourcesProps {
  sources: SourceReference[];
}

export default function AdvisorySources({ sources }: AdvisorySourcesProps) {
  return (
    <div style={{ fontSize: '0.82rem', color: '#888', lineHeight: 1.7 }}>
      {sources.map((s, i) => (
        <div key={i} style={{ marginBottom: '0.25rem' }}>
          <span style={{ fontWeight: 600, color: '#777' }}>{s.source}</span>
          <span style={{ margin: '0 0.35rem', color: '#bbb' }}>—</span>
          <span>{s.note}</span>
        </div>
      ))}
    </div>
  );
}
