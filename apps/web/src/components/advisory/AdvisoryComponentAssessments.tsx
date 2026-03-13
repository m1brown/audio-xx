/**
 * Per-component structured analysis — reference PDF style.
 *
 * Each component: bold name heading, summary sentence, Strengths/Weakness
 * bullet lists, bold verdict sentence. HR dividers between components.
 */

import type { ComponentAssessment } from '../../lib/advisory-response';
import { renderText } from './render-text';

interface Props {
  assessments: ComponentAssessment[];
}

export default function AdvisoryComponentAssessments({ assessments }: Props) {
  return (
    <div>
      {assessments.map((comp, i) => (
        <div key={i}>
          {/* HR divider between components (not before first) */}
          {i > 0 && (
            <hr style={{ border: 'none', borderTop: '1px solid #ddd', margin: '1.2rem 0' }} />
          )}

          {/* Component name — bold heading */}
          <div style={{ marginBottom: '0.3rem' }}>
            <strong style={{ fontSize: '0.98rem', color: '#111' }}>{comp.name}</strong>
            {comp.role && (
              <span style={{ color: '#888', fontSize: '0.88rem', marginLeft: '0.5rem' }}>
                ({comp.role})
              </span>
            )}
          </div>

          {/* Summary sentence */}
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', lineHeight: 1.65, color: '#333' }}>
            {renderText(comp.summary)}
          </p>

          {/* Strengths */}
          {comp.strengths.length > 0 && (
            <div style={{ marginBottom: '0.4rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.93rem', color: '#333', marginBottom: '0.2rem' }}>
                Strengths:
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.6 }}>
                {comp.strengths.map((s, j) => (
                  <li key={j} style={{ fontSize: '0.92rem', color: '#333', marginBottom: '0.15rem' }}>
                    {renderText(s)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Weakness */}
          {comp.weaknesses.length > 0 && (
            <div style={{ marginBottom: '0.4rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.93rem', color: '#333', marginBottom: '0.2rem' }}>
                Weakness:
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.6 }}>
                {comp.weaknesses.map((w, j) => (
                  <li key={j} style={{ fontSize: '0.92rem', color: '#555', marginBottom: '0.15rem' }}>
                    {renderText(w)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Verdict — bold concluding sentence */}
          <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.95rem', lineHeight: 1.6 }}>
            <strong style={{ color: '#222' }}>{renderText(comp.verdict)}</strong>
          </p>
        </div>
      ))}
    </div>
  );
}
