'use client';

interface FiredRule {
  id: string;
  label: string;
  outputs: {
    explanation: string;
    suggestions: string[];
    risks: string[];
    next_step: string;
    verdict?: string;
    archetype_note?: string;
  };
}

interface Props {
  signals: {
    traits: Record<string, string>;
    symptoms: string[];
    archetype_hints: string[];
    uncertainty_level: number;
    matched_phrases: string[];
  };
  result: {
    fired_rules: FiredRule[];
    archetype_conflict_detected: boolean;
    uncertainty_level: number;
  };
}

export default function EvaluationOutput({ signals, result }: Props) {
  return (
    <div style={{ color: '#111' }}>
      {result.archetype_conflict_detected && (
        <div
          style={{
            marginBottom: '1.25rem',
            padding: '0.9rem 1rem',
            borderLeft: '3px solid #c4122f',
            background: '#faf7f7',
            color: '#333',
            fontSize: '0.98rem',
          }}
        >
          Some of your preferences point toward engagement, others toward composure.
          Improving one typically reduces the other.
        </div>
      )}

      {result.fired_rules.map((rule, index) => (
        <section key={rule.id} style={{ marginBottom: '2rem' }}>
          {index > 0 && (
            <hr style={{ border: 0, borderTop: '1px solid #ddd', margin: '0 0 1.5rem 0' }} />
          )}

          <p
            style={{
              margin: '0 0 1rem 0',
              fontSize: '1.18rem',
              lineHeight: 1.65,
              color: '#111',
            }}
          >
            {rule.outputs.explanation.trim()}
          </p>

          {rule.outputs.suggestions.length > 0 && (
            <div style={{ marginBottom: '1.1rem' }}>
              <div
                style={{
                  marginBottom: '0.45rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: '#666',
                }}
              >
                Advice
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.15rem', color: '#222' }}>
                {rule.outputs.suggestions.map((s, i) => (
                  <li key={i} style={{ marginBottom: '0.35rem' }}>
                    {s.trim()}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rule.outputs.risks.length > 0 && (
            <div style={{ marginBottom: '1.1rem' }}>
              <div
                style={{
                  marginBottom: '0.45rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: '#666',
                }}
              >
                Trade-offs
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.15rem', color: '#222' }}>
                {rule.outputs.risks.map((r, i) => (
                  <li key={i} style={{ marginBottom: '0.35rem' }}>
                    {r.trim()}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <div
              style={{
                marginBottom: '0.45rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: '#666',
              }}
            >
              Next step
            </div>
            <p style={{ margin: 0, color: '#222' }}>{rule.outputs.next_step.trim()}</p>
          </div>

          {rule.outputs.archetype_note && (
            <p style={{ margin: '0.8rem 0 0 0', color: '#666', fontStyle: 'italic' }}>
              {rule.outputs.archetype_note.trim()}
            </p>
          )}

          <details style={{ marginTop: '1rem', color: '#666', fontSize: '0.92rem' }}>
            <summary style={{ cursor: 'pointer' }}>How this was generated</summary>
            <div style={{ marginTop: '0.6rem' }}>
              <p style={{ margin: '0 0 0.4rem 0' }}>
                <strong>Rule:</strong> {rule.id} — {rule.label}
              </p>
              {signals.archetype_hints.length > 0 && (
                <p style={{ margin: '0 0 0.4rem 0' }}>
                  <strong>Archetype context:</strong> {signals.archetype_hints.join(', ')}
                </p>
              )}
              <p style={{ margin: 0 }}>
                Reviews inform explanations; they do not decide outcomes.
              </p>
            </div>
          </details>
        </section>
      ))}

      {result.fired_rules.length === 0 && (
        <p style={{ color: '#666' }}>
          No rules matched. Try describing what you hear in more detail.
        </p>
      )}

      {/* Collapsible signal diagnostics */}
      {(signals.matched_phrases.length > 0 ||
        signals.symptoms.length > 0 ||
        Object.keys(signals.traits).length > 0) && (
        <details style={{ marginTop: '1.5rem', color: '#666', fontSize: '0.92rem' }}>
          <summary style={{ cursor: 'pointer' }}>How this was interpreted</summary>
          <div style={{ marginTop: '0.6rem' }}>
            {signals.matched_phrases.length > 0 && (
              <p style={{ margin: '0 0 0.5rem 0', color: '#333' }}>
                <strong>Matched:</strong>{' '}
                {signals.matched_phrases.join(', ')}
              </p>
            )}
            {signals.symptoms.length > 0 && (
              <p style={{ margin: '0 0 0.5rem 0', color: '#333' }}>
                <strong>Symptoms:</strong>{' '}
                {signals.symptoms.map((s) => s.replace(/_/g, ' ')).join(', ')}
              </p>
            )}
            {Object.keys(signals.traits).length > 0 && (
              <p style={{ margin: '0 0 0.5rem 0', color: '#333' }}>
                <strong>Traits:</strong>{' '}
                {Object.entries(signals.traits)
                  .map(([trait, direction]) => `${trait.replace(/_/g, ' ')} ${direction === 'up' ? '↑' : '↓'}`)
                  .join(', ')}
              </p>
            )}
            {signals.uncertainty_level > 0 && (
              <p style={{ margin: 0, color: '#666', fontSize: '0.92rem' }}>
                Uncertainty level {signals.uncertainty_level}/3
              </p>
            )}
          </div>
        </details>
      )}
    </div>
  );
}