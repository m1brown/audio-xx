/**
 * System archetype — classify an active system into one of five coarse
 * classes so the advisory layer can route to the right response path
 * *before* any case-by-case brand or product-gap branching runs.
 *
 * Audio XX Playbook alignment:
 *   - §3 Preference protection — consumer-wireless speakers have no
 *     placement latitude, so they should never receive rear-wall advice.
 *   - §2 Trade-off discipline — each archetype has its own ceiling and
 *     its own set of meaningful levers (upgrade paths, remediation).
 *   - §8 Engine/Domain boundary — this module is PURE domain mapping.
 *     No engine vocabulary, no axis scoring. Consumed by page.tsx
 *     orchestrator, consultation wiring, and advisory adapters.
 *
 * Archetype layer replaces per-brand, per-product-gap edge-case branching
 * in the top-level response builder with a single classifier + lookup.
 */

// ── Consumer / lifestyle / mainstream-tech brands ─────
//
// These brands dominate general-consumer audio (wireless speakers,
// phones, voice assistants, lifestyle audio). When a user's system is
// made up solely of these, traditional audiophile remediation
// (speaker placement, interconnect grounding, tube rolling) does not
// apply and the advisor must route to a different copy variant.
const CONSUMER_BRANDS: ReadonlySet<string> = new Set([
  'sonos',
  'bose',
  'apple',
  'iphone',
  'ipad',
  'ipod',
  'airpods',
  'airpod',
  'homepod',
  'google',
  'nest',
  'amazon',
  'alexa',
  'echo',
  'beats',
  'jbl',
  'harman kardon',
  'bang & olufsen',
  'b&o',
  'sony',
  'samsung',
  'lg',
]);

/** Brands that identify a specific consumer-wireless SPEAKER (not a source). */
const CONSUMER_SPEAKER_BRANDS: ReadonlySet<string> = new Set([
  'sonos', 'bose', 'homepod', 'echo', 'nest', 'jbl', 'beats',
]);

/** Brands / devices that identify a CONSUMER SOURCE (phone, tablet, streaming box). */
const CONSUMER_SOURCE_BRANDS: ReadonlySet<string> = new Set([
  'iphone', 'ipad', 'ipod', 'airpods', 'airpod', 'apple', 'google', 'samsung',
]);

/**
 * System archetype — the primary classification that drives top-level
 * response routing. Five coarse buckets:
 *
 *   - consumer_wireless: Sonos, Bose, HomePod, AirPods, phone-as-source,
 *     or any single-box speaker system. No meaningful upstream levers;
 *     the speaker class determines the ceiling.
 *
 *   - entry_hifi: traditional amp + speakers chain at entry-level tiers.
 *     Placement, source, and component swaps all produce audible changes.
 *
 *   - resolving_hifi: traditional chain where the system is resolving
 *     enough that source/cable/placement choices dominate the result.
 *
 *   - high_end: ultra-resolving chains where trade-off discipline is
 *     paramount and "do nothing" is often the correct answer.
 *
 *   - unknown: insufficient component info to classify.
 *
 * Note: entry/resolving/high_end tier detection is driven by brand/price
 * heuristics and is intentionally conservative — unrecognized traditional
 * chains default to entry_hifi rather than over-claiming.
 */
export type SystemArchetype =
  | 'consumer_wireless'
  | 'entry_hifi'
  | 'resolving_hifi'
  | 'high_end'
  | 'unknown';

/** Back-compat alias — callers should migrate to SystemArchetype. */
export type SystemClass = SystemArchetype;

export interface SystemComponentLite {
  brand?: string;
  name?: string;
  /** Optional role hint — 'speaker', 'amp', 'integrated', 'dac', 'source', etc. */
  category?: string | null;
}

function norm(s?: string): string {
  return (s ?? '').trim().toLowerCase();
}

function isConsumerBrand(brand?: string): boolean {
  const b = norm(brand);
  if (!b) return false;
  if (CONSUMER_BRANDS.has(b)) return true;
  // Handle short prefix matches like "b&o" already in the set; otherwise
  // test token-by-token so "Apple iPhone" → apple (consumer).
  const first = b.split(/\s+/)[0];
  return CONSUMER_BRANDS.has(first);
}

// ── High-end / resolving brand heuristics ─────────────
//
// Intentionally conservative starter sets. These drive tier selection
// ONLY when an amp + speaker pattern is already present — they never
// upgrade a consumer-wireless chain into high_end.
//
// Extend these sets as the product catalog grows; unrecognized
// audiophile chains default safely to entry_hifi.

const HIGH_END_BRANDS: ReadonlySet<string> = new Set([
  'wilson audio', 'wilson', 'magico', 'rockport',
  'audio research', 'vtl', 'mcintosh', 'boulder', 'soulution',
  'dcs', 'msb', 'chord dave', 'dartzeel',
  'constellation', 'vitus', 'gryphon', 'dan dagostino',
]);

