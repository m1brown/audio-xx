/**
 * Deterministic trust enforcement — production publication gate
 * (M1 quality correction, 2026-09-16; independent review finding F).
 *
 * Phase 0.1's zero-fabrication B2 verdict rested partly on DETERMINISTIC
 * instruments (unlicensed watt/load pairings, stray figures) that lived
 * only in the QA kit — production trust rested on one stochastic semantic
 * adjudication, which adversarial probes showed passing a hedged invented
 * watt-load claim and a measurement-voice claim 3 runs out of 3. This
 * module ports those guarantees to the publication path as ENFORCEMENT:
 * a violation here is not advisory input to the semantic checker — the
 * route refuses to publish while one stands.
 *
 * SCOPE DISCIPLINE: this layer protects externally verifiable FACT only —
 * figures, load pairings, and evidence-voiced claims. It never judges
 * whether a component sounds good, whether advice is wise, or how strong
 * a recommendation may be. Prose style is irrelevant by construction: a
 * hedge ("could deliver 90 watts into 4 ohms") does not alter what the
 * regexes see. The boundary is epistemic, not grammatical.
 *
 * Licensed sources for figures: the serialized governed context (which
 * already embeds evidence, computed facts and listener observations) plus
 * the raw conversation (the listener's own numbers are theirs to state).
 */

export interface DeterministicTrustResult {
  /** "N watts into/at/@/(… M ohms" pairings with no licensed source. */
  unlicensedWattLoad: string[];
  /** Quantitative figures in the answer with no licensed source. Numbers
   *  inside model designators (CS-600, H190, EX-M1) are identifiers, not
   *  quantitative claims, and are excluded — blocking them would block the
   *  bounded-knowledge candidate naming the B2 licence exists to permit. */
  strayFigures: string[];
  /** Evidence-voiced sentences ("measurements show…", "reviewers
   *  describe…", "the maker states…") about a product whose package
   *  section holds no evidence of the voiced kind. */
  unlicensedEvidenceVoice: string[];
  clean: boolean;
}

/** Watt/load pairing extractor — mirrors the Phase-0.1 QA instrument
 *  (qa/vnext/judge.ts wattLoadPairs) including the parenthesized-load
 *  connective; kept as a separate production copy so the frozen QA kit
 *  stays byte-identical. */
