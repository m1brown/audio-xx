/**
 * A3 Hybrid Advisor (WS31) — flag-gated, known-system advisory questions only.
 *
 * A guarded LLM-led advisor path that runs ONLY when a system is known and the
 * user asks a system-aware advisory question. It assembles role-grounded system
 * context + Audio XX doctrine, asks GPT (via /api/memo-overlay), validates the
 * draft (lightweight), revises once, and otherwise returns null so the caller
 * falls back to the existing engine. Default OFF.
 *
 * This is an experimental path. The deterministic engine remains the default
 * and the fallback. Nothing here touches shopping/discovery/cold-start/etc.
 */

import type { ActiveSystemContext } from './system-types';

// ── Feature flag (default OFF) ───────────────────────────
// Enabled by NEXT_PUBLIC_USE_A3_ADVISOR=true, or — for local testing without an
// env change — localStorage 'axx_a3'='1' or a ?a3=1 URL param.
export function a3Enabled(): boolean {
  if (process.env.NEXT_PUBLIC_USE_A3_ADVISOR === 'true') return true;
  if (typeof window !== 'undefined') {
    try {
      if (window.localStorage.getItem('axx_a3') === '1') return true;
      if (window.location.search.includes('a3=1')) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

// ── Activation: broad, biased toward activation (not narrow regex-only) ──
// The caller already requires a KNOWN SYSTEM. Given that, treat the message as
// advisory if it carries any advice/evaluation/upgrade/compatibility/change
// signal, OR is simply a question. Poor fits are caught by validation + fallback.
const ADVISORY_RE =
  /\b(upgrade|replace|improve|better|worse|good (match|fit|move|idea|choice|upgrade)|weak(est)?\s*(link|part|point)?|worth|should\s+i|would\s+(a|an|the|it|that|this)|what\s+(should|would|dac|amp|else|direction|to)|which|avoid|change|swap|switch|add|drop|remove|match|pair|compatib|trade[- ]?off|relaxed|engaging|warmer|brighter|leaner|smoother|detail|bass|move\s+away|make\s+sense|right\s+(move|choice|path)|first|next|bottleneck|limiting)\b/i;

export function a3IsAdvisoryQuestion(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  if (ADVISORY_RE.test(t)) return true;
  if (t.includes('?')) return true; // bias toward activation
  return false;
}

// ── Context assembly: explicit, role-grounded system prompt ──
function componentLabel(c: ActiveSystemContext['components'][number]): string {
  const n = c.name?.toLowerCase().startsWith((c.brand || '').toLowerCase())
    ? c.name
    : `${c.brand} ${c.name}`.trim();
  return n || c.name || c.brand;
}

function buildSystemPrompt(system: ActiveSystemContext): string {
  const roleLines = system.components
    .map((c) => `- ${componentLabel(c)} = ${c.role || c.category} (role is fixed; do not misread it).`)
    .join('\n');
  const character = system.tendencies ? `\nKnown system character: ${system.tendencies}.` : '';
  return `You are Audio XX, an experienced high-fidelity system advisor with a point of view.

The user OWNS this system. Component ROLES are fixed — never misread them:
${roleLines}${character}

Answer the user's decision question as flowing prose (no headers), in this order:
1) Observation — what the change/component touches in THIS chain.
2) Interpretation — what that means given the OTHER components (system synergy matters more than component reputation).
3) Expected gains AND expected losses (every change is a trade).
4) A provisional recommendation: promising / lateral / risky / unnecessary — and "keep what you have" when that is honest.
5) End with EXACTLY ONE natural follow-up question.

Hard rules:
- Answer FIRST. Never ask for a budget or run a questionnaire before advising.
- Do not invent specifications or measurements. If you lack verified knowledge of a named product, say so and reason from its general type.
- Do not recommend tweaks (cables, fuses, footers, power supplies) as the PRIMARY upgrade.
- No hype, no scores, no "best".
Keep it to ~140-190 words.`;
}

// ── LLM call (returns null on any failure → caller falls back) ──
async function callLLM(systemPrompt: string, userPrompt: string): Promise<string | null> {
  try {
    const r = await fetch('/api/memo-overlay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt, userPrompt }),
    });
    if (!r.ok) return null; // 503 (no key) etc. → fallback
    const j = await r.json();
    const c = (j?.content ?? '').trim();
    return c.length > 0 ? c : null;
  } catch {
    return null;
  }
}

// ── Lightweight validation (prefer simple, robust checks) ──
export function validateA3(answer: string, system: ActiveSystemContext): string[] {
  const t = answer.toLowerCase();
  const fails: string[] = [];

  const tokens = new Set<string>();
  for (const c of system.components) {
    for (const w of `${c.brand} ${c.name}`.toLowerCase().split(/[^a-z0-9]+/)) {
      if (w.length >= 3) tokens.add(w);
    }
  }
  if (![...tokens].some((tok) => t.includes(tok))) fails.push('system-not-referenced');

  if (!/(recommend|keep what you have|keep the|consider|promising|lateral|risky|unnecessary|worth|i'?d|i would|hold off|stay with|leave it)/i.test(answer)) {
    fails.push('no-recommendation');
  }

  const gain = /(gain|improve|more|increase|add|warmth|density|ease|detail|resolution|body|relaxed|smoother|richer|engaging|control|extension)/i.test(answer);
  const loss = /(lose|less|reduce|trade|cost|give up|sacrifice|expense|however|but |softer|slower|risk|forfeit|diminish|compromise)/i.test(answer);
  if (!(gain && loss)) fails.push('no-trade-off');

  const firstSentence = answer.split(/(?<=[.!?])\s/)[0] || answer;
  if (/budget|how much (are|do) you|price range/i.test(firstSentence)) fails.push('budget-first');

  if (/\b(two dacs|second dac|both dacs|dual dac)\b/i.test(answer)) fails.push('role-contradiction');

  if ((answer.match(/\?/g) || []).length > 1) fails.push('multiple-questions');

  return fails;
}

// ── Public entry: draft → validate → revise once → null(fallback) ──
export interface A3Result {
  answer: string;
  status: 'pass' | 'revised';
}

export async function runA3Advisor(opts: {
  question: string;
  activeSystem: ActiveSystemContext;
}): Promise<A3Result | null> {
  const systemPrompt = buildSystemPrompt(opts.activeSystem);

  let answer = await callLLM(systemPrompt, opts.question);
  if (!answer) return null; // LLM unavailable → fallback

  let fails = validateA3(answer, opts.activeSystem);
  if (fails.length === 0) return { answer, status: 'pass' };

  // Revise once, naming the failed checks.
  const revised = await callLLM(
    systemPrompt,
    `${opts.question}\n\n[Your previous draft failed these checks: ${fails.join(', ')}. Rewrite the answer fixing exactly those issues while keeping the required structure and answering first.]`,
  );
  if (!revised) return null;
  fails = validateA3(revised, opts.activeSystem);
  if (fails.length === 0) return { answer: revised, status: 'revised' };

  return null; // still failing → fallback to current engine
}
