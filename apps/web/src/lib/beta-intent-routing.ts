/**
 * Beta intent routing — three lightweight pre-pipeline rules.
 *
 * Purpose (Step 3 of 9 — beta path):
 *   The main `detectIntent` pipeline classifies prompts into comparison /
 *   shopping / diagnosis / consultation / etc. Three high-frequency
 *   real-enthusiast prompt classes misroute today:
 *
 *     P3 — vague preference language ("musical and engaging") falls
 *          through to a shallow generic clarification.
 *     P4 — sequencing language ("DAC or speakers first") matches the
 *          comparison pattern `\bupgrade\s+my\b` and routes to comparison,
 *          which then asks the user "which two components are you
 *          deciding between" even though the user named them.
 *     P7 — room-context prompts ("small reflective room") have no
 *          dedicated route; they fall through to generic
 *          "Exploratory Recommendations" boilerplate.
 *
 *   This module detects each class up front (before `detectIntent` runs)
 *   and produces a hedged, operationally-useful response. Each response
 *   is intentionally narrow:
 *     - sequencing → "we need the chain to answer this; here is what
 *       the answer depends on"
 *     - room → 4–5 practical room principles tied to what the user
 *       said
 *     - vague preference → operational follow-up choices ("more density
 *       or more clarity?" etc.) rather than another adjective
 *
 *   No full sequencing engine. No acoustic modeling. No new multi-turn
 *   orchestration. Each detector is a small regex + keyword check.
 *
 * Engineering-vs-domain boundary (per CLAUDE.md § 8):
 *   This module is an adapter — it knows about audio component
 *   categories, room acoustics vocabulary, and audio cliché terms.
 *   It does not modify the engine. The engine's reasoning primitives
 *   are unchanged.
 */

import type { ClarificationResponse } from './clarification';
import { getPilotCapsule, type PilotCapsule } from './brand-philosophy-pilot';

// ── Component categories (used by the sequencing detector) ───────────

/**
 * Lowercase category tokens. Each entry matches a single component
 * role; the sequencing rule fires when 2+ distinct categories appear
 * in the same message together with a sequencing keyword.
 */
const COMPONENT_CATEGORIES: ReadonlyArray<{
  readonly canonical: string;
  readonly tokens: ReadonlyArray<string>;
}> = [
  { canonical: 'DAC',         tokens: ['dac', 'd/a', 'dacs'] },
  { canonical: 'amplifier',   tokens: ['amp', 'amps', 'amplifier', 'amplifiers', 'integrated', 'power amp', 'power amps', 'preamp', 'pre-amp', 'preamps'] },
  { canonical: 'speakers',    tokens: ['speaker', 'speakers', 'bookshelf', 'floorstander', 'floorstanders', 'monitors', 'monitor'] },
  { canonical: 'streamer',    tokens: ['streamer', 'streamers', 'transport', 'transports'] },
  { canonical: 'turntable',   tokens: ['turntable', 'turntables', 'cartridge', 'cartridges'] },
  { canonical: 'headphones',  tokens: ['headphone', 'headphones', 'iems', 'iem'] },
  { canonical: 'cables',      tokens: ['cable', 'cables', 'interconnect', 'interconnects'] },
  { canonical: 'source',      tokens: ['source', 'sources'] },
];

function detectCategories(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const cat of COMPONENT_CATEGORIES) {
    for (const tok of cat.tokens) {
      const re = new RegExp(`\\b${tok.replace(/[/]/g, '\\/')}\\b`, 'i');
      if (re.test(lower)) {
        found.add(cat.canonical);
        break;
      }
    }
  }
  return Array.from(found);
}

// ── A. Sequencing rule ────────────────────────────────────────────────

const SEQUENCING_PATTERNS: ReadonlyArray<RegExp> = [
  /\bfirst\b/i,
  /\bnext\b/i,
  /\bbefore\b/i,
  /\bpriority\b/i,
  /\bin\s+what\s+order\b/i,
  /\bwhat\s+order\b/i,
  /\bupgrade\s+first\b/i,
  /\bstart\s+with\b/i,
  /\bbiggest\s+(?:improvement|leverage|gain)\b/i,
];

/**
 * Detects the "X or Y first" / "what should I upgrade first" class.
 * Returns the response if the rule matches, null otherwise.
 *
 * Match criteria:
 *   - at least one sequencing keyword
 *   - at least two distinct component categories
 *
 * The "or" between components is not required (catches "should I
 * upgrade my DAC first, or speakers" as well as "DAC or speakers
 * first").
 */
