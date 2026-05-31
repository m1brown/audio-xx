'use client';

// React imported explicitly for vitest node-env JSX classic transform.
import React from 'react';

import type { AdvisoryResponse } from '@/lib/advisory-response';
import { COLOR, sectionHeadingStyle, proseStyle } from '@/lib/editorial-tokens';
import { hasDisplayableSources } from '@/lib/evidence/source-whitelist';
import { findProductByComponentName } from '@/lib/consultation';
import { resolveProductImageStrict, getProductImage } from '@/lib/product-images';

import SystemHero from './SystemHero';
import SystemProfileCard from './SystemProfileCard';
import EditorialSubCard from './EditorialSubCard';
import AdvisoryUpgradePaths from './AdvisoryUpgradePaths';
import AdvisorySources from './AdvisorySources';

/**
 * Presentation-layer normalization of §5 *The Components* card content.
 *
 * Solves three editorial problems present in the engine's raw
 * componentReadings output:
 *
 *   1. ORDER DRIFT — `systemChain.names` is sorted by role (signal-path
 *      order: source → amp → speakers) while `componentReadings` is
 *      produced in the components' input order. Index-based mapping
 *      between the two arrays produces swapped card content (e.g. the
 *      Denafrips card shows the Leben description). Each engine reading
 *      begins with "The ${displayName}" so identity-mapping by prefix
 *      is robust.
 *
 *   2. OFF-CHAIN DRIFT — engine readings can mention products outside
 *      the user's chain (e.g. the Leben CS600X reading wanders into
 *      the CS300X desktop headphone amplifier). For a section about
 *      THIS chain, sentences referencing products NOT in the chain
 *      are stripped.
 *
 *   3. LENGTH IMBALANCE — engine readings vary from ~25 to ~80 words.
 *      The cards look editorially uneven. After stripping, the reading
 *      is trimmed at sentence boundaries to a consistent target.
 *
 * No engine changes. No reordering of the engine's componentReadings
 * array; only how the artifact maps readings to the rendered cards.
 */

/**
 * Sentence-split heuristic: split on `.`, `!`, `?` followed by whitespace
 * or end-of-text.
 *
 * Hardening Phase A — B1 fix. The previous regex-only implementation
 * (`/[^.!?]+[.!?]+(?:\s|$)/g`) silently discarded any prefix that
 * failed to match. When a sentence contained a decimal inside a chain
 * component model number (e.g. "Harbeth 30.2", "Magnepan 3.7i",
 * "Pioneer 8351") the punctuation was followed by a digit instead of
 * whitespace, the regex slid forward past the unmatched prefix, and
 * the `match()` call returned only the second half of the sentence —
 * producing rendered fragments like "2 XD is voiced warm" or "7i is
 * a low-efficiency planar magnetic". This walked-character rewrite:
 *
 *   1. Treats `.`, `!`, `?` as a sentence boundary ONLY when the next
 *      character is whitespace or end-of-text. A digit immediately
 *      after the punctuation marks decimal usage (model number, spec
 *      value) and the boundary is rejected.
 *   2. Always preserves any tail content. There is no silent prefix
 *      drop: every input character ends up in exactly one returned
 *      sentence.
 *
 * This is the smallest correctness fix. Heading-toleration and other
 * formal sentence-splitter behavior remain out of scope.
 */
function splitSentences(text: string): string[] {
  if (!text) return [];
  const sentences: string[] = [];
  let buf = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    buf += c;
    if (c === '.' || c === '!' || c === '?') {
      const next = text[i + 1];
      // Decimal-inside-model-number guard: keep building when the
      // ender is immediately followed by a digit (e.g. "30.2", "3.7i").
      if (next !== undefined && /\d/.test(next)) continue;
      const trimmed = buf.trim();
      if (trimmed.length > 0) sentences.push(trimmed);
      buf = '';
    }
  }
  // Preserve any trailing fragment (no final ender, or ender-then-digit
  // that never closed). Never silently drop.
  const tail = buf.trim();
  if (tail.length > 0) sentences.push(tail);
  return sentences;
}

/**
 * Find the engine reading that matches a given component name.
 *
 * Engine paragraphs begin with `"The ${displayName}"` (see
 * `consultation.ts` componentParagraphs map). We match by case-insensitive
 * prefix. If no reading matches the name's prefix, fall back to the
 * positional reading at the same name index — preserves legacy behavior
 * for the unlikely case that the engine output drifts from the prefix
 * convention.
 */
function findReadingForName(
  name: string,
  readings: string[],
  fallbackIndex: number,
): string | undefined {
  const target = `the ${name.toLowerCase()}`;
  const matched = readings.find((r) => r.toLowerCase().startsWith(target));
  return matched ?? readings[fallbackIndex];
}

/**
 * Determine whether a sentence references any product NOT in the user's
 * current chain. Uses a conservative heuristic:
 *
 *   - Identify candidate model tokens in the sentence (uppercase letter
 *     followed by digits/letters, e.g. `CS300`, `CS300X`, `O/96`).
 *   - For each candidate, check whether it appears in the chain
 *     (substring match against any chain name).
 *   - If a candidate is present but does NOT appear in any chain name,
 *     the sentence is "off-chain".
 *
 * Intentionally conservative — only drops sentences containing a clearly
 * model-like token that has no chain match. Sentences with descriptive
 * prose only (no model token) are always retained.
 */
function sentenceMentionsOffChainProduct(
  sentence: string,
  chainNames: string[],
): boolean {
  const chainLower = chainNames.map((n) => n.toLowerCase());
  // Candidate model tokens: at least 2 consecutive capital letters
  // followed by at least 2 digits, optionally followed by capitals.
  // This shape catches real product/tube model numbers like:
  //   - CS300, CS300X, CS600X (Leben)
  //   - KT77, KT88, EL34 (tube types — also product-spec drift)
  //   - QB9 (Ayre), L509Z (Luxman), TS500 — anywhere a multi-letter
  //     prefix carries digits.
  // It intentionally does NOT match:
  //   - Topology shorthand like "R2R" (single leading capital)
  //   - Roman numerals like "II" (no digits)
  //   - Acronyms like "USB", "DSD", "MQA" (no digits)
  //   - Bare numbers like "300B" or "32W" (no leading capitals)
  //   - Mixed-case names like "DeVore" or "O/96" (no [A-Z]{2,} prefix)
  // This shape is conservative: when in doubt, the sentence is kept.
  // The user said the Leben CS300X drift is the canonical off-chain
  // example to catch; the regex is calibrated for that pattern.
  const tokens = sentence.match(/\b[A-Z]{2,}\d{2,}[A-Z]*\b/g) ?? [];
  for (const token of tokens) {
    const t = token.toLowerCase();
    const inChain = chainLower.some((cn) => cn.includes(t));
    if (!inChain) return true;
  }
  return false;
}

/**
 * Presentation-layer fact extraction from a component reading.
 *
 * The engine's `componentReadings[i]` arrive as product-review prose
 * ("flagship push-pull tube integrated", "warm-tube reference R2R DAC",
 * "canonical low-power-tube speaker"). For §5 to read as a system
 * walkthrough rather than as catalog blurbs, the artifact extracts
 * structured *facts* (topology, technology family, tube types,
 * efficiency, cabinet shape, drivers, tonal lean) and recomposes the
 * body presentationally — the reading text itself is no longer
 * displayed verbatim.
 *
 * Only conservative, well-anchored regex matches are accepted as
 * facts. Anything ambiguous is left out so the composed body remains
 * factually accurate.
 */
interface CharacterFacts {
  /**
   * Conversion topology (DAC) or amplification topology (amp).
   * Hardening Phase C adds FPGA + Ring DAC as recognized DAC
   * topologies for the source-card depth pass.
   */
  topology?:
    | 'R2R'
    | 'delta-sigma'
    | 'multibit'
    | 'FPGA'
    | 'Ring DAC'
    | 'push-pull'
    | 'single-ended'
    | 'class-A'
    | 'class-AB'
    | 'class-D';
  /** Active-device family. */
  tech?: 'tube' | 'solid-state' | 'hybrid';
  /** Power-tube types found in the reading. */
  tubeTypes: string[];
  /** Speaker efficiency category. */
  efficiency?: 'high' | 'low';
  /** Cabinet / dispersion shape. */
  cabinet?: 'wide-baffle' | 'narrow-baffle' | 'open-baffle' | 'sealed' | 'bass-reflex' | 'horn-loaded';
  /** Notable driver types. */
  drivers: string[];
  /** Implied tonal lean from descriptors. */
  tonalLean?: 'warm' | 'lean' | 'neutral' | 'forward' | 'recessed';
}

const TUBE_MODEL_RE = /\b(KT[- ]?\d{2,3}|EL[- ]?\d{2,3}|6L6|6V6|300B|2A3|45|211|845|7591|6SN7|6SL7|12AX7|6922|ECC83|ECC88|EF86)\b/gi;

function extractCharacterFacts(
  reading: string | undefined,
  role: string | undefined,
): CharacterFacts {
  const facts: CharacterFacts = { tubeTypes: [], drivers: [] };
  if (!reading) return facts;
  const text = reading.toLowerCase();
  const family = roleFamily(role);

  // Topology — source families
  if (family === 'source') {
    // Hardening Phase C — Ring DAC + FPGA detection ranks BEFORE the
    // generic R2R / delta-sigma fall-throughs because dCS Ring DAC is
    // a discrete FPGA-driven topology with its own editorial framing,
    // and a Chord / Hugo / Bricasti FPGA conversion is also worth
    // surfacing distinctly.
    if (/\bring\s+dac\b/.test(text)) facts.topology = 'Ring DAC';
    else if (/\bfpga\b/.test(text)) facts.topology = 'FPGA';
    else if (/\br2r\b|\bresistor[- ]?ladder\b/.test(text)) facts.topology = 'R2R';
    else if (/\bdelta[- ]?sigma\b/.test(text)) facts.topology = 'delta-sigma';
    else if (/\bmulti[- ]?bit\b/.test(text)) facts.topology = 'multibit';
  }
  // Topology — amplifier families (checked even for source so an
  // integrated amp described in source register doesn't escape).
  if (/\bpush[- ]pull\b/.test(text)) facts.topology = 'push-pull';
  else if (/\bsingle[- ]ended\b|\bset\b(?!.*box)/.test(text)) facts.topology = 'single-ended';
  else if (/\bclass[- ]?a\b(?!b)/.test(text)) facts.topology = facts.topology ?? 'class-A';
  else if (/\bclass[- ]?ab\b/.test(text)) facts.topology = facts.topology ?? 'class-AB';
  else if (/\bclass[- ]?d\b/.test(text)) facts.topology = facts.topology ?? 'class-D';

  // Tech family
  if (/\btube\b|\bvalve\b/.test(text)) facts.tech = 'tube';
  else if (/\bsolid[- ]state\b|\btransistor\b|\bmosfet\b|\bbipolar\b/.test(text)) facts.tech = 'solid-state';
  else if (/\bhybrid\b/.test(text)) facts.tech = 'hybrid';

  // Tube types
  const matches = reading.match(TUBE_MODEL_RE) ?? [];
  facts.tubeTypes = Array.from(
    new Set(matches.map((t) => t.toUpperCase().replace(/[- ]/g, ''))),
  );

  // Efficiency (speaker)
  if (/\bhigh[- ]efficiency\b|\b(?:9[5-9]|10\d|11\d)\s?db\b/.test(text)) facts.efficiency = 'high';
  else if (/\blow[- ]efficiency\b|\b(?:8[0-4])\s?db\b/.test(text)) facts.efficiency = 'low';

  // Cabinet
  if (/\bwide[- ]baffle\b/.test(text)) facts.cabinet = 'wide-baffle';
  else if (/\bnarrow[- ]baffle\b/.test(text)) facts.cabinet = 'narrow-baffle';
  else if (/\bopen[- ]baffle\b/.test(text)) facts.cabinet = 'open-baffle';
  else if (/\bsealed\b/.test(text)) facts.cabinet = 'sealed';
  else if (/\bbass[- ]reflex\b|\bported\b/.test(text)) facts.cabinet = 'bass-reflex';
  else if (/\bhorn[- ]loaded\b|\bhorn\b/.test(text)) facts.cabinet = 'horn-loaded';

  // Drivers
  if (/\bheil\b|\bamt\b/.test(text)) facts.drivers.push('Heil-style AMT tweeter');
  if (/\bribbon\b/.test(text)) facts.drivers.push('ribbon tweeter');
  if (/\bberyllium\b/.test(text)) facts.drivers.push('beryllium tweeter');
  if (/\bsoft[- ]dome\b|\bsilk[- ]dome\b/.test(text)) facts.drivers.push('soft-dome tweeter');
  if (/\bcompression driver\b/.test(text)) facts.drivers.push('compression driver');

  // Tonal lean
  if (/\bwarm[- ]tube\b|\bwarm voicing\b|\bwarm\b/.test(text)) facts.tonalLean = 'warm';
  else if (/\bneutral[- ]?lean\b|\blean voicing\b|\blean\b/.test(text)) facts.tonalLean = 'lean';
  else if (/\bneutral\b/.test(text)) facts.tonalLean = 'neutral';
  else if (/\bforward\b/.test(text)) facts.tonalLean = 'forward';
  else if (/\brecessed\b|\bpolite\b/.test(text)) facts.tonalLean = 'recessed';

  return facts;
}

/**
 * Group component roles into editorial families.
 *
 * The three families ("source", "amplifier", "speaker") each get a
 * distinct contribution narrative — source establishes the system's
 * voice, amplifier carries and shapes it, speaker translates it into
 * sound. The body composer dispatches on this grouping.
 */
function roleFamily(role: string | undefined): 'source' | 'amplifier' | 'speaker' | 'unknown' {
  if (!role) return 'unknown';
  const r = role.toLowerCase();
  // Hardening Phase B B9 — amplifier match precedes source match.
  //
  // Previously `streamer|dac|...` was checked first, so any role
  // containing "streamer" — including compound roles like "All-in-One
  // Streamer Amplifier", "Streaming Integrated Amplifier", "Network
  // Receiver", "Powered Streaming Amplifier" — was classified as
  // 'source'. That misled §5 prose into emitting source-family
  // ledes ("establishes the character of the signal feeding...") for
  // components that are primarily amplifiers with built-in source
  // access. Now the amplifier-family regex runs first; any role
  // mentioning preamp / integrated / monoblock / power amp /
  // amplifier / receiver matches as 'amplifier' regardless of any
  // "streamer" / "network" / "streaming" qualifier in the same
  // string. Pure-source roles ("DAC", "Streamer", "Streamer/DAC",
  // "Turntable") still fall through to the source check unchanged.
  // Hardening Phase C — phono preamps live in the source chain (a
  // phono stage extracts cartridge signal and applies RIAA EQ; it is
  // analytically a source even when its role string says "preamp").
  // Detected BEFORE the general preamp / amplifier check so it can
  // route to the source-family second-sentence template.
  if (/\bphono\b/.test(r)) return 'source';
  if (/preamp|integrated|monoblock|power amp|amplifier|amp\b|receiver/.test(r)) return 'amplifier';
  if (/dac|streamer|transport|turntable|cartridge|cd player|phono|source/.test(r)) return 'source';
  // Hardening Phase C — extend the speaker family to include
  // subwoofers (so the §5 composer can branch to a low-frequency-
  // extension template instead of falling to the unknown-role
  // generic prose) and n-way speaker descriptors (so fixtures whose
  // role text says "Active 3-way" or "Passive 2-way" without the
  // word "speaker" are still recognized as the speaker family).
  if (/speaker|transducer|headphone|monitor|subwoofer|\d[\s-]?way/.test(r)) return 'speaker';
  return 'unknown';
}

/**
 * Hardening Phase C — detect chain names that are syntactically plural
 * because they refer to a pair of monoblock amplifiers or an explicit
 * multiplier (×2, x2, (2x)).
 *
 * Pre-Phase-C templates hard-coded singular verbs ("carries", "drives",
 * "delivers") which produced grammatically-wrong output for chain
 * entries like "Bricasti M28 monoblocks (2x)" or "Audio Research
 * Ref 160M monoblocks". This helper marks such entries so the
 * downstream verb selection can pluralize.
 *
 * Scope is intentionally narrow per the Phase C spec:
 *   - "monoblocks" / "monos" / "mono blocks" / "mono amps" trailing
 *     the chain name (case-insensitive)
 *   - parenthesized multiplier "(2x)", "(×2)", "(2 x)" anywhere
 *   - inline multiplier "x2", "× 2" (with or without space)
 *
 * A singular "monoblock" (no terminal s) is treated as singular —
 * one monoblock amp.
 */
