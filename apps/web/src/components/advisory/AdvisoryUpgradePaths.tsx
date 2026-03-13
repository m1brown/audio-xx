/**
 * Ranked upgrade paths with product options.
 *
 * Each path: rank, label, impact tag, rationale, then nested product options
 * with pros/cons/verdict. Memo-style, information-dense.
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.3rem' }}>
      {paths.map((path) => (
        <div key={path.rank}>
          {/* Path header — rank + label + impact tag */}
          <div style={{ marginBottom: '0.4rem', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.98rem', color: '#222' }}>
              Path {path.rank}: {path.label}
            </span>
            {path.impact && (
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase' as const,
                  padding: '0.12rem 0.45rem',
                  borderRadius: '3px',
                  color: path.rank === 1 ? '#2a6a2a' : '#6a6a2a',
                  background: path.rank === 1 ? '#e8f5e8' : '#f5f5e0',
                }}
              >
                {path.impact}
              </span>
            )}
          </div>

          {/* Rationale */}
          <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.95rem', lineHeight: 1.6, color: '#333' }}>
            {renderText(path.rationale)}
          </p>

          {/* Product options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', paddingLeft: '0.5rem' }}>
            {path.options.map((opt) => (
              <div
                key={opt.rank}
                style={{
                  padding: '0.7rem 0.9rem',
                  borderLeft: '3px solid #d9d9d9',
                  background: '#fafafa',
                }}
              >
                {/* Option header — rank + name + price */}
                <div style={{ marginBottom: '0.3rem' }}>
                  <span style={{ fontWeight: 600, color: '#555', fontSize: '0.85rem', marginRight: '0.4rem' }}>
                    {opt.rank}.
                  </span>
                  <strong style={{ color: '#111' }}>
                    {opt.brand ? `${opt.brand} ` : ''}{opt.name}
                  </strong>
                  {opt.price != null && opt.price > 0 && (
                    <span style={{ color: '#666', marginLeft: '0.5rem', fontSize: '0.92rem' }}>
                      {formatPrice(opt.price, opt.priceCurrency)}
                    </span>
                  )}
                  {opt.priceNote && (
                    <span style={{ color: '#888', marginLeft: '0.35rem', fontSize: '0.85rem' }}>
                      {opt.priceNote}
                    </span>
                  )}
                </div>

                {/* Summary */}
                <p style={{ margin: '0 0 0.35rem 0', fontSize: '0.93rem', lineHeight: 1.55, color: '#333' }}>
                  {renderText(opt.summary)}
                </p>

                {/* Pros */}
                {opt.pros.length > 0 && (
                  <ul style={{ margin: '0 0 0.25rem 0', paddingLeft: '1.1rem', lineHeight: 1.55 }}>
                    {opt.pros.map((p, j) => (
                      <li key={j} style={{ fontSize: '0.9rem', color: '#3a6a3a', marginBottom: '0.1rem' }}>
                        {renderText(p)}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Cons */}
                {opt.cons && opt.cons.length > 0 && (
                  <ul style={{ margin: '0 0 0.25rem 0', paddingLeft: '1.1rem', lineHeight: 1.55 }}>
                    {opt.cons.map((c, j) => (
                      <li key={j} style={{ fontSize: '0.9rem', color: '#8a5a3a', marginBottom: '0.1rem' }}>
                        {renderText(c)}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Verdict */}
                {opt.verdict && (
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.9rem', fontWeight: 600, color: '#222' }}>
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
