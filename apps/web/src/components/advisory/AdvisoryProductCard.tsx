/**
 * Enhanced product card for advisory shortlists and comparisons.
 *
 * Extends the existing AdvisoryOptions layout with:
 *   - Sonic direction label
 *   - Product type badge
 *   - Structured link bar (manufacturer → retailer → used market)
 *   - Availability / used-price indicators
 *   - Optional product image (with fallback)
 *
 * Backwards compatible — renders identically to AdvisoryOptions when
 * enhanced fields are absent. Controlled by the presence of
 * sonicDirectionLabel, productType, manufacturerUrl, etc.
 */

import type { AdvisoryOption } from '../../lib/advisory-response';
import { renderText } from './render-text';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$', CHF: 'CHF ',
};

function formatPrice(amount: number, currency?: string): string {
  const code = currency ?? 'USD';
  const symbol = CURRENCY_SYMBOLS[code] ?? `${code} `;
  return `${symbol}${amount.toLocaleString()}`;
}

const AVAILABILITY_LABELS: Record<string, { text: string; color: string; bg: string }> = {
  discontinued: { text: 'Discontinued', color: '#8a6030', bg: '#faf0e6' },
  vintage: { text: 'Vintage', color: '#6a5a30', bg: '#f5f0e0' },
};

interface AdvisoryProductCardProps {
  options: AdvisoryOption[];
}

export default function AdvisoryProductCards({ options }: AdvisoryProductCardProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      {options.map((opt, i) => (
        <ProductCard key={i} opt={opt} />
      ))}
    </div>
  );
}

