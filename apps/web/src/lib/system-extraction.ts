/**
 * System extraction — detect and extract system descriptions from conversation.
 *
 * Phase 5: conservative detection of user-described audio systems.
 *
 * Design principles:
 *   - Only trigger on ownership language ("I have", "my system", "I'm running")
 *   - Require at least 2 recognized components
 *   - Never trigger on comparisons, shopping, or aspirational language
 *   - Produce a ProposedSystem only when there's enough evidence
 *   - Fingerprint-based duplicate suppression
 */

import type { SubjectMatch } from './intent';
import type { ProductCategory } from './catalog-taxonomy';
import type { ProposedSystem, DraftSystemComponent, AudioSessionState } from './system-types';
import { findKnownSystemMatch, suggestKnownSystemName } from './known-systems';
import type { KnownSystemMatch } from './known-systems';

// ── Brand → category mapping ──────────────────────────
// Best-effort category assignment for known brands.
// Not exhaustive — unknown brands default to 'other'.

const BRAND_CATEGORY_MAP: Record<string, ProductCategory> = {
  // DAC / digital
  denafrips: 'dac', chord: 'dac', schiit: 'dac', topping: 'dac', smsl: 'dac',
  gustard: 'dac', holo: 'dac', benchmark: 'dac', rme: 'dac', mytek: 'dac',
  weiss: 'dac', 'mola mola': 'dac', rockna: 'dac', aqua: 'dac',
  lampizator: 'dac', lampi: 'dac', 'border patrol': 'dac', metrum: 'dac',
  'audio-gd': 'dac', soekris: 'dac', musician: 'dac', okto: 'dac',
  laiv: 'dac', audalytic: 'dac', totaldac: 'dac', 'total dac': 'dac',
  dcs: 'dac', 'holo audio': 'dac',
  eversolo: 'streamer', wiim: 'streamer', fiio: 'dac', singxer: 'dac',
  'cen.grand': 'dac', soundaware: 'streamer',
  // Speakers
  harbeth: 'speaker', devore: 'speaker', zu: 'speaker', 'zu audio': 'speaker',
  klipsch: 'speaker',
  focal: 'speaker', boenicke: 'speaker', kef: 'speaker', 'b&w': 'speaker',
  bowers: 'speaker', dynaudio: 'speaker', wilson: 'speaker', magico: 'speaker',
  'sonus faber': 'speaker', proac: 'speaker', spendor: 'speaker', atc: 'speaker',
  tannoy: 'speaker', magnepan: 'speaker', 'martin logan': 'speaker', quad: 'speaker',
  wlm: 'speaker', 'cube audio': 'speaker', hornshoppe: 'speaker',
  qualio: 'speaker', totem: 'speaker', modalakustik: 'speaker',
  // Amplifiers
  'pass labs': 'amplifier', 'first watt': 'amplifier', naim: 'amplifier',
  luxman: 'amplifier', accuphase: 'amplifier', parasound: 'amplifier',
  hegel: 'integrated', mcintosh: 'amplifier', marantz: 'amplifier',
  shindo: 'amplifier', leben: 'amplifier', 'audio note': 'amplifier',
  'line magnetic': 'amplifier', primaluna: 'amplifier', cary: 'amplifier',
  'audio research': 'amplifier', arc: 'amplifier', job: 'integrated',
  goldmund: 'dac', crayon: 'integrated', xsa: 'speaker', 'trends': 'integrated', 'trends audio': 'integrated',
  'kinki studio': 'amplifier', 'kinki': 'amplifier', hattor: 'amplifier', 'gold note': 'integrated',
  oppo: 'dac',
  // Turntables / tonearms
  rega: 'turntable', 'pro-ject': 'turntable', technics: 'turntable',
  clearaudio: 'turntable', vpi: 'turntable', linn: 'turntable', thorens: 'turntable',
  michell: 'turntable', 'michell engineering': 'turntable', sorane: 'turntable',
  // Cartridges
  ortofon: 'cartridge', emt: 'cartridge',
  // DAC brands
  auralic: 'dac',
  // Phono stages
  aurorasound: 'phono',
  // Headphones
  sennheiser: 'headphone', 'audio-technica': 'headphone', beyerdynamic: 'headphone',
  hifiman: 'headphone', audeze: 'headphone',
  // IEMs
  moondrop: 'iem', shure: 'iem', etymotic: 'iem',
  // ── Phase K: consumer / lifestyle audio brands ──
  // Allows messages like "I have a Sonos and iPhone" to detect a 2-component
  // system. Best-effort categorisation — the lifestyle/streaming brands are
  // bucketed as 'streamer', wireless speakers as 'speaker', earbuds as 'iem'.
  sonos: 'streamer', bose: 'speaker', homepod: 'speaker', echo: 'speaker',
  alexa: 'speaker', iphone: 'streamer', airpods: 'iem',
};

