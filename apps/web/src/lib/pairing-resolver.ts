/**
 * Audio XX — Cross-Category Pairing Intent (Phase 3).
 *
 * Why this exists:
 *   Specialist queries like "DeVore O/96 amplifier pairing" and "Cube
 *   Audio Nenuphar amp matching" name a speaker AND ask about the
 *   amplifier category. Today they route to category=amplifier shopping
 *   with no upstream speaker context, and the response falls back to
 *   a generic budget-tier amp suggestion that has nothing to do with
 *   the speaker.
 *
 *   This module is a minimum-scope adapter. It detects the pairing-
 *   intent shape, resolves the named anchor product, and produces a
 *   structured pairing record that downstream renderers can surface.
 *   It does NOT replace the recommendation pipeline; it produces an
 *   additional `pairing` payload alongside the existing intent result.
 *
 * Scope (smallest safe):
 *   - Pattern recognition for "<speaker> amplifier pairing/matching".
 *   - Authored per-speaker canonical amp partners for the half-dozen
 *     speakers where the pairing tradition is well-known (DeVore O/96,
 *     Cube Audio Nenuphar, Harbeth Compact 7, Klipsch Heritage, etc.).
 *   - Topology-rule fallback when an authored entry is missing: use
 *     the speaker's sensitivity to pick a partner topology family.
 *
 * Deferred:
 *   - Full graph of every cross-category pairing (amp ↔ DAC ↔ source).
 *   - Per-product detail beyond the canonical-partner short list.
 *   - UI rendering surface (this module emits a structured payload that
 *     a renderer integration step can consume separately).
 */

import type { TopologyId } from './topology-philosophy';

export interface PairingRecommendation {
  /** Brand of the recommended amplifier (catalog form). */
  brand: string;
  /** Specific model when authored; null for brand-only canonical pairings. */
  model: string | null;
  /** Topology family the recommendation exemplifies. */
  topology: TopologyId | null;
  /** One-sentence rationale tying the pairing to the speaker. */
  rationale: string;
}

export type PairingDirection = 'speaker_amp' | 'speaker_source';

export interface PairingIntent {
  /** What the user named — the anchor product the pairing is for. */
  anchorBrand: string;
  anchorName: string;
  /** Which category they're asking about pairing with. */
  pairedCategory: 'amplifier' | 'dac' | 'source';
  /** Direction (speaker→amp is the dominant case). */
  direction: PairingDirection;
  /** Ordered list of recommended pairings; first entry is the strongest. */
  recommendations: ReadonlyArray<PairingRecommendation>;
  /** Provenance: 'authored' (curated capsule) or 'topology-rule' (inferred from sensitivity). */
  source: 'authored' | 'topology-rule';
}

interface AnchorCapsule {
  /** Normalized form: lowercase brand + " " + name, used for substring match. */
  key: string;
  brand: string;
  name: string;
  pairings: ReadonlyArray<PairingRecommendation>;
}

