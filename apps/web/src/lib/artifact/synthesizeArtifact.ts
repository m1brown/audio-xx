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
 *     "This system is already well balanced.";
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
import { getProductImage } from '@/lib/product-images';
import { isCausalExplanationEnabled } from '@/lib/feature-flags';
import { resolveCausalComponentsFromNames, evaluateCausal } from '@/lib/causal';

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
  if (!s) return s;
  // Preserve original case when the fragment begins with a manufacturer or
  // model name — decapitalising "WLM Diva Monitor" to "wLM Diva Monitor",
  // or "Harbeth Super HL5 Plus" to "harbeth …", corrupts a proper name
  // mid-sentence and immediately reads as a defect. A fragment leads with a
  // proper name when its first token carries an internal capital (an
  // acronym / model token like WLM, KEF, LS50, McIntosh, SuperNait) or when
  // the first two tokens are both capitalised (a multi-word brand+model).
  const m = s.match(/^(\S+)(?:\s+(\S+))?/);
  const first = m?.[1] ?? '';
  const second = m?.[2] ?? '';
  const acronymOrCamel = /^[A-Za-z].*[A-Z]/.test(first);
  const twoCaps = /^[A-Z]/.test(first) && /^[A-Z]/.test(second);
  if (acronymOrCamel || twoCaps) return s;
  return s[0].toLowerCase() + s.slice(1);
}
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
    // Factual restraint (Gate 10): the DAC bottleneck is described by its
    // system-level mechanism — the source sets the ceiling — not by asserting
    // a specific tonal character (e.g. "glassy") that may be false for a
    // respected DAC. Honesty over apparent expertise.
    'You hear it as the source setting the system’s ceiling — less of the tonal body and inner detail the rest of the chain is capable of resolving.',
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

  let bottleneck = f.bottleneck ?? null;
  const path0 = (resp.upgradePaths ?? [])[0] ?? null;
  const constraintExpl: string = resp.primaryConstraint?.explanation ?? '';
  const signature: string = resp.systemSignature ?? '';
  let category: string = bottleneck?.category ?? '';
  let role = roleNoun(bottleneck?.role);

  // E4 (Doctrine D-11): a diagnosed target with no classifiable role must never
  // be surfaced as "the system". Power-match names no generic role (its verdict
  // and recommendation are role-free), so it is exempt; any other bottleneck
  // whose role cannot be attributed is treated as NO primary diagnosis — the
  // verdict falls back to restraint and the recommendation to no-change.
  if (bottleneck && category !== 'power_match' && role === 'system') {
    bottleneck = null;
    category = '';
    role = '';
  }

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

  // A3 Phase 2 (vI) — validated A3-composed case paragraphs attached to the
  // raw assessment carrier by the artifact-case overlay (a3-artifact-case.ts,
  // wired in page.tsx). When present, they replace the deterministic
  // composition below wholesale. The R5/R8 post-conditions after this block
  // still run over them — a second net behind the overlay's own validator.
  const a3Case: string[] | undefined = Array.isArray(result?.a3CaseParagraphs)
    && result.a3CaseParagraphs.length >= 2
    && result.a3CaseParagraphs.every((p: unknown) => typeof p === 'string' && (p as string).trim().length > 0)
    ? result.a3CaseParagraphs
    : undefined;

  if (a3Case) {
    caseParagraphs.push(...a3Case.map((p: string) => p.trim()));
  } else if (bottleneck && constraintExpl) {
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
    //
    // 2026-07-01 essay-treatment pass. Mike's note on the enriched
    // balanced response was that even with the extra engine data
    // plumbed through, the body still read as a sequence of short
    // standalone sentences rather than editorial prose. This pass
    // COMPOSES the same signals (equilibriumBeat, strengths,
    // limitations, preferenceNote, upgradeDirection) into 3–4
    // fuller paragraphs with narrative connective tissue — thesis
    // → developed case → honest trade → forward-look — so the
    // body reads like a short editorial portrait of the system.
    //
    // Each paragraph is composed conditionally on the data that
    // reached it, so a system with fewer engine emissions still
    // produces a coherent (shorter) essay rather than an
    // over-padded skeleton.
    const beat = equilibriumBeat(credit, f.systemAxes);

    const strengths: string[] = (resp.assessmentStrengths ?? [])
      .map((s: string) => stripTrailingPeriod((s ?? '').trim()))
      .filter((s: string) => !!s);
    const limitations: string[] = (resp.assessmentLimitations ?? [])
      .map((s: string) => stripTrailingPeriod((s ?? '').trim()))
      .filter((s: string) => !!s);
    const prefNote = stripTrailingPeriod((resp.preferenceNote ?? '').trim());

    // Rephrase a strength sentence into a "what the X brings" clause
    // suitable for sub-clause use inside a longer paragraph.
    function asContribution(s: string): string {
      const m = s.match(/^([A-Z][\w\s+\-]+?)\s+(contributes|provides|adds|delivers|brings)\s+(.+)$/);
      return m ? `the ${m[1]} ${m[2]} ${m[3]}` : lowerFirst(s);
    }

    // Extract the leading subject (component name) from an engine
    // sentence, so we can detect subject reduplication between the
    // equilibrium beat and any strength we might weave next to it.
    function subjectOf(s: string): string {
      const m = s.match(/^([A-Z][\w+\-]+(?:\s+[A-Z0-9][\w+\-]*)*)/);
      return (m ? m[1] : '').toLowerCase();
    }
    // ── Paragraph 1: the thesis — the equilibrium beat.
    // Names how the components trade roles. Weaves in the first
    // strength only when it names a DIFFERENT component than the
    // beat already covered, so we don't say the same thing twice.
    const beatSubjects = beat ? beat.toLowerCase() : '';
    if (beat && strengths[0]) {
      const s0 = strengths[0];
      const subj = subjectOf(s0);
      const alreadyCovered = subj && beatSubjects.includes(subj);
      if (alreadyCovered) {
        // Beat + a general "chosen for" close.
        caseParagraphs.push(`${beat} None of that is an accident — the chain upstream has been chosen so nothing fights what the speaker is trying to do.`);
      } else {
        // Beat + a specific "and here's what X brings" close on a
        // fresh subject.
        caseParagraphs.push(`${beat} None of that is an accident — ${asContribution(s0)}, and the rest of the chain has been chosen so that it can.`);
      }
    } else if (beat) {
      caseParagraphs.push(beat);
    } else if (strengths[0]) {
      const first = asContribution(strengths[0]);
      caseParagraphs.push(`${first.charAt(0).toUpperCase() + first.slice(1)}, in a chain that lets it.`);
    }

    // ── Paragraph 2: the developed case — additional strengths
    // (skipping any subject the beat already named) woven together
    // as flowing prose. Reads as an argument, not a bullet list.
    const extraStrengths = strengths.slice(1, 4).filter((s) => {
      const subj = subjectOf(s);
      return !subj || !beatSubjects.includes(subj);
    });
    if (extraStrengths.length >= 2) {
      caseParagraphs.push(`What you hear is coherence: ${asContribution(extraStrengths[0])}, while ${asContribution(extraStrengths[1])}. Nothing upstream fights what's downstream — the character of the front end reads all the way through.`);
    } else if (extraStrengths.length === 1) {
      caseParagraphs.push(`What you hear is coherence: ${asContribution(extraStrengths[0])}, and nothing upstream fights it.`);
    }

    // ── Paragraph 3a (new 2026-07-02): why the system hangs together.
    //
    // For a balanced case the engine emits fewer axis-derived
    // strengths and often zero limitations, so the previous
    // composition landed at 2-3 paragraphs. Mike: "excellent systems
    // should still produce rich editorial analysis explaining … why
    // the system works / why the synergy exists / what compromises
    // were intentionally avoided / why the presentation feels
    // coherent / what design philosophy connects the components."
    //
    // findings (`f`) already carries deterministic structured signals
    // that the synthesizer was throwing away: `isCoherent`,
    // `coherentSharedTraits`, `coherentTradeoffs`, and
    // `perComponentAxes`. When the system is coherent, we can name
    // the shared traits and let the reader understand that this
    // isn't accident — it's design. When it isn't formally coherent
    // but has 3+ components with clear axis positions, we can still
    // describe how the components lean and why that hangs together.
    //
    // Nothing here fabricates content — every clause is derived
    // directly from a findings field.
    const sharedTraits: string[] = Array.isArray(f.coherentSharedTraits) ? f.coherentSharedTraits : [];
    const coherentTradeoffs: string[] = Array.isArray(f.coherentTradeoffs) ? f.coherentTradeoffs : [];
    const perComponentAxes: Array<{ name: string; axes: Record<string, string> }> =
      Array.isArray(f.perComponentAxes) ? f.perComponentAxes : [];

    if (f.isCoherent === true && sharedTraits.length > 0) {
      // Format a human trait list ("warmth, tonal density, and flow").
      const traitList = sharedTraits.length === 1
        ? sharedTraits[0]
        : sharedTraits.length === 2
          ? `${sharedTraits[0]} and ${sharedTraits[1]}`
          : `${sharedTraits.slice(0, -1).join(', ')}, and ${sharedTraits[sharedTraits.length - 1]}`;
      caseParagraphs.push(`Why it hangs together: every stage in the chain leans toward ${traitList}. When the source leans that way, the amplifier leans that way, and the speaker leans that way, the character isn't diluted at any handoff — it's amplified by design. This is what happens when components are chosen for shared voicing rather than complementary correction.`);
    } else if (perComponentAxes.length >= 2) {
      // Non-coherent balanced systems: describe the axis mix
      // explicitly so the reader sees the deliberate lean per
      // component. Pick the axis where the largest number of
      // components agree and name it.
      const AXES = ['warm_bright', 'smooth_detailed', 'elastic_controlled'];
      const AXIS_LABEL: Record<string, string> = {
        warm_bright: 'warmth vs. clarity',
        smooth_detailed: 'ease vs. resolution',
        elastic_controlled: 'elasticity vs. composure',
      };
      let bestAxis: string | null = null;
      let bestCount = 0;
      let bestSide = '';
      for (const axis of AXES) {
        const sides: Record<string, number> = {};
        for (const c of perComponentAxes) {
          const v = c.axes?.[axis];
          if (v && v !== 'neutral') sides[v] = (sides[v] ?? 0) + 1;
        }
        const [side, count] = Object.entries(sides).sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
        if (count > bestCount) { bestAxis = axis; bestCount = count; bestSide = side; }
      }
      if (bestAxis && bestCount >= 2) {
        caseParagraphs.push(`Why it hangs together: on ${AXIS_LABEL[bestAxis]}, ${bestCount} of the ${perComponentAxes.length} components lean the same way (${bestSide}). That agreement is what a coherent system sounds like — each stage carrying the direction forward instead of correcting the one before.`);
      }
    }

    // ── The trade-off paragraph — Doctrine D-10 (Resolution): write at the
    // highest resolution the evidence licenses. A *component-specific*
    // limitation (per-component: placement, load, extension — from the engine's
    // `assessmentLimitations`) outranks the *system-archetype* trade-off (the
    // axis-derived `coherentTradeoffs`, which is identical across systems of the
    // same tonal character). Precedence is inverted from the original
    // archetype-first ordering so the particular trade is preferred; the two
    // frames' wording is unchanged — only which one is chosen flips. Exactly one
    // paragraph surfaces (mutually exclusive), in the same slot as before.
    if (limitations[0]) {
      const limit = limitations[0].replace(/\s+/g, ' ').trim();
      caseParagraphs.push(`The trade — ${lowerFirst(limit)}.`);
    } else if (coherentTradeoffs.length > 0) {
      const first = String(coherentTradeoffs[0]).trim().replace(/[.]+$/, '');
      caseParagraphs.push(`What it gives up on purpose: ${lowerFirst(first)}. That's the deliberate cost — a coherent system can't pull in both directions at once, and this one has picked its direction.`);
    }

    // ── Paragraph 4: the closing — listener-fit + refrain in one
    // sustained thought. Kept short so it reads as an editorial
    // sign-off.
    const closing: string[] = [];
    if (prefNote) closing.push(prefNote);
    closing.push('Each component is doing what it was chosen for, and nothing is asking it to do more');
    caseParagraphs.push(closing.join('. ') + '.');

    // Doctrine D-8 (Recommendation Licensing): the Assessment must not carry a
    // forward-looking upgrade paragraph. The previous "If you ever want more, …"
    // beat was fabricated from the engine's tonal-lean → hypothetical-deficiency
    // generator (now retired). A recommendation is licensed only by an identified
    // limitation, an explicit trade-off, or a stated listener priority, and it
    // belongs in the Recommendation section — never as speculation inside the
    // Assessment. When nothing is licensed, the Recommendation says so plainly.
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

  // ── R6 — recommendation (Doctrine D-8: Recommendation Licensing) ─────
  //
  // A recommendation may be generated ONLY from something the assessment
  // established: an identified limitation, an explicit trade-off, or a stated
  // listener priority. A tonal characteristic must never be converted into a
  // hypothetical deficiency to manufacture an upgrade. When no action is
  // licensed the correct output is an explicit no-change recommendation.
  //
  // License classes (per D-8). Today the artifact emits 'limitation' (the
  // engine surfaced an identified upgrade path) or 'none' (a coherent system
  // with no identified limitation). 'tradeoff' and 'priority' are reserved:
  // the pipeline does not yet capture a stated listener priority or a
  // trade-off-directed action, so those are defined for the doctrine and future
  // envelopes but not yet produced here.
  type RecommendationLicense = 'limitation' | 'tradeoff' | 'priority' | 'none';
  // E3 (Doctrine D-11): verdict and recommendation must derive from the same
  // licensed state — the primary bottleneck. A bare upgrade path (`path0`) may
  // exist without a licensed bottleneck; when it does, the recommendation must
  // NOT fire from it. When there is no bottleneck, the coherent verdict forces
  // the no-change recommendation.
  const recommendationLicense: RecommendationLicense = bottleneck ? 'limitation' : 'none';

  let recommendation: string;
  if (recommendationLicense === 'none') recommendation = 'This system is already well balanced.';
  else recommendation = recommendationFor(category, role);

  // R6 post-condition: bottleneck-named role must appear in the recommendation
  // (or the recommendation explicitly names the power_match resolution).
  if (bottleneck) {
    const ok = category === 'power_match'
      ? /amplifier|speakers|power/i.test(recommendation)
      : new RegExp('\\b' + role + '\\b', 'i').test(recommendation);
    if (!ok) contradictions.push(`R6: recommendation does not act on engine role "${role}".`);
  }

  // ── R7 — cost follows the same license as the recommendation ─────────
  const cost = recommendationLicense === 'none'
    ? 'If you want more of something, name the quality you’re looking for.'
    : costFor(category);

  const seed = credit.join('|') + '|' + (bottleneck ? category : 'keep');

  // Component photos — look each named component up in the product-images
  // map and surface a small editorial strip in the artifact. The lookup
  // is substring-based against `normalize("brand name")`, so passing the
  // full chain entry (which already contains brand + name) is enough to
  // hit the key. Components without a matched URL render as null and are
  // omitted from the strip (no broken-image placeholders).
  const componentPhotos = credit.map((nm, i): { src: string; alt: string } | null => {
    const haystack = full[i] || nm;
    const url = getProductImage(undefined, haystack);
    if (!url) return null;
    return { src: url, alt: nm };
  });
  // A single resolved image renders a lopsided, oversized rail that reads as
  // broken. Show the strip only when at least two component images resolve;
  // otherwise omit it (names remain in the credit line). Smallest defensible rule.
  const resolvedPhotoCount = componentPhotos.filter((p) => p !== null).length;
  const showPhotoRail = resolvedPhotoCount >= 2;

  // Causal Explanation (Phase 1) — a licensed interaction claim, woven INTO the
  // mechanism arc rather than appended as a labelled block. Deterministic and
  // flag-gated: when off (default) nothing is added and the payload is
  // byte-identical; when on, the engine emits a paragraph only if an approved
  // InteractionRule fires against verified CatalogFacts (no rule ⇒ no
  // paragraph). We place it immediately after the coherence beat so it reads as
  // part of "why it hangs together"; otherwise at the end. Inserted after the
  // R5/R8 post-conditions so those never rewrite the authored, already-safe
  // causal prose.
  if (isCausalExplanationEnabled()) {
    const causalBlock = evaluateCausal(resolveCausalComponentsFromNames(credit)).block;
    if (causalBlock) {
      const coherenceIdx = caseParagraphs.findIndex((p) =>
        /hangs together|what you hear is coherence|nothing upstream fights/i.test(p),
      );
      const insertAt = coherenceIdx >= 0 ? coherenceIdx + 1 : caseParagraphs.length;
      caseParagraphs.splice(insertAt, 0, causalBlock);
    }
  }

  const payload: ArtifactPayload = {
    verdict, standfirst, componentCredit: credit,
    componentPhotos: showPhotoRail ? componentPhotos : undefined,
    recognition, caseParagraphs,
    heroDatum, pullQuote,
    recommendation,
    cost,
    date: today(),
    edition: editionFor(seed),
  };

  return { payload, contradictions };
}
