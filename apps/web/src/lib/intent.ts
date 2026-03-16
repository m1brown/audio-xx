/**
 * Intent detection layer.
 *
 * Runs BEFORE the evaluation engine to determine how the system
 * should respond. This prevents gear inquiries, shopping questions,
 * and comparisons from falling into the diagnostic/symptom workflow.
 *
 * Supported intents:
 *   1. gear_inquiry  — "What do you think of Denafrips?"
 *   2. shopping       — "Best DAC under $1000"
 *   3. comparison     — "Denafrips vs Chord"
 *   4. diagnosis      — "My system sounds bright" (default)
 */

// ── Intent type ──────────────────────────────────────

export type UserIntent = 'gear_inquiry' | 'shopping' | 'comparison' | 'diagnosis' | 'system_assessment' | 'consultation_entry' | 'cable_advisory' | 'product_assessment' | 'audio_knowledge' | 'audio_assistant';

/** A desire the user has expressed — "want more speed", "wish it had warmth". */
export interface DesireSignal {
  /** The quality the user wants to change. */
  quality: string;
  /** Direction: 'more' or 'less'. */
  direction: 'more' | 'less';
  /** The raw phrase that was matched. */
  raw: string;
}

/** A subject extracted from user text, tagged by kind. */
export interface SubjectMatch {
  name: string;
  kind: 'brand' | 'product';
  /** True when the brand appears inside parentheses as a clarification,
   *  e.g. "Job (Goldmund)" — Goldmund is a manufacturer note, not a component. */
  parenthetical?: boolean;
}

export interface IntentResult {
  intent: UserIntent;
  /** Gear names or brands extracted from the message, if any. */
  subjects: string[];
  /** Structured subject matches with brand/product distinction. */
  subjectMatches: SubjectMatch[];
  /** Desired changes the user mentioned, if any. */
  desires: DesireSignal[];
}

// ── Known brands / product names ─────────────────────

/** Brand / manufacturer names — not specific models. */
const BRAND_NAMES = [
  // DAC / digital / streamers
  'denafrips', 'chord', 'schiit', 'topping', 'smsl', 'gustard',
  'holo', 'holo audio', 'benchmark', 'rme', 'mytek', 'weiss',
  'mola mola', 'rockna', 'aqua', 'lampizator', 'lampi',
  'border patrol', 'metrum', 'audio-gd', 'soekris',
  'musician', 'okto', 'eversolo', 'wiim', 'laiv', 'fiio',
  'audalytic', 'totaldac', 'total dac', 'dcs', 'oppo',
  // Speakers
  'wlm', 'harbeth', 'devore', 'zu', 'zu audio', 'klipsch', 'focal', 'boenicke',
  'kef', 'b&w', 'bowers', 'dynaudio', 'wilson', 'magico',
  'sonus faber', 'proac', 'spendor', 'atc', 'tannoy',
  'magnepan', 'martin logan', 'quad',
  'cube audio', 'hornshoppe', 'qualio', 'totem',
  // Amplifiers
  'pass labs', 'first watt', 'naim', 'luxman', 'accuphase',
  'parasound', 'hegel', 'mcintosh', 'marantz', 'yamaha',
  'shindo', 'leben', 'audio note',
  'line magnetic', 'primaluna', 'cary', 'arc', 'audio research',
  'job', 'goldmund', 'crayon', 'xsa', 'trends', 'trends audio',
  // Turntables / tonearms / cartridges
  'rega', 'pro-ject', 'technics', 'clearaudio', 'vpi',
  'linn', 'thorens', 'michell', 'michell engineering',
  'sorane', 'ortofon', 'emt',
  // DAC brands
  'auralic',
  // Phono stages
  'aurorasound',
  // Headphones / IEMs
  'sennheiser', 'sony', 'audio-technica', 'beyerdynamic',
  'hifiman', 'audeze', 'shure', 'etymotic',
  'moondrop', 'apple',
];

/**
 * Specific product / model names.
 *
 * IMPORTANT: Sorted longest-first so that compound names like 'hugo tt2'
 * match before their shorter substrings ('hugo', 'tt2'). The entity
 * resolver relies on this ordering to guarantee exact-match priority.
 */
const PRODUCT_NAMES = [
  // ── Compound names first (longest match wins) ──────
  'hugo tt2', 'hugo tt', 'hugo 2',
  'dmp-a6', 'dmp-a8', 'dac-z8',
  'wiim ultra', 'wiim pro',
  'harmony dac', 'udac',
  'ares 12th-1', 'ares ii', 'pontus ii', 'pontus 12th-1',
  'terminator ii', 'd1-twelve', 'd1-unity', 'd1-tube',
  'x26 pro', 'su-9', 'd90',
  'k9 pro', 'ef400',
  'dr70',
  'auralic vega', 'hegel rost', 'marantz 2220b', 'oppo opdv971h',
  'job integrated', 'job int',
  'leben cs600x', 'leben cs600', 'leben cs300x', 'leben cs300', 'leben cs-300',
  'may kte', 'holo may',
  'srda', 'cia-1', 'cia-1t', 'ta-10', 'trends ta-10',
  'vanguard', 'rost', 'vega', '2220b', 'opdv971h', 'cs600x', 'cs600', 'cs300x', 'cs300',
  'diva monitor', 'super hl5', 'dirty weekend', 'hornshoppe horn', 'hornshoppe horns',
  // Turntable / tonearm / cartridge / phono products
  'gyro se', 'gyrodec', 'sa1.2',
  'spu mono', 'spu classic', '2m black', '2m bronze',
  'hsd 006', 'zu/dl-103',
  'vida mk.ii', 'vida mk.2', 'vida mkii', 'vida',
  'eq-100',
  // Headphones
  'hd 800 s', 'hd 800', 'hd 650', 'hd 600',
  'airpods pro 2', 'airpods pro',
  'wh-1000xm5', 'wh-1000xm4',
  'ath-m50xbt2', 'ath-m50x',
  'edition xs',
  // Turntables
  'planar 10', 'planar 8', 'planar 6', 'planar 3',
  'sl-1200', 'sl-1500c', 'sl-1210',
  'la voce', 'adi-2',
  'x2 b',
  'aria 2', 'blessing 3', 'aonic 3',
  // ── Single-token names ─────────────────────────────
  'spring', 'may', 'cyan', 'ares', 'pontus', 'venus', 'terminator',
  'bifrost', 'gungnir', 'yggdrasil', 'modi', 'modius',
  'qutest', 'hugo', 'dave', 'mojo', 'tt2',
  'dac3', 'dac4', 'brooklyn', 'tambaqui',
  'wavelight', 'wavedream', 'formula', 'bartók', 'bartok',
  'pavane', 'adagio', 'pegasus', 'aquarius', 'draco', 'dac8',
  'diva',
  'p3esr', 'orangutan', 'o/96', 'o96',
  'heresy', 'kanta', 'aria',
  'w5', 'w8', 'w11',
  'x8',
  'momentum 4',
  'er2xr', 'er2se',
  'kato',
  'sundara',
];

/** Combined list for backward-compatible subject extraction. */
const ALL_KNOWN_NAMES = [...BRAND_NAMES, ...PRODUCT_NAMES];

// ── Cable intent patterns ────────────────────────────
// Detects cable-focused queries — speaker cables, interconnects, RCAs, etc.
// Must be checked before shopping to route into the structured cable advisory.

