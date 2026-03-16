/**
 * Audio XX — Editorial Product Card
 *
 * Redesigned to match editorial recommendation pages (à la ChatGPT gold standard).
 * Each product renders as a full-width editorial section rather than a compact card.
 *
 * Structure per product:
 *   1. Numbered product name (H2-level)
 *   2. Image gallery (3-up horizontal row)
 *   3. Approx price (new + used)
 *   4. Subtle links (manufacturer · buy)
 *   5. Architecture line
 *   6. Sound character bullets
 *   7. Verdict / fit note
 *   8. System delta reasoning (if available)
 *
 * Links (subtle text, not buttons):
 *   - Manufacturer → brand site
 *   - Buy → HiFiShark search (new + used listings)
 *   All open in new tab.
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

// ── Helper: build HiFiShark URL ───────────────────────

function hifiSharkUrl(brand: string | undefined, name: string): string {
  const query = [brand, name].filter(Boolean).join(' ');
  return `https://www.hifishark.com/search?q=${encodeURIComponent(query)}`;
}

// ── Helper: get buy-new URL ───────────────────────────

function getBuyNewUrl(opt: AdvisoryOption): string | undefined {
  // Prefer manufacturer URL, fall back to first retailer link
  if (opt.manufacturerUrl) return opt.manufacturerUrl;
  if (opt.links && opt.links.length > 0) return opt.links[0].url;
  return undefined;
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
  const searchUrl = opt.usedMarketUrl ?? hifiSharkUrl(opt.brand, opt.name);

  const links: Array<{ label: string; url: string }> = [];

  // Manufacturer site
  if (opt.manufacturerUrl) {
    links.push({ label: opt.brand ?? 'Manufacturer', url: opt.manufacturerUrl });
  }

  // Buy — HiFiShark search showing new + used listings
  links.push({ label: 'Buy', url: searchUrl });

  if (links.length === 0) return null;

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
  return <hr style={{ border: 'none', borderTop: `1px solid ${COLORS.border}`, margin: '3rem 0' }} />;
}

// ── Sub-heading ───────────────────────────────────────

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 style={{
      margin: '1.25rem 0 0.45rem 0',
      fontSize: '0.95rem',
      fontWeight: 600,
      color: COLORS.text,
      letterSpacing: '0',
    }}>
      {children}
    </h4>
  );
}

// ── Bullet list ───────────────────────────────────────

function Bullets({ items, color }: { items: string[]; color?: string }) {
  return (
    <ul style={{
      margin: 0,
      paddingLeft: '1.2rem',
      lineHeight: 1.75,
      color: color ?? COLORS.text,
    }}>
      {items.map((item, i) => (
        <li key={i} style={{ marginBottom: '0.35rem', fontSize: '0.93rem' }}>
          {renderText(item)}
        </li>
      ))}
    </ul>
  );
}

// ── Single editorial product section ──────────────────

function EditorialProductSection({ opt, index }: { opt: AdvisoryOption; index: number }) {
  const fullName = [opt.brand, opt.name].filter(Boolean).join(' ');
  const availBadge = opt.availability ? AVAILABILITY_LABELS[opt.availability] : undefined;
  const isDiscontinued = opt.availability === 'discontinued' || opt.availability === 'vintage';

  return (
    <div>
      {/* ── Product name (numbered) ──────────────────── */}
      <h3 style={{
        margin: '0 0 0.2rem 0',
        fontSize: '1.35rem',
        fontWeight: 600,
        color: COLORS.text,
        letterSpacing: '-0.015em',
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
            YOUR CURRENT
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

      {/* ── Sonic direction label (subtle) ───────────── */}
      {opt.sonicDirectionLabel && (
        <div style={{
          fontSize: '0.85rem',
          fontStyle: 'italic',
          color: COLORS.accent,
          marginBottom: '0.5rem',
        }}>
          {opt.sonicDirectionLabel}
        </div>
      )}

      {/* ── Typical price ─────────────────────────────── */}
      <SubHeading>Typical price</SubHeading>
      <ul style={{ margin: '0 0 0 0', paddingLeft: '1.2rem', lineHeight: 1.7, fontSize: '0.93rem', color: COLORS.text }}>
        {!isDiscontinued && opt.price != null && opt.price > 0 && (
          <li>New: ~{formatPrice(opt.price, opt.priceCurrency)}</li>
        )}
        {opt.usedPriceRange ? (
          <li>Used: {formatPrice(opt.usedPriceRange.low, opt.priceCurrency)}–{formatPrice(opt.usedPriceRange.high, opt.priceCurrency)}</li>
        ) : isDiscontinued ? (
          <li>Used market only</li>
        ) : null}
      </ul>

      {/* ── Why it stands out ─────────────────────────── */}
      {opt.standoutFeatures && opt.standoutFeatures.length > 0 && (
        <>
          <SubHeading>Why it stands out</SubHeading>
          <Bullets items={opt.standoutFeatures} />
        </>
      )}

      {/* ── Sound profile ─────────────────────────────── */}
      {opt.soundProfile && opt.soundProfile.length > 0 && (
        <>
          <SubHeading>Sound profile</SubHeading>
          <Bullets items={opt.soundProfile} color={COLORS.textSecondary} />
        </>
      )}

      {/* ── With your system ──────────────────────────── */}
      {opt.systemDelta && (
        <>
          <SubHeading>With your system</SubHeading>
          <ul style={{
            margin: 0,
            paddingLeft: '1.2rem',
            lineHeight: 1.7,
            color: COLORS.text,
          }}>
            {opt.systemDelta.whyFitsSystem && (
              <li style={{ marginBottom: '0.15rem', fontSize: '0.93rem' }}>
                {renderText(opt.systemDelta.whyFitsSystem)}
              </li>
            )}
            {opt.systemDelta.likelyImprovements && opt.systemDelta.likelyImprovements.length > 0 && (
              <li style={{ marginBottom: '0.15rem', fontSize: '0.93rem' }}>
                Would likely add <strong>{opt.systemDelta.likelyImprovements.join(', ')}</strong>
              </li>
            )}
            {opt.systemDelta.tradeOffs && opt.systemDelta.tradeOffs.length > 0 && (
              <li style={{ marginBottom: '0.15rem', fontSize: '0.93rem', color: COLORS.textSecondary }}>
                Trade-off: may reduce {opt.systemDelta.tradeOffs.join(', ')}
              </li>
            )}
          </ul>
        </>
      )}

      {/* ── Verdict ───────────────────────────────────── */}
      {opt.fitNote && (
        <p style={{
          margin: '1.1rem 0 0.3rem 0',
          fontSize: '0.95rem',
          lineHeight: 1.75,
          color: COLORS.text,
        }}>
          <strong style={{ fontWeight: 600 }}>Verdict:</strong>{' '}
          {renderText(opt.fitNote)}
        </p>
      )}

      {/* ── Caution ──────────────────────────────────── */}
      {opt.caution && (
        <p style={{
          margin: '0.3rem 0 0.3rem 0',
          color: COLORS.textMuted,
          fontSize: '0.9rem',
          lineHeight: 1.6,
        }}>
          {opt.caution}
        </p>
      )}

      {/* ── Subtle links (manufacturer · buy) ────────── */}
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
