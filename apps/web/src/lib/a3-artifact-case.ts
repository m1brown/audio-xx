/**
 * A3 Artifact Case generation (Audio XX vI, Phase 2) — flag-gated.
 *
 * Phase 1 (a3-character.ts) let A3 regenerate the Character section of the
 * legacy memo assessment. Phase 2 extends the same pattern to the v2
 * editorial artifact's judgment column: the caseParagraphs that sit between
 * the recognition line and the recommendation.
 *
 * Why this surface: the judgment column is the artifact's core argument —
 * the prose that explains WHY the verdict holds. The deterministic composer
 * (synthesizeArtifact.ts) produces correct but template-bound paragraphs;
 * A3 can reason across the same findings and write a genuinely composed
 * argument. Everything else — verdict, standfirst, credit, photos, hero
 * datum, recommendation, cost — remains deterministic.
 *
 * Pipeline: SystemAssessmentResult → grounded payload → doctrine → A3 (LLM)
 * → validate (grounding + the artifact's own R-rules) → attach as
 * `a3CaseParagraphs` on the raw assessment carrier. synthesizeArtifact()
 * prefers the attached paragraphs over its deterministic composition and
 * still runs its R5/R8 post-conditions over them as a second net.
 *
 * On model-unavailable / timeout / validation-failure, returns null so the
 * deterministic judgment column stands. No user-visible failure modes.
 */

import { AUDIO_XX_DOCTRINE } from './a3-character';
import {
  characterRead,
  verdictAndStandfirst,
  roleNoun,
  stripTrailingPeriod,
} from './artifact/synthesizeArtifact';

