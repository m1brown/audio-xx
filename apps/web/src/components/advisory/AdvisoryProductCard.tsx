/**
 * Enhanced product card for advisory shortlists and comparisons.
 *
 * Design: Clean white cards with light borders, minimal shadows.
 * Reasoning explanations (system delta) are prioritized over chrome.
 *
 * Each card includes:
 *   - Product image (with neutral placeholder)
 *   - Product name, brand, type, sonic direction
 *   - Price / availability / used price range
 *   - Character description
 *   - Fit note + caution
 *   - System delta reasoning (why fits / improvements / trade-offs)
 *   - Used market exploration links (max 2)
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

const AVAILABILITY_LABELS: Record<string, { text: string; color: string; bg: string; border: string }> = {
  discontinued: { text: 'Discontinued', color: '#8a6a40', bg: '#faf4ea', border: '#e8dcc8' },
  vintage: { text: 'Vintage', color: '#6a5a35', bg: '#f5f0e2', border: '#e0d8c0' },
};

/** Neutral placeholder for products without images. */
function ProductImagePlaceholder() {
  return (
    <div style={{
      width: '100%',
      aspectRatio: '4 / 3',
      background: '#f8f6f2',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '0.6rem',
    }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d0ccc0" strokeWidth="1.5">
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <circle cx="8.5" cy="12" r="2" />
        <circle cx="15.5" cy="12" r="2" />
        <path d="M8.5 14v1M15.5 14v1" />
      </svg>
    </div>
  );
}

interface AdvisoryProductCardProps {
  options: AdvisoryOption[];
}

export default function AdvisoryProductCards({ options }: AdvisoryProductCardProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {options.map((opt, i) => (
        <ProductCard key={i} opt={opt} />
      ))}
    </div>
  );
}