function chainNameIsPlural(name: string | undefined): boolean {
  if (!name) return false;
  const t = name.trim();
  // Parenthesized multiplier or trailing multiplier
  if (/\(\s*[2-9]\s*[x×]?\s*\)/i.test(t)) return true;
  if (/[x×]\s*[2-9]\b/i.test(t)) return true;
  // Trailing plural amp-pair noun
  if (/\b(?:monoblocks|monos|mono\s+blocks|mono\s+amps)\b\s*$/i.test(t)) return true;
  // Same plural noun followed by a parenthesized qualifier
  if (/\b(?:monoblocks|monos|mono\s+blocks|mono\s+amps)\b\s+\(/i.test(t)) return true;
  return false;
}

/**
 * Hardening Phase C — verb pluralization for plural chain-entry subjects.
 *
 * Map of singular → plural English verbs used inside composer
 * templates. Whitelist-only — verbs not in the map pass through
 * unchanged, so the helper is safe even when a future template
 * introduces a new verb.
 *
 * Only invoked from inside templates where the subject is known to
 * be a chain entry that has passed `chainNameIsPlural` (which is the
 * only signal we trust). Sentence-internal relative clauses ("what
 * the [upstream] delivers") use the upstream's plurality, not the
 * sentence subject's.
 */
const PLURAL_VERB_MAP: Record<string, string> = {
  carries: 'carry',
  drives: 'drive',
  delivers: 'deliver',
  translates: 'translate',
  combines: 'combine',
  establishes: 'establish',
  sits: 'sit',
  sets: 'set',
  accepts: 'accept',
  shapes: 'shape',
  takes: 'take',
  hands: 'hand',
  pairs: 'pair',
};

function verbForSubject(verb: string, isPlural: boolean): string {
  if (!isPlural) return verb;
  return PLURAL_VERB_MAP[verb] ?? verb;
}

/**
 * Hardening Phase B B9 — detect compound all-in-one / streamer-amplifier
 * roles within the amplifier family.
 *
 * After the roleFamily reorder above, roles like "All-in-One Streamer
 * Amplifier", "Streaming Integrated Amplifier", or "Network Receiver"
 * are classified as 'amplifier'. But they are NOT power amplifiers —
 * they bundle source access (streaming, DAC) + amplification in a
 * single chassis. The §5 contribution prose for power amps ("carries
 * the signal between the [upstream] and the [downstream]") reads wrong
 * for an all-in-one when there is no upstream source separate from it.
 *
 * This helper identifies the all-in-one subtype so the §5 composer
 * can branch to a role-correct lede that names the combined source +
 * amplification function. Pure integrated amplifiers (no streaming
 * / network / powered qualifier) still flow through the regular
 * amplifier branch.
 *
 * MATCH:
 *   - "all-in-one" / "all in one" / "allinone"
 *   - streamer / streaming / network / powered + amp / integrated / receiver
 *     (compound — both halves required)
 * REJECT:
 *   - Plain "Integrated Amplifier" / "Power Amplifier" / "Monoblock"
 *   - "Headphone Amplifier" (already handled in §5 speaker branch via
 *     the surface-phrase swap)
 */
function isAllInOne(role: string | undefined): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  if (/headphone/.test(r)) return false;
  if (/all[\s-]?in[\s-]?one/.test(r)) return true;
  const sourceTag = /streamer|streaming|network|powered/.test(r);
  const ampTag = /amp|integrated|receiver/.test(r);
  return sourceTag && ampTag;
}

/**
 * Hardening Phase C — detect subwoofer role.
 *
 * Subwoofers occupy a separate functional position from main
 * loudspeakers: they extend low-frequency reach rather than
 * carrying the full musical picture. The §5 composer needs a
 * subwoofer-specific lede so chains with REL / SVS / KEF Kube
 * components do not fall to the generic unknown-role fallback
 * ("sits inside this system as the subwoofer") nor get treated
 * as full-range speakers.
 */
function isSubwoofer(role: string | undefined): boolean {
  if (!role) return false;
  return /\bsubwoofers?\b|\bsubs?\b/i.test(role);
}

/**
 * Hardening Phase C — detect active / powered loudspeakers.
 *
 * Active speakers integrate amplification + driver alignment in
 * the cabinet; the §5 composer needs to reflect that the upstream
 * source is feeding a complete playback system rather than a
 * passive load. Matches "active speaker", "powered speaker",
 * "powered monitor", "active monitor", and the compound forms with
 * an explicit n-way descriptor ("active 3-way").
 */
function isActiveSpeaker(role: string | undefined): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  if (isSubwoofer(role)) return false;
  if (/active\s+(?:studio\s+)?monitor/.test(r)) return true;
  if (/active\s+(?:speaker|loudspeaker|3[-\s]?way|2[-\s]?way|4[-\s]?way)/.test(r)) return true;
  if (/powered\s+(?:speaker|loudspeaker|monitor)/.test(r)) return true;
  return false;
}

/**
 * Hardening Phase C — narrower detector for the studio-monitor
 * sub-variant of an active speaker. Used to choose between the
 * standard active-speaker prose and the studio-monitor-specific
 * framing ("functions as an active monitor: amplification, driver
 * control, and cabinet behavior are handled inside the speaker
 * rather than delegated to an external amplifier"). Returns false
 * for general powered home loudspeakers (KEF LS60 Wireless etc.).
 */
function isStudioMonitor(role: string | undefined): boolean {
  if (!role) return false;
  return /\bactive\s+studio\s+monitor\b|\bstudio\s+monitor\b/i.test(role);
}

/**
 * Commit 13 — detect line-stage preamplifiers within the `amplifier`
 * role family.
 *
 * `roleFamily` collapses preamps, integrated amplifiers, monoblocks,
 * and power amplifiers into a single `'amplifier'` bucket because most
 * leverage / hierarchy / family-dedup logic treats them the same way.
 * §5 contribution prose is the exception — preamps and power amps
 * contribute very different things to the system, and writing about a
 * preamp as "driving the speakers" is inaccurate. This helper identifies
 * the preamp sub-class so the §5 composer can branch.
 *
 * MATCH: bare `preamp`, `pre-amp`, `pre amp`, `linestage`, `line stage`,
 *        `line-level`, `line stage preamplifier`.
 * REJECT: `power amp`, `power amplifier`, `integrated`, `monoblock`,
 *        `headphone amp` (treated as `amplifier` for §5 prose but flows
 *        into the speaker-family card for the headphone tail; not a
 *        preamp).
 *
 * Keeping the regex narrow and explicit (not a generic `/pre/i`) avoids
 * matching unrelated role strings ("presentation amplifier" is not real,
 * but a regex that catches "presence" or "prestige" would be wrong).
 */
function isPreampRole(role: string | undefined): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  if (/power[\s-]?amp/.test(r)) return false;
  if (/integrated/.test(r)) return false;
  if (/monoblock/.test(r)) return false;
  if (/headphone/.test(r)) return false;
  return /(?:^|\s|-)(?:preamp|pre[\s-]amp|line[\s-]?stage|linestage|line[\s-]?level)/.test(r);
}

// ──────────────────────────────────────────────────────────
// Pass 23 (Commit 7) — §9 destination + mature-component protection.
// ──────────────────────────────────────────────────────────
//
// The recommended-sequence steps in §9 are emitted symmetrically by
// the engine regardless of whether the change target is a
// low-leverage component (streamer, DAC, cables) or a destination-
// class component the engine should not casually recommend replacing.
// For the Phase K chain (Pontus II → Leben CS600X → DeVore O/96)
// the realistic leverage ranking is streamer > DAC > infrastructure
// > amp > speakers. The DeVore O/96 is a destination-level
// high-efficiency wide-baffle loudspeaker; the Leben CS600X is a
// mature push-pull tube integrated whose replacement materially
// changes system identity rather than upgrading it.
//
// These helpers detect those classes and surface a one-sentence
// editorial caveat via the EditorialSubCard.verdict slot when a §9
// step targets such a component. No engine changes; the engine's
// action text passes through unmodified.

const HERITAGE_TUBE_BRANDS = new Set([
  'leben', 'shindo', 'audio note', 'luxman', 'pass labs',
  'line magnetic', 'air tight', 'cary', 'manley', 'vac',
]);

const DESTINATION_PRICE_TIERS = new Set(['high-end', 'statement', 'reference']);

const DESTINATION_CABINETS = new Set<NonNullable<CharacterFacts['cabinet']>>([
  'wide-baffle', 'open-baffle', 'horn-loaded',
]);

const MATURE_TOPOLOGIES = new Set<NonNullable<CharacterFacts['topology']>>([
  'push-pull', 'single-ended',
]);

/**
 * 15-chain acceptance fix C — destination-class brand allowlist.
 *
 * Speaker brands whose entire lineup (or near-entire lineup) reads as
 * destination-class in the audiophile press. These trigger §10's
 * "treat as a fixed point" framing even when the chain reading lacks
 * explicit high-efficiency / wide-baffle / open-baffle / horn-loaded
 * anchors. Match is on the leading word of the chain name (or full
 * brand name) lowercased.
 *
 * Intentionally narrow: only brands where the cheapest model in the
 * lineup is still destination-tier. Brands with a wide spread
 * (e.g. KEF Q-series → Reference, Focal Chora → Utopia) are NOT
 * listed — the existing high-eff / cabinet / priceTier heuristics
 * handle their high-tier models on a per-product basis.
 */
const DESTINATION_SPEAKER_BRANDS = new Set([
  'magnepan',
  'harbeth',
  'devore',
  'tannoy',
  'proac',
  'spendor',
  'sonus',
  'wilson',
  'kii',
  'audio note',
  'audio-note',
  'sound lab',
  'soundlab',
  'cessaro',
  'avantgarde',
  'living voice',
]);

/**
 * Read the leading brand token from a chain name. Most catalog
 * entries use "Brand Model" form ("Magnepan LRS+", "Harbeth SHL5plus
 * XD"). Some use a two-word brand ("Audio Note") — captured as
 * `firstTwo` for brands that need it.
 */
function brandTokensFromChainName(name: string): { first: string; firstTwo: string } {
  const parts = name.trim().split(/\s+/);
  const first = (parts[0] ?? '').toLowerCase();
  const firstTwo = parts.length >= 2 ? `${first} ${(parts[1] ?? '').toLowerCase()}` : first;
  return { first, firstTwo };
}

function isDestinationSpeaker(
  name: string,
  role: string | undefined,
  facts: CharacterFacts,
): boolean {
  if (roleFamily(role) !== 'speaker') return false;
  // Hardening Phase C — subwoofers now classify as speaker family but
  // must NOT trigger destination protection. They are functionally
  // distinct from main loudspeakers; "treat as a fixed point" advice
  // is wrong for a subwoofer whose value depends on integration
  // rather than identity.
  if (isSubwoofer(role)) return false;
  if (facts.efficiency === 'high') return true;
  if (facts.cabinet && DESTINATION_CABINETS.has(facts.cabinet)) return true;
  const product = findProductByComponentName(name);
  if (product?.priceTier && DESTINATION_PRICE_TIERS.has(product.priceTier)) return true;
  // 15-chain acceptance fix C — chain-name brand allowlist for
  // destination-class lineups (Magnepan, Harbeth, etc.).
  const { first, firstTwo } = brandTokensFromChainName(name);
  if (DESTINATION_SPEAKER_BRANDS.has(first) || DESTINATION_SPEAKER_BRANDS.has(firstTwo)) {
    return true;
  }
  return false;
}

function isMatureAmplifier(
  name: string,
  role: string | undefined,
  facts: CharacterFacts,
): boolean {
  if (roleFamily(role) !== 'amplifier') return false;
  if (
    facts.tech === 'tube' &&
    facts.topology &&
    MATURE_TOPOLOGIES.has(facts.topology)
  ) {
    return true;
  }
  const product = findProductByComponentName(name);
  if (product?.brand && HERITAGE_TUBE_BRANDS.has(product.brand.toLowerCase())) return true;
  return false;
}

/**
 * Detect whether a §9 step action targets a protected component and
 * return the editorial caveat sentence. Returns undefined when the
 * action either does not reference a protected component or does so
 * only obliquely (no clear replacement verb).
 *
 * Match shape:
 *   1. Action verb gate — only fires for steps that contain at least
 *      one replacement verb (replace, swap, change, upgrade, audition,
 *      a different X). "Preserve / keep / hold" steps short-circuit.
 *   2. Component name match — the action mentions the protected
 *      component's name (full or distinctive last token).
 *   3. Role-token fallback — when the action references the role
 *      family ("the amplifier" / "the speakers") instead of by name,
 *      we still emit the caveat if the chain holds a protected
 *      component in that family.
 *
 * Returns at most one sentence so multiple matches collapse cleanly.
 */
function protectionCaveat(
  stepAction: string | undefined,
  chainNames: string[],
  roles: Array<string | undefined>,
  allFacts: CharacterFacts[],
): string | undefined {
  if (!stepAction) return undefined;
  const lower = stepAction.toLowerCase();

  // Preservation steps never need a caveat.
  if (/\b(?:preserve|keep|hold|do not touch|avoid touching)\b/i.test(stepAction)) {
    return undefined;
  }
  const isReplacementStep =
    /\b(?:replace|swap|change|upgrade|audition|different|substitut)\b/i.test(stepAction);
  if (!isReplacementStep) return undefined;

  for (let i = 0; i < chainNames.length; i++) {
    const name = chainNames[i];
    const role = roles[i];
    const facts = allFacts[i];
    if (!facts) continue;
    const lowerName = name.toLowerCase();
    const lastToken = name.split(/\s+/).slice(-1)[0]?.toLowerCase() ?? '';
    const family = roleFamily(role);

    const nameRef =
      lower.includes(lowerName) ||
      (lastToken.length >= 3 && lower.includes(lastToken));
    const roleRef =
      (family === 'speaker' &&
        /\b(?:speaker|speakers|loudspeaker|loudspeakers)\b/.test(lower)) ||
      (family === 'amplifier' &&
        /\b(?:amplifier|amp|integrated)\b/.test(lower));

    if (!nameRef && !roleRef) continue;

    if (isDestinationSpeaker(name, role, facts)) {
      return 'Replacing a destination-level loudspeaker should be a late move, not a first.';
    }
    if (isMatureAmplifier(name, role, facts)) {
      return 'Replacing a mature amplifier materially changes system identity — treat it as a different system, not an upgrade.';
    }
  }
  return undefined;
}

/**
 * Render a CharacterFacts object as a single editorial trait phrase
 * appropriate to the component family.
 *
 * Returns undefined when no facts are available — the body composer
 * then falls back to a more general contribution sentence.
 */
function formatFactsPhrase(
  family: 'source' | 'amplifier' | 'speaker' | 'unknown',
  facts: CharacterFacts,
  /**
   * Hardening Phase C — optional role string so the source-family
   * branch can fall back to role-based phrases (streamer, network,
   * CD/SACD/transport, turntable, cartridge, phono) when no
   * topology fact is available. Defaults to undefined so legacy
   * callers retain existing behavior; the only call site
   * (composeContributionBody) does pass role.
   */
  role?: string,
): string | undefined {
  if (family === 'source') {
    // Topology-driven phrases (highest confidence — anchored in
    // reading vocabulary).
    if (facts.topology === 'Ring DAC') {
      return "Its Ring DAC architecture prioritizes timing precision and quietness over conventional ladder or delta-sigma topologies";
    }
    if (facts.topology === 'FPGA') {
      return 'Its FPGA-based conversion prioritizes timing precision, transient clarity, and spatial focus';
    }
    if (facts.topology === 'R2R') {
      return 'Its R2R conversion favors tonal density and harmonic continuity over digital edge';
    }
    if (facts.topology === 'multibit') {
      return 'Its multibit conversion favors body and weight over high-frequency air';
    }
    if (facts.topology === 'delta-sigma') {
      return 'Its delta-sigma conversion prioritizes resolution and clean extension over analog texture';
    }
    if (facts.tonalLean === 'warm') {
      return 'Its conversion leans warm, carrying source character toward density rather than edge';
    }
    // Hardening Phase C — role-based fallbacks. When the reading
    // carries no recognizable DAC topology, fall back to role-text
    // sniffing so streamer / network / transport / vinyl chains get a
    // second sentence that frames the source contribution honestly
    // without inventing topology facts.
    if (role) {
      const r = role.toLowerCase();
      // Combined streamer/DAC: the role names both functions.
      const isStreamerDac = /streamer|network|renderer|server/.test(r) && /dac/.test(r);
      const isPureStreamer = /streamer|network|renderer|server/.test(r) && !/dac/.test(r);
      const isCdTransport = /\bcd\s*player\b|\bsacd\b|\btransport\b/.test(r);
      const isTurntable = /\bturntable\b/.test(r);
      const isCartridge = /\bcartridge\b/.test(r);
      const isPhonoStage = /\bphono\b/.test(r);
      if (isStreamerDac) {
        return 'Its role is to deliver clean source signal and stable conversion into the rest of the system';
      }
      if (isPureStreamer) {
        return 'Its job is less to impose a voice than to provide stable, low-noise source delivery into the downstream electronics';
      }
      if (isCdTransport) {
        return "Its mechanical and electronic stability set the timing precision the rest of the system inherits";
      }
      if (isTurntable) {
        return "Its analog front end sets the system's rhythmic and tonal foundation before amplification takes over";
      }
      if (isCartridge) {
        return 'Its signal extraction sets the rhythmic and tonal foundation the rest of the system inherits';
      }
      if (isPhonoStage) {
        return 'Its phono-stage gain and equalization shape the analog signal before it enters the main signal path';
      }
    }
    return undefined;
  }
  if (family === 'amplifier') {
    const tubes = facts.tubeTypes.length > 0 ? ` (${facts.tubeTypes.join(', ')})` : '';
    if (facts.tech === 'tube' && facts.topology === 'push-pull') {
      return `Its push-pull tube architecture${tubes} adds harmonic weight and rhythmic continuity without thinning the source`;
    }
    if (facts.tech === 'tube' && facts.topology === 'single-ended') {
      return `Its single-ended tube architecture${tubes} preserves tonal density at the cost of headroom under demand`;
    }
    if (facts.tech === 'tube') {
      return `Its tube topology${tubes} shapes the signal with harmonic warmth before passing it on`;
    }
    if (facts.topology === 'class-A') {
      return 'Its class-A solid-state design delivers control and resolution without smoothing texture';
    }
    if (facts.topology === 'class-D') {
      return 'Its class-D design favors efficiency and tight grip over harmonic generosity';
    }
    if (facts.tech === 'solid-state') {
      return 'Its solid-state amplification favors neutrality and authority over tonal coloration';
    }
    return undefined;
  }
  if (family === 'speaker') {
    // Pass 23 (Commit 7) — concrete reviewer voice. The previous phrasing
    // ("rewards low-power upstream drive", "demands current and headroom
    // upstream, rewarding solid-state authority", "shapes how source
    // signal reaches the room") read as poetic abstractions. These
    // fallback fact phrases now use plain audiophile vocabulary. The
    // primary speaker case (high-efficiency + upstream amp) is handled
    // upstream in composeContributionBody as a fused single sentence
    // and bypasses this fact phrase entirely.
    const parts: string[] = [];
    if (facts.efficiency === 'high') parts.push('high-efficiency');
    if (facts.cabinet) parts.push(facts.cabinet);
    const cabinetPhrase = parts.length > 0 ? parts.join(' ') + ' design' : undefined;
    if (cabinetPhrase && facts.efficiency === 'high') {
      return `Its ${cabinetPhrase} pairs well with lower-power amplification, emphasizing tonal weight and musical flow over pinpoint imaging`;
    }
    if (cabinetPhrase && facts.efficiency === 'low') {
      return `Its ${cabinetPhrase} needs an amplifier with real current and headroom to deliver dynamics and control`;
    }
    if (cabinetPhrase) {
      return `Its ${cabinetPhrase} shapes how the amplifier's drive reaches the room`;
    }
    if (facts.efficiency === 'high') {
      return 'Its high efficiency pairs well with lower-power amplification, emphasizing tonal ease over precision imaging';
    }
    return undefined;
  }
  return undefined;
}

