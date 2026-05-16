/**
 * Per-component structured analysis.
 *
 * Each component: bold name heading with role, summary sentence,
 * sonic contribution and tendency bullet lists, verdict sentence.
 * Clean borders between components.
 *
 * First-reference image rendering: each component gets a small product
 * image at the top of its entry, anchoring the visual identity of the
 * component being analyzed. Uses the strict resolver chain
 * (catalog → curated overlay → undefined), so products without curated
 * imagery omit the image surface cleanly — no placeholder SVGs, no
 * wrong-brand fallback.
 */

import type { ComponentAssessment } from '../../lib/advisory-response';
import { findProductByComponentName } from '../../lib/consultation';
import { resolveProductImageStrict } from '../../lib/product-images';
import { filterSourcesForDisplay } from '../../lib/evidence/source-whitelist';
import { renderText } from './render-text';

interface Props {
  assessments: ComponentAssessment[];
}

/** Resolve a real product image URL for a component name, or undefined
 *  when no curated image exists. Mirrors the resolution used by
 *  RewrittenSystemReview's renderFirstReferenceImage. */
function resolveComponentImage(componentName: string): string | undefined {
  const product = findProductByComponentName(componentName);
  if (product) {
    return resolveProductImageStrict(product.brand, product.name, product.imageUrl);
  }
  // Fallback: split into brand+name from the component name itself.
  const tokens = componentName.split(/\s+/);
  const brand = tokens[0];
  const name = tokens.slice(1).join(' ') || componentName;
  return resolveProductImageStrict(brand, name);
}

export default function AdvisoryComponentAssessments({ assessments }: Props) {
  return (
    <div>
      {assessments.map((comp, i) => {
        const imageUrl = resolveComponentImage(comp.name);
        return (
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

          {/* First-reference product image — renders only when the
           *  strict resolver returns a real URL. White interior, hairline
           *  border, modest height — visually consistent with the
           *  comparison artifact's editorial-anchor treatment. Graceful
           *  collapse on broken URLs (parent display: none on error). */}
          {imageUrl && (
            <div style={{
              width: '100%',
              maxWidth: '480px',
              height: '220px',
              background: '#FFFFFF',
              border: '1px solid #E5E5E5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.85rem',
              boxSizing: 'border-box',
              marginBottom: '0.85rem',
            }}>
              <img
                src={imageUrl}
                alt={comp.name}
                loading="eager"
                referrerPolicy="no-referrer"
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  display: 'block',
                }}
                onError={(e) => {
                  const wrap = (e.currentTarget as HTMLImageElement).parentElement;
                  if (wrap) wrap.style.display = 'none';
                }}
              />
            </div>
          )}

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

          {/* ── Per-component Sources (Stage PB1.2) ────────────────
             Editorial attribution for this specific component, drawn
             from product.sourceReferences + brand EDITORIAL_SOURCES +
             reviewerQuotes (whitelist-gated, deduped, capped). When
             the two-tier display filter empties the list the section
             is suppressed entirely — no empty heading. Stage 6.2
             preserved: plain text when URL missing, link when URL
             present, never a homepage fallback. */}
          {(() => {
            const displaySources = comp.sources ? filterSourcesForDisplay(comp.sources) : [];
            if (displaySources.length === 0) return null;
            return (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{
                  fontSize: '0.74rem',
                  fontWeight: 500,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase' as const,
                  color: '#999',
                  marginBottom: '0.3rem',
                }}>
                  Sources
                </div>
                <div style={{ fontSize: '0.85rem', color: '#777', lineHeight: 1.7 }}>
                  {displaySources.map((s, k) => {
                    const linkLabel = s.title ? `${s.source} — ${s.title}` : `${s.source} review`;
                    return (
                      <div key={k} style={{ marginBottom: '0.2rem' }}>
                        {s.url ? (
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontWeight: 500, color: '#4a6a7a', textDecoration: 'none' }}
                          >
                            {linkLabel} ↗
                          </a>
                        ) : (
                          <span style={{ fontWeight: 500, color: '#666' }}>{s.source}</span>
                        )}
                        <span style={{ margin: '0 0.35rem', color: '#ccc' }}>—</span>
                        <span style={{ color: '#777' }}>{s.note}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── Per-component Explore (Stage PB1.2) ────────────────
             Commerce/discovery surfaces for this component:
             manufacturer page, dealer, used market, retailer. Kept
             explicitly separate from Sources so editorial provenance
             and purchase paths don't visually conflate. */}
          {comp.links && comp.links.length > 0 && (
            <div style={{ marginTop: '0.55rem' }}>
              <div style={{
                fontSize: '0.74rem',
                fontWeight: 500,
                letterSpacing: '0.08em',
                textTransform: 'uppercase' as const,
                color: '#999',
                marginBottom: '0.3rem',
              }}>
                Explore
              </div>
              <div style={{ fontSize: '0.85rem', color: '#777', lineHeight: 1.7 }}>
                {comp.links.map((link, k) => (
                  <span key={k}>
                    {k > 0 && <span style={{ color: '#ddd', margin: '0 0.3rem' }}>&middot;</span>}
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#4a6a7a', textDecoration: 'none' }}
                    >
                      {link.label}
                    </a>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}
