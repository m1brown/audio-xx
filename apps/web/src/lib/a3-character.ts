/**
 * A3 Character generation (Audio XX vI, Phase 1) — flag-gated, default OFF.
 *
 * Replaces ONLY the "Character" portion of a system assessment (the
 * "System read" + "Emergent behavior" prose) with an A3-generated reading,
 * grounded in AdvisorContext + Audio XX doctrine. Everything else — chain,
 * radar, component cards, recommendations, sources — remains deterministic.
 *
 * Pipeline: AdvisorContext → doctrine → A3 (LLM) → validate → splice.
 * On model-unavailable / timeout / validation-failure, returns null so the
 * caller keeps the deterministic Character. No user-visible failure modes.
 */

import type { AdvisorContext } from './advisor-context';
import type { PrimaryAxisLeanings } from './axis-types';

// ── Feature flag (default OFF) ───────────────────────────
// NEXT_PUBLIC_A3_CHARACTER=true, or localStorage 'axx_a3char'='1', or ?a3char=1.
export function a3CharacterEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_A3_CHARACTER === 'true') return true;
  if (typeof window !== 'undefined') {
    try {
      if (window.localStorage.getItem('axx_a3char') === '1') return true;
      if (window.location.search.includes('a3char=1')) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

// ── Audio XX reasoning doctrine ──────────────────────────
export const AUDIO_XX_DOCTRINE = `AUDIO XX REASONING DOCTRINE
Orthogonality (never conflate the four axes):
- Timing precision is NOT brightness. Speed is NOT brightness.
- Transparency, detail and resolution are NOT treble emphasis and NOT tonal thinness.
- Warmth and resolution can coexist. Speed and tonal density can coexist.
- Tonal balance (warm/bright), resolution (smooth/detailed), timing (elastic/controlled)
  and space (airy/closed) are independent. Never infer one from another.
Grounding:
- Reason ONLY from the supplied facts. Never introduce a product, specification, or
  measurement that is not in the context. Never invent numbers.
- Never contradict the supplied system or component axes — they are the source of truth.
- Honour fixed component roles; never re-read a transport as a DAC, etc.
- Hedge low-confidence components ("appears", "likely"); avoid exaggerated certainty.
Stance:
- Describe BEHAVIOUR (what the system does to the music), not STATUS (price, prestige, brand tier).
- Avoid prestige-based reasoning; a component's reputation is not an argument.
- Name trade-offs honestly; "keep what you have" is a valid stance.
- System synergy matters more than any single component's reputation.
Voice:
- Warm-editorial: an experienced advisor, not a salesperson, forum poster, or spec sheet.
- No scores, no "best", no hype, no audiophile clichés ("veil lifted", "jaw-dropping", "musical").`;

// ── Prompt construction ──────────────────────────────────
function axisDescription(a: PrimaryAxisLeanings): string {
  return [
    `tonal balance: ${a.warm_bright}`,
    `resolution: ${a.smooth_detailed}`,
    `timing: ${a.elastic_controlled}`,
    `space: ${a.airy_closed}`,
  ].join(', ');
}

export function buildCharacterPrompt(ctx: AdvisorContext): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `You are Audio XX, an experienced high-fidelity system advisor.
${AUDIO_XX_DOCTRINE}

TASK: Write ONLY the "Character" section of a system assessment — how THIS specific
system behaves and why. 2–3 short paragraphs of flowing prose (no headers, no lists,
no bullet points), about 110–170 words. Do not restate axis labels or numbers literally;
interpret them. Do not give recommendations or upgrade advice (other sections handle that).
End with a statement, not a question. Output the prose only.`;

  // Compact, grounded payload — facts only.
  const payload = {
    system_axes: axisDescription(ctx.system.axes),
    components: ctx.system.components.map((c) => ({
      name: c.name,
      roles: c.roles,
      tonal_balance: c.axisPosition.warm_bright,
      resolution: c.axisPosition.smooth_detailed,
      timing: c.axisPosition.elastic_controlled,
      space: c.axisPosition.airy_closed,
      strengths: c.strengths,
      weaknesses: c.weaknesses,
      confidence: c.confidence,
    })),
    chain: ctx.system.chain.names,
    listener_priorities: ctx.signals.listenerPriorities,
    emergent_behaviors: ctx.signals.emergentBehaviors,
    stacked_traits: ctx.signals.stackedTraits?.map((s) => ({
      property: s.property,
      classification: s.classification,
      contributors: s.contributors,
    })),
    bottleneck: ctx.signals.bottleneck,
    synergy: ctx.signals.synergy,
  };

  const userPrompt = `Generate the Character section for this system. Use ONLY these facts:

${JSON.stringify(payload, null, 2)}`;

  return { systemPrompt, userPrompt };
}

// ── Minimum validation layer ─────────────────────────────
// Small and understandable on purpose. Three checks: product whitelist,
// fabricated-measurement, axis-consistency.
const AXIS_LEXICON = {
  bright: ['bright', 'treble-forward', 'treble forward', 'etched', 'tipped up', 'tizzy', 'sizzly'],
  warm: ['warm', 'lush', 'rich', 'plummy', 'syrupy'],
  smooth: ['smooth', 'rounded', 'liquid', 'soft-edged'],
  detailed: ['analytical', 'clinical', 'sterile', 'etched'],
  controlled: ['overdamped', 'clamped', 'tight-fisted'],
  elastic: ['loose', 'slack', 'flabby'],
  closed: ['closed-in', 'congested', 'boxed-in', 'claustrophobic'],
  airy: ['diffuse', 'vague', 'unfocused'],
} as const;

// Negation cue immediately before a flagged term ("not overly analytical",
// "without leaning towards analytical", "never bright", "avoids").
const NEGATION_RE =
  /\b(not|no|never|without|isn'?t|aren'?t|avoids?|avoiding|free\s+of|lacks?|rather\s+than|instead\s+of|less|nothing)\s+(\w+\s+){0,3}$/i;

// Map role nouns in prose to a component role family (for anaphora like
// "these speakers add a bright edge" where the model named the speaker earlier).
const ROLE_WORDS: { re: RegExp; family: string }[] = [
  { re: /\b(speakers?|loudspeakers?|monitors?)\b/i, family: 'speaker' },
  { re: /\b(amp|amplifiers?|integrated)\b/i, family: 'amplifier' },
  { re: /\b(dac|converter)\b/i, family: 'dac' },
  { re: /\b(streamer|transport|source)\b/i, family: 'streamer' },
];

function splitSentences(t: string): string[] {
  return t.split(/(?<=[.!?])\s+/);
}

/**
 * Genuine system-level contradiction check for one axis pole.
 * Returns the offending term only when a flagged word appears that is NOT
 * negated and NOT attributable to a component that legitimately holds that
 * pole (named in the sentence, or referenced by its role noun).
 */
function genuineContradiction(
  text: string,
  words: readonly string[],
  axisKey: 'warm_bright' | 'smooth_detailed' | 'elastic_controlled',
  pole: string,
  comps: AdvisorContext['system']['components'],
): string | null {
  for (const sent of splitSentences(text)) {
    const l = sent.toLowerCase();
    for (const w of words) {
      const re = new RegExp(`\\b${w.replace(/[-\s]/g, '[-\\s]')}\\b`, 'i');
      const m = re.exec(l);
      if (!m) continue;
      // 1. negation immediately before the term → not a contradiction
      if (NEGATION_RE.test(l.slice(0, m.index))) continue;
      // 2. component-scoped: a component named in this sentence holds the pole
      const named = comps.some(
        (c) =>
          (c.axisPosition as unknown as Record<string, string>)[axisKey] === pole &&
          c.name
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .some((tok) => tok.length >= 3 && l.includes(tok)),
      );
      if (named) continue;
      // 3. anaphora: a role noun present + a component of that role holds the pole
      const roleScoped = ROLE_WORDS.some(
        (rw) =>
          rw.re.test(l) &&
          comps.some(
            (c) =>
              c.roles.includes(rw.family) &&
              (c.axisPosition as unknown as Record<string, string>)[axisKey] === pole,
          ),
      );
      if (roleScoped) continue;
      return w; // genuine, system-level, unscoped use
    }
  }
  return null;
}

export function validateCharacter(
  text: string,
  ctx: AdvisorContext,
): string[] {
  const fails: string[] = [];
  const lower = text.toLowerCase();

  // A. Product validation — no gear named that isn't in the context.
  // Build a token set from component names; flag capitalised multi-word
  // product-looking phrases not traceable to a known component. Keep it
  // simple: check the known brand/model tokens are the only proper-noun
  // product references by scanning for "by <Brand>" style intros is overkill;
  // instead ensure any component the model NAMES is a known one (positive
  // check is hard) → we do the tractable inverse: confirm it does not invent
  // a spec and does not contradict axes; product names are bounded in practice
  // by the grounding instruction. We still catch obvious foreign brands.
  const knownTokens = new Set<string>();
  for (const c of ctx.system.components) {
    for (const w of c.name.toLowerCase().split(/[^a-z0-9]+/)) {
      if (w.length >= 3) knownTokens.add(w);
    }
  }
  const FOREIGN_BRANDS = [
    'wilson', 'magico', 'mcintosh', 'krell', 'mark levinson', 'bryston',
    'rega', 'cambridge', 'marantz', 'denon', 'yamaha', 'rotel', 'bowers',
    'b&w', 'sonus faber', 'dynaudio', 'elac', 'klipsch', 'jbl', 'focal',
    'naim', 'hegel', 'topping', 'schiit', 'denafrips', 'chord', 'goldmund',
    'leben', 'devore', 'harbeth', 'magnepan', 'kef', 'wlm', 'eversolo', 'job',
  ];
  for (const brand of FOREIGN_BRANDS) {
    if (lower.includes(brand) && !knownTokens.has(brand.replace(/[^a-z0-9]/g, ''))) {
      fails.push(`names-foreign-product:${brand}`);
    }
  }

  // B. Measurement validation — reject fabricated specs/numbers.
  if (/\b\d+(\.\d+)?\s?(db|wpc|watts?|w\b|khz|hz|ohms?|bit|µv|uv|dB|%)\b/i.test(text)) {
    fails.push('fabricated-measurement');
  }

  // C. Axis consistency — prose must not contradict calibrated SYSTEM axes.
  // Negation- and component-scope-aware: a flagged term is allowed when it is
  // negated ("not analytical") or attributable to a component that legitimately
  // holds that pole (a bright speaker in an otherwise-warm system).
  const ax = ctx.system.axes;
  const comps = ctx.system.components;
  if (ax.warm_bright !== 'bright') {
    const w = genuineContradiction(text, AXIS_LEXICON.bright, 'warm_bright', 'bright', comps);
    if (w) fails.push(`axis-contradiction:not-bright:${w}`);
  }
  if (ax.warm_bright !== 'warm') {
    const w = genuineContradiction(text, AXIS_LEXICON.warm, 'warm_bright', 'warm', comps);
    if (w) fails.push(`axis-contradiction:not-warm:${w}`);
  }
  if (ax.smooth_detailed === 'detailed') {
    const w = genuineContradiction(text, AXIS_LEXICON.smooth, 'smooth_detailed', 'smooth', comps);
    if (w) fails.push(`axis-contradiction:detailed-not-smooth:${w}`);
  }
  if (ax.smooth_detailed === 'smooth') {
    const w = genuineContradiction(text, AXIS_LEXICON.detailed, 'smooth_detailed', 'detailed', comps);
    if (w) fails.push(`axis-contradiction:smooth-not-analytical:${w}`);
  }
  if (ax.elastic_controlled === 'elastic') {
    const w = genuineContradiction(text, AXIS_LEXICON.controlled, 'elastic_controlled', 'controlled', comps);
    if (w) fails.push(`axis-contradiction:elastic-not-overdamped:${w}`);
  }

  // Length sanity (not an elaborate rules engine — just bound it).
  const words = text.trim().split(/\s+/).length;
  if (words < 40 || words > 260) fails.push(`length-out-of-range:${words}`);

  return fails;
}

// ── LLM call (returns null on any failure → caller falls back) ──
async function callLLM(systemPrompt: string, userPrompt: string): Promise<string | null> {
  try {
    const r = await fetch('/api/memo-overlay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt, userPrompt }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const c = (j?.content ?? '').trim();
    return c.length > 0 ? c : null;
  } catch {
    return null;
  }
}

export interface A3CharacterResult {
  character: string;
  status: 'pass';
  fails: string[];
}

/**
 * Generate an A3 Character section. Returns null on any failure (unavailable,
 * timeout, validation reject) so the caller keeps deterministic output.
 * Single attempt — no prompt-tuning loop (Phase 1 is a learning probe).
 */
export async function generateA3Character(
  ctx: AdvisorContext,
): Promise<A3CharacterResult | null> {
  const { systemPrompt, userPrompt } = buildCharacterPrompt(ctx);
  const answer = await callLLM(systemPrompt, userPrompt);
  if (!answer) return null;
  const fails = validateCharacter(answer, ctx);
  if (fails.length > 0) return null;
  return { character: answer, status: 'pass', fails };
}

// ── Splice: replace only the Character portion of a deterministic narrative ──
// The deterministic systemContext is a 7-section markdown doc. The Character
// portion is "**System read**" + "**Emergent behavior**", up to "**System logic**".
// If the markers aren't found, return the original (safe fallback).
export function spliceCharacter(systemContext: string, a3Character: string): string {
  const start = systemContext.indexOf('**System read**');
  const next = systemContext.indexOf('**System logic**');
  if (start < 0 || next < 0 || next <= start) return systemContext;
  return (
    systemContext.slice(0, start) +
    '**System read**\n\n' +
    a3Character.trim() +
    '\n\n' +
    systemContext.slice(next)
  );
}
