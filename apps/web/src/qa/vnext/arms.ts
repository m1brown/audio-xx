/**
 * vNext Phase 0 — experimental arms.
 *
 * ARM A (naked): the same model, the same listener turns, ordinary model
 * knowledge. Its system prompt is REASONING_RULES with ONLY the
 * substrate-dependent lines removed, so the register and honesty rules are
 * identical and the sole difference between arms is the evidence block.
 *
 * ARM B (substrate): the same model reasons over the governed context the
 * lane assembles from the frozen evidence snapshot, then passes through
 * claim validation. Raw draft and validated answer are both retained so
 * substrate damage and validation damage stay distinguishable.
 *
 * A fallback or failure is an experimental OUTCOME (`failed`), never a
 * substitute answer.
 */
import {
  assembleGovernedContext, type ConversationTurn,
} from '@/lib/reasoning/context-assembly';
import { serializeGovernedContext, REASONING_RULES } from '@/lib/reasoning/governed-context';
import { validateClaims, type ClaimViolation } from '@/lib/reasoning/claim-validation';
import type { ExperimentSystem } from './frozen-evidence';

export const ARM_A_RULES = `You are Audio XX, a system-level hi-fi advisor.

RULES
- Reason about the listener's SYSTEM, never about a product in isolation.
- Distinguish clearly between established fact, supported inference, and unknown.
- Do not invent product facts. If you do not reliably know something — including the sonic character or specifications of a product — say plainly that it is unknown. General class-level reasoning (what tube designs or active speakers typically trade) is permitted AS reasoning.
- Conclusions must be reconstructible as facts → causes → conclusions. Inference is allowed; conclusions stronger than their premises are not.
- The listener's system remains their real system unless they explicitly change it. Hypothetical exploration never mutates it.
- Advisory register: calm, concrete, discriminating. "Change nothing" is always a legitimate recommendation. A few short paragraphs at most.`;

export type ValidationStatus = 'CHECKED' | 'REPAIRED' | 'INCOMPLETE';

/**
 * Phase 0.1 — quiet governance is the B DEFAULT (experimentally validated in
 * Phase 0: the round-1 judge repeatedly cited discipline narration as A's
 * edge; one register line flipped NATURALNESS to B). The discipline itself
 * is unchanged — only its visibility.
 */
export const QUIET_STYLE_RULE = `- STYLE: practice the evidence discipline SILENTLY. Never mention evidence classes, verification, documentation, provenance labels, or what the application holds, unless the listener explicitly asks about sourcing — or a limitation materially affects the judgment, in which case state it in plain adviser language ("I don't know how these behave at volume"), never by naming the discipline. Speak as one adviser who simply knows what he knows.`;

/**
 * Phase 0.1 — B2: bounded model knowledge. The smallest licence that lets
 * the model use its ordinary audio/product knowledge where the package is
 * incomplete, without letting that knowledge masquerade as verified fact.
 */
export const B2_KNOWLEDGE_RULE = `- MODEL KNOWLEDGE (this refines the "do not invent product facts" rule above): where the supplied evidence is silent or incomplete, you MAY draw on your own general knowledge of audio and of these products to serve the listener — as your own knowledge, never as established fact. Keep four kinds of ground distinct: (1) evidence supplied below, (2) what the listener has stated, (3) application-computed facts, (4) your own knowledge and inference. Kind 4 must never be presented as kinds 1–3. From your own knowledge you may reason, compare, and point at what is worth checking — but you may NOT assert exact numerical specifications, exact load ratings, measurements, exact feature availability on the listener's specific unit, exact-product sonic character as established observation, or attribute any claim to a publication or source. Where such a specific fact would help and the evidence does not hold it, say what is typical and how the listener can confirm it on their own unit ("worth checking whether yours has…"). Never imply the application verified something it did not.`;

export interface TurnResult {
  arm: 'A' | 'B';
  /** Substrate variant for arm B: 'B1' governed-evidence-only (default),
   *  'B2' governed + bounded model knowledge. */
  variant?: 'B1' | 'B2';
  model: string;
  turnIndex: number;
  question: string;
  /** Final text the listener would see (validated, for B). */
  text: string;
  /** Raw model draft before validation (B only; equals text for A). */
  rawDraft: string;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  finishReason?: string;
  failed?: string;
  /** B only. */
  validation?: {
    status: ValidationStatus;
    violations: ClaimViolation[];
    repaired: number;
    validatorLatencyMs: number;
  };
  contextChars?: number;
  hypothetical?: { candidate: string; incumbent: string } | null;
}

export interface ModelCallOptions {
  apiKey: string;
  maxCompletionTokens?: number;
  timeoutMs?: number;
  /** Arm-B substrate variant (default 'B1'). */
  variant?: 'B1' | 'B2';
}