const RESOLVING_BRANDS: ReadonlySet<string> = new Set([
  'devore', 'harbeth', 'spendor', 'atc', 'proac',
  'focal', 'dynaudio', 'kef reference',
  'hegel', 'luxman', 'accuphase', 'pass labs', 'ayre',
  'chord', 'naim', 'linn', 'bryston',
  'rega', // higher-tier rega only, but starter
  'job', 'goldmund',
]);

/** Speaker-like categories — classifier looks for the amp+speaker pattern. */
const SPEAKER_CATEGORIES: ReadonlySet<string> = new Set([
  'speaker', 'speakers', 'bookshelf', 'floorstander', 'monitor',
  'loudspeaker', 'subwoofer', 'sub',
]);

/** Amp-like categories (anything that amplifies). */
const AMP_CATEGORIES: ReadonlySet<string> = new Set([
  'amp', 'amplifier', 'integrated', 'integrated_amp', 'power_amp',
  'preamp', 'pre-amp', 'pre_amp', 'tube_amp', 'receiver',
]);

function matchesBrandSet(brand: string | undefined, name: string | undefined, set: ReadonlySet<string>): boolean {
  const b = norm(brand);
  const n = norm(name);
  if (b && set.has(b)) return true;
  if (n && set.has(n)) return true;
  const firstB = b.split(/\s+/)[0];
  const firstN = n.split(/\s+/)[0];
  if (firstB && set.has(firstB)) return true;
  if (firstN && set.has(firstN)) return true;
  return false;
}

function hasCategory(c: SystemComponentLite, set: ReadonlySet<string>): boolean {
  return !!c.category && set.has(c.category.trim().toLowerCase());
}

/**
 * Primary classifier. Returns the system archetype based on component
 * provenance, role composition, and brand tier heuristics.
 *
 * Decision order:
 *   1. All-consumer OR single-box speaker-only → consumer_wireless
 *   2. Amp + speakers present:
 *      - any high-end brand → high_end
 *      - any resolving brand → resolving_hifi
 *      - else → entry_hifi
 *   3. Other traditional components (no speaker pair) → entry_hifi
 *   4. Nothing identifiable → unknown
 */
export function classifySystemArchetype(
  components: SystemComponentLite[] | undefined | null,
): SystemArchetype {
  if (!components || components.length === 0) return 'unknown';

  const consumer: SystemComponentLite[] = [];
  const other: SystemComponentLite[] = [];
  for (const c of components) {
    const isNamed = !!(c.brand || c.name);
    if (!isNamed) continue;
    if (isConsumerBrand(c.brand) || isConsumerBrand(c.name)) {
      consumer.push(c);
    } else {
      other.push(c);
    }
  }

  if (consumer.length === 0 && other.length === 0) return 'unknown';

  // 1a. All-consumer chain.
  if (consumer.length > 0 && other.length === 0) return 'consumer_wireless';

  // 1b. Single-box speaker system (one named component that IS a speaker
  //     with no amp — typical of powered / active / wireless speakers).
  if (components.length === 1) {
    const only = components[0];
    if (hasCategory(only, SPEAKER_CATEGORIES)) return 'consumer_wireless';
  }

  // 2. Amp + speakers pattern → entry / resolving / high_end.
  const hasAmp = components.some((c) => hasCategory(c, AMP_CATEGORIES));
  const hasSpeakers = components.some((c) => hasCategory(c, SPEAKER_CATEGORIES));
  const anyHighEnd = components.some((c) => matchesBrandSet(c.brand, c.name, HIGH_END_BRANDS));
  const anyResolving = components.some((c) => matchesBrandSet(c.brand, c.name, RESOLVING_BRANDS));

  if (hasAmp && hasSpeakers) {
    if (anyHighEnd) return 'high_end';
    if (anyResolving) return 'resolving_hifi';
    return 'entry_hifi';
  }

  // 3. Traditional components without a full amp+speaker pair — DAC,
  //    streamer, turntable on their own. Default to entry_hifi so the
  //    normal advisory paths run. Tier bumping still applies when a
  //    high-end / resolving brand is named.
  if (anyHighEnd) return 'high_end';
  if (anyResolving) return 'resolving_hifi';
  if (other.length > 0) return 'entry_hifi';

  // Fallback: at this point consumer > 0 and other === 0 is already
  // handled above. Anything left is unclassifiable.
  return 'unknown';
}

/**
 * Convenience: accept a list of free-text component strings (e.g.
 * "Sonos Arc", "iPhone 14", "Rega Planar 3") and classify.
 */