export function detectSequencingPrompt(text: string): ClarificationResponse | null {
  if (!SEQUENCING_PATTERNS.some((p) => p.test(text))) return null;
  const categories = detectCategories(text);
  if (categories.length < 2) return null;

  const list = categories.slice(0, 3).join(', ');
  return {
    acknowledge: `Sequencing question noted — you're asking whether to upgrade ${list} first.`,
    context:
      'Sequencing depends on which part of the chain is currently most-bottlenecked, not on which category is "most upgradeable" generically.',
    question:
      'A few things shape the answer:\n\n'
      + '• What does the current system already do well? Upgrading a category that already serves its purpose tends to deliver smaller returns than upgrading the bottleneck.\n'
      + '• What about the current sound do you want to change?\n'
      + '• Speakers are usually the hardest to undo; DACs are usually the easiest. Reversibility matters when sequencing.\n\n'
      + 'Can you share the current components (brand and model for each) and what you most want to change about how the system sounds? With that I can be specific about the order.',
  };
}

// ── B. Room rule ──────────────────────────────────────────────────────

const ROOM_PATTERNS: ReadonlyArray<RegExp> = [
  /\bsmall\s+room\b/i,
  /\bsmall\s+reflective\b/i,
  /\breflective\s+room\b/i,
  /\bbright\s+room\b/i,
  /\blive\s+room\b/i,
  /\blistening\s+room\b/i,
  /\bmy\s+room\b/i,
  /\bnear[-\s]?field\b/i,
  /\bnearfield\b/i,
  /\bfirst\s+reflection/i,
  /\bplacement\b/i,
  /\brear\s+wall\b/i,
  /\bside\s+wall\b/i,
  /\bcorner\s+placement\b/i,
  /\bapartment\b/i,
  /\bbass\s+trap/i,
  /\bacoustic\s+treatment\b/i,
  /\broom\s+treatment\b/i,
  // Generic "room" — used cautiously. Only fires when paired with
  // shape/quality cue so "the room" in casual context doesn't trip it.
  /\b(?:small|large|big|narrow|wide|untreated|reflective|dead|live|bright|carpeted)\s+\w*\s*room\b/i,
];

/**
 * Detects room-context prompts. Returns the response if the rule
 * matches, null otherwise. Takes priority over generic shopping /
 * recommendation fallback when room keywords are present.
 */
export function detectRoomPrompt(text: string): ClarificationResponse | null {
  if (!ROOM_PATTERNS.some((p) => p.test(text))) return null;

  const lower = text.toLowerCase();
  const isSmall = /\bsmall\b/.test(lower);
  const isReflective = /\breflective\b|\blive\s+room\b|\bbright\s+room\b/.test(lower);
  const isApartment = /\bapartment\b/.test(lower);

  const principles: string[] = [];
  if (isSmall && isReflective) {
    principles.push(
      'Small reflective rooms exaggerate upper-mid and treble energy — first reflections from side walls and the ceiling reinforce what the speaker is already emitting. Forward, bright, or wide-dispersion speakers can feel harsh.',
    );
    principles.push(
      'Wide-dispersion designs (most box speakers, planars, omnidirectionals) interact strongly with side walls. Controlled-dispersion (sealed bookshelves, waveguide-loaded, near-coaxial) tends to fare better.',
    );
    principles.push(
      'Near-field listening — listener closer to the speakers than the speakers are to the walls — reduces the room\'s contribution. Worth trying before treating the room.',
    );
    principles.push(
      'Treble-energetic sources (chip-DAC + analytical amp + bright speaker) compound in this environment. Adding density at the source or amp stage can offset.',
    );
    principles.push(
      'Basic first-reflection treatment (absorption at the side-wall and ceiling reflection points) is the highest-leverage cheap fix.',
    );
  } else if (isSmall) {
    principles.push(
      'Small rooms are bass-sensitive — every speaker-to-wall and listener-to-wall distance affects low-frequency response. Sealed designs and controlled-bass speakers tend to be more forgiving than ported designs near walls.',
    );
    principles.push(
      'Near-field listening reduces the room\'s contribution; consider speaker-to-listener distance shorter than speaker-to-wall.',
    );
    principles.push(
      'First-reflection treatment at side walls and the ceiling is the cheapest meaningful intervention.',
    );
  } else if (isReflective) {
    principles.push(
      'Reflective rooms exaggerate upper-mid and treble energy. Forward / bright / wide-dispersion speakers tend to feel harsh in this kind of room.',
    );
    principles.push(
      'Controlled-dispersion speakers (waveguide-loaded, near-coaxial, sealed designs) interact less with side walls.',
    );
    principles.push(
      'Absorption at first-reflection points (side walls and ceiling) is the cheapest meaningful intervention.',
    );
  } else if (isApartment) {
    principles.push(
      'Apartment rooms are usually small and often shared-wall — bass output below ~60 Hz becomes a neighbour concern as much as a sound-quality concern. Sealed designs and smaller drivers are usually more practical.',
    );
    principles.push(
      'Near-field listening lets you keep volume modest while still hearing detail; consider speaker-to-listener distance.',
    );
    principles.push(
      'High-efficiency designs paired with low-power amplification can give engaging sound at lower volumes — relevant when SPL is constrained.',
    );
  } else {
    principles.push(
      'Room interaction usually dominates above ~300 Hz (reflections, dispersion) and below ~150 Hz (modes). The speaker-room match matters at both ends.',
    );
    principles.push(
      'Speaker dispersion pattern + listening distance + first-reflection treatment together set most of the audible room contribution.',
    );
    principles.push(
      'Near-field listening minimises the room\'s contribution by raising direct-to-reflected ratio.',
    );
  }

  const principleText = principles.map((p, i) => `${i + 1}. ${p}`).join('\n\n');

  return {
    acknowledge: 'Room context matters — it usually shapes the sound as much as the gear does.',
    context:
      'I don\'t have your specific room dimensions or speaker model, so this is general guidance rather than a specific recommendation. The principles below are the highest-leverage things to be aware of in your kind of room.',
    question:
      principleText
      + '\n\nIf you can share your room dimensions (rough is fine), your current or candidate speakers, and where you can place them (distance from rear wall, distance from side walls), I can be more specific.',
  };
}

