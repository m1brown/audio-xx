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
  verdict?: string;
  standfirst?: string;
}

export function toArtifactCaseContext(raw: any): ArtifactCaseContext | null {
  const f = raw?.findings;
  const resp = raw?.response;
  if (!f || !Array.isArray(f.componentNames) || f.componentNames.length === 0) return null;
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
  };
}

// ── Prompt construction ──────────────────────────────────
export function buildArtifactCasePrompt(ctx: ArtifactCaseContext): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `You are Audio XX, an experienced high-fidelity system advisor.
${AUDIO_XX_DOCTRINE}

TASK: Write the JUDGMENT COLUMN of an editorial system assessment — the 2 to 4
paragraphs that argue the case between the opening recognition line and the closing
recommendation. This is the artifact's core argument: WHY the system behaves the way
it does.

Structure (compose as flowing paragraphs, not labeled sections):
1) The system-level read — what this chain becomes when combined, opening on the
   interaction between components, not on a list of traits.
2) The mechanism — which component supplies which force, and what emerges from their
   meeting. When a bottleneck fact is supplied, this paragraph must name its concrete
   audible consequence.
3) The deal — what this system trades away to be what it is, framed as a deliberate
   cost when the coherence facts support that framing, or as a genuine limit when a
   bottleneck fact is supplied.
4) (Optional) The fit — one sentence connecting the system's behaviour to the
   listener-priority facts, only when they are supplied.

Hard rules for THIS surface:
- NO recommendations, NO upgrade advice, NO "I'd" / "I would" / "you should" — the
  recommendation is a separate section that follows this text.
- NEVER declare the verdict ("it is balanced", "nothing needs changing", "no weak
  link") — the verdict headline already said it; the column DEMONSTRATES it.
- 2 to 4 paragraphs, 90–180 words total. Separate paragraphs with a blank line.
- Prose only. No headers, no lists, no quotes, no questions.`;

  const payload = {
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

/** Fabricated measurements — reject numbers with engineering units not in context. */
const MEASUREMENT_RE = /\b\d+(\.\d+)?\s?(db|wpc|watts?|w\b|khz|hz|ohms?|bit|µv|uv)\b/i;

export function validateArtifactCase(text: string, ctx: ArtifactCaseContext): string[] {
  const fails: string[] = [];
  const trimmed = text.trim();

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
