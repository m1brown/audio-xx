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

import Link from 'next/link';
import type { AdvisoryOption } from '../../lib/advisory-response';
import { renderText } from './render-text';
// Card-view and link-click telemetry live in a 'use client' sidecar so
// this file stays server-renderable (the brand page imports it from a
// server component).
import { CardViewTracker, TrackedAnchor } from './CardTelemetry';
import { shouldShowAmazonLink, getAmazonSearchUrl } from '../../lib/amazon-links';
import { buildProductLinks } from '../../lib/product-links';
import { findBrandProfileByName } from '../../lib/consultation';
import { toSlug } from '../../lib/route-slug';

// ── Brand philosophy accessor ─────────────────────────
// Pass 10: composeWhyThisMaker replaces the old getBrandPhilosophy.
// It pulls ONE sentence from the brand's authored philosophy and — when
// systemDelta carries a directional gain — appends a short connector that
// ties the maker's design philosophy to THIS system's need. The philosophy
// extraction is deterministic and consistent per brand, so the same maker
// reads the same way across every card it appears on.

// Voicing / sound-direction keywords — preferred when extracting a
// philosophy sentence so the maker line reads as a sound claim, not a
// mechanical engineering note. "prioritises", "emphasises", "voiced",
// "leans" almost always land on the sound-direction sentence in our
// authored profiles.
const VOICING_RE = /(priorit|emphasi|voic(?:ed|ing)|leans?|tuned)/i;
// Secondary design-intent keywords — only used when no voicing sentence
// exists. "designed around", "focuses on" can land on a mechanical
// sentence, which reads as documentation rather than review.
const DESIGN_INTENT_RE = /(design(?:ed|s)?\s+around|focus(?:es|ed)?\s+on|centre[sd]?\s+on|center[sd]?\s+on)/i;

/** Split a string into up to 4 sentences (period / ? / !). */
function splitSentences(s: string): string[] {
  return s.match(/[^.!?]+[.!?]+/g)?.map((x) => x.trim()) ?? [s.trim()];
}

/** Pick the sentence from a brand philosophy that reads as a sound/voice
 *  claim. Prefers voicing keywords; falls back to design-intent; finally
 *  to the first sentence. */
function extractValueSentence(philosophy: string): string {
  const sentences = splitSentences(philosophy);
  const voicing = sentences.find((s) => VOICING_RE.test(s));
  if (voicing) return voicing.trim();
  const designIntent = sentences.find((s) => DESIGN_INTENT_RE.test(s));
  if (designIntent) return designIntent.trim();
  return (sentences[0] ?? philosophy).trim();
}

/** Strip meta-lede prefixes so the sentence reads as a direct reviewer
 *  claim, not a meta description. "The philosophy prioritises X" becomes
 *  "Prioritises X"; the section label already frames this as a maker
 *  statement, so the prefix is redundant. */
function trimPhilosophyLede(s: string): string {
  return s
    .replace(/^The\s+(design|engineering|company|brand|core)\s+philosophy\s+/i, '')
    .replace(/^The\s+philosophy\s+is\s+/i, '')
    .replace(/^The\s+philosophy\s+/i, '')
    .replace(/^Their\s+(design|engineering)?\s*philosophy\s+/i, '')
    .replace(/^The\s+(design|engineering)\s+/i, '')
    .replace(/^The\s+intent\s+is\s+to\s+/i, '')
    .trim();
}