// ── C. Vague preference rule ──────────────────────────────────────────

const VAGUE_PREFERENCE_TOKENS: ReadonlyArray<string> = [
  'musical',
  'musicality',
  'engaging',
  'engagement',
  'organic',
  'natural',
  'fun',
  'emotional',
  'high-end',
  'high end',
  'audiophile',
  'lifelike',
  'realistic',
  'immersive',
  'holographic',
  'liquid',
  'effortless',
];

/**
 * The vague-preference rule fires only when the user uses one or
 * more cliché preference adjectives WITHOUT pairing them with an
 * operational anchor. If the user says "more musical body" or
 * "engaging rhythmic drive" they're already operationally grounded.
 */
const OPERATIONAL_ANCHORS: ReadonlyArray<RegExp> = [
  /\bwarm/i, /\bwarmer/i,
  /\bbright/i, /\bbrighter/i,
  /\bdense/i, /\bdenser/i, /\bdensity/i,
  /\bclarity/i, /\bclear/i, /\bclearer/i,
  /\bdetail/i, /\bdetailed/i,
  /\bbass/i, /\btreble/i, /\bmidrange/i,
  /\bsoundstage/i, /\bimaging/i,
  /\bdynamic/i, /\bdynamics/i,
  /\btransient/i, /\btiming/i, /\brhythm/i, /\brhythmic/i, /\bpace\b/i,
  /\bbody\b/i, /\bweight\b/i, /\btonal\b/i, /\btone\b/i,
  /\bsmooth/i, /\brelaxed/i, /\bforward/i, /\blaid[\s-]?back\b/i,
  /\bharsh/i, /\bsibilan/i,
  /\bopen/i, /\bclosed/i, /\bairy\b/i,
];

/**
 * Detects vague-preference prompts. Returns operational clarification
 * if the rule matches, null otherwise.
 *
 * Match criteria:
 *   - one or more vague preference tokens
 *   - AND no operational anchor present
 *   - AND fewer than three subject mentions (skip when the user is
 *     also naming gear — assessment paths handle that case)
 */
export function detectVaguePreferencePrompt(
  text: string,
  subjectCount: number,
): ClarificationResponse | null {
  if (subjectCount >= 3) return null;
  const lower = text.toLowerCase();
  const vagueHits = VAGUE_PREFERENCE_TOKENS.filter((tok) => {
    const re = new RegExp(`\\b${tok.replace(/-/g, '[-\\s]?').replace(/ /g, '\\s+')}\\b`, 'i');
    return re.test(lower);
  });
  if (vagueHits.length === 0) return null;
  // If the user already provided operational anchoring, don't intercept —
  // let the normal pipeline handle it.
  if (OPERATIONAL_ANCHORS.some((p) => p.test(lower))) return null;
  // Very short prompts only — longer prompts usually carry their own
  // anchoring even if a vague token appears.
  if (text.length > 120) return null;

  const echoed = vagueHits.slice(0, 2).map((t) => `"${t}"`).join(' and ');

  return {
    acknowledge: `Words like ${echoed} mean different things to different listeners.`,
    context:
      'Before I suggest anything, it helps to translate that into one or two operational choices — what would you actually change about how the system sounds?',
    question:
      'Which of these is closest to what you mean?\n\n'
      + '• More **tonal density** (body, warmth, midrange weight) — or more **clarity** (transient definition, detail, separation)?\n'
      + '• More **rhythmic drive** (timing, pace, propulsion) — or more **relaxed flow** (long-session ease, harmonic continuity)?\n'
      + '• More **spatial precision** (specific image locations) — or more **image scale** (apparent size and body of sources)?\n'
      + '• More **warmth and body** — or more **transient speed**?\n\n'
      + 'Pick whichever one or two best capture what you want. If none of these quite fits, describe what you\'re hearing now that you\'d like to change.',
  };
}