const CABLE_INTENT_PATTERNS = [
  /\bspeaker\s+cables?\b/i,
  /\brca\s+cables?\b/i,
  /\binterconnects?\b/i,
  /\bpower\s+(?:cord|cable)s?\b/i,
  /\busb\s+cables?\b/i,
  /\bdigital\s+cables?\b/i,
  /\bxlr\s+cables?\b/i,
  /\banalog\s+cables?\b/i,
  /\bcabling\b/i,
  /\bcable\s+(?:recommendation|suggestion|advice|upgrade)\b/i,
  /\b(?:best|good|recommend)\b.*\bcables?\b/i,
  /\bcables?\s+for\b/i,
];

// ── Comparison patterns ──────────────────────────────

const COMPARISON_PATTERNS = [
  /\bvs\.?\b/i,
  /\bversus\b/i,
  /\bcompare[ds]?\b/i,
  /\bcomparison\b/i,
  /\bbetween\b.*\band\b/i,
  /\bdifference[s]?\s+between\b/i,
  /\bor\b.*\bfor\b/i,          // "Bifrost or Pontus for my system"
  /\bhow\s+(?:does|do)\b.*\bcompare\b/i,
  // ── Upgrade / replacement patterns ─────────────────
  // "upgrade from X to Y", "replace X with Y", "swap X for Y"
  /\bupgrade\s+(?:from|my)\b/i,
  /\breplace\s+(?:my|the|a)\b.*\bwith\b/i,
  /\bswap\s+(?:my|the|a)\b.*\b(?:for|with|to)\b/i,
  /\bchange\s+(?:from|my)\b.*\bto\b/i,
  /\bmove\s+(?:from|up\s+from)\b.*\bto\b/i,
  /\bwhat\s+would\b.*\b(?:upgrade|change|swap|switch|move)\b/i,
];

// ── Shopping patterns ────────────────────────────────

const SHOPPING_PATTERNS = [
  /\bbest\b/i,
  /\brecommend(?:ation)?s?\b/i,
  /\blooking\s+for\b/i,
  /\bshould\s+i\s+(?:get|buy|pick)\b/i,
  /\bwhat\s+(?:dac|amp|amplifier|speaker|headphone|streamer|cable)\b/i,
  /\bunder\s+\$\d/i,
  /\bbudget\b.*\b(?:dac|amp|speaker|headphone|streamer)\b/i,
  /\b(?:dac|amp|speaker|headphone|streamer)\b.*\bbudget\b/i,
  /\bfor\s+(?:speed|warmth|detail|clarity|dynamics|punch|flow)\b/i,
  /\bwhat\s+would\s+you\s+suggest\b/i,
  /\bany\s+suggestions\b/i,
  /\bwhat\s+should\s+i\b/i,
  /\bgood\s+(?:dac|amp|amplifier|speaker|headphone|streamer)\b/i,
  /\b(?:dac|amp|amplifier|integrated|speaker|headphone|streamer)\s+(?:for|that)\b/i,
  /\bgood\s+integrated\b/i,
  /\bbest\s+integrated\b/i,
];

// ── Gear inquiry patterns ────────────────────────────

const GEAR_INQUIRY_PATTERNS = [
  /\bwhat\s+do\s+you\s+think\s+(?:of|about)\b/i,
  /\bthoughts\s+on\b/i,
  /\bopinion[s]?\s+on\b/i,
  /\bwhat\s+are\s+your\s+thoughts\b/i,
  /\bhow\s+(?:good|would you rate)\b/i,
  /\bis\s+(?:the|a|an)\s+.+\s+(?:good|worth|any\s+good)\b/i,
  /\bany\s+experience\s+with\b/i,
  /\bhave\s+you\s+heard\b/i,
  /\bknow\s+anything\s+about\b/i,
  /\btell\s+me\s+about\b/i,
  /\bwhat\s+(?:is|are)\s+(?:the\s+)?(?:character|sound|signature|house sound)\b/i,
  /\bhow\s+(?:does|do)\s+(?:the\s+)?(?:\w+\s+)?sound\b/i,
];

// ── Product assessment patterns ──────────────────────
// Detect when a user is asking about a specific product's fit in their
// system — "I'm considering the X", "would X work", "is X a good fit",
// "what about the X" (in a shopping/system context).
// These take priority over shopping when a specific product is named.