function ProductCard({ opt }: { opt: AdvisoryOption }) {
  const hasEnhancedFields = !!(opt.sonicDirectionLabel || opt.productType || opt.availability);
  const availBadge = opt.availability ? AVAILABILITY_LABELS[opt.availability] : undefined;

  return (
    <div
      style={{
        padding: '0.85rem 1rem',
        borderLeft: '3px solid #d9d9d9',
        background: '#fafafa',
      }}
    >
      {/* ── Header: name, price, badges ──────────── */}
      <div style={{ marginBottom: '0.35rem' }}>
        <strong style={{ color: '#111' }}>
          {opt.brand ? `${opt.brand} ` : ''}{opt.name}
        </strong>
        {opt.price != null && opt.price > 0 && (
          <span style={{ color: '#666', marginLeft: '0.5rem', fontSize: '0.92rem' }}>
            {formatPrice(opt.price, opt.priceCurrency)}
          </span>
        )}
        {/* Availability badge */}
        {availBadge && (
          <span
            style={{
              marginLeft: '0.5rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.03em',
              padding: '0.1rem 0.4rem',
              borderRadius: '3px',
              color: availBadge.color,
              background: availBadge.bg,
            }}
          >
            {availBadge.text}
          </span>
        )}
      </div>

      {/* ── Product type + sonic direction ────────── */}
      {hasEnhancedFields && (
        <div
          style={{
            display: 'flex',
            gap: '0.6rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: '0.35rem',
            fontSize: '0.83rem',
            color: '#888',
          }}
        >
          {opt.productType && <span>{opt.productType}</span>}
          {opt.productType && opt.sonicDirectionLabel && (
            <span style={{ color: '#ccc' }}>&middot;</span>
          )}
          {opt.sonicDirectionLabel && (
            <span style={{ fontStyle: 'italic', color: '#7a7a6a' }}>
              {opt.sonicDirectionLabel}
            </span>
          )}
        </div>
      )}

      {/* ── Used price range ─────────────────────── */}
      {opt.usedPriceRange && (
        <div style={{ fontSize: '0.83rem', color: '#888', marginBottom: '0.3rem' }}>
          Typical used: {formatPrice(opt.usedPriceRange.low)}–{formatPrice(opt.usedPriceRange.high)}
        </div>
      )}

      {/* ── Character ────────────────────────────── */}
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

      {/* ── Fit note ─────────────────────────────── */}
      <p style={{ margin: '0 0 0.3rem 0', color: '#333', lineHeight: 1.55, fontSize: '0.95rem' }}>
        {renderText(opt.fitNote)}
      </p>

      {/* ── Caution ──────────────────────────────── */}
      {opt.caution && (
        <p style={{ margin: '0 0 0.3rem 0', color: '#888', fontSize: '0.88rem', lineHeight: 1.5 }}>
          {opt.caution}
        </p>
      )}

      {/* ── Link bar ─────────────────────────────── */}
      <LinkBar opt={opt} />

      {/* ── System delta ──────────────────────────── */}
      {opt.systemDelta && (
        <div style={{ marginTop: '0.45rem', padding: '0.55rem 0.7rem', background: '#f8f6f0', borderRadius: '4px', fontSize: '0.88rem', lineHeight: 1.55 }}>
          {opt.systemDelta.whyFitsSystem && (
            <p style={{ margin: '0 0 0.3rem 0', color: '#444' }}>
              {opt.systemDelta.whyFitsSystem}
            </p>
          )}
          {opt.systemDelta.likelyImprovements && opt.systemDelta.likelyImprovements.length > 0 && (
            <div style={{ margin: '0 0 0.25rem 0', color: '#555' }}>
              <span style={{ fontWeight: 500, color: '#5a7050' }}>Likely improvements: </span>
              {opt.systemDelta.likelyImprovements.join(' · ')}
            </div>
          )}
          {opt.systemDelta.tradeOffs && opt.systemDelta.tradeOffs.length > 0 && (
            <div style={{ color: '#888' }}>
              <span style={{ fontWeight: 500 }}>Trade-offs: </span>
              {opt.systemDelta.tradeOffs.join(' · ')}
            </div>
          )}
        </div>
      )}

      {/* ── Find used ─────────────────────────────── */}
      {opt.usedMarketSources && opt.usedMarketSources.length > 0 && (
        <div style={{ marginTop: '0.35rem', fontSize: '0.82rem', color: '#7a7050' }}>
          <span style={{ fontWeight: 500 }}>Find used: </span>
          {opt.usedMarketSources.map((src, si) => (
            <span key={si}>
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#7a7050', textDecoration: 'underline', textUnderlineOffset: '2px' }}
              >
                {src.name}
              </a>
              {si < (opt.usedMarketSources?.length ?? 0) - 1 && (
                <span style={{ margin: '0 0.3rem', color: '#ccc' }}>&middot;</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Structured link bar: manufacturer → retailer(s) → used market.
 * Falls back to flat link list when enhanced fields are absent.
 */
function LinkBar({ opt }: { opt: AdvisoryOption }) {
  // Build ordered link list: manufacturer first, then retailers, then used market
  const links: Array<{ label: string; url: string; kind: 'manufacturer' | 'retailer' | 'used' }> = [];

  // Manufacturer link (deduplicate from links array)
  if (opt.manufacturerUrl) {
    links.push({ label: opt.brand ?? 'Manufacturer', url: opt.manufacturerUrl, kind: 'manufacturer' });
  }

  // Retailer links (from the links array, excluding manufacturer and used-market URLs)
  if (opt.links) {
    for (const link of opt.links) {
      if (link.url === opt.manufacturerUrl) continue;
      if (link.url === opt.usedMarketUrl) continue;
      links.push({ label: link.label, url: link.url, kind: 'retailer' });
    }
  }

  // Used-market link
  if (opt.usedMarketUrl) {
    // Don't duplicate if it was already in the retailer links
    if (!links.some((l) => l.url === opt.usedMarketUrl)) {
      links.push({ label: 'Search used', url: opt.usedMarketUrl, kind: 'used' });
    }
  }

  // Fallback: if no enhanced fields, use original link rendering
  if (links.length === 0 && opt.links && opt.links.length > 0) {
    return (
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
    );
  }

  if (links.length === 0) return null;

  return (
    <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.3rem', display: 'flex', flexWrap: 'wrap', gap: '0.15rem', alignItems: 'center' }}>
      {links.map((link, li) => (
        <span key={li}>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: link.kind === 'manufacturer' ? '#444' : link.kind === 'used' ? '#7a7050' : '#555',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
              fontWeight: link.kind === 'manufacturer' ? 500 : 400,
            }}
          >
            {link.label}
          </a>
          {li < links.length - 1 && (
            <span style={{ margin: '0 0.35rem', color: '#ccc' }}>&middot;</span>
          )}
        </span>
      ))}
    </div>
  );
}
