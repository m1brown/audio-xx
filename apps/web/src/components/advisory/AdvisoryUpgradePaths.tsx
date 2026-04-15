/**
 * Ranked upgrade paths with product options.
 *
 * Each path: rank, label, impact tag, rationale, then nested product options
 * with pros/cons/verdict/systemDelta. Clean white card styling.
 */

import type { UpgradePath } from '../../lib/advisory-response';
import { renderText } from './render-text';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$', CHF: 'CHF ',
};

function formatPrice(amount: number, currency?: string): string {
  const code = currency ?? 'USD';
  const symbol = CURRENCY_SYMBOLS[code] ?? `${code} `;
  return `${symbol}${amount.toLocaleString()}`;
}

interface Props {
  paths: UpgradePath[];
}

export default function AdvisoryUpgradePaths({ paths }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {paths.map((path) => (
        <div key={path.rank}>
          {/* Path header — rank + strategy label + impact tag */}
          <div style={{ marginBottom: '0.45rem', display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: '0.98rem', color: '#333' }}>
              Path {path.rank}: {path.strategyLabel ?? path.label}
            </span>
            {path.strategyLabel && path.strategyLabel !== path.label && (
              <span style={{ fontSize: '0.82rem', color: '#999', fontWeight: 400 }}>
                {path.label}
              </span>
            )}
            {path.impact && (
              <span
                style={{
                  fontSize: '0.73rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase' as const,
                  padding: '0.12rem 0.5rem',
                  borderRadius: '4px',
                  color: path.rank === 1 ? '#3a6a3a' : '#6a6a3a',
                  background: path.rank === 1 ? '#eaf5ea' : '#f5f5e2',
                }}
              >
                {path.impact}
              </span>
            )}
          </div>

          {/* Rationale */}
          <p style={{ margin: '0 0 0.7rem 0', fontSize: '0.95rem', lineHeight: 1.65, color: '#444' }}>
            {renderText(path.rationale)}
          </p>

          {/* Explanation layer (Feature 9) — "Why this works" */}
          {path.explanation && path.explanation.length > 0 && (
            <div style={{ margin: '0 0 0.7rem 0', fontSize: '0.88rem', color: '#6a6a5a', lineHeight: 1.55 }}>
              <span style={{ fontWeight: 500, fontSize: '0.82rem', letterSpacing: '0.02em', color: '#888' }}>Why this works:</span>
              <ul style={{ margin: '0.2rem 0 0 1.1rem', padding: 0, listStyle: 'disc' }}>
                {path.explanation.slice(0, 2).map((line, i) => (
                  <li key={i} style={{ marginBottom: '0.1rem' }}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Product options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingLeft: '0.25rem' }}>
            {path.options.map((opt) => (
              <div
                key={opt.rank}
                style={{
                  padding: '0.75rem 0.95rem',
                  border: '1px solid #eae8e4',
                  borderRadius: '6px',
                  background: '#fff',
                }}
              >
                {/* Option header — rank + name + price */}
                <div style={{ marginBottom: '0.3rem' }}>
                  <span style={{ fontWeight: 500, color: '#999', fontSize: '0.85rem', marginRight: '0.4rem' }}>
                    {opt.rank}.
                  </span>
                  <strong style={{ color: '#2a2a2a' }}>
                    {opt.brand ? `${opt.brand} ` : ''}{opt.name}
                  </strong>
                  {opt.price != null && opt.price > 0 && (
                    <span style={{ color: '#777', marginLeft: '0.5rem', fontSize: '0.92rem' }}>
                      {formatPrice(opt.price, opt.priceCurrency)}
                    </span>
                  )}
                  {opt.priceNote && (
                    <span style={{ color: '#999', marginLeft: '0.35rem', fontSize: '0.85rem' }}>
                      {opt.priceNote}
                    </span>
                  )}
                </div>

                {/* Summary */}
                <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.93rem', lineHeight: 1.6, color: '#444' }}>
                  {renderText(opt.summary)}
                </p>

                {/* Pros */}
                {opt.pros.length > 0 && (
                  <ul style={{ margin: '0 0 0.3rem 0', paddingLeft: '1.1rem', lineHeight: 1.6 }}>
                    {opt.pros.map((p, j) => (
                      <li key={j} style={{ fontSize: '0.9rem', color: '#5a7050', marginBottom: '0.1rem' }}>
                        {renderText(p)}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Cons */}
                {opt.cons && opt.cons.length > 0 && (
                  <ul style={{ margin: '0 0 0.3rem 0', paddingLeft: '1.1rem', lineHeight: 1.6 }}>
                    {opt.cons.map((c, j) => (
                      <li key={j} style={{ fontSize: '0.9rem', color: '#8a6a50', marginBottom: '0.1rem' }}>
                        {renderText(c)}
                      </li>
                    ))}
                  </ul>
                )}

                {/* System delta — why this fits / improvements / trade-offs */}
                {opt.systemDelta && (
                  <div style={{
                    marginTop: '0.5rem',
                    padding: '0.55rem 0.75rem',
                    background: '#f8f6f0',
                    borderRadius: '5px',
                    fontSize: '0.88rem',
                    lineHeight: 1.6,
                  }}>
                    {opt.systemDelta.whyFitsSystem && (
                      <p style={{ margin: '0 0 0.3rem 0', color: '#555' }}>
                        {renderText(opt.systemDelta.whyFitsSystem)}
                      </p>
                    )}
                    {opt.systemDelta.likelyImprovements && opt.systemDelta.likelyImprovements.length > 0 && (
                      <div style={{ margin: '0 0 0.25rem 0', color: '#666' }}>
                        <span style={{ fontWeight: 500, color: '#5a7050' }}>Likely improvements: </span>
                        {opt.systemDelta.likelyImprovements.join(' · ')}
                      </div>
                    )}
                    {opt.systemDelta.tradeOffs && opt.systemDelta.tradeOffs.length > 0 && (
                      <div style={{ color: '#999' }}>
                        <span style={{ fontWeight: 500 }}>Trade-offs: </span>
                        {opt.systemDelta.tradeOffs.join(' · ')}
                      </div>
                    )}
                  </div>
                )}

                {/* Verdict */}
                {opt.verdict && (
                  <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.9rem', fontWeight: 600, color: '#333' }}>
                    {renderText(opt.verdict)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