// ── D. Sideways-vs-upgrade rule (Step 6 of 9 — beta path) ─────────────
//
// When the user explicitly asks whether moving from one brand to
// another is a real upgrade or a sideways move, the prompt is
// philosophical, not transactional. The main pipeline today routes
// this to product_assessment (single-candidate) — it surfaces the
// to-side brand correctly (post Step 2) but does not contrast the
// from-side and to-side as a philosophical shift.
//
// This rule detects the framing, extracts the two brands from the
// pilot capsule set, and produces a hedged contrast response that:
//   - acknowledges the question directly
//   - frames the move as philosophical/system-fit dependent
//   - identifies likely gains (from to-side's pilot capsule)
//   - identifies likely losses (from from-side's pilot capsule)
//   - asks only for the listener-priority context needed to decide
// No scoring. No ranking. No upgrade graph. Just two pilot capsules
// rendered into a decision frame.

/**
 * Phrases that mark a sideways-vs-upgrade question. The rule requires
 * (a) one of these phrases AND (b) two distinct pilot-capsule brands
 * detectable in the prompt. Both conditions reduce false positives.
 */
const SIDEWAYS_VS_UPGRADE_PATTERNS: ReadonlyArray<RegExp> = [
  /\bsideways\s+move\b/i,
  /\b(?:real|actual|true|genuine)\s+upgrade\b/i,
  /\bworth\s+upgrading\b/i,
  /\bmoving\s+from\s+/i,
  /\bmove\s+from\s+/i,
  /\bgo(?:ing)?\s+from\s+.+\s+to\s+/i,
  /\bupgrade\s+from\s+.+\s+to\s+/i,
  /\bswitch(?:ing)?\s+from\s+.+\s+to\s+/i,
  /\bjump\s+from\s+.+\s+to\s+/i,
  /\bstep\s+(?:up\s+)?from\s+.+\s+to\s+/i,
];

/**
 * Scan a prompt for pilot capsules and order them as (from, to)
 * using the explicit "from X to Y" pattern when present, falling
 * back to document order otherwise.
 *
 * Returns null when fewer than two distinct pilot capsules are
 * detected — without two known identities, the philosophical-shift
 * frame is not honest.
 */
function detectFromToPilotCapsules(
  text: string,
): { from: PilotCapsule; to: PilotCapsule; explicit: boolean } | null {
  // Pilot aliases the detector knows. Order longest-first inside each
  // capsule (the pilot module already does this via the alias array).
  // We collect (capsule, indexOfFirstMatch) pairs.
  type Hit = { capsule: PilotCapsule; index: number; alias: string };
  const lower = text.toLowerCase();

  // Build the set of known pilot brands by trying capsule aliases.
  // Each capsule contributes at most one Hit (the earliest alias).
  const PILOT_NAMES: ReadonlyArray<string> = [
    'denafrips', 'topping', 'goldmund', 'naim audio', 'naim',
    'harbeth', 'shindo laboratory', 'shindo', 'pass labs', 'first watt', 'pass',
  ];

  const hits: Hit[] = [];
  const seen = new Set<string>();
  for (const name of PILOT_NAMES) {
    const idx = lower.indexOf(name);
    if (idx === -1) continue;
    // Word boundary on each side
    const before = idx === 0 ? '' : lower[idx - 1];
    const after = idx + name.length >= lower.length ? '' : lower[idx + name.length];
    if (/[a-z0-9]/.test(before)) continue;
    if (/[a-z0-9]/.test(after)) continue;
    const cap = getPilotCapsule(name);
    if (!cap) continue;
    if (seen.has(cap.brand)) continue;
    seen.add(cap.brand);
    hits.push({ capsule: cap, index: idx, alias: name });
  }
  if (hits.length < 2) return null;

  // Try explicit "from <a> to <b>" extraction first.
  const fromTo = /\bfrom\s+([a-z][a-z0-9 '/-]+?)\s+to\s+([a-z][a-z0-9 '/-]+?)(?:\b|$|[?.,!;:])/i.exec(text);
  if (fromTo) {
    const fromText = fromTo[1].toLowerCase();
    const toText = fromTo[2].toLowerCase();
    const fromCap = hits.find((h) => fromText.includes(h.alias) || h.alias.includes(fromText.split(/\s+/)[0]))?.capsule
      ?? null;
    const toCap = hits.find((h) => toText.includes(h.alias) || h.alias.includes(toText.split(/\s+/)[0]))?.capsule
      ?? null;
    if (fromCap && toCap && fromCap.brand !== toCap.brand) {
      return { from: fromCap, to: toCap, explicit: true };
    }
  }

  // Fallback: document order — first hit is from, second is to.
  hits.sort((a, b) => a.index - b.index);
  return { from: hits[0].capsule, to: hits[1].capsule, explicit: false };
}