/**
 * Compose a §5 component card body from chain position, role family,
 * extracted character facts, and the upstream/downstream context.
 *
 * The composed body is contribution-first: each sentence addresses
 * *what the component contributes to this system*, not *what this
 * product is*. The engine reading is NOT displayed verbatim — it
 * is the source of factual anchors only. Product-review register
 * ("flagship", "celebrated", "canonical", "famous pairing") never
 * surfaces because it never enters this composer.
 *
 * Editorial benchmark: Brand Authority Design Families (short
 * structured trait statements) + Stereophile sidebar voice (cool,
 * analytical) + 6moons relational discipline (interaction-aware).
 */
function composeContributionBody(
  name: string,
  role: string | undefined,
  idx: number,
  chainNames: string[],
  isBottleneck: boolean,
  facts: CharacterFacts,
  /**
   * Pass 23 (Commit 7) — optional upstream-component facts so the
   * speaker lede can name the upstream amplifier's tech family
   * ("tube amplifiers" vs "solid-state amplifiers") concretely
   * instead of in poetic abstractions.
   */
  upstreamFacts?: CharacterFacts,
): string {
  const family = roleFamily(role);
  const upstream = idx > 0 ? chainNames[idx - 1] : undefined;
  const downstream = idx < chainNames.length - 1 ? chainNames[idx + 1] : undefined;
  const sentences: string[] = [];

  // Sentence 1 — contribution-first lede, role-aware.
  if (family === 'source') {
    // Pass 23 (Commit 7) — rebalance DAC influence. The previous wording
    // ("sets the tonal character that the rest of the system inherits…")
    // overstated the source's role; in a loudspeaker chain the leverage
    // hierarchy is speaker > amp > DAC. The DAC's actual job is to
    // deliver clean signal with a specific quality + character profile
    // into the rest of the chain, not to author the system's tonal
    // character. The fact phrase that follows (R2R / multibit /
    // delta-sigma) is left unchanged — it is already correctly scoped
    // to the topology rather than to system-level authorship.
    // Pass 24 (Commit 8) — soften further. The Pass 23 lede still
    // doubled the qualifier ("feeding the downstream AND the rest of
    // the system"), which implicates the DAC in shaping everything
    // downstream. Reviewer-experience audit asked for the simpler
    // "feeding the downstream" framing so the DAC does not over-claim.
    if (downstream) {
      sentences.push(
        `The ${name} establishes the character of the signal feeding the ${downstream}.`,
      );
    } else {
      sentences.push(
        `The ${name} establishes the character of the signal it feeds into the system.`,
      );
    }
  } else if (family === 'amplifier') {
    // Hardening Phase B B9 — all-in-one streamer-amplifier branch.
    //
    // The `amplifier` family now includes hybrid all-in-one /
    // streamer-amplifier roles (after the roleFamily B9 reorder).
    // When such a component sits at the head of the chain (no
    // upstream), the regular "carries the signal between [upstream]
    // and [downstream]" template reads wrong because there is no
    // separate upstream source — the all-in-one IS the source.
    // Emit a role-correct lede that names the combined source +
    // amplification function. When an explicit upstream IS present
    // the all-in-one is functionally acting as an integrated amp;
    // fall through to the regular amplifier prose.
    if (isAllInOne(role) && !upstream) {
      if (downstream) {
        sentences.push(
          `The ${name} combines source access and amplification in a single chassis, driving the ${downstream}.`,
        );
      } else {
        sentences.push(
          `The ${name} combines source access and amplification in a single chassis.`,
        );
      }
    } else if (isPreampRole(role)) {
      // Commit 13 — §5 preamp template parity (continued below).
      //
      // The `amplifier` role family captures both power amplifiers and
      // line-stage preamplifiers (see `roleFamily`). Default amplifier
      // prose ("drives the speakers", "drive for the speakers", "motion
      // at the speakers") implicates the component in moving cones; that
      // language is wrong for a preamp, whose contribution is line-stage
      // gain shaping and signal handing — not speaker drive. We detect
      // preamps here (preamp / line-stage / line-level, while excluding
      // "power amp" and similar) and emit a role-correct lede that
      // references the downstream power amplifier rather than the
      // speakers.
      if (upstream && downstream) {
        sentences.push(
          `The ${name} accepts the signal from the ${upstream}, sets its line-stage character and gain, and hands it to the ${downstream}.`,
        );
      } else if (downstream) {
        sentences.push(
          `The ${name} sets the line-stage character and gain that feed the ${downstream}.`,
        );
      } else if (upstream) {
        sentences.push(
          `The ${name} shapes the signal arriving from the ${upstream}, setting its line-stage character and gain before the next stage.`,
        );
      } else {
        sentences.push(
          `The ${name} sits in the system as a line-stage preamplifier, setting character and gain rather than driving the speakers directly.`,
        );
      }
    } else if (upstream && downstream) {
      // Hardening Phase C — plural subject (monoblock pair, ×2) needs
      // plural verb. `carries` → `carry`. The relative clause is
      // not present in this template so only the lede verb agrees
      // with the chain entry.
      const nP = chainNameIsPlural(name);
      sentences.push(
        `The ${name} ${verbForSubject('carries', nP)} the signal between the ${upstream} and the ${downstream}, translating source character into drive for the speakers.`,
      );
    } else if (downstream) {
      const nP = chainNameIsPlural(name);
      sentences.push(
        `The ${name} ${verbForSubject('drives', nP)} the ${downstream}, shaping how source signal becomes motion at the speakers.`,
      );
    } else if (upstream) {
      // Phase C — both verbs vary: `takes` agrees with ${name},
      // `delivers` agrees with ${upstream} (relative-clause subject).
      const nP = chainNameIsPlural(name);
      const uP = chainNameIsPlural(upstream);
      sentences.push(
        `The ${name} ${verbForSubject('takes', nP)} what the ${upstream} ${verbForSubject('delivers', uP)} and ${verbForSubject('translates', nP)} it into drive.`,
      );
    } else {
      const nP = chainNameIsPlural(name);
      sentences.push(
        `The ${name} ${verbForSubject('sits', nP)} at this system's heart, translating signal into drive.`,
      );
    }
  } else if (family === 'speaker') {
    // Hardening Phase C — subwoofer / active-speaker / studio-monitor
    // branches must run BEFORE the regular passive-speaker prose.
    // Each emits a role-correct lede and (when appropriate) a second
    // integration sentence; the passive-speaker `drivePhrase`
    // branches below are skipped via early return at the end of the
    // speaker family.
    if (isSubwoofer(role)) {
      // Subwoofer — extends low-frequency reach; value depends on
      // integration with main speakers and room rather than identity.
      sentences.push(
        `The ${name} extends the system's low-frequency foundation rather than carrying the full musical picture.`,
      );
      sentences.push(
        'Its value depends on integration with the main speakers and the room, not simply on output.',
      );
      // Skip the bottleneck + facts-phrase fall-through; the
      // subwoofer card is intentionally short and integration-first.
      return sentences.join(' ');
    }
    if (isActiveSpeaker(role)) {
      // Active / powered / studio-monitor — amplification, driver
      // alignment, and cabinet behavior live inside the speaker.
      if (isStudioMonitor(role)) {
        sentences.push(
          `The ${name} functions as an active studio monitor: amplification, driver control, and cabinet behavior are handled inside the speaker rather than delegated to an external amplifier.`,
        );
      } else if (upstream) {
        sentences.push(
          `The ${name} integrates amplification, driver alignment, and room-facing output in the loudspeaker itself, so the ${upstream} is feeding a complete playback system rather than a passive load.`,
        );
      } else {
        sentences.push(
          `The ${name} integrates amplification, driver alignment, and room-facing output in the loudspeaker itself.`,
        );
      }
      // Bottleneck framing if applicable — same shape as the passive
      // speaker bottleneck sentence but scoped to active behavior.
      if (isBottleneck) {
        sentences.push(
          'Where this system meets its honest limits — scale, room interaction, and onboard amplification headroom — is decided here.',
        );
      }
      return sentences.join(' ');
    }
    // Pass 24 (Commit 8) — name the upstream amplifier explicitly
    // instead of by generic tech family, and add a second
    // cabinet-aware sentence so the speaker card carries the same
    // editorial weight as the source and amplifier cards (target:
    // 2-3 sentences each).
    const drivePhrase = upstream
      ? upstreamFacts?.tech === 'tube'
        ? `the ${upstream}'s tube drive`
        : upstreamFacts?.tech === 'solid-state'
          ? `the ${upstream}'s solid-state drive`
          : `the ${upstream}'s amplification`
      : undefined;
    if (facts.efficiency === 'high' && drivePhrase) {
      sentences.push(
        `The ${name}'s high-efficiency design pairs naturally with ${drivePhrase}, emphasizing tonal weight, ease, and musical flow over razor-sharp precision.`,
      );
      // Second sentence — cabinet/room behavior. Each branch reads
      // as concrete reviewer voice; falls back to a general
      // imaging-vs-scale trade observation when cabinet is unknown.
      if (facts.cabinet === 'wide-baffle') {
        sentences.push(
          'Its wide-baffle layout brings scale and ease into the room at the cost of pinpoint imaging.',
        );
      } else if (facts.cabinet === 'horn-loaded') {
        sentences.push(
          'Horn loading concentrates drive and dynamics at the cost of even off-axis response.',
        );
      } else if (facts.cabinet === 'open-baffle') {
        sentences.push(
          'Its open-baffle layout opens the stage and depends heavily on room treatment.',
        );
      } else {
        sentences.push(
          'What you give up in pinpoint imaging, you gain in scale and an ease that lets mediocre recordings still survive.',
        );
      }
    } else if (facts.efficiency === 'low' && upstream) {
      const driveQualifier =
        upstreamFacts?.tech === 'solid-state'
          ? "the solid-state grip and authority"
          : 'amplifiers with real drive';
      sentences.push(
        `The ${name}'s lower-efficiency design needs current and headroom from the ${upstream}, favoring ${driveQualifier} over delicacy.`,
      );
    } else if (upstream) {
      // 15-chain acceptance fix G — headphones use the speaker
      // family but render into a different physical surface. Swap
      // "into sound in the room" for "into sound at the ear" when
      // the role explicitly indicates a headphone.
      // Hardening Phase C — relative-clause verb `delivers` agrees
      // with the upstream chain entry, not with the speaker name.
      const isHeadphone = !!role && /headphone/i.test(role);
      const surface = isHeadphone ? 'sound at the ear' : 'sound in the room';
      const uP = chainNameIsPlural(upstream);
      sentences.push(
        `The ${name} translates what the ${upstream} ${verbForSubject('delivers', uP)} into ${surface}.`,
      );
    } else {
      const isHeadphone = !!role && /headphone/i.test(role);
      const surface = isHeadphone ? 'sound at the ear' : 'sound in the room';
      sentences.push(`The ${name} translates the system's signal into ${surface}.`);
    }
  } else {
    // Unknown / generic role — keep the lede neutral.
    if (upstream && downstream) {
      sentences.push(
        `Between the ${upstream} and the ${downstream}, the ${name} carries the system's signal as the ${naturalRole(role)}.`,
      );
    } else {
      sentences.push(`The ${name} sits inside this system as the ${naturalRole(role)}.`);
    }
  }

  // Sentence 2 — factual character trait phrase, when facts allow.
  // Pass 23 (Commit 7): suppress for the fused-speaker case so the
  // body remains one concrete sentence instead of double-stating
  // the upstream pairing.
  const speakerFused =
    family === 'speaker' &&
    !!upstream &&
    (facts.efficiency === 'high' || facts.efficiency === 'low');
  // Hardening Phase C — pass `role` so the source-family branch can
  // fall back to role-based phrases when no topology fact anchors.
  const factsPhrase = speakerFused ? undefined : formatFactsPhrase(family, facts, role);
  if (factsPhrase) {
    sentences.push(factsPhrase + '.');
  }

  // Sentence 3 — editorial limit-framing when this is the system's
  // primary constraint, calibrated by role family.
  if (isBottleneck) {
    if (family === 'amplifier' && isPreampRole(role)) {
      // Commit 13 — preamp-specific limits language. The default
      // amplifier-bottleneck sentence ("headroom under demand, control
      // at scale") refers to power-amp drive limits and reads wrong
      // when the preamp itself is named as the constraint. Preamps
      // limit a system through gain shaping, noise floor, and stage
      // retrieval — not through speaker control.
      sentences.push(
        "Where this system meets its honest limits — gain shaping, noise floor, and stage retrieval — is decided here.",
      );
    } else if (family === 'amplifier') {
      sentences.push(
        'Where this system meets its honest limits — headroom under demand, control at scale — is decided here.',
      );
    } else if (family === 'speaker') {
      sentences.push(
        'Where this system meets its honest limits — scale, room interaction, imaging precision — is decided here.',
      );
    } else if (family === 'source') {
      sentences.push(
        'Where this system meets its honest limits — resolution, transient bite, top-end air — is decided here.',
      );
    } else {
      sentences.push('Where this system meets its honest limits is decided here.');
    }
  }

  return sentences.join(' ');
}

/**
 * Build the §5 card data for the artifact.
 *
 * Combines identity-mapping (Issue: array-order drift between
 * systemChain.names and componentReadings) with content normalization
 * (Issue: off-chain product mentions; length imbalance).
 *
 * Returns one entry per name in `systemChain.names`, in signal-path
 * order. Each entry carries the matched reading after normalization;
 * roles are passed through from systemChain.roles.
 */
/**
 * Resolve a §5 component card's product image, scoped to the chain
 * component's identity (Commit 6).
 *
 * Resolution chain — STRICT throughout. No placeholder, no brand-only
 * fallback. Returns undefined when the artifact cannot find a
 * model-specific image, and the card renders text-only.
 *
 *   1. Catalog match via `findProductByComponentName(name)` —
 *      already handles brand + distinctive-token matching (Commit 4A
 *      identity-mapping precedent). When a canonical Product
 *      resolves, prefer its `imageUrl`.
 *   2. With a canonical brand+name in hand (from step 1) but no
 *      catalog `imageUrl`, fall through to the curated overlay map
 *      via `resolveProductImageStrict(brand, name)`.
 *   3. When no catalog product matches at all (e.g. an in-chain
 *      product that pre-dates a catalog entry), try the overlay map
 *      using the raw component name string as the haystack — the
 *      overlay's `haystack.includes(key)` substring match is brand-
 *      anchored (every key carries the brand prefix), so cross-brand
 *      drift is structurally impossible.
 *
 * The component name from `systemChain.names` is the authoritative
 * source of identity — never the engine reading text, never a
 * neighboring component's prefix. The Commit 4A swap-defect fix is
 * preserved exactly because resolution starts from the card name.
 *
 * F4 / review-publication imagery is already filtered inside the
 * overlay layer (`getProductImage` skips entries with source.tier ===
 * 'review_publication'). No additional gating required here.
 */
function resolveComponentImage(componentName: string | undefined): string | undefined {
  if (!componentName) return undefined;
  // Step 1: catalog match.
  const product = findProductByComponentName(componentName);
  if (product?.imageUrl) return product.imageUrl;
  // Step 2: canonical brand + name → strict overlay.
  if (product) {
    const overlay = resolveProductImageStrict(product.brand, product.name);
    if (overlay) return overlay;
  }
  // Step 3: raw name → overlay (substring match against brand-anchored keys).
  return getProductImage(undefined, componentName);
}