export function classifySystemArchetypeFromStrings(
  componentStrings: string[] | undefined | null,
): SystemArchetype {
  if (!componentStrings || componentStrings.length === 0) return 'unknown';
  const lite: SystemComponentLite[] = componentStrings.map((s) => {
    const trimmed = s.trim();
    const firstToken = trimmed.split(/\s+/)[0] ?? '';
    return { brand: firstToken, name: trimmed };
  });
  return classifySystemArchetype(lite);
}

// ── Back-compat aliases ───────────────────────────────
// Callers still import classifySystemClass / classifySystemFromStrings.
// Keep the old names working so this refactor stays scoped.

export const classifySystemClass = classifySystemArchetype;
export const classifySystemFromStrings = classifySystemArchetypeFromStrings;

/** Role inference for a single consumer component. */
export function inferConsumerRole(component: SystemComponentLite): 'speaker' | 'source' | 'accessory' | 'unknown' {
  const b = norm(component.brand);
  const n = norm(component.name);
  if (CONSUMER_SPEAKER_BRANDS.has(b) || CONSUMER_SPEAKER_BRANDS.has(n.split(/\s+/)[0])) return 'speaker';
  if (CONSUMER_SOURCE_BRANDS.has(b) || CONSUMER_SOURCE_BRANDS.has(n.split(/\s+/)[0])) return 'source';
  if (b === 'airpods' || n.includes('airpod')) return 'accessory';
  return 'unknown';
}

// ── Remediation copy for consumer-wireless systems ────
//
// Copy block returned by the adapter when the rule engine fires a
// thinness / electrical-noise rule on a consumer_wireless chain. The
// original audiophile-chain advice ("move the speakers six inches
// closer to the rear wall", "lift components to break a ground loop")
// does not apply — fixed-driver wireless speakers have no placement
// latitude and wireless sources have no grounded interconnects.

export interface ConsumerRemediation {
  explanation: string;
  suggestions: string[];
  nextStep: string;
}

export function consumerThinnessRemediation(): ConsumerRemediation {
  return {
    explanation:
      'Lifestyle wireless speakers (Sonos, HomePod, Bose, etc.) ship with fixed drivers '
      + 'in a sealed enclosure and apply automatic room correction. The "tiny" or '
      + '"bass-light" quality you hear is a function of the speaker\'s size class — '
      + 'not something that room placement or cable changes can recover.',
    suggestions: [
      'If you want real scale and bass, the usual paths are: step up to a larger model '
        + '(Sonos Arc, HomePod 2 pair, Sonos Five) or move to a stereo pair with a compact '
        + 'integrated amp.',
      'Make sure Trueplay / room-correction is actually on and ran in the current room — '
        + 'running it from a different room leaves the speaker tuned for the wrong space.',
    ],
    nextStep:
      'Decide whether you want to stay in the wireless lifestyle lane (bigger model or a '
      + 'stereo pair of the same speaker) or move to a traditional stereo setup — each has '
      + 'different cost and simplicity trade-offs.',
  };
}

export function consumerElectricalNoiseRemediation(): ConsumerRemediation {
  return {
    explanation:
      'On a wireless speaker chain, audible noise is almost always network-side '
      + '(WiFi congestion or RF interference between devices) or source-side '
      + '(a specific app or streaming service delivering a lossy or distorted signal). '
      + 'The speaker itself has very few electrical conditions that can introduce noise, '
      + 'so isolating the signal path is the fastest way to identify the cause.',
    suggestions: [
      'Check whether the noise is tied to one source: does it happen on every app '
        + '(Spotify, Apple Music, AirPlay from your phone) or only one? That isolates '
        + 'network vs source.',
      'Check WiFi strength near the speaker and whether a 2.4 GHz device (microwave, '
        + 'baby monitor, older router) is nearby — Sonos and similar speakers share that '
        + 'band and are sensitive to congestion.',
    ],
    nextStep:
      'Change one variable at a time — swap sources, then swap to a wired Ethernet '
      + 'connection if the speaker supports it — and note when the noise disappears. That '
      + 'tells you whether it is the network, the source, or the speaker itself.',
  };
}

/**
 * Short first-turn response for a consumer-wireless system.
 *
 * Per the Audio XX Playbook first-turn spec for mainstream consumer systems:
 *   1. one-sentence characterization
 *   2. one short "what this means" explanation
 *   3. one useful follow-up question
 *   4. subtle provenance — "Based on general product knowledge"
 *
 * Deliberately avoids the encyclopedic 5-section narrative the
 * deterministic audiophile pipeline produces. Also avoids the
 * LLM inferred-product path (which fires "Not from verified catalog").
 */
