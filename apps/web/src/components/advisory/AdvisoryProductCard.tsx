/**
 * Audio XX — Editorial Product Card
 *
 * Redesigned to match editorial recommendation pages (à la ChatGPT gold standard).
 * Each product renders as a full-width editorial section rather than a compact card.
 *
 * Concise structure per product:
 *   1. Numbered product name
 *   2. Compact price line (new · used)
 *   3. 2–3 trait bullets (merged from standoutFeatures + soundProfile)
 *   4. Fit note / "best for" line
 *   5. Subtle links (manufacturer · buy)
 */

import type { AdvisoryOption } from '../../lib/advisory-response';
import { renderText } from './render-text';

// ── Design tokens ─────────────────────────────────────

const COLORS = {
  text: '#2a2a2a',
  textSecondary: '#5a5a5a',
  textMuted: '#8a8a8a',
  accent: '#a89870',
  accentBg: '#faf8f3',
  border: '#eeece8',
  green: '#5a7050',
  white: '#fff',
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$', CHF: 'CHF ',
};

function formatPrice(amount: number, currency?: string): string {
  const code = currency ?? 'USD';
  const symbol = CURRENCY_SYMBOLS[code] ?? `${code} `;
  return `${symbol}${amount.toLocaleString()}`;
}

// ── Helper: build marketplace URLs ───────────────────

function hifiSharkUrl(brand: string | undefined, name: string): string {
  const query = [brand, name].filter(Boolean).join(' ');
  return `https://www.hifishark.com/search?q=${encodeURIComponent(query)}`;
}

