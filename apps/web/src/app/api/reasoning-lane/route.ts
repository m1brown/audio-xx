/**
 * API route: /api/reasoning-lane
 *
 * The governed reasoning lane (Substrate Doctrine, 2026-08-31). The
 * deterministic substrate assembles everything the model may know — active
 * system, one-slot hypothetical, candidate evidence with per-item
 * provenance, computed interface facts — and the model reasons about what
 * it means over the RAW recent conversation. The application never asks the
 * model what is true about a product; the model never decides what is
 * knowable.
 *
 * Flag-gated at the caller. This route is inert until a client sends to it.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { assembleGovernedContext, type ConversationTurn } from '@/lib/reasoning/context-assembly';
import {
  serializeGovernedContext, REASONING_RULES, ASSESSMENT_COMPOSITION_RULES,
} from '@/lib/reasoning/governed-context';
import { validateClaims, computeValidationStatus } from '@/lib/reasoning/claim-validation';
import { deterministicTrustCheck } from '@/lib/reasoning/deterministic-trust';
import { generationParams } from '@/lib/reasoning/model-params';
import { establishedIdentity } from '@/lib/evidence/identity-admission';
import { buildServerDossiers } from '@/lib/assessment/server-dossiers';
import { analyzeConversionPath } from '@/lib/assessment/conversion-path';

/*
 * Generation timeout (M1 astra promotion, 2026-09-17): raised 30s → 90s
 * to cover gpt-6-astra's measured tail (p99 ~40s, max observed ~64s over
 * 250 experiment turns). This bounds ONE generation; the validator keeps
 * its own budget, and the client's bounded retry issues a separate
 * request. Not an unlimited request — 90s is the measured tail plus
 * margin, nothing more.
 */
const TIMEOUT_MS = 90000;
const MAX_TURNS = 12;
const MAX_TURN_CHARS = 6000;
const MAX_COMPONENTS = 10;

function getModel(): string {
  return process.env.REASONING_LANE_MODEL
    ?? process.env.ORCHESTRATOR_LLM_MODEL
    ?? 'gpt-4o';
}

/**
 * Founder-cohort gate (release governance, 2026-09-01). Server-side only:
 *   REASONING_LANE_USERS  — comma-separated allowlisted account emails.
 * Unset (default): the lane is closed in deployed environments; local dev
 * stays open for QA. Kill switch: unset the variable. Selection is
 * auditable — every allow/deny logs one structured line, no content.
 */