// ── Product → brand+category fallback ─────────────────
// For recognized products that appear without their brand name.

const PRODUCT_HINTS: Record<string, { brand: string; category: ProductCategory }> = {
  // Denafrips
  ares: { brand: 'Denafrips', category: 'dac' },
  pontus: { brand: 'Denafrips', category: 'dac' },
  venus: { brand: 'Denafrips', category: 'dac' },
  terminator: { brand: 'Denafrips', category: 'dac' },
  // Schiit
  bifrost: { brand: 'Schiit', category: 'dac' },
  gungnir: { brand: 'Schiit', category: 'dac' },
  yggdrasil: { brand: 'Schiit', category: 'dac' },
  modi: { brand: 'Schiit', category: 'dac' },
  modius: { brand: 'Schiit', category: 'dac' },
  // Chord (compound names first so longer keys match before shorter)
  'hugo tt2': { brand: 'Chord', category: 'dac' },
  'hugo tt': { brand: 'Chord', category: 'dac' },
  'hugo 2': { brand: 'Chord', category: 'dac' },
  qutest: { brand: 'Chord', category: 'dac' },
  hugo: { brand: 'Chord', category: 'dac' },
  dave: { brand: 'Chord', category: 'dac' },
  mojo: { brand: 'Chord', category: 'dac' },
  tt2: { brand: 'Chord', category: 'dac' },
  // Speakers
  'o/96': { brand: 'DeVore', category: 'speaker' },
  o96: { brand: 'DeVore', category: 'speaker' },
  orangutan: { brand: 'DeVore', category: 'speaker' },
  p3esr: { brand: 'Harbeth', category: 'speaker' },
  'super hl5': { brand: 'Harbeth', category: 'speaker' },
  // Pre-review blocker fix: register the "Plus" variant explicitly so
  // PRODUCT_HINTS lookup picks up the longer canonical name.
  'super hl5 plus': { brand: 'Harbeth', category: 'speaker' },
  'hl5 plus': { brand: 'Harbeth', category: 'speaker' },
  diva: { brand: 'WLM', category: 'speaker' },
  'diva monitor': { brand: 'WLM', category: 'speaker' },
  heresy: { brand: 'Klipsch', category: 'speaker' },
  // Boenicke
  w5: { brand: 'Boenicke', category: 'speaker' },
  w8: { brand: 'Boenicke', category: 'speaker' },
  w11: { brand: 'Boenicke', category: 'speaker' },
  // Focal
  'kanta no. 2': { brand: 'Focal', category: 'speaker' },
  kanta: { brand: 'Focal', category: 'speaker' },
  'aria 906': { brand: 'Focal', category: 'speaker' },
  // Eversolo
  'dmp-a6': { brand: 'Eversolo', category: 'streamer' },
  'dmp-a8': { brand: 'Eversolo', category: 'streamer' },
  'dac-z8': { brand: 'Eversolo', category: 'dac' },
  // WiiM
  'wiim pro': { brand: 'WiiM', category: 'streamer' },
  'wiim ultra': { brand: 'WiiM', category: 'streamer' },
  // Bluesound (streamers)
  'bluesound node x': { brand: 'Bluesound', category: 'streamer' },
  'bluesound node': { brand: 'Bluesound', category: 'streamer' },
  'node x': { brand: 'Bluesound', category: 'streamer' },
  'node': { brand: 'Bluesound', category: 'streamer' },
  // PrimaLuna (tube amplifiers)
  'evo 300 integrated': { brand: 'PrimaLuna', category: 'amplifier' },
  'evo 300': { brand: 'PrimaLuna', category: 'amplifier' },
  'evo 400': { brand: 'PrimaLuna', category: 'amplifier' },
  'evo 100': { brand: 'PrimaLuna', category: 'amplifier' },
  // Topping
  'd90': { brand: 'Topping', category: 'dac' },
  // SMSL
  'su-9': { brand: 'SMSL', category: 'dac' },
  // Gustard
  'x26 pro': { brand: 'Gustard', category: 'dac' },
  // LAiV
  'harmony dac': { brand: 'LAiV', category: 'dac' },
  // Audalytic
  'dr70': { brand: 'Audalytic', category: 'dac' },
  // FiiO
  'k9 pro': { brand: 'FiiO', category: 'dac' },
  // HiFiMAN
  ef400: { brand: 'HiFiMAN', category: 'dac' },
  // Goldmund
  srda: { brand: 'Goldmund', category: 'dac' },
  // JOB
  'job integrated': { brand: 'JOB', category: 'integrated' },
  'job int': { brand: 'JOB', category: 'integrated' },
  // Trends Audio
  'ta-10': { brand: 'Trends Audio', category: 'integrated' },
  'trends ta-10': { brand: 'Trends Audio', category: 'integrated' },
  // Crayon
  'cia-1': { brand: 'Crayon', category: 'integrated' },
  'cia-1t': { brand: 'Crayon', category: 'integrated' },
  // XSA
  vanguard: { brand: 'XSA', category: 'speaker' },
  // Hegel
  rost: { brand: 'Hegel', category: 'amplifier' },
  'hegel rost': { brand: 'Hegel', category: 'amplifier' },
  // Auralic
  vega: { brand: 'Auralic', category: 'dac' },
  'auralic vega': { brand: 'Auralic', category: 'dac' },
  // Marantz (vintage receivers)
  '2220b': { brand: 'Marantz', category: 'amplifier' },
  'marantz 2220b': { brand: 'Marantz', category: 'amplifier' },
  // Oppo (disc players)
  opdv971h: { brand: 'Oppo', category: 'dac' },
  'oppo opdv971h': { brand: 'Oppo', category: 'dac' },
  // Hornshoppe
  'hornshoppe horn': { brand: 'Hornshoppe', category: 'speaker' },
  'hornshoppe horns': { brand: 'Hornshoppe', category: 'speaker' },
  // Denafrips aliases
  'ares ii': { brand: 'Denafrips', category: 'dac' },
  'ares 15th': { brand: 'Denafrips', category: 'dac' },
  'enyo 15th': { brand: 'Denafrips', category: 'dac' },
  'enyo': { brand: 'Denafrips', category: 'dac' },
  'pontus 12th-1': { brand: 'Denafrips', category: 'dac' },
  // TotalDAC
  'd1-unity': { brand: 'TotalDAC', category: 'dac' },
  'd1-tube': { brand: 'TotalDAC', category: 'dac' },
  'd1-twelve': { brand: 'TotalDAC', category: 'dac' },
  // Denafrips extended
  'terminator ii': { brand: 'Denafrips', category: 'dac' },
  // Rockna
  wavelight: { brand: 'Rockna', category: 'dac' },
  wavedream: { brand: 'Rockna', category: 'dac' },
  // Holo Audio
  'may kte': { brand: 'Holo Audio', category: 'dac' },
  'holo may': { brand: 'Holo Audio', category: 'dac' },
  may: { brand: 'Holo Audio', category: 'dac' },
  spring: { brand: 'Holo Audio', category: 'dac' },
  // dCS
  'bartók': { brand: 'dCS', category: 'dac' },
  bartok: { brand: 'dCS', category: 'dac' },
  // Leben
  'leben cs600x': { brand: 'Leben', category: 'amplifier' },
  'leben cs600': { brand: 'Leben', category: 'amplifier' },
  'leben cs300x': { brand: 'Leben', category: 'amplifier' },
  'leben cs300': { brand: 'Leben', category: 'amplifier' },
  cs600x: { brand: 'Leben', category: 'amplifier' },
  cs600: { brand: 'Leben', category: 'amplifier' },
  cs300x: { brand: 'Leben', category: 'amplifier' },
  // Turntables
  'gyro se': { brand: 'Michell', category: 'turntable' },
  gyrodec: { brand: 'Michell', category: 'turntable' },
  // Tonearms (using 'turntable' category — no dedicated tonearm type)
  'sa1.2': { brand: 'Sorane', category: 'turntable' },
  // Cartridges
  'hsd 006': { brand: 'EMT', category: 'cartridge' },
  'zu/dl-103': { brand: 'Zu Audio', category: 'cartridge' },
  'spu mono': { brand: 'Ortofon', category: 'cartridge' },
  'spu classic': { brand: 'Ortofon', category: 'cartridge' },
  '2m black': { brand: 'Ortofon', category: 'cartridge' },
  '2m bronze': { brand: 'Ortofon', category: 'cartridge' },
  // Phono stages
  'vida mk.ii': { brand: 'Aurorasound', category: 'phono' },
  'vida mk.2': { brand: 'Aurorasound', category: 'phono' },
  'vida mkii': { brand: 'Aurorasound', category: 'phono' },
  vida: { brand: 'Aurorasound', category: 'phono' },
  'eq-100': { brand: 'Aurorasound', category: 'phono' },
  // Headphones
  'hd 600': { brand: 'Sennheiser', category: 'headphone' },
  'hd 650': { brand: 'Sennheiser', category: 'headphone' },
  'hd 800': { brand: 'Sennheiser', category: 'headphone' },
  'hd 800 s': { brand: 'Sennheiser', category: 'headphone' },
  sundara: { brand: 'HiFiMAN', category: 'headphone' },
  'edition xs': { brand: 'HiFiMAN', category: 'headphone' },
};