/** Capitalise the first character of a string. */
function capitalizeFirst(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Compose the one-sentence "Why this maker for this call" line.
 *
 *  Copy pass: ONE sentence, sound + direction only, expert-reviewer voice.
 *  We strip the meta-lede ("The philosophy …") so the sentence reads as a
 *  direct claim, and we drop the old "exactly the direction this chain
 *  needs for X" filler tail — the section title ("Why this maker for
 *  this call") already anchors the claim to the recommendation, so the
 *  tail was redundant padding.
 *
 *  Same brand → same sentence across every card it appears on.
 *
 *  Pass 12: still used as the FALLBACK voice when a brand profile has not
 *  yet been migrated to the structured (designPhilosophy / sonicTendency
 *  / typicalTradeoff) summary fields. Migrated brands skip this path and
 *  render the structured 3-line block instead — see composeMakerInsight. */
function composeWhyThisMaker(opt: AdvisoryOption): string | undefined {
  if (!opt.brand) return undefined;
  const profile = findBrandProfileByName(opt.brand);
  if (!profile?.philosophy) return undefined;

  const raw = extractValueSentence(profile.philosophy);
  const trimmed = trimPhilosophyLede(raw).replace(/[.!?\s]+$/, '').trim();
  if (!trimmed) return undefined;

  return `${capitalizeFirst(trimmed)}.`;
}

// ── Maker insight (Pass 12) ───────────────────────────
//
// Replaces the thin "Why this maker for this call" sentence with a structured
// 3-line block: design intent, sonic tendency, typical trade-off. Each line
// is brand-general — constant across every card from this maker. Distinct in
// scope from the system-specific "What you gain / give up" bullets, which
// translate brand character into the user's chain.
//
// When all three structured fields are present on the brand profile, we
// render the structured block. When ANY is missing, we fall back to the
// legacy single-sentence compose so unmigrated brands still produce
// useful output rather than an empty section.

type MakerInsight =
  | {
      kind: 'structured';
      brand: string;
      designPhilosophy: string;
      sonicTendency: string;
      typicalTradeoff: string;
    }
  | { kind: 'legacy'; brand: string; sentence: string }
  | null;

function composeMakerInsight(opt: AdvisoryOption): MakerInsight {
  if (!opt.brand) return null;
  const profile = findBrandProfileByName(opt.brand);
  if (!profile) return null;

  const dp = profile.designPhilosophy?.trim();
  const st = profile.sonicTendency?.trim();
  const tt = profile.typicalTradeoff?.trim();

  if (dp && st && tt) {
    return {
      kind: 'structured',
      brand: opt.brand,
      designPhilosophy: dp,
      sonicTendency: st,
      typicalTradeoff: tt,
    };
  }

  const sentence = composeWhyThisMaker(opt);
  if (sentence) {
    return { kind: 'legacy', brand: opt.brand, sentence };
  }

  return null;
}

// ── Product identity line (Pass 10) ───────────────────
//
// Composes a factual, single-line label directly under the product name —
// e.g. "Discrete R2R DAC", "SET integrated amplifier", "Standmount speaker".
// Presentation-only: derived from catalogTopology + productType, both
// already on AdvisoryOption. When topology is unavailable, falls back to
// productType alone. No new data, no invention.

const TOPOLOGY_PREFIX: Record<string, string> = {
  // DACs
  'r2r':          'Discrete R2R',
  'fpga':         'FPGA',
  'delta-sigma':  'Delta-sigma',
  'multibit':     'Multibit ladder',
  'nos':          'NOS',
  // Amplifiers
  'set':                 'SET tube',
  'push-pull-tube':      'Push-pull tube',
  'hybrid':              'Hybrid tube / solid-state',
  'class-a-solid-state': 'Class A solid-state',
  'class-ab-solid-state':'Solid-state',
  'class-d':             'Class D',
  // Turntables
  'belt-drive':   'Belt-drive',
  'direct-drive': 'Direct-drive',
  // Speakers / headphones
  'bass-reflex':     'Ported',
  'sealed':          'Sealed',
  'horn-loaded':     'Horn-loaded',
  'high-efficiency': 'High-efficiency',
  'open-baffle':     'Open-baffle',
  'planar-magnetic': 'Planar magnetic',
};

/** Lowercase the productType for composition, but keep "DAC" uppercase. */
function productTypeForComposition(productType: string): string {
  // "DAC", "DAC / Preamp", "DAC / Headphone Amp" — keep DAC uppercase.
  if (/\bDAC\b/.test(productType)) {
    return productType.replace(/Integrated Amplifier/, 'integrated amplifier')
                      .replace(/Power Amplifier/, 'power amplifier')
                      .replace(/Preamplifier/, 'preamplifier')
                      .replace(/Headphone Amp/i, 'headphone amp');
  }
  return productType.toLowerCase();
}

function buildIdentityLine(opt: AdvisoryOption): string | undefined {
  const topology = opt.catalogTopology?.toLowerCase();
  const productType = opt.productType;
  if (!productType && !topology) return undefined;

  const prefix = topology ? TOPOLOGY_PREFIX[topology] : undefined;

  if (prefix && productType) {
    return `${prefix} ${productTypeForComposition(productType)}`;
  }
  if (productType) return productType;
  return undefined;
}

// ── Link label normalization (Pass 10, Step 6) ────────
//
// Strips incidental "official" / "(retailer)" / "authorized" decorations
// from catalog link labels so the rendered buy-row stays neutral. We
// cannot verify the authorized-distributor status of every dealer in a
// global catalog, so the safer default is broadly correct rather than
// precisely wrong. The manufacturer URL remains labelled by brand name.

function cleanLinkLabel(label: string): string {
  // "Official website" is a generic placeholder that appears across many
  // brand profiles. Collapse it to a plain "Website" so the chip reads as a
  // neutral pointer rather than a marketing claim. Other decorations —
  // "(retailer)", "… official", "… authorised dealer",
  // "(official distributor)", "(US distributor)", "(parent brand)" — are
  // stripped so only the dealer or maker name remains.
  const cleaned = label
    .replace(/^\s*official\s+website\s*$/i, 'Website')
    .replace(/\s*\(retailer\)\s*$/i, '')
    .replace(/\s*\(official\s+distributor\)\s*$/i, '')
    .replace(/\s*\(distributor\)\s*$/i, '')
    .replace(/\s*\([A-Z]{2,}\s+distributor\)\s*$/i, '')
    .replace(/\s*\(parent\s+brand\)\s*$/i, '')
    .replace(/\s+official\s*$/i, '')
    .replace(/^\s*official\s+/i, '')
    .replace(/\s+authori[sz]ed\s+dealer\s*$/i, '')
    .replace(/\s+authori[sz]ed\s*$/i, '')
    .trim();
  return cleaned.length > 0 ? cleaned : label.trim();
}

// ── Verdict synthesizer ───────────────────────────────
// Pass 8: deterministic, role-aware, conditional verdict line.
// Presentation-only: composes a single sentence from existing option fields.
// No new data, no calls into engine logic.
//
// Templates are intentionally conditional ("best if…", "only choose if…")
// and never present an alternative as equal-weight to the anchor.

/** Role-aware verdict synthesizer.
 *
 *  The verdict's job is DECISION framing — who this card is for — not a
 *  restatement of gain or trade-off, both of which are already printed in
 *  the "What you gain" / "What you give up" bullets directly above.
 *
 *  Critical: upstream gain / trade-off strings are full advisor-voice
 *  phrases ("lifts the dynamic range the chain is currently short on",
 *  "by design, less warmth than flatter, more analytical alternatives").
 *  They read well as bullets but cannot be safely interpolated into a
 *  sentence template like "pick it when X is the bias you want" — the
 *  result is ungrammatical or recursive. So every branch below is STATIC
 *  and role-specific; the role itself carries the differentiation.
 */
function buildVerdict(opt: AdvisoryOption, role: string | undefined): string | null {
  // Anchor / primary — decisive default, no gain restatement.
  if (role === 'anchor' || role === 'top_pick' || opt.isPrimary) {
    return 'The default call for this chain. Pick an alternative below only when a specific trade-off outweighs breadth of fit.';
  }

  // Close alternative — same philosophy, finer bias. The gain bullets
  // above already name what the finer bias delivers; the verdict only
  // needs to frame the decision.
  if (role === 'close_alt') {
    return 'A finer-grained version of the primary direction. Pick it to nudge the bias toward the gains above, not to shift philosophy.';
  }

  // Contrast — fundamentally different direction. The trade-off IS the
  // identity of this option; point the reader at the bullets rather than
  // restating them inline.
  if (role === 'contrast') {
    return "A deliberately different direction. Right only if the trade-offs above are ones you'd actively choose, not merely tolerate.";
  }

  // Wildcard — defined by being off-pattern; static framing is the point.
  if (role === 'wildcard') {
    return 'Outside the obvious answers. Pick only if curiosity outweighs the safer call, and the trade-offs above are ones you can live with.';
  }

  // Legacy upgrade / value picks.
  if (role === 'upgrade_pick') {
    return 'A step-up bet. Only worth it when the budget absorbs the jump and the gains above map to a priority you actually listen for.';
  }
  if (role === 'value_pick') {
    return 'The budget-first answer. Right when the last increments of refinement are not the priority.';
  }

  return null;
}

// ── Design tokens ─────────────────────────────────────
//
// Pass 9: aligned with the page palette in app/page.tsx so the cards share
// the same single accent and contrast hierarchy as the rest of the UI.
// These values mirror page COLOR exactly. Keep in sync — there is no
// shared module yet (intentional, to avoid pulling page-level imports
// into the card layer).

const COLORS = {
  text: '#1F1D1B',          // page COLOR.textPrimary
  textSecondary: '#5C5852', // page COLOR.textSecondary
  textMuted: '#8C877F',     // page COLOR.textMuted
  accent: '#B08D57',        // page COLOR.accent — single accent across UI
  accentBg: '#FBF6EC',      // page COLOR.accentBg — verdict block fill
  border: '#D8D2C5',        // page COLOR.border
  borderLight: '#E8E3D7',   // page COLOR.borderLight
  green: '#4F6645',
  white: '#fff',
  cardBg: '#FFFEFA',        // page COLOR.cardBg — lifts off warm bg
  sectionBg: '#FAF6EC',
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
  // 4-option model roles — generic fallback text only; prefer opt.roleLabel when present.
  anchor:    { text: 'Start here',          color: '#2d5a2d', bg: '#e8f2e8', border: '#a8d0a8' },
  close_alt: { text: 'Close alternative',   color: '#3d5a5a', bg: '#e8f0f0', border: '#a8c8c8' },
  contrast:  { text: 'Different direction', color: '#3d3d6e', bg: '#e8e9f2', border: '#a8a8d0' },
  wildcard:  { text: 'Outside the obvious', color: '#6e5a2d', bg: '#f2efe8', border: '#d0c4a0' },
  // Legacy roles (backward compatibility)
  top_pick:     { text: 'Start here',     color: '#2d5a2d', bg: '#e8f2e8', border: '#a8d0a8' },
  upgrade_pick: { text: 'Upgrade pick',   color: '#3d3d6e', bg: '#e8e9f2', border: '#a8a8d0' },
  value_pick:   { text: 'Value pick',     color: '#6e5a2d', bg: '#f2efe8', border: '#d0c4a0' },
};

// Pass 8: Role qualifier — small uppercase strip rendered ABOVE the dynamic
// role label to make hierarchy explicit. The dynamic roleLabel (e.g. "Best
// for warmth") describes character; the qualifier signals position in the
// recommendation hierarchy (default vs. conditional alternative).
const ROLE_QUALIFIER: Record<string, string> = {
  anchor:       'Primary recommendation',
  top_pick:     'Primary recommendation',
  close_alt:    'Alternative \u2014 only if',
  contrast:     'Different direction \u2014 only if',
  wildcard:     'Outside the obvious',
  upgrade_pick: 'Upgrade pick \u2014 only if',
  value_pick:   'Value pick \u2014 only if',
};

/** Color palette used when opt.roleLabel is set and we want the dynamic text
 *  rendered with role-appropriate styling. */
function roleStyle(role: string): { color: string; bg: string; border: string } {
  return ROLE_LABELS[role] ?? ROLE_LABELS.anchor;
}

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

function TrackedLinkRow({ links, kind, product, role }: {
  links: Array<{ label: string; url: string }>;
  kind: string;
  /** Card-level context used for click-event attribution. */
  product: string;
  role: string | undefined;
}) {
  return (
    <span style={{ lineHeight: 1.9 }}>
      {links.map((link, i) => {
        // Pass 10, Step 6: strip incidental "official" / "(retailer)" /
        // "authorized" decorations so the rendered label is neutral.
        const displayLabel = cleanLinkLabel(link.label);
        // Per-link Amazon-kind resolution — previously computed in
        // ProductLinksSection.handleClick and passed up via the onClick
        // bubble. Now resolved at the call site so TrackedAnchor can be a
        // pure passthrough. Logged kind stays byte-identical.
        const resolvedKind =
          kind === 'buy_new' && link.label === 'Amazon' ? 'buy_new_amazon' : kind;
        return (
          <span key={i}>
            <TrackedAnchor
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={LINK_STYLE}
              product={product}
              role={role}
              kind={resolvedKind}
              label={link.label}
            >
              {displayLabel}
            </TrackedAnchor>
            {i < links.length - 1 && <span style={LINK_SEP_STYLE}>&middot;</span>}
          </span>
        );
      })}
    </span>
  );
}

function ProductLinksSection({ opt, product, role }: {
  opt: AdvisoryOption;
  /** Card-level context threaded down to per-link click tracking. */
  product: string;
  role: string | undefined;
}) {
  // ── Deterministic link builder ──
  // Priority: dealer → amazon (verified ASIN only) → manufacturer → hifishark → ebay
  // See product-links.ts for full priority logic and deduplication.
  //
  // opt.links contains the original retailer_links from the catalog with
  // kind metadata added by the advisory layer. We pass them as both
  // retailerLinks (for URL/label analysis) and advisoryLinks (for kind).
  // manufacturerUrl is retailer_links[0].url — also passed as a fallback.
  const resolved = buildProductLinks({
    name: opt.name,
    brand: opt.brand,
    retailerLinks: opt.links?.map(l => ({ label: l.label, url: l.url })),
    advisoryLinks: opt.links,
    availability: opt.availability,
    typicalMarket: opt.typicalMarket,
    buyingContext: opt.buyingContext,
    usedMarketUrl: opt.usedMarketUrl,
    usedMarketSources: opt.usedMarketSources,
    manufacturerUrl: opt.manufacturerUrl,
  });

  const { newLinks, usedLinks, readingLinks, isUsedOnly } = resolved;

  // Amazon-kind resolution now happens inside TrackedLinkRow (per-link)
  // since the onClick bubble was removed to make this subtree server-safe.
  // Event shape is unchanged.

  const linkLabelStyle: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '0.4rem' };

  return (
    <div style={{
      marginTop: '1.15rem',
      paddingTop: '0.85rem',
      borderTop: `1px solid ${COLORS.borderLight}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    }}>
      {/* Buy new — action-oriented links */}
      {newLinks.length > 0 && (
        <div>
          <div style={linkLabelStyle}>Buy new</div>
          <span style={{ lineHeight: 1.9 }}>
            {newLinks.map((link, i) => {
              const displayLabel = cleanLinkLabel(link.label);
              return (
                <span key={i}>
                  <TrackedAnchor
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={LINK_STYLE}
                    product={product}
                    role={role}
                    kind={link.label === 'Amazon' ? 'buy_new_amazon' : 'buy_new'}
                    label={link.label}
                  >
                    Buy new &rarr; {displayLabel}
                  </TrackedAnchor>
                  {i < newLinks.length - 1 && <span style={LINK_SEP_STYLE}>&middot;</span>}
                </span>
              );
            })}
          </span>
        </div>
      )}

      {/* Buy used — action-oriented links */}
      <div>
        <div style={linkLabelStyle}>Buy used</div>
        <span style={{ lineHeight: 1.9 }}>
          {usedLinks.map((link, i) => {
            const isHiFiShark = link.label.toLowerCase().includes('hifi shark') || link.label.toLowerCase().includes('hifishark');
            const prefix = isHiFiShark ? 'Browse used' : 'Search used';
            return (
              <span key={i}>
                <TrackedAnchor
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={LINK_STYLE}
                  product={product}
                  role={role}
                  kind="buy_used"
                  label={link.label}
                >
                  {prefix} &rarr; {link.label}
                </TrackedAnchor>
                {i < usedLinks.length - 1 && <span style={LINK_SEP_STYLE}>&middot;</span>}
              </span>
            );
          })}
        </span>
        {/* Typical used price — only from catalog data, never estimated */}
        {opt.usedPriceRange && (
          <div style={{ fontSize: '0.78rem', color: COLORS.textMuted, marginTop: '0.15rem' }}>
            Typical used: ${opt.usedPriceRange.low.toLocaleString()}&ndash;${opt.usedPriceRange.high.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section label ────────────────────────────────────
// Pass 9: ProductDivider removed — cards are now self-contained surfaces
// separated by gap-spacing in the parent flex column, so an inter-card
// rule would be visual noise.

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

function RoleBadge({ role, dynamicLabel }: { role: string; dynamicLabel?: string }) {
  const staticLabel = ROLE_LABELS[role];
  const style = dynamicLabel ? roleStyle(role) : staticLabel;
  const text = dynamicLabel ?? staticLabel?.text;
  if (!text || !style) return null;

  // 4-option model: render as a prominent section header.
  // Pass 8: two-line structure makes hierarchy explicit —
  //   line 1: role qualifier (Primary recommendation / Alternative — only if / …)
  //   line 2: dynamic descriptor (Best for warmth / Best overall / …)
  // Pass 9: anchor qualifier rendered in the shared ACCENT (#B08D57)
  // rather than role-green so PRIMARY RECOMMENDATION reads as the
  // single dominant signal in the card stack.
  if (SECTION_HEADER_ROLES.has(role)) {
    const qualifier = ROLE_QUALIFIER[role];
    const showQualifier = qualifier && qualifier.toLowerCase() !== text.toLowerCase();
    const isAnchor = role === 'anchor';
    const qualifierColor = isAnchor ? COLORS.accent : style.color;
    return (
      <div style={{
        marginBottom: '0.7rem',
        paddingBottom: '0.5rem',
        borderBottom: `1px solid ${isAnchor ? COLORS.borderLight : style.border}`,
      }}>
        {showQualifier && (
          <div style={{
            fontSize: isAnchor ? '0.74rem' : '0.66rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: qualifierColor,
            textTransform: 'uppercase',
            marginBottom: '0.2rem',
          }}>
            {qualifier}
          </div>
        )}
        <div style={{
          fontSize: '0.78rem',
          fontWeight: 700,
          letterSpacing: '0.06em',
          color: style.color,
          textTransform: 'uppercase',
          opacity: isAnchor ? 0.75 : 1,
        }}>
          {text}
        </div>
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
      color: style.color,
      background: style.bg,
      border: `1px solid ${style.border}`,
      marginBottom: '0.5rem',
      textTransform: 'uppercase',
    }}>
      {text}
    </span>
  );
}

// ── Single editorial product section ──────────────────

function EditorialProductSection({ opt, hideMakerInsight }: { opt: AdvisoryOption; index: number; hideMakerInsight?: boolean }) {
  const fullName = [opt.brand, opt.name].filter(Boolean).join(' ');
  const isDiscontinued = opt.availability === 'discontinued' || opt.availability === 'vintage';
  const role = getRoleFromOption(opt);
  const availBadge = opt.availability ? AVAILABILITY_LABELS[opt.availability] : undefined;
  // Card context — always show image when available (no dedup).
  const shouldShowImage = !!opt.imageUrl;

  // Step 10, Task 4: card-view and link-click events now fire from
  // <CardViewTracker /> and <TrackedAnchor /> — both 'use client' wrappers
  // in ./CardTelemetry — so the rest of this component tree can SSR.

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

  // Pass 9: anchor / primary card carries a slightly stronger visual
  // signature — accent top stripe + warmer shadow — so the PRIMARY
  // RECOMMENDATION reads as visually dominant in a stack of cards.
  const isAnchor = role === 'anchor' || role === 'top_pick' || opt.isPrimary;

  return (
    <div style={{
      background: COLORS.cardBg,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 8,
      borderTop: isAnchor ? `3px solid ${COLORS.accent}` : `1px solid ${COLORS.border}`,
      padding: isAnchor ? '1.65rem 1.85rem 1.65rem' : '1.6rem 1.85rem',
      boxShadow: isAnchor
        ? '0 2px 6px rgba(176,141,87,0.08), 0 1px 2px rgba(31,29,27,0.04)'
        : '0 1px 2px rgba(31,29,27,0.03)',
    }}>

      {/* ── Card-view beacon (renders nothing, fires one event on mount). ── */}
      <CardViewTracker product={fullName} role={role} />

      {/* ── Role badge ── */}
      {role && <RoleBadge role={role} dynamicLabel={opt.roleLabel} />}

      {/* ── Product header: name + brand + badges ── */}
      <div style={{ marginBottom: '0.4rem' }}>
        {/* Brand (secondary, above name)
          *
          * Pass 13 (interaction depth): the brand label is now a link to the
          * brand-level view (`/brand/[slug]`). Visual styling is unchanged
          * — the wrapping <Link> is `display: inline-block` and inherits
          * color so the bubble looks identical at rest. Hover cue is a
          * subtle underline only; no color shift, no background, no
          * layout change. */}
        {opt.brand && (
          <Link
            href={`/brand/${toSlug(opt.brand)}`}
            className="audioxx-brand-bubble"
            style={{
              display: 'inline-block',
              fontSize: '0.78rem',
              fontWeight: 500,
              color: COLORS.textMuted,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: '0.1rem',
              textDecoration: 'none',
            }}
          >
            {opt.brand}
          </Link>
        )}

        {/* Product name (large, bold) + inline badges
          *
          * Product-name link is deferred until `/product/[brand]/[name]`
          * has a real detail view (currently placeholder). Name stays
          * styled strongly but not clickable. */}
        <h3 style={{
          margin: 0,
          // Pass 9: bumped product-name size for stronger card hierarchy
          // now that cards have real surface and width.
          fontSize: '1.55rem',
          fontWeight: 700,
          color: COLORS.text,
          letterSpacing: '-0.025em',
          lineHeight: 1.25,
        }}>
          <span
            className="audioxx-product-name"
          >
            {opt.name}
          </span>
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

        {/* Pass 10: factual product-identity line directly under the
          * product name. Adds density + authority without adding content
          * — gives the card a clear object identity ("Discrete R2R DAC",
          * "SET integrated amplifier") so it reads complete even without
          * an image. One line only, factual, not marketing. */}
        {(() => {
          const identity = buildIdentityLine(opt);
          if (!identity) return null;
          return (
            <div style={{
              marginTop: '0.3rem',
              fontSize: '0.86rem',
              fontWeight: 500,
              color: COLORS.textSecondary,
              letterSpacing: '0.005em',
            }}>
              {identity}
            </div>
          );
        })()}

        {/* Legacy note — successor context for discontinued/vintage models */}
        {opt.legacyNote && (
          <div style={{
            marginTop: '0.35rem',
            fontSize: '0.78rem',
            color: '#b08030',
            fontStyle: 'italic',
            lineHeight: 1.5,
          }}>
            {opt.legacyNote}
            {opt.legacyUsedNote && (
              <span style={{ color: COLORS.textMuted, fontStyle: 'normal' }}>
                {' · '}{opt.legacyUsedNote}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Price line ── */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '0.75rem',
        marginBottom: '1.1rem',
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
      </div>

      {/* ── Product image (hero presentation) ──
       * Full-width hero image block — the product is the visual anchor.
       * "If the image does not materially improve decision confidence,
       * it is too small." Large, clean, generous padding so the product
       * breathes. No border; clean white background. 4:3 aspect ratio
       * with contain ensures no cropping while maintaining visual
       * consistency across product shapes (tall speakers, rack DACs,
       * square components). Silent collapse on missing/broken URLs. */}
      {shouldShowImage && opt.imageUrl && (
        <div style={{
          marginBottom: '1.25rem',
          borderRadius: '8px',
          overflow: 'hidden',
          width: '100%',
          maxHeight: '420px',
          minHeight: '240px',
          aspectRatio: '4 / 3',
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          boxSizing: 'border-box',
        }}>
          <img
            src={opt.imageUrl}
            alt={[opt.brand, opt.name].filter(Boolean).join(' ')}
            loading="eager"
            referrerPolicy="no-referrer"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
            onError={(e) => {
              // Broken URL → hide the wrapper cleanly; no broken-icon artifact.
              const wrap = (e.currentTarget as HTMLImageElement).parentElement;
              if (wrap) wrap.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* ── Content sections (Pass 5 redesign) ──
       * Structure: WHAT THIS CHANGES / WHY THIS DIRECTION / WHAT YOU GAIN /
       * WHAT YOU GIVE UP / BUY LINKS. Each section is intentionally short;
       * copy comes from systemDelta when populated, with conservative
       * fallbacks. No "Sound character", no "Why this fits you", no long
       * paragraphs, no trait dumping. */}
      {(() => {
        // Resolve sources once so fallback logic is explicit.
        //
        // "What this changes in your system" — must describe the shift in
        // THIS system, from system context. Each section must carry distinct
        // information, so this section must NOT mirror "What you gain"
        // bullet 1. Resolution order:
        //   1. prefer systemDelta.whyFitsSystem (already system-framed,
        //      structurally distinct from the gain list)
        //   2. else use fitNote ONLY if it opens with "In your chain"
        //      (a system-framed note, not a generic product description)
        //   3. else omit the section entirely — synthesizing from
        //      likelyImprovements[0] would just restate "What you gain"
        //      bullet 1, adding no new information
        const whyFits = opt.systemDelta?.whyFitsSystem;
        const whatChanges =
          whyFits
          ?? (opt.fitNote && /^in your chain/i.test(opt.fitNote) ? opt.fitNote : undefined);

        const makerInsight = composeMakerInsight(opt);

        const gainsRaw = (opt.systemDelta?.likelyImprovements ?? []).filter(Boolean);
        const gainsFallback = traits.slice(0, 2);
        const gains = (gainsRaw.length > 0 ? gainsRaw : gainsFallback).slice(0, 2);

        const tradeRaw = (opt.systemDelta?.tradeOffs ?? []).filter(Boolean);
        const tradeFallback = opt.caution ? [opt.caution] : [];
        const tradeoffs = (tradeRaw.length > 0 ? tradeRaw : tradeFallback).slice(0, 2);

        const sectionStyle: React.CSSProperties = { marginBottom: '1.15rem' };
        const textStyle: React.CSSProperties = {
          margin: 0,
          fontSize: '0.93rem',
          lineHeight: 1.7,
          color: COLORS.text,
        };
        const bulletStyle: React.CSSProperties = {
          margin: 0,
          paddingLeft: '1.2rem',
          lineHeight: 1.7,
          color: COLORS.text,
        };

        return (
          <>
            {/* 1. WHAT THIS CHANGES IN YOUR SYSTEM */}
            {whatChanges && (
              <div style={sectionStyle}>
                <SectionLabel>What this changes in your system</SectionLabel>
                <p style={textStyle}>{renderText(whatChanges)}</p>
              </div>
            )}

            {/* 1b. WHAT YOU'LL HEAR — sensory delta bullets */}
            {opt.whatYoullHear && opt.whatYoullHear.length > 0 && (
              <div style={sectionStyle}>
                <SectionLabel>What you&apos;ll hear</SectionLabel>
                <ul style={bulletStyle}>
                  {opt.whatYoullHear.slice(0, 3).map((h, i) => (
                    <li key={i} style={{ marginBottom: '0.2rem', fontSize: '0.93rem', color: '#4a6a50' }}>
                      {renderText(h)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 1c. TECHNICAL RATIONALE — design → audible outcome */}
            {opt.technicalRationale && opt.technicalRationale.length > 0 && (
              <div style={sectionStyle}>
                <SectionLabel>Technical rationale</SectionLabel>
                <ul style={bulletStyle}>
                  {opt.technicalRationale.slice(0, 3).map((t, i) => (
                    <li key={i} style={{ marginBottom: '0.2rem', fontSize: '0.93rem' }}>
                      {renderText(t)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 2. MAKER INSIGHT (Pass 12) — structured manufacturer block.
              *
              * Migrated brands render a 3-line block keyed on bold brand
              * name: Design / Tendency / In this system. Brand-general
              * content; the system-specific "What you gain / give up"
              * sections below carry chain-aware reasoning.
              *
              * Unmigrated brands fall back to the legacy one-sentence
              * compose under the brand-name lead. Both shapes share the
              * same outer container so the card hierarchy stays consistent.
              *
              * Why no SectionLabel: the bold brand name IS the section
              * marker for this slot — repeating "Maker" or "Why this
              * maker" above it would double-label. The brand name is also
              * shown in the card header (uppercase, muted) but at a
              * different visual weight; this lead acts as the section
              * anchor, not a duplicate identifier. */}
            {makerInsight && !hideMakerInsight && (
              <div style={sectionStyle}>
                <p style={{
                  margin: '0 0 0.4rem 0',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: COLORS.text,
                  letterSpacing: '-0.005em',
                }}>
                  {makerInsight.brand}
                </p>
                {makerInsight.kind === 'structured' ? (
                  <ul style={{
                    margin: 0,
                    padding: 0,
                    listStyle: 'none',
                    color: COLORS.textSecondary,
                    fontSize: '0.93rem',
                    lineHeight: 1.65,
                  }}>
                    <li style={{ marginBottom: '0.15rem' }}>
                      <span style={{ fontWeight: 600, color: COLORS.text }}>Design:</span>{' '}
                      {renderText(makerInsight.designPhilosophy)}
                    </li>
                    <li style={{ marginBottom: '0.15rem' }}>
                      <span style={{ fontWeight: 600, color: COLORS.text }}>Tendency:</span>{' '}
                      {renderText(makerInsight.sonicTendency)}
                    </li>
                    <li>
                      <span style={{ fontWeight: 600, color: COLORS.text }}>In this system:</span>{' '}
                      {renderText(makerInsight.typicalTradeoff)}
                    </li>
                  </ul>
                ) : (
                  <p style={{ ...textStyle, color: COLORS.textSecondary, margin: 0 }}>
                    {renderText(makerInsight.sentence)}
                  </p>
                )}
              </div>
            )}

            {/* 3. WHAT YOU GAIN */}
            {gains.length > 0 && (
              <div style={sectionStyle}>
                <SectionLabel>What you gain</SectionLabel>
                <ul style={bulletStyle}>
                  {gains.map((g, i) => (
                    <li key={i} style={{ marginBottom: '0.2rem', fontSize: '0.93rem' }}>
                      {renderText(g)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 4. WHAT YOU GIVE UP */}
            {tradeoffs.length > 0 && (
              <div style={sectionStyle}>
                <SectionLabel>What you give up</SectionLabel>
                <ul style={{ ...bulletStyle, color: COLORS.textSecondary }}>
                  {tradeoffs.map((t, i) => (
                    <li key={i} style={{ marginBottom: '0.2rem', fontSize: '0.93rem' }}>
                      {renderText(t)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 5. VERDICT — Pass 8.
              * Decisive, conditional one-liner derived from role + systemDelta.
              * Anchor reads as the default; alternatives read as conditional. */}
            {(() => {
              const verdict = buildVerdict(opt, role);
              if (!verdict) return null;
              return (
                <div style={{
                  // Pass 9: bumped weight on the verdict block so it reads
                  // unmistakably as the decision moment of the card —
                  // thicker accent rule, deeper padding, slightly stronger
                  // label color.
                  marginTop: '0.5rem',
                  marginBottom: '1rem',
                  padding: '0.85rem 1rem 0.95rem',
                  background: COLORS.accentBg,
                  borderLeft: `4px solid ${COLORS.accent}`,
                  borderRadius: '3px',
                }}>
                  <div style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: COLORS.accent,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    marginBottom: '0.35rem',
                  }}>
                    Verdict
                  </div>
                  <p style={{
                    margin: 0,
                    fontSize: '0.96rem',
                    lineHeight: 1.55,
                    color: COLORS.text,
                    fontWeight: 500,
                  }}>
                    {renderText(verdict)}
                  </p>
                </div>
              );
            })()}

            {/* 5b. POSITIONING HINT — Best for / Less ideal if */}
            {(opt.bestFor || opt.lessIdealIf) && (
              <div style={{
                marginBottom: '1rem',
                fontSize: '0.88rem',
                lineHeight: 1.6,
                color: COLORS.textSecondary,
              }}>
                {opt.bestFor && (
                  <div><span style={{ fontWeight: 600, color: '#5a7050' }}>Best for:</span> {opt.bestFor}</div>
                )}
                {opt.lessIdealIf && (
                  <div><span style={{ fontWeight: 600, color: '#8a6a50' }}>Less ideal if:</span> {opt.lessIdealIf}</div>
                )}
              </div>
            )}

            {/* FURTHER READING — compact expert-reference block.
             *
             * Provenance-only: sources come from the curated `sources`
             * array attached upstream via `topReviewsForCard`. No
             * fabrication — if a product isn't in the curated wedge,
             * `opt.sources` is empty and this block renders nothing.
             *
             * Audio XX voice dominates the card; this block is explicitly
             * secondary — muted label, small type, at most two rows,
             * quote in italics and strictly ≤15 words by curation policy.
             * The synthesis sentence written in Audio XX voice remains on
             * the ResolvedReview record but is NOT surfaced here — only
             * the reviewer's own attributed short quote + publication +
             * year + link appear, which is exactly the "supportive, not
             * dominant" role the spec calls for.
             */}
            {opt.sources && opt.sources.length > 0 && (
              <div style={{ margin: '0 0 0.85rem' }}>
                <SectionLabel>Further reading</SectionLabel>
                <ul style={{
                  margin: 0,
                  paddingLeft: '1.1rem',
                }}>
                  {opt.sources.slice(0, 2).map((s) => (
                    <li key={s.id} style={{
                      fontSize: '0.82rem',
                      lineHeight: 1.55,
                      color: COLORS.textMuted,
                      marginBottom: '0.25rem',
                    }}>
                      <span style={{ color: COLORS.textSecondary, fontWeight: 500 }}>
                        {s.reviewer.publication}
                      </span>
                      {' '}({s.year}):{' '}
                      <em>&ldquo;{s.shortQuote}&rdquo;</em>{' '}
                      <TrackedAnchor
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        product={fullName}
                        role={role}
                        kind="further_reading"
                        label={`${s.reviewer.publication} review`}
                        style={{ color: COLORS.accent, textDecoration: 'none' }}
                      >
                        {s.medium === 'video' ? 'watch' : 'read'}
                      </TrackedAnchor>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 5. BUY LINKS */}
            <ProductLinksSection opt={opt} product={fullName} role={role} />
          </>
        );
      })()}
    </div>
  );
}

// ── Main export: editorial product list ───────────────

interface AdvisoryProductCardProps {
  options: AdvisoryOption[];
  /**
   * Suppress the structured "Maker insight" block (Design / Tendency /
   * In this system) on every card.
   *
   * Used by single-brand contexts (e.g. /brand/[slug]) where the brand's
   * identity is already shown ONCE at the page header — re-rendering it
   * on every card from the same maker would duplicate advisory text. Default
   * false so existing recommendation contexts are unchanged.
   */
  hideMakerInsight?: boolean;
  /**
   * Soft image-preference for surfaced recommendation contexts.
   * When true, image-backed products sort first and non-image products
   * backfill only when needed to meet a healthy floor (minimum 2,
   * target 3). Does NOT affect long-tail catalog or brand-page card
   * rendering. Default false.
   */
  preferImage?: boolean;
}

// Role sort order: anchor first → close_alt → contrast → wildcard → legacy roles → untagged
const ROLE_SORT_ORDER: Record<string, number> = {
  anchor: 0, close_alt: 1, contrast: 2, wildcard: 3,
  top_pick: 0, upgrade_pick: 1, value_pick: 2,
};

/** Minimum products to show in a surfaced block (unless the pool is smaller). */
const SURFACED_FLOOR = 2;
/** Target product count when preferImage is active. */
const SURFACED_TARGET = 3;

export default function AdvisoryProductCards({ options, hideMakerInsight, preferImage }: AdvisoryProductCardProps) {
  // ── Soft image-preference selection ──
  // When preferImage is set, image-backed products sort first. If fewer
  // than SURFACED_TARGET have images, backfill with non-image products
  // until we reach the target (or exhaust the pool). Never show fewer
  // than SURFACED_FLOOR unless the candidate pool itself is smaller.
  let eligible: AdvisoryOption[];
  if (preferImage) {
    const withImg = options.filter((o) => !!o.imageUrl);
    const withoutImg = options.filter((o) => !o.imageUrl);
    const needed = Math.max(SURFACED_FLOOR, SURFACED_TARGET) - withImg.length;
    eligible = needed > 0
      ? [...withImg, ...withoutImg.slice(0, needed)]
      : withImg.length >= SURFACED_TARGET
        ? withImg.slice(0, Math.max(withImg.length, SURFACED_TARGET))
        : withImg;
  } else {
    eligible = options;
  }

  // Sort by role: Best Choice -> Upgrade Choice -> Value Choice -> untagged
  const sorted = [...eligible].sort((a, b) => {
    const roleA = getRoleFromOption(a) ?? '';
    const roleB = getRoleFromOption(b) ?? '';
    return (ROLE_SORT_ORDER[roleA] ?? 9) - (ROLE_SORT_ORDER[roleB] ?? 9);
  });

  // Pass 9: vertical-stack of self-contained cards. Spacing replaces the
  // old <hr/> divider — each card is now its own surface with a real
  // border, so a between-cards rule would be visual noise.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.6rem' }}>
      {sorted.map((opt, i) => (
        <EditorialProductSection key={i} opt={opt} index={i} hideMakerInsight={hideMakerInsight} />
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
