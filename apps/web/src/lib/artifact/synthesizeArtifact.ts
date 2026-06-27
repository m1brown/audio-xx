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
 * ─────────────────────────────────────────────────────────────────────────────
 * Editorial rule set (frozen; enforced, not aspirational).
 *
 *   R1  Recognition must not duplicate the standfirst.
 *   R2  Recognition must describe the system's apparent INTENT, not restate
 *       its tonal signature.
 *   R3  The BOTTLENECK case must move from MECHANISM (what is happening) to
 *       HEARD CONSEQUENCE (what the user actually perceives). The restraint
 *       (no-change) path is governed by R8, not R3.
 *   R4  The case must not repeat the hero datum if the datum is already
 *       shown in the evidence rail.
 *   R5  The case must not preview the recommendation before the
 *       recommendation line.
 *   R6  The recommendation must introduce no new diagnosis — it acts only
 *       on the role the engine identified.
 *   R7  The cost line must name the specific trade-off implied by the
 *       recommendation.
 *   R8  The restraint path must demonstrate EQUILIBRIUM rather than repeat
 *       "balanced," "no weak link," or "nothing needs changing."
 *
 * Every slot is built by a rule, and every output is post-conditioned against
 * the rule that produced it. A failed post-condition becomes a contradiction
 * (surfaced, not smoothed) so the seam can be fixed at source.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { ArtifactPayload } from './types';

export interface SynthResult {
  payload: ArtifactPayload;
  /** Engine-output contradictions surfaced rather than smoothed. */
  contradictions: string[];
}

// ── small helpers ────────────────────────────────────────────────────────
function splitSentences(s: string): string[] {
  return (s || '').split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
}
function lowerFirst(s: string): string { return s ? s[0].toLowerCase() + s.slice(1) : s; }
function stripTrailingPeriod(s: string): string { return s.replace(/\.\s*$/, ''); }
function norm(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
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
  return hit ? stripTrailingPeriod(hit) : undefined;
}

function roleNoun(role: string | undefined): string {
  const r = (role || '').toLowerCase();
  if (r.includes('amp')) return 'amplifier';
  if (r.includes('dac') || r.includes('source')) return 'DAC';
  if (r.includes('speak')) return 'speakers';
  if (r.includes('stream')) return 'streamer';
  return role || 'system';
}

// ── R2: intent read — general derivation ────────────────────────────────
// Recognition must always describe apparent intent, not tonal description.
// We derive intent from each axis independently and compose, instead of a
// fixed lookup. Every axis the engine emits maps to a "what the builder was
// after" phrase, so there is no path that falls back to the signature.
const INTENT_PRIMARY: Record<string, Record<string, string>> = {
  warm_bright: {
    warm:    'tone and presence',
    bright:  'resolution and speed',
    neutral: 'tonal neutrality',
    balanced:'tonal balance',
  },
  smooth_detailed: {
    smooth:  'ease and continuity',
    detailed:'resolution and detail',
    neutral: 'a clean read of the recording',
    balanced:'a clean read of the recording',
  },
  elastic_controlled: {
    elastic:  'rhythmic life',
    controlled:'composure and grip',
    neutral:  'composure',
    balanced: 'composure',
  },
};

const INTENT_QUALIFIER: Record<string, Record<string, string>> = {
  warm_bright: {
    warm:    'detail and air preserved through careful choices downstream',
    bright:  'tonal weight asked of the speaker',
    neutral: 'character allowed to come from the recording, not the chain',
    balanced:'character allowed to come from the recording, not the chain',
  },
  smooth_detailed: {
    smooth:  'detail offered rather than asserted',
    detailed:'long-session ease asked of the speaker',
    neutral: 'no single quality asked to dominate',
    balanced:'no single quality asked to dominate',
  },
  elastic_controlled: {
    elastic:  'composure left to the speaker',
    controlled:'a little bloom traded for grip',
    neutral:  'no axis asked to lead',
    balanced: 'no axis asked to lead',
  },
};

