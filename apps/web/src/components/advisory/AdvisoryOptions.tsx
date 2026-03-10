/**
 * Product option cards — each with name, price, fit note, caution, and links.
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {options.map((opt, i) => (
        <div
          key={i}
          style={{
            padding: '0.85rem 1rem',
            borderLeft: '3px solid #d9d9d9',
            background: '#fafafa',
          }}
        >
          <div style={{ marginBottom: '0.3rem' }}>
            <strong style={{ color: '#111' }}>
              {opt.brand ? `${opt.brand} ` : ''}{opt.name}
            </strong>
            {opt.price != null && opt.price > 0 && (
              <span style={{ color: '#666', marginLeft: '0.5rem', fontSize: '0.92rem' }}>
                {formatPrice(opt.price, opt.priceCurrency)}
              </span>
            )}
          </div>
          <p style={{ margin: '0 0 0.3rem 0', color: '#333', lineHeight: 1.55, fontSize: '0.95rem' }}>
            {opt.fitNote}
          </p>
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
      ))}
    </div>
  );
}
