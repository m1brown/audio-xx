/**
 * Per-component structured analysis cards.
 *
 * Each component gets: summary, strengths, weaknesses, verdict.
 * Memo format — clean, dense, information-first.
 */

import type { ComponentAssessment } from '../../lib/advisory-response';
import { renderText } from './render-text';

interface Props {
  assessments: ComponentAssessment[];
}

export default function AdvisoryComponentAssessments({ assessments }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      {assessments.map((comp, i) => (
        <div
          key={i}
          style={{
            padding: '0.85rem 1rem',
            borderLeft: '3px solid #d0cec8',
            background: '#fafaf8',
          }}
        >
          {/* Component name + role */}
          <div style={{ marginBottom: '0.35rem' }}>
            <strong style={{ color: '#111', fontSize: '0.98rem' }}>{comp.name}</strong>
            {comp.role && (
              <span style={{ color: '#888', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                ({comp.role})
              </span>
            )}
          </div>

          {/* Summary */}
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', lineHeight: 1.6, color: '#333' }}>
            {renderText(comp.summary)}
          </p>

          {/* Strengths */}
          {comp.strengths.length > 0 && (
            <div style={{ marginBottom: '0.4rem' }}>
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#4a7a4a',
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase' as const,
                }}
              >
                Strengths
              </span>
              <ul style={{ margin: '0.2rem 0 0 0', paddingLeft: '1.1rem', lineHeight: 1.6 }}>
                {comp.strengths.map((s, j) => (
                  <li key={j} style={{ fontSize: '0.92rem', color: '#333', marginBottom: '0.15rem' }}>
                    {renderText(s)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Weaknesses */}
          {comp.weaknesses.length > 0 && (
            <div style={{ marginBottom: '0.4rem' }}>
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#8a5a3a',
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase' as const,
                }}
              >
                Weaknesses
              </span>
              <ul style={{ margin: '0.2rem 0 0 0', paddingLeft: '1.1rem', lineHeight: 1.6 }}>
                {comp.weaknesses.map((w, j) => (
                  <li key={j} style={{ fontSize: '0.92rem', color: '#555', marginBottom: '0.15rem' }}>
                    {renderText(w)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Verdict */}
          <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.93rem', fontWeight: 600, color: '#222' }}>
            {renderText(comp.verdict)}
          </p>
        </div>
      ))}
    </div>
  );
}
