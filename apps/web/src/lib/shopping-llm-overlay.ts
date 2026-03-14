/**
 * LLM editorial overlay for shopping / gear recommendation results.
 *
 * After deterministic product selection and scoring, this module
 * optionally asks the LLM to write richer, editorial-quality
 * per-product descriptions grounded in the user's specific context:
 *   - Their system (components, character, tendencies)
 *   - Their listening priorities and taste profile
 *   - Their desires and avoidances
 *   - Their budget and room context
 *
 * It returns enriched fields per product:
 *   - standoutFeatures (2–3 bullets: "Why it stands out")
 *   - soundProfile (2–3 bullets: "Sound profile")
 *   - systemFit (1–2 bullets: "With your system")
 *   - verdict (1 sentence)
 *
 * Design:
 *   - Input: deterministic AdvisoryOption[] + rich user context
 *   - Output: enriched per-product editorial fields
 *   - Hard timeout with silent fallback to deterministic builders
 *   - Product name allowlist enforced — LLM cannot invent products
 *   - Fire-and-forget from the caller's perspective
 *
 * The LLM MUST NOT:
 *   - Introduce products not in the shortlist
 *   - Add scores, urgency, or affiliate language
 *   - Invent technical specifications
 *   - Reorder or remove products
 */

import type { AdvisoryOption } from './advisory-response';

// ── Configuration ────────────────────────────────────

/** Hard timeout for the LLM call in milliseconds. */
const LLM_TIMEOUT_MS = 12000;

// ── Types ────────────────────────────────────────────

/** Per-product editorial fields returned by the LLM. */
export interface ProductEditorial {
  /** Product name — must match a shortlisted product exactly. */
  name: string;
  /** "Why it stands out" — 2–3 architecture/design highlights. */
  standoutFeatures: string[];
  /** "Sound profile" — 2–3 sonic character bullets. */
  soundProfile: string[];
  /** "With your system" — 1–2 bullets on system interaction. */
  systemFit: string[];
  /** One-sentence verdict. */
  verdict: string;
}

/**
 * Rich user context fed to the LLM.
 *
 * This is the key differentiator: the LLM writes descriptions
 * in terms of THIS user's system, taste, desires, and context —
 * not generic product reviews.
 */
export interface ShoppingEditorialContext {
  // ── System ─────────────────────────────────────────
  /** Component names in the current system (e.g. ["JOB Integrated", "WLM Diva"]). */
  systemComponents?: string[];
  /** System tendencies / character (e.g. "fast, lean, resolving"). */
  systemCharacter?: string;

  // ── Taste & preferences ────────────────────────────
  /** What the user seems to value (e.g. "sweetness, flow, sparkle, engagement without glare"). */
  tasteLabel?: string;
  /** Inferred sonic archetype (e.g. "flow_organic", "precision_explicit"). */
  archetype?: string;
  /** Directional desires — what they want more/less of. */
  desires?: Array<{ quality: string; direction: 'more' | 'less' }>;
  /** Qualities they want to preserve while changing. */
  preserve?: string[];
  /** Trait signals — which sonic traits are 'up' or 'down'. */
  traitSignals?: Record<string, 'up' | 'down'>;
  /** Archetype hints from user language (e.g. "warm", "analytical"). */
  archetypeHints?: string[];

  // ── Shopping context ───────────────────────────────
  /** The product category being shopped (e.g. "dac", "amplifier"). */
  category?: string;
  /** Budget (e.g. "$2000"). */
  budget?: string;
  /** Raw user query text for natural language grounding. */
  userQuery?: string;

  // ── Directional recommendation ─────────────────────
  /** The reasoning engine's recommended direction statement. */
  directionStatement?: string;
  /** Archetype shift note if applicable. */
  archetypeNote?: string;
}

// ── Prompt construction ──────────────────────────────

