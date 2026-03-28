/**
 * Audio XX — Editorial Product Card (Step 9)
 *
 * Premium recommendation card with clear hierarchy:
 *   1. Role badge (Best Choice / Upgrade Choice / Value Choice)
 *   2. Product name (large, bold) + brand (secondary)
 *   3. Price line + buying context label
 *   4. Product image (when available)
 *   5. Why this fits you
 *   6. Sound character
 *   7. Trade-offs
 *   8. Buying note
 *   9. Links section (buying links + further reading, grouped separately)
 */

import { useEffect } from 'react';
import type { AdvisoryOption } from '../../lib/advisory-response';
import { renderText } from './render-text';
import { trackLinkClick, trackCardView } from '../../lib/interaction-tracker';
import { shouldShowAmazonLink, getAmazonSearchUrl } from '../../lib/amazon-links';

// ── Design tokens ─────────────────────────────────────

const COLORS = {
  text: '#2a2a2a',
  textSecondary: '#5a5a5a',
  textMuted: '#8a8a8a',
  accent: '#a89870',
  accentBg: '#faf8f3',
  border: '#eeece8',
  borderLight: '#f4f2ef',
  green: '#5a7050',
  white: '#fff',
  cardBg: '#ffffff',
  sectionBg: '#fafaf8',
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '\u20ac', GBP: '\u00a3', JPY: '\u00a5', AUD: 'A$', CAD: 'C$', CHF: 'CHF ',
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

// ── Availability labels ──────────────────────────────

const AVAILABILITY_LABELS: Record<string, { text: string; color: string; bg: string; border: string }> = {
  discontinued: { text: 'Discontinued', color: '#8a6a40', bg: '#faf4ea', border: '#e8dcc8' },
  vintage: { text: 'Vintage', color: '#6a5a35', bg: '#f5f0e2', border: '#e0d8c0' },
};

// ── Role label styles ────────────────────────────────

const ROLE_LABELS: Record<string, { text: string; color: string; bg: string; border: string }> = {
  // 4-option model roles
  anchor:    { text: 'What I Would Start With',                 color: '#2d5a2d', bg: '#e8f2e8', border: '#a8d0a8' },
  close_alt: { text: 'If You Want the Same Idea, Slightly Different', color: '#3d5a5a', bg: '#e8f0f0', border: '#a8c8c8' },
  contrast:  { text: 'If You Want a Different Direction',       color: '#3d3d6e', bg: '#e8e9f2', border: '#a8a8d0' },
  wildcard:  { text: 'Worth Hearing (Less Traditional)',        color: '#6e5a2d', bg: '#f2efe8', border: '#d0c4a0' },
  // Legacy roles (backward compatibility)
  top_pick:     { text: 'Best Choice',    color: '#2d5a2d', bg: '#e8f2e8', border: '#a8d0a8' },
  upgrade_pick: { text: 'Upgrade Choice', color: '#3d3d6e', bg: '#e8e9f2', border: '#a8a8d0' },
  value_pick:   { text: 'Value Choice',   color: '#6e5a2d', bg: '#f2efe8', border: '#d0c4a0' },
};

function getRoleFromOption(opt: AdvisoryOption): string | undefined {
  if (opt.pickRole) return opt.pickRole;
  if (opt.isPrimary) return 'top_pick';
  return undefined;
}

// ── Buying context inference ─────────────────────────
// Task 9: Infer a short buying context label from availability + price metadata.

const BUYING_CONTEXT_MAP: Record<string, { label: string; color: string }> = {
  easy_new:      { label: 'Easy to buy new',       color: '#5a7050' },
  better_used:   { label: 'Better used value',     color: '#5a7050' },
  dealer_likely: { label: 'Dealer purchase likely', color: '#5a5a8a' },
  used_only:     { label: 'Used-only opportunity',  color: '#8a6a40' },
};

function resolveBuyingContext(opt: AdvisoryOption): { label: string; color: string } | null {
  // Prefer structured metadata when available (Step 10, Task 3)
  if (opt.buyingContext && BUYING_CONTEXT_MAP[opt.buyingContext]) {
    return BUYING_CONTEXT_MAP[opt.buyingContext];
  }

  // Fallback: infer from availability + price metadata
  const isDiscontinued = opt.availability === 'discontinued' || opt.availability === 'vintage';
  const typicalMarket = opt.typicalMarket;

  if (isDiscontinued || typicalMarket === 'used') {
    return BUYING_CONTEXT_MAP.used_only;
  }
  if (typicalMarket === 'both' || (opt.availability === 'current' && opt.usedPriceRange)) {
    return BUYING_CONTEXT_MAP.better_used;
  }
  if (opt.catalogBrandScale === 'boutique' || opt.catalogBrandScale === 'specialist') {
    return BUYING_CONTEXT_MAP.dealer_likely;
  }
  if (opt.availability === 'current') {
    return BUYING_CONTEXT_MAP.easy_new;
  }
  return null;
}

// ── Link rendering ───────────────────────────────────
// Task 4–5: Separate buying links from further reading, both at card bottom.

const LINK_STYLE: React.CSSProperties = {
  color: COLORS.textMuted,
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
  textDecorationColor: '#ddd',
  fontSize: '0.82rem',
  transition: 'color 0.15s',
};

const LINK_SEP_STYLE: React.CSSProperties = {
  margin: '0 0.45rem',
  color: '#ddd',
};

function TrackedLinkRow({ links, kind, onClick }: {
  links: Array<{ label: string; url: string }>;
  kind: string;
  onClick?: (kind: string, label: string, url: string) => void;
}) {
  return (
    <span style={{ lineHeight: 1.9 }}>
      {links.map((link, i) => (
        <span key={i}>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            style={LINK_STYLE}
            onClick={() => onClick?.(kind, link.label, link.url)}
          >
            {link.label}
          </a>
          {i < links.length - 1 && <span style={LINK_SEP_STYLE}>&middot;</span>}
        </span>
      ))}
    </span>
  );
}

function ProductLinksSection({ opt, onLinkClick }: { opt: AdvisoryOption; onLinkClick?: (kind: string, label: string, url: string) => void }) {
  const isDiscontinued = opt.availability === 'discontinued' || opt.availability === 'vintage';
  const isUsedOnly = isDiscontinued || opt.typicalMarket === 'used';

  // ── New purchase links ──
  const newLinks: Array<{ label: string; url: string }> = [];
  if (!isUsedOnly && opt.manufacturerUrl) {
    newLinks.push({ label: opt.brand ?? 'Manufacturer', url: opt.manufacturerUrl });
  }
  // Add dealer links from structured link metadata
  if (!isUsedOnly && opt.links) {
    for (const l of opt.links) {
      if (l.kind === 'dealer' || l.label.toLowerCase().includes('dealer')) {
        if (!newLinks.some((nl) => nl.url === l.url)) {
          // Strip "Buy new — " prefix if present to avoid duplication
          // with the "Buy new" section label rendered by the parent.
          const cleanLabel = l.label.replace(/^buy\s+new\s*[-—–]\s*/i, '');
          newLinks.push({ label: cleanLabel, url: l.url });
        }
      }
    }
  }

  // ── Amazon (appended to new links when appropriate) ──
  const showAmazon = shouldShowAmazonLink({
    brand: opt.brand,
    availability: opt.availability,
    typicalMarket: opt.typicalMarket,
    buyingContext: opt.buyingContext,
  });
  if (!isUsedOnly && showAmazon) {
    // Prevent duplicate if an existing link already points to Amazon
    const hasAmazon = newLinks.some((nl) => nl.url.includes('amazon.com') || nl.label.toLowerCase() === 'amazon');
    if (!hasAmazon) {
      newLinks.push({ label: 'Amazon', url: getAmazonSearchUrl(opt.name, opt.brand) });
    }
  }

  // ── Used purchase links ──
  const usedLinks: Array<{ label: string; url: string }> = [];
  const hifiShark = opt.usedMarketUrl ?? hifiSharkUrl(opt.brand, opt.name);
  usedLinks.push({ label: 'HiFi Shark', url: hifiShark });
  usedLinks.push({ label: 'eBay', url: ebayUrl(opt.brand, opt.name) });
  // Add any structured used-market sources
  if (opt.usedMarketSources) {
    for (const src of opt.usedMarketSources) {
      if (!usedLinks.some((ul) => ul.url === src.url)) {
        usedLinks.push({ label: src.name, url: src.url });
      }
    }
  }

  // ── Further reading links (reviews, references) ──
  const readingLinks: Array<{ label: string; url: string }> = [];
  if (opt.links) {
    for (const l of opt.links) {
      const lowerLabel = l.label.toLowerCase();
      if (l.kind === 'review' || l.kind === 'reference' || lowerLabel.includes('review') || lowerLabel.includes('reference') || lowerLabel.includes('read')) {
        readingLinks.push({ label: l.label, url: l.url });
      }
    }
  }

  const handleClick = (kind: string, label: string, url: string) => {
    // Distinguish Amazon clicks for tracking granularity
    const resolvedKind = (kind === 'buy_new' && label === 'Amazon') ? 'buy_new_amazon' : kind;
    onLinkClick?.(resolvedKind, label, url);
  };

  const linkLabelStyle: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '0.4rem' };

  return (
    <div style={{
      marginTop: '1rem',
      paddingTop: '0.75rem',
      borderTop: `1px solid ${COLORS.borderLight}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.4rem',
    }}>
      {/* New purchase links */}
      {newLinks.length > 0 && (
        <div>
          <span style={linkLabelStyle}>Buy new</span>
          <TrackedLinkRow links={newLinks} kind="buy_new" onClick={handleClick} />
        </div>
      )}

      {/* Used purchase links */}
      <div>
        <span style={linkLabelStyle}>{isUsedOnly ? 'Find used' : 'Buy used'}</span>
        <TrackedLinkRow links={usedLinks} kind="buy_used" onClick={handleClick} />
      </div>

      {/* Further reading links */}
      {readingLinks.length > 0 && (
        <div>
          <span style={linkLabelStyle}>Further reading</span>
          <TrackedLinkRow links={readingLinks} kind="further_reading" onClick={handleClick} />
        </div>
      )}
    </div>
  );
}

// ── Section divider ───────────────────────────────────

function ProductDivider() {
  return <hr style={{ border: 'none', borderTop: `1px solid ${COLORS.border}`, margin: '2rem 0' }} />;
}

// ── Section label ────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '0.72rem',
      fontWeight: 600,
      color: COLORS.textMuted,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      marginBottom: '0.3rem',
    }}>
      {children}
    </div>
  );
}

// ── Role badge ───────────────────────────────────────

const SECTION_HEADER_ROLES = new Set(['anchor', 'close_alt', 'contrast', 'wildcard']);

function RoleBadge({ role }: { role: string }) {
  const label = ROLE_LABELS[role];
  if (!label) return null;

  // 4-option model: render as a prominent section header
  if (SECTION_HEADER_ROLES.has(role)) {
    return (
      <div style={{
        fontSize: '0.72rem',
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: label.color,
        textTransform: 'uppercase',
        marginBottom: '0.6rem',
        paddingBottom: '0.4rem',
        borderBottom: `1px solid ${label.border}`,
      }}>
        {label.text}
      </div>
    );
  }

  // Legacy roles: small inline badge
  return (
    <span style={{
      display: 'inline-block',
      fontSize: '0.73rem',
      fontWeight: 700,
      letterSpacing: '0.05em',
      padding: '0.25rem 0.7rem',
      borderRadius: '4px',
      color: label.color,
      background: label.bg,
      border: `1px solid ${label.border}`,
      marginBottom: '0.5rem',
      textTransform: 'uppercase',
    }}>
      {label.text}
    </span>
  );
}

// ── Single editorial product section ──────────────────

function EditorialProductSection({ opt }: { opt: AdvisoryOption; index: number }) {
  const fullName = [opt.brand, opt.name].filter(Boolean).join(' ');
  const isDiscontinued = opt.availability === 'discontinued' || opt.availability === 'vintage';
  const role = getRoleFromOption(opt);
  const buyingCtx = resolveBuyingContext(opt);
  const availBadge = opt.availability ? AVAILABILITY_LABELS[opt.availability] : undefined;

  // Step 10, Task 4: Track card view on mount
  useEffect(() => {
    trackCardView({ product: fullName, pickRole: role });
  }, [fullName, role]);

  const handleLinkClick = (kind: string, label: string, url: string) => {
    trackLinkClick({ product: fullName, pickRole: role, linkKind: kind, linkLabel: label, linkUrl: url });
  };

  // Merge standoutFeatures + soundProfile, take up to 3 traits (fallback when no character)
  const traits: string[] = [
    ...(opt.standoutFeatures ?? []),
    ...(opt.soundProfile ?? []),
  ].slice(0, 3);

  // Build compact price string
  const priceParts: string[] = [];
  if (!isDiscontinued && opt.price != null && opt.price > 0) {
    priceParts.push(formatPrice(opt.price, opt.priceCurrency));
  }
  if (opt.usedPriceRange) {
    priceParts.push(`used ${formatPrice(opt.usedPriceRange.low, opt.priceCurrency)}\u2013${formatPrice(opt.usedPriceRange.high, opt.priceCurrency)}`);
  } else if (isDiscontinued) {
    priceParts.push('used market only');
  }

  return (
    <div style={{ padding: '0.25rem 0' }}>

      {/* ── Role badge ── */}
      {role && <RoleBadge role={role} />}

      {/* ── Product header: name + brand + badges ── */}
      <div style={{ marginBottom: '0.4rem' }}>
        {/* Brand (secondary, above name) */}
        {opt.brand && (
          <div style={{
            fontSize: '0.78rem',
            fontWeight: 500,
            color: COLORS.textMuted,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: '0.1rem',
          }}>
            {opt.brand}
          </div>
        )}

        {/* Product name (large, bold) + inline badges */}
        <h3 style={{
          margin: 0,
          fontSize: '1.4rem',
          fontWeight: 700,
          color: COLORS.text,
          letterSpacing: '-0.02em',
          lineHeight: 1.3,
        }}>
          {opt.name}
          {opt.isCurrentComponent && (
            <span style={{
              marginLeft: '0.6rem',
              fontSize: '0.7rem',
              fontWeight: 600,
              letterSpacing: '0.02em',
              padding: '0.15rem 0.5rem',
              borderRadius: '4px',
              color: '#5a7a3a',
              background: '#f0f5e8',
              border: '1px solid #c5d8a8',
              verticalAlign: 'middle',
            }}>
              CURRENT
            </span>
          )}
          {availBadge && (
            <span style={{
              marginLeft: '0.6rem',
              fontSize: '0.7rem',
              fontWeight: 600,
              letterSpacing: '0.02em',
              padding: '0.15rem 0.5rem',
              borderRadius: '4px',
              color: availBadge.color,
              background: availBadge.bg,
              border: `1px solid ${availBadge.border}`,
              verticalAlign: 'middle',
            }}>
              {availBadge.text}
            </span>
          )}
        </h3>
      </div>

      {/* ── Price line + buying context ── */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '0.75rem',
        marginBottom: '1rem',
        flexWrap: 'wrap',
      }}>
        {priceParts.length > 0 && (
          <span style={{
            fontSize: '1.05rem',
            fontWeight: 600,
            color: COLORS.text,
            letterSpacing: '-0.01em',
          }}>
            {priceParts[0]}
          </span>
        )}
        {priceParts.length > 1 && (
          <span style={{
            fontSize: '0.85rem',
            color: COLORS.textMuted,
          }}>
            {priceParts.slice(1).join(' \u00b7 ')}
          </span>
        )}
        {/* Task 9: Buying context label */}
        {buyingCtx && (
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 600,
            color: buyingCtx.color,
            background: `${buyingCtx.color}10`,
            padding: '0.15rem 0.5rem',
            borderRadius: '3px',
            letterSpacing: '0.02em',
          }}>
            {buyingCtx.label}
          </span>
        )}
      </div>

      {/* ── Task 6: Product image ── */}
      {opt.imageUrl && (
        <div style={{
          marginBottom: '1rem',
          borderRadius: '6px',
          overflow: 'hidden',
          maxWidth: '280px',
        }}>
          <img
            src={opt.imageUrl}
            alt={[opt.brand, opt.name].filter(Boolean).join(' ')}
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
            }}
          />
        </div>
      )}

      {/* ── Content sections (standardized order per Task 2) ── */}

      {/* 1. Why this fits you */}
      {opt.fitNote && (
        <div style={{ marginBottom: '1rem' }}>
          <SectionLabel>Why this fits you</SectionLabel>
          <p style={{
            margin: 0,
            fontSize: '0.95rem',
            lineHeight: 1.75,
            color: COLORS.text,
          }}>
            {renderText(opt.fitNote)}
          </p>
        </div>
      )}

      {/* 2. Sound character */}
      {opt.character && (
        <div style={{ marginBottom: '1rem' }}>
          <SectionLabel>Sound character</SectionLabel>
          <p style={{
            margin: 0,
            fontSize: '0.93rem',
            lineHeight: 1.75,
            color: COLORS.textSecondary,
            fontStyle: 'italic',
          }}>
            {renderText(opt.character)}
          </p>
        </div>
      )}

      {/* 2b. Trait bullets (fallback when no character text) */}
      {!opt.character && traits.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <SectionLabel>Key traits</SectionLabel>
          <ul style={{
            margin: 0,
            paddingLeft: '1.2rem',
            lineHeight: 1.8,
            color: COLORS.text,
          }}>
            {traits.map((trait, i) => (
              <li key={i} style={{ marginBottom: '0.2rem', fontSize: '0.93rem' }}>
                {renderText(trait)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 3. Trade-offs */}
      {opt.caution && (
        <div style={{ marginBottom: '1rem' }}>
          <SectionLabel>Trade-offs</SectionLabel>
          <p style={{
            margin: 0,
            fontSize: '0.90rem',
            lineHeight: 1.75,
            color: COLORS.textSecondary,
          }}>
            {renderText(opt.caution)}
          </p>
        </div>
      )}

      {/* 4. Buying note */}
      {opt.buyingNote && (
        <div style={{ marginBottom: '0.75rem' }}>
          <SectionLabel>Buying note</SectionLabel>
          <p style={{
            margin: 0,
            fontSize: '0.88rem',
            lineHeight: 1.7,
            color: COLORS.textSecondary,
          }}>
            {renderText(opt.buyingNote)}
          </p>
        </div>
      )}

      {/* 5. All links at card bottom (Task 4–5) */}
      <ProductLinksSection opt={opt} onLinkClick={handleLinkClick} />
    </div>
  );
}

// ── Main export: editorial product list ───────────────

interface AdvisoryProductCardProps {
  options: AdvisoryOption[];
}

// Role sort order: anchor first → close_alt → contrast → wildcard → legacy roles → untagged
const ROLE_SORT_ORDER: Record<string, number> = {
  anchor: 0, close_alt: 1, contrast: 2, wildcard: 3,
  top_pick: 0, upgrade_pick: 1, value_pick: 2,
};

export default function AdvisoryProductCards({ options }: AdvisoryProductCardProps) {
  // Sort by role: Best Choice -> Upgrade Choice -> Value Choice -> untagged
  const sorted = [...options].sort((a, b) => {
    const roleA = getRoleFromOption(a) ?? '';
    const roleB = getRoleFromOption(b) ?? '';
    return (ROLE_SORT_ORDER[roleA] ?? 9) - (ROLE_SORT_ORDER[roleB] ?? 9);
  });

  return (
    <div>
      {sorted.map((opt, i) => (
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
          <a href={link.url} target="_blank" rel="noopener noreferrer" style={LINK_STYLE}>
            {link.label}
          </a>
          {i < links.length - 1 && <span style={LINK_SEP_STYLE}>&middot;</span>}
        </span>
      ))}
    </div>
  );
}
