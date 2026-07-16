/**
 * Launch QA — benchmark runner (branch: launch-qa-responses).
 *
 * Routes every benchmark prompt through the deterministic engine exactly
 * the way page.tsx does on a first-time-visitor turn (guest state, no
 * saved systems, no conversation history), captures the complete
 * user-visible response, and writes a transcript for scoring.
 *
 * NOT a pass/fail test — it always succeeds if the engine doesn't throw.
 * The output artifacts are the deliverable:
 *   audit-2026-07-02/launch-qa/responses.json     (structured)
 *   audit-2026-07-02/launch-qa/transcript.md      (human-readable)
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BENCHMARK_PROMPTS } from './benchmark-prompts';
import { buildTurnContext } from '../../turn-context';
import { detectIntent, respondToMusicInput, MUSIC_INPUT_FALLBACK } from '../../intent';
import { buildSystemAssessment, buildConsultationResponse } from '../../consultation';
import { detectShoppingIntent, buildShoppingAnswer } from '../../shopping-intent';
import { shoppingToAdvisory } from '../../advisory-response';
import { reason } from '../../reasoning';
import type { AudioSessionState } from '../../system-types';
import type { ExtractedSignals } from '../../signal-types';

// Phase 3 (2026-07-14): expanded run writes to a fresh dated directory
// so the original 60-prompt artifacts stay intact for diffing.
const OUT_DIR = path.resolve(__dirname, '../../../../../../audit-2026-07-14/launch-qa-100');

// Guest session — no saved systems, nothing active.
const GUEST_AUDIO_STATE: AudioSessionState = {
  activeSystemRef: { kind: 'none' } as AudioSessionState['activeSystemRef'],
  savedSystems: [],
  draftSystem: null,
  loading: false,
  proposedSystem: null,
};

const EMPTY_SIGNALS: ExtractedSignals = {
  traits: {},
  symptoms: [],
  archetype_hints: [],
  uncertainty_level: 0.5,
  matched_phrases: [],
  matched_uncertainty_markers: [],
};

// ── Generic flattener ─────────────────────────────────────
// Walks the known text-bearing fields of any engine response shape and
// produces the text a user would actually read. Order approximates the
// on-screen order in AdvisoryMessage.
function flatten(obj: any, depth = 0): string {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  if (Array.isArray(obj)) return obj.map((x) => flatten(x, depth + 1)).filter(Boolean).join('\n');
  if (typeof obj !== 'object') return String(obj);

  const parts: string[] = [];
  const push = (label: string, v: unknown) => {
    const t = flatten(v, depth + 1).trim();
    if (t) parts.push(depth === 0 ? `[${label}]\n${t}` : t);
  };

  // Ordered, curated field walk — mirrors what renders.
  const FIELDS = [
    'acknowledge', 'context', 'question',
    'clarification', 'shortAnswer', 'introSummary', 'summary', 'headline',
    'systemContext', 'recognition', 'keyObservation',
    'assessmentStrengths', 'assessmentLimitations', 'upgradeDirection',
    'preferenceNote', 'philosophy', 'sonicCharacter', 'answer', 'body',
    'whatChanges', 'systemBehavior', 'goalAlignment', 'recommendation',
    'directAnswer', 'explanation', 'guidance', 'expectedImpact',
    'decisiveRecommendation', 'comparisonSummary', 'verdict',
    'followUp', 'nextStep',
  ];
  for (const f of FIELDS) {
    if (obj[f] !== undefined) push(f, obj[f]);
  }

  // Product options — name + fit note per option.
  if (Array.isArray(obj.options)) {
    const opts = obj.options.map((o: any) => {
      const nm = [o.brand, o.name].filter(Boolean).join(' ');
      const bits = [o.fitNote, o.chooseThisIf, o.systemDelta?.whyFitsSystem]
        .map((s: any) => (typeof s === 'string' ? s.trim() : ''))
        .filter(Boolean);
      const price = o.price ? ` ($${o.price})` : '';
      return `• ${nm}${price}${bits.length ? ` — ${bits[0]}` : ''}`;
    }).join('\n');
    if (opts) parts.push(`[options]\n${opts}`);
  }
  if (obj.topPick || obj.decisiveRecommendation?.topPick) {
    const tp = obj.topPick ?? obj.decisiveRecommendation?.topPick;
    if (tp?.name) parts.push(`[top pick] ${[tp.brand, tp.name].filter(Boolean).join(' ')} — ${tp.reason ?? ''}`);
  }

  return parts.join('\n\n');
}

interface CapturedResponse {
  id: string;
  category: string;
  prompt: string;
  expectation: string;
  routedIntent: string;
  routedPath: string;
  response: string;
  error?: string;
}

function runPrompt(id: string, category: string, prompt: string, expectation: string): CapturedResponse {
  const base = { id, category, prompt, expectation };
  try {
    const turnCtx = buildTurnContext(prompt, GUEST_AUDIO_STATE, new Set(), undefined);
    const { intent } = detectIntent(prompt, {
      hasActiveSystem: !!turnCtx.activeSystem,
      subjectCount: turnCtx.subjectMatches.length,
    } as any);

    // ── Route 1: system assessment ──
    if (intent === 'system_assessment' || (turnCtx.activeSystem && /assess|what do you think of this system|my system is/i.test(prompt))) {
      const result: any = buildSystemAssessment(prompt, turnCtx.subjectMatches, turnCtx.activeSystem, turnCtx.desires);
      if (!result) {
        return { ...base, routedIntent: intent, routedPath: 'system_assessment→null', response: '(engine returned null — page.tsx falls through to consultation)' };
      }
      if (result.kind === 'clarification') {
        return { ...base, routedIntent: intent, routedPath: 'system_assessment→clarification', response: flatten(result.clarification ?? result) };
      }
      return { ...base, routedIntent: intent, routedPath: 'system_assessment', response: flatten(result.response) };
    }

    // GTM Phase 4 empty-turn guard marker — mirrors page.tsx: any lane
    // that produces no substantive response falls through to the
    // knowledge lane on prod.
    const KNOWLEDGE_FALLBACK_RESPONSE =
      '(Empty-turn guard → knowledge lane — prod answers with model prose. Fallback if LLM unavailable: "I don\'t have enough structured data to answer this question thoroughly.")';

    // ── Route 2: shopping ──
    const shoppingCtx = detectShoppingIntent(prompt, EMPTY_SIGNALS);
    if (intent === 'shopping' || (shoppingCtx.detected && intent !== 'diagnosis' && intent !== 'consultation_entry' && turnCtx.subjectMatches.length < 2)) {
      const reasoning = reason(prompt, turnCtx.desires, EMPTY_SIGNALS, null, shoppingCtx, null);
      // listenerProfile omitted: buildShoppingAnswer expects the shopping
      // ListenerProfile shape (dislikedBrands etc.), not the turn-context
      // preference profile. Guest first-turn has neither — undefined is
      // exactly what page.tsx passes on turn one.
      const answer = buildShoppingAnswer(shoppingCtx, EMPTY_SIGNALS, undefined, reasoning);
      // Mirrors the page.tsx shopping empty-turn guard: zero product
      // options → knowledge lane instead of the empty shell.
      if (!answer.productExamples || answer.productExamples.length === 0) {
        return { ...base, routedIntent: intent, routedPath: `shopping(${shoppingCtx.category ?? '?'})→empty→llm-lane`, response: KNOWLEDGE_FALLBACK_RESPONSE };
      }
      const advisory = shoppingToAdvisory(answer, EMPTY_SIGNALS, reasoning);
      return { ...base, routedIntent: intent, routedPath: `shopping(${shoppingCtx.category ?? '?'})`, response: flatten(advisory) };
    }

    // ── Route 2a-guard: music_input / intake empty-turn guards ──
    // Mirrors page.tsx: a music_input the matcher can't classify, or an
    // intake intent carrying a question-shaped message, falls through to
    // the knowledge lane.
    const musicIsQuestion = /\?\s*$/.test(prompt.trim())
      || /^(?:do|does|is|are|can|could|should|what|whats|what's|why|how|which|when|where)\b/i.test(prompt.trim())
      || /\b(?:where do i start|how do i|should i|worth it)\b/i.test(prompt);
    if (intent === 'music_input' && (musicIsQuestion || respondToMusicInput(prompt) === MUSIC_INPUT_FALLBACK)) {
      return { ...base, routedIntent: intent, routedPath: 'music_input→question→llm-lane', response: KNOWLEDGE_FALLBACK_RESPONSE };
    }
    if (intent === 'intake' && (/\?\s*$/.test(prompt.trim()) || /^(?:do|does|is|are|can|could|should|what|whats|what's|why|how|which|when|where)\b/i.test(prompt.trim()))) {
      return { ...base, routedIntent: intent, routedPath: 'intake→question→llm-lane', response: KNOWLEDGE_FALLBACK_RESPONSE };
    }

    // ── Route 2b: audio_knowledge (LLM lane) ──
    // page.tsx renders buildKnowledgeResponse's deterministic scaffold
    // immediately, then replaces `explanation` with LLM prose. Locally we
    // capture the scaffold + the no-LLM fallback text, and mark the lane —
    // on prod the final prose is model-generated.
    if (intent === 'audio_knowledge' || intent === 'audio_assistant') {
      return {
        ...base,
        routedIntent: intent,
        routedPath: `llm-lane(${intent})`,
        response: '(LLM lane — deterministic scaffold only; prod replaces with model prose. Fallback if LLM unavailable: "I don\'t have enough structured data to answer this question thoroughly. This topic falls outside my calibrated product database.")',
      };
    }

    // ── Route 2c: diagnosis ──
    // page.tsx opens diagnosis with a component-aware clarification and
    // gathers symptoms across turns. Single-turn capture = the opening move.
    if (intent === 'diagnosis') {
      const consultTry: any = buildConsultationResponse(prompt, turnCtx.subjectMatches);
      if (consultTry) {
        return { ...base, routedIntent: intent, routedPath: 'diagnosis→consultation', response: flatten(consultTry) };
      }
      return {
        ...base,
        routedIntent: intent,
        routedPath: 'diagnosis→clarification',
        response: '(Diagnosis lane opening move — engine asks a component-aware clarifying question, e.g. "Got it — let\'s figure out what\'s going on. Does it sound thin, digital, fatiguing, or lifeless — or something else?" then gathers symptoms across turns.)',
      };
    }

    // ── Route 3: consultation (philosophy / gear inquiry / brand / comparison) ──
    const consult: any = buildConsultationResponse(prompt, turnCtx.subjectMatches);
    if (consult) {
      return { ...base, routedIntent: intent, routedPath: 'consultation', response: flatten(consult) };
    }

    // ── Route 4: last resort — try assessment anyway (page.tsx has more
    // fallthroughs; this approximates "the engine had nothing"). ──
    const late: any = buildSystemAssessment(prompt, turnCtx.subjectMatches, turnCtx.activeSystem, turnCtx.desires);
    if (late?.response) {
      return { ...base, routedIntent: intent, routedPath: 'fallback→assessment', response: flatten(late.response) };
    }
    // GTM Phase 4: page.tsx's consultation-null terminal now runs the
    // knowledge lane (after LLM product inference) instead of ending
    // empty — 'unrouted' no longer exists as a user-visible state.
    return { ...base, routedIntent: intent, routedPath: 'unrouted→llm-lane', response: KNOWLEDGE_FALLBACK_RESPONSE };
  } catch (e: any) {
    return { ...base, routedIntent: 'error', routedPath: 'threw', response: '', error: `${e?.message ?? e}` };
  }
}

describe('Launch QA benchmark', () => {
  it('captures a response for every benchmark prompt', () => {
    const results: CapturedResponse[] = [];
    for (const p of BENCHMARK_PROMPTS) {
      results.push(runPrompt(p.id, p.category, p.prompt, p.expectation));
    }

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, 'responses.json'), JSON.stringify(results, null, 2));

    const md = results.map((r) => [
      `## ${r.id} — ${r.category}`,
      `**Prompt:** ${r.prompt}`,
      `**Expectation:** ${r.expectation}`,
      `**Routing:** ${r.routedIntent} → ${r.routedPath}`,
      r.error ? `**ERROR:** ${r.error}` : `**Response:**\n\n${r.response}`,
      '---',
    ].join('\n\n')).join('\n\n');
    fs.writeFileSync(path.join(OUT_DIR, 'transcript.md'), `# Launch QA — Response Transcript\n\n${md}\n`);

    const errors = results.filter((r) => r.error);
    const unrouted = results.filter((r) => r.routedPath === 'unrouted');
    // eslint-disable-next-line no-console
    console.log(`[launch-qa] captured=${results.length} errors=${errors.length} unrouted=${unrouted.length}`);
    for (const e of errors) console.log(`[launch-qa]   ERROR ${e.id}: ${e.error}`);
    for (const u of unrouted) console.log(`[launch-qa]   UNROUTED ${u.id}: ${u.prompt}`);

    expect(results.length).toBe(BENCHMARK_PROMPTS.length);
  });
});