function buildSystemPrompt(): string {
  return `You are a private audio advisor writing personalized product descriptions for a specific listener.

You receive a shortlist of recommended audio products along with detailed context about the user: their system, taste profile, listening priorities, desires, and budget. Your job is to write descriptions that explain each product IN TERMS OF THIS USER — not generic reviews.

For EACH product, produce:

1. standoutFeatures — 2–3 bullets explaining why this product is notable from a design and engineering perspective. Be specific about architecture, design philosophy, and distinguishing technical choices (e.g. "Custom FPGA DAC architecture designed by Rob Watts" not "Good DAC"). Ground in actual product knowledge.

2. soundProfile — 2–3 bullets describing what this product sounds like. Use vivid but precise language. Compare to other design approaches where it helps the user understand the sonic character (e.g. "Slightly lean but very clean tonally" or "Rich tone density with slightly relaxed transients compared to Chord").

3. systemFit — 1–2 bullets explaining how this product would interact with THIS USER'S specific system. Reference their actual components by name. Explain whether it would complement or contrast their current tendencies. Be honest about both synergies and potential mismatches. This is the most important section — it must feel personal.

4. verdict — One direct sentence. Relate it to this user's situation (e.g. "One of the safest upgrades given your preference for flow without sacrificing the speed your JOB provides" not just "Good DAC").

CRITICAL RULES:
- Every description must relate back to the user's stated preferences, system, and context.
- Use ONLY the product names provided. Do NOT introduce, suggest, or mention any product not in the shortlist.
- No numeric scores, star ratings, or rankings.
- No urgency, hype, or affiliate language ("buy now", "limited", "must-have").
- No superlatives ("perfect", "ultimate", "flawless", "best"). Say "strong match" or "well-aligned" instead.
- No invented specifications. If you don't know a detail, omit it rather than guess.
- Calm, knowledgeable tone — like a trusted advisor who knows this person's taste.
- Each bullet should be 1–2 sentences max.

Respond with a JSON array matching the product order. No markdown fences.`;
}