function buildComponentCards(
  names: string[] | undefined,
  roles: string[] | undefined,
  readings: string[] | undefined,
  primaryConstraintName?: string,
): Array<{ name: string; role?: string; body?: string; imageUrl?: string }> {
  if (!readings || readings.length === 0 && (!names || names.length === 0)) return [];
  if (!names || names.length === 0) {
    // Fallback: no chain → render readings as anonymous components,
    // still composed presentationally so the body stays in
    // contribution register. No image resolution in this branch —
    // anonymous "Component N" labels cannot drive a brand-anchored
    // overlay lookup safely.
    return (readings ?? []).map((r, i) => {
      const facts = extractCharacterFacts(r, undefined);
      const composed = composeContributionBody(
        `Component ${i + 1}`,
        undefined,
        i,
        [],
        false,
        facts,
      );
      return { name: `Component ${i + 1}`, body: composed };
    });
  }
  return names.map((name, i) => {
    const matched = findReadingForName(name, readings, i);
    const isBottleneck =
      !!primaryConstraintName &&
      primaryConstraintName.toLowerCase() === name.toLowerCase();
    // Extract structured facts from the engine reading; the reading
    // text itself is NOT displayed verbatim — it serves only as a
    // factual anchor for the composer.
    const facts = extractCharacterFacts(matched, roles?.[i]);
    // Pass 23 (Commit 7) — also extract the upstream component's
    // facts so the speaker lede can name the upstream amplifier's
    // tech family ("tube amplifiers" vs "solid-state amplifiers")
    // concretely instead of in poetic abstractions. extractCharacterFacts
    // is regex-light; this doubles per-card extract calls but the
    // overall §5 cost stays well under a millisecond.
    const upstreamFacts =
      i > 0
        ? extractCharacterFacts(
            findReadingForName(names[i - 1], readings, i - 1),
            roles?.[i - 1],
          )
        : undefined;
    const body = composeContributionBody(
      name,
      roles?.[i],
      i,
      names,
      isBottleneck,
      facts,
      upstreamFacts,
    );
    const imageUrl = resolveComponentImage(name);
    return {
      name,
      role: roles?.[i],
      body,
      imageUrl,
    };
  });
}

/**
 * Presentation-layer normalization of §4 *Character* prose.
 *
 * The engine's `systemContext` field carries the entire legacy MemoFormat
 * narrative — eight bolded inline sub-headings (`**System read**`,
 * `**Emergent behavior**`, `**System logic**`, `**Primary leverage**`,
 * `**Decision**`, `**Trade-offs**`, `**Next step options**`,
 * `**Do nothing check**`). Inside the artifact, the only block that
 * semantically belongs in §4 *Character* is the first one — *System read*,
 * which characterizes the system's identity. The remaining seven blocks
 * either duplicate other sections (§7 Strengths and Honest Limits,
 * §8 What's Already Working, §9 If You Were to Change Something) or
 * duplicate visual chrome (§1 chain banner restated as arrow narration).
 *
 * This normalizer extracts the *System read* content and discards the
 * rest. Pure presentation transform — engine output unchanged.
 *
 * Returns undefined when the input collapses, so the section can
 * gracefully omit a body.
 */