function intentRead(axes: Record<string, string> | undefined): string {
  // Pick the strongest non-neutral axis for the primary clause; the next-
  // strongest non-neutral axis (if any) supplies the qualifier. If every
  // axis reads neutral, fall back to the unambiguous balance phrasing — a
  // valid intent statement, never the tonal signature.
  const ranked: string[] = ['warm_bright', 'smooth_detailed', 'elastic_controlled'];
  const present = ranked.filter((k) => axes && axes[k] && axes[k] !== 'neutral' && axes[k] !== 'balanced');
  if (!axes || present.length === 0) {
    return 'built for balance — no single quality asked to dominate';
  }
  const primaryKey = present[0];
  const primaryVal = axes[primaryKey];
  const primary = INTENT_PRIMARY[primaryKey]?.[primaryVal] ?? 'a considered balance';
  const qualKey = present[1] ?? ranked.find((k) => k !== primaryKey);
  const qualVal = qualKey ? (axes[qualKey] ?? 'neutral') : 'neutral';
  const qualifier = qualKey ? (INTENT_QUALIFIER[qualKey]?.[qualVal] ?? '') : '';
  return qualifier
    ? `built for ${primary}, with ${qualifier}`
    : `built for ${primary}`;
}

// ── R8: equilibrium beat (restraint path: who plays which part) ─────────
function equilibriumBeat(credit: string[], axes: Record<string, string> | undefined): string | null {
  if (credit.length < 2) return null;
  const last = credit[credit.length - 1];
  const upstream = credit.slice(0, -1).join(' and ');
  const w = axes?.warm_bright;
  if (w === 'warm') return `${upstream} hand the speaker a tone-rich signal; ${last} carries it without thinning it out.`;
  if (w === 'bright' || w === 'neutral') return `${upstream} resolve cleanly; ${last} keeps the result musical rather than analytical.`;
  return `${upstream} set the character; ${last} preserves it without arguing.`;
}

// ── role-bound recommendation (R6: no new diagnosis) ────────────────────
function recommendationFor(category: string, role: string): string {
  if (category === 'power_match') {
    return "I’d resolve the power mismatch first — more amplifier power, or easier-to-drive speakers.";
  }
  return `I’d start with the ${role}.`;
}

// ── role-bound cost (R7: trade-off implied by the recommendation) ───────
function costFor(category: string): string {
  if (category === 'power_match')
    return 'More power buys you the dynamics; easier speakers buy you keeping the amplifier you love. Either way, the system’s character shifts.';
  if (category === 'dac_limitation')
    return 'A more resolving source will show you what the rest of the chain has been hiding — including the things you chose it for.';
  if (category === 'speaker_scale')
    return 'Bigger speakers ask more of the room, and more of the amplifier you have.';
  if (category === 'stacked_bias' || category === 'tonal_imbalance')
    return 'Rebalancing trades the system’s current signature for something the chain doesn’t yet do. Decide which one you want first.';
  if (category === 'amplifier_control')
    return 'More control trades a little bloom for grip. That’s the deal.';
  return 'Anything you change here trades something. Be honest about which side you’d rather keep.';
}

// ── verdict + standfirst (engine-leverage driven; copy unchanged) ───────
function verdictAndStandfirst(
  bottleneck: any, category: string, role: string, signature: string,
): { verdict: string; standfirst?: string } {
  if (bottleneck) {
    if (category === 'power_match') {
      return {
        verdict: role === 'speakers'
          ? 'These speakers need more power than the system gives them.'
          : "The amplifier can't drive these speakers.",
        standfirst: 'The match is the problem — not the taste.',
      };
    }
    if (category === 'dac_limitation') {
      return { verdict: 'The DAC is holding the system back.', standfirst: 'Everything downstream inherits its limits.' };
    }
    if (category === 'speaker_scale') {
      return { verdict: 'The speakers set the ceiling here.', standfirst: 'They cap what the rest of the system can show.' };
    }
    return {
      verdict: `The ${role} is steering the whole system.`,
      standfirst: signature ? lowerFirst(stripTrailingPeriod(signature)) + '.' : undefined,
    };
  }
  return {
    verdict: 'Nothing here needs changing.',
    standfirst: signature ? stripTrailingPeriod(signature) + '.' : undefined,
  };
}

