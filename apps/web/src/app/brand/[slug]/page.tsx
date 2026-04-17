import Link from 'next/link';
import {
  findBrandProfileBySlug,
  findProductsByBrandSlug,
} from '@/lib/consultation';
import type { Product } from '@/lib/products/dacs';
import type { AdvisoryOption } from '@/lib/advisory-response';
import AdvisoryProductCards from '@/components/advisory/AdvisoryProductCard';

/**
 * Audio XX — Brand detail page.
 *
 * Reached from the manufacturer bubble on a product card. Three sections:
 *   1. Brand header — name + (when available) founder / country.
 *   2. Brand identity — Design / Tendency / In this system, sourced
 *      verbatim from BrandProfile's structured summary fields.
 *   3. Product list — every catalog product whose brand slugifies to
 *      this slug, rendered with the existing AdvisoryProductCard.
 *
 * Boundary note: this page is wiring + presentation only. No new audio
 * reasoning, no scoring, no recommendation logic. Brand identity is
 * sourced verbatim from BrandProfile so this page never duplicates or
 * paraphrases the curated layer. The product list reuses the existing
 * card component with `hideMakerInsight` flipped on, since the brand's
 * Design / Tendency / In this system block already appears once at the
 * top of the page — re-rendering it on every card would duplicate
 * advisory text.
 */

// ── Design tokens ───────────────────────────────────────
//
// Mirrored from app/page.tsx COLOR. Keep in sync — no shared module
// yet (intentional, to avoid pulling page-level imports across the tree).

const COLOR = {
  textPrimary: '#1F1D1B',
  textSecondary: '#5C5852',
  textMuted: '#8C877F',
  accent: '#B08D57',
  border: '#D8D2C5',
  borderLight: '#E8E3D7',
  cardBg: '#FFFEFA',
} as const;

// ── Adapter: catalog Product → AdvisoryOption ───────────
//
// The brand page lists products outside any recommendation context —
// no role, no fitNote, no system delta. AdvisoryOption was designed for
// recommendation contexts, but its consumers (AdvisoryProductCard)
// degrade cleanly when the recommendation-context fields are absent:
// no role badge, no verdict block, no "what this changes" section, no
// gain / trade-off bullets. What remains is the product header (brand,
// name, identity line), price, image, availability, and the buy-link
// row — which is exactly what a brand catalog entry should show.
//
// The `fitNote` field is `string` (not `string?`) on AdvisoryOption,
// so we set it to '' — the card never renders fitNote directly; it's
// only consumed by a regex-gated branch that requires "in your chain"
// prefix, so an empty string is a safe inert default.

const CATEGORY_TO_PRODUCT_TYPE: Record<string, string> = {
  dac: 'DAC',
  speaker: 'Speaker',
  amplifier: 'Amplifier',
  integrated: 'Integrated Amplifier',
  turntable: 'Turntable',
  streamer: 'Streamer',
  cartridge: 'Cartridge',
  phono: 'Phono Stage',
  headphone: 'Headphones',
  iem: 'In-Ear Monitor',
  cable: 'Cable',
  other: 'Component',
};

function productToAdvisoryOption(p: Product): AdvisoryOption {
  return {
    name: p.name,
    brand: p.brand,
    price: p.price,
    priceCurrency: p.priceCurrency,
    fitNote: '',
    imageUrl: p.imageUrl,
    productType: CATEGORY_TO_PRODUCT_TYPE[p.category] ?? p.category,
    catalogTopology: p.topology,
    catalogCountry: p.country,
    catalogBrandScale: p.brandScale,
    availability: p.availability,
    typicalMarket: p.typicalMarket,
    usedPriceRange: p.usedPriceRange,
    buyingContext: p.buyingContext,
    manufacturerUrl: p.retailer_links?.[0]?.url,
    links: p.retailer_links?.map((l) => ({ label: l.label, url: l.url })),
  };
}

// ── Display helpers ─────────────────────────────────────

