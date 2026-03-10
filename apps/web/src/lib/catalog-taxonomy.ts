/**
 * Catalog taxonomy types — shared classification vocabulary
 * for products, brands, and the knowledge layer.
 *
 * These types define the diversity dimensions that Audio XX uses
 * to ensure broad, international representation across categories,
 * topologies, regions, price tiers, and brand scales.
 *
 * Design principle: Audio XX should reflect the real audio ecosystem —
 * not just the familiar Western audiophile brands. Small makers,
 * regional specialists, and mainstream brands all have a place.
 */

// ── Product categories ───────────────────────────────

/**
 * Primary product category.
 *
 * Covers the full signal chain from source to transducer,
 * plus accessories (cables, isolation) and personal listening (headphones/IEMs).
 */
export type ProductCategory =
  | 'speaker'
  | 'amplifier'
  | 'dac'
  | 'streamer'
  | 'turntable'
  | 'cartridge'
  | 'phono'
  | 'headphone'
  | 'iem'
  | 'cable'
  | 'integrated'     // amplifier + DAC or amplifier + streamer
  | 'other';

/**
 * Optional subcategory for finer classification.
 * Not all products need one — use when it meaningfully
 * distinguishes design intent or pairing behavior.
 */
export type ProductSubcategory =
  // Speakers
  | 'floorstanding'
  | 'standmount'
  | 'full-range'
  // Amplifiers
  | 'power-amp'
  | 'preamp'
  | 'integrated-amp'
  | 'headphone-amp'
  // DACs
  | 'standalone-dac'
  | 'dac-preamp'
  | 'dac-amp'            // combined DAC + headphone amp
  // Turntables
  | 'manual'
  | 'semi-automatic'
  | 'automatic'
  // Cables
  | 'interconnect'
  | 'speaker-cable'
  | 'power-cable'
  | 'digital-cable'
  | 'phono-cable'
  // General
  | 'other';

// ── Price tiers ──────────────────────────────────────

/**
 * Price tier classification.
 *
 * Boundaries are approximate and category-relative.
 * A "mid-fi" DAC and a "mid-fi" speaker may differ in absolute price,
 * but occupy similar positions within their respective markets.
 *
 * Tier        Rough USD range (category-dependent)
 * ─────────   ──────────────────────────────────────
 * budget      Under ~$500
 * mid-fi      ~$500–$2,000
 * upper-mid   ~$2,000–$5,000
 * high-end    ~$5,000–$15,000
 * statement   Above ~$15,000
 */
export type PriceTier =
  | 'budget'
  | 'mid-fi'
  | 'upper-mid'
  | 'high-end'
  | 'statement';

// ── Brand scale ──────────────────────────────────────

/**
 * Brand scale — describes the size and market position of a brand.
 *
 * mainstream   — Large-scale production, wide distribution, broad name recognition
 *                (e.g. Sony, Yamaha, Denon, KEF, B&W, Marantz)
 * specialist   — Focused audio companies with moderate production and strong
 *                reputation within the enthusiast community
 *                (e.g. Naim, Pass Labs, Rega, Denafrips, Hegel)
 * boutique     — Small-scale or artisanal production, often founder-led,
 *                limited distribution, strong design identity
 *                (e.g. Shindo, DeVore, Border Patrol, Lampizator, Audion)
 */
export type BrandScale =
  | 'mainstream'
  | 'specialist'
  | 'boutique';

// ── Region ───────────────────────────────────────────

/**
 * Geographic region — broad cultural/manufacturing zone.
 *
 * Used for brand and product origin, not current manufacturing
 * location (which may differ). Represents design heritage.
 */
export type GeoRegion =
  | 'north-america'
  | 'europe'
  | 'uk'               // distinct audio design heritage
  | 'japan'            // distinct audio design heritage
  | 'east-asia'        // China, South Korea, Taiwan, etc.
  | 'southeast-asia'
  | 'oceania'
  | 'other';

// ── Design topology ──────────────────────────────────

/**
 * Common design topologies / architectures.
 *
 * These are illustrative, not exhaustive. Products may specify
 * a freeform `architecture` string in addition to this tag.
 * The topology tag enables filtering and pattern-matching across
 * the catalog; the architecture string provides nuance.
 */
export type DesignTopology =
  // DAC topologies
  | 'r2r'
  | 'delta-sigma'
  | 'nos'              // non-oversampling
  | 'fpga'
  | 'multibit'
  // Amplifier topologies
  | 'set'              // single-ended triode
  | 'push-pull-tube'
  | 'class-a-solid-state'
  | 'class-ab-solid-state'
  | 'class-d'
  | 'hybrid'           // tube + solid-state
  // Speaker topologies
  | 'sealed'
  | 'bass-reflex'
  | 'horn-loaded'
  | 'open-baffle'
  | 'transmission-line'
  | 'high-efficiency'
  // Turntable topologies
  | 'belt-drive'
  | 'direct-drive'
  | 'idler-drive'
  // Cartridge topologies
  | 'moving-coil'
  | 'moving-magnet'
  | 'moving-iron'
  // General
  | 'other';

// ── Catalog metadata ─────────────────────────────────

/**
 * Diversity metadata that can be attached to any Product or BrandKnowledge.
 * All fields are optional — fill what is known.
 */
export interface CatalogMeta {
  /** Price tier relative to the product's category. */
  priceTier?: PriceTier;
  /** Brand scale / market position. */
  brandScale?: BrandScale;
  /** Geographic region of brand origin / design heritage. */
  region?: GeoRegion;
  /** Country of origin (ISO 3166-1 name or code). */
  country?: string;
  /** Design topology tag — enables cross-catalog filtering. */
  topology?: DesignTopology;
  /** Optional subcategory for finer classification. */
  subcategory?: ProductSubcategory;
}
