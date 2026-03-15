/**
 * Per-component structured analysis.
 *
 * Each component: bold name heading with role, summary sentence,
 * sonic contribution and tendency bullet lists, verdict sentence.
 * Clean borders between components.
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
          {/* Divider between components (not before first) */}
          {i > 0 && (
            <hr style={{ border: 'none', borderTop: '1px solid #eae8e4', margin: '1.3rem 0' }} />
          )}

          {/* Component name — bold heading with role */}
          <div style={{ marginBottom: '0.35rem' }}>
            <strong style={{ fontSize: '0.98rem', color: '#2a2a2a' }}>{comp.name}</strong>
            {comp.role && (
              <span style={{ color: '#aaa', fontSize: '0.88rem', marginLeft: '0.5rem' }}>
                {comp.role}
              </span>
            )}
          </div>

          {/* Summary sentence */}
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', lineHeight: 1.7, color: '#444' }}>
            {renderText(comp.summary)}
          </p>

          {/* Sonic contribution */}
          {comp.strengths.length > 0 && (
            <div style={{ marginBottom: '0.45rem' }}>
              <div style={{
                fontWeight: 500,
                fontSize: '0.88rem',
                color: '#5a7050',
                marginBottom: '0.2rem',
                letterSpacing: '0.01em',
              }}>
                Sonic contribution
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.65 }}>
                {comp.strengths.map((s, j) => (
                  <li key={j} style={{ fontSize: '0.92rem', color: '#444', marginBottom: '0.15rem' }}>
                    {renderText(s)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Design trade-offs — for elite products, framed as intentional philosophy */}
          {comp.designTradeoffs && comp.designTradeoffs.length > 0 && (
            <div style={{ marginBottom: '0.45rem' }}>
              <div style={{
                fontWeight: 500,
                fontSize: '0.88rem',
                color: '#999',
                marginBottom: '0.2rem',
                letterSpacing: '0.01em',
              }}>
                Design character
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.65 }}>
                {comp.designTradeoffs.map((t, j) => (
                  <li key={j} style={{ fontSize: '0.92rem', color: '#888', marginBottom: '0.15rem' }}>
                    {renderText(t)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tendencies / trade-offs */}
          {comp.weaknesses.length > 0 && (
            <div style={{ marginBottom: '0.45rem' }}>
              <div style={{
                fontWeight: 500,
                fontSize: '0.88rem',
                color: '#999',
                marginBottom: '0.2rem',
                letterSpacing: '0.01em',
              }}>
                Tendencies to be aware of
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.65 }}>
                {comp.weaknesses.map((w, j) => (
                  <li key={j} style={{ fontSize: '0.92rem', color: '#888', marginBottom: '0.15rem' }}>
                    {renderText(w)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Verdict — concluding sentence */}
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.95rem', lineHeight: 1.65, color: '#333' }}>
            {renderText(comp.verdict)}
          </p>

          {/* Component links — learn more */}
          {comp.links && comp.links.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#aaa' }}>Learn more: </span>
              {comp.links.map((link, k) => (
                <span key={k}>
                  {k > 0 && <span style={{ color: '#ddd', margin: '0 0.3rem' }}>&middot;</span>}
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.85rem', color: '#4a6a7a', textDecoration: 'none' }}
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