function buildUserPrompt(
  products: AdvisoryOption[],
  ctx: ShoppingEditorialContext,
): string {
  const parts: string[] = [];

  // ── User profile ──────────────────────────────────
  parts.push('=== ABOUT THIS LISTENER ===');

  if (ctx.systemComponents?.length) {
    parts.push(`Current system: ${ctx.systemComponents.join(' → ')}`);
  }
  if (ctx.systemCharacter) {
    parts.push(`System tendencies: ${ctx.systemCharacter}`);
  }
  if (ctx.tasteLabel) {
    parts.push(`What they value: ${ctx.tasteLabel}`);
  }
  if (ctx.desires?.length) {
    const moreDesires = ctx.desires.filter((d) => d.direction === 'more').map((d) => d.quality);
    const lessDesires = ctx.desires.filter((d) => d.direction === 'less').map((d) => d.quality);
    if (moreDesires.length > 0) parts.push(`Wants more: ${moreDesires.join(', ')}`);
    if (lessDesires.length > 0) parts.push(`Wants less: ${lessDesires.join(', ')}`);
  }
  if (ctx.preserve?.length) {
    parts.push(`Wants to preserve: ${ctx.preserve.join(', ')}`);
  }
  if (ctx.traitSignals && Object.keys(ctx.traitSignals).length > 0) {
    const ups = Object.entries(ctx.traitSignals).filter(([, d]) => d === 'up').map(([t]) => t.replace(/_/g, ' '));
    const downs = Object.entries(ctx.traitSignals).filter(([, d]) => d === 'down').map(([t]) => t.replace(/_/g, ' '));
    if (ups.length > 0) parts.push(`Traits they favor: ${ups.join(', ')}`);
    if (downs.length > 0) parts.push(`Traits they de-prioritize: ${downs.join(', ')}`);
  }
  if (ctx.archetype) {
    const ARCHETYPE_LABELS: Record<string, string> = {
      flow_organic: 'flow-oriented, organic presentation',
      precision_explicit: 'precision-focused, detail-forward',
      rhythmic_propulsive: 'rhythm-driven, dynamic',
      tonal_saturated: 'tonally rich, harmonically dense',
      spatial_holographic: 'spatially precise, holographic staging',
    };
    const label = ARCHETYPE_LABELS[ctx.archetype] ?? ctx.archetype;
    parts.push(`Sonic archetype: ${label}`);
  }
  if (ctx.archetypeHints?.length) {
    parts.push(`Expressed preferences: ${ctx.archetypeHints.join(', ')}`);
  }
  if (ctx.directionStatement) {
    parts.push(`Recommended direction: ${ctx.directionStatement}`);
  }
  if (ctx.archetypeNote) {
    parts.push(`Note: ${ctx.archetypeNote}`);
  }

  // ── Shopping context ──────────────────────────────
  parts.push('');
  parts.push('=== SHOPPING CONTEXT ===');
  if (ctx.category) parts.push(`Looking for: ${ctx.category}`);
  if (ctx.budget) parts.push(`Budget: ${ctx.budget}`);
  if (ctx.userQuery) parts.push(`Their words: "${ctx.userQuery}"`);

  // ── Product shortlist ─────────────────────────────
  parts.push('');
  parts.push('=== PRODUCT SHORTLIST ===');

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const lines: string[] = [];
    lines.push(`${i + 1}. ${p.brand ?? ''} ${p.name}`.trim());
    if (p.productType) lines.push(`   Type: ${p.productType}`);
    if (p.price) lines.push(`   Price: ~$${p.price}`);
    if (p.character) lines.push(`   Character: ${p.character}`);
    if (p.sonicDirectionLabel) lines.push(`   Direction: ${p.sonicDirectionLabel}`);
    if (p.standoutFeatures?.length) {
      lines.push(`   Design notes: ${p.standoutFeatures.join('; ')}`);
    }
    if (p.soundProfile?.length) {
      lines.push(`   Sound notes: ${p.soundProfile.join('; ')}`);
    }
    if (p.systemDelta?.whyFitsSystem) {
      lines.push(`   System fit: ${p.systemDelta.whyFitsSystem}`);
    }
    if (p.systemDelta?.likelyImprovements?.length) {
      lines.push(`   Would improve: ${p.systemDelta.likelyImprovements.join(', ')}`);
    }
    if (p.systemDelta?.tradeOffs?.length) {
      lines.push(`   Trade-offs: ${p.systemDelta.tradeOffs.join(', ')}`);
    }
    parts.push(lines.join('\n'));
  }

  parts.push('');
  parts.push('Write personalized editorial descriptions for each product, relating every section back to this listener\'s preferences and system. Return a JSON array of objects with fields: name, standoutFeatures, soundProfile, systemFit, verdict.');

  return parts.join('\n');
}

// ── Response parsing ─────────────────────────────────

function parseLlmResponse(raw: string): ProductEditorial[] | null {
  try {
    // Strip markdown fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return null;

    const results: ProductEditorial[] = [];
    for (const item of parsed) {
      if (
        typeof item.name !== 'string' ||
        !Array.isArray(item.standoutFeatures) ||
        !Array.isArray(item.soundProfile) ||
        !Array.isArray(item.systemFit) ||
        typeof item.verdict !== 'string'
      ) {
        continue; // Skip malformed entries
      }

      results.push({
        name: item.name,
        standoutFeatures: item.standoutFeatures.filter((s: unknown) => typeof s === 'string').slice(0, 3),
        soundProfile: item.soundProfile.filter((s: unknown) => typeof s === 'string').slice(0, 3),
        systemFit: item.systemFit.filter((s: unknown) => typeof s === 'string').slice(0, 3),
        verdict: item.verdict.slice(0, 300),
      });
    }

    return results.length > 0 ? results : null;
  } catch {
    return null;
  }
}

