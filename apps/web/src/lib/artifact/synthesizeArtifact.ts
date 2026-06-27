/**
 * Audio XX — Milestone 2: presentation-layer payload synthesizer.
 *
 * Maps EXISTING engine output (buildSystemAssessment result) into the editorial
 * artifact payload. This is a thin presentation adapter:
 *   - it does NOT change the diagnosis, the recommendation, the ontology, or
 *     any engine field;
 *   - the recommendation it renders always mirrors the engine's leverage
 *     (bottleneck role / upgrade path) — if the engine says amplifier, the
 *     artifact says amplifier; if the engine recommends no change, it says
 *     "Leave it alone.";
 *   - where the engine output is internally contradictory it records the
 *     contradiction rather than smoothing it over.
 *
 * Each slot is tagged DIRECT (engine value used verbatim) or DERIVED
 * (templated wording wrapped around engine facts) for the build report.
 */
import type { ArtifactPayload } from './types';

const PLACEHOLDER_FIGURE = '/artifact/plate.svg';

export interface SynthResult {
  payload: ArtifactPayload;
  /** Engine-output contradictions surfaced rather than smoothed. */
  contradictions: string[];
}

// ── small helpers ────────────────────────────────────────────────────────
function splitSentences(s: string): string[] {
  return (s || '').split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
}
function lowerFirst(s: string): string {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}
function stripTrailingPeriod(s: string): string {
  return s.replace(/\.\s*$/, '');
}
function editionFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return 'No. ' + String((h % 900) + 100);
}
function today(): string {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Extract the engine's stated clean-SPL ceiling from a power-match explanation. */
function extractSplDatum(explanation: string): { value: string; caption: string } | null {
  const m = explanation.match(/max clean SPL is\s*~?\s*(\d{2,3})\s*dB/i)
    || explanation.match(/~?\s*(\d{2,3})\s*dB[^.]*clean/i);
  if (!m) return null;
  return { value: `≈ ${m[1]} dB`, caption: 'the most this pairing plays cleanly' };
}

/** Pull one sharp clause from the constraint explanation for the margin quote. */
function extractPullQuote(explanation: string): string | undefined {
  const sents = splitSentences(explanation);
  const hit = sents.find((s) => /headroom|run out|compress|lose|bass control will suffer/i.test(s));
  if (!hit) return undefined;
  return stripTrailingPeriod(hit.replace(/^[A-Z][^,]*,\s*/, (m) => m)); // keep as-is, trimmed
}

function roleNoun(role: string | undefined): string {
  const r = (role || '').toLowerCase();
  if (r.includes('amp')) return 'amplifier';
  if (r.includes('dac') || r.includes('source')) return 'DAC';
  if (r.includes('speak')) return 'speakers';
  if (r.includes('stream')) return 'streamer';
  return role || 'system';
}

// ── the synthesizer ────────────────────────────────────────────────────────
export function synthesizeArtifact(result: any): SynthResult {
  const contradictions: string[] = [];
  const f = result?.findings ?? {};
  const resp = result?.response ?? {};

  const chain = f.systemChain ?? {};
  const names: string[] = chain.names ?? [];
  const full: string[] = chain.fullChain ?? [];

  // ── component credit (DIRECT: the engine's catalog display names) ──
  // Prefer the resolved catalog names (the source of truth). Detect GENUINE
  // corruption — a name carrying a *different* component's brand token that
  // isn't in this slot's own input text (e.g. the DAC rendered "Decware Holo
  // may"). Benign normalization differences (e.g. "Holo Audio May (KTE)" vs the
  // typed "Holo May (KTE)") are NOT flagged. Only on real corruption do we fall
  // back to the user's text for that slot.
  const firstToken = (s: string): string => (s || '').toLowerCase().match(/[a-z0-9]+/)?.[0] ?? '';
  const brandTokens = full.map(firstToken);
  const credit: string[] = (names.length ? names : full).map((nm, i) => {
    const lc = (nm || '').toLowerCase();
    const ownInput = (full[i] ?? '').toLowerCase();
    const foreign = brandTokens.find(
      (t, j) => j !== i && t.length >= 3 && lc.includes(t) && !ownInput.includes(t),
    );
    if (foreign) {
      contradictions.push(
        `Component name corrupted in engine output: names[${i}]="${nm}" carries a foreign brand token ("${foreign}"); rendered from input "${full[i] ?? nm}".`,
      );
      return full[i] || nm;
    }
    return nm || full[i] || '';
  });

  const bottleneck = f.bottleneck ?? null;
  const path0 = (resp.upgradePaths ?? [])[0] ?? null;
  const constraintExpl: string = resp.primaryConstraint?.explanation ?? '';
  const signature: string = resp.systemSignature ?? '';
  const category: string = bottleneck?.category ?? '';
  const role = roleNoun(bottleneck?.role);

  // ── structural contradictions ──
  if (bottleneck && !path0) {
    contradictions.push('Engine reports a bottleneck but no upgrade path — cannot render a recommendation cleanly.');
  }
  if (!bottleneck && path0 && /highest/i.test(path0.impact ?? '')) {
    contradictions.push('Engine reports no bottleneck but a Highest-Impact upgrade path exists.');
  }

  // ── DERIVED: verdict (mirrors engine leverage; templated by category/state) ──
  let verdict: string;
  let standfirst: string | undefined;
  if (bottleneck) {
    if (category === 'power_match') {
      verdict = role === 'speakers'
        ? 'These speakers need more power than the system gives them.'
        : "The amplifier can't drive these speakers.";
      standfirst = 'The match is the problem — not the taste.';
    } else if (category === 'dac_limitation') {
      verdict = 'The DAC is holding the system back.';
      standfirst = `Everything downstream inherits its limits.`;
    } else if (category === 'speaker_scale') {
      verdict = 'The speakers set the ceiling here.';
      standfirst = 'They cap what the rest of the system can show.';
    } else {
      verdict = `The ${role} is steering the whole system.`;
      standfirst = signature ? lowerFirst(stripTrailingPeriod(signature)) + '.' : undefined;
    }
  } else {
    // No bottleneck → restraint.
    verdict = 'A system that already knows what it is.';
    standfirst = signature
      ? `${stripTrailingPeriod(signature)} — and nothing here needs changing.`
      : 'Nothing here needs changing.';
  }

  // ── DERIVED: recognition (chain names + engine signature) ──
  const recognition = credit.length
    ? `${credit.join(' into ')}${signature ? ` — ${lowerFirst(stripTrailingPeriod(signature))}.` : '.'}`
    : (signature || 'A system worth assessing.');

  // ── case paragraphs ──
  const caseParagraphs: string[] = [];
  if (bottleneck && constraintExpl) {
    // DIRECT: the engine's physics explanation, split into beats.
    const sents = splitSentences(constraintExpl);
    if (sents.length) caseParagraphs.push(sents.slice(0, 2).join(' '));
    if (sents.length > 2) caseParagraphs.push(sents.slice(2).join(' '));
  } else {
    // Restraint: strengths (DIRECT) + a justified "no weak link" beat + close.
    const strengths: string[] = resp.assessmentStrengths ?? [];
    if (strengths.length) caseParagraphs.push(stripTrailingPeriod(strengths.slice(0, 2).join('; ')) + '.');
    if (!bottleneck) caseParagraphs.push('There is no weak link holding the others back.');
    caseParagraphs.push('It is balanced.');
  }
  if (!caseParagraphs.length && signature) caseParagraphs.push(signature);

  // ── hero datum (DERIVED via regex on engine explanation; fragile) ──
  let heroDatum: ArtifactPayload['heroDatum'] | undefined;
  if (category === 'power_match') {
    const d = extractSplDatum(constraintExpl);
    if (d) heroDatum = d;
    else contradictions.push('Power-match constraint present but no clean-SPL figure could be extracted from the explanation (derivation fragile).');
  }

  // ── pull quote (DERIVED; optional; omitted if not confidently extractable) ──
  const pullQuote = bottleneck ? extractPullQuote(constraintExpl) : undefined;

  // ── recommendation (mirrors engine leverage) ──
  let recommendation: string;
  let figure: ArtifactPayload['figure'] | undefined;
  if (path0) {
    if (category === 'power_match') {
      recommendation = 'I’d resolve the power mismatch first — more amplifier power, or easier-to-drive speakers.';
    } else {
      recommendation = `I’d start with the ${role}.`;
    }
    const opt = (path0.options ?? [])[0];
    if (opt) {
      // figure PRESENCE is engine-driven; image SOURCE stays local (no CDN hotlink).
      figure = {
        src: PLACEHOLDER_FIGURE,
        alt: 'The recommended direction',
        caption: `${[opt.brand, opt.name].filter(Boolean).join(' ')} — image to follow`,
      };
    }
  } else {
    recommendation = 'Leave it alone.';
  }

  // ── cost ──
  let cost: string | undefined;
  if (bottleneck) {
    cost = category === 'power_match'
      ? 'Either fix nudges the system’s character — pick the side whose sound you’d rather keep.'
      : 'Any change here trades something; weigh it against what is already working.';
  } else {
    cost = 'If you ever want more, name the quality you’re chasing — but today, nothing needs fixing.';
  }

  const seed = credit.join('|') + '|' + (bottleneck ? category : 'keep');
  const payload: ArtifactPayload = {
    verdict,
    standfirst,
    componentCredit: credit,
    recognition,
    caseParagraphs,
    heroDatum,
    pullQuote,
    recommendation,
    figure,
    cost,
    date: today(),
    edition: editionFor(seed),
  };

  return { payload, contradictions };
}
