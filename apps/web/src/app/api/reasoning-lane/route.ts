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

export async function POST(req: NextRequest) {
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

  try {
    const ctx = await assembleGovernedContext({
      activeSystem: { components, source: body.activeSystem?.source === 'saved' ? 'saved' : 'stated' },
      currentHypothetical: hyp,
      question,
      recentTurns,
      userObservations: (body.userObservations ?? []).filter((o) => typeof o === 'string').slice(0, 12),
    });

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

    return NextResponse.json({
      answer: validated.answer,
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