export async function callOpenAI(
  model: string,
  messages: Array<{ role: string; content: string }>,
  opts: ModelCallOptions,
): Promise<{ content: string; latencyMs: number; promptTokens?: number; completionTokens?: number; finishReason?: string; error?: string }> {
  const t0 = Date.now();
  const maxTokens = opts.maxCompletionTokens ?? 4096;
  const body: Record<string, unknown> = { model, messages };
  if (/^gpt-4/.test(model)) body.max_tokens = maxTokens;
  else body.max_completion_tokens = maxTokens;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 120000);
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!r.ok) {
      return { content: '', latencyMs: Date.now() - t0, error: `${r.status}: ${(await r.text()).slice(0, 200)}` };
    }
    const j = await r.json() as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      content: j.choices?.[0]?.message?.content ?? '',
      latencyMs: Date.now() - t0,
      promptTokens: j.usage?.prompt_tokens,
      completionTokens: j.usage?.completion_tokens,
      finishReason: j.choices?.[0]?.finish_reason,
    };
  } catch (err) {
    return { content: '', latencyMs: Date.now() - t0, error: String(err).slice(0, 200) };
  }
}

export interface ArmState {
  history: ConversationTurn[];
  observations: string[];
  hypothetical: { candidate: string; incumbent: string } | null;
}

export function newArmState(): ArmState {
  return { history: [], observations: [], hypothetical: null };
}

/** Run one turn of one arm; appends to the arm's own history. */
export async function runArmTurn(
  arm: 'A' | 'B',
  system: ExperimentSystem,
  state: ArmState,
  turnIndex: number,
  question: string,
  isObservation: boolean,
  model: string,
  opts: ModelCallOptions,
): Promise<TurnResult> {
  const base: TurnResult = {
    arm, model, turnIndex, question, text: '', rawDraft: '', latencyMs: 0,
  };

  let systemPrompt = ARM_A_RULES;
  if (arm === 'B') {
    if (isObservation) state.observations.push(question);
    const ctx = await assembleGovernedContext({
      activeSystem: { components: system.components, source: 'stated' },
      currentHypothetical: state.hypothetical,
      question,
      recentTurns: state.history,
      userObservations: state.observations,
    });
    state.hypothetical = ctx.currentHypothetical;
    base.hypothetical = ctx.currentHypothetical;
    const block = serializeGovernedContext(ctx);
    base.contextChars = block.length;
    base.variant = opts.variant ?? 'B1';
    // Quiet governance is the Phase-0.1 default; QA_VNEXT_B_STYLE=loud
    // reproduces the Phase-0 round-1 register for reference runs.
    const styleRule = process.env.QA_VNEXT_B_STYLE === 'loud' ? '' : `\n${QUIET_STYLE_RULE}`;
    const knowledgeRule = base.variant === 'B2' ? `\n${B2_KNOWLEDGE_RULE}` : '';
    systemPrompt = `${REASONING_RULES}${styleRule}${knowledgeRule}\n\n=== APPLICATION CONTEXT FOR THIS TURN ===\n${block}`;
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...state.history.map((t) => ({ role: t.role, content: t.content })),
    { role: 'user', content: question },
  ];
  const r = await callOpenAI(model, messages, opts);
  base.latencyMs = r.latencyMs;
  base.promptTokens = r.promptTokens;
  base.completionTokens = r.completionTokens;
  base.finishReason = r.finishReason;
  if (r.error || !r.content) {
    base.failed = r.error ?? 'empty completion';
    // A failed turn still advances history with a marker, so later turns are
    // not silently answered against a hole in the conversation.
    state.history.push({ role: 'user', content: question });
    state.history.push({ role: 'assistant', content: '[no answer was produced this turn]' });
    return base;
  }
  base.rawDraft = r.content;
  base.text = r.content;

  if (arm === 'B') {
    const vt0 = Date.now();
    const ctxBlock = systemPrompt.split('=== APPLICATION CONTEXT FOR THIS TURN ===\n')[1] ?? '';
    const v = await validateClaims({
      answer: r.content,
      contextBlock: ctxBlock,
      conversationText: [...state.history.map((t) => t.content), question].join('\n'),
      apiKey: opts.apiKey,
      timeoutMs: 30000,
    });
    const unrepaired = v.violations.length - v.repaired;
    base.validation = {
      status: v.unchecked || unrepaired > 0
        ? 'INCOMPLETE'
        : v.repaired > 0 ? 'REPAIRED' : 'CHECKED',
      violations: v.violations,
      repaired: v.repaired,
      validatorLatencyMs: Date.now() - vt0,
    };
    base.text = v.answer;
  }

  state.history.push({ role: 'user', content: question });
  state.history.push({ role: 'assistant', content: base.text });
  return base;
}