// ── Validation ───────────────────────────────────────

/** Patterns that should never appear in editorial content. */
const PROHIBITED_PATTERNS = [
  /\b(must|urgently|act now|hurry|limited time|don't miss)\b/i,
  /\b\d+\s*\/\s*10\b/,         // "9/10" style scores
  /\bscored?\s*\d/i,           // "scored 8"
  /\b(click here|buy now|order now|add to cart)\b/i,
  /\b(perfect|ultimate|flawless|unbeatable)\b/i,
];

/**
 * Validate a single text field against prohibited patterns.
 * Returns the text if clean, undefined if rejected.
 */
function validateField(text: string): string | undefined {
  for (const pattern of PROHIBITED_PATTERNS) {
    if (pattern.test(text)) return undefined;
  }
  return text;
}

// ── Catalog cross-reference validation ──────────────
//
// The most dangerous LLM confabulations are factual claims that
// contradict the product catalog. We check each bullet for:
//   1. Topology/architecture misattribution (calling an R2R a delta-sigma)
//   2. Origin/nationality misattribution (calling a Chinese brand German)
//   3. Wrong chip family attribution (claiming ESS when it's AKM)
//
// Bullets that contradict catalog facts are silently dropped.
// Bullets that don't mention checkable facts pass through.

/** Topology families and their identifying keywords. */
const TOPOLOGY_KEYWORDS: Record<string, string[]> = {
  'r2r':            ['r2r', 'r-2r', 'ladder', 'resistor ladder', 'discrete ladder'],
  'delta-sigma':    ['delta-sigma', 'delta sigma', 'σ-δ', 'Σ-Δ'],
  'fpga':           ['fpga', 'pulse array', 'pulse-array'],
  'multibit':       ['multibit', 'multi-bit'],
  'nos':            ['nos', 'non-oversampling', 'non oversampling', 'zero-filter'],
  'set':            ['single-ended triode', 'set '],
  'push-pull-tube': ['push-pull', 'push pull'],
  'class-a-solid-state':  ['class a', 'class-a'],
  'class-ab-solid-state': ['class ab', 'class-ab'],
  'class-d':        ['class d', 'class-d', 'gan'],
  'hybrid':         ['hybrid'],
};

/** Chip family keywords. */
const CHIP_KEYWORDS: Record<string, string[]> = {
  'ess':  ['ess ', 'ess9', 'sabre', 'es9038', 'es9028', 'es9026', 'es9018'],
  'akm':  ['akm', 'ak4', 'ak44', 'ak449', 'velvet'],
  'ti':   ['pcm17', 'pcm57', 'burr-brown', 'burr brown'],
  'ad':   ['ad1955', 'analog devices'],
};

/** Country → common nationality/origin keywords. */
const COUNTRY_KEYWORDS: Record<string, string[]> = {
  'CN': ['chinese', 'china', 'shenzhen'],
  'US': ['american', 'usa', 'united states', 'u.s.'],
  'JP': ['japanese', 'japan'],
  'DE': ['german', 'germany'],
  'GB': ['british', 'england', 'uk'],
  'TW': ['taiwanese', 'taiwan'],
  'KR': ['korean', 'korea'],
  'FR': ['french', 'france'],
  'IT': ['italian', 'italy'],
  'CA': ['canadian', 'canada'],
  'AU': ['australian', 'australia'],
};

/**
 * Check whether a text bullet contradicts known catalog facts.
 *
 * Returns true if the bullet is SAFE (no contradiction detected).
 * Returns false if the bullet makes a claim that conflicts with catalog data.
 */
function passesCatalogCheck(
  text: string,
  catalogFacts: CatalogFacts,
): boolean {
  const lower = text.toLowerCase();

  // ── Topology check ─────────────────────────────────
  // If the LLM claims a specific topology, it must match the catalog.
  if (catalogFacts.topology) {
    for (const [topo, keywords] of Object.entries(TOPOLOGY_KEYWORDS)) {
      const mentionsTopo = keywords.some((kw) => lower.includes(kw.toLowerCase()));
      if (mentionsTopo && topo !== catalogFacts.topology) {
        // The LLM said this is one topology, but the catalog says another.
        // Exception: "multibit" and "r2r" are sometimes used interchangeably.
        const interchangeable = new Set(['r2r', 'multibit']);
        if (!(interchangeable.has(topo) && interchangeable.has(catalogFacts.topology))) {
          return false;
        }
      }
    }
  }

  // ── Chip family check ──────────────────────────────
  // If the catalog architecture mentions a specific chip family,
  // reject bullets that claim a different one.
  if (catalogFacts.architecture) {
    const archLower = catalogFacts.architecture.toLowerCase();

    // Determine which chip family the catalog says this is
    let catalogChipFamily: string | null = null;
    for (const [family, keywords] of Object.entries(CHIP_KEYWORDS)) {
      if (keywords.some((kw) => archLower.includes(kw))) {
        catalogChipFamily = family;
        break;
      }
    }

    if (catalogChipFamily) {
      // Check if the LLM claims a DIFFERENT chip family
      for (const [family, keywords] of Object.entries(CHIP_KEYWORDS)) {
        if (family === catalogChipFamily) continue;
        if (keywords.some((kw) => lower.includes(kw))) {
          return false; // Claims wrong chip family
        }
      }
    }
  }

  // ── Country/origin check ───────────────────────────
  // If the LLM claims a specific national origin, it must match catalog.
  if (catalogFacts.country) {
    for (const [countryCode, keywords] of Object.entries(COUNTRY_KEYWORDS)) {
      const mentionsCountry = keywords.some((kw) => lower.includes(kw));
      if (mentionsCountry && countryCode !== catalogFacts.country) {
        return false; // Claims wrong country of origin
      }
    }
  }

  return true;
}

/** Catalog ground truth for a single product. */
interface CatalogFacts {
  architecture?: string;
  topology?: string;
  country?: string;
  brand?: string;
}

/**
 * Build a CatalogFacts lookup from the AdvisoryOption array.
 * Keyed by normalized product name.
 */
function buildCatalogFactsMap(
  products: AdvisoryOption[],
): Map<string, CatalogFacts> {
  const map = new Map<string, CatalogFacts>();
  for (const p of products) {
    const key = [p.brand, p.name].filter(Boolean).join(' ').toLowerCase();
    map.set(key, {
      architecture: p.catalogArchitecture,
      topology: p.catalogTopology,
      country: p.catalogCountry,
      brand: p.brand,
    });
  }
  return map;
}

/**
 * Validate a single field: prohibited patterns + catalog cross-reference.
 */
function validateFieldWithCatalog(
  text: string,
  facts: CatalogFacts,
): string | undefined {
  // Prohibited pattern check
  const cleaned = validateField(text);
  if (!cleaned) return undefined;

  // Catalog cross-reference check
  if (!passesCatalogCheck(cleaned, facts)) return undefined;

  return cleaned;
}

/**
 * Validate and filter LLM editorial output.
 * - Matches products to shortlist (name check)
 * - Removes bullets that contradict catalog facts
 * - Removes bullets with prohibited patterns
 */
function validateEditorial(
  editorial: ProductEditorial[],
  shortlistNames: Set<string>,
  catalogFactsMap: Map<string, CatalogFacts>,
): ProductEditorial[] {
  const validated: ProductEditorial[] = [];

  for (const item of editorial) {
    // Name must match a shortlisted product (fuzzy)
    const nameNorm = item.name.trim().toLowerCase();
    const matchesShortlist = [...shortlistNames].some(
      (n) => n.toLowerCase() === nameNorm ||
        nameNorm.includes(n.toLowerCase()) ||
        n.toLowerCase().includes(nameNorm),
    );

    if (!matchesShortlist) continue;

    // Find catalog facts for this product
    const facts: CatalogFacts = [...catalogFactsMap.entries()].find(
      ([key]) => key === nameNorm ||
        nameNorm.includes(key) ||
        key.includes(nameNorm),
    )?.[1] ?? {};

    // Validate individual fields against catalog
    const cleanStandout = item.standoutFeatures
      .map((s) => validateFieldWithCatalog(s, facts))
      .filter((s): s is string => s !== undefined);
    const cleanSound = item.soundProfile
      .map((s) => validateFieldWithCatalog(s, facts))
      .filter((s): s is string => s !== undefined);
    const cleanFit = item.systemFit
      .map((s) => validateFieldWithCatalog(s, facts))
      .filter((s): s is string => s !== undefined);
    const cleanVerdict = validateFieldWithCatalog(item.verdict, facts);

    // Only include if we got meaningful content
    if (cleanStandout.length > 0 || cleanSound.length > 0) {
      validated.push({
        name: item.name,
        standoutFeatures: cleanStandout,
        soundProfile: cleanSound,
        systemFit: cleanFit,
        verdict: cleanVerdict ?? item.verdict,
      });
    }
  }

  return validated;
}

// ── Main export ──────────────────────────────────────

/**
 * Request LLM editorial descriptions for a product shortlist.
 *
 * Returns enriched product fields, or null on any failure.
 * The caller should fire this after dispatching the deterministic
 * advisory, then merge results on success.
 */
export async function requestShoppingEditorial(
  products: AdvisoryOption[],
  context: ShoppingEditorialContext,
): Promise<ProductEditorial[] | null> {
  if (products.length === 0) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const response = await fetch('/api/memo-overlay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt: buildSystemPrompt(),
        userPrompt: buildUserPrompt(products, context),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();
    if (typeof data.content !== 'string') return null;

    const editorial = parseLlmResponse(data.content);
    if (!editorial) return null;

    // Build allowlist from shortlisted product names
    const shortlistNames = new Set(
      products.map((p) => [p.brand, p.name].filter(Boolean).join(' ')),
    );

    // Build catalog facts map for cross-reference validation
    const catalogFactsMap = buildCatalogFactsMap(products);

    const validated = validateEditorial(editorial, shortlistNames, catalogFactsMap);
    return validated.length > 0 ? validated : null;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

/**
 * Merge LLM editorial results into an existing AdvisoryOption array.
 * Matches by product name (fuzzy). Only overwrites fields that the
 * LLM provided — deterministic values remain as fallback.
 */
export function mergeEditorialIntoOptions(
  options: AdvisoryOption[],
  editorial: ProductEditorial[],
): AdvisoryOption[] {
  return options.map((opt) => {
    const fullName = [opt.brand, opt.name].filter(Boolean).join(' ').toLowerCase();

    // Find matching editorial entry
    const match = editorial.find((e) => {
      const eName = e.name.trim().toLowerCase();
      return eName === fullName ||
        fullName.includes(eName) ||
        eName.includes(fullName);
    });

    if (!match) return opt;

    return {
      ...opt,
      standoutFeatures: match.standoutFeatures.length > 0
        ? match.standoutFeatures
        : opt.standoutFeatures,
      soundProfile: match.soundProfile.length > 0
        ? match.soundProfile
        : opt.soundProfile,
      // Merge systemFit into systemDelta
      systemDelta: match.systemFit.length > 0
        ? {
          ...opt.systemDelta,
          whyFitsSystem: match.systemFit[0],
          likelyImprovements: match.systemFit.length > 1
            ? [match.systemFit[1]]
            : opt.systemDelta?.likelyImprovements,
          tradeOffs: opt.systemDelta?.tradeOffs,
        }
        : opt.systemDelta,
      fitNote: match.verdict || opt.fitNote,
    };
  });
}