export function wattLoadPairs(text: string): Array<{ w: string; ohms: string; span: string }> {
  const out: Array<{ w: string; ohms: string; span: string }> = [];
  const re = /(\d+(?:\.\d+)?)\s*(?:W|watts?)\b[^.;\n]{0,40}?(?:\b(?:into|at)\s+|[@/(]\s*)(?:the\s+)?(\d+(?:\.\d+)?)(?:\s*|-)(?:ohms?|Ω)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push({ w: m[1], ohms: m[2], span: m[0] });
  return out;
}

/** Unit suffixes that make a digit-bearing token a QUANTITY (checked)
 *  rather than a model designator (excluded). */
const UNIT_SUFFIX = /^(?:w|watts?|db|hz|khz|ohms?|Ω|v|mv|ma|a|m|cm|mm|ft|feet|kg|lbs?|%|x)$/i;

/**
 * Quantitative figures claimed by the text. A token containing digits is:
 *   - a pure number ("90", "86.5", "1,000")  → quantitative;
 *   - number+unit ("45W", "86dB", "8ohm")    → quantitative (numeric part);
 *   - anything else mixing letters/hyphens ("CS-600", "H190", "ES9038Q2M",
 *     "LRS+") → an identifier, excluded.
 * Single digits are ignored (list numbering, "one of 3 options").
 */
export function quantitativeFigures(text: string): string[] {
  const out = new Set<string>();
  // Commas are not token separators — "1,450" is one number; trailing
  // punctuation (including a clause comma) is stripped per token instead.
  for (const rawTok of text.split(/[\s;:()[\]{}"']+/)) {
    const tok = rawTok.replace(/[.,!?;:]+$/, '');
    if (!/\d/.test(tok)) continue;
    const pure = tok.replace(/,/g, '');
    if (/^\$?\d+(?:\.\d+)?$/.test(pure)) {
      const n = pure.replace(/^\$/, '');
      if (n.replace(/\D/g, '').length > 1) out.add(n);
      continue;
    }
    const um = /^(\d+(?:\.\d+)?)([A-Za-zΩ%]+)$/.exec(pure);
    if (um && UNIT_SUFFIX.test(um[2])) {
      if (um[1].replace(/\D/g, '').length > 1) out.add(um[1]);
    }
    // else: mixed identifier token — excluded by design.
  }
  return [...out];
}

/** Liberal number harvest from LICENSED sources — any digit run counts,
 *  so "JOB 225" licenses 225 and "30 W/ch (8 ohms)" licenses 30 and 8. */
function sourceNumbers(texts: string[]): Set<string> {
  const s = new Set<string>();
  for (const t of texts) {
    for (const m of t.match(/\d[\d,]*(?:\.\d+)?/g) ?? []) s.add(m.replace(/,/g, ''));
  }
  return s;
}

/** Evidence-voice markers, each with the evidence classes that license it
 *  (matched against the product's own section of the context block). */
const VOICE_MARKERS: Array<{ re: RegExp; need: RegExp; label: string }> = [
  {
    re: /\b(?:measurements?|bench\s+tests?|lab\s+tests?)\s+(?:show(?:s|ed)?|confirm(?:s|ed)?|reveal(?:s|ed)?|indicate[sd]?|found|demonstrate[sd]?)\b/i,
    need: /\[(?:INDEPENDENT LISTENING|APPLICATION-COMPUTED)|measurement/i,
    label: 'measurement voice',
  },
  {
    re: /\breviewers?\s+(?:describe[sd]?|praise[sd]?|note[sd]?|found|report(?:ed)?|say|said|call(?:ed)?)\b|\breviews?\s+(?:describe|found|praise|report)\b/i,
    need: /\[(?:INDEPENDENT LISTENING|THIRD-PARTY-REPORTED)/i,
    label: 'reviewer voice',
  },
  {
    re: /\b(?:the\s+)?(?:maker|manufacturer)\s+(?:states?|stated|specifie[sd]|claims?|claimed|rates?|rated|publishe[sd])\b/i,
    need: /\[MAKER-PUBLISHED/i,
    label: 'maker voice',
  },
];

/** Product names the package actually covers: the `## …: Name` headers. */
function packageProducts(contextBlock: string): Array<{ name: string; section: string }> {
  const out: Array<{ name: string; section: string }> = [];
  const parts = contextBlock.split(/\n## /).slice(1);
  for (const p of parts) {
    const header = p.split('\n')[0] ?? '';
    const name = (header.split(': ')[1] ?? '').split(' — ')[0].trim();
    if (name) out.push({ name, section: p });
  }
  return out;
}

/** Product-ish name spans (brand + model-ish token) — same shape the
 *  semantic pre-flags use; here only to decide whether an evidence-voiced
 *  sentence is about a PRODUCT (checked) or class-level (left alone). */
const NAME_RE = /\b([A-Z][A-Za-z0-9&.-]+\s+(?:[A-Z]?[A-Za-z0-9/+.-]*\d[A-Za-z0-9/+.-]*|[A-Z][A-Za-z0-9.-]+))\b/g;

function evidenceVoiceViolations(answer: string, contextBlock: string): string[] {
  const products = packageProducts(contextBlock);
  const out: string[] = [];
  for (const sentence of answer.split(/(?<=[.!?])\s+|\n/)) {
    for (const v of VOICE_MARKERS) {
      if (!v.re.test(sentence)) continue;
      // Which products is the sentence about?
      const inPackage = products.filter((p) => sentence.toLowerCase().includes(p.name.toLowerCase()));
      const namedSpans = [...sentence.matchAll(NAME_RE)].map((m) => m[1]);
      const offPackage = namedSpans.filter((n) =>
        !products.some((p) => p.name.toLowerCase().includes(n.toLowerCase()) || n.toLowerCase().includes(p.name.toLowerCase())));
      if (inPackage.length === 0 && offPackage.length === 0) continue; // class-level statement — not this layer's business
      const licensed = inPackage.some((p) => v.need.test(p.section));
      if (!licensed) out.push(`${v.label}: ${sentence.trim().slice(0, 200)}`);
      break; // one report per sentence
    }
  }
  return out;
}

/**
 * The publication gate. `answer` is the FINAL candidate text (post-repair).
 * A non-clean result must not publish — the route enforces this; nothing
 * here is advisory.
 */
export function deterministicTrustCheck(
  answer: string,
  contextBlock: string,
  conversationText: string,
): DeterministicTrustResult {
  const sources = [contextBlock, conversationText];

  const licensedPairs = new Set(
    sources.flatMap((s) => wattLoadPairs(s)).map((p) => `${p.w}@${p.ohms}`),
  );
  const unlicensedWattLoad = wattLoadPairs(answer)
    .filter((p) => !licensedPairs.has(`${p.w}@${p.ohms}`))
    .map((p) => p.span);

  const licensedNumbers = sourceNumbers(sources);
  const strayFigures = quantitativeFigures(answer).filter((n) => !licensedNumbers.has(n));

  const unlicensedEvidenceVoice = evidenceVoiceViolations(answer, contextBlock);

  return {
    unlicensedWattLoad,
    strayFigures,
    unlicensedEvidenceVoice,
    clean: unlicensedWattLoad.length === 0 && strayFigures.length === 0 && unlicensedEvidenceVoice.length === 0,
  };
}