const PRODUCT_ASSESSMENT_PATTERNS = [
  /\bi(?:'m| am)\s+considering\b/i,
  /\bi(?:'m| am)\s+(?:looking at|eyeing|interested in)\s+(?:the\s+|a\s+)?/i,
  /\bwould\s+(?:the\s+|a\s+)?.+\s+(?:work|fit|match|pair|improve|help)\b/i,
  /\bis\s+(?:the\s+|a\s+)?.+\s+(?:a\s+good\s+fit|worth\s+it|worthwhile|a\s+worthwhile)\b/i,
  /\bis\s+(?:the\s+|a\s+)?.+\s+(?:an?\s+)?(?:upgrade|improvement|step\s+up|downgrade)\b/i,
  /\bwhat\s+about\s+(?:the\s+|a\s+)?/i,
  /\bhow\s+would\s+(?:the\s+|a\s+)?.+\s+(?:work|fit|pair|sound|behave|perform)\b/i,
  /\bshould\s+i\s+(?:go\s+(?:for|with)|try|consider|get|switch\s+to)\s+(?:the\s+|a\s+)?/i,
  /\bshould\s+i\s+switch\s+(?:from\b|to\b)/i,
  /\bthinking\s+(?:about|of)\s+(?:getting|trying|picking up|going with|switching\s+to)\b/i,
  /\bcurious\s+about\s+(?:the\s+|a\s+)?/i,
];

// ── System assessment patterns ────────────────────────
// These signal a system-level evaluation request, distinct from diagnosis.
// Requires ownership language + assessment intent; no listening complaint.

const SYSTEM_ASSESSMENT_PATTERNS = [
  /\bassess(?:ment)?\s+(?:of\s+)?(?:my|the)\s+(?:current\s+)?(?:system|setup|rig|chain)\b/i,
  /\bevaluat(?:e|ion)\s+(?:of\s+)?(?:my|the)\s+(?:current\s+)?(?:system|setup|rig|chain)\b/i,
  /\bwhat\s+do\s+you\s+think\s+(?:of|about)\s+my\s+(?:current\s+)?(?:system|setup|rig|chain)\b/i,
  /\bwhat\s+do\s+you\s+think\b/i,  // Broad — requires ownership + subjects gate in detectIntent
  /\bthoughts\s+on\s+my\s+(?:current\s+)?(?:system|setup|rig|chain)\b/i,
  /\bhow\s+does\s+(?:my|this|the)\s+(?:system|setup|rig|chain)\s+(?:look|seem|stack\s+up)\b/i,
  /\breview\s+(?:of\s+)?my\s+(?:current\s+)?(?:system|setup|rig|chain)\b/i,
  /\bopinion\s+on\s+my\s+(?:current\s+)?(?:system|setup|rig|chain)\b/i,
  /\bhow\s+does\s+(?:this|that)\s+(?:look|sound|work)\b/i,  // "how does this look?"
];

/** Broader system guidance patterns — user wants help with their system
 *  but may not use "assessment" or "evaluate" specifically. */
const SYSTEM_GUIDANCE_PATTERNS = [
  ...SYSTEM_ASSESSMENT_PATTERNS,
  /\bsuggestions?\s+(?:on|for)\s+(?:areas?\s+to\s+)?(?:upgrade|improve|change)\b/i,
  /\bhelp\s+(?:me\s+)?(?:improve|upgrade|optimize)\s+(?:my\s+)?(?:system|setup|rig|chain)\b/i,
  /\bwhat\s+(?:should|would|could)\s+i\s+(?:upgrade|improve|change)\b/i,
  /\bwhere\s+(?:should|would|could)\s+i\s+(?:upgrade|improve|start)\b/i,
  /\bareas?\s+to\s+(?:upgrade|improve|focus\s+on)\b/i,
  /\bnext\s+(?:step|upgrade|move)\s+for\s+(?:my\s+)?(?:system|setup|rig)\b/i,
  /\badvice\s+(?:on|for|about)\s+(?:my\s+)?(?:system|setup|rig|chain)\b/i,
];

/** Ownership language — indicates user is describing components they own. */
const OWNERSHIP_PATTERNS = [
  /\bi\s+have\b/i,
  /\bmy\s+(?:current\s+)?(?:system|setup|rig|chain)\b/i,
  /\bi(?:'m|\s+am)\s+(?:running|using)\b/i,
  /\bi\s+(?:run|use)\b/i,
  /\bmy\s+(?:dac|amp|amplifier|speakers?|headphones?|streamer)\b/i,
];

// ── Diagnosis patterns ───────────────────────────────
// These signal a listening problem or system symptom.

const DIAGNOSIS_PATTERNS = [
  /\bmy\s+system\s+sounds?\b/i,
  /\bmy\s+setup\s+(?:sounds?|is|feels?)\b/i,
  /\bsounds?\s+(?:too\s+)?(?:bright|thin|harsh|fatiguing|muddy|dull|veiled|grainy|flat|boring|lifeless|congested|sibilant)\b/i,
  /\blacking\s+(?:in\s+)?(?:bass|treble|detail|warmth|body|dynamics|punch|clarity|air|space|depth)\b/i,
  /\btoo\s+much\s+(?:brightness|treble|bass|warmth|sibilance|glare)\b/i,
  /\bwhy\s+does\s+(?:my|the)\b/i,
  /\b(?:bothers?|annoys?|fatigues?)\s+me\b/i,
  /\blistening\s+fatigue\b/i,
  /\bnot\s+(?:enough|happy|satisfied)\b/i,
  /\bsomething\s+(?:is\s+)?(?:off|wrong|missing)\b/i,
  /\bi\s+(?:don't|don't)\s+like\s+(?:the|how)\b/i,
  /\b(?:problem|issue)\s+with\b/i,
];

// ── Subject extraction ───────────────────────────────

export function extractSubjectMatches(text: string): SubjectMatch[] {
  const lower = text.toLowerCase();
  const found: SubjectMatch[] = [];

  // Track which character spans have already been claimed by a longer match.
  // This prevents 'hugo' from matching when 'hugo tt2' already claimed those characters.
  const claimedRanges: Array<[number, number]> = [];

  function isSpanClaimed(start: number, end: number): boolean {
    return claimedRanges.some(([cs, ce]) => start >= cs && end <= ce);
  }

  // Word-boundary check: ensure a match isn't embedded inside a longer word.
  // e.g. "aria" inside "Variable" or "dave" inside "saved".
  // Allow boundaries at: start/end of string, whitespace, punctuation, digits.
  function isWordBoundary(idx: number, end: number): boolean {
    if (idx > 0) {
      const before = lower[idx - 1];
      if (/[a-z]/.test(before)) return false; // letter immediately before
    }
    if (end < lower.length) {
      const after = lower[end];
      if (/[a-z]/.test(after)) return false; // letter immediately after
    }
    return true;
  }

  // PRODUCT_NAMES is sorted longest-first so compound names win over substrings.
  for (const name of PRODUCT_NAMES) {
    const idx = lower.indexOf(name);
    if (idx === -1) continue;
    const end = idx + name.length;
    if (isSpanClaimed(idx, end)) continue;
    if (!isWordBoundary(idx, end)) continue;
    found.push({ name, kind: 'product' });
    claimedRanges.push([idx, end]);
  }

  // Then check brand names, skip if already matched as product.
  // Also detect parenthetical clarifications like "Job (Goldmund)" —
  // the parenthesized brand is a manufacturer note, not a separate component.
  for (const name of BRAND_NAMES) {
    const idx = lower.indexOf(name);
    if (idx === -1) continue;
    if (found.some((f) => f.name === name)) continue;

    // Skip brands whose span is already claimed by a product match
    const end = idx + name.length;
    if (isSpanClaimed(idx, end)) continue;
    if (!isWordBoundary(idx, end)) continue;

    // Detect parenthetical context: "(goldmund)" after another brand/product
    const beforeParen = lower.lastIndexOf('(', idx);
    const afterParen = lower.indexOf(')', idx + name.length);
    if (beforeParen >= 0 && afterParen >= 0 && (idx - beforeParen) <= 2 && (afterParen - end) <= 2) {
      // This brand is inside parentheses — treat as clarification, not component
      found.push({ name, kind: 'brand', parenthetical: true });
      claimedRanges.push([beforeParen, afterParen + 1]);
      continue;
    }

    found.push({ name, kind: 'brand' });
    claimedRanges.push([idx, end]);
  }
  return found;
}

function extractSubjects(text: string): string[] {
  return extractSubjectMatches(text).map((m) => m.name);
}

// ── Desire extraction ────────────────────────────────

/** Audio qualities we recognize in desire expressions (noun/abstract forms). */
const KNOWN_QUALITIES = [
  // Temporal / transient
  'speed', 'pace', 'timing', 'attack', 'transients',
  // Tonal weight
  'warmth', 'body', 'richness', 'density', 'weight',
  // Resolution / transparency
  'detail', 'resolution', 'clarity', 'transparency',
  // Musical coherence
  'flow', 'musicality', 'engagement', 'rhythm', 'naturalness',
  // Ease / comfort
  'smoothness', 'ease', 'relaxation',
  // Dynamic / energy
  'dynamics', 'punch', 'slam', 'energy', 'excitement',
  // Spatial
  'soundstage', 'imaging', 'space', 'width', 'depth',
  // Textural
  'texture', 'grain', 'refinement',
  // Air / treble character
  'air', 'openness', 'sparkle', 'extension',
  // Frequency ranges
  'bass', 'treble', 'midrange',
  // Negative qualities (things listeners want less of)
  'glare', 'sibilance', 'harshness', 'fatigue',
  'brightness', 'edge', 'sweetness', 'thinness', 'dullness',
  'aggression',
];

/**
 * Map adjective and informal forms to their canonical KNOWN_QUALITIES noun.
 * Only adjective forms NOT already in KNOWN_QUALITIES need mapping.
 * This allows "warm" → "warmth", "harsh" → "harshness", etc.
 *
 * Mapping rules:
 *   1. Direct adjective→noun pairs always map (warm→warmth).
 *   2. If the adjective's meaning in hi-fi is broader than any single
 *      canonical quality, add a new canonical quality rather than
 *      force-mapping to the wrong bucket.
 *   3. Inherently negative adjectives map to their negative noun
 *      (harsh→harshness, aggressive→aggression).
 */
const QUALITY_ALIASES: Record<string, string> = {
  // ── Tonal weight ────────────────────────────
  warm: 'warmth',
  rich: 'richness',
  dense: 'density',
  weighty: 'weight',
  heavy: 'weight',

  // ── Resolution / transparency ───────────────
  detailed: 'detail',
  clear: 'clarity',
  transparent: 'transparency',

  // ── Ease / comfort ──────────────────────────
  smooth: 'smoothness',
  relaxed: 'relaxation',
  easy: 'ease',

  // ── Dynamics / energy ───────────────────────
  dynamic: 'dynamics',
  punchy: 'punch',
  energetic: 'energy',
  exciting: 'excitement',          // was: energy — excitement is its own concept
  lively: 'energy',

  // ── Temporal / transient ────────────────────
  fast: 'speed',
  // Note: "slow" is deliberately omitted. In hi-fi, "slow" is a complaint
  // about transient behavior (= wanting more speed). "Not slow" should
  // map to "more speed", but the negation framework would produce
  // "less pace" which reads wrong. Better to let "fast" handle the
  // positive direction and leave "slow" unresolved than to extract
  // a misleading desire.

  // ── Textural ────────────────────────────────
  textured: 'texture',
  grainy: 'grain',
  refined: 'refinement',

  // ── Spatial ─────────────────────────────────
  airy: 'air',
  open: 'openness',
  spacious: 'soundstage',
  wide: 'width',
  deep: 'depth',

  // ── Musical coherence ───────────────────────
  natural: 'naturalness',          // was: flow — naturalness is its own concept
  organic: 'naturalness',          // organic ≈ natural in hi-fi
  musical: 'musicality',
  engaging: 'engagement',

  // ── Negative qualities ──────────────────────
  bright: 'brightness',
  harsh: 'harshness',
  thin: 'thinness',
  sweet: 'sweetness',
  dull: 'dullness',
  sibilant: 'sibilance',
  edgy: 'edge',
  fatiguing: 'fatigue',
  aggressive: 'aggression',
  lean: 'thinness',                // "lean" in complaint context ≈ thin
};

/** Resolve a word to a canonical quality, checking both KNOWN_QUALITIES and aliases. */
function resolveQuality(word: string): string | null {
  const lower = word.toLowerCase();
  if (KNOWN_QUALITIES.includes(lower)) return lower;
  return QUALITY_ALIASES[lower] ?? null;
}

/** Patterns that express wanting more or less of a quality (explicit framing). */
const DESIRE_PATTERNS: { pattern: RegExp; direction: 'more' | 'less' }[] = [
  { pattern: /\bwant(?:s|ed|ing)?\s+more\s+(\w+)/i, direction: 'more' },
  { pattern: /\bneed(?:s|ed|ing)?\s+more\s+(\w+)/i, direction: 'more' },
  { pattern: /\blooking\s+for\s+more\s+(\w+)/i, direction: 'more' },
  { pattern: /\bwish(?:es|ed)?\s+(?:it|they)\s+had\s+more\s+(\w+)/i, direction: 'more' },
  { pattern: /\bcould\s+use\s+more\s+(\w+)/i, direction: 'more' },
  { pattern: /\bmore\s+(\w+)\s+would/i, direction: 'more' },
  { pattern: /\bwant(?:s|ed|ing)?\s+less\s+(\w+)/i, direction: 'less' },
  { pattern: /\btoo\s+much\s+(\w+)/i, direction: 'less' },
  { pattern: /\bless\s+(\w+)\s+would/i, direction: 'less' },
  { pattern: /\bwant(?:s|ed|ing)?\s+(?:it|them)\s+(?:to\s+be\s+)?(?:more\s+)?(\w+)/i, direction: 'more' },
  { pattern: /\b(?:like|love)s?\s+(?:it|my|the)\b.*\bbut\b.*\bmore\s+(\w+)/i, direction: 'more' },
  { pattern: /\b(?:like|love)s?\s+(?:it|my|the)\b.*\bbut\b.*\bless\s+(\w+)/i, direction: 'less' },
];

// ── Implicit desire extraction ────────────────────────
//
// Handles compact audio-language preference phrasing where desires
// are expressed without explicit framing verbs. These run as a second
// pass after DESIRE_PATTERNS, adding any new desires not already captured.
//
// Categories:
//   A. Negative phrasing: "no X", "not X", "without X", "avoid X", "less X"
//   B. Explicit "more X" without framing verb
//   C. Positive quality words in preference context
//
// To stay conservative, category C only fires when the sentence contains
// a PREFERENCE_CONTEXT signal — language suggesting the user is describing
// what they want from a component or system.

/** Signals that the sentence is expressing preference, not just describing. */
const PREFERENCE_CONTEXT_PATTERNS = [
  /\blooking\s+for\b/i,
  /\bwant/i,
  /\bneed/i,
  /\bprefer/i,
  /\bseeking\b/i,
  /\bafter\b/i,                     // "I'm after warmth and detail"
  /\bfor\s+(?:my|a|the)\b/i,       // "cables for my system"
  /\bcables?\b/i,                   // cable queries are inherently preference-expressing
  /\binterconnects?\b/i,
  /\brecommend/i,
  /\bsuggestion/i,
  /\badvice\b/i,
  /\bupgrade\b/i,
  /\bbest\b/i,
  /\bshould\b/i,
  /\bbut\b/i,                       // contrast implies preference: "warm but detailed"
  /\bwith\s+no\b/i,                 // "warm with no glare"
  /\bwithout\b/i,                   // "detail without fatigue"
  /\bstill\b/i,                     // "warm but still detailed"
  /\bmore\b/i,                      // "more air and openness" implies preference
  /\bless\b/i,                      // "less edge" implies preference
  /\bnot\b/i,                       // "smooth, not dull" implies preference
  /\bno\b/i,                        // "no glare" implies preference
  /\bi\s+want\b/i,                  // "I want sweetness and flow"
];

/**
 * Negative phrasing patterns — extract the quality word following negation.
 * Each captures the quality word as group 1.
 */
const NEGATIVE_DESIRE_PATTERNS = [
  /\bno\s+(\w+)/gi,                 // "no glare", "no fatigue"
  /\bnot\s+(\w+)/gi,                // "not harsh", "not thin"
  /\bwithout\s+(\w+)/gi,            // "without fatigue", "without glare"
  /\bavoid\s+(\w+)/gi,              // "avoid brightness"
  /\bless\s+(\w+)/gi,               // "less edge", "less brightness"
  /\bnot\s+too\s+(\w+)/gi,          // "not too bright"
  /\bnever\s+(\w+)/gi,              // "never harsh"
];

/**
 * Explicit "more X" without a preceding framing verb.
 * This catches "more air and openness" without "I want".
 */
const MORE_DESIRE_PATTERN = /\bmore\s+(\w+)/gi;

/** Count how many recognized quality words appear in the text. */
function countQualityWords(text: string): number {
  const words = text.toLowerCase().split(/[\s,;:]+/);
  let count = 0;
  for (const w of words) {
    const clean = w.replace(/[^a-z]/g, '');
    if (clean && resolveQuality(clean)) count++;
  }
  return count;
}

/**
 * Extract implicit desires from compact audio-preference phrasing.
 * Returns desires not already present in the explicit extraction.
 */
function extractImplicitDesires(
  text: string,
  existingDesires: DesireSignal[],
): DesireSignal[] {
  const implicit: DesireSignal[] = [];

  function addIfNew(quality: string, direction: 'more' | 'less', raw: string): void {
    if (!existingDesires.some((d) => d.quality === quality && d.direction === direction)
        && !implicit.some((d) => d.quality === quality && d.direction === direction)) {
      implicit.push({ quality, direction, raw });
    }
  }

  // Pass A: Negative phrasing — always fires (negation is unambiguous preference)
  for (const pattern of NEGATIVE_DESIRE_PATTERNS) {
    pattern.lastIndex = 0; // reset global regex
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const word = match[1].toLowerCase();
      const quality = resolveQuality(word);
      if (quality) {
        addIfNew(quality, 'less', match[0]);
      }
    }
  }

  // Pass B: Explicit "more X" — always fires (direction is explicit)
  MORE_DESIRE_PATTERN.lastIndex = 0;
  let moreMatch: RegExpExecArray | null;
  while ((moreMatch = MORE_DESIRE_PATTERN.exec(text)) !== null) {
    const word = moreMatch[1].toLowerCase();
    const quality = resolveQuality(word);
    if (quality) {
      addIfNew(quality, 'more', moreMatch[0]);
    }
  }

  // Pass C: Bare positive qualities in preference context
  // Only fires when the sentence contains preference-context signals OR
  // when the text contains 2+ recognized quality words (a quality list
  // like "sweetness and flow" is inherently preference language).
  const hasPreferenceContext = PREFERENCE_CONTEXT_PATTERNS.some((p) => p.test(text))
    || countQualityWords(text) >= 2;
  if (hasPreferenceContext) {
    // Tokenize into words, check each against quality vocabulary
    const words = text.toLowerCase().split(/[\s,;:]+/);
    // Track which words are inside a negative phrase to avoid double-counting
    const negatedPositions = new Set<number>();
    for (let i = 0; i < words.length; i++) {
      if (/^(no|not|without|avoid|less|never)$/.test(words[i])) {
        // Mark the next 1-2 words as negated
        negatedPositions.add(i + 1);
        if (words[i] === 'not' && words[i + 1] === 'too') {
          negatedPositions.add(i + 2);
        }
      }
    }

    for (let i = 0; i < words.length; i++) {
      if (negatedPositions.has(i)) continue; // already captured by pass A
      const word = words[i].replace(/[^a-z]/g, ''); // strip punctuation
      if (!word) continue;
      const quality = resolveQuality(word);
      if (quality) {
        // Skip qualities that are inherently negative (wanting "more glare" is unlikely)
        const NEGATIVE_QUALITIES = ['glare', 'sibilance', 'harshness', 'fatigue', 'brightness', 'edge', 'thinness', 'dullness', 'grain', 'aggression'];
        if (NEGATIVE_QUALITIES.includes(quality)) continue;
        addIfNew(quality, 'more', word);
      }
    }
  }

  return implicit;
}

export function extractDesires(text: string): DesireSignal[] {
  // Pass 1: Explicit framing patterns ("want more X", "too much X")
  const desires: DesireSignal[] = [];
  for (const { pattern, direction } of DESIRE_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const quality = resolveQuality(match[1]);
      if (quality) {
        if (!desires.some((d) => d.quality === quality && d.direction === direction)) {
          desires.push({ quality, direction, raw: match[0] });
        }
      }
    }
  }

  // Pass 2: Implicit compact phrasing ("no glare", "warm but detailed")
  const implicit = extractImplicitDesires(text, desires);
  desires.push(...implicit);

  return desires;
}

// ── Audio Knowledge patterns ─────────────────────────
// General audio questions not tied to a system decision.
// Technology explanations, product opinions, sound signatures,
// general brand discussion. Only fires when no upstream intent claims
// the query. If the user has a system, the response adds a short
// system-aware note — but routing stays in knowledge lane.

const AUDIO_KNOWLEDGE_PATTERNS = [
  /\bwhat\s+is\s+(?:r2r|r-2r|delta[- ]sigma|nos|class[- ]?[abd]|push[- ]?pull|single[- ]?ended|balanced|xlr|rca|tube\s+rolling)\b/i,
  /\bexplain\s+(?:the\s+)?(?:difference|distinction)\s+between\b/i,
  /\bhow\s+(?:does|do)\s+(?:r2r|r-2r|delta[- ]sigma|nos|tubes?|solid[- ]?state|class[- ]?[abd]|push[- ]?pull|single[- ]?ended|balanced)\s+(?:work|sound|compare|differ)\b/i,
  /\bwhat(?:'s| is)\s+the\s+(?:difference|distinction)\s+between\b/i,
  /\btell\s+me\s+about\s+(?:r2r|r-2r|delta[- ]sigma|nos|tubes?|solid[- ]?state|class[- ]?[abd])\b/i,
  /\bhow\s+(?:does|do)\s+.+\s+(?:speakers?|amps?|dacs?|headphones?)\s+sound\b/i,
  /\bwhat\s+(?:are|is)\s+(?:the\s+)?(?:pros?\s+and\s+cons?|advantages?|disadvantages?|benefits?|drawbacks?)\s+of\b/i,
  /\bwhat\s+(?:makes?|gives?)\s+.+\s+(?:its?\s+)?(?:sound|character|signature|tone)\b/i,
  /\b(?:sovtek|mullard|telefunken|amperex|ge|rca|sylvania|jj|eh|tung[- ]?sol)\b.*\b(?:vs\.?|versus|compared?\s+to|or)\b/i,
  /\b(?:vs\.?|versus|compared?\s+to|or)\b.*\b(?:sovtek|mullard|telefunken|amperex|ge|rca|sylvania|jj|eh|tung[- ]?sol)\b/i,
];

// ── Audio Assistant patterns ─────────────────────────
// Practical hobby tasks: negotiation, translation, message writing,
// travel/audition logistics, buying help. Open LLM generation
// with tone guardrails.

const AUDIO_ASSISTANT_PATTERNS = [
  /\bnegotiat(?:e|ing|ion)\b/i,
  /\bhaggl(?:e|ing)\b/i,
  /\bmake\s+an?\s+offer\b/i,
  /\blow[- ]?ball\b/i,
  /\bwrite\s+(?:a\s+)?(?:message|email|reply|response|note)\b/i,
  /\bdraft\s+(?:a\s+)?(?:message|email|reply|response)\b/i,
  /\btranslat(?:e|ion|ing)\b/i,
  /\bin\s+(?:french|german|italian|spanish|polish|japanese|chinese|dutch|portuguese|swedish|norwegian|danish)\b/i,
  /\bwhere\s+can\s+i\s+(?:hear|audition|demo|try|listen\s+to|find)\b/i,
  /\bwhere\s+(?:to|should\s+i)\s+(?:hear|audition|demo|try|listen\s+to|find|buy)\b/i,
  /\b(?:dealer|retailer|showroom|shop|store)\s+(?:in|near|around|for)\b/i,
  /\ble\s+bon\s+coin\b/i,
  /\b(?:ebay|audiogon|usaudiomart|canuck\s*audio\s*mart|hifishark|head[- ]?fi)\s+(?:listing|ad|post|seller)\b/i,
  /\b(?:shipping|customs|import\s+duty|vat)\s+(?:for|on|from|to)\b/i,
  /\bhow\s+(?:much|should)\s+(?:i|to)\s+(?:offer|pay|spend)\s+(?:for|on)\b/i,
  /\bis\s+(?:this|that)\s+(?:a\s+)?(?:good|fair|reasonable)\s+(?:price|deal)\b/i,
  /\bevaluat(?:e|ing)\s+(?:this|that|the)\s+(?:listing|ad|post|description)\b/i,
];

// ── Public API ───────────────────────────────────────

/**
 * Detect the user's intent from their most recent message.
 *
 * Priority order:
 *   1. Diagnosis (explicit listening problem)
 *   2. Comparison (vs / compare)
 *   3. Shopping (recommend / best / looking for)
 *   4. Gear inquiry (what do you think / brand mention without problem)
 *   5. Diagnosis fallback (when nothing else matches)
 *
 * Diagnosis gets highest priority because if a user says
 * "my system sounds bright, what do you think of the Bifrost?"
 * the listening problem should drive the response.
 */
export function detectIntent(currentMessage: string): IntentResult {
  const subjectMatches = extractSubjectMatches(currentMessage);
  const subjects = subjectMatches.map((m) => m.name);
  const desires = extractDesires(currentMessage);

  // 1. Explicit diagnosis — user describes a listening problem
  if (DIAGNOSIS_PATTERNS.some((p) => p.test(currentMessage))) {
    return { intent: 'diagnosis', subjects, subjectMatches, desires };
  }

  // 1b. System assessment — user describes their system and asks for evaluation
  //     Requires explicit assessment language + ownership language + multiple subjects.
  //     This must fire before comparison to prevent "I have X, Y, and Z" from
  //     being treated as "X vs Y".
  //
  //     Special case: an arrow-separated chain with 3+ recognized components is
  //     treated as an implicit system assessment even without ownership or
  //     assessment language — the chain notation itself signals intent.
  const hasAssessmentLanguage = SYSTEM_ASSESSMENT_PATTERNS.some((p) => p.test(currentMessage));
  const hasOwnership = OWNERSHIP_PATTERNS.some((p) => p.test(currentMessage));
  const hasArrowChain = /(?:→|-{1,3}>|={1,2}>|>{2,3})/.test(currentMessage);
  if (hasAssessmentLanguage && hasOwnership && subjectMatches.length >= 2) {
    return { intent: 'system_assessment', subjects, subjectMatches, desires };
  }
  if (hasArrowChain && subjectMatches.length >= 3) {
    return { intent: 'system_assessment', subjects, subjectMatches, desires };
  }

  // 1c. Consultation entry — user asks for system assessment/upgrade guidance
  //     but hasn't named specific gear yet. This produces a structured intake
  //     response instead of falling through to generic shopping.
  const hasGuidanceLanguage = SYSTEM_GUIDANCE_PATTERNS.some((p) => p.test(currentMessage));
  if ((hasAssessmentLanguage || hasGuidanceLanguage) && hasOwnership) {
    return { intent: 'consultation_entry', subjects, subjectMatches, desires };
  }

  // 1d. Cable advisory — user asks about cables in a system context.
  //     Must fire before shopping to prevent cable queries from getting
  //     generic shopping treatment. Requires cable language.
  //     Guard: when the user is describing their system (ownership +
  //     assessment/guidance language + multiple components) and merely
  //     mentions cables as part of the description, do NOT route to
  //     cable advisory — let the system assessment path handle it.
  const hasCableLanguage = CABLE_INTENT_PATTERNS.some((p) => p.test(currentMessage));
  const isSystemDescriptionWithCables = hasCableLanguage && hasOwnership
    && (hasAssessmentLanguage || hasGuidanceLanguage) && subjectMatches.length >= 2;
  if (hasCableLanguage && !isSystemDescriptionWithCables) {
    return { intent: 'cable_advisory', subjects, subjectMatches, desires };
  }

  // 2. Comparison — "X vs Y", "compare A and B"
  if (COMPARISON_PATTERNS.some((p) => p.test(currentMessage))) {
    return { intent: 'comparison', subjects, subjectMatches, desires };
  }

  // 2b. Product assessment — "I'm considering the X", "would X work in my system"
  //     Requires: (a) a product assessment pattern, AND (b) at least one
  //     product-level subject match. This fires BEFORE shopping so that
  //     "I'm considering the Qutest" produces an assessment, not a category list.
  const hasProductAssessmentPattern = PRODUCT_ASSESSMENT_PATTERNS.some((p) => p.test(currentMessage));
  const hasProductSubject = subjectMatches.some((m) => m.kind === 'product');
  const hasBrandSubject = subjectMatches.some((m) => m.kind === 'brand' && !m.parenthetical);
  if (hasProductAssessmentPattern && (hasProductSubject || hasBrandSubject)) {
    return { intent: 'product_assessment', subjects, subjectMatches, desires };
  }

  // 3. Shopping — "best DAC under $1000", "recommend a DAC"
  if (SHOPPING_PATTERNS.some((p) => p.test(currentMessage))) {
    return { intent: 'shopping', subjects, subjectMatches, desires };
  }

  // 4. Audio assistant — negotiation, translation, message writing,
  //    travel/audition logistics, buying help.
  //    Checked BEFORE gear inquiry because assistant patterns are
  //    action-oriented (write, translate, negotiate) and should take
  //    priority even when the message mentions product/brand names.
  if (AUDIO_ASSISTANT_PATTERNS.some((p) => p.test(currentMessage))) {
    return { intent: 'audio_assistant', subjects, subjectMatches, desires };
  }

  // 4b. Audio knowledge — general audio questions not tied to system decisions.
  //     Technology explanations, tube comparisons, design philosophy.
  //     Checked before gear inquiry so "Sovtek vs Mullard EL84" routes here
  //     instead of being caught by the subjects catch-all.
  if (AUDIO_KNOWLEDGE_PATTERNS.some((p) => p.test(currentMessage))) {
    return { intent: 'audio_knowledge', subjects, subjectMatches, desires };
  }

  // 5. Gear inquiry — "what do you think of X?" or brand mention
  //    without a listening problem.
  //    Requires a concrete subject (brand name) OR a gear-category word
  //    to avoid misclassifying vague follow-ups like "what do you think about that?"
  const hasGearPattern = GEAR_INQUIRY_PATTERNS.some((p) => p.test(currentMessage));
  const hasGearCategoryWord = /\b(?:dac|amp|amplifier|speaker|headphone|streamer|cable|turntable|phono|preamp|power\s*amp)\b/i.test(currentMessage);

  if (hasGearPattern && (subjects.length > 0 || hasGearCategoryWord)) {
    return { intent: 'gear_inquiry', subjects, subjectMatches, desires };
  }

  // 5b. Brand/product mention without any other pattern → gear inquiry
  if (subjects.length > 0) {
    return { intent: 'gear_inquiry', subjects, subjectMatches, desires };
  }

  // 7. Default — treat as diagnostic / open-ended listening discussion
  return { intent: 'diagnosis', subjects, subjectMatches, desires };
}

/**
 * Returns true if all subject matches are brand-level (no specific products).
 * Used to distinguish brand comparisons from product comparisons.
 */
export function isBrandOnlyComparison(matches: SubjectMatch[]): boolean {
  return matches.length >= 2 && matches.every((m) => m.kind === 'brand');
}

// ── Comparison follow-up detection ──────────────────

/**
 * Patterns that indicate a follow-up question about an active comparison.
 * These are elliptical — they omit the comparison subjects and rely on
 * the stored context to resolve "which" or "what" against.
 */
const COMPARISON_FOLLOWUP_PATTERNS = [
  /\bwhich\b.*\b(?:better|worse|more|less|warmer|brighter|cooler|richer|thinner|fuller|faster|slower)\b/i,
  /\bwhat(?:'s| is)\s+better\b/i,
  /\bwhat\s+about\b/i,
  /\bhow\s+(?:about|do they differ|do they compare)\b/i,
  /\bfor\s+(?:tubes?|solid[- ]state|small\s+rooms?|large\s+rooms?|near[- ]field|low[- ]power|high[- ]power|vinyl|digital|streaming)\b/i,
  /\bwith\s+(?:tubes?|solid[- ]state|low[- ]power|high[- ]power|a\s+\w+\s+amp)\b/i,
  /\bwhich\s+(?:one|is|has|would|should|do)\b/i,
  /\band\s+(?:what|how)\s+about\b/i,
];

/**
 * Check whether a message is a follow-up to an active comparison.
 *
 * Returns true when:
 *   - An active comparison exists, AND
 *   - The message matches a follow-up pattern, OR
 *   - The message introduces no new subjects (elliptical reference)
 *
 * Does NOT return true if the message contains new subjects that
 * differ from the active comparison (indicates a topic change).
 */
export function isComparisonFollowUp(
  text: string,
  activeComparison: { left: SubjectMatch; right: SubjectMatch } | undefined,
): boolean {
  if (!activeComparison) return false;

  // Check if message introduces new, unrelated subjects
  const newMatches = extractSubjectMatches(text);
  if (newMatches.length > 0) {
    const activeNames = new Set([
      activeComparison.left.name.toLowerCase(),
      activeComparison.right.name.toLowerCase(),
    ]);
    const hasNewSubject = newMatches.some((m) => !activeNames.has(m.name.toLowerCase()));
    if (hasNewSubject) return false; // Topic changed
  }

  // Check follow-up patterns
  return COMPARISON_FOLLOWUP_PATTERNS.some((p) => p.test(text));
}

// ── Context enrichment detection ──────────────────────
//
// Detects when the user is providing system context (amplifier,
// speakers, room, music, listening priorities) rather than asking
// a new question or shifting topic. Used to keep the conversation
// in its active mode (comparison, shopping, consultation-with-fit)
// instead of falling through to diagnostic evaluation.

const CONTEXT_ENRICHMENT_PATTERNS = [
  // Amplifier / source context — "my amp is…", "I'm using…", "driven by…"
  /\bmy\s+(?:amp(?:lifier)?|preamp|integrated|receiver|dac|source|streamer|turntable|phono)\s+is\b/i,
  /\b(?:i(?:'m|\s+am)\s+)?(?:using|running|driving\s+(?:them|it)\s+with|pairing\s+(?:it|them)\s+with|powering)\b/i,
  /\bdriven\s+by\b/i,
  /\bpowered\s+by\b/i,
  /\bfed\s+by\b/i,
  /\bamp\s+is\s+(?:a\s+)?/i,

  // Speaker context — "my speakers are…", "I have…"
  /\bmy\s+speakers?\s+(?:are|is)\b/i,
  /\bi\s+have\s+(?:a\s+pair\s+of|the)\s+/i,
  // "I have a tube amp", "i have an SET amp", "i have a Shindo preamp"
  /\bi\s+have\s+(?:a|an)\s+(?:\w+\s+)*(?:amp(?:lifier)?|preamp|integrated|receiver|dac|speakers?|turntable|phono|streamer|sub(?:woofer)?)\b/i,

  // Room context — "small room", "nearfield", "12x14 room"
  /\b(?:small|large|medium|big|tiny)\s+room\b/i,
  /\bnear[- ]?field\b/i,
  /\b\d+\s*(?:x|by)\s*\d+\s*(?:room|space|feet|ft)?\b/i,
  /\blistening\s+(?:room|space|distance)\b/i,
  /\bapartment\b/i,
  /\bdesk(?:top)?\s+(?:setup|system)\b/i,

  // Music preferences — "mostly jazz", "I listen to…"
  /\b(?:mostly|mainly|primarily)\s+(?:jazz|classical|rock|electronic|vocal|acoustic|pop|metal|folk|blues|hip[- ]hop)\b/i,
  /\bi\s+(?:listen\s+to|play|enjoy)\s+(?:a\s+lot\s+of\s+)?/i,
  /\bmy\s+(?:music|listening)\s+is\s+(?:mostly|mainly|primarily)\b/i,

  // Listening priorities — "I care about…", "most important to me…"
  /\bi\s+(?:care|value|prioriti[sz]e)\s+/i,
  /\bmost\s+important\s+(?:to\s+me|thing)\b/i,
  /\bi\s+(?:want|need|prefer)\s+(?:more\s+)?(?:warmth|detail|clarity|bass|body|flow|rhythm|dynamics|soundstage|imaging)\b/i,

  // Power context — "300B tubes", "8 watts", "SET amp"
  /\b\d+\s*(?:watt|w)\b/i,
  /\b(?:300b|2a3|el34|kt88|kt120|kt150|6550|845|211)\b/i,
  /\b(?:set|push[- ]pull|single[- ]ended|class[- ]?a)\s+(?:amp|amplifier|design)?\b/i,

  // Budget / price context added mid-conversation
  /\bbudget\s+(?:is|around|about)\b/i,
  /\bi(?:'d| would)\s+spend\s+/i,
];

/**
 * Detect whether a message is providing system context rather than
 * asking a new question or describing a problem.
 *
 * Returns the category of context provided, or null if not detected.
 *
 * Important: this should only be checked when an active conversation
 * mode exists (comparison, shopping, consultation-with-fit). On a
 * cold start, "my amp is X" should route normally.
 */
export type ContextKind = 'amplifier' | 'speaker' | 'room' | 'music' | 'listening_priority' | 'power' | 'budget' | 'general_system';

export function detectContextEnrichment(text: string): ContextKind | null {
  const lower = text.toLowerCase();

  // Reject if the message also contains a clear diagnostic symptom —
  // "my amp is bright and fatiguing" is a diagnosis, not context enrichment
  if (/\bsounds?\s+(?:too\s+)?(?:bright|thin|harsh|fatiguing|muddy|dull|veiled|grainy|flat|boring|lifeless|congested|sibilant)\b/i.test(lower)) {
    return null;
  }
  if (/\bsomething\s+(?:is\s+)?(?:off|wrong|missing)\b/i.test(lower)) {
    return null;
  }

  // Check if any enrichment pattern matches
  if (!CONTEXT_ENRICHMENT_PATTERNS.some((p) => p.test(text))) {
    return null;
  }

  // Classify the kind of context
  if (/\bamp(?:lifier)?|preamp|integrated|receiver|driven\s+by|powered\s+by|300b|2a3|el34|kt88|kt120|kt150|6550|845|211|set\b|push[- ]pull|single[- ]ended|class[- ]?a|\d+\s*(?:watt|w)\b/i.test(lower)) {
    return 'amplifier';
  }
  if (/\bspeakers?\b/i.test(lower)) return 'speaker';
  if (/\broom\b|near[- ]?field|apartment|desk|listening\s+(?:distance|space)|\d+\s*(?:x|by)\s*\d+/i.test(lower)) return 'room';
  if (/\bjazz|classical|rock|electronic|vocal|acoustic|pop|metal|folk|blues|hip[- ]hop|listen\s+to|music\b/i.test(lower)) return 'music';
  if (/\bcare|value|prioriti[sz]e|most\s+important|want\s+more|need\s+more|prefer/i.test(lower)) return 'listening_priority';
  if (/\bbudget|spend/i.test(lower)) return 'budget';
  return 'general_system';
}

// ── Consultation follow-up detection ──────────────────
//
// Detects when the user is asking a follow-up to an active consultation
// (gear inquiry or brand consultation). Examples:
//   "devore o96 thoughts?" → "but aren't there smaller models?"
//   "what is shindo known for?" → "what about their amps?"
//   "tell me about harbeth" → "how do they compare to spendor?"

/**
 * Patterns that indicate a follow-up within an ongoing consultation.
 * These are elliptical — they reference the prior subject implicitly.
 */
const CONSULTATION_FOLLOWUP_PATTERNS = [
  // Asking about variants / models / alternatives
  /\b(?:aren't|isn't|are)\s+there\s+(?:smaller|larger|bigger|cheaper|other|different|more\s+\w+)\s+(?:models?|versions?|options?|speakers?|dacs?|amps?)\b/i,
  /\bwhat\s+about\s+(?:the\s+)?(?:smaller|larger|bigger|cheaper|other)\b/i,
  /\bdo\s+they\s+(?:make|have|offer)\b/i,
  /\bany\s+(?:smaller|larger|cheaper|other|different|similar)\s+(?:models?|versions?|options?)\b/i,
  /\bother\s+(?:models?|versions?|products?|options?)\b/i,
  /\bsmaller\s+(?:models?|versions?|speakers?)\b/i,
  /\blarger\s+(?:models?|versions?|speakers?)\b/i,

  // Asking for more detail about the same subject
  /\bwhat\s+about\s+(?:the\s+)?(?:bass|treble|midrange|soundstage|imaging|dynamics|timing|warmth|detail)\b/i,
  /\bhow\s+(?:do|does)\s+(?:it|they)\s+(?:sound|perform|handle|compare|do|pair|work)\b/i,
  /\bhow\s+(?:is|are)\s+(?:the|its|their)\b/i,
  /\bwhat(?:'s| is)\s+(?:the|its|their)\s+(?:sound|character|strength|weakness|tone)\b/i,
  /\btell\s+me\s+more\b/i,
  /\bmore\s+(?:about|detail|info)\b/i,

  // Pairing / system fit questions referencing prior subject
  /\bwhat\s+(?:amp|dac|speaker|source)\s+(?:pairs?|works?|goes?)\s+(?:well|best)\b/i,
  /\bwhat\s+(?:pairs?|works?|goes?)\s+well\s+with\b/i,
  /\bgood\s+(?:match|pairing|fit)\b/i,
  /\bpair\s+(?:it|them)\s+with\b/i,

  // "What about…" / "And…" / "But…" follow-up patterns
  /^(?:and|but)\s+/i,
  /^what\s+about\b/i,
  /^how\s+about\b/i,
];

/**
 * Check whether a message is a follow-up to an active consultation.
 *
 * Returns true when:
 *   - An active consultation exists, AND
 *   - The message matches a follow-up pattern, OR
 *   - The message contains no new subjects (elliptical reference to prior)
 *
 * Does NOT return true if the message contains new subjects that
 * differ from the active consultation (indicates a topic change).
 */
export function isConsultationFollowUp(
  text: string,
  activeConsultation: { subjects: SubjectMatch[]; originalQuery: string } | undefined,
): boolean {
  if (!activeConsultation) return false;
  if (activeConsultation.subjects.length === 0) return false;

  // Context enrichment — providing system details is a follow-up, not a new topic.
  // Check this BEFORE the new-subject gate because system context often mentions
  // other brands/products (e.g., "my amp is a Shindo" after asking about DeVore).
  if (detectContextEnrichment(text) !== null) {
    return true;
  }

  // Check if message introduces new, unrelated subjects
  const newMatches = extractSubjectMatches(text);
  if (newMatches.length > 0) {
    const activeNames = new Set(
      activeConsultation.subjects.map((s) => s.name.toLowerCase()),
    );
    const hasNewSubject = newMatches.some((m) => !activeNames.has(m.name.toLowerCase()));
    if (hasNewSubject) return false; // Topic changed
  }

  // Check follow-up patterns
  if (CONSULTATION_FOLLOWUP_PATTERNS.some((p) => p.test(text))) {
    return true;
  }

  // Short messages with no subjects and no clear intent are likely follow-ups
  // e.g., "and the bass?" or "in a small room?" — but only if truly short
  if (text.split(/\s+/).length <= 8 && newMatches.length === 0) {
    // Only if it doesn't look like a new topic
    const hasQuestionMark = text.includes('?');
    const hasFollowUpWord = /\b(?:and|but|what|how|also|too)\b/i.test(text);
    if (hasQuestionMark && hasFollowUpWord) return true;
  }

  return false;
}

// ── Ranked shortlist helpers ────────────────────────

export type ShortlistCategory =
  | 'dac'
  | 'amplifier'
  | 'speaker'
  | 'headphone'
  | 'iem'
  | 'streamer'
  | 'turntable'
  | 'phono_preamp';

/** Map from regex match to canonical category. */
const SHORTLIST_CATEGORY_MAP: Array<{ re: RegExp; category: ShortlistCategory }> = [
  { re: /\b(?:phono\s*(?:pre)?amps?)\b/i, category: 'phono_preamp' },
  { re: /\biems?\b/i, category: 'iem' },
  { re: /\bheadphones?\b/i, category: 'headphone' },
  { re: /\bdacs?\b/i, category: 'dac' },
  { re: /\bamp(?:lifier)?s?\b/i, category: 'amplifier' },
  { re: /\bspeakers?\b/i, category: 'speaker' },
  { re: /\bstreamers?\b/i, category: 'streamer' },
  { re: /\bturntables?\b/i, category: 'turntable' },
];

/**
 * Extract the product category from a shopping query.
 * Returns null if no recognized category is found.
 */
export function extractShortlistCategory(text: string): ShortlistCategory | null {
  for (const { re, category } of SHORTLIST_CATEGORY_MAP) {
    if (re.test(text)) return category;
  }
  // Standalone "integrated" without "amp" — treat as amplifier
  if (/\bintegrated\b/i.test(text)) return 'amplifier';
  return null;
}

/** Amplifier subtype — integrated, power, preamp, etc. */
export type AmplifierSubtype = 'integrated' | 'power' | 'preamp' | 'headphone_amp' | undefined;

/**
 * Extract amplifier subtype from a shopping query.
 * Returns undefined if no specific subtype is detected.
 */
export function extractAmplifierSubtype(text: string): AmplifierSubtype {
  if (/\bintegrated\b/i.test(text)) return 'integrated';
  if (/\bpower\s*amp/i.test(text)) return 'power';
  if (/\bpre-?amp\b/i.test(text)) return 'preamp';
  if (/\bheadphone\s*amp/i.test(text)) return 'headphone_amp';
  return undefined;
}

/**
 * Extract budget ceiling from text.
 * Parses "under $2000", "under 2000", "<$2000", "<2000",
 * "around $1500", "for $1000".
 */
export function extractShortlistBudget(text: string): number | null {
  // Try "under/below/< $X" patterns first
  const underMatch = text.match(/(?:under|below|<)\s*\$?\s*([\d,]+)/i);
  if (underMatch) {
    const parsed = parseInt(underMatch[1].replace(/,/g, ''), 10);
    if (!isNaN(parsed)) return parsed;
  }
  // "around $X", "for $X", "at $X"
  const aroundMatch = text.match(/(?:around|for|at)\s+\$?\s*([\d,]+)/i);
  if (aroundMatch) {
    const parsed = parseInt(aroundMatch[1].replace(/,/g, ''), 10);
    if (!isNaN(parsed)) return parsed;
  }
  // Bare "$X" as fallback
  const bareMatch = text.match(/\$\s*([\d,]+)/);
  if (bareMatch) {
    const parsed = parseInt(bareMatch[1].replace(/,/g, ''), 10);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
}