// Authored pairing capsules. Specialist-register rationales — each one
// should read like a recommendation an experienced listener would actually
// make. No "audiophiles love it" or "amazing synergy" prose.
const ANCHOR_PAIRINGS: ReadonlyArray<AnchorCapsule> = [
  {
    key: 'devore o/96',
    brand: 'DeVore Fidelity',
    name: 'Orangutan O/96',
    pairings: [
      {
        brand: 'Leben',
        model: 'CS600X',
        topology: 'push-pull-tube',
        rationale: 'Canonical pairing. The CS600X push-pull topology preserves DeVore\'s tonal density without overdoing it; ~32 W is more than the 96-dB speaker ever needs.',
      },
      {
        brand: 'Air Tight',
        model: 'ATM-1S',
        topology: 'push-pull-tube',
        rationale: 'Japanese push-pull with the same restraint as Leben but more grip on the upper bass. Frequently paired in the Twittering Machines reference rotation.',
      },
      {
        brand: 'Shindo',
        model: 'Cortese',
        topology: 'set',
        rationale: 'SET on a 96-dB wide-baffle works inside an apartment but can feel tonally over-rich at higher volumes. The classic SET-leaning O/96 voicing if the rest of the chain is lean.',
      },
      {
        brand: 'ampsandsound',
        model: 'Stereo 17',
        topology: 'push-pull-tube',
        rationale: 'Boutique US push-pull with slightly more bottom-end authority than Leben; complementary if the room is large or the listener wants more macrodynamics.',
      },
    ],
  },
  {
    key: 'cube audio nenuphar',
    brand: 'Cube Audio',
    name: 'Nenuphar Mini (Nendo)',
    pairings: [
      {
        brand: 'Yamamoto',
        model: 'A-08S',
        topology: 'set',
        rationale: '93–94 dB single-driver with a benign impedance curve is the SET\'s natural partner. The 45-triode 2 W is enough at moderate apartment levels.',
      },
      {
        brand: 'First Watt',
        model: 'SIT-3',
        topology: 'class-a-solid-state',
        rationale: 'SIT single-ended solid-state — Nelson Pass\'s low-power triode-adjacent design. Drives Nenuphar with more control than SET, fewer ergonomic concerns than tubes.',
      },
      {
        brand: 'ampsandsound',
        model: 'Mogwai SE',
        topology: 'set',
        rationale: 'Push-pull-tube alternative if SET feels too colored. Still low-power and high-resolution; better for full-range orchestral material than 2 W SET.',
      },
      {
        brand: 'Bottlehead',
        model: 'Stereomour II (300B)',
        topology: 'set',
        rationale: 'DIY-friendly 300B SET — culturally aligned with Cube Audio\'s single-driver philosophy. ~8 W gives more headroom than 45 SET.',
      },
    ],
  },
  {
    key: 'harbeth compact 7',
    brand: 'Harbeth',
    name: 'Compact 7ES-3 XD',
    pairings: [
      {
        brand: 'Leben',
        model: 'CS600X',
        topology: 'push-pull-tube',
        rationale: 'BBC-tradition speaker with BBC-tradition amplifier voicing. The push-pull tube body and Harbeth RADIAL midrange align; the speaker\'s 86 dB sensitivity gives the 32 W amp enough headroom.',
      },
      {
        brand: 'PrimaLuna',
        model: 'EVO 300 Integrated',
        topology: 'push-pull-tube',
        rationale: 'Mainstream-accessible push-pull tube; tube-rolling (KT77 / KT88 / EL34) lets the listener tune the Harbeth\'s warmth/clarity balance without a component change.',
      },
      {
        brand: 'Hegel',
        model: 'H190',
        topology: null,
        rationale: 'Solid-state push for listeners who want the Harbeth midrange with more upper-bass control than tubes offer.',
      },
    ],
  },
  {
    key: 'klipsch heresy',
    brand: 'Klipsch',
    name: 'Heresy IV',
    pairings: [
      {
        brand: 'Leben',
        model: 'CS300X',
        topology: 'push-pull-tube',
        rationale: '99-dB horn-loaded speaker on a 12 W push-pull is plenty loud at any reasonable listening distance. The CS300X is the Heritage-line\'s most consistent match.',
      },
      {
        brand: 'Decware',
        model: 'SE84UFO',
        topology: 'set',
        rationale: 'High-efficiency horn into a 2 W SET — the canonical low-power-tube Heritage pairing. Restrains the Heresy\'s forward presence-band lift.',
      },
      {
        brand: 'Cary Audio',
        model: 'CAD-300B',
        topology: 'set',
        rationale: '300B SET on a 99-dB horn is a classic combination — tonal density and harmonic richness without sacrificing dynamic range.',
      },
    ],
  },
];

// Topology-rule fallback table by speaker sensitivity band.
const SENSITIVITY_FALLBACK: ReadonlyArray<{
  minDb: number;
  topologies: ReadonlyArray<TopologyId>;
  note: string;
}> = [
  {
    minDb: 100,
    topologies: ['set', 'horn-high-efficiency'],
    note: '100 dB+ sensitivity is single-ended-triode territory — 2–8 W SET is enough at any apartment volume.',
  },
  {
    minDb: 93,
    topologies: ['set', 'push-pull-tube', 'class-a-solid-state'],
    note: '93–99 dB sensitivity opens up SET and low-power push-pull options; 25–32 W is the upper bound of useful power.',
  },
  {
    minDb: 88,
    topologies: ['push-pull-tube', 'class-a-solid-state', 'low-feedback'],
    note: '88–92 dB sensitivity calls for push-pull tube (30–60 W) or Class A solid-state — SET will not have enough authority.',
  },
  {
    minDb: 82,
    topologies: ['class-a-solid-state', 'low-feedback'],
    note: 'Sub-88 dB sensitivity asks for solid-state authority. Class A or low-feedback solid-state preserves tonal density without giving up control.',
  },
];