function humanizeFromSlug(slug: string): string {
  return slug
    .split('-')
    .map((part) => (part.length ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BrandPage({ params }: PageProps) {
  const { slug } = await params;
  const profile = findBrandProfileBySlug(slug);
  const products = findProductsByBrandSlug(slug);

  // Display name — prefer the canonical-cased brand string from a
  // catalog product (e.g. "DeVore Fidelity"), since BrandProfile.names
  // are lowercase. Fall back to a humanized slug when no products and
  // no profile exist.
  const displayName =
    products[0]?.brand ?? humanizeFromSlug(slug);

  // Tight metadata line under the brand name — founder + country, when
  // both are present on the profile. Single line, comma-separated, no
  // labels.
  const metaParts: string[] = [];
  if (profile?.founder) metaParts.push(profile.founder);
  if (profile?.country) metaParts.push(profile.country);
  const metaLine = metaParts.join(' \u00b7 ');

  // Identity lines — only render when ALL three structured fields are
  // present. Partial data would create an asymmetric block and read as
  // editorial fragmentation. When missing, we omit the section entirely
  // rather than fall back to long prose.
  const hasIdentity = !!(
    profile?.designPhilosophy &&
    profile?.sonicTendency &&
    profile?.typicalTradeoff
  );

  // Adapt every catalog product once. Stable order: by category, then
  // price ascending, so the same brand surfaces in a consistent order
  // across visits.
  const options: AdvisoryOption[] = [...products]
    .sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return (a.price ?? 0) - (b.price ?? 0);
    })
    .map(productToAdvisoryOption);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      {/* ── Back link ── */}
      <p style={{
        fontSize: '0.82rem',
        color: COLOR.textMuted,
        marginBottom: '1.25rem',
      }}>
        <Link href="/" style={{ color: COLOR.textMuted }}>&larr; Back</Link>
      </p>

      {/* ── 1. Brand header ──
        * Optional visual anchor renders above the brand name when the
        * profile carries imagery: representativeImageUrl wins (a hero
        * product photo conveys identity better than a wordmark); logoUrl
        * is the fallback. When neither is set we render nothing — no
        * placeholder, no empty box. URLs are populated only after
        * verification per the asset manifest workflow; this page does not
        * fabricate them. */}
      <header style={{ marginBottom: hasIdentity ? '1.75rem' : '1.25rem' }}>
        {(() => {
          const imageSrc =
            profile?.representativeImageUrl ?? profile?.logoUrl ?? null;
          if (!imageSrc) return null;
          return (
            <img
              src={imageSrc}
              alt={displayName}
              loading="lazy"
              style={{
                display: 'block',
                maxWidth: 320,
                width: '100%',
                height: 'auto',
                objectFit: 'contain',
                marginBottom: '1rem',
              }}
            />
          );
        })()}
        <h1 style={{
          fontSize: '1.85rem',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: COLOR.textPrimary,
          margin: 0,
          lineHeight: 1.2,
        }}>
          {displayName}
        </h1>
        {metaLine && (
          <p style={{
            margin: '0.4rem 0 0',
            fontSize: '0.92rem',
            color: COLOR.textMuted,
            letterSpacing: '0.01em',
          }}>
            {metaLine}
          </p>
        )}
      </header>

      {/* ── 2. Brand identity ──
        * Sourced verbatim from BrandProfile.designPhilosophy /
        * sonicTendency / typicalTradeoff. Same fields the maker-insight
        * block on AdvisoryProductCard reads — and the reason
        * `hideMakerInsight` is set on the card list below. Showing this
        * once at the page header replaces N copies on the cards. */}
      {hasIdentity && (
        <section style={{
          marginBottom: '2.25rem',
          padding: '1.25rem 1.4rem',
          background: COLOR.cardBg,
          border: `1px solid ${COLOR.borderLight}`,
          borderLeft: `3px solid ${COLOR.accent}`,
          borderRadius: '4px',
        }}>
          <ul style={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
            color: COLOR.textSecondary,
            fontSize: '0.95rem',
            lineHeight: 1.7,
          }}>
            <li style={{ marginBottom: '0.3rem' }}>
              <span style={{ fontWeight: 600, color: COLOR.textPrimary }}>Design:</span>{' '}
              {profile!.designPhilosophy}
            </li>
            <li style={{ marginBottom: '0.3rem' }}>
              <span style={{ fontWeight: 600, color: COLOR.textPrimary }}>Tendency:</span>{' '}
              {profile!.sonicTendency}
            </li>
            <li>
              <span style={{ fontWeight: 600, color: COLOR.textPrimary }}>In this system:</span>{' '}
              {profile!.typicalTradeoff}
            </li>
          </ul>
        </section>
      )}

      {/* ── No-profile fallback ──
        * When there is no curated BrandProfile but products exist (rare
        * — every catalog brand should have a profile, but cataloging
        * runs ahead of profile authoring sometimes), still show the
        * product list. Honest absence beats invented identity. */}
      {!profile && products.length > 0 && (
        <p style={{
          marginBottom: '1.5rem',
          fontSize: '0.92rem',
          color: COLOR.textMuted,
          fontStyle: 'italic',
        }}>
          No brand profile yet for {displayName}. Showing catalog entries.
        </p>
      )}

      {/* ── 3. Product list ──
        * Reuses AdvisoryProductCard. `hideMakerInsight` is the only
        * context flag — every other recommendation-context field on
        * AdvisoryOption is intentionally absent on the brand page, so
        * the card naturally degrades to header / price / image /
        * availability / buy-link row. No new card type. */}
      {options.length > 0 ? (
        <section>
          <h2 style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: COLOR.textMuted,
            marginBottom: '1rem',
          }}>
            Catalog &mdash; {options.length} {options.length === 1 ? 'product' : 'products'}
          </h2>
          <AdvisoryProductCards options={options} hideMakerInsight />
        </section>
      ) : (
        <p style={{
          fontSize: '0.95rem',
          color: COLOR.textMuted,
          fontStyle: 'italic',
        }}>
          No catalog products from {displayName} yet.
        </p>
      )}
    </div>
  );
}
