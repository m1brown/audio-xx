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
import { serializeGovernedContext, REASONING_RULES } from '@/lib/reasoning/governed-context';
import { validateClaims } from '@/lib/reasoning/claim-validation';

const TIMEOUT_MS = 30000;
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
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }

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

    const tAssembly = Date.now() - t0;
    const serialized = serializeGovernedContext(ctx);
    const messages = [
      { role: 'system', content: `${REASONING_RULES}\n\n${serialized}` },
      ...recentTurns,
      { role: 'user', content: question },
    ];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: getModel(), temperature: 0.4, messages }),
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
    const validated = await validateClaims({
      answer: draft,
      contextBlock: serialized,
      conversationText: [...recentTurns.map((t) => t.content), question].join('\n'),
      apiKey,
      // The checker is a constrained adjudication task; a lighter model may
      // serve it. Default unchanged — this knob exists for latency work.
      model: process.env.REASONING_VALIDATOR_MODEL ?? getModel(),
    });

    const tValidator = Date.now() - t0 - tAssembly - tPrimary;
    return NextResponse.json({
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