// ── R3 (heard consequence) — engine sentences → user-ear sentence ───────
// Bottleneck path only. We keep the engine's first sentence (mechanism) and
// add one heard-consequence beat that names the *category-specific* user
// perception. This is not stylistic variation; each category has a
// different audible signature, and using one line for all categories was
// factually wrong on dac_limitation / stacked_bias.
const HEARD_CONSEQUENCE_BY_CATEGORY: Record<string, string> = {
  power_match:
    'At normal listening levels you hear it as soft dynamics, loose bass and the sense that the system is straining to keep up.',
  dac_limitation:
    'You hear it as a thinner midrange, a glassy edge on transients and the body the recording deserves never quite arriving.',
  stacked_bias:
    'You hear it as the system leaning hard in one direction — what should be a strength has become an excess the speaker can’t talk out of.',
  speaker_scale:
    'You hear it as a system that fills the room but never quite owns it — scale and physical authority capped by what the speaker can move.',
  amplifier_control:
    'You hear it as bass that loosens under load, timing that softens on dense passages and a system that loses grip when it needs to bear down.',
};
const HEARD_CONSEQUENCE_DEFAULT =
  'You hear it as the chain pushed past what the weakest link can support.';

// ── R5 (no recommendation preview) — fragments to strip from case prose ─
const RECOMMENDATION_PREVIEW_PATTERNS: RegExp[] = [
  /\s*Either more amplifier power[^.]*\.?/i,
  /\s*Either fix[^.]*\.?/i,
  /\s*(would|should|could) (resolve|fix|address) this[^.]*\.?/i,
];

/**
 * Build a case sentence — observation/mechanism — from the engine's first
 * sentence of constraint explanation. Strips the in-line SPL parenthetical
 * (R4) and any text that previews the recommendation (R5).
 */
function buildMechanismBeat(constraintExpl: string, hasDatum: boolean): string {
  const first = splitSentences(constraintExpl)[0] ?? '';
  let out = first;
  if (hasDatum) {
    // R4: the rail shows ≈N dB; remove the engine's repeat of it.
    out = out.replace(/\s*Estimated max clean SPL is\s*~?\s*\d+\s*dB[^.]*\.?/i, '');
    out = out.replace(/\s*\(estimated[^)]*\)/i, '');
  }
  for (const pat of RECOMMENDATION_PREVIEW_PATTERNS) out = out.replace(pat, '');
  return out.trim();
}

// ── R8: restraint forbidden refrain — phrases that announce the verdict
// rather than demonstrate the equilibrium that justifies it.
const RESTRAINT_FORBIDDEN_RE =
  /\b(it is balanced|no weak link|nothing (?:here )?needs changing|nothing needs fixing)\b/i;

