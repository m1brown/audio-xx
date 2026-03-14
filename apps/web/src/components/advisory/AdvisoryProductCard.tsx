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
 *   4. Purchase action buttons (Buy New / Find Used)
 *   5. Architecture line
 *   6. Sound character bullets
 *   7. Strengths + Weaknesses
 *   8. Verdict / fit note
 *   9. System delta reasoning (if available)
 *  10. Sources / links
 *
 * Purchase buttons:
 *   - "Buy New" → manufacturer or retailer URL
 *   - "Find Used" → HiFiShark search
 *   Both open in new tab.
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

// ── Purchase buttons ──────────────────────────────────

function PurchaseButtons({ opt }: { opt: AdvisoryOption }) {
  const buyNewUrl = getBuyNewUrl(opt);
  const findUsedUrl = opt.usedMarketUrl ?? hifiSharkUrl(opt.brand, opt.name);
  const isDiscontinued = opt.availability === 'discontinued' || opt.availability === 'vintage';

  return (
    <div style={{
      display: 'flex',
      gap: '0.6rem',
      marginTop: '0.75rem',
      marginBottom: '1rem',
    }}>
      {/* Buy New — primary button (hidden for discontinued) */}
      {!isDiscontinued && buyNewUrl && (
        <a
          href={buyNewUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.5rem 1.1rem',
            background: COLORS.text,
            color: COLORS.white,
            borderRadius: '6px',
            fontSize: '0.88rem',
            fontWeight: 500,
            textDecoration: 'none',
            border: 'none',
            cursor: 'pointer',
            letterSpacing: '0.01em',
          }}
        >
          Buy New
        </a>
      )}

      {/* Find Used — secondary outlined button */}
      <a
        href={findUsedUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.5rem 1.1rem',
          background: 'transparent',
          color: COLORS.text,
          borderRadius: '6px',
          fontSize: '0.88rem',
          fontWeight: 500,
          textDecoration: 'none',
          border: `1px solid ${COLORS.border}`,
          cursor: 'pointer',
          letterSpacing: '0.01em',
        }}
      >
        Find Used
      </a>
    </div>
  );
}

// ── Section divider ───────────────────────────────────

function ProductDivider() {
  return <hr style={{ border: 'none', borderTop: `1px solid ${COLORS.border}`, margin: '2.5rem 0' }} />;
}

// ── Sub-heading ───────────────────────────────────────

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 style={{
      margin: '1.1rem 0 0.4rem 0',
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
      lineHeight: 1.7,
      color: color ?? COLORS.text,
    }}>
      {items.map((item, i) => (
        <li key={i} style={{ marginBottom: '0.15rem', fontSize: '0.93rem' }}>
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

  // Parse sound character into bullets if it contains commas or line breaks
  const characterBullets = opt.character
    ? opt.character.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <div>
      {/* ── Product name (numbered) ──────────────────── */}
      <h3 style={{
        margin: '0 0 0.2rem 0',
        fontSize: '1.25rem',
        fontWeight: 600,
        color: COLORS.text,
        letterSpacing: '-0.01em',
        lineHeight: 1.3,
      }}>
        {index + 1}. {fullName}
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

      {/* ── Approx price ─────────────────────────────── */}
      <SubHeading>Approx price</SubHeading>
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

      {/* ── Purchase buttons ─────────────────────────── */}
      <PurchaseButtons opt={opt} />

      {/* ── DAC architecture / product type ──────────── */}
      {opt.productType && (
        <p style={{
          margin: '0 0 0.3rem 0',
          fontSize: '0.93rem',
          lineHeight: 1.7,
          color: COLORS.text,
        }}>
          <strong>Architecture:</strong>{' '}
          <span style={{ color: COLORS.textSecondary }}>{opt.productType}</span>
        </p>
      )}

      {/* ── Sound character ──────────────────────────── */}
      {characterBullets.length > 0 && (
        <>
          <SubHeading>Sound character</SubHeading>
          <Bullets items={characterBullets} color={COLORS.textSecondary} />
        </>
      )}

      {/* ── Fit note (main description / verdict) ────── */}
      {opt.fitNote && (
        <>
          {opt.systemDelta ? (
            // When system delta exists, fitNote is supplementary
            <p style={{
              margin: '0.8rem 0 0.3rem 0',
              color: COLORS.text,
              lineHeight: 1.7,
              fontSize: '0.95rem',
            }}>
              {renderText(opt.fitNote)}
            </p>
          ) : (
            // When no delta, fitNote is the main verdict
            <>
              <SubHeading>Verdict</SubHeading>
              <p style={{
                margin: '0 0 0.3rem 0',
                color: COLORS.text,
                lineHeight: 1.7,
                fontSize: '0.95rem',
              }}>
                {renderText(opt.fitNote)}
              </p>
            </>
          )}
        </>
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

      {/* ── System delta reasoning ───────────────────── */}
      {opt.systemDelta && (
        <div style={{
          marginTop: '0.75rem',
          padding: '0.75rem 0.9rem',
          background: COLORS.accentBg,
          borderRadius: '6px',
          fontSize: '0.9rem',
          lineHeight: 1.65,
        }}>
          {opt.systemDelta.whyFitsSystem && (
            <p style={{ margin: '0 0 0.35rem 0', color: COLORS.textSecondary }}>
              {renderText(opt.systemDelta.whyFitsSystem)}
            </p>
          )}
          {opt.systemDelta.likelyImprovements && opt.systemDelta.likelyImprovements.length > 0 && (
            <div style={{ margin: '0 0 0.25rem 0', color: COLORS.textSecondary }}>
              <span style={{ fontWeight: 500, color: COLORS.green }}>Likely improvements: </span>
              {opt.systemDelta.likelyImprovements.join(' · ')}
            </div>
          )}
          {opt.systemDelta.tradeOffs && opt.systemDelta.tradeOffs.length > 0 && (
            <div style={{ color: COLORS.textMuted }}>
              <span style={{ fontWeight: 500 }}>Trade-offs: </span>
              {opt.systemDelta.tradeOffs.join(' · ')}
            </div>
          )}
        </div>
      )}

      {/* ── Source links (manufacturer + retailers) ──── */}
      <SourceLinks opt={opt} />
    </div>
  );
}

// ── Source links (compact, below each product) ────────

function SourceLinks({ opt }: { opt: AdvisoryOption }) {
  const links: Array<{ label: string; url: string }> = [];

  if (opt.manufacturerUrl) {
    links.push({ label: opt.brand ?? 'Official site', url: opt.manufacturerUrl });
  }
  if (opt.links) {
    for (const link of opt.links) {
      if (link.url === opt.manufacturerUrl) continue;
      links.push({ label: link.label, url: link.url });
    }
  }

  // Used market sources
  if (opt.usedMarketSources && opt.usedMarketSources.length > 0) {
    for (const src of opt.usedMarketSources) {
      links.push({ label: src.name, url: src.url });
    }
  }

  if (links.length === 0) return null;

  return (
    <div style={{
      marginTop: '0.75rem',
      fontSize: '0.85rem',
      color: COLORS.textMuted,
    }}>
      {links.map((link, i) => (
        <span key={i}>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: COLORS.textSecondary,
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
            }}
          >
            {link.label}
          </a>
          {i < links.length - 1 && (
            <span style={{ margin: '0 0.35rem', color: '#ddd' }}>&middot;</span>
          )}
        </span>
      ))}
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