/**
 * Detects sideways-vs-upgrade prompts. Returns the response if the
 * rule matches, null otherwise.
 *
 * Match criteria:
 *   - sideways/upgrade keyword pattern matches
 *   - two distinct pilot capsules detectable in the prompt
 */
export function detectSidewaysVsUpgradePrompt(text: string): ClarificationResponse | null {
  if (!SIDEWAYS_VS_UPGRADE_PATTERNS.some((p) => p.test(text))) return null;
  const pair = detectFromToPilotCapsules(text);
  if (!pair) return null;

  const { from, to } = pair;

  // Likely gains — surface the to-side's perception traits (first 2)
  // plus its preferenceFit summary in compact form.
  const gainTraits = to.perceptionTraits.slice(0, 2).map((t) => `• ${t}`).join('\n');

  // Likely losses — surface the from-side's perception traits (first 2)
  // as "what you would be moving away from".
  const lossTraits = from.perceptionTraits.slice(0, 2).map((t) => `• ${t}`).join('\n');

  return {
    acknowledge:
      `${from.brand} → ${to.brand} is mainly a philosophical shift, not automatically a "better" move. Whether it counts as an upgrade depends on what you currently value about ${from.brand}'s presentation and where you want to move.`,
    context:
      `**${from.brand}.** ${from.mechanism} ${from.preferenceFit}\n\n`
      + `**${to.brand}.** ${to.mechanism} ${to.preferenceFit}`,
    question:
      `**What you would likely gain (${to.brand}'s strengths):**\n${gainTraits}\n\n`
      + `**What you would likely give up (${from.brand}'s strengths):**\n${lossTraits}\n\n`
      + `**It is more likely a real upgrade if:** you've been wishing for what ${to.brand} prioritises — and ${from.brand}'s strengths feel less important to you than they used to.\n\n`
      + `**It is more likely sideways (or the wrong move) if:** you actively value ${from.brand}'s strengths in your current listening — moving to ${to.brand} would trade them away for a different philosophy you may or may not prefer.\n\n`
      + `To answer this concretely, two things help:\n`
      + `• What about your current ${from.brand} setup do you most value — and what's been bugging you about it?\n`
      + `• What's the rest of the chain? The same amplifier change can read as upgrade or sideways depending on speakers and source.`,
  };
}

// ── Aggregator ─────────────────────────────────────────────────────────

export interface BetaInterceptResult {
  readonly kind: 'sequencing' | 'room' | 'vague-preference' | 'sideways-vs-upgrade';
  readonly clarification: ClarificationResponse;
}

/**
 * Try each beta intercept in priority order. Returns the first match
 * or null. Priority: sideways-vs-upgrade > sequencing > room >
 * vague-preference. Sideways-vs-upgrade goes first because its
 * detection is the narrowest (requires two pilot capsules), so it
 * cannot false-fire on prompts the other rules would handle. Sequencing
 * is most concrete; vague-preference is most general.
 */
export function tryBetaInterceptRouting(
  text: string,
  subjectCount: number,
): BetaInterceptResult | null {
  const sideways = detectSidewaysVsUpgradePrompt(text);
  if (sideways) return { kind: 'sideways-vs-upgrade', clarification: sideways };
  const seq = detectSequencingPrompt(text);
  if (seq) return { kind: 'sequencing', clarification: seq };
  const room = detectRoomPrompt(text);
  if (room) return { kind: 'room', clarification: room };
  const vague = detectVaguePreferencePrompt(text, subjectCount);
  if (vague) return { kind: 'vague-preference', clarification: vague };
  return null;
}