function ebayUrl(brand: string | undefined, name: string): string {
  const query = [brand, name].filter(Boolean).join(' ');
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&_sacat=293&LH_All=1`;
}

const AVAILABILITY_LABELS: Record<string, { text: string; color: string; bg: string; border: string }> = {
  discontinued: { text: 'Discontinued — used only', color: '#8a6a40', bg: '#faf4ea', border: '#e8dcc8' },
  vintage: { text: 'Vintage — used only', color: '#6a5a35', bg: '#f5f0e2', border: '#e0d8c0' },
};

// ── Subtle product links (manufacturer · find new · find used) ──

const LINK_STYLE: React.CSSProperties = {
  color: COLORS.textMuted,
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
  textDecorationColor: '#ddd',
  fontSize: '0.82rem',
};

const LINK_SEP_STYLE: React.CSSProperties = {
  margin: '0 0.4rem',
  color: '#ddd',
};

function ProductLinks({ opt }: { opt: AdvisoryOption }) {
  const isDiscontinued = opt.availability === 'discontinued' || opt.availability === 'vintage';

  const links: Array<{ label: string; url: string }> = [];

  // Current products: manufacturer/retail link first
  if (!isDiscontinued && opt.manufacturerUrl) {
    links.push({ label: opt.brand ?? 'Manufacturer', url: opt.manufacturerUrl });
  }

  // HiFiShark — primary used-market link (always shown)
  const hifiShark = opt.usedMarketUrl ?? hifiSharkUrl(opt.brand, opt.name);
  links.push({ label: isDiscontinued ? 'Find used' : 'HiFiShark', url: hifiShark });

  // eBay — secondary marketplace link
  links.push({ label: 'eBay', url: ebayUrl(opt.brand, opt.name) });

  return (
    <div style={{ marginTop: '0.6rem', lineHeight: 1.8 }}>
      {links.map((link, i) => (
        <span key={i}>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            style={LINK_STYLE}
          >
            {link.label}
          </a>
          {i < links.length - 1 && (
            <span style={LINK_SEP_STYLE}>&middot;</span>
          )}
        </span>
      ))}
    </div>
  );
}

// ── Section divider ───────────────────────────────────

function ProductDivider() {
  return <hr style={{ border: 'none', borderTop: `1px solid ${COLORS.border}`, margin: '2.25rem 0' }} />;
}


// ── Single editorial product section ──────────────────

function EditorialProductSection({ opt, index }: { opt: AdvisoryOption; index: number }) {
  const fullName = [opt.brand, opt.name].filter(Boolean).join(' ');
  const availBadge = opt.availability ? AVAILABILITY_LABELS[opt.availability] : undefined;
  const isDiscontinued = opt.availability === 'discontinued' || opt.availability === 'vintage';

  // Merge standoutFeatures + soundProfile, take up to 3 traits
  const traits: string[] = [
    ...(opt.standoutFeatures ?? []),
    ...(opt.soundProfile ?? []),
  ].slice(0, 3);

  // Build compact price string
  const priceParts: string[] = [];
  if (!isDiscontinued && opt.price != null && opt.price > 0) {
    priceParts.push(`~${formatPrice(opt.price, opt.priceCurrency)}`);
  }
  if (opt.usedPriceRange) {
    priceParts.push(`used ${formatPrice(opt.usedPriceRange.low, opt.priceCurrency)}–${formatPrice(opt.usedPriceRange.high, opt.priceCurrency)}`);
  } else if (isDiscontinued) {
    priceParts.push('used market only');
  }

  return (
    <div>
      {/* ── Product name (numbered) + price ────────── */}
      <h3 style={{
        margin: '0 0 0.15rem 0',
        fontSize: '1.3rem',
        fontWeight: 700,
        color: COLORS.text,
        letterSpacing: '-0.02em',
        lineHeight: 1.3,
      }}>
        {index + 1}. {fullName}
        {opt.isCurrentComponent && (
          <span
            style={{
              marginLeft: '0.6rem',
              fontSize: '0.72rem',
              fontWeight: 600,
              letterSpacing: '0.02em',
              padding: '0.15rem 0.55rem',
              borderRadius: '4px',
              color: '#5a7a3a',
              background: '#f0f5e8',
              border: '1px solid #c5d8a8',
              verticalAlign: 'middle',
            }}
          >
            CURRENT
          </span>
        )}
        {availBadge && (
          <span
            style={{
              marginLeft: '0.6rem',
              fontSize: '0.72rem',
              fontWeight: 600,
              letterSpacing: '0.02em',
              padding: '0.15rem 0.55rem',
              borderRadius: '4px',
              color: availBadge.color,
              background: availBadge.bg,
              border: `1px solid ${availBadge.border}`,
              verticalAlign: 'middle',
            }}
          >
            {availBadge.text}
          </span>
        )}
      </h3>

      {/* ── Compact price line ──────────────────────── */}
      {priceParts.length > 0 && (
        <div style={{
          fontSize: '0.88rem',
          color: COLORS.textMuted,
          marginBottom: '0.5rem',
          lineHeight: 1.5,
        }}>
          {priceParts.join(' · ')}
        </div>
      )}

      {/* ── 2–3 trait bullets ──────────────────────── */}
      {traits.length > 0 && (
        <ul style={{
          margin: '0 0 0.6rem 0',
          paddingLeft: '1.2rem',
          lineHeight: 1.8,
          color: COLORS.text,
        }}>
          {traits.map((trait, i) => (
            <li key={i} style={{ marginBottom: '0.35rem', fontSize: '0.95rem' }}>
              {renderText(trait)}
            </li>
          ))}
        </ul>
      )}

      {/* ── Best for / fit note ────────────────────── */}
      {opt.fitNote && (
        <p style={{
          margin: '0 0 0.4rem 0',
          fontSize: '0.95rem',
          lineHeight: 1.7,
          color: COLORS.textSecondary,
        }}>
          {renderText(opt.fitNote)}
        </p>
      )}

      {/* ── Subtle links (manufacturer · buy) ──────── */}
      <ProductLinks opt={opt} />
    </div>
  );
}

// ── Main export: editorial product list ───────────────

interface AdvisoryProductCardProps {
  options: AdvisoryOption[];
}

export default function AdvisoryProductCards({ options }: AdvisoryProductCardProps) {
  return (
    <div>
      {options.map((opt, i) => (
        <div key={i}>
          {i > 0 && <ProductDivider />}
          <EditorialProductSection opt={opt} index={i} />
        </div>
      ))}
    </div>
  );
}

// ── Standalone shopping links for non-card contexts ───
//
// Used by AssessmentFormat, StandardFormat, and any context
// where a product is discussed but not rendered as a full card.

interface StandaloneShoppingLinksProps {
  brand?: string;
  name: string;
  manufacturerUrl?: string;
  availability?: 'current' | 'discontinued' | 'vintage';
}

export function ShoppingLinks({ brand, name, manufacturerUrl, availability }: StandaloneShoppingLinksProps) {
  const isDiscontinued = availability === 'discontinued' || availability === 'vintage';

  const links: Array<{ label: string; url: string }> = [];

  if (!isDiscontinued && manufacturerUrl) {
    links.push({ label: brand ?? 'Manufacturer', url: manufacturerUrl });
  }

  links.push({ label: 'HiFiShark', url: hifiSharkUrl(brand, name) });
  links.push({ label: 'eBay', url: ebayUrl(brand, name) });

  return (
    <div style={{ marginTop: '0.6rem', lineHeight: 1.8 }}>
      {links.map((link, i) => (
        <span key={i}>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            style={LINK_STYLE}
          >
            {link.label}
          </a>
          {i < links.length - 1 && (
            <span style={LINK_SEP_STYLE}>&middot;</span>
          )}
        </span>
      ))}
    </div>
  );
}