// ── Canonical product name display ────────────────────
// Some product names use non-standard capitalization (acronyms, model
// codes) that the naive `capitalize()` helper would mangle:
//   "p3esr"     → "P3esr"   (should be "P3ESR")
//   "cs300"     → "Cs300"   (should be "CS300")
//   "evo 300"   → "Evo 300" (should be "EVO 300")
//   "node x"    → "Node x"  (should be "NODE X")
// Keys are the same normalized lowercase used by PRODUCT_HINTS.
// When a key is present here, `displayName()` returns this canonical form
// instead of running `capitalize()`.

const CANONICAL_NAMES: Record<string, string> = {
  // Harbeth
  p3esr: 'P3ESR',
  'super hl5': 'Super HL5',
  'super hl5 plus': 'Super HL5 Plus',
  'hl5 plus': 'HL5 Plus',
  // Leben
  cs300: 'CS300',
  cs300x: 'CS300X',
  cs600: 'CS600',
  cs600x: 'CS600X',
  'leben cs300': 'Leben CS300',
  'leben cs300x': 'Leben CS300X',
  'leben cs600': 'Leben CS600',
  'leben cs600x': 'Leben CS600X',
  // PrimaLuna EVO line — brand uses uppercase "EVO"
  'evo 100': 'EVO 100',
  'evo 300': 'EVO 300',
  'evo 300 integrated': 'EVO 300 Integrated',
  'evo 400': 'EVO 400',
  // Bluesound NODE — brand styles model name in uppercase
  node: 'NODE',
  'node x': 'NODE X',
  'bluesound node': 'Bluesound NODE',
  'bluesound node x': 'Bluesound NODE X',
  // Denafrips Pontus / Ares / Venus / Terminator
  pontus: 'Pontus',
  'pontus ii': 'Pontus II',
  'pontus 12th-1': 'Pontus 12th-1',
  ares: 'Ares',
  'ares ii': 'Ares II',
  'ares 15th': 'Ares 15th',
  'ares 12th-1': 'Ares 12th-1',
  enyo: 'Enyo',
  'enyo 15th': 'Enyo 15th',
  venus: 'Venus',
  'venus ii': 'Venus II',
  terminator: 'Terminator',
  'terminator ii': 'Terminator II',
  // Chord — preserve capitalization on TT2
  'hugo tt2': 'Hugo TT2',
  'hugo tt': 'Hugo TT',
  tt2: 'TT2',
  // Eversolo
  'dmp-a6': 'DMP-A6',
  'dmp-a8': 'DMP-A8',
  'dac-z8': 'DAC-Z8',
  // SMSL
  'su-9': 'SU-9',
  // Topping
  d90: 'D90',
  // Holo Audio
  'may kte': 'May KTE',
  // FiiO
  'k9 pro': 'K9 Pro',
  ef400: 'EF400',
  // dCS
  bartok: 'Bartók',
  // HiFiMAN
  'hd 600': 'HD 600',
  'hd 650': 'HD 650',
  'hd 800': 'HD 800',
  'hd 800 s': 'HD 800 S',
};