export interface ConsumerFirstTurn {
  title: string;
  subject: string;
  systemSignature: string;
  /** The "what this means" paragraph. */
  tendencies: string;
  /** The single follow-up question. */
  followUp: string;
  /** Soft provenance note appended to the UI. */
  provenanceNote: string;
}

/**
 * Top-level response builder for the consumer_wireless archetype.
 *
 * Spec: 3–5 sentences, practical, constraint-focused. No product
 * database disclaimers, no long explanations, no audiophile
 * terminology. This is invoked by the page-orchestrator's archetype
 * router BEFORE any inferred-product consultation, advisory logic,
 * or LLM inference path runs.
 */
export function buildConsumerWirelessResponse(
  components: SystemComponentLite[],
): ConsumerFirstTurn {
  const roles = components.map((c) => ({ c, role: inferConsumerRole(c) }));
  const speakers = roles.filter((r) => r.role === 'speaker').map((r) => r.c);
  const sources = roles.filter((r) => r.role === 'source').map((r) => r.c);

  const speakerLabel = speakers.length > 0
    ? speakers.map((s) => (s.brand ?? s.name ?? '').trim()).filter(Boolean).join(' + ')
    : null;
  const sourceLabel = sources.length > 0
    ? sources.map((s) => (s.brand ?? s.name ?? '').trim()).filter(Boolean).join(' + ')
    : null;

  // One-sentence characterization.
  let systemSignature: string;
  if (speakerLabel && sourceLabel) {
    systemSignature =
      `A ${speakerLabel} speaker driven from an ${sourceLabel} — a convenience-first `
      + `wireless setup where the speaker itself shapes most of what you hear.`;
  } else if (speakerLabel) {
    systemSignature =
      `A ${speakerLabel} wireless speaker — a convenience-first setup where the speaker `
      + `itself shapes most of what you hear.`;
  } else {
    systemSignature =
      'A consumer wireless audio setup — convenience-first, where the speaker itself '
      + 'shapes most of what you hear.';
  }

  // One short "what this means" paragraph — names the likely limits without
  // pushing the user toward a purchase and without audiophile vocabulary.
  const tendencies =
    'Because the speaker is a sealed, fixed-driver design with its own amplification '
    + 'and room correction, the usual upstream levers (source, amp, cables, placement) '
    + 'have only small effects. The likely limits are bass authority, scale, and '
    + 'headroom at higher volumes — those live with the speaker, not the source.';

  const followUp =
    'What\'s bothering you about the sound right now — bass, clarity, loudness, '
    + 'fullness, or something else?';

  const provenanceNote =
    'Based on general product knowledge of this class of system.';

  const subject = components
    .map((c) => (c.name || c.brand || '').trim())
    .filter(Boolean)
    .join(' + ') || 'your system';

  return {
    title: 'Your System',
    subject,
    systemSignature,
    tendencies,
    followUp,
    provenanceNote,
  };
}

/** Back-compat alias — callers should migrate to buildConsumerWirelessResponse. */
export const buildConsumerWirelessFirstTurn = buildConsumerWirelessResponse;

/** First-contact system assessment copy for consumer-only chains. */
export function consumerSystemIntro(
  components: SystemComponentLite[],
): { systemSignature: string; philosophy: string; tendencies: string; systemContext: string } {
  const roles = components.map((c) => ({ c, role: inferConsumerRole(c) }));
  const speakers = roles.filter((r) => r.role === 'speaker').map((r) => r.c);
  const sources = roles.filter((r) => r.role === 'source').map((r) => r.c);

  const speakerLabel = speakers.length > 0
    ? speakers.map((s) => s.brand || s.name).join(' + ')
    : null;
  const sourceLabel = sources.length > 0
    ? sources.map((s) => s.brand || s.name).join(' + ')
    : null;

  const chain = [speakerLabel, sourceLabel].filter(Boolean).join(' driven from your ');

  return {
    systemSignature:
      chain
        ? `A ${chain} — a wireless lifestyle system optimized for simplicity and whole-home use.`
        : 'A wireless lifestyle audio system.',
    philosophy:
      'Lifestyle wireless systems prioritize convenience, multi-room control, and a '
      + 'no-setup listening experience. The speaker handles amplification, DAC, room '
      + 'correction, and streaming internally, which trades fine-grained tuning for a '
      + 'consistent out-of-the-box result.',
    tendencies:
      'Typical strengths: easy setup, reliable streaming, strong voice / podcast '
      + 'intelligibility, and consistent room-to-room volume. Typical ceilings: '
      + 'limited dynamic scale, compressed bass extension on small units, and little '
      + 'benefit from cable or component swaps.',
    systemContext:
      'Works well for background listening, casual music throughout the home, and '
      + 'podcast / TV use. Less suited to critical or high-volume listening where '
      + 'scale, dynamics, and bass extension matter.',
  };
}