async function laneEligible(): Promise<{ ok: boolean; who: string }> {
  const allow = (process.env.REASONING_LANE_USERS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (allow.length === 0) {
    // No cohort configured: closed on Vercel, open in local development.
    return { ok: !process.env.VERCEL_ENV, who: 'no-cohort' };
  }
  const session = await getSession();
  const email = (session?.user as { email?: string } | undefined)?.email?.toLowerCase() ?? '';
  return { ok: !!email && allow.includes(email), who: email || 'anonymous' };
}

/** GET — cohort eligibility for the signed-in user; the client asks this
 *  once and only then routes turns to the lane. Reveals nothing else. */
export async function GET() {
  const e = await laneEligible();
  return NextResponse.json({ eligible: e.ok });
}

export async function POST(req: NextRequest) {
  const gate = await laneEligible();
  if (!gate.ok) {
    console.warn('[reasoning-lane] deny user=%s cohort=%s', gate.who, !!process.env.REASONING_LANE_USERS);
    return NextResponse.json({ error: 'reasoning lane not enabled for this account' }, { status: 403 });
  }
  console.warn('[reasoning-lane] allow user=%s', gate.who);
  let body: {
    activeSystem?: { components?: Array<{ displayName?: string; role?: string }>; source?: string };
    currentHypothetical?: { candidate?: string; incumbent?: string } | null;
    question?: string;
    recentTurns?: Array<{ role?: string; content?: string }>;
    userObservations?: string[];
    /** 'assessment' = governed TURN-0 synthesis over the same substrate
     *  (founder decision, 2026-09-19); anything else = conversational turn. */
    mode?: string;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  const assessmentMode = body.mode === 'assessment';

  const question = typeof body.question === 'string' ? body.question.slice(0, MAX_TURN_CHARS) : '';
  const rawComponents = Array.isArray(body.activeSystem?.components) ? body.activeSystem!.components! : [];
  if (!question || rawComponents.length === 0) {
    return NextResponse.json({ error: 'question and activeSystem.components required' }, { status: 400 });
  }
  const components = rawComponents.slice(0, MAX_COMPONENTS)
    .filter((c) => typeof c.displayName === 'string' && c.displayName.trim())
    .map((c) => ({ displayName: String(c.displayName).slice(0, 120), role: String(c.role ?? '').slice(0, 40) }));
  const recentTurns: ConversationTurn[] = (Array.isArray(body.recentTurns) ? body.recentTurns : [])
    .filter((t) => (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string')
    .slice(-MAX_TURNS)
    .map((t) => ({ role: t.role as 'user' | 'assistant', content: String(t.content).slice(0, MAX_TURN_CHARS) }));
  const hyp = body.currentHypothetical && body.currentHypothetical.candidate && body.currentHypothetical.incumbent
    ? { candidate: String(body.currentHypothetical.candidate).slice(0, 120), incumbent: String(body.currentHypothetical.incumbent).slice(0, 120) }
    : null;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'reasoning lane not configured' }, { status: 503 });

  const t0 = Date.now();
  try {
    const ctx = await assembleGovernedContext({
      activeSystem: { components, source: body.activeSystem?.source === 'saved' ? 'saved' : 'stated' },
      currentHypothetical: hyp,
      question,
      recentTurns,
      userObservations: (body.userObservations ?? []).filter((o) => typeof o === 'string').slice(0, 12),
    });

    /*
     * TURN-0 INPUT CONTRACT (governed initial assessment, 2026-09-19).
     * The assessment mode receives ONLY admitted material, and two
     * deterministic sections the conversational lane leaves to raw
     * history because turn 0 has none:
     *
     *   IDENTITY STATUS — each component's identity basis from the same
     *   admission lattice that gates the fact store. An unresolved
     *   description is explicitly marked so the model may treat it as the
     *   listener's words, never as a resolvable product.
     *
     *   TOPOLOGY — analyzeConversionPath over the server dossiers: the
     *   application's deterministic reading of what the component list
     *   does and does not establish about the signal path.
     *
     * No new acquisition path: dossiers read the identity-gated store,
     * and everything else is arithmetic over the roster.
     */
    let assessmentContext = '';
    if (assessmentMode) {
      const idLines: string[] = [];
      for (const c of components) {
        const id = await establishedIdentity(c.displayName);
        idLines.push(id
          ? `- ${c.displayName}: identity established (${id.basis}${id.canonicalName ? ` — ${id.canonicalName}` : ''})`
          : `- ${c.displayName}: the listener's description only — identity NOT established. Do not assign it a specific model, exact facts, or a product-specific character; asking which model it is may be the most useful question in this assessment.`);
      }
      const dossiers = await buildServerDossiers(
        components.map((c) => ({ name: c.displayName, role: c.role })), question,
      );
      const conv = analyzeConversionPath(components, dossiers, question);
      const stageNames = (conv.stages ?? []).map((s: { name: string }) => s.name);
      const topology = conv.ambiguous
        ? `the component list does NOT establish where digital-to-analogue conversion happens (capable stages: ${stageNames.join(', ') || 'multiple'}); the connections are the listener's to state`
        : conv.explicit
          ? 'the signal path is established from the listener’s own description'
          : 'no competing conversion stages; the nominal chain order applies';
      assessmentContext = `\nCOMPONENT IDENTITY STATUS (from the application's identity admission; authoritative)\n${idLines.join('\n')}\n\nAPPLICATION TOPOLOGY ANALYSIS (deterministic)\n- ${topology}`;
    }

    const tAssembly = Date.now() - t0;
    const serialized = serializeGovernedContext(ctx) + assessmentContext;
    const rules = assessmentMode
      ? `${REASONING_RULES}\n${ASSESSMENT_COMPOSITION_RULES}`
      : REASONING_RULES;
    const messages = [
      { role: 'system', content: `${rules}\n\n${serialized}` },
      ...recentTurns,
      { role: 'user', content: question },
    ];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      // Parameter compatibility (M1 astra promotion): the gpt-4 family
      // keeps its historical temperature 0.4; other models (gpt-6-astra)
      // run at API default — exactly the winning experimental arm's
      // configuration, and reasoning models may reject the parameter.
      body: JSON.stringify({ model: getModel(), ...generationParams(getModel()), messages }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!r.ok) return NextResponse.json({ error: 'upstream error' }, { status: 502 });
    const j = await r.json();
    const tPrimary = Date.now() - t0 - tAssembly;
    const primaryUsage = j?.usage ?? null;
    const draft: string | undefined = j?.choices?.[0]?.message?.content;
    if (!draft) return NextResponse.json({ error: 'no answer' }, { status: 502 });

    // Narrow D-7 validation: licensed-basis check with weakening-only repair.
    // The checker model is pinned independently of generation (M1 astra
    // promotion: REASONING_VALIDATOR_MODEL=gpt-4o in production, so a
    // generation-model change never silently changes the checker).
    const validatorModel = process.env.REASONING_VALIDATOR_MODEL ?? getModel();
    const validated = await validateClaims({
      answer: draft,
      contextBlock: serialized,
      conversationText: [...recentTurns.map((t) => t.content), question].join('\n'),
      apiKey,
      model: validatorModel,
    });

    const tValidator = Date.now() - t0 - tAssembly - tPrimary;
    /*
     * PUBLICATION BOUNDARY (Migration 1, §6). Only CHECKED and REPAIRED
     * answers publish. INCOMPLETE (assurance unknown) and REJECTED
     * (consequential violation survived) return status WITHOUT an answer,
     * and the caller's existing legacy fallback — already the failure path
     * for every other non-answer — takes the turn. No unchecked draft
     * reaches a listener as though it had passed.
     */
    let status = computeValidationStatus(validated);
    /*
     * DETERMINISTIC TRUST GATE (M1 quality correction, 2026-09-16).
     * Externally verifiable exact claims — figures, watt/load pairings,
     * evidence-voiced statements — are enforced on the FINAL candidate
     * text, independent of prose style and independent of the semantic
     * checker (which adversarial probes showed passing a hedged invented
     * watt-load and a measurement-voice claim). A violation here is not
     * advisory: the answer does not publish while one stands.
     */
    const det = deterministicTrustCheck(
      validated.answer,
      serialized,
      [...recentTurns.map((t) => t.content), question].join('\n'),
    );
    if ((status === 'CHECKED' || status === 'REPAIRED') && !det.clean) status = 'REJECTED';
    const deletionRequired = validated.violations.some((v) => v.rewrite === null);
    // Observability (§14): one structured line per turn, no content.
    console.warn('[reasoning-lane] result mode=%s status=%s viol=%d repaired=%d delReq=%s det=%s(w=%d,f=%d,v=%d) pub=%s totalMs=%d model=%s vmodel=%s comps=%d cand=%d hyp=%s',
      assessmentMode ? 'assessment' : 'turn',
      status, validated.violations.length, validated.repaired, deletionRequired,
      det.clean ? 'clean' : 'viol', det.unlicensedWattLoad.length, det.strayFigures.length, det.unlicensedEvidenceVoice.length,
      status === 'CHECKED' || status === 'REPAIRED',
      Date.now() - t0, getModel(), validatorModel, components.length, ctx.candidates.length,
      ctx.currentHypothetical ? 'set' : 'none');
    if (status === 'INCOMPLETE' || status === 'REJECTED') {
      return NextResponse.json({
        status,
        error: det.clean ? 'validation did not pass' : 'deterministic trust violation',
        validation: {
          violations: validated.violations.map((v) => ({
            type: v.type, sentence: v.sentence.slice(0, 300),
          })),
          repaired: validated.repaired,
          unchecked: validated.unchecked,
          deletionRequired,
        },
        deterministic: {
          unlicensedWattLoad: det.unlicensedWattLoad.slice(0, 6),
          strayFigures: det.strayFigures.slice(0, 12),
          unlicensedEvidenceVoice: det.unlicensedEvidenceVoice.slice(0, 6),
        },
      });
    }
    return NextResponse.json({
      status,
      answer: validated.answer,
      timing: {
        assemblyMs: tAssembly,
        primaryMs: tPrimary,
        validatorMs: tValidator,
        totalMs: Date.now() - t0,
        primaryUsage,
        contextChars: serialized.length,
      },
      validation: {
        violations: validated.violations.map((v) => ({
          type: v.type,
          sentence: v.sentence.slice(0, 300),
          rewrite: v.rewrite === null ? null : v.rewrite.slice(0, 300),
        })),
        repaired: validated.repaired,
        unchecked: validated.unchecked,
      },
      deterministic: { clean: true },
      // Trace for QA and the validator: what the model was allowed to know.
      contextMeta: {
        candidates: ctx.candidates.map((c) => ({ name: c.displayName, identity: c.identity, items: c.items.length })),
        computedFacts: ctx.computedFacts.length,
        hypothetical: ctx.currentHypothetical,
      },
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return NextResponse.json({ error: aborted ? 'timeout' : 'assembly failed' }, { status: aborted ? 504 : 500 });
  }
}