// ────────────────────────────────────────────────────────────────────────────
export function synthesizeArtifact(result: any): SynthResult {
  const contradictions: string[] = [];
  const f = result?.findings ?? {};
  const resp = result?.response ?? {};

  // ── component credit (DIRECT: engine catalog names; corruption-guarded) ──
  const chain = f.systemChain ?? {};
  const names: string[] = chain.names ?? [];
  const full: string[] = chain.fullChain ?? [];
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

  if (bottleneck && !path0) contradictions.push('Engine reports a bottleneck but no upgrade path.');
  if (!bottleneck && path0 && /highest/i.test(path0.impact ?? ''))
    contradictions.push('Engine reports no bottleneck but a Highest-Impact upgrade path exists.');

  // ── verdict + standfirst ─────────────────────────────────────────────
  const { verdict, standfirst } = verdictAndStandfirst(bottleneck, category, role, signature);

  // ── R1, R2 — recognition ─────────────────────────────────────────────
  // R2: recognition ALWAYS describes apparent intent, never the tonal
  // signature. intentRead() now derives an intent phrase for every axis
  // combination the engine emits, so there is no signature fallback path.
  // R1 is enforced as a final post-condition.
  let recognition = `This system is ${intentRead(f.systemAxes)}.`;
  if (standfirst && norm(recognition) === norm(standfirst)) {
    recognition = 'A system worth assessing.';
    contradictions.push('R1: recognition would duplicate the standfirst; falling back to neutral lead.');
  }

  // ── R3, R4, R5, R8 — case paragraphs ─────────────────────────────────
  const caseParagraphs: string[] = [];
  const hasDatum = category === 'power_match' && !!extractSplDatum(constraintExpl);

  if (bottleneck && constraintExpl) {
    // R3 (mechanism → heard consequence; bottleneck path only).
    // R4 (no datum repeat). R5 (no preview).
    const mechanism = buildMechanismBeat(constraintExpl, hasDatum);
    if (mechanism) caseParagraphs.push(mechanism);
    const heard = HEARD_CONSEQUENCE_BY_CATEGORY[category] ?? HEARD_CONSEQUENCE_DEFAULT;
    if (!HEARD_CONSEQUENCE_BY_CATEGORY[category])
      contradictions.push(`R3: no category-specific heard-consequence line for "${category}"; using default.`);
    caseParagraphs.push(heard);
  } else {
    // R8 (restraint: demonstrate equilibrium, not announce it).
    const beat = equilibriumBeat(credit, f.systemAxes);
    if (beat) caseParagraphs.push(beat);

    const strengths: string[] = resp.assessmentStrengths ?? [];
    const firstStrength = stripTrailingPeriod((strengths[0] ?? '').trim());
    if (firstStrength) {
      const subj = firstStrength.match(/^([A-Z][\w\s+\-]+?)\s+(contributes|provides|adds|delivers|brings)\s+(.+)$/);
      caseParagraphs.push(subj
        ? `What the ${subj[1]} brings — ${subj[3]} — comes through cleanly because nothing upstream fights it.`
        : `${firstStrength}, in a chain that lets it.`);
    }
    // Closing implication — names the mechanism's consequence, not the verdict.
    caseParagraphs.push('Each component is doing what it was chosen for, and nothing is asking it to do more.');
  }
  if (!caseParagraphs.length && signature) caseParagraphs.push(stripTrailingPeriod(signature) + '.');

  // R5 (post-condition): no case line may name "I'd" / "you should" / etc.
  for (let i = 0; i < caseParagraphs.length; i++) {
    if (/\bI[’']d\b|\bI would\b|\byou should\b|\byou'?d (want|need)\b/i.test(caseParagraphs[i])) {
      contradictions.push('R5: case sentence previews the recommendation; stripped.');
      caseParagraphs[i] = caseParagraphs[i].replace(/(\.|;)\s*(I[’']d|I would|you should|you'?d (want|need))[^.]*\.?/i, '$1').trim();
    }
  }

  // R8 (post-condition): restraint case must not contain forbidden refrains.
  if (!bottleneck) {
    for (let i = 0; i < caseParagraphs.length; i++) {
      if (RESTRAINT_FORBIDDEN_RE.test(caseParagraphs[i])) {
        contradictions.push(`R8: case sentence used forbidden refrain ("${caseParagraphs[i]}"); removed.`);
        caseParagraphs[i] = '';
      }
    }
  }
  // Drop any sentences nulled out by post-conditions.
  for (let i = caseParagraphs.length - 1; i >= 0; i--) if (!caseParagraphs[i]) caseParagraphs.splice(i, 1);

  // ── hero datum + pull quote ─────────────────────────────────────────
  let heroDatum: ArtifactPayload['heroDatum'] | undefined;
  if (category === 'power_match') {
    const d = extractSplDatum(constraintExpl);
    if (d) heroDatum = d;
    else contradictions.push('Power-match constraint present but no clean-SPL figure could be extracted (derivation fragile).');
  }
  const pullQuote = bottleneck ? extractPullQuote(constraintExpl) : undefined;

  // ── R6 — recommendation (acts on the engine's role only) ─────────────
  let recommendation: string;
  if (path0) recommendation = recommendationFor(category, role);
  else recommendation = 'Leave it alone.';

  // R6 post-condition: bottleneck-named role must appear in the recommendation
  // (or the recommendation explicitly names the power_match resolution).
  if (bottleneck) {
    const ok = category === 'power_match'
      ? /amplifier|speakers|power/i.test(recommendation)
      : new RegExp('\\b' + role + '\\b', 'i').test(recommendation);
    if (!ok) contradictions.push(`R6: recommendation does not act on engine role "${role}".`);
  }

  // ── R7 — cost (specific to the recommendation) ───────────────────────
  const cost = bottleneck
    ? costFor(category)
    : 'If you ever want more, name the quality you’re chasing — but the gain there comes from somewhere here.';

  const seed = credit.join('|') + '|' + (bottleneck ? category : 'keep');
  const payload: ArtifactPayload = {
    verdict, standfirst, componentCredit: credit,
    recognition, caseParagraphs,
    heroDatum, pullQuote,
    recommendation,
    cost,
    date: today(),
    edition: editionFor(seed),
  };

  return { payload, contradictions };
}
