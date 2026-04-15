/**
 * Product option cards — advisory-style structure:
 *   1. Product (name + price)
 *   2. Character — what it sounds like
 *   3. Why it might suit the listener
 *   4. Potential downside
 */

import type { AdvisoryOption } from '../../lib/advisory-response';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$', CHF: 'CHF ',
};

function formatPrice(amount: number, currency?: string): string {
  const code = currency ?? 'USD';
  const symbol = CURRENCY_SYMBOLS[code] ?? `${code} `;
  return `${symbol}${amount.toLocaleString()}`;
}

interface AdvisoryOptionsProps {
  options: AdvisoryOption[];
}

export default function AdvisoryOptions({ options }: AdvisoryOptionsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      {options.map((opt, i) => (
        <div
          key={i}
          style={{
            padding: '0.85rem 1rem',
            borderLeft: '3px solid #d9d9d9',
            background: '#fafafa',
            display: 'flex',
            gap: '0.85rem',
            alignItems: 'flex-start',
          }}
        >
          {/* Optional thumbnail — square, consistent 56×56. Hidden on load
              failure via onError so a broken URL never leaves a broken icon. */}
          {opt.imageUrl && (
            <div style={{
              flex: '0 0 auto',
              width: 56,
              height: 56,
              borderRadius: 4,
              overflow: 'hidden',
              background: '#faf7f2',
              border: '1px solid #ece6da',
            }}>
              <img
                src={opt.imageUrl}
                alt={[opt.brand, opt.name].filter(Boolean).join(' ')}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={(e) => {
                  const wrap = (e.currentTarget as HTMLImageElement).parentElement;
                  if (wrap) wrap.style.display = 'none';
                }}
              />
            </div>
          )}
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          {/* 1. Product — name + price */}
          <div style={{ marginBottom: '0.35rem' }}>
            <strong style={{ color: '#2a2a2a' }}>
              {opt.brand ? `${opt.brand} ` : ''}{opt.name}
            </strong>
            {opt.price != null && opt.price > 0 && (
              <span style={{ color: '#666', marginLeft: '0.5rem', fontSize: '0.92rem' }}>
                {formatPrice(opt.price, opt.priceCurrency)}
              </span>
            )}
          </div>

          {/* 2. Character — what it sounds like */}
          {opt.character && (
            <p style={{
              margin: '0 0 0.3rem 0',
              color: '#555',
              lineHeight: 1.55,
              fontSize: '0.92rem',
              fontStyle: 'italic',
            }}>
              {opt.character}
            </p>
          )}

          {/* 3. Why it might suit the listener */}
          <p style={{ margin: '0 0 0.3rem 0', color: '#333', lineHeight: 1.55, fontSize: '0.95rem' }}>
            {opt.fitNote}
          </p>

          {/* 4. Potential downside */}
          {opt.caution && (
            <p style={{ margin: '0 0 0.3rem 0', color: '#888', fontSize: '0.88rem', lineHeight: 1.5 }}>
              {opt.caution}
            </p>
          )}

          {opt.links && opt.links.length > 0 && (
            <div style={{ fontSize: '0.88rem', color: '#666', marginTop: '0.25rem' }}>
              {opt.links.map((link, li) => (
                <span key={li}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#555', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                  >
                    {link.label}
                  </a>
                  {li < (opt.links?.length ?? 0) - 1 && (
                    <span style={{ margin: '0 0.4rem', color: '#ccc' }}>&middot;</span>
                  )}
                </span>
              ))}
            </div>
          )}
          </div>
        </div>
      ))}
    </div>
  );
}