function normalizeCharacterProse(systemContext: string | undefined): string | undefined {
  if (!systemContext) return undefined;
  let text = systemContext;

  // Phase 1: extract the System-read block.
  // Match `**System read**` (case-insensitive, allowing internal spaces)
  // and capture everything up to the next `**...**` marker or end of text.
  const systemReadMatch = text.match(/\*\*\s*system\s+read\s*\*\*\s*([\s\S]*?)(?=\*\*[\s\S]*?\*\*|$)/i);
  if (systemReadMatch) {
    text = systemReadMatch[1];
  } else {
    // No System-read marker. If text begins with content followed by
    // any `**...**` marker, keep only the pre-marker content. Otherwise
    // pass through as-is.
    const firstMarkerIdx = text.search(/\*\*[\s\S]{1,40}\*\*/);
    if (firstMarkerIdx > 0) {
      text = text.slice(0, firstMarkerIdx);
    }
  }

  // Phase 2: strip any residual bold markers and chain-arrow narration.
  // Arrow lines duplicate the §1 chain banner and break the editorial
  // register.
  text = text.replace(/\*\*[^*]*\*\*/g, '').trim();
  // Drop lines that contain → arrows OR contain "X and Y and Z reinforce
  // the same direction" chain-listing summary patterns.
  text = text
    .split(/\r?\n+/)
    .filter((line) => {
      const t = line.trim();
      if (t.length === 0) return false;
      if (t.includes('→')) return false;
      if (/\bre(?:in)?force\s+the\s+same\s+direction\b/i.test(t)) return false;
      return true;
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Phase 3: trim to the target window at sentence boundaries.
  // §4 Character target: 500–800 characters. Use sentence-boundary
  // trim (already proven for §5) and cap by character count rather
  // than word count since the target is character-defined.
  const sentences = splitSentences(text);
  const kept: string[] = [];
  let runningChars = 0;
  for (const s of sentences) {
    if (kept.length > 0 && runningChars + s.length > 800) break;
    kept.push(s);
    runningChars += s.length + 1; // +1 for the joining space
  }
  const result = preferSystemTerminology(kept.join(' ').trim()) ?? '';
  return result.length > 0 ? result : undefined;
}

/**
 * §4 Character: detect whether the engine's `systemSynergy` line is
 * already present in (or a substring of, or a superset of) the
 * normalized `systemContext` paragraph. The two engine fields are
 * intended to be distinct — the paragraph is the system-read prose
 * and the synergy line is the italic pull-quote — but the engine
 * sometimes emits overlapping prose. When the substrings overlap,
 * we render the longer of the two and suppress the redundant copy.
 *
 * Both inputs are normalized for comparison (lowercase, trimmed
 * punctuation, collapsed whitespace). The original text is unchanged
 * by this function; the comparison is only used as a render gate.
 *
 * Returns:
 *   'render-both' — the two lines are independently informative
 *   'suppress-synergy' — characterProse already contains synergy
 *   'suppress-character' — synergy is a superset of characterProse
 */
function dedupCharacterSynergy(
  characterProse: string | undefined,
  synergy: string | undefined,
): 'render-both' | 'suppress-synergy' | 'suppress-character' {
  if (!characterProse || !synergy) return 'render-both';
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[.,;:!?]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const a = norm(characterProse);
  const b = norm(synergy);
  if (a === b) return 'suppress-synergy';
  if (a.includes(b)) return 'suppress-synergy';
  if (b.includes(a)) return 'suppress-character';
  return 'render-both';
}

/**
 * Presentation-layer normalization of §6 *How They Work Together*.
 *
 * The engine's `systemInteraction` field can mix true interaction
 * analysis with product-review drift — single-component spec rundowns,
 * brand-history asides, off-chain product mentions (e.g. the CS300X
 * headphone amplifier mentioned for the Leben CS600X). For a section
 * titled *How They Work Together*, every sentence should either:
 *   (a) be a system-level statement (mentioning the system as a whole
 *       without naming specific components), OR
 *   (b) reference at least two chain components (true interaction
 *       prose).
 *
 * This normalizer applies four rules per sentence:
 *   1. Drop if the sentence starts with `"{ChainComponentName}:"` —
 *      the legacy product-header pattern from MemoFormat's
 *      per-component sub-blocks.
 *   2. Drop if the sentence mentions an off-chain product (reuses
 *      the §5 model-token heuristic).
 *   3. Drop if the sentence contains a spec pattern (`~32W`, `~96dB`,
 *      `~XX kHz`, etc.) — technical-spec sentences are review-mode.
 *   4. Drop if the sentence names exactly one chain component AND
 *      contains no system-level framing — single-component prose is
 *      review-mode, not interaction prose.
 *
 * Falls back to keeping the first sentence if the filter empties the
 * content, so the section still says something rather than disappearing.
 */
function normalizeInteractionProse(
  interaction: string | undefined,
  chainNames: string[],
): string | undefined {
  if (!interaction) return undefined;

  // Build brand-prefix tokens from chain names for sentence detection.
  // Each chain name typically begins with a brand: "Denafrips Pontus II"
  // → "Denafrips" + "Pontus". We collect both full names and first-word
  // prefixes so a sentence mentioning just "Leben" or just "Pontus" is
  // counted as referencing that chain component.
  const chainTokens = new Set<string>();
  for (const name of chainNames) {
    chainTokens.add(name.toLowerCase());
    const first = name.split(/\s+/)[0]?.toLowerCase();
    if (first && first.length >= 3) chainTokens.add(first);
  }

  function chainTokensInSentence(s: string): number {
    const lower = s.toLowerCase();
    let count = 0;
    for (const tok of chainTokens) {
      if (lower.includes(tok)) count += 1;
    }
    return count;
  }

  // Detect component-header label pattern: "Leben CS600X:" at the
  // start of a sentence. Case-insensitive; whitespace-tolerant.
  function startsWithChainNameLabel(s: string): boolean {
    const trimmed = s.trim();
    for (const name of chainNames) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match exact name followed by ":" at start.
      const re = new RegExp(`^${escaped}\\s*:`, 'i');
      if (re.test(trimmed)) return true;
    }
    return false;
  }

  // Detect spec patterns: tilde-prefixed numbers (`~32W`), or numbers
  // immediately followed by audio-spec units (W, V, dB, Hz, kHz, MHz,
  // Ω, ohm). These mark review-mode prose.
  const SPEC_REGEX = /(~\s*\d|\b\d+(?:\.\d+)?\s*(?:W|V|dB|Hz|kHz|MHz|[Ωohm]+))\b/i;
  function containsSpec(s: string): boolean {
    return SPEC_REGEX.test(s);
  }

  const sentences = splitSentences(interaction);
  const kept = sentences.filter((s) => {
    // Rule 1: drop component-header pattern
    if (startsWithChainNameLabel(s)) return false;
    // Rule 2: drop off-chain product mention (reuses §5 heuristic)
    if (sentenceMentionsOffChainProduct(s, chainNames)) return false;
    // Rule 3: drop spec sentences
    if (containsSpec(s)) return false;
    // Rule 4: drop single-component prose. A sentence is "system-level"
    // when no chain tokens appear (count === 0). Two or more chain
    // tokens = interaction statement. Exactly one chain token without
    // any other interaction language = likely review drift.
    const count = chainTokensInSentence(s);
    if (count === 1) return false;
    return true;
  });

  // Defensive fallback: if every sentence was filtered, keep the first
  // sentence as-is so the section is not silently emptied.
  const final = kept.length > 0 ? kept : sentences.slice(0, 1);
  const result = preferSystemTerminology(final.join(' ').trim()) ?? '';
  return result.length > 0 ? result : undefined;
}

/**
 * Commit 13 — §6 interaction fallback.
 *
 * §6 *How They Work Together* renders only when the engine emits
 * `systemInteraction` prose AND that prose survives the
 * `normalizeInteractionProse` filter (off-chain mentions, spec
 * sentences, and single-component review drift are dropped). Several
 * realistic chains in the 15-chain acceptance pass produced no
 * surviving interaction prose, which made §6 silently disappear — a
 * trust regression because users expect the artifact to explain how
 * the system works together, and silent omission reads as "the
 * artifact found nothing to say" rather than "the engine had nothing
 * to say."
 *
 * This presentation-layer fallback fires only when ALL of the
 * following hold:
 *   - chainNames.length >= 2 (need a system to talk about interaction)
 *   - >= 2 distinct role families present (the interaction story
 *     requires more than one stage in play)
 *   - >= 1 chain component has anchored facts (efficiency, topology,
 *     cabinet, tech) — without any anchored evidence the section is
 *     better omitted than filled with a generic statement
 *
 * Composition is two sentences:
 *   1. Where the interaction lives, keyed by the role families
 *      present (source+amp+speaker / amp+speaker / source+amp /
 *      generic). The phrasing acknowledges the limit-of-information
 *      register up front ("With the available information…") so the
 *      reader understands this is a structural inference rather than
 *      a confident reading.
 *   2. An honest caveat naming what would be required to make a more
 *      precise interaction judgment (room, placement, listening
 *      conditions) — explicitly distinguishing structural inference
 *      from listening verdict.
 *
 * Composition does NOT name specific components — the fallback is
 * intentionally structural, not specific, to avoid pretending the
 * artifact has data it does not have.
 *
 * The result passes through `preferSystemTerminology` so "chain" never
 * leaks here.
 */
function composeInteractionFallback(
  chainNames: string[],
  roles: Array<string | undefined>,
  chainFacts: CharacterFacts[],
): string | undefined {
  if (chainNames.length < 2) return undefined;
  const families = roles
    .map((r) => roleFamily(r))
    .filter((f) => f !== 'unknown');
  const familySet = new Set(families);
  if (familySet.size < 2) return undefined;
  const anchoredFactsCount = chainFacts.filter(
    (f) => !!f.efficiency || !!f.topology || !!f.cabinet || !!f.tech || !!f.tonalLean,
  ).length;
  if (anchoredFactsCount === 0) return undefined;

  const hasSource = familySet.has('source');
  const hasAmp = familySet.has('amplifier');
  const hasSpeaker = familySet.has('speaker');

  let s1: string;
  if (hasSource && hasAmp && hasSpeaker) {
    s1 =
      "With the available information, this system's character takes shape across the source, amplification, and speaker stages together rather than in any single component.";
  } else if (hasAmp && hasSpeaker) {
    s1 =
      'With the available information, the main interaction here appears to be between amplification and loudspeaker behavior rather than in any single component.';
  } else if (hasSource && hasAmp) {
    s1 =
      'With the available information, the main interaction here appears to be between the source character and the amplification rather than in any single component.';
  } else {
    s1 =
      "With the available information, this system's character takes shape across more than one stage rather than in any single component.";
  }

  const s2 =
    'A more precise interaction judgment — voicing under demand, room behavior, sustained listening at level — would depend on placement and listening conditions not visible to this assessment.';

  return preferSystemTerminology([s1, s2].join(' '));
}

/**
 * Presentation-layer terminology normalization.
 *
 * The artifact explicitly prefers "system" over "chain" as the
 * user-facing term for the overall assembly. The engine's writer
 * builders sometimes emit "the chain", "this chain", "across the
 * chain" — phrasing the artifact should re-cast in editorial,
 * system-first language before display.
 *
 * The transform deliberately preserves "signal chain" as a topology
 * term — only references to the chain-as-assembly are rewritten.
 *
 * Pure presentation transform. Engine output and engine builders
 * are unchanged.
 */
function preferSystemTerminology(text: string | undefined): string | undefined {
  if (!text) return text;
  // Preserve `signal chain` as a signal-path topology term.
  const SIGCHAIN_SENTINEL = 'SIGCHAIN';
  const OFFCHAIN_SENTINEL = 'OFFCHAIN';
  // Case-preserving rewriter — keeps the initial capital of the
  // determiner so "The chain…" → "The system…" rather than collapsing
  // to "the system…" mid-sentence.
  function caseSafeRewrite(m: string, target: string): string {
    const first = m.charAt(0);
    return first === first.toUpperCase() && first !== first.toLowerCase()
      ? target.charAt(0).toUpperCase() + target.slice(1)
      : target;
  }
  return text
    .replace(/\bsignal\s+chain\b/gi, SIGCHAIN_SENTINEL)
    .replace(/\boff[- ]chain\b/gi, OFFCHAIN_SENTINEL)
    // System-as-assembly references.
    .replace(/\bthe\s+chain\b/gi, (m) => caseSafeRewrite(m, 'the system'))
    .replace(/\bthis\s+chain\b/gi, (m) => caseSafeRewrite(m, 'this system'))
    .replace(/\bchain['’]s\b/gi, (m) => caseSafeRewrite(m, "system's"))
    // Compound-noun guards: only rewrite the bare "chain" noun when it
    // is preceded by a determiner / possessive / preposition that maps
    // cleanly to "system" usage.
    .replace(/\b(across|throughout|along|in|of)\s+chain\b/gi, '$1 system')
    // Commit 11 — `systemSignature` and similar engine prose can
    // describe the assembly as "{hyphenated-qualifier} chain"
    // ("source-first chain", "tube-led chain"). Rewrite when "chain"
    // follows a hyphenated qualifier; signal-chain is already
    // sentinel-protected above so the topology term survives.
    .replace(/\b((?:[a-z]+-)+[a-z]+)\s+chain\b/gi, '$1 system')
    .replace(new RegExp(SIGCHAIN_SENTINEL, 'g'), 'signal chain')
    .replace(new RegExp(OFFCHAIN_SENTINEL, 'g'), 'off-chain');
}

/**
 * Presentation-layer normalization of §3 *First Impressions* prose.
 *
 * The engine's `introSummary` field is assembled from fixed template
 * fragments — marketing-prefix sentences ("A reference-level system…",
 * "A system that prioritises…"), an "intent note" adjective-stack,
 * and a stacked-trait identity sentence. Verbatim, it reads as
 * compressed trait labels rather than a reviewer's opening paragraph.
 *
 * This normalizer strips the marketing-prefix sentences, drops any
 * sentence containing a 3+ comma-separated adjective stack, and
 * applies two named substitutions to soften the engine's cadence
 * ("shares a consistent lean toward" → "leans toward"; the
 * "prioritising X and Y and Z" adjective enumeration is removed
 * inline). When stripping leaves the prose too thin, falls back to
 * `systemSignature` so the section still says something.
 *
 * The substitution table is intentionally tiny (two entries) — any
 * new pattern is a STOP-AND-REPORT event per the cadence-helper
 * precedent (Rule 3 in CLAUDE.md).
 */
const FIRST_IMPRESSIONS_MARKETING_OPENERS: RegExp[] = [
  /^A reference-level system\b/i,
  /^A system\b/i,
  /^This is a coherent\b/i,
  /^The system prioritises\b/i,
];

const FIRST_IMPRESSIONS_ADJECTIVE_STACK_RE =
  /\b[A-Za-z]+,\s+[A-Za-z]+,\s+(?:and\s+)?[A-Za-z]+\b/;

const FIRST_IMPRESSIONS_REWRITES: Array<readonly [RegExp, string]> = [
  [/shares a consistent lean toward/gi, 'leans toward'],
  [/\bprioritising\s+[A-Za-z]+(?:\s+and\s+[A-Za-z]+){1,}\b/gi, ''],
];

function normalizeFirstImpressions(
  intro: string | undefined,
  signature: string | undefined,
): string | undefined {
  // §3 is keyed on `introSummary` presence — when the engine has no
  // intro to normalize, the section stays hidden (preserves the
  // pre-helper data-gating contract). `signature` is consulted only
  // as a fallback when stripping leaves the prose too thin to render.
  if (!intro) return undefined;
  const sentences = splitSentences(intro);
  const kept = sentences.filter((s) => {
    const t = s.trim();
    if (FIRST_IMPRESSIONS_MARKETING_OPENERS.some((re) => re.test(t))) return false;
    if (FIRST_IMPRESSIONS_ADJECTIVE_STACK_RE.test(t)) return false;
    return true;
  });
  let body = kept.slice(0, 2).join(' ').trim();
  for (const [re, rep] of FIRST_IMPRESSIONS_REWRITES) {
    body = body.replace(re, rep).replace(/\s+/g, ' ').trim();
  }
  // Punctuation cleanup left behind by the rewrites.
  body = body.replace(/\s+([.,;:])/g, '$1').replace(/[.,;:]{2,}/g, '.').trim();
  if (body.length < 40 && signature) {
    body = signature;
  }
  const finalized = preferSystemTerminology(body) ?? '';
  return finalized.length > 0 ? finalized : undefined;
}

/**
 * Render the engine's role label in editorial natural-case.
 *
 * Engine roles arrive title-cased (`"DAC"`, `"Integrated Amplifier"`,
 * `"Speakers"`). Three-letter acronyms (DAC, USB, RIAA, ADC) stay
 * uppercase; everything else lower-cases so it reads as a noun in
 * mid-sentence prose (`"…as the system's integrated amplifier"`,
 * `"…as the system's DAC"`).
 */
function naturalRole(role: string | undefined): string {
  if (!role) return 'component';
  const trimmed = role.trim();
  // Treat the entire role as an acronym only when it is short and
  // all-uppercase already (covers "DAC", "ADC", "USB").
  if (/^[A-Z]{2,5}$/.test(trimmed)) return trimmed;
  return trimmed.toLowerCase();
}

function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Presentation-layer dedup of §7 *Strengths* and *Honest Limits* lists.
 *
 * The engine fires per-component trait-check loops that can produce
 * three consecutive bullets restating the same concept (e.g. "Leben
 * contributes musical flow and continuity" three times). This helper
 * collapses exact concept duplicates and merges component-name
 * prefixes when the duplicate carries a different chain name.
 *
 * Synonym collapse (flow↔continuity, etc.) is intentionally OUT of
 * scope for this pass — the synthesis flagged it as the highest-risk
 * surface and recommended shipping exact-dedup first. This helper
 * implements only the conservative pattern: identical concept keys
 * after stopword + prefix removal collapse to ONE bullet with merged
 * component-name attribution.
 */
const DEDUP_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'with', 'for', 'as',
  'is', 'are', 'may', 'can', 'could', 'should', 'be', 'this', 'that',
  'contributes', 'provides', 'adds', 'reduce', 'reduces', 'reducing',
  'feel', 'sound', 'sounds', 'presentation', 'system', 'strong', 'system\'s',
]);

/**
 * Build the set of attribution tokens to strip during dedup.
 *
 * Bullets may attribute concepts by full chain name (`Leben CS600X
 * contributes…`) OR by brand short-form (`Leben contributes…`). The
 * dedup key compares concepts after attribution; we strip both forms.
 */
function chainAttributionTokens(chainNames: string[]): string[] {
  const set = new Set<string>();
  for (const n of chainNames) {
    set.add(n.toLowerCase());
    const first = n.split(/\s+/)[0]?.toLowerCase();
    if (first && first.length >= 3) set.add(first);
  }
  return Array.from(set);
}

function dedupConceptKey(s: string, chainNames: string[]): string {
  let body = s.toLowerCase();
  for (const tok of chainAttributionTokens(chainNames)) {
    const re = new RegExp(
      `^${escapeForRegex(tok)}\\s+(?:contributes|provides|adds|has)\\s+`,
      'i',
    );
    body = body.replace(re, '');
  }
  body = body.replace(/[^a-z\s—\-]/g, ' ');
  const toks = body
    .split(/\s+/)
    .filter((t) => t.length > 2 && !DEDUP_STOPWORDS.has(t));
  return Array.from(new Set(toks)).sort().slice(0, 4).join('|');
}

function findChainNamePrefix(s: string, chainNames: string[]): string | undefined {
  const lower = s.toLowerCase();
  for (const n of chainNames) {
    if (lower.startsWith(n.toLowerCase())) return n;
    const first = n.split(/\s+/)[0];
    if (first && lower.startsWith(first.toLowerCase() + ' ')) return n;
  }
  return undefined;
}

/**
 * Strip the actual attribution token from a bullet's leading edge —
 * either the full chain name (`Leben CS600X contributes…`) or the
 * brand short-form (`Leben contributes…`). The raw text and the
 * canonical chain name may differ in length, so we can't slice by
 * canonical length blindly; this helper compares both forms.
 */
function trimChainAttribution(s: string, canonicalChainName: string): string {
  const lower = s.toLowerCase();
  if (lower.startsWith(canonicalChainName.toLowerCase() + ' ')) {
    return s.slice(canonicalChainName.length).replace(/^\s+/, '');
  }
  const first = canonicalChainName.split(/\s+/)[0];
  if (first && lower.startsWith(first.toLowerCase() + ' ')) {
    return s.slice(first.length).replace(/^\s+/, '');
  }
  return s;
}

function dedupeStrengthsByConcept(
  items: string[] | undefined,
  chainNames: string[],
): string[] | undefined {
  if (!items) return items;
  if (items.length === 0) return items;
  interface Kept {
    key: string;
    text: string;
    names: string[];
    suffix: string;
  }
  const kept: Kept[] = [];
  const seen = new Map<string, number>();
  for (const raw of items) {
    const key = dedupConceptKey(raw, chainNames);
    const namePrefix = findChainNamePrefix(raw, chainNames);
    if (!key) {
      kept.push({ key: raw, text: raw, names: namePrefix ? [namePrefix] : [], suffix: raw });
      continue;
    }
    const existingIdx = seen.get(key);
    if (existingIdx === undefined) {
      const suffix = namePrefix
        ? trimChainAttribution(raw, namePrefix)
        : raw;
      seen.set(key, kept.length);
      kept.push({
        key,
        text: raw,
        names: namePrefix ? [namePrefix] : [],
        suffix,
      });
    } else if (namePrefix && !kept[existingIdx].names.includes(namePrefix)) {
      // Merge new component name into the kept bullet's prefix.
      const entry = kept[existingIdx];
      entry.names.push(namePrefix);
      // Only re-stitch when the original bullet had a chain-name prefix
      // to merge; system-level bullets (no prefix) stay unchanged.
      if (entry.names.length > 1 && entry.suffix) {
        // Pluralize the leading verb so subject-verb agreement is preserved
        // when the merged subject becomes "X and Y …".
        const pluralized = entry.suffix
          .replace(/^contributes\b/i, 'contribute')
          .replace(/^provides\b/i, 'provide')
          .replace(/^adds\b/i, 'add')
          .replace(/^has\b/i, 'have');
        entry.text = entry.names.join(' and ') + ' ' + pluralized.replace(/^\s+/, '');
      }
    }
    // else: identical concept + same component → silent drop
  }
  return kept.slice(0, 6).map((k) => k.text);
}

// ──────────────────────────────────────────────────────────
// Pass 23 (Commit 7) — §7 concept-family dedup + cap-at-3.
// ──────────────────────────────────────────────────────────
//
// The exact-concept dedup above collapses verbatim duplicates and
// merges chain-name attribution. It does NOT collapse conceptual
// synonyms: {precision, transparency, detail, resolution, transient
// sharpness, attack} all describe one warmth-trades-resolution limit
// but each carries a distinct token set and survives as its own
// bullet. The engine routinely emits 4–6 limits that articulate one
// underlying constraint four ways.
//
// `dedupeStrengthsByFamily` runs the existing exact-dedup first, then
// collapses by family bucket, then caps at 3. Within a bucket, the
// survivor preference is: (1) a bullet WITHOUT a chain-name prefix
// (system-level framing reads cleaner than per-component attribution),
// (2) shortest bullet (most editorial). Bullets whose family is
// unknown keep their identity so the taxonomy never silently swallows
// an out-of-vocabulary concept.
//
// Strength/limit families are isolated because some tokens carry
// opposite valence: "headroom" is a limit concept ("limited
// orchestral headroom") but a strengths-side bullet mentioning
// "headroom" reads as dynamic capability.

const STRENGTH_FAMILIES: Record<string, ReadonlySet<string>> = {
  tonal_density: new Set([
    'tonal-density', 'tonal', 'density', 'warmth', 'warm', 'harmonic',
    'richness', 'rich', 'body', 'weight',
  ]),
  flow: new Set([
    'flow', 'rhythm', 'rhythmic', 'engagement', 'engaging', 'musical',
    'musicality', 'pacing', 'drive',
  ]),
  coherence: new Set([
    'coherence', 'coherent', 'integration', 'integrated', 'voicing',
    'tonal-coherence', 'system-coherence',
  ]),
  dynamics: new Set([
    'dynamic', 'dynamics', 'ease', 'scale', 'headroom',
  ]),
  imaging: new Set([
    'imaging', 'soundstage', 'stage', 'focus', 'precision',
  ]),
};

const LIMIT_FAMILIES: Record<string, ReadonlySet<string>> = {
  transparency: new Set([
    'precision', 'transparency', 'transparent', 'detail', 'resolution',
    'resolving', 'transient', 'transients', 'attack', 'sharpness',
    'analytical',
  ]),
  composure: new Set([
    'composure', 'congestion', 'congested', 'dense', 'complex', 'control',
  ]),
  placement: new Set([
    'placement', 'room', 'bass', 'boundary',
  ]),
  headroom: new Set([
    'headroom', 'orchestral', 'peak', 'peaks', 'ceiling', 'power',
  ]),
  voicing_cost: new Set([
    'smoothing', 'polite', 'soft',
  ]),
};

const FAMILY_DEDUP_CAP = 3;

function conceptFamilyKey(
  bullet: string,
  chainNames: string[],
  kind: 'strength' | 'limit',
): string | undefined {
  let body = bullet.toLowerCase();
  for (const tok of chainAttributionTokens(chainNames)) {
    const re = new RegExp(
      '^' + escapeForRegex(tok) + '\\s+(?:contributes|provides|adds|has)\\s+',
      'i',
    );
    body = body.replace(re, '');
  }
  const tokens = new Set(
    body.split(/[^a-z-]+/).filter((t) => t.length > 2),
  );
  const table = kind === 'strength' ? STRENGTH_FAMILIES : LIMIT_FAMILIES;
  for (const [familyKey, familyTokens] of Object.entries(table)) {
    for (const t of familyTokens) {
      if (tokens.has(t)) return familyKey;
    }
  }
  return undefined;
}

function dedupeStrengthsByFamily(
  items: string[] | undefined,
  chainNames: string[],
  kind: 'strength' | 'limit',
): string[] | undefined {
  if (!items) return items;
  if (items.length === 0) return items;
  // Step 1: existing exact-concept dedup (merges chain-name attribution).
  const exactDeduped = dedupeStrengthsByConcept(items, chainNames);
  if (!exactDeduped) return exactDeduped;
  // Step 2: bucket by family.
  const buckets = new Map<string, string[]>();
  const order: string[] = [];
  for (const bullet of exactDeduped) {
    const family = conceptFamilyKey(bullet, chainNames, kind);
    const key = family ?? ('__unkeyed__' + bullet);
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(bullet);
  }
  // Step 3: pick the most editorial survivor per bucket.
  const collapsed: string[] = order.map((key) => {
    const members = buckets.get(key)!;
    if (members.length === 1) return members[0];
    const withoutPrefix = members.filter(
      (m) => findChainNamePrefix(m, chainNames) === undefined,
    );
    const pool = withoutPrefix.length > 0 ? withoutPrefix : members;
    return pool.slice().sort((a, b) => a.length - b.length)[0];
  });
  // Step 4: hard cap at 3.
  return collapsed.slice(0, FAMILY_DEDUP_CAP);
}

/**
 * Presentation-layer derivation of a meaningful §9 step card title.
 *
 * The engine populates `recommendedSequence[].action` with a freeform
 * sentence describing the step's recommendation. This helper produces
 * an editorial-grade card title from the action's leading verb and
 * primary noun phrase, so the step cards read as scannable rather
 * than as workflow numbers.
 *
 * Pattern table is ordered — the first matching pattern wins. When
 * no pattern matches, falls back to "Step N" so a missed pattern
 * degrades to current behavior rather than producing a broken title.
 *
 * The original sequence number is preserved as the card's subtitle
 * (the EditorialSubCard primitive already exposes that slot).
 */
const STEP_TITLE_MAX_LENGTH = 42;
const STEP_TITLE_MIN_LENGTH = 3;

function deriveStepTitle(
  action: string | undefined,
  stepNumber: number,
): string {
  const fallback = `Step ${stepNumber}`;
  if (!action) return fallback;

  // Take just the first sentence for the title source.
  const first = splitSentences(action)[0] ?? action;
  const trimmed = first.trim();

  // 1. Engine bold-token shape: "**Title** — body"
  const boldMatch = trimmed.match(/^\*\*([^*]+)\*\*\s*[—\-]/);
  if (boldMatch) {
    const title = boldMatch[1].trim();
    if (title.length >= STEP_TITLE_MIN_LENGTH && title.length <= STEP_TITLE_MAX_LENGTH) {
      return title;
    }
  }

  // 2. Keep-everything verdict: "Keep **X**, **Y** — ..."
  if (/^Keep\s+\*\*/i.test(trimmed)) {
    return 'Keep What Works';
  }

  // 3. Audition / Compare / Test / Try patterns
  const auditionMatch = trimmed.match(
    /^(Audition|Compare|Test|Try)\b\s+(?:a\s+|an\s+|the\s+)?([A-Za-z][A-Za-z\s-]+?)(?:\s+against|\s+before|\s+in\s+your|\s+with|[.,]|$)/i,
  );
  if (auditionMatch) {
    const verb = auditionMatch[1].charAt(0).toUpperCase() + auditionMatch[1].slice(1).toLowerCase();
    const objectRaw = auditionMatch[2].trim().toLowerCase();
    // Match against generic role nouns to produce a clean title.
    const obj = /amplifier|amp|integrated/.test(objectRaw)
      ? 'the Amplifier'
      : /dac|source|streamer/.test(objectRaw)
        ? 'the Source'
        : /speaker|monitor/.test(objectRaw)
          ? 'the Speakers'
          : 'the Pairing';
    return `${verb} ${obj}`;
  }

  // 4. Preserve / Hold / Do not touch / Avoid patterns
  if (/^(?:Do\s+not\s+touch|Avoid\s+touching|Preserve|Hold|Keep)\b/i.test(trimmed)) {
    // Extract what to preserve from the object of the verb.
    const objMatch = trimmed.match(
      /^(?:Do\s+not\s+touch|Avoid\s+touching|Preserve|Hold|Keep)\s+(?:the\s+)?(.+?)(?:[.,]|\s+(?:if|when|unless|or)\b|$)/i,
    );
    if (objMatch) {
      const objLower = objMatch[1].toLowerCase();
      if (/dac.*speaker|speaker.*dac/.test(objLower)) return 'Preserve the DAC and Speakers';
      if (/dac/.test(objLower)) return 'Preserve the DAC';
      if (/speaker|monitor/.test(objLower)) return 'Preserve the Speakers';
      if (/amp|integrated/.test(objLower)) return 'Preserve the Amplifier';
      return 'Preserve What Works';
    }
    return 'Preserve What Works';
  }

  // 5. Conditional opener: "If the trade-off feels worth it, plan the swap."
  if (/^If\b/i.test(trimmed)) {
    if (/swap|change|upgrade|replace/i.test(trimmed)) return 'Plan the Swap';
    return 'Decide and Act';
  }

  // 6. Plan / Schedule
  const planMatch = trimmed.match(/^(Plan|Schedule)\s+(?:the\s+)?(.+?)(?:[.,]|\s+if|$)/i);
  if (planMatch) {
    const verb = planMatch[1].charAt(0).toUpperCase() + planMatch[1].slice(1).toLowerCase();
    return `${verb} the ${capitalizeFirst(planMatch[2].trim().split(/\s+/)[0])}`;
  }

  // No pattern matched — graceful fallback.
  return fallback;
}

/**
 * Pass 24 (Commit 8) — soften §9 step action prose to advisor voice.
 *
 * The engine emits a small set of action patterns that the reader
 * audit flagged as either circular (Step 2 — "If the trade-off feels
 * worth it, plan the swap." restates the editorial title "Plan the
 * Swap") or blunt-imperative (Step 3 — "Do not touch the DAC or the
 * speakers." reads as command-and-control).
 *
 * This helper detects the exact known patterns and rewrites them
 * into reviewer-grade advisor framing that names the chain
 * components by name. It is intentionally narrow: it fires only on
 * the audited engine patterns and falls through otherwise so any
 * action it doesn't recognize passes through unchanged.
 *
 * Title derivation runs against the ORIGINAL engine action so the
 * editorial title ("Preserve the DAC and Speakers" / "Plan the
 * Swap") still resolves correctly — only the rendered body changes.
 */
function softenStepAction(
  action: string | undefined,
  chainNames: string[],
  chainRoles: Array<string | undefined>,
): string | undefined {
  if (!action) return action;
  // Pattern A — "Do not touch the X" / "Do not touch the X or the Y"
  // (also: "Avoid touching", "Don't touch").
  const noTouch = action.match(
    /^(?:do\s+not|don'?t|avoid)\s+touch(?:ing)?\s+(?:the\s+)?(.+?)\.?\s*$/i,
  );
  if (noTouch) {
    const tokens = noTouch[1]
      .split(/\s+(?:or|and)\s+(?:the\s+)?/i)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const matched: string[] = [];
    for (const tok of tokens) {
      for (let i = 0; i < chainNames.length; i++) {
        const family = roleFamily(chainRoles[i]);
        const isMatch =
          (/^(?:dac|source|streamer|turntable|transport|phono)\b/.test(tok) && family === 'source') ||
          (/^(?:amplifier|amp|integrated|preamp|monoblock)\b/.test(tok) && family === 'amplifier') ||
          (/^(?:speakers?|loudspeakers?)\b/.test(tok) && family === 'speaker');
        if (isMatch && !matched.includes(chainNames[i])) {
          matched.push(chainNames[i]);
          break;
        }
      }
    }
    if (matched.length === 1) {
      return `${matched[0]} is already doing what this system asks of it — leave it in place.`;
    }
    if (matched.length === 2) {
      return `${matched[0]} and ${matched[1]} are already doing what this system asks of them — leave them in place.`;
    }
    if (matched.length >= 3) {
      const head = matched.slice(0, -1).join(', ');
      return `${head} and ${matched[matched.length - 1]} are already doing what this system asks of them — leave them in place.`;
    }
  }
  // Pattern B — circular: "If [trade-off / worth it / it works], plan
  // the swap/change/upgrade." The title derives to "Plan the Swap" and
  // the action restates it. Rewrite to advisor framing that names what
  // the reader should actually do with the audition result.
  if (
    /^if\b/i.test(action) &&
    /\b(?:trade[- ]?off|worth)\b/i.test(action) &&
    /\bplan\s+the\s+(?:swap|change|upgrade)\.?\s*$/i.test(action)
  ) {
    return 'If the audition confirms the trade-off is worth it, commit with care for fit and timing — this is a move to a different system, not an upgrade-in-place.';
  }
  return action;
}

/**
 * Presentation-layer derivation of the §2 *Profile* "What it trades" row.
 *
 * `primaryConstraint.componentName` is structurally a label (e.g. "DAC",
 * "Amplification", "Amplifier headroom") — useful for chrome but not a
 * trade-off sentence. The Profile card's third row needs a sentence-shaped
 * summary of what the system trades to deliver its character.
 *
 * Resolution order, by editorial preference:
 *   1. First assessmentLimitations entry — canonically the most
 *      representative trade-off the system makes.
 *   2. primaryConstraint.impact — narrative impact statement when the
 *      builder populated it.
 *   3. A small derived sentence from primaryConstraint.componentName
 *      so the row still says something useful in sparse-data cases.
 *   4. undefined → the row is gracefully omitted (Profile card handles
 *      independent row data-gating).
 *
 * No engine changes. No builder changes. Pure presentation derivation.
 */
function deriveWhatItTrades(a: AdvisoryResponse): string | undefined {
  if (a.assessmentLimitations && a.assessmentLimitations.length > 0) {
    return a.assessmentLimitations[0];
  }
  if (a.primaryConstraint?.impact) {
    return a.primaryConstraint.impact;
  }
  if (a.primaryConstraint?.componentName) {
    // Editorial framing rather than the engine's diagnostic label —
    // names the component that ultimately shapes the system's limits
    // without leaning on "primary constraint" / "bottleneck" vocabulary.
    return `Much of this system's practical character — and where it reaches its limits — is shaped by the ${a.primaryConstraint.componentName}.`;
  }
  return undefined;
}

/**
 * Hardening Phase A — explicit conflict / mismatch / bottleneck vocabulary.
 *
 * These tokens, when present in any of the engine-emitted fields the
 * artifact reads (`systemSignature`, `systemInteraction`, `systemContext`,
 * `systemSynergy`, `assessmentLimitations[]`, `primaryConstraint.impact`),
 * signal that the engine has actively diagnosed a voicing conflict,
 * synergy failure, hierarchy mismatch, or hard drive limit. §8
 * coherence prose and §9 listener-fit prose MUST suppress on such
 * chains — otherwise the artifact ends up asserting positive coherence
 * or recommending the system to a listener type while a sibling
 * section describes the same system as fighting itself or as fundamentally
 * mismatched. See the 36-fixture Final Product Validation Report,
 * Cluster G, for the trust-failure evidence.
 *
 * The vocabulary is intentionally conservative: only phrases that an
 * editorial engine would emit when it has decided a system is *not*
 * working coherently. Generic words like "limit" or "warm" do NOT
 * appear — those are normal descriptive vocabulary the engine uses
 * for healthy systems.
 */
const CONFLICT_VOCABULARY: readonly string[] = [
  'conflict',
  'fighting',
  'fights itself',
  'collapses toward',
  'over-warming',
  'over-warm ',
  'mismatch',
  'mismatched',
  'bottleneck',
  'bottlenecked',
  'cannot translate',
  'cannot drive',
  'cannot mask',
  'hierarchy inverted',
  'investment inverted',
  'unresolved',
  'potential not realized',
  'design intent unmet',
  'limits everything downstream',
  'will not perform',
  'insufficient',
  'period-mismatch',
  // Validation re-run discovered these phrases on Fixture #32
  // (over-invested speakers): the engine emits "do not approach its
  // tier" and "reveals every limitation of the front end" instead of
  // the conflict / bottleneck vocabulary above. Both are unambiguous
  // mismatch signals that real engine output uses.
  'do not approach',
  'do not reflect',
  'reveals every limitation',
];

/**
 * Hardening Phase A — detect engine-emitted conflict signals.
 *
 * Returns true when at least one CONFLICT_VOCABULARY token appears in
 * any of the artifact-relevant engine fields (case-insensitive). When
 * true, §8 coherence prose and §9 listener-fit prose suppress to
 * preserve cross-section trust.
 *
 * The check is intentionally non-recursive and string-only — no fact
 * extraction, no signature parsing — because the conflict signals we
 * are guarding against are always explicit in the engine prose.
 */
function hasConflictSignal(advisory: AdvisoryResponse): boolean {
  const fields: Array<string | undefined> = [
    advisory.systemSignature,
    advisory.systemInteraction,
    advisory.systemContext,
    advisory.systemSynergy,
    advisory.primaryConstraint?.impact,
    ...((advisory.assessmentLimitations ?? []) as string[]),
  ];
  const blob = fields
    .filter((f): f is string => typeof f === 'string')
    .join(' ')
    .toLowerCase();
  for (const token of CONFLICT_VOCABULARY) {
    if (blob.includes(token)) return true;
  }
  return false;
}

/**
 * Commit 13 — §8 coherence fallback for chains with no `keepRecommendations`.
 *
 * When the engine emits no keep recommendations, the existing §8 path
 * (`composeWhyThisSystemWorks`) returns undefined and the section
 * silently disappears. §8 is now the coherence bridge between §7
 * (Strengths and Limits) and §9 (What This System Seems Built For); an
 * unannounced gap in that bridge reads as missing analysis rather than
 * graceful omission.
 *
 * This fallback fires only when ALL of the following hold:
 *   - chainNames.length >= 2
 *   - >= 2 distinct role families present
 *   - coherence evidence exists, defined as EITHER:
 *       (a) `systemSignature` contains a tonal anchor
 *           (warm / lean / analytical / neutral), OR
 *       (b) at least two chain components have anchored facts
 *           (efficiency, topology, cabinet, tech, tonalLean)
 *
 * When evidence is absent the section is omitted — same outcome as
 * before, just intentional rather than accidental.
 *
 * Composition is two sentences, parallel in shape to the keep-recs
 * branch but worded as inference rather than verdict. The result does
 * NOT quote any component reading verbatim; it does not duplicate the
 * per-component summaries already living in §5.
 */
function composeCoherenceFallback(
  advisory: AdvisoryResponse,
  chainNames: string[],
  roles: string[],
  chainFacts: CharacterFacts[],
): string | undefined {
  if (chainNames.length < 2) return undefined;
  const families = roles
    .map((r) => roleFamily(r))
    .filter((f) => f !== 'unknown');
  const familySet = new Set(families);
  if (familySet.size < 2) return undefined;

  const sig = (advisory.systemSignature ?? '').toLowerCase();
  const sigAnchored = /\bwarm\b|\blean\b|\banalytical\b|\bneutral\b/.test(sig);

  const factsAnchored =
    chainFacts.filter(
      (f) => !!f.efficiency || !!f.topology || !!f.cabinet || !!f.tech || !!f.tonalLean,
    ).length >= 2;

  if (!sigAnchored && !factsAnchored) return undefined;

  // Sentence 1 — chain-length frame, inference register.
  let s1: string;
  if (chainNames.length === 2) {
    s1 =
      'With the available information, these two components appear to be working toward a single voicing rather than each asserting itself independently.';
  } else if (chainNames.length === 3) {
    s1 =
      'With the available information, these three components appear to be working toward a single voicing rather than each asserting itself independently.';
  } else {
    s1 =
      'With the available information, these components appear to be working toward a single voicing rather than each asserting itself independently.';
  }

  // Sentence 2 — coherence framing keyed by role families present.
  // Parallel shape to the keep-recs branch, but ends with an explicit
  // honesty caveat that confirming this would require listening rather
  // than assessment.
  const hasSource = familySet.has('source');
  const hasAmp = familySet.has('amplifier');
  const hasSpeaker = familySet.has('speaker');
  let s2: string;
  if (hasSource && hasAmp && hasSpeaker) {
    s2 =
      "The system's apparent coherence — the way the source character, amplification, and speaker presentation compound — looks like the primary value here, though confirming this would require listening rather than assessment.";
  } else if (hasAmp && hasSpeaker) {
    s2 =
      "The system's apparent coherence — the way the amplifier's drive reaches the room through the speakers — looks like the primary value here, though confirming this would require listening rather than assessment.";
  } else if (hasSource && hasAmp) {
    s2 =
      "The system's apparent coherence — the way the source character carries through the amplifier's shaping — looks like the primary value here, though confirming this would require listening rather than assessment.";
  } else {
    s2 =
      "The system's apparent coherence — the way the pieces compound rather than each asserting itself independently — looks like the primary value here, though confirming this would require listening rather than assessment.";
  }

  return preferSystemTerminology([s1, s2].join(' '));
}

/**
 * Compose the §8 *Why This System Works* editorial paragraph
 * (Pass 23 — Commit 7).
 *
 * Replaces the previous per-component card list with a single
 * editorial paragraph that bridges §7 (Strengths and Limits) to
 * §9 (If You Were to Change Something). The paragraph asserts
 * coherence as the unit of value and pre-cautions destination-level
 * swaps. It does NOT quote `keepRecommendations[].reason` (that
 * register lives in §5 component cards already); only the COUNT is
 * read as a render gate.
 *
 * Returns undefined — and the section is gracefully omitted — when:
 *   - keepRecommendations is empty/missing AND coherence fallback also
 *     declines (chain too sparse, or no tonal-anchor / facts evidence)
 *   - chain has < 2 components (no coherence-among-pieces story)
 *   - chain spans < 2 distinct role families
 *
 * Composition is template-based and DOES pass through
 * `preferSystemTerminology` so the same chain→system rewriter that
 * §3/§4/§6 use applies here too.
 */
function composeWhyThisSystemWorks(
  advisory: AdvisoryResponse,
  chainNames: string[],
  roles: string[],
  /**
   * Commit 13 — optional chainFacts so the coherence-fallback branch
   * (used when the engine emits no `keepRecommendations`) can require
   * anchored fact evidence on at least two chain components before
   * rendering. Defaults to an empty array so callers that don't pass
   * facts still get the existing keep-recs branch — the fallback only
   * fires when facts are actually provided.
   */
  chainFacts: CharacterFacts[] = [],
): string | undefined {
  // Hardening Phase A — §8 conflict-signal suppression (B3).
  //
  // When the engine has explicitly diagnosed a voicing conflict,
  // synergy failure, hierarchy mismatch, or hard drive limit (via
  // any of the fields hasConflictSignal reads), §8 must NOT render
  // positive coherence prose — either the keep-recs branch or the
  // coherence fallback. The artifact's other sections (§4, §6, §7,
  // §10) carry the conflict message; §8 silently omits rather than
  // re-asserting coherence that contradicts what the artifact has
  // just said. See Final Product Validation Report, Cluster G.
  if (hasConflictSignal(advisory)) return undefined;
  // Commit 13 — §8 coherence fallback path. The original §8 gates on
  // `keepRecommendations` because they are the anchored evidence the
  // engine produced for "what is already working." When the engine
  // emits no keep recs but the chain itself shows coherence evidence
  // (a tonal anchor in `systemSignature`, OR ≥2 chain components with
  // anchored facts), we render a cautious fallback paragraph rather
  // than silently dropping the coherence bridge between §7 and §9.
  //
  // The fallback is deliberately worded as inference, not verdict
  // ("appear to be working toward", "looks like the primary value
  // here, though confirming this would require listening rather than
  // assessment") so it does not pretend to be the anchored keep-recs
  // path.
  if (!advisory.keepRecommendations || advisory.keepRecommendations.length === 0) {
    return composeCoherenceFallback(advisory, chainNames, roles, chainFacts);
  }
  if (chainNames.length < 2) return undefined;
  // Step 2 — gate on multi-family chain (the coherence-among-pieces
  // story requires more than one role family in play).
  const families = roles.map((r) => roleFamily(r)).filter((f) => f !== 'unknown');
  const familySet = new Set(families);
  if (familySet.size < 2) return undefined;
  // Step 3 — sentence 1: chain length.
  // Pass 24 (Commit 8) — replace "pulling in its own direction"
  // (audited as cliché) with "asserting itself independently"
  // across all chain-length branches.
  let s1: string;
  if (chainNames.length === 2) {
    s1 = 'This system succeeds because its two components reinforce a single voicing rather than asserting themselves independently.';
  } else if (chainNames.length === 3) {
    s1 = 'This system succeeds because its three components reinforce a single voicing rather than each asserting itself independently.';
  } else {
    s1 = 'This system succeeds because its components reinforce a single voicing rather than each asserting itself independently.';
  }
  // Step 4 — sentence 2: coherence framing keyed by role families present.
  // Pass 24 (Commit 8) — "speaker translation" (audited as mechanical
  // noun choice) softened to "speaker presentation"; "amplifier
  // weight reaches the speaker's translation" softened in parallel.
  let s2: string;
  const hasSource = familySet.has('source');
  const hasAmp = familySet.has('amplifier');
  const hasSpeaker = familySet.has('speaker');
  if (hasSource && hasAmp && hasSpeaker) {
    s2 = "The system's coherence — the way the source character, amplifier weight, and speaker presentation compound — is the primary value here.";
  } else if (hasSource && hasAmp) {
    s2 = "The system's coherence — the way the source character carries through the amplifier's shaping — is the primary value here.";
  } else if (hasAmp && hasSpeaker) {
    s2 = "The system's coherence — the way the amplifier's drive reaches the room through the speakers — is the primary value here.";
  } else {
    s2 = "The system's coherence — the way the pieces compound rather than each asserting itself independently — is the primary value here.";
  }
  // Step 5 — sentence 3: constraint-aware caveat for would-be changers.
  let s3: string;
  const constraintName = advisory.primaryConstraint?.componentName;
  if (constraintName) {
    // Find the constraint component's role family in this chain.
    const idx = chainNames.findIndex((n) => n.toLowerCase() === constraintName.toLowerCase());
    const constraintFamily = idx >= 0 ? roleFamily(roles[idx]) : undefined;
    if (constraintFamily === 'speaker') {
      s3 = 'Major changes, particularly to the destination-level loudspeaker, risk trading away what already works for marginal gains.';
    } else if (constraintFamily === 'amplifier') {
      s3 = 'Major changes, particularly to the amplifier that carries the system\'s weight, risk trading away what already works for marginal gains.';
    } else if (constraintFamily === 'source') {
      s3 = 'Major changes upstream risk trading away the source character the rest of the system has been built around.';
    } else {
      // Constraint named but not matched to a chain component.
      s3 = 'Major changes, even to a single component, risk trading away the coherence that defines what this system does well.';
    }
  } else {
    s3 = 'Major changes, even to a single component, risk trading away the coherence that defines what this system does well.';
  }
  const joined = [s1, s2, s3].join(' ');
  return preferSystemTerminology(joined);
}

/**
 * Compose the §9 *What This System Seems Built For* listener-context
 * paragraph (Commit 9 — listener-context layer).
 *
 * The artifact's first nine sections are all "what is this system" —
 * components, character, interaction, strengths, why it works. This
 * helper introduces a single section that pivots toward "who is this
 * system for" by inferring presentationally from already-available
 * data:
 *   - systemSignature (warm / lean / neutral lean explicit)
 *   - chainFacts per component (efficiency, cabinet, amp tech,
 *     tonalLean)
 *   - primaryConstraint role family (bottleneck-aware mismatch)
 *
 * Sentence model (three sentences max; each is independently
 * confidence-gated and OMITTED when evidence is insufficient):
 *
 *   1. STYLE / VOLUME — what listening this system favours
 *        HIGH:   high-efficiency speaker + tube amp     → "intimate, low-to-moderate volume"
 *        HIGH:   low-efficiency speaker + solid-state   → "scale and headroom at higher volume"
 *        MEDIUM: high-efficiency speaker (no amp tech)  → "moderate-volume listening"
 *        MEDIUM: warm lean (system-level signal)        → tonal-density rewards-listeners frame
 *        MEDIUM: lean / analytical (system-level)       → detail-and-precision rewards-listeners frame
 *        LOW:    none of the above                      → omit
 *
 *   2. MATERIAL AFFINITY — what kind of recordings reward this voice
 *        HIGH:   warm + high-efficiency                 → "Jazz, vocals, and well-produced acoustic…"
 *        HIGH:   lean signature                         → "Well-recorded studio material…"
 *        LOW:    otherwise                              → omit
 *
 *   3. HONEST MISMATCH — when this system will not serve well
 *        HIGH:   amp bottleneck + high-efficiency       → drive ceiling at SPL / large rooms
 *        HIGH:   speaker bottleneck                     → scale ceiling on orchestral material
 *        HIGH:   warm lean                              → bright / analytical material hears warmth
 *                                                         as polite rather than vivid
 *        LOW:    otherwise                              → omit
 *
 * Returns undefined and the section is gracefully omitted when ALL
 * three sentences are silent. preferSystemTerminology runs on the
 * joined output so "chain" never leaks.
 *
 * Editorial discipline: no personality-test language, no AI-therapy
 * register, no certainty where confidence is low. The section frames
 * the SYSTEM's listener fit ("this system favours / rewards") rather
 * than psychoanalyzing the listener.
 */
function composeListenerContext(
  advisory: AdvisoryResponse,
  chainNames: string[],
  roles: Array<string | undefined>,
  chainFacts: CharacterFacts[],
): string | undefined {
  if (chainNames.length === 0) return undefined;
  // Hardening Phase A — §9 conflict-signal suppression (B4).
  //
  // When the engine has diagnosed a voicing conflict / synergy
  // failure / hierarchy mismatch / hard drive limit, §9 must NOT
  // recommend this system to a listener-fit profile. Per the Final
  // Product Validation Report Cluster G, the artifact previously
  // emitted "favors listeners who value ease and accessibility"
  // on a chain whose §6 said "reveals every limitation of the front
  // end". §9 silently omits; §6 / §7 carry the actual judgment.
  if (hasConflictSignal(advisory)) return undefined;

  // ── Signal extraction ───────────────────────────────────
  const sigLower = (advisory.systemSignature ?? '').toLowerCase();
  let lean: 'warm' | 'lean' | 'neutral' | undefined;
  if (/\bwarm\b/.test(sigLower)) lean = 'warm';
  else if (/\blean\b|\banalytical\b/.test(sigLower)) lean = 'lean';
  else if (/\bneutral\b/.test(sigLower)) lean = 'neutral';
  if (!lean) {
    const warmCount = chainFacts.filter((f) => f.tonalLean === 'warm').length;
    const leanCount = chainFacts.filter((f) => f.tonalLean === 'lean').length;
    if (warmCount >= 2) lean = 'warm';
    else if (leanCount >= 2) lean = 'lean';
  }

  let speakerEfficiency: 'high' | 'low' | undefined;
  let speakerCabinet: NonNullable<CharacterFacts['cabinet']> | undefined;
  let ampTech: 'tube' | 'solid-state' | undefined;
  for (let i = 0; i < chainNames.length; i++) {
    const family = roleFamily(roles[i]);
    if (family === 'speaker') {
      speakerEfficiency = speakerEfficiency ?? chainFacts[i]?.efficiency;
      speakerCabinet = speakerCabinet ?? chainFacts[i]?.cabinet;
    } else if (family === 'amplifier') {
      // Pick the first chain amplifier whose tech we know; ignore hybrid.
      if (!ampTech) {
        const t = chainFacts[i]?.tech;
        if (t === 'tube' || t === 'solid-state') ampTech = t;
      }
    }
  }

  const bn = advisory.primaryConstraint?.componentName;
  let bottleneckFamily: ReturnType<typeof roleFamily> | undefined;
  if (bn) {
    const idx = chainNames.findIndex((n) => n.toLowerCase() === bn.toLowerCase());
    if (idx >= 0) bottleneckFamily = roleFamily(roles[idx]);
  }

  // ── Sentence composition (each independently gated) ─────
  // Pass 25 (Commit 10) — redesigned to drop genre prescriptions in
  // favour of dimension-led prose: room, volume, listening style,
  // presentation preference, tolerance for imperfect recordings.
  // No genre claims, no psychoanalysis, no "you are" language.
  const sentences: string[] = [];

  // Sentence 1 — listener-fit summary (preference dimensions, not genres).
  if (speakerEfficiency === 'high' && ampTech === 'tube') {
    sentences.push(
      'This system favors listeners who value tonal richness, flow, and long-term listening comfort over maximum resolution or analytical precision.',
    );
  } else if (speakerEfficiency === 'low' && ampTech === 'solid-state') {
    sentences.push(
      'This system favors listeners who want dynamic ease, scale, and headroom — listeners who play at higher volume and prioritize control over delicacy.',
    );
  } else if (speakerEfficiency === 'high') {
    sentences.push(
      "This system favors listeners who value ease and accessibility — the high-efficiency speakers don't need large amplification to come alive.",
    );
  } else if (lean === 'warm') {
    sentences.push(
      'This system favors listeners who value tonal richness and musical flow over analytical detail.',
    );
  } else if (lean === 'lean') {
    sentences.push(
      'This system favors listeners who value detail and transient precision over warmth or rhythmic ease.',
    );
  }

  // Sentence 2 — room and volume profile (dimensions only).
  if (speakerEfficiency === 'high' && ampTech === 'tube') {
    sentences.push(
      'It is most at home in small-to-medium rooms at moderate volume; the high-efficiency speakers do not require large amplification or large spaces to come alive.',
    );
  } else if (speakerEfficiency === 'low' && ampTech === 'solid-state') {
    sentences.push(
      'It is built for larger rooms and moderate-to-high listening levels; the lower-efficiency speakers reward space and amplifier authority.',
    );
  } else if (speakerEfficiency === 'high') {
    sentences.push(
      'Moderate-volume listening in small-to-medium rooms suits this voicing more than large-scale playback.',
    );
  }

  // Sentence 3 — recording tolerance + honest mismatch.
  if (bottleneckFamily === 'amplifier' && speakerEfficiency === 'high' && lean === 'warm') {
    sentences.push(
      "It forgives imperfect recordings more readily than analytical systems, but loud orchestral demands or large rooms will reveal the amplifier's drive ceiling before the speakers run out of voice.",
    );
  } else if (bottleneckFamily === 'amplifier' && speakerEfficiency === 'high') {
    sentences.push(
      "Loud orchestral demands or large rooms will reveal the amplifier's drive ceiling before the speakers run out of voice.",
    );
  } else if (bottleneckFamily === 'speaker') {
    sentences.push(
      "Demanding orchestral material or large rooms will show the speakers' practical ceiling before the rest of the system.",
    );
  } else if (lean === 'warm') {
    sentences.push(
      "It forgives imperfect recordings — production weaknesses sound polite rather than emphasized — but bright or analytical material will hear the system's warmth as gentle rather than vivid.",
    );
  } else if (lean === 'lean') {
    sentences.push(
      'Well-recorded material rewards this system more than warmly-mixed catalog; production weaknesses are exposed rather than smoothed over.',
    );
  }

  // 15-chain acceptance fix D — when only one sentence fires (most
  // commonly the bottleneck-aware mismatch sentence alone), the
  // section reads as a stub. Require at least 2 sentences so the
  // paragraph carries enough context to feel deliberate; otherwise
  // omit.
  if (sentences.length < 2) return undefined;
  // Mark speakerCabinet as intentionally consumed only in the
  // signal-extraction phase (kept for future room-suitability
  // sentence; not currently emitted to preserve confidence
  // discipline).
  void speakerCabinet;
  return preferSystemTerminology(sentences.join(' '));
}

/**
 * Compose a presentational §3 *First Impressions* sentence
 * (Commit 10).
 *
 * The engine's `introSummary` can read as an adjective list
 * (e.g. "leans toward midrange weight, rhythmic ease, and a
 * forgiving treble") that describes many systems equally well. When
 * we have HIGH-confidence character anchors, this helper emits a
 * single opinionated "prioritizes X over Y" sentence that is
 * memorable and system-specific. When anchors are absent, returns
 * undefined and the render falls through to the existing
 * `normalizeFirstImpressions` engine pass.
 *
 * No genre claims, no psychoanalysis — just the system's editorial
 * priorities.
 */
function composeFirstImpressions(
  advisory: AdvisoryResponse,
  chainNames: string[],
  roles: Array<string | undefined>,
  chainFacts: CharacterFacts[],
): string | undefined {
  if (chainNames.length === 0) return undefined;

  // Reuse the same signal extraction as the listener-context helper.
  const sigLower = (advisory.systemSignature ?? '').toLowerCase();
  let lean: 'warm' | 'lean' | 'neutral' | undefined;
  if (/\bwarm\b/.test(sigLower)) lean = 'warm';
  else if (/\blean\b|\banalytical\b/.test(sigLower)) lean = 'lean';
  else if (/\bneutral\b/.test(sigLower)) lean = 'neutral';
  if (!lean) {
    const warmCount = chainFacts.filter((f) => f.tonalLean === 'warm').length;
    const leanCount = chainFacts.filter((f) => f.tonalLean === 'lean').length;
    if (warmCount >= 2) lean = 'warm';
    else if (leanCount >= 2) lean = 'lean';
  }

  let speakerEfficiency: 'high' | 'low' | undefined;
  let ampTech: 'tube' | 'solid-state' | undefined;
  for (let i = 0; i < chainNames.length; i++) {
    const family = roleFamily(roles[i]);
    if (family === 'speaker') {
      speakerEfficiency = speakerEfficiency ?? chainFacts[i]?.efficiency;
    } else if (family === 'amplifier') {
      if (!ampTech) {
        const t = chainFacts[i]?.tech;
        if (t === 'tube' || t === 'solid-state') ampTech = t;
      }
    }
  }

  // HIGH confidence — warm + tube + high-efficiency → tone-and-flow framing.
  if (lean === 'warm' && ampTech === 'tube' && speakerEfficiency === 'high') {
    return 'This system prioritizes tone, flow, and musical ease over analytical precision or maximum resolution.';
  }
  // HIGH confidence — lean + solid-state + lower-efficiency → resolution-and-authority.
  if (lean === 'lean' && ampTech === 'solid-state' && speakerEfficiency === 'low') {
    return 'This system prioritizes resolution, transient precision, and dynamic authority over warmth or rhythmic ease.';
  }
  // MEDIUM confidence — warm signature only.
  if (lean === 'warm') {
    return 'This system prioritizes tonal density and flow over analytical detail.';
  }
  // MEDIUM confidence — lean / analytical signature only.
  if (lean === 'lean') {
    return 'This system prioritizes detail and transient precision over warmth or rhythmic flow.';
  }
  // LOW confidence — fall through to engine output.
  return undefined;
}

/**
 * Compose the §10 *If You Were to Change Something* upgrade-hierarchy
 * preface paragraph (Commit 10).
 *
 * The engine's `upgradeDirection` + `recommendedSequence` already
 * surface change advice, but they treat all components symmetrically.
 * For systems that contain destination-class loudspeakers or mature
 * amplifiers, the reader needs a higher-level framing before the
 * step list — one that articulates the leverage hierarchy:
 *
 *   Level 1   front-end refinement (source / DAC / cabling)
 *               — small improvements compound
 *   Level 2   amplifier replacement
 *               — philosophical change, not an obvious upgrade
 *   Level 3   destination speakers
 *               — treat as fixed point, not swap candidate
 *
 * Returns undefined when neither protection (destination speaker
 * NOR mature amplifier) fires; the engine direction renders alone.
 * When at least one protection fires, the paragraph names the
 * specific protected components and slots into §10 BEFORE the
 * engine's `upgradeDirection` prose.
 *
 * Heuristics are presentational and reuse the Commit 7 protection
 * detectors (`isDestinationSpeaker`, `isMatureAmplifier`).
 */
function composeUpgradeHierarchy(
  chainNames: string[],
  roles: Array<string | undefined>,
  chainFacts: CharacterFacts[],
  /**
   * Hardening Phase A (B5) — when the engine has explicitly named a
   * component as the primary constraint, that component must NOT be
   * protected by the hierarchy paragraph. The engine has identified
   * it as the gating limit; the protective "treat as a fixed point" /
   * "philosophical change" framing would directly contradict the
   * engine's upgrade-direction. Names are compared case-insensitively
   * after whitespace normalization. Defaults to undefined so callers
   * that don't pass a constraint name preserve legacy behavior.
   */
  primaryConstraintName?: string,
): string | undefined {
  if (chainNames.length === 0) return undefined;

  const normalize = (s: string) => s.trim().toLowerCase();
  const constraintLower = primaryConstraintName ? normalize(primaryConstraintName) : undefined;

  const destinationSpeakers: string[] = [];
  const matureAmps: string[] = [];
  for (let i = 0; i < chainNames.length; i++) {
    const family = roleFamily(roles[i]);
    const facts = chainFacts[i];
    if (!facts) continue;
    // Hardening Phase A B5 — skip components the engine has named as
    // the primary constraint. Their replacement is the upgrade
    // recommendation, not the protective fixed-point framing.
    if (constraintLower && normalize(chainNames[i]) === constraintLower) continue;
    if (family === 'speaker' && isDestinationSpeaker(chainNames[i], roles[i], facts)) {
      destinationSpeakers.push(chainNames[i]);
    } else if (family === 'amplifier' && isMatureAmplifier(chainNames[i], roles[i], facts)) {
      matureAmps.push(chainNames[i]);
    }
  }
  if (destinationSpeakers.length === 0 && matureAmps.length === 0) return undefined;

  const sentences: string[] = [];
  // Level 1 — always emit when the section fires; it is the lowest-risk path.
  sentences.push(
    "The lowest-risk path forward is front-end refinement — source, DAC, and cabling — where small improvements compound without changing the system's character.",
  );
  // Level 2 — name the mature amplifier if there is exactly one; pluralize otherwise.
  if (matureAmps.length === 1) {
    sentences.push(
      `Replacing the ${matureAmps[0]} is a philosophical change rather than an obvious upgrade — a different system, not the same one improved.`,
    );
  } else if (matureAmps.length >= 2) {
    sentences.push(
      'Replacing the amplification is a philosophical change rather than an obvious upgrade — a different system, not the same one improved.',
    );
  }
  // Level 3 — name the destination loudspeaker if there is exactly one; pluralize otherwise.
  if (destinationSpeakers.length === 1) {
    sentences.push(
      `The ${destinationSpeakers[0]} is a destination-class loudspeaker; treat it as a fixed point rather than a swap candidate.`,
    );
  } else if (destinationSpeakers.length >= 2) {
    sentences.push(
      'The destination-class loudspeakers should be treated as fixed points rather than swap candidates.',
    );
  }

  return preferSystemTerminology(sentences.join(' '));
}

/**
 * Audio XX — System Assessment Artifact.
 *
 * The warm-editorial sibling of the Brand Authority page. Renders a
 * system-assessment response as an 11-section editorial document
 * (10-section through Commit 8; gained §9 listener-context in Commit 9).
 *
 * Section structure (locked heading set, updated 2026-05-31):
 *   1.  Your System                          (SystemHero — chart + chain)
 *   2.  Profile                              (SystemProfileCard — 3 lines)
 *   3.  First Impressions                    (introSummary prose)
 *   4.  Character                            (systemContext + systemSynergy)
 *   5.  The Components                       (EditorialSubCard per component)
 *   6.  How They Work Together               (systemInteraction prose)
 *   7.  Strengths and Limits                 (two-column grid)
 *   8.  Why This System Works                (composed paragraph — Commit 7)
 *   9.  What This System Seems Built For     (composed paragraph — Commit 9)
 *  10.  If You Were to Change Something      (upgradeDirection + paths + sequence)
 *  11.  Sources                              (AdvisorySources)
 *
 * Each section is independently data-gated — renders nothing when its
 * underlying field is absent. The artifact gracefully degrades for
 * sparse responses (consumer-wireless short-circuit, partial chains,
 * etc.) the same way Brand Authority pages degrade for sparse profiles.
 *
 * Visual contract: warm-editorial palette only (see `editorial-tokens.ts`).
 * No cool-slate colors, no chat-bubble chrome, no marketing voice.
 *
 * Gating: the dispatcher in `AdvisoryMessage.tsx` is responsible for
 * checking `SYSTEM_ASSESSMENT_ARTIFACT_ENABLED` before rendering this
 * component. This file does not check the flag itself.
 *
 * Engine, builders, intent classifier, cross-brand resolver, F4 gates,
 * listener-aware framing, listing-eval safety boundaries — none touched.
 */

interface SystemAssessmentArtifactProps {
  advisory: AdvisoryResponse;
}

export default function SystemAssessmentArtifact({
  advisory: a,
}: SystemAssessmentArtifactProps) {
  const hasComponents = !!(a.componentReadings && a.componentReadings.length > 0);
  const hasStrengths = !!(a.assessmentStrengths && a.assessmentStrengths.length > 0);
  const hasLimits = !!(a.assessmentLimitations && a.assessmentLimitations.length > 0);
  const hasStrengthsAndLimits = hasStrengths || hasLimits;
  const hasKeeps = !!(a.keepRecommendations && a.keepRecommendations.length > 0);
  const hasUpgradeDirection = !!a.upgradeDirection;
  const hasUpgradePaths = !!(a.upgradePaths && a.upgradePaths.length > 0);
  const hasSequence = !!(a.recommendedSequence && a.recommendedSequence.length > 0);
  const hasChangeSection = hasUpgradeDirection || hasUpgradePaths || hasSequence;
  // §10 gate: check POST-filter visible sources, not raw input count.
  // hasDisplayableSources() applies the same two-tier whitelist filter
  // that AdvisorySources uses internally — if it returns false, the
  // §10 heading must not render to avoid the orphaned-eyebrow bug
  // documented at source-whitelist.ts:188-205.
  const hasSources = hasDisplayableSources(a.sourceReferences);

  return (
    <article
      aria-label="System Assessment"
      style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '0 1rem',
        color: COLOR.textPrimary,
      }}
    >
      {/* ═══════════ §1 Your System ═══════════ */}
      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={sectionHeadingStyle}>Your System</h2>
        <SystemHero
          spiderChartData={a.spiderChartData}
          systemChain={
            a.systemChain
              ? { names: a.systemChain.names, roles: a.systemChain.roles }
              : undefined
          }
        />
      </section>

      {/* ═══════════ §2 Profile ═══════════
       *  Commit 11 — `systemSignature` and `tendencies` pass through
       *  `preferSystemTerminology` so the chain→system rewriter
       *  reaches §2 too. Without this, the engine-emitted phrase
       *  "source-first chain with coherent-source voicing" surfaced
       *  verbatim in the "What it is" row — the one remaining
       *  user-visible "chain" leak after Commit 8. "signal chain"
       *  topology vocabulary is preserved by the rewriter. */}
      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={sectionHeadingStyle}>Profile</h2>
        <SystemProfileCard
          whatItIs={preferSystemTerminology(a.systemSignature)}
          whatItLeansToward={preferSystemTerminology(a.tendencies)}
          whatItTrades={preferSystemTerminology(deriveWhatItTrades(a))}
        />
      </section>

      {/* ═══════════ §3 First Impressions ═══════════
       *  Source: `introSummary` is assembled from fixed template
       *  fragments. Pass 25 (Commit 10) adds a presentational
       *  "prioritizes X over Y" override that fires when HIGH or
       *  MEDIUM-confidence character anchors are available; it makes
       *  the section memorable and system-specific instead of an
       *  adjective list. When no anchors fire, the engine path runs
       *  via `normalizeFirstImpressions` as before. */}
      {(() => {
        const chainNamesFI = a.systemChain?.names ?? [];
        const chainRolesFI = a.systemChain?.roles ?? [];
        const chainFactsFI = chainNamesFI.map((name, i) =>
          extractCharacterFacts(
            findReadingForName(name, a.componentReadings ?? [], i),
            chainRolesFI[i],
          ),
        );
        const presentational = composeFirstImpressions(a, chainNamesFI, chainRolesFI, chainFactsFI);
        const firstImpressions =
          presentational ?? normalizeFirstImpressions(a.introSummary, a.systemSignature);
        if (!firstImpressions) return null;
        return (
          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={sectionHeadingStyle}>First Impressions</h2>
            <p style={proseStyle}>{firstImpressions}</p>
          </section>
        );
      })()}

      {/* ═══════════ §4 Character ═══════════
       *  Source: `systemContext` carries the entire legacy MemoFormat
       *  narrative; `normalizeCharacterProse` extracts the System-read
       *  block. `systemSynergy` renders as an italic pull-quote below.
       *  Commit 11 — when the two engine fields overlap (synergy line
       *  contained in characterProse OR vice versa), suppress the
       *  redundant copy via `dedupCharacterSynergy` so the section
       *  doesn't double-state the same insight. Also threads the
       *  synergy line through `preferSystemTerminology`. */}
      {(() => {
        const characterProse = normalizeCharacterProse(a.systemContext);
        const synergyRewritten = preferSystemTerminology(a.systemSynergy);
        if (!characterProse && !synergyRewritten) return null;
        const verdict = dedupCharacterSynergy(characterProse, synergyRewritten);
        const showProse =
          !!characterProse && verdict !== 'suppress-character';
        const showSynergy =
          !!synergyRewritten && verdict !== 'suppress-synergy';
        return (
          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={sectionHeadingStyle}>Character</h2>
            {showProse && <p style={proseStyle}>{characterProse}</p>}
            {showSynergy && (
              <p
                style={{
                  ...proseStyle,
                  marginTop: showProse ? '0.65rem' : 0,
                  fontStyle: 'italic',
                  borderLeft: `3px solid ${COLOR.accent}`,
                  paddingLeft: '0.9rem',
                }}
              >
                {synergyRewritten}
              </p>
            )}
          </section>
        );
      })()}

      {/* ═══════════ §5 The Components ═══════════
       *  Cards are built by `buildComponentCards`, which:
       *    - maps each chain name to its matching engine reading by
       *      identity (prefix match) rather than by array index — this
       *      fixes the swap defect where systemChain.names is sorted by
       *      signal-path role while componentReadings preserves
       *      input order;
       *    - strips sentences mentioning products outside the chain
       *      (off-chain drift);
       *    - trims each body to a consistent target word count for
       *      editorial balance.
       *  All transformations are presentation-layer. Engine output is
       *  unchanged; only how the artifact maps and shapes it. */}
      {hasComponents && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={sectionHeadingStyle}>The Components</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {buildComponentCards(
              a.systemChain?.names,
              a.systemChain?.roles,
              a.componentReadings,
              a.primaryConstraint?.componentName,
            ).map((card, i) => (
              <EditorialSubCard
                key={i}
                name={card.name}
                subtitle={card.role}
                body={card.body}
                imageUrl={card.imageUrl}
              />
            ))}
          </div>
        </section>
      )}

      {/* ═══════════ §6 How They Work Together ═══════════
       *  Source: `systemInteraction` can mix true interaction analysis
       *  with single-component product-review drift (specs, brand
       *  history, off-chain product mentions). `normalizeInteractionProse`
       *  drops component-header labels, spec sentences, off-chain
       *  product mentions, and single-component review prose — keeping
       *  only system-level statements and multi-component interaction
       *  sentences. */}
      {(() => {
        const chainNamesI = a.systemChain?.names ?? [];
        const chainRolesI = a.systemChain?.roles ?? [];
        const interactionProse = normalizeInteractionProse(
          a.systemInteraction,
          chainNamesI,
        );
        // Commit 13 — §6 fallback. When the engine emits nothing usable
        // (or nothing at all), compose a cautious, role-family-keyed
        // interaction sentence rather than silently omitting §6. The
        // fallback only fires when sufficient chain structure exists;
        // sparse chains still omit gracefully.
        let resolved: string | undefined = interactionProse;
        if (!resolved) {
          const chainFactsI = chainNamesI.map((name, i) =>
            extractCharacterFacts(
              findReadingForName(name, a.componentReadings ?? [], i),
              chainRolesI[i],
            ),
          );
          resolved = composeInteractionFallback(
            chainNamesI,
            chainRolesI,
            chainFactsI,
          );
        }
        if (!resolved) return null;
        return (
          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={sectionHeadingStyle}>How They Work Together</h2>
            <p style={proseStyle}>{resolved}</p>
          </section>
        );
      })()}

      {/* ═══════════ §7 Strengths and Limits ═══════════
       *  Pass 23 (Commit 7) — heading renamed from "Strengths and
       *  Honest Limits" to "Strengths and Limits". `dedupeStrengthsByFamily`
       *  collapses verbatim duplicates AND conceptual synonyms (e.g.
       *  precision/transparency/detail/resolution all describe one
       *  warmth-trades-resolution limit), then caps at 3 strengths and
       *  3 limits. See the family tables above the helper. */}
      {hasStrengthsAndLimits && (() => {
        // Pass 24 (Commit 8) — propagate the chain→system rewriter into
        // §7 bullets so engine-emitted phrases like "across the chain"
        // surface as "across the system" here too (Commit 5 / Pass 21
        // already applied this elsewhere; §7 bullets were the one
        // remaining surface).
        const dedupedStrengths = dedupeStrengthsByFamily(
          a.assessmentStrengths,
          a.systemChain?.names ?? [],
          'strength',
        )?.map((b) => preferSystemTerminology(b) ?? b);
        const dedupedLimits = dedupeStrengthsByFamily(
          a.assessmentLimitations,
          a.systemChain?.names ?? [],
          'limit',
        )?.map((b) => preferSystemTerminology(b) ?? b);
        const renderStrengths = !!(dedupedStrengths && dedupedStrengths.length > 0);
        const renderLimits = !!(dedupedLimits && dedupedLimits.length > 0);
        if (!renderStrengths && !renderLimits) return null;
        return (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={sectionHeadingStyle}>Strengths and Limits</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
              gap: '1rem',
            }}
          >
            {renderStrengths && (
              <div>
                <h3
                  style={{
                    margin: '0 0 0.4rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: COLOR.textMuted,
                  }}
                >
                  Strengths
                </h3>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: '1.1rem',
                    listStyle: 'disc',
                    fontSize: '0.94rem',
                    lineHeight: 1.65,
                    color: COLOR.textSecondary,
                  }}
                >
                  {dedupedStrengths!.map((s, i) => (
                    <li key={i} style={{ marginBottom: '0.2rem', color: '#5a7050' }}>
                      <span style={{ color: COLOR.textSecondary }}>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {renderLimits && (
              <div>
                <h3
                  style={{
                    margin: '0 0 0.4rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: COLOR.textMuted,
                  }}
                >
                  Limits
                </h3>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: '1.1rem',
                    listStyle: 'disc',
                    fontSize: '0.94rem',
                    lineHeight: 1.65,
                    color: COLOR.textSecondary,
                  }}
                >
                  {dedupedLimits!.map((l, i) => (
                    <li key={i} style={{ marginBottom: '0.2rem', color: '#8a6a50' }}>
                      <span style={{ color: COLOR.textSecondary }}>{l}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
        );
      })()}

      {/* ═══════════ §8 Why This System Works ═══════════
       *  Pass 23 (Commit 7) — converted from a card list to a single
       *  2-3 sentence editorial paragraph that bridges §7 (Strengths
       *  and Limits) to §9 (If You Were to Change Something).
       *  `composeWhyThisSystemWorks` returns undefined and the section
       *  is gracefully omitted when the chain is too sparse to support
       *  the coherence-among-pieces claim. */}
      {(() => {
        const chainNamesW = a.systemChain?.names ?? [];
        const chainRolesW = a.systemChain?.roles ?? [];
        // Commit 13 — compute chainFacts here so composeWhyThisSystemWorks
        // can fall back to the coherence-fallback path when the engine
        // emits no keepRecommendations but the chain itself shows
        // enough structural evidence to make a cautious coherence claim.
        const chainFactsW = chainNamesW.map((name, i) =>
          extractCharacterFacts(
            findReadingForName(name, a.componentReadings ?? [], i),
            chainRolesW[i],
          ),
        );
        const why = composeWhyThisSystemWorks(a, chainNamesW, chainRolesW, chainFactsW);
        if (!why) return null;
        return (
          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={sectionHeadingStyle}>Why This System Works</h2>
            <p style={proseStyle}>{why}</p>
          </section>
        );
      })()}

      {/* ═══════════ §9 What This System Seems Built For ═══════════
       *  Commit 9 — listener-context layer. Pivots the document from
       *  "what is this system" to "who is this system for" via
       *  confidence-gated inference over already-available data
       *  (systemSignature, chainFacts, primaryConstraint role family).
       *  `composeListenerContext` returns undefined and the section
       *  is gracefully omitted when none of the three sentence
       *  templates fires at HIGH or MEDIUM confidence. */}
      {(() => {
        const chainNames = a.systemChain?.names ?? [];
        const chainRoles = a.systemChain?.roles ?? [];
        const chainFacts = chainNames.map((name, i) =>
          extractCharacterFacts(
            findReadingForName(name, a.componentReadings ?? [], i),
            chainRoles[i],
          ),
        );
        const builtFor = composeListenerContext(a, chainNames, chainRoles, chainFacts);
        if (!builtFor) return null;
        return (
          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={sectionHeadingStyle}>What This System Seems Built For</h2>
            <p style={proseStyle}>{builtFor}</p>
          </section>
        );
      })()}

      {/* ═══════════ §10 If You Were to Change Something ═══════════
       *  Commit 10 adds a presentational hierarchy preface that
       *  articulates the leverage model — front-end refinement first,
       *  amplifier replacement as philosophical change, destination
       *  speakers as fixed points. The paragraph names the specific
       *  protected components when they appear in the chain.
       *
       *  Hardening Phase B B2 — the hierarchy paragraph is now an
       *  independent reason to render §10. Previously the entire
       *  section required engine output (upgradeDirection,
       *  upgradePaths, or recommendedSequence). High-end systems with
       *  destination speakers lost the protective advice when the
       *  engine was sparse. The hierarchy can now render alone, but is
       *  suppressed on conflict-signaled chains with no engine
       *  upgrade direction — to avoid asserting positive protection on
       *  a chain the engine has diagnosed as broken without giving
       *  the artifact a curated direction to back it. */}
      {(() => {
        const chainNamesUH = a.systemChain?.names ?? [];
        const chainRolesUH = a.systemChain?.roles ?? [];
        const chainFactsUH = chainNamesUH.map((name, i) =>
          extractCharacterFacts(
            findReadingForName(name, a.componentReadings ?? [], i),
            chainRolesUH[i],
          ),
        );
        // Hardening Phase A B5 — primaryConstraint protection-suppress.
        const rawHierarchy = composeUpgradeHierarchy(
          chainNamesUH,
          chainRolesUH,
          chainFactsUH,
          a.primaryConstraint?.componentName,
        );
        // Hardening Phase B B2 — conflict-signal gate. When the engine
        // has flagged a conflict AND emitted no upgrade direction, the
        // hierarchy paragraph would render in isolation with no
        // engine context to interpret it; suppress.
        const conflictGated = !!rawHierarchy && !hasChangeSection && hasConflictSignal(a);
        const hierarchy = conflictGated ? undefined : rawHierarchy;
        const shouldRender = hasChangeSection || !!hierarchy;
        if (!shouldRender) return null;
        return (
          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={sectionHeadingStyle}>If You Were to Change Something</h2>
            {hierarchy && (
              <p style={{ ...proseStyle, marginBottom: '0.85rem' }}>{hierarchy}</p>
            )}
            {a.upgradeDirection && (
              <p style={{ ...proseStyle, marginBottom: '0.85rem' }}>{a.upgradeDirection}</p>
            )}
          {hasUpgradePaths && (
            <AdvisoryUpgradePaths
              paths={a.upgradePaths!}
              stackedTraits={a.stackedTraitInsights}
              systemCharacterSummary={a.systemSignature}
            />
          )}
          {hasSequence && (() => {
            // Pass 23 (Commit 7) — pre-compute facts per chain
            // component once so each step's protection check is
            // O(chainLength) without re-extracting facts on every step.
            const chainNames = a.systemChain?.names ?? [];
            const chainRoles = a.systemChain?.roles ?? [];
            const chainFacts = chainNames.map((name, i) =>
              extractCharacterFacts(
                findReadingForName(name, a.componentReadings ?? [], i),
                chainRoles[i],
              ),
            );
            return (
              <div
                style={{
                  marginTop: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                {a.recommendedSequence!.map((step) => {
                  // Pass 24 (Commit 8) — derive the editorial title from
                  // the ORIGINAL engine action (so pattern matches like
                  // "Preserve the DAC and Speakers" still resolve
                  // correctly), but render the SOFTENED action in the
                  // body. softenStepAction is narrow: it fires only on
                  // the audited circular-Step-2 and blunt-Step-3
                  // patterns and falls through otherwise.
                  const editorialTitle = deriveStepTitle(step.action, step.step);
                  // 15-chain acceptance fix A — when deriveStepTitle
                  // returns the "Step N" fallback (no pattern matched),
                  // suppress the duplicate "Step N" subtitle so the
                  // card doesn't double-state. When a meaningful title
                  // resolved, keep the "Step N" subtitle for ordering.
                  const fallbackTitle = `Step ${step.step}`;
                  const subtitle =
                    editorialTitle === fallbackTitle ? undefined : fallbackTitle;
                  const softenedAction =
                    softenStepAction(step.action, chainNames, chainRoles) ?? step.action;
                  const caveat = protectionCaveat(
                    step.action,
                    chainNames,
                    chainRoles,
                    chainFacts,
                  );
                  return (
                    <EditorialSubCard
                      key={step.step}
                      name={editorialTitle}
                      subtitle={subtitle}
                      body={softenedAction}
                      verdict={caveat}
                    />
                  );
                })}
              </div>
            );
          })()}
          </section>
        );
      })()}

      {/* ═══════════ §10 Sources ═══════════ */}
      {hasSources && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={sectionHeadingStyle}>Sources</h2>
          <AdvisorySources sources={a.sourceReferences!} />
        </section>
      )}
    </article>
  );
}