/**
 * Display-friendly name for a normalized product key. Returns the canonical
 * form when present (preserves brand-conventional capitalization for
 * acronyms and model codes), otherwise falls back to first-letter
 * capitalization. Never mangles known canonical forms.
 */
function displayName(key: string): string {
  const lookup = CANONICAL_NAMES[key.toLowerCase()];
  if (lookup) return lookup;
  return capitalize(key);
}

// ── Ownership patterns ────────────────────────────────
// Must strongly indicate the user owns this gear, not merely asking about it.

const STRONG_OWNERSHIP_RE = [
  /\bi\s+have\b/i,
  /\bmy\s+(?:current\s+)?(?:system|setup|rig|chain|gear)\b/i,
  /\bi(?:'m|\s+am)\s+(?:running|using|driving|playing\s+through)\b/i,
  /\bi\s+(?:run|use|own)\b/i,
  /\bcurrent\s+(?:system|setup|rig|chain)\b.*:/i,       // "Current setup: ..."
  /\bmy\s+(?:dac|amp|amplifier|speakers?|headphones?|turntable|streamer)\b/i,
  // "this system:" / "here's my system:" — colon signals what follows is a component list
  /\b(?:this|here'?s?\s+(?:my|the|a))\s+(?:current\s+)?(?:system|setup|rig|chain)\s*:/i,
];

// ── Anti-patterns: aspirational, comparative, hypothetical ──

const ANTI_OWNERSHIP_RE = [
  /\bconsidering\b/i,
  /\bthinking\s+(?:about|of)\s+(?:getting|buying|trying)\b/i,
  /\bcompare\b/i,
  /\bvs\.?\b/i,
  /\bversus\b/i,
  /\bwhich\s+(?:is|would)\s+(?:be\s+)?better\b/i,
  /\bbetter\s+(?:than|for)\b/i,
  /\bshould\s+i\s+(?:get|buy|try)\b/i,
  /\brecommend\b/i,
  /\bbest\b.*\bunder\b/i,
];

// Secondary anti-patterns — only applied when NO assessment language is present.
// These block casual hypothetical questions but allow system descriptions paired
// with "what do you think?" or "how does this look?" style assessment requests.
const SOFT_ANTI_OWNERSHIP_RE = [
  /\bwould\s+(?:a|the)\b/i,
  /\bhow\s+(?:does|would|do)\b/i,
  /\bwhat\s+(?:dac|amp|speaker)\b/i,
];

// ── Assessment language ──────────────────────────────
// Signals that the user is asking for an evaluation of something they own.
// When these are present, soft anti-patterns (like "how does" or "what do you think")
// are not disqualifying — they're part of the assessment request.
const ASSESSMENT_LANGUAGE_RE = [
  /\bwhat\s+do\s+you\s+think\b/i,
  /\bthoughts\s+on\b/i,
  /\bhow\s+does\s+(?:this|that|my|the)\s+(?:system|setup|look|sound|work)\b/i,
  /\bassess/i,
  /\bevaluat/i,
  /\breview\b/i,
  /\bopinion\b/i,
  /\badvice\b/i,
  /\bimprove\b/i,
  /\bupgrade\b/i,
  /\bwhat\s+(?:should|would|could)\s+i\b/i,
];

// ── Generic component descriptors ─────────────────────
// Words that indicate a component type even without a recognized brand.
// Only used to augment subject matches with unrecognized gear.

const GENERIC_COMPONENT_RE: { pattern: RegExp; category: ProductCategory }[] = [
  { pattern: /\btube\s+(?:amp|amplifier|integrated)\b/i, category: 'amplifier' },
  { pattern: /\bsolid[- ]state\s+(?:amp|amplifier|integrated)\b/i, category: 'amplifier' },
  { pattern: /\bintegrated\s+amp(?:lifier)?\b/i, category: 'integrated' },
  { pattern: /\bpower\s+amp(?:lifier)?\b/i, category: 'amplifier' },
  { pattern: /\bpreamp(?:lifier)?\b/i, category: 'amplifier' },
  { pattern: /\bheadphone\s+amp\b/i, category: 'amplifier' },
  { pattern: /\bvinyl\s+(?:setup|rig|front\s+end)\b/i, category: 'turntable' },
  { pattern: /\bturntable\b/i, category: 'turntable' },
  { pattern: /\bstreamer\b/i, category: 'streamer' },
  { pattern: /\bphono\s+(?:stage|preamp)\b/i, category: 'phono' },
];

// ── Public API ──────────────────────────────────────────

/**
 * Detect whether a user message describes an owned audio system.
 *
 * Returns a ProposedSystem if there's strong evidence of ownership
 * language plus at least 2 recognizable component subjects.
 * Returns null otherwise.
 *
 * This function is intentionally conservative — it's better to
 * miss a system description than to prompt inappropriately.
 */
export function detectSystemDescription(
  currentMessage: string,
  subjectMatches: SubjectMatch[],
  audioState: AudioSessionState,
): ProposedSystem | null {
  // ── Gate 1: ownership language required ──
  const hasOwnership = STRONG_OWNERSHIP_RE.some((re) => re.test(currentMessage));
  if (!hasOwnership) return null;

  // ── Gate 2: anti-patterns disqualify ──
  const hasHardAntiPattern = ANTI_OWNERSHIP_RE.some((re) => re.test(currentMessage));
  if (hasHardAntiPattern) return null;

  // Soft anti-patterns only block when no assessment language is present.
  // This allows "I have X, Y, Z — what do you think?" to trigger the save prompt.
  const hasAssessmentLanguage = ASSESSMENT_LANGUAGE_RE.some((re) => re.test(currentMessage));
  if (!hasAssessmentLanguage) {
    const hasSoftAntiPattern = SOFT_ANTI_OWNERSHIP_RE.some((re) => re.test(currentMessage));
    if (hasSoftAntiPattern) return null;
  }

  // ── Gate 3: need at least 2 recognized subjects ──
  if (subjectMatches.length < 2) return null;

  // ── Build components from subject matches ──
  // Process products first, then brands. This allows us to suppress
  // brand-only matches when a product from that brand already exists,
  // and to skip substring products that are part of a longer product
  // name (e.g. "Hugo" when "Hugo TT2" is already matched).
  const components: DraftSystemComponent[] = [];
  const seen = new Set<string>();
  const coveredBrands = new Set<string>();

  // Pass 1: products (longer names sorted first to prevent substring dupes)
  const productMatches = subjectMatches
    .filter((m) => m.kind === 'product')
    .sort((a, b) => b.name.length - a.name.length);

  for (const match of productMatches) {
    const key = match.name.toLowerCase();
    if (seen.has(key)) continue;

    // Skip if this product name is a substring of an already-added product
    // from the same brand (e.g. "Hugo" when "Hugo TT2" already added).
    const hint = PRODUCT_HINTS[key];
    if (hint) {
      const alreadyHasLonger = components.some(
        (c) => c.brand.toLowerCase() === hint.brand.toLowerCase()
          && c.name.toLowerCase().includes(key),
      );
      if (alreadyHasLonger) continue;
    }

    seen.add(key);

    if (hint) {
      // Use the matched normalized key for canonical lookup so e.g.
      // "p3esr" → "P3ESR" instead of being mangled to "P3esr".
      components.push({
        brand: hint.brand,
        name: displayName(key),
        category: hint.category,
        role: null,
      });
      coveredBrands.add(hint.brand.toLowerCase());
      // CRITICAL: also claim the brand name in `seen` so a subsequent
      // un-hinted product (e.g. "ex-m1+") cannot rebind to this brand.
      // Without this, multi-brand inputs like
      //   "LAiV Harmony DAC, Kinki Studio EX-M1+, Qualio IQ"
      // would bleed: "harmony dac" sets coveredBrands:laiv but seen lacks
      // "used:laiv", so "ex-m1+" later claims laiv by first-available.
      seen.add(`used:${hint.brand.toLowerCase()}`);
    } else {
      // Suppress overlapping duplicate products (e.g. both "kinki studio ex-m1"
      // and "ex-m1+" match the same physical device). If the source-text span
      // of this product overlaps any already-pushed component's source-text
      // span, skip it. We only apply this to un-hinted products because
      // hinted products are authoritative by design.
      const productIdx = match.index;
      if (typeof productIdx === 'number') {
        const productEnd = productIdx + match.name.length;
        const overlaps = components.some((c) => {
          const cName = c.name.toLowerCase();
          if (!cName) return false;
          const cStart = currentMessage.toLowerCase().indexOf(cName);
          if (cStart < 0) return false;
          const cEnd = cStart + cName.length;
          return productIdx < cEnd && productEnd > cStart;
        });
        if (overlaps) continue;
      }

      // Product without known hint — first check if the product name
      // contains an embedded brand (e.g. "bluesound node x" contains
      // "bluesound", "kinki studio ex-m1" contains "kinki studio"). Scan
      // both the subjectMatches brand set and the full BRAND_CATEGORY_MAP,
      // because a brand's character span may have been claimed by the
      // product match (so the brand won't appear in subjectMatches).
      let embeddedBrand: { name: string } | undefined = subjectMatches.find(
        (m) => m.kind === 'brand' && match.name.toLowerCase().includes(m.name.toLowerCase()),
      );
      if (!embeddedBrand) {
        const matchLower = match.name.toLowerCase();
        // Prefer longer brand names first (e.g. "kinki studio" over "kinki").
        const candidates = Object.keys(BRAND_CATEGORY_MAP)
          .filter((b) => matchLower.includes(b))
          .sort((a, b) => b.length - a.length);
        if (candidates.length > 0) embeddedBrand = { name: candidates[0] };
      }
      if (embeddedBrand) {
        seen.add(`used:${embeddedBrand.name.toLowerCase()}`);
        coveredBrands.add(embeddedBrand.name.toLowerCase());
        components.push({
          brand: capitalize(embeddedBrand.name),
          name: displayName(match.name),
          category: BRAND_CATEGORY_MAP[embeddedBrand.name.toLowerCase()] ?? 'other',
          role: null,
        });
      } else {
        // Proximity-based brand selection: among unused brands, pick the one
        // whose source-text position is closest to this product's position.
        // Falls back to first-available if indices are missing.
        const availableBrands = subjectMatches.filter(
          (m) => m.kind === 'brand' && !m.parenthetical
            && !seen.has(`used:${m.name.toLowerCase()}`),
        );
        let brandMatch: SubjectMatch | undefined;
        if (typeof productIdx === 'number' && availableBrands.some((b) => typeof b.index === 'number')) {
          brandMatch = availableBrands
            .filter((b) => typeof b.index === 'number')
            .sort((a, b) => {
              const da = Math.abs((a.index as number) - productIdx);
              const db = Math.abs((b.index as number) - productIdx);
              return da - db;
            })[0] ?? availableBrands[0];
        } else {
          brandMatch = availableBrands[0];
        }
        if (brandMatch) {
          seen.add(`used:${brandMatch.name.toLowerCase()}`);
          coveredBrands.add(brandMatch.name.toLowerCase());
          components.push({
            brand: capitalize(brandMatch.name),
            name: displayName(match.name),
            category: BRAND_CATEGORY_MAP[brandMatch.name.toLowerCase()] ?? 'other',
            role: null,
          });
        } else {
          components.push({
            brand: '',
            name: displayName(match.name),
            category: 'other',
            role: null,
          });
        }
      }
    }
  }

  // Pass 2: brands — only add if no product from this brand already exists.
  // This prevents "Chord" from appearing as a separate component when
  // "Hugo TT2" (brand: Chord) is already in the list.
  for (const match of subjectMatches) {
    if (match.kind !== 'brand') continue;
    const key = match.name.toLowerCase();
    if (seen.has(key)) continue;
    if (coveredBrands.has(key)) continue; // brand already represented by a product

    // Also suppress when a variant of the same brand is already covered.
    // e.g. "zu" should be suppressed when "zu audio" is covered, and vice versa.
    const isBrandVariantCovered = [...coveredBrands].some(
      (cb) => cb.startsWith(key) || key.startsWith(cb),
    );
    if (isBrandVariantCovered) continue;

    seen.add(key);
    const category = BRAND_CATEGORY_MAP[key] ?? 'other';
    components.push({
      brand: capitalize(match.name),
      name: '',  // Brand-only — user can fill in model in editor
      category,
      role: null,
    });
  }

  // Also pick up generic component descriptors not in subject matches.
  //
  // Label-word guard: in labeled chains like
  //   "speakers: wlm diva - amp: job integrated - streamer: eversolo dmp-a6"
  // the bare words "streamer", "turntable", "preamp", etc. are role LABELS
  // naming the slot that follows, not components in their own right.
  // When the match is immediately followed by a ':' (optionally with trailing
  // whitespace), treat that occurrence as a label and do not promote it.
  // This preserves the intended behavior of flagging unbranded descriptors
  // like "I have a streamer and some monitors" where no colon follows.
  //
  // Scan every occurrence (not just the first) so a labeled use earlier in
  // the sentence doesn't prevent finding a legitimate descriptor later.
  const isLabelAt = (endIdx: number): boolean => {
    let i = endIdx;
    while (i < currentMessage.length && /\s/.test(currentMessage[i])) i++;
    return i < currentMessage.length && currentMessage[i] === ':';
  };

  for (const { pattern, category } of GENERIC_COMPONENT_RE) {
    // Compile a global version of the pattern for iteration.
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    let matchResult: RegExpExecArray | null;
    let promoted = false;
    while ((matchResult = globalPattern.exec(currentMessage)) !== null) {
      const desc = matchResult[0];
      const matchIdx = matchResult.index;
      if (isLabelAt(matchIdx + desc.length)) continue;

      const descKey = desc.toLowerCase();
      if (!seen.has(descKey) && !components.some((c) => c.name.toLowerCase() === descKey)) {
        seen.add(descKey);
        components.push({
          brand: '',
          name: desc,
          category,
          role: null,
        });
      }
      promoted = true;
      break; // one descriptor per pattern, matching the prior behavior
    }
    void promoted;
  }

  // ── Gate 4: need at least 2 real components ──
  if (components.length < 2) return null;

  // ── Build fingerprint for duplicate suppression ──
  const fingerprint = buildFingerprint(components);

  // ── Gate 5: check for duplicate against active system ──
  if (isDuplicateOfActiveSystem(fingerprint, audioState)) return null;

  // ── Gate 6: check for duplicate against previously dismissed proposal ──
  // (handled externally via dismissedFingerprints in page.tsx)

  // ── Build suggested name (checks known systems registry) ──
  const suggestedName = suggestSystemName(components);

  // ── Check for known system match ──
  // Phase C blocker fix #5: only surface a named-reviewer attribution
  // when the core overlap is a full 1.0. Partial (≥0.66) matches are
  // frequently coincidental for common brand chains and produce
  // reviewer-attribution claims the advisor cannot defend (§5
  // Confidence Calibration). The SystemSavePrompt UI that shows
  // "(partial match)" next to the attribution label is therefore
  // never reached for partials under this rule.
  const knownMatch = findKnownSystemMatch(components);
  const knownSystemMatch = knownMatch && knownMatch.coreOverlap >= 1.0
    ? {
        id: knownMatch.system.id,
        label: knownMatch.system.label,
        attribution: knownMatch.system.attribution,
        philosophy: knownMatch.system.philosophy,
        coreOverlap: knownMatch.coreOverlap,
      }
    : null;

  return {
    suggestedName,
    components,
    sourceQuery: currentMessage,
    fingerprint,
    ...(knownSystemMatch ? { knownSystemMatch } : {}),
  };
}

// ── Helpers ────────────────────────────────────────────

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Build a stable fingerprint from component list for dedup.
 * Sorted, lowercased brand+name joined with |.
 */
function buildFingerprint(components: DraftSystemComponent[]): string {
  return components
    .map((c) => `${c.brand.toLowerCase().trim()}:${c.name.toLowerCase().trim()}`)
    .sort()
    .join('|');
}

/**
 * Check if the proposed system is substantially the same as the active system.
 * Uses component brand+name overlap — if 70%+ of proposed components match
 * the active system, consider it a duplicate.
 */
function isDuplicateOfActiveSystem(
  fingerprint: string,
  state: AudioSessionState,
): boolean {
  const { activeSystemRef, savedSystems, draftSystem } = state;
  if (!activeSystemRef) return false;

  let activeComponents: Array<{ brand: string; name: string }> = [];

  if (activeSystemRef.kind === 'draft' && draftSystem) {
    activeComponents = draftSystem.components;
  } else if (activeSystemRef.kind === 'saved') {
    const saved = savedSystems.find((s) => s.id === activeSystemRef.id);
    if (saved) activeComponents = saved.components;
  }

  if (activeComponents.length === 0) return false;

  const activeFingerprint = activeComponents
    .map((c) => `${c.brand.toLowerCase().trim()}:${c.name.toLowerCase().trim()}`)
    .sort()
    .join('|');

  // Exact match
  if (fingerprint === activeFingerprint) return true;

  // Partial overlap: count matching segments
  const proposedParts = new Set(fingerprint.split('|'));
  const activeParts = activeFingerprint.split('|');
  const matches = activeParts.filter((p) => proposedParts.has(p)).length;

  // If 70%+ of active components appear in proposed, treat as duplicate
  return activeParts.length > 0 && matches / activeParts.length >= 0.7;
}

/**
 * Suggest a system name from component list.
 *
 * Priority:
 *   1. Known system match (e.g., "Michael Lavorgna's reference system")
 *   2. Generic category-based name (e.g., "Speaker System")
 */
function suggestSystemName(components: DraftSystemComponent[]): string {
  // Check known systems registry
  const knownMatch = findKnownSystemMatch(components);
  if (knownMatch) {
    const knownName = suggestKnownSystemName(knownMatch);
    if (knownName) return knownName;
  }

  const categories = new Set(components.map((c) => c.category));
  if (categories.has('headphone') || categories.has('iem')) {
    return 'Headphone System';
  }
  if (categories.has('speaker')) {
    return 'Speaker System';
  }
  return 'My System';
}
