/**
 * Narrow D-7 claim validation (Substrate Doctrine, build item 3).
 *
 * Sized by the B++ residual audit (2026-08-31), not the original B failure
 * distribution: with candidate-aware retrieval and computed facts in place,
 * the model stopped inventing product character almost entirely (3/34 turns,
 * from ~8) and mutated no figures (0, from 1). The dominant residual is
 * CONDITION-DROPPING — a licensed, conditioned observation ("slightly darker
 * balance, fitted with Takatsuki 300Bs, driving an LTA preamp") restated as
 * unconditioned product character.
 *
 * The validator therefore answers exactly one question per claim:
 *   "Does this externally checkable, product-specific claim have a licensed
 *    basis of sufficient strength — and does it keep that basis's own
 *    conditions?"
 *
 * It does NOT judge audio wisdom, does NOT alter recommendations or
 * structure, and every repair must WEAKEN, never strengthen. D-8's
 * distinction is preserved: inference from licensed premises is legitimate;
 * only conclusions stronger than their premises are repaired.
 *
 * Two layers:
 *   1. model check — finds violations and proposes weakened rewrites under a
 *      contract that only permits weakening;
 *   2. deterministic number guard — every figure in the final text must
 *      already exist in the evidence, the computed facts, the conversation,
 *      or the draft it repaired. A "validator" that introduces a new number
 *      has itself violated the boundary, and the guard rejects its rewrite.
 */

export interface ValidationInput {
  answer: string;
  /** The serialized governed context the model reasoned over. */
  contextBlock: string;
  /** Recent conversation, for numbers the listener themselves supplied. */
  conversationText?: string;
  apiKey: string;
  model?: string;
  timeoutMs?: number;
}

export interface ClaimViolation {
  type: 'unsupported_character' | 'condition_dropped' | 'mutated_spec'
    | 'provenance_strengthened' | 'unsupported_attribution';
  sentence: string;
  rewrite: string | null;
}

export interface ValidationResult {
  answer: string;
  violations: ClaimViolation[];
  repaired: number;
  /** True when validation itself failed and the draft passed through as-is —
   *  callers can surface degraded assurance rather than silently trusting. */
  unchecked: boolean;
}

const VALIDATOR_CONTRACT = `You are an evidence-licensing checker for an audio advisor. You are NOT an advisor: never judge whether advice is good, never change recommendations, structure, or reasoning.

Given the LICENSED EVIDENCE PACKAGE and a DRAFT ANSWER, list every sentence in the draft that makes an externally checkable, product-specific claim WITHOUT a sufficient licensed basis. Exactly these violation types:

- unsupported_character: sonic/character description attributed to a NAMED product with no matching evidence item. (Class-level reasoning — "tube designs typically…", "if it follows this trend…" — is legitimate inference, not a violation.)
- condition_dropped: an evidence item carries a condition or a relative frame ("under these tubes", "versus its predecessor", "at a show, in an unfamiliar room") and the draft restates the claim without it as plain product character.
- mutated_spec: a figure in the draft differs from the evidence it echoes.
- provenance_strengthened: reported/maker-claim/family evidence restated as established/independent/exact.
- unsupported_attribution: the draft attributes a claim to a publication or source the package does not show.

For each violation output a JSON object {"type", "sentence", "rewrite"}. The rewrite must be the SAME sentence weakened just enough to be licensed — attach the condition, restore the relative frame, hedge to class-level, or state that the application holds nothing — and must never add facts, figures, or strength. Use rewrite null only when no weakening can save the sentence (it should be removed).

PRECISION RULES (added after live false-positive review):
- A sentence that itself STATES the absence or limits of evidence ("no independent evidence is held for X's bass behaviour") is never a violation — it is the discipline working.
- A claim with a matching evidence item of the same strength is licensed AS WRITTEN: do not hedge it further, and do not soften "praised for" into "noted for" when the package holds the praise.
- Only flag what genuinely exceeds the package.

Output ONLY a JSON array (possibly empty). No commentary.`;