// ── Feature flag ─────────────────────────────────────────
// Same ladder as Phase 1: kill switch first, explicit on second, Preview
// deployments default ON, local/per-user opt-in via localStorage or query.
export function a3ArtifactCaseEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_A3_ARTIFACT_CASE === 'false') return false;
  if (process.env.NEXT_PUBLIC_A3_ARTIFACT_CASE === 'true') return true;
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview') return true;
  if (typeof window !== 'undefined') {
    try {
      if (window.localStorage.getItem('axx_a3case') === '1') return true;
      if (window.location.search.includes('a3case=1')) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

// ── Grounded context ─────────────────────────────────────
// Everything the deterministic composer reads, expressed as a compact
// facts payload. The interfaces here are intentionally structural
// (duck-typed against SystemAssessmentResult) — the raw result flows
// through `any` at the synthesizer seam already, and Phase 2 keeps the
// same posture rather than importing the full consultation types.
export interface ArtifactCaseContext {
  componentNames: string[];
  systemAxes?: Record<string, string>;
  perComponentAxes?: Array<{ name: string; axes: Record<string, string> }>;
  bottleneck?: { role?: string; category?: string } | null;
  constraintExplanation?: string;
  isCoherent?: boolean;
  coherentSharedTraits?: string[];
  coherentTradeoffs?: string[];
  assessmentStrengths?: string[];
  assessmentLimitations?: string[];
  preferenceNote?: string;
  // ── Established identity (authoritative — the deterministic engine's own
  // conclusion). These are NOT inputs the LLM may re-weight; they are the
  // fixed identity the composed prose must ELABORATE, never re-derive. ──
  verdict?: string;
  /** The deterministic tonal-signature sentence (raw.response.systemSignature). */
  signature?: string;
  standfirst?: string;
  /** The deterministic recognition line ("This system is built for …"). */
  recognition?: string;
  /** The non-neutral axis poles the identity commits to — the invariant the
   *  composed prose may not contradict. e.g. { smooth_detailed: 'detailed' }. */
  committedAxes?: Record<string, string>;
}

// ── Established-identity derivation ───────────────────────
// The composed prose must elaborate the SAME identity the deterministic
// renderer publishes. Rather than let the LLM re-derive it, we compute it
// here from the raw carrier using the very functions synthesizeArtifact.ts
// uses (imported, not reimplemented) — a single source of identity truth.
// A sync test pins deriveIdentity(raw) to the rendered payload so a future
// change to one path can never silently desync the other.
const IDENTITY_AXES = ['warm_bright', 'smooth_detailed', 'elastic_controlled', 'airy_closed'];

/** The non-neutral poles the system identity commits to. */
export function committedPoles(axes: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!axes) return out;
  for (const k of IDENTITY_AXES) {
    const v = axes[k];
    if (v && v !== 'neutral' && v !== 'balanced') out[k] = v;
  }
  return out;
}

export interface EstablishedIdentity {
  signature: string;
  recognition: string;
  verdict: string;
  standfirst?: string;
  committedAxes: Record<string, string>;
}

/** Derive the authoritative identity from the raw assessment carrier, mirroring
 *  synthesizeArtifact's own derivation (same helpers, same D-11 role guard). */
export function deriveIdentity(raw: any): EstablishedIdentity {
  const f = raw?.findings ?? {};
  const resp = raw?.response ?? {};
  let bottleneck = f.bottleneck ?? null;
  const signature: string = resp.systemSignature ?? '';
  let category: string = bottleneck?.category ?? '';
  let role = roleNoun(bottleneck?.role);
  // D-11: a diagnosed target with no classifiable role is not "the system".
  if (bottleneck && category !== 'power_match' && role === 'system') {
    bottleneck = null;
    category = '';
    role = '';
  }
  const { verdict, standfirst } = verdictAndStandfirst(bottleneck, category, role, signature);
  // Behavioural reading, never an intent claim — see `characterRead`. Empty
  // when no axis is committed, so the section is absent rather than filled.
  const character = characterRead(f.systemAxes);
  const recognition = character ? `This system reads ${character}.` : '';
  return {
    signature,
    recognition,
    verdict,
    standfirst,
    committedAxes: committedPoles(f.systemAxes),
  };
}

export function toArtifactCaseContext(raw: any): ArtifactCaseContext | null {
  const f = raw?.findings;
  const resp = raw?.response;
  if (!f || !Array.isArray(f.componentNames) || f.componentNames.length === 0) return null;
  const identity = deriveIdentity(raw);
  return {
    componentNames: f.componentNames,
    systemAxes: f.systemAxes,
    perComponentAxes: Array.isArray(f.perComponentAxes)
      ? f.perComponentAxes.map((p: any) => ({ name: p.name, axes: p.axes }))
      : undefined,
    bottleneck: f.bottleneck ?? null,
    constraintExplanation: resp?.constraintExplanation,
    isCoherent: f.isCoherent,
    coherentSharedTraits: f.coherentSharedTraits,
    coherentTradeoffs: f.coherentTradeoffs,
    assessmentStrengths: resp?.assessmentStrengths,
    assessmentLimitations: resp?.assessmentLimitations,
    preferenceNote: resp?.preferenceNote,
    // Established identity — the fixed foundation the composed prose elaborates.
    signature: identity.signature || undefined,
    verdict: identity.verdict,
    standfirst: identity.standfirst,
    recognition: identity.recognition,
    committedAxes: identity.committedAxes,
  };
}

// ── Prompt construction ──────────────────────────────────
// Human phrasing for each committed axis pole — used to state the immutable
// tonal directions to the LLM in plain language (never axis labels).
const AXIS_POLE_PHRASE: Record<string, Record<string, string>> = {
  warm_bright: { warm: 'a warm-leaning tonal balance', bright: 'a bright, resolving tonal balance' },
  smooth_detailed: { smooth: 'ease and smoothness over incisiveness', detailed: 'detail and resolution' },
  elastic_controlled: { elastic: 'rhythmic elasticity and flow', controlled: 'control and grip over bloom' },
  airy_closed: { airy: 'spatial openness and air', closed: 'an intimate, closed-in stage' },
};

/** The immutable-identity preamble injected into the system prompt. */
function buildIdentityBlock(ctx: ArtifactCaseContext): string {
  const committed = ctx.committedAxes ?? {};
  const directions = Object.entries(committed)
    .map(([axis, pole]) => AXIS_POLE_PHRASE[axis]?.[pole])
    .filter(Boolean);
  const lines: string[] = ['ESTABLISHED SYSTEM IDENTITY (determined by the assessment engine — TREAT AS FIXED FACT):'];
  if (ctx.signature) lines.push(`- Signature: ${stripTrailingPeriod(ctx.signature)}.`);
  if (ctx.recognition) lines.push(`- Intent: ${ctx.recognition}`);
  if (directions.length) lines.push(`- Committed tonal directions (must not be contradicted): ${directions.join('; ')}.`);
  else lines.push('- Committed tonal directions: balanced — no single quality dominates; do not manufacture one.');
  return lines.join('\n');
}

export function buildArtifactCasePrompt(ctx: ArtifactCaseContext): {
  systemPrompt: string;
  userPrompt: string;
} {
  const identityBlock = buildIdentityBlock(ctx);
  const systemPrompt = `You are Audio XX, an experienced high-fidelity system advisor.
${AUDIO_XX_DOCTRINE}

${identityBlock}

TASK: Write the JUDGMENT COLUMN of an editorial system assessment — the 2 to 4
paragraphs that argue the case between the opening recognition line and the closing
recommendation. The system's identity above is ALREADY ESTABLISHED by the assessment
engine. Your job is to EXPLAIN WHY that established identity holds — not to decide,
re-weight, soften, or restate it. You are elaborating a fixed conclusion, not forming
a new one.

Structure (compose as flowing paragraphs, not labeled sections):
1) Why the established identity emerges — open on the interaction between components
   that PRODUCES the identity stated above, not on a fresh read of what the chain
   "becomes". The net character is already fixed; show the mechanism behind it.
2) The mechanism — which component supplies which force, and what emerges from their
   meeting. When a bottleneck fact is supplied, this paragraph must name its concrete
   audible consequence.
3) The deal — what this system trades away to be what it is, framed as a deliberate
   cost when the coherence facts support that framing, or as a genuine limit when a
   bottleneck fact is supplied. This trade must be CONSISTENT with the established
   identity — never describe the system as trading away the very quality the identity
   is built on (e.g. if the identity is detail-forward, it does NOT "trade away
   detail"; a single warm component is CONTAINED by the system, it does not redefine
   it).
4) (Optional) The fit — one sentence connecting the system's behaviour to the
   listener-priority facts, only when they are supplied.

Hard rules for THIS surface:
- The established identity is IMMUTABLE. Do not assert a net system character that
  conflicts with the committed tonal directions above. Individual components may pull
  against the whole; the prose must show the system ABSORBING that pull, never letting
  one component's voice become the system's verdict.
- NO recommendations, NO upgrade advice, NO "I'd" / "I would" / "you should" — the
  recommendation is a separate section that follows this text.
- NEVER declare the verdict ("it is balanced", "nothing needs changing", "no weak
  link") — the verdict headline already said it; the column DEMONSTRATES it.
- EXPLAIN, DON'T COUNT. Never surface the analysis machinery ("2 of the 3 components
  lean the same way", "on the ease-vs-resolution axis", percentages, vote counts,
  axis labels as labels). Translate the pattern into what it means. The register to
  hit — an experienced reviewer explaining coherence:
    "The reason this combination works is that each component reinforces the same
     priorities rather than correcting the previous one. The source provides
     precision and timing, the amplifier preserves momentum and drive, and the
     speaker adds body and natural tone. None of the components fights the others,
     so the presentation feels coherent rather than assembled."
  Notice: it names what each component CONTRIBUTES and why the sum coheres — it
  never reports the analysis that discovered it.
- 2 to 4 paragraphs, 90–180 words total. Separate paragraphs with a blank line.
- Prose only. No headers, no lists, no quotes, no questions.`;

  const payload = {
    established_identity: {
      signature: ctx.signature,
      intent: ctx.recognition,
      committed_tonal_directions: ctx.committedAxes,
      note: 'FIXED. Explain why this holds; never re-derive or contradict it.',
    },
    components: ctx.componentNames,
    system_axes: ctx.systemAxes,
    per_component_axes: ctx.perComponentAxes,
    bottleneck: ctx.bottleneck,
    constraint_explanation: ctx.constraintExplanation,
    coherent_voicing: ctx.isCoherent
      ? { shared_traits: ctx.coherentSharedTraits, deliberate_tradeoffs: ctx.coherentTradeoffs }
      : undefined,
    strengths: ctx.assessmentStrengths,
    limitations: ctx.assessmentLimitations,
    listener_fit: ctx.preferenceNote,
  };

  const userPrompt = `Write the judgment column for this system. Use ONLY these facts:

${JSON.stringify(payload, null, 2)}`;

  return { systemPrompt, userPrompt };
}

// ── Validation ───────────────────────────────────────────
// Grounding checks shared with Phase 1's philosophy plus this surface's
// own R-rules (mirroring synthesizeArtifact's post-conditions, enforced
// here BEFORE the text is attached so a failing draft never reaches the
// carrier at all).

/** R5 — the column must not preview the recommendation. */
const RECOMMENDATION_PREVIEW_RE = /\bI[’']d\b|\bI would\b|\byou should\b|\byou'?d (want|need)\b|\brecommend\b|\bupgrade to\b|\breplace the\b/i;

/** R8 — the column must not declare the verdict as a refrain. */
const VERDICT_REFRAIN_RE = /\b(it is balanced|no weak link|nothing (?:here )?needs changing|nothing needs fixing)\b/i;

/** Reviewer-register vocabulary banned by doctrine (subset used as tripwire). */
const REVIEWER_REGISTER_RE = /\b(plush|lush|velvety|shimmering|immersive|soundscape|musicality|musical tapestry|sonically rich|jaw-dropping|draws the listener in|veil lifted)\b/i;

/** Machine register — the column must explain the pattern, never report the
 *  analysis that discovered it ("2 of the 3 components lean the same way",
 *  "on the ease vs. resolution axis", vote counts, axis labels as labels). */
const MACHINE_REGISTER_RE = /\b(\d+\s+of\s+(?:the\s+)?\d+\s+components?|lean(?:s|ing)?\s+the\s+same\s+way|on\s+the\s+[\w\s]+\s+axis\b|warm_bright|smooth_detailed|elastic_controlled|airy_closed|axis\s+(?:position|leaning|label))\b/i;

/** Fabricated measurements — reject numbers with engineering units not in context. */
const MEASUREMENT_RE = /\b\d+(\.\d+)?\s?(db|wpc|watts?|w\b|khz|hz|ohms?|bit|µv|uv)\b/i;

// ── Identity-contradiction tripwires ─────────────────────
// For each committed axis pole, the phrases that assert the OPPOSITE pole as
// the system's NET character. If the established identity commits to a pole,
// composed prose that asserts its opposite as the system's read is a
// redefinition, not an elaboration — it must fall back to deterministic.
//
// These target NET-character assertions ("the system trades detail for warmth"),
// not local component description ("the speaker is warm") — a warm speaker inside
// a detail-forward system is fine; a detail-forward system that "trades away
// detail" is not. Negated forms ("without sacrificing detail") are guarded below.
const OPPOSITE_POLE_TRIPWIRES: Record<string, Record<string, RegExp>> = {
  smooth_detailed: {
    // Identity = DETAILED → must not read as net detail-sacrificing / smooth.
    detailed:
      /\btrades?\s+(?:away\s+|off\s+|out\s+|some\s+|extreme\s+|the\s+|much\s+of\s+(?:its\s+)?|ultimate\s+|outright\s+)?(?:detail|resolution|precision|incisiveness|transient\w*)\b|\b(?:sacrific\w+|forgo\w+|gives?\s+up|surrender\w+|relinquish\w+)\s+(?:some\s+|much\s+of\s+(?:its\s+)?|the\s+|extreme\s+)?(?:detail|resolution|precision)\b|\b(?:warmth|smoothness|body|ease|musicality|tone)\s+over\s+(?:detail|resolution|precision)\b|\bfavou?rs?\s+(?:warmth|smoothness|body|tone|ease)\s+over\s+(?:detail|resolution)\b/i,
    // Identity = SMOOTH → must not read as net analytical / etched.
    smooth:
      /\b(?:analytical|clinical|etched|forensic|relentless(?:ly)?|hyper-?detailed|surgical)\b[^.]{0,32}\b(?:presentation|character|balance|voice|sound|read|tilt)\b|\bprioriti[sz]es?\s+(?:detail|resolution)\s+over\s+(?:ease|warmth|musicality|smoothness)\b/i,
  },
  warm_bright: {
    warm:
      /\b(?:bright|cool|cold|lean|analytical|clinical)\b[^.]{0,28}\b(?:presentation|character|balance|voice|tilt|tonal(?:ity)?|sound|read)\b|\btilts?\s+(?:bright|cool|cold|lean)\b/i,
    bright:
      /\b(?:warm|dark|rich|romantic|plummy)\b[^.]{0,28}\b(?:presentation|character|balance|voice|tilt|tonal(?:ity)?|read)\b|\btilts?\s+warm\b/i,
  },
  elastic_controlled: {
    elastic:
      /\b(?:iron|vice-?like|over-?damped|buttoned-?down|clinical)\b[^.]{0,22}\b(?:grip|control|damping)\b|\bprioriti[sz]es?\s+(?:control|grip|damping)\s+over\s+(?:flow|life|momentum|bloom|swing)\b/i,
    controlled:
      /\b(?:loose|slack|wo?olly|flabby|undamped|over-?ripe|billowy)\b[^.]{0,20}\b(?:bass|grip|control|bottom\s+end)\b|\btrades?\s+(?:away\s+)?(?:grip|control|damping)\s+for\s+(?:bloom|flow|life)\b/i,
  },
  airy_closed: {
    airy:
      /\b(?:closed-?in|congested|shut-?in|airless|compressed|claustrophobic|boxed-?in)\b[^.]{0,20}\b(?:stage|soundstage|presentation|space|image)\b/i,
    closed:
      /\b(?:cavernous|diffuse|over-?ventilated|billowing|unfocused)\b[^.]{0,20}\b(?:stage|soundstage|image)\b/i,
  },
};

/** True when the prose negates the contradiction ("without sacrificing detail",
 *  "rather than trading resolution") — those AGREE with the identity. */
const NEGATION_GUARD_RE =
  /\b(?:without|never|not|no\s+loss\s+of|rather\s+than|instead\s+of|far\s+from)\b[^.]{0,24}$/i;

/** Does the prose assert the opposite of a committed pole as the system's net
 *  character? Returns the offending `axis:pole` keys. */
export function assertsOppositePole(text: string, committedAxes: Record<string, string> | undefined): string[] {
  if (!committedAxes) return [];
  const hits: string[] = [];
  for (const [axis, pole] of Object.entries(committedAxes)) {
    const re = OPPOSITE_POLE_TRIPWIRES[axis]?.[pole];
    if (!re) continue;
    const m = re.exec(text);
    if (!m) continue;
    // Skip when the match is negated (agrees with the identity).
    const preceding = text.slice(Math.max(0, m.index - 28), m.index);
    if (NEGATION_GUARD_RE.test(preceding)) continue;
    hits.push(`${axis}:${pole}`);
  }
  return hits;
}

export function validateArtifactCase(text: string, ctx: ArtifactCaseContext): string[] {
  const fails: string[] = [];
  const trimmed = text.trim();

  // Identity immutability — composed prose may not assert a net character that
  // contradicts the established identity's committed tonal directions.
  const committed = ctx.committedAxes ?? committedPoles(ctx.systemAxes);
  for (const key of assertsOppositePole(trimmed, committed)) {
    fails.push(`identity-contradiction:${key}`);
  }

  // Structure: 2–4 paragraphs (blank-line separated), 90–180 words.
  const paragraphs = trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length < 2 || paragraphs.length > 4) {
    fails.push(`paragraph-count:${paragraphs.length}`);
  }
  const words = trimmed.split(/\s+/).length;
  if (words < 70 || words > 220) fails.push(`length-out-of-range:${words}`);

  // R5 / R8 / register.
  if (RECOMMENDATION_PREVIEW_RE.test(trimmed)) fails.push('previews-recommendation');
  if (VERDICT_REFRAIN_RE.test(trimmed)) fails.push('declares-verdict');
  if (REVIEWER_REGISTER_RE.test(trimmed)) fails.push('reviewer-register');
  if (MACHINE_REGISTER_RE.test(trimmed)) fails.push('machine-register');

  // Measurement fabrication — allowed only when the same figure appears in
  // the supplied constraint explanation (e.g. "86 dB sensitivity" is a real
  // engine-computed fact on power-match bottlenecks).
  const m = MEASUREMENT_RE.exec(trimmed);
  if (m) {
    const ctxText = `${ctx.constraintExplanation ?? ''} ${JSON.stringify(ctx.assessmentStrengths ?? [])} ${JSON.stringify(ctx.assessmentLimitations ?? [])}`.toLowerCase();
    if (!ctxText.includes(m[0].toLowerCase().replace(/\s+/g, ' ').trim())
        && !ctxText.includes(m[0].toLowerCase().replace(/\s+/g, ''))) {
      fails.push(`fabricated-measurement:${m[0]}`);
    }
  }

  // Foreign products — every capitalized brand-looking token that matches a
  // known audio brand must be one of this system's components.
  const knownTokens = new Set<string>();
  for (const n of ctx.componentNames) {
    for (const w of n.toLowerCase().split(/[^a-z0-9]+/)) {
      if (w.length >= 3) knownTokens.add(w);
    }
  }
  const FOREIGN_BRANDS = [
    'wilson', 'magico', 'mcintosh', 'krell', 'bryston', 'rega', 'marantz',
    'denon', 'yamaha', 'rotel', 'bowers', 'sonus faber', 'dynaudio', 'elac',
    'klipsch', 'jbl', 'focal', 'naim', 'hegel', 'topping', 'schiit',
    'denafrips', 'chord', 'goldmund', 'leben', 'devore', 'harbeth',
    'magnepan', 'kef', 'wlm', 'eversolo', 'shindo', 'accuphase', 'luxman',
  ];
  const lower = trimmed.toLowerCase();
  for (const brand of FOREIGN_BRANDS) {
    if (lower.includes(brand) && !knownTokens.has(brand.replace(/[^a-z0-9]/g, ''))) {
      fails.push(`names-foreign-product:${brand}`);
    }
  }

  // Grounding: at least one of this system's components must be named.
  if (![...knownTokens].some((tok) => lower.includes(tok))) {
    fails.push('system-not-referenced');
  }

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

export interface A3ArtifactCaseResult {
  caseParagraphs: string[];
  status: 'pass' | 'revised';
}

/**
 * Generate A3 case paragraphs for the artifact judgment column.
 * Draft → validate → revise once (naming the failed checks) → null.
 * Null means the deterministic column stands.
 */
export async function generateA3ArtifactCase(raw: any): Promise<A3ArtifactCaseResult | null> {
  const ctx = toArtifactCaseContext(raw);
  if (!ctx) return null;
  const { systemPrompt, userPrompt } = buildArtifactCasePrompt(ctx);

  let answer = await callLLM(systemPrompt, userPrompt);
  if (!answer) return null;

  let fails = validateArtifactCase(answer, ctx);
  if (fails.length === 0) {
    return {
      caseParagraphs: answer.trim().split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
      status: 'pass',
    };
  }

  // One revision attempt, naming the failed checks (WS31 pattern).
  const revised = await callLLM(
    systemPrompt,
    `${userPrompt}\n\n[Your previous draft failed these checks: ${fails.join(', ')}. Rewrite fixing exactly those issues while keeping the required structure.]`,
  );
  if (!revised) return null;
  fails = validateArtifactCase(revised, ctx);
  if (fails.length === 0) {
    return {
      caseParagraphs: revised.trim().split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
      status: 'revised',
    };
  }

  return null;
}