function ProductCard({ opt }: { opt: AdvisoryOption }) {
  const hasEnhancedFields = !!(opt.sonicDirectionLabel || opt.productType || opt.availability);
  const availBadge = opt.availability ? AVAILABILITY_LABELS[opt.availability] : undefined;
  const hasImage = !!opt.imageUrl;

  return (
    <div
      style={{
        padding: '1rem 1.1rem',
        border: '1px solid #eae8e4',
        borderRadius: '8px',
        background: '#ffffff',
      }}
    >
      {/* ── Product image ──────────────────────────── */}
      {hasImage ? (
        <div style={{ marginBottom: '0.6rem' }}>
          <img
            src={opt.imageUrl}
            alt={`${opt.brand ?? ''} ${opt.name}`}
            style={{
              width: '100%',
              aspectRatio: '4 / 3',
              objectFit: 'cover',
              borderRadius: '4px',
              background: '#f8f6f2',
            }}
          />
        </div>
      ) : null}

      {/* ── Header: name, price, badges ──────────── */}
      <div style={{ marginBottom: '0.35rem' }}>
        <strong style={{ color: '#2a2a2a', fontSize: '1rem' }}>
          {opt.brand ? `${opt.brand} ` : ''}{opt.name}
        </strong>
        {opt.price != null && opt.price > 0 && (
          <span style={{ color: '#777', marginLeft: '0.5rem', fontSize: '0.92rem' }}>
            {formatPrice(opt.price, opt.priceCurrency)}
          </span>
        )}
        {/* Availability badge */}
        {availBadge && (
          <span
            style={{
              marginLeft: '0.5rem',
              fontSize: '0.73rem',
              fontWeight: 600,
              letterSpacing: '0.03em',
              padding: '0.12rem 0.45rem',
              borderRadius: '4px',
              color: availBadge.color,
              background: availBadge.bg,
              border: `1px solid ${availBadge.border}`,
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
            gap: '0.5rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: '0.4rem',
            fontSize: '0.83rem',
            color: '#999',
          }}
        >
          {opt.productType && <span>{opt.productType}</span>}
          {opt.productType && opt.sonicDirectionLabel && (
            <span style={{ color: '#ddd' }}>&middot;</span>
          )}
          {opt.sonicDirectionLabel && (
            <span style={{ fontStyle: 'italic', color: '#a89870' }}>
              {opt.sonicDirectionLabel}
            </span>
          )}
        </div>
      )}

      {/* ── Used price range ─────────────────────── */}
      {opt.usedPriceRange && (
        <div style={{ fontSize: '0.83rem', color: '#999', marginBottom: '0.35rem' }}>
          Typical used: {formatPrice(opt.usedPriceRange.low)}–{formatPrice(opt.usedPriceRange.high)}
        </div>
      )}

      {/* ── Character ────────────────────────────── */}
      {opt.character && (
        <p style={{
          margin: '0 0 0.4rem 0',
          color: '#666',
          lineHeight: 1.6,
          fontSize: '0.93rem',
          fontStyle: 'italic',
        }}>
          {opt.character}
        </p>
      )}

      {/* ── Fit note ─────────────────────────────── */}
      <p style={{ margin: '0 0 0.35rem 0', color: '#333', lineHeight: 1.6, fontSize: '0.95rem' }}>
        {renderText(opt.fitNote)}
      </p>

      {/* ── Caution ──────────────────────────────── */}
      {opt.caution && (
        <p style={{ margin: '0 0 0.35rem 0', color: '#999', fontSize: '0.88rem', lineHeight: 1.55 }}>
          {opt.caution}
        </p>
      )}

      {/* ── System delta — reasoning block ─────────── */}
      {opt.systemDelta && (
        <div style={{
          marginTop: '0.5rem',
          padding: '0.6rem 0.8rem',
          background: '#f8f6f0',
          borderRadius: '6px',
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

      {/* ── Link bar ─────────────────────────────── */}
      <LinkBar opt={opt} />

      {/* ── Explore used market ─────────────────── */}
      {opt.usedMarketSources && opt.usedMarketSources.length > 0 && (
        <div style={{ marginTop: '0.4rem', fontSize: '0.82rem', color: '#a89870' }}>
          <span style={{ fontWeight: 500 }}>Explore used market: </span>
          {opt.usedMarketSources.map((src, si) => (
            <span key={si}>
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#a89870', textDecoration: 'underline', textUnderlineOffset: '2px' }}
              >
                {src.name}
              </a>
              {si < (opt.usedMarketSources?.length ?? 0) - 1 && (
                <span style={{ margin: '0 0.3rem', color: '#ddd' }}>&middot;</span>
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
  const links: Array<{ label: string; url: string; kind: 'manufacturer' | 'retailer' | 'used' }> = [];

  if (opt.manufacturerUrl) {
    links.push({ label: opt.brand ?? 'Manufacturer', url: opt.manufacturerUrl, kind: 'manufacturer' });
  }

  if (opt.links) {
    for (const link of opt.links) {
      if (link.url === opt.manufacturerUrl) continue;
      if (link.url === opt.usedMarketUrl) continue;
      links.push({ label: link.label, url: link.url, kind: 'retailer' });
    }
  }

  if (opt.usedMarketUrl) {
    if (!links.some((l) => l.url === opt.usedMarketUrl)) {
      links.push({ label: 'Explore used market', url: opt.usedMarketUrl, kind: 'used' });
    }
  }

  if (links.length === 0 && opt.links && opt.links.length > 0) {
    return (
      <div style={{ fontSize: '0.88rem', color: '#777', marginTop: '0.35rem' }}>
        {opt.links.map((link, li) => (
          <span key={li}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#666', textDecoration: 'underline', textUnderlineOffset: '2px' }}
            >
              {link.label}
            </a>
            {li < (opt.links?.length ?? 0) - 1 && (
              <span style={{ margin: '0 0.4rem', color: '#ddd' }}>&middot;</span>
            )}
          </span>
        ))}
      </div>
    );
  }

  if (links.length === 0) return null;

  return (
    <div style={{
      fontSize: '0.85rem',
      color: '#777',
      marginTop: '0.4rem',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '0.15rem',
      alignItems: 'center',
    }}>
      {links.map((link, li) => (
        <span key={li}>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: link.kind === 'manufacturer' ? '#555' : link.kind === 'used' ? '#a89870' : '#666',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
              fontWeight: link.kind === 'manufacturer' ? 500 : 400,
            }}
          >
            {link.label}
          </a>
          {li < links.length - 1 && (
            <span style={{ margin: '0 0.35rem', color: '#ddd' }}>&middot;</span>
          )}
        </span>
      ))}
    </div>
  );
}
