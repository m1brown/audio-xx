/**
 * DAC product catalog for shopping recommendations.
 *
 * Each product has trait scores on the 0–1 scale matching QUALITATIVE_MAP:
 *   strong = 1.0, moderate = 0.7, slight = 0.4, neutral = 0.0
 *
 * Trait values describe the component's sonic character, not quality.
 * A DAC with low clarity is not "worse" — it prioritizes something else.
 *
 * Risk traits (fatigue_risk, glare_risk) use the same scale:
 *   0.0 = no risk, 0.4 = slight risk, 0.7 = moderate risk, 1.0 = strong risk
 *
 * Retailer links are informational. Prices are approximate street prices
 * as of early 2025 and may shift. The system does not track live pricing.
 */

export interface Product {
  id: string;
  brand: string;
  name: string;
  price: number;
  category: 'dac' | 'speaker' | 'amplifier';
  architecture: string;
  traits: Record<string, number>;
  description: string;
  retailer_links: { label: string; url: string }[];
  notes?: string;
}

export const DAC_PRODUCTS: Product[] = [
  // ── Budget tier ($100–$300) ─────────────────────────

  {
    id: 'schiit-modius-e',
    brand: 'Schiit',
    name: 'Modius E',
    price: 199,
    category: 'dac',
    architecture: 'delta-sigma (AKM)',
    traits: {
      flow: 0.4,
      tonal_density: 0.4,
      clarity: 0.7,
      dynamics: 0.4,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 0.4,
      composure: 0.4,
    },
    description:
      'Clean, balanced entry point with AKM conversion. Honest rather than euphonic — a competent foundation that stays out of the way.',
    retailer_links: [
      { label: 'Schiit', url: 'https://www.schiit.com/products/modius' },
    ],
  },

  {
    id: 'smsl-do300',
    brand: 'SMSL',
    name: 'DO300',
    price: 349,
    category: 'dac',
    architecture: 'delta-sigma (ESS)',
    traits: {
      flow: 0.4,
      tonal_density: 0.4,
      clarity: 0.7,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.4,
      elasticity: 0.4,
      texture: 0.4,
      composure: 0.4,
    },
    description:
      'ESS Sabre-based design with strong measured performance. Prioritizes clarity and dynamic range over tonal warmth.',
    retailer_links: [
      { label: 'Amazon', url: 'https://www.amazon.com/dp/B0BPRL3GYX' },
      { label: 'Apos Audio', url: 'https://apos.audio/products/smsl-do300' },
    ],
    notes: 'Can lean analytical in bright systems. Pairs well with warmer amplifiers.',
  },

  // ── Mid tier ($400–$700) ────────────────────────────

  {
    id: 'topping-d70-pro-sabre',
    brand: 'Topping',
    name: 'D70 Pro SABRE',
    price: 450,
    category: 'dac',
    architecture: 'delta-sigma (ESS)',
    traits: {
      flow: 0.4,
      tonal_density: 0.4,
      clarity: 1.0,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.4,
      elasticity: 0.7,
      texture: 0.4,
      composure: 0.4,
    },
    description:
      'Dual ES9038Pro implementation emphasizing transient precision and wide dynamic range. A speed-first design.',
    retailer_links: [
      { label: 'Amazon', url: 'https://www.amazon.com/dp/B0CL5FCRPQ' },
      { label: 'Apos Audio', url: 'https://apos.audio/products/topping-d70-pro-sabre' },
    ],
    notes: 'Very explicit presentation. May feel relentless in systems already biased toward speed.',
  },

  {
    id: 'gustard-x16',
    brand: 'Gustard',
    name: 'X16',
    price: 550,
    category: 'dac',
    architecture: 'delta-sigma (ESS)',
    traits: {
      flow: 0.4,
      tonal_density: 0.4,
      clarity: 0.7,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 0.7,
      composure: 0.4,
    },
    description:
      'Well-rounded ESS implementation with good texture and detail retrieval. Less aggressive than the Topping, more neutral than the Denafrips.',
    retailer_links: [
      { label: 'Amazon', url: 'https://www.amazon.com/dp/B09RFDMZPJ' },
      { label: 'Apos Audio', url: 'https://apos.audio/products/gustard-x16' },
    ],
  },

  {
    id: 'denafrips-ares-12th-1',
    brand: 'Denafrips',
    name: 'Ares 12th-1',
    price: 600,
    category: 'dac',
    architecture: 'R-2R',
    traits: {
      flow: 0.7,
      tonal_density: 0.7,
      clarity: 0.4,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 0.7,
      composure: 0.4,
      elasticity: 0.4,
    },
    description:
      'Entry-level R-2R with strong tonal density and natural rhythmic flow. Favors body and engagement over analytical precision.',
    retailer_links: [
      { label: 'Vinshine Audio', url: 'https://www.vinshineaudio.com/product/denafrips-ares-12th-1' },
    ],
  },

  {
    id: 'schiit-bifrost-2-64',
    brand: 'Schiit',
    name: 'Bifrost 2/64',
    price: 699,
    category: 'dac',
    architecture: 'multibit',
    traits: {
      flow: 0.7,
      tonal_density: 0.7,
      clarity: 0.7,
      dynamics: 1.0,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      elasticity: 0.7,
      texture: 0.7,
      composure: 0.4,
    },
    description:
      'Multibit architecture with exceptional dynamic snap and rhythmic drive. Combines tonal weight with transient precision — an engagement-first design.',
    retailer_links: [
      { label: 'Schiit', url: 'https://www.schiit.com/products/bifrost' },
    ],
  },

  {
    id: 'topping-d90se',
    brand: 'Topping',
    name: 'D90SE',
    price: 700,
    category: 'dac',
    architecture: 'delta-sigma (ESS)',
    traits: {
      flow: 0.4,
      tonal_density: 0.4,
      clarity: 1.0,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.4,
      elasticity: 0.4,
      texture: 0.4,
      composure: 0.7,
    },
    description:
      'Reference-grade ESS Sabre implementation with very low distortion and wide bandwidth. Precision and composure over musicality.',
    retailer_links: [
      { label: 'Amazon', url: 'https://www.amazon.com/dp/B09DVCCQGP' },
      { label: 'Apos Audio', url: 'https://apos.audio/products/topping-d90se' },
    ],
    notes: 'Strengths are measured performance. Can feel clinical in systems that lack warmth upstream.',
  },

  // ── Upper-mid tier ($700–$1000) ─────────────────────

  {
    id: 'mhdt-orchid',
    brand: 'MHDT',
    name: 'Orchid',
    price: 800,
    category: 'dac',
    architecture: 'NOS tube',
    traits: {
      flow: 1.0,
      tonal_density: 0.7,
      clarity: 0.4,
      dynamics: 0.4,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 1.0,
      composure: 0.7,
      elasticity: 0.4,
    },
    description:
      'Non-oversampling tube output design prioritizing musical flow and texture. Smooths digital edges without losing rhythmic coherence.',
    retailer_links: [
      { label: 'MHDT Labs', url: 'https://www.mhdtlab.com/orchid.htm' },
    ],
    notes: 'Detail retrieval is softer than delta-sigma designs. Best paired with revealing amplifiers and speakers.',
  },

  {
    id: 'eversolo-dac-z8',
    brand: 'Eversolo',
    name: 'DAC-Z8',
    price: 799,
    category: 'dac',
    architecture: 'delta-sigma (ESS)',
    traits: {
      flow: 0.4,
      tonal_density: 0.4,
      clarity: 0.7,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 0.4,
      composure: 0.7,
      elasticity: 0.4,
    },
    description:
      'Feature-rich ESS-based DAC with balanced output, MQA decoding, and built-in headphone amplifier. Versatile and well-rounded.',
    retailer_links: [
      { label: 'Amazon', url: 'https://www.amazon.com/dp/B0DJCCBSMZ' },
      { label: 'Apos Audio', url: 'https://apos.audio/products/eversolo-dac-z8' },
    ],
  },

  // ── Serious tier ($1000–$1500) ──────────────────────

  {
    id: 'rme-adi-2-dac-fs',
    brand: 'RME',
    name: 'ADI-2 DAC FS',
    price: 1099,
    category: 'dac',
    architecture: 'delta-sigma (AKM)',
    traits: {
      flow: 0.4,
      tonal_density: 0.4,
      clarity: 1.0,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 0.7,
      composure: 1.0,
      elasticity: 0.4,
    },
    description:
      'Pro-audio heritage with parametric EQ, crossfeed, and exceptional measured performance. A precision instrument — transparent, composed, and deeply configurable.',
    retailer_links: [
      { label: 'B&H Photo', url: 'https://www.bhphotovideo.com/c/product/1543585-REG/' },
      { label: 'Amazon', url: 'https://www.amazon.com/dp/B07Y2GBLQR' },
    ],
    notes: 'The built-in parametric EQ is a significant advantage for system tuning. Not the most emotionally engaging, but extraordinarily capable.',
  },

  {
    id: 'chord-qutest',
    brand: 'Chord',
    name: 'Qutest',
    price: 1295,
    category: 'dac',
    architecture: 'FPGA',
    traits: {
      flow: 0.7,
      tonal_density: 0.4,
      clarity: 1.0,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 0.7,
      elasticity: 0.7,
      composure: 0.7,
    },
    description:
      'FPGA-based pulse array design with exceptional timing resolution and transient definition. Detail without analytical edge — fast, articulate, and composed.',
    retailer_links: [
      { label: 'Amazon', url: 'https://www.amazon.com/dp/B079C63P1V' },
    ],
  },

  {
    id: 'denafrips-pontus-ii-12th-1',
    brand: 'Denafrips',
    name: 'Pontus II 12th-1',
    price: 1499,
    category: 'dac',
    architecture: 'R-2R',
    traits: {
      flow: 1.0,
      tonal_density: 1.0,
      clarity: 0.7,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 1.0,
      composure: 0.7,
      elasticity: 0.4,
    },
    description:
      'Full-scale R-2R with rich tonal density, strong harmonic texture, and refined composure. Prioritizes body and musical weight over transient sharpness.',
    retailer_links: [
      { label: 'Vinshine Audio', url: 'https://www.vinshineaudio.com/product/denafrips-pontus-ii-12th-1' },
    ],
  },

  {
    id: 'gustard-r26',
    brand: 'Gustard',
    name: 'R26',
    price: 1499,
    category: 'dac',
    architecture: 'R-2R',
    traits: {
      flow: 0.7,
      tonal_density: 0.7,
      clarity: 0.7,
      dynamics: 0.7,
      fatigue_risk: 0.0,
      glare_risk: 0.0,
      texture: 0.7,
      composure: 0.7,
      elasticity: 0.4,
    },
    description:
      'Discrete R-2R implementation offering a balance of clarity and tonal body. Less warm than the Denafrips, more textured than delta-sigma alternatives.',
    retailer_links: [
      { label: 'Amazon', url: 'https://www.amazon.com/dp/B0BL2F62LJ' },
      { label: 'Apos Audio', url: 'https://apos.audio/products/gustard-r26' },
    ],
  },
];
