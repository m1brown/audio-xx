/**
 * Collapsible signal transparency — "How this was interpreted."
 * Shows matched phrases, symptoms, and trait directions.
 * Uses native HTML <details> for zero-JS expand/collapse.
 */

'use client';

interface AdvisoryDiagnosticsProps {
  matchedPhrases: string[];
  symptoms: string[];
  traits: Record<string, 'up' | 'down'>;
}

export default function AdvisoryDiagnostics({
  matchedPhrases,
  symptoms,
  traits,
}: AdvisoryDiagnosticsProps) {
  const traitEntries = Object.entries(traits);

  // Don't render if empty
  if (matchedPhrases.length === 0 && symptoms.length === 0 && traitEntries.length === 0) {
    return null;
  }

  return (
    <details
      style={{
        fontSize: '0.82rem',
        color: '#999',
        lineHeight: 1.65,
        cursor: 'pointer',
      }}
    >
      <summary
        style={{
          fontSize: '0.78rem',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase' as const,
          color: '#aaa',
          marginBottom: '0.6rem',
          userSelect: 'none',
        }}
      >
        How this was interpreted
      </summary>

      <div style={{ paddingLeft: '0.25rem' }}>
        {matchedPhrases.length > 0 && (
          <div style={{ marginBottom: '0.5rem' }}>
            <span style={{ color: '#888', fontWeight: 600 }}>Matched phrases: </span>
            {matchedPhrases.map((p, i) => (
              <span key={i}>
                <span
                  style={{
                    background: '#f0ede6',
                    padding: '0.1rem 0.35rem',
                    borderRadius: '3px',
                    fontSize: '0.8rem',
                    color: '#666',
                  }}
                >
                  {p}
                </span>
                {i < matchedPhrases.length - 1 && <span style={{ margin: '0 0.25rem' }}> </span>}
              </span>
            ))}
          </div>
        )}

        {symptoms.length > 0 && (
          <div style={{ marginBottom: '0.5rem' }}>
            <span style={{ color: '#888', fontWeight: 600 }}>Symptoms: </span>
            {symptoms.join(', ')}
          </div>
        )}

        {traitEntries.length > 0 && (
          <div>
            <span style={{ color: '#888', fontWeight: 600 }}>Trait signals: </span>
            {traitEntries.map(([trait, dir], i) => (
              <span key={trait}>
                {trait} {dir === 'up' ? '↑' : '↓'}
                {i < traitEntries.length - 1 && ', '}
              </span>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
