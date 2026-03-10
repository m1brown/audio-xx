/**
 * Knowledge layer schemas — brand and product profiles.
 *
 * These are the source-of-truth types for the curated knowledge layer.
 * They are richer than the runtime BRAND_PROFILES in consultation.ts,
 * which will progressively defer to approved knowledge entries.
 */

import type {
  CurationMeta,
  SourceEntry,
  KnowledgeLink,
  DealerEntry,
  ProductFamily,
} from './types';

// ── Brand knowledge ──────────────────────────────────

/**
 * A curated brand profile.
 *
 * Covers design philosophy, sonic reputation, product families,
 * pairing tendencies, and provenance. International by default.
 */
export interface BrandKnowledge {
  /** Unique identifier (kebab-case, e.g. "devore"). */
  id: string;
  /** Full brand name as displayed (e.g. "DeVore Fidelity"). */
  name: string;
  /** Lowercase aliases for matching user input (e.g. ["devore", "devore fidelity"]). */
  aliases: string[];

  // ── Identity ─────────────────────────────
  /** Founder or lead designer, if notable. */
  founder?: string;
  /** Country of origin. */
  country?: string;
  /** Year or approximate era founded (e.g. "2000", "early 1970s"). */
  founded?: string;
  /** More specific location (e.g. "Brooklyn, New York"). */
  location?: string;

  // ── Design ───────────────────────────────
  /** Core design philosophy — what the brand prioritises. */
  philosophy: string;
  /** Notable product families or lineages. */
  productFamilies?: ProductFamily[];

  // ── Sound ────────────────────────────────
  /** Broad sonic reputation — how the brand tends to sound. */
  sonicReputation: string;
  /** Pairing tendencies — what amplifiers, sources, etc. are commonly used. */
  pairingTendencies?: string;

  // ── Links & dealers ──────────────────────
  /** Structured links (official, review, reference). */
  links: KnowledgeLink[];
  /** Known dealers and distributors, international. */
  dealers?: DealerEntry[];

  // ── Provenance ───────────────────────────
  /** Source entries that informed this profile. */
  sources: SourceEntry[];
  /** Curation lifecycle metadata. */
  curation: CurationMeta;
}

// ── Product knowledge ────────────────────────────────

/**
 * A curated product profile.
 *
 * Covers design topology, sonic character, room behavior,
 * pairing tendencies, and review provenance.
 */
export interface ProductKnowledge {
  /** Unique identifier (kebab-case, e.g. "devore-o96"). */
  id: string;
  /** Brand identifier — must match a BrandKnowledge.id. */
  brandId: string;
  /** Product name as displayed (e.g. "Orangutan O/96"). */
  name: string;

  // ── Classification ───────────────────────
  /** Product category. */
  category: 'speaker' | 'dac' | 'amplifier' | 'turntable' | 'phono' | 'streamer' | 'cable' | 'other';
  /** Design topology or architecture (e.g. "R-2R", "horn-loaded"). */
  topology?: string;

  // ── Technical notes ──────────────────────
  /** Sensitivity (speakers). */
  sensitivity?: string;
  /** Nominal impedance (speakers). */
  impedance?: string;
  /** Amplifier load notes (e.g. "easy load, tube-friendly"). */
  loadNotes?: string;
  /** Power output or topology notes (amplifiers). */
  powerNotes?: string;
  /** Approximate price and currency. */
  price?: { amount: number; currency: string };

  // ── Sound ────────────────────────────────
  /** What the designer intended — the design goal. */
  designIntent: string;
  /** Broad sonic character / tendencies. */
  sonicCharacter: string;
  /** Room behavior notes — how the product interacts with the room. */
  roomBehavior?: string;
  /** Pairing tendencies — what works well with this product. */
  pairingTendencies?: string;

  // ── Links ────────────────────────────────
  /** Structured links (official product page, reviews). */
  links: KnowledgeLink[];

  // ── Provenance ───────────────────────────
  /** Source entries that informed this profile. */
  sources: SourceEntry[];
  /** Curation lifecycle metadata. */
  curation: CurationMeta;
}