// Patterns that indicate a pairing intent. All require a SPEAKER name to
// be detected separately; this regex just confirms the user is asking
// about cross-category pairing rather than just naming the speaker alone.
const PAIRING_INTENT_RE = /\b(?:amp(?:lifier)?|amplification)\s+(?:pair(?:ing)?s?|match(?:ing)?|partner(?:s|ing)?|suggestion(?:s)?|to\s+pair|to\s+match|recommendation)\b/i;
const REVERSE_PAIRING_RE = /\b(?:pair(?:ing)?s?|match(?:ing)?|partner(?:s|ing)?)\s+(?:an?\s+)?(?:amp(?:lifier)?|amplification)\b/i;
// Verb-phrase form: "what amp should I pair with X" / "pair with X" /
// "amp(lifier) for X" / "what to pair with X"
const VERB_PAIRING_RE = /\b(?:what\s+amp(?:lifier)?\s+(?:should|to|for|do|would|might)|pair\s+(?:with|to)|to\s+pair\s+with|drive|match\s+(?:with|to)|amp(?:lifier)?\s+for|drive\s+(?:a|an|my)\b)/i;
const DAC_PAIRING_RE = /\b(?:dac|source|streamer)\s+(?:pair(?:ing)?s?|match(?:ing)?|partner(?:s|ing)?)\b/i;

function findAnchorCapsule(text: string): AnchorCapsule | null {
  const lower = text.toLowerCase();
  for (const c of ANCHOR_PAIRINGS) {
    if (lower.includes(c.key)) return c;
  }
  return null;
}

/**
 * Detect a cross-category pairing intent in the user's message.
 *
 * Returns a PairingIntent when:
 *   1. The message contains a pairing-shape phrase (amp pairing / match / partner).
 *   2. AND a recognized speaker anchor is mentioned (authored capsule).
 *
 * Returns null when either condition fails. Callers should fall back to
 * the standard shopping flow when null is returned.
 *
 * The topology-rule fallback (sensitivity → topology family) requires a
 * sensitivity number from the catalog; that integration is handled at
 * the shopping-pipeline level once the speaker is resolved from the
 * product catalog. This module only handles the authored capsule path.
 */
export function detectPairingIntent(text: string): PairingIntent | null {
  if (!text || text.length < 6) return null;
  const isAmpPairing = PAIRING_INTENT_RE.test(text) || REVERSE_PAIRING_RE.test(text) || VERB_PAIRING_RE.test(text);
  const isDacPairing = DAC_PAIRING_RE.test(text);
  if (!isAmpPairing && !isDacPairing) return null;
  const anchor = findAnchorCapsule(text);
  if (!anchor) return null;
  return {
    anchorBrand: anchor.brand,
    anchorName: anchor.name,
    pairedCategory: isAmpPairing ? 'amplifier' : 'dac',
    direction: isAmpPairing ? 'speaker_amp' : 'speaker_source',
    recommendations: anchor.pairings,
    source: 'authored',
  };
}

/**
 * For renderers that want a tight prose summary of the pairing intent.
 * Pure formatter; no side effects.
 */
export function buildPairingSummary(intent: PairingIntent): string {
  const opener = `${intent.anchorBrand} ${intent.anchorName} ${intent.pairedCategory === 'amplifier' ? 'amplifier' : 'source'} pairings (${intent.source}):`;
  const lines = intent.recommendations.slice(0, 4).map((r, i) => {
    const model = r.model ? ` ${r.model}` : '';
    const topoNote = r.topology ? ` [${r.topology}]` : '';
    return `${i + 1}. ${r.brand}${model}${topoNote} — ${r.rationale}`;
  });
  return [opener, ...lines].join('\n');
}

/**
 * Topology-rule fallback. Given a speaker sensitivity in dB, return the
 * preferred amplifier topology families. Used by callers when the user
 * named a speaker the authored capsules don't cover.
 */
export function topologyFamiliesForSensitivity(sensitivityDb: number): {
  topologies: ReadonlyArray<TopologyId>;
  note: string;
} | null {
  if (!Number.isFinite(sensitivityDb)) return null;
  for (const band of SENSITIVITY_FALLBACK) {
    if (sensitivityDb >= band.minDb) {
      return { topologies: band.topologies, note: band.note };
    }
  }
  return null;
}

/** Diagnostic accessor. */
export function listAnchorKeys(): ReadonlyArray<string> {
  return ANCHOR_PAIRINGS.map((c) => c.key);
}
