/**
 * Illustrative turntable options for shopping recommendations.
 *
 * These are NOT a scored product catalog. They are practical,
 * well-regarded options organized by budget tier with dependency
 * metadata (built-in phono, cartridge included).
 *
 * Selection is by budget range and dependency state — no trait scoring.
 * Recommendations are always framed as provisional / illustrative.
 */

export interface IllustrativeTurntable {
  name: string;
  brand: string;
  price: number;
  priceCurrency?: string;
  hasBuiltInPhono: boolean;
  cartridgeIncluded: boolean;
  /** Short description of the turntable's character / strengths. */
  character: string;
  /** Default fit note shown when phono stage is not an issue. */
  fitNote: string;
  /** Alternative fit note shown when user's phono stage is absent. */
  phonoAbsentNote: string;
}

export const TURNTABLE_OPTIONS: IllustrativeTurntable[] = [
  // ── Budget tier: under $500 ──────────────────────────
  {
    name: 'Rega Planar 1 Plus',
    brand: 'Rega',
    price: 475,
    hasBuiltInPhono: true,
    cartridgeIncluded: true,
    character: 'Rhythmic coherence, simple design, built-in phono stage.',
    fitNote:
      'Built-in phono stage and Rega Carbon cartridge. Strong rhythmic coherence at this price. ' +
      'Trade-off: the built-in phono limits future upgradability.',
    phonoAbsentNote:
      'Built-in phono stage — directly relevant since you don\'t have one. ' +
      'Rega\'s timing and rhythmic coherence are strong at this price. ' +
      'Trade-off: the built-in phono limits future upgradability.',
  },
  {
    name: 'Pro-Ject Debut Carbon EVO',
    brand: 'Pro-Ject',
    price: 500,
    hasBuiltInPhono: false,
    cartridgeIncluded: true,
    character: 'Carbon-fiber tonearm, good speed stability, balanced presentation.',
    fitNote:
      'Carbon-fiber tonearm, good speed stability, ships with Sumiko Rainier cartridge. ' +
      'A well-balanced entry that doesn\'t impose strong coloration.',
    phonoAbsentNote:
      'Carbon-fiber tonearm, good speed stability, ships with Sumiko Rainier. ' +
      'Well-balanced but has no built-in phono — you\'d need to budget a phono stage separately.',
  },
  {
    name: 'Audio-Technica AT-LPW50PB',
    brand: 'Audio-Technica',
    price: 400,
    hasBuiltInPhono: false,
    cartridgeIncluded: true,
    character: 'Carbon-fiber tonearm, fully manual, good value.',
    fitNote:
      'Carbon-fiber tonearm, VM95E cartridge, fully manual. Good mechanical platform for the price.',
    phonoAbsentNote:
      'Carbon-fiber tonearm, VM95E cartridge, fully manual. At $400 it leaves room ' +
      'in the budget for a standalone phono stage (Schiit Mani, iFi Zen Phono).',
  },

  // ── Mid tier: $500–$1500 ─────────────────────────────
  {
    name: 'Rega Planar 3',
    brand: 'Rega',
    price: 1095,
    hasBuiltInPhono: false,
    cartridgeIncluded: true,
    character: 'Timing, pace, and musical coherence. A long-standing reference at its price.',
    fitNote:
      'RB330 tonearm, Elys 2 cartridge. Strong timing and musical coherence — ' +
      'Rega\'s design philosophy prioritizes rhythmic integrity over feature count.',
    phonoAbsentNote:
      'RB330 tonearm, Elys 2 cartridge. Excellent rhythmic coherence. ' +
      'No built-in phono — budget a separate phono stage (Rega Fono Mini A2, Hagerman Bugle).',
  },
  {
    name: 'Pro-Ject X2 B',
    brand: 'Pro-Ject',
    price: 1299,
    hasBuiltInPhono: false,
    cartridgeIncluded: true,
    character: 'Balanced 9cc carbon-fiber tonearm, low-resonance chassis.',
    fitNote:
      '9cc carbon-fiber tonearm, balanced output option, Pick IT S2 cartridge. ' +
      'Quieter mechanical platform than the Debut line.',
    phonoAbsentNote:
      '9cc carbon-fiber tonearm, balanced output option. Very capable mechanical platform. ' +
      'No built-in phono — plan for a separate phono stage.',
  },
  {
    name: 'Technics SL-1500C',
    brand: 'Technics',
    price: 1200,
    hasBuiltInPhono: true,
    cartridgeIncluded: true,
    character: 'Direct drive, built-in phono, solid engineering.',
    fitNote:
      'Direct-drive motor, built-in phono stage, Ortofon 2M Red cartridge. ' +
      'Technics engineering with a focus on speed stability and low wow/flutter.',
    phonoAbsentNote:
      'Direct-drive motor with built-in phono stage — solves the phono issue directly. ' +
      'Ortofon 2M Red cartridge included. Strong speed stability.',
  },

  // ── Upper tier: $1500–$3000 ──────────────────────────
  {
    name: 'Rega Planar 6',
    brand: 'Rega',
    price: 1995,
    hasBuiltInPhono: false,
    cartridgeIncluded: true,
    character: 'Ceramic platter, RB330 tonearm, refined Rega timing.',
    fitNote:
      'Ceramic platter, RB330 tonearm, Ania MC cartridge. Rega\'s emphasis on timing ' +
      'and musical flow, refined with better materials and isolation.',
    phonoAbsentNote:
      'Ceramic platter, Ania MC cartridge. A serious step up in Rega\'s range. ' +
      'No built-in phono — at this level, a quality standalone phono stage is recommended.',
  },
  {
    name: 'VPI Player',
    brand: 'VPI',
    price: 1500,
    hasBuiltInPhono: true,
    cartridgeIncluded: true,
    character: 'American-made, built-in phono/headphone amp, JMW tonearm.',
    fitNote:
      'JMW tonearm, built-in phono and headphone amp, Ortofon 2M Red. ' +
      'VPI\'s entry point with their signature tonearm design.',
    phonoAbsentNote:
      'Built-in phono and headphone amp — addresses the phono need directly. ' +
      'JMW tonearm is well-regarded. A good all-in-one vinyl front end.',
  },
];

/**
 * Select up to `count` turntable options for the given budget,
 * preferring built-in-phono models when the user lacks a phono stage.
 */
export function selectTurntableExamples(
  budgetAmount: number | null,
  phonoAbsent: boolean,
  count: number = 3,
): IllustrativeTurntable[] {
  // No budget → show budget-tier options as a sensible default
  const effectiveBudget = budgetAmount ?? 500;

  // Allow 20% over budget for borderline options
  const ceiling = effectiveBudget * 1.2;

  const eligible = TURNTABLE_OPTIONS.filter((t) => t.price <= ceiling);

  if (eligible.length === 0) {
    // Budget is below all known options — return the cheapest available
    const sorted = [...TURNTABLE_OPTIONS].sort((a, b) => a.price - b.price);
    return sorted.slice(0, count);
  }

  // Sort: prefer built-in-phono when phono is absent, then by proximity to budget
  const scored = eligible.map((t) => {
    let score = 0;
    // Prefer options closer to but not exceeding the budget
    score += (1 - Math.abs(t.price - effectiveBudget) / effectiveBudget) * 10;
    // Bonus for built-in phono when user needs it
    if (phonoAbsent && t.hasBuiltInPhono) score += 5;
    // Small bonus for cartridge included (almost all have this, but just in case)
    if (t.cartridgeIncluded) score += 1;
    return { turntable: t, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, count).map((s) => s.turntable);
}