/**
 * Deterministic pre-flags — scaffolding that sharpens the checker's recall
 * without widening its authority. Both are computed, not judged:
 *   1. product-ish names in the draft with no occurrence in the evidence
 *      package (any character claim about them cannot be licensed);
 *   2. evidence items that carry conditions, listed so an unconditioned
 *      restatement is checkable line-by-line.
 */
function preFlags(answer: string, contextBlock: string): string {
  const ctxLower = contextBlock.toLowerCase();
  const names = new Set<string>();
  const re = /\b([A-Z][A-Za-z0-9&.-]+\s+(?:[A-Z]?[A-Za-z0-9/+.-]*\d[A-Za-z0-9/+.-]*|[A-Z][A-Za-z0-9.-]+))\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(answer)) !== null) {
    const n = m[1];
    if (!ctxLower.includes(n.toLowerCase())) names.add(n);
  }
  const conditioned = (contextBlock.match(/^- \[INDEPENDENT LISTENING[^\n]*; condition: [^\n]+$/gm) ?? [])
    .slice(0, 20);
  const parts: string[] = [];
  /*
   * FIGURES REQUIRING ADJUDICATION — deterministic mutated-spec net. Any
   * number in the draft that appears nowhere in the evidence package is
   * either the model's arithmetic (fine when reconstructible) or a mutated
   * figure; the checker must adjudicate each explicitly. This closed the
   * one recall gap the checker-model gate found (a shifted sensitivity
   * figure slipping through one run in three).
   */
  const ctxNums = new Set((contextBlock.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/[,.]+$/, '')));
  const strayNums = [...new Set((answer.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/[,.]+$/, '')))]
    .filter((n) => !ctxNums.has(n) && n.length > 1);
  if (strayNums.length) {
    parts.push('FIGURES IN THE DRAFT WITH NO SOURCE IN THE PACKAGE (each must be adjudicated: licensed arithmetic from package figures, or a mutated_spec violation): '
      + strayNums.slice(0, 12).join('; '));
  }
  if (names.size) {
    parts.push('NAMED PRODUCTS WITH NO EVIDENCE IN THE PACKAGE (any product-specific character claim about these is a violation): '
      + [...names].slice(0, 12).join('; '));
    // Forced adjudication: sentences pairing a no-evidence name with
    // character vocabulary must each receive an explicit verdict — this is
    // what holds the checker's recall steady on list-style answers.
    const CHAR = /(warm|dark|organic|rich|lush|sweet|musical|engaging|involving|smooth|refined|transparent|neutral|clean|uncolou?red|detailed|resolv|airy|punchy|dynamic|tight|controlled|harmonic|purity|pace|rhythm)/i;
    const mustReview = answer.split(/(?<=[.!?])\s+|\n/)
      .filter((sent) => CHAR.test(sent) && [...names].some((n) => sent.toLowerCase().includes(n.toLowerCase())))
      .slice(0, 10);
    if (mustReview.length) {
      parts.push('SENTENCES REQUIRING EXPLICIT ADJUDICATION (each pairs a no-evidence product with character vocabulary; emit a violation for each unless it is genuinely class-level reasoning):\n'
        + mustReview.map((x) => `• ${x.trim().slice(0, 220)}`).join('\n'));
    }
  }
  if (conditioned.length) {
    parts.push('CONDITIONED EVIDENCE ITEMS (a restatement of any of these without its condition or relative frame is condition_dropped):\n'
      + conditioned.join('\n'));
  }
  return parts.join('\n\n');
}

/** Digits guard: figures allowed in the final text. */
function numberSet(text: string): Set<string> {
  return new Set((text.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/[,.]+$/, '')));
}

