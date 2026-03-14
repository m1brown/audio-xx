/**
 * Audio XX — Advisory Presentation Layer
 *
 * These files format deterministic reasoning output into the structured
 * system review shown to the user.
 *
 * Important:
 *   The reasoning engine remains the source of truth.
 *   This layer should only:
 *     - format advisory structure
 *     - apply narrative tone
 *     - render UI components
 *   Do NOT add reasoning logic here.
 *
 * ── Per-component structured analysis ────────────────
 *
 * Each component: bold name heading, summary sentence, sonic
 * contribution and tendency bullet lists, verdict sentence.
 * HR dividers between components.
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
            <hr style={{ border: 'none', borderTop: '1px solid #e8e4dc', margin: '1.2rem 0' }} />
          )}

          {/* Component name — bold heading with role */}
          <div style={{ marginBottom: '0.3rem' }}>
            <strong style={{ fontSize: '0.98rem', color: '#111' }}>{comp.name}</strong>
            {comp.role && (
              <span style={{ color: '#999', fontSize: '0.88rem', marginLeft: '0.5rem' }}>
                {comp.role}
              </span>
            )}
          </div>

          {/* Summary sentence */}
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', lineHeight: 1.65, color: '#333' }}>
            {renderText(comp.summary)}
          </p>

          {/* Sonic contribution */}
          {comp.strengths.length > 0 && (
            <div style={{ marginBottom: '0.4rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.93rem', color: '#555', marginBottom: '0.2rem' }}>
                Sonic contribution
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

          {/* Tendencies / trade-offs */}
          {comp.weaknesses.length > 0 && (
            <div style={{ marginBottom: '0.4rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.93rem', color: '#555', marginBottom: '0.2rem' }}>
                Tendencies to be aware of
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.6 }}>
                {comp.weaknesses.map((w, j) => (
                  <li key={j} style={{ fontSize: '0.92rem', color: '#777', marginBottom: '0.15rem' }}>
                    {renderText(w)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Verdict — concluding sentence */}
          <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.95rem', lineHeight: 1.6, color: '#444' }}>
            {renderText(comp.verdict)}
          </p>

          {/* Component links — learn more */}
          {comp.links && comp.links.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#888' }}>Learn more: </span>
              {comp.links.map((link, k) => (
                <span key={k}>
                  {k > 0 && <span style={{ color: '#ccc', margin: '0 0.3rem' }}>&middot;</span>}
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.85rem', color: '#5a8a9a', textDecoration: 'none' }}
                  >
                    {link.label}
                  </a>
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