export async function validateClaims(input: ValidationInput): Promise<ValidationResult> {
  const { answer, contextBlock } = input;
  const timeoutMs = input.timeoutMs ?? 20000;
  let violations: ClaimViolation[] = [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${input.apiKey}` },
      body: JSON.stringify({
        model: input.model ?? 'gpt-4o',
        temperature: 0,
        messages: [
          { role: 'system', content: VALIDATOR_CONTRACT },
          { role: 'user', content: `LICENSED EVIDENCE PACKAGE:\n${contextBlock}\n\n${preFlags(answer, contextBlock)}\n\nDRAFT ANSWER:\n${answer}` },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!r.ok) return { answer, violations: [], repaired: 0, unchecked: true };
    const j = await r.json();
    const raw: string = j?.choices?.[0]?.message?.content ?? '[]';
    const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ''));
    if (Array.isArray(parsed)) {
      violations = parsed.filter((v): v is ClaimViolation =>
        v && typeof v.sentence === 'string'
        && ['unsupported_character', 'condition_dropped', 'mutated_spec', 'provenance_strengthened', 'unsupported_attribution'].includes(v.type)
        && (v.rewrite === null || typeof v.rewrite === 'string'));
    }
  } catch {
    return { answer, violations: [], repaired: 0, unchecked: true };
  }

  if (violations.length === 0) return { answer, violations, repaired: 0, unchecked: false };
  const { text, repaired } = applyClaimRepairs(answer, violations, [contextBlock, input.conversationText ?? '']);
  return { answer: text, violations, repaired, unchecked: false };
}

/**
 * Pure repair application — exported for deterministic regression pins.
 * Replace or remove, verbatim-matched (with markdown-emphasis tolerance).
 * A violation whose sentence cannot be located is reported but not
 * repaired — the validator never rewrites what it cannot point at. A
 * rewrite that introduces a figure not present in any allowed source is
 * refused: a validator that adds numbers has itself crossed the boundary.
 */
export function applyClaimRepairs(
  answer: string,
  violations: ClaimViolation[],
  allowedNumberSources: string[],
): { text: string; repaired: number } {
  const allowedNumbers = new Set([
    ...allowedNumberSources.flatMap((t) => [...numberSet(t)]),
    ...numberSet(answer),
  ]);
  let out = answer;
  let repaired = 0;
  /*
   * Markdown-emphasis tolerance: the checker reads sentences through the
   * formatting ("**Hegel H20**: Known for…" reported without asterisks), so
   * a verbatim match can fail on emphasis alone. When it does, matching and
   * replacement both run on an emphasis-stripped view — losing bold in a
   * repaired sentence is an acceptable cost of the repair.
   */
  const stripEm = (x: string) => x.replace(/\*\*/g, '');
  for (const v of violations) {
    if (!out.includes(v.sentence)) {
      const stripped = stripEm(out);
      if (stripped.includes(stripEm(v.sentence))) {
        const before = stripped;
        const replacedStripped = v.rewrite === null
          ? before.replace(stripEm(v.sentence), '').replace(/ {2,}/g, ' ')
          : before.replace(stripEm(v.sentence), stripEm(v.rewrite));
        if (v.rewrite !== null) {
          const newNumbers = [...numberSet(v.rewrite)].filter((n) => !allowedNumbers.has(n));
          if (newNumbers.length > 0) continue;
        }
        out = replacedStripped;
        repaired++;
      }
      continue;
    }
    if (v.rewrite === null) {
      out = out.replace(v.sentence, '').replace(/ {2,}/g, ' ');
      repaired++;
      continue;
    }
    // Weakening-only guard: the rewrite may not introduce figures from
    // nowhere. (It may repeat figures already licensed or already present.)
    const newNumbers = [...numberSet(v.rewrite)].filter((n) => !allowedNumbers.has(n));
    if (newNumbers.length > 0) continue;
    out = out.replace(v.sentence, v.rewrite);
    repaired++;
  }
  return { text: out, repaired };
}
