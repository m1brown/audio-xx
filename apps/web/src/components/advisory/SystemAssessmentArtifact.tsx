'use client';

// React imported explicitly for vitest node-env JSX classic transform.
import React from 'react';

import type { AdvisoryResponse } from '@/lib/advisory-response';
import { COLOR, sectionHeadingStyle, proseStyle } from '@/lib/editorial-tokens';
import { hasDisplayableSources } from '@/lib/evidence/source-whitelist';

import SystemHero from './SystemHero';
import SystemProfileCard from './SystemProfileCard';
import EditorialSubCard from './EditorialSubCard';
import AdvisoryUpgradePaths from './AdvisoryUpgradePaths';
import AdvisorySources from './AdvisorySources';

/**
 * Presentation-layer normalization of §5 *The Components* card content.
 *
 * Solves three editorial problems present in the engine's raw
 * componentReadings output:
 *
 *   1. ORDER DRIFT — `systemChain.names` is sorted by role (signal-path
 *      order: source → amp → speakers) while `componentReadings` is
 *      produced in the components' input order. Index-based mapping
 *      between the two arrays produces swapped card content (e.g. the
 *      Denafrips card shows the Leben description). Each engine reading
 *      begins with "The ${displayName}" so identity-mapping by prefix
 *      is robust.
 *
 *   2. OFF-CHAIN DRIFT — engine readings can mention products outside
 *      the user's chain (e.g. the Leben CS600X reading wanders into
 *      the CS300X desktop headphone amplifier). For a section about
 *      THIS chain, sentences referencing products NOT in the chain
 *      are stripped.
 *
 *   3. LENGTH IMBALANCE — engine readings vary from ~25 to ~80 words.
 *      The cards look editorially uneven. After stripping, the reading
 *      is trimmed at sentence boundaries to a consistent target.
 *
 * No engine changes. No reordering of the engine's componentReadings
 * array; only how the artifact maps readings to the rendered cards.
 */

/** Target word count for each §5 card body after normalization. */
const COMPONENT_CARD_WORD_TARGET = 55;

/** Sentence-split heuristic: split on `.`, `!`, `?` followed by space. */
function splitSentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? [text])
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Count whitespace-delimited words. */
function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Find the engine reading that matches a given component name.
 *
 * Engine paragraphs begin with `"The ${displayName}"` (see
 * `consultation.ts` componentParagraphs map). We match by case-insensitive
 * prefix. If no reading matches the name's prefix, fall back to the
 * positional reading at the same name index — preserves legacy behavior
 * for the unlikely case that the engine output drifts from the prefix
 * convention.
 */
function findReadingForName(
  name: string,
  readings: string[],
  fallbackIndex: number,
): string | undefined {
  const target = `the ${name.toLowerCase()}`;
  const matched = readings.find((r) => r.toLowerCase().startsWith(target));
  return matched ?? readings[fallbackIndex];
}

/**
 * Determine whether a sentence references any product NOT in the user's
 * current chain. Uses a conservative heuristic:
 *
 *   - Identify candidate model tokens in the sentence (uppercase letter
 *     followed by digits/letters, e.g. `CS300`, `CS300X`, `O/96`).
 *   - For each candidate, check whether it appears in the chain
 *     (substring match against any chain name).
 *   - If a candidate is present but does NOT appear in any chain name,
 *     the sentence is "off-chain".
 *
 * Intentionally conservative — only drops sentences containing a clearly
 * model-like token that has no chain match. Sentences with descriptive
 * prose only (no model token) are always retained.
 */
function sentenceMentionsOffChainProduct(
  sentence: string,
  chainNames: string[],
): boolean {
  const chainLower = chainNames.map((n) => n.toLowerCase());
  // Candidate model tokens: at least 2 consecutive capital letters
  // followed by at least 2 digits, optionally followed by capitals.
  // This shape catches real product/tube model numbers like:
  //   - CS300, CS300X, CS600X (Leben)
  //   - KT77, KT88, EL34 (tube types — also product-spec drift)
  //   - QB9 (Ayre), L509Z (Luxman), TS500 — anywhere a multi-letter
  //     prefix carries digits.
  // It intentionally does NOT match:
  //   - Topology shorthand like "R2R" (single leading capital)
  //   - Roman numerals like "II" (no digits)
  //   - Acronyms like "USB", "DSD", "MQA" (no digits)
  //   - Bare numbers like "300B" or "32W" (no leading capitals)
  //   - Mixed-case names like "DeVore" or "O/96" (no [A-Z]{2,} prefix)
  // This shape is conservative: when in doubt, the sentence is kept.
  // The user said the Leben CS300X drift is the canonical off-chain
  // example to catch; the regex is calibrated for that pattern.
  const tokens = sentence.match(/\b[A-Z]{2,}\d{2,}[A-Z]*\b/g) ?? [];
  for (const token of tokens) {
    const t = token.toLowerCase();
    const inChain = chainLower.some((cn) => cn.includes(t));
    if (!inChain) return true;
  }
  return false;
}

/**
 * Trim a sentence list to a target word count at sentence boundaries.
 * Always keeps at least one sentence to avoid empty card bodies.
 */
function trimSentencesToTarget(sentences: string[], targetWords: number): string[] {
  if (sentences.length === 0) return sentences;
  const kept: string[] = [];
  let runningWords = 0;
  for (const s of sentences) {
    const w = countWords(s);
    if (kept.length > 0 && runningWords + w > targetWords) break;
    kept.push(s);
    runningWords += w;
  }
  // If the very first sentence already exceeded the target, keep it
  // anyway — a single long sentence beats an empty card.
  return kept;
}

/**
 * Normalize a single component card body.
 *
 * Pipeline:
 *   1. Sentence-split the engine reading.
 *   2. Drop sentences that mention products outside the chain.
 *   3. Trim the remaining sentences to the word target.
 *
 * Returns undefined when the input is empty/undefined so the card can
 * gracefully omit a body.
 */
function normalizeComponentReading(
  reading: string | undefined,
  chainNames: string[],
): string | undefined {
  if (!reading) return undefined;
  const sentences = splitSentences(reading);
  const onChain = sentences.filter((s) => !sentenceMentionsOffChainProduct(s, chainNames));
  // Defensive: if filtering removes everything, keep the first sentence
  // so the card still says something rather than displaying empty.
  const filtered = onChain.length > 0 ? onChain : sentences.slice(0, 1);
  const trimmed = trimSentencesToTarget(filtered, COMPONENT_CARD_WORD_TARGET);
  return trimmed.join(' ').trim() || undefined;
}

/**
 * Build the §5 card data for the artifact.
 *
 * Combines identity-mapping (Issue: array-order drift between
 * systemChain.names and componentReadings) with content normalization
 * (Issue: off-chain product mentions; length imbalance).
 *
 * Returns one entry per name in `systemChain.names`, in signal-path
 * order. Each entry carries the matched reading after normalization;
 * roles are passed through from systemChain.roles.
 */
function buildComponentCards(
  names: string[] | undefined,
  roles: string[] | undefined,
  readings: string[] | undefined,
): Array<{ name: string; role?: string; body?: string }> {
  if (!readings || readings.length === 0) return [];
  if (!names || names.length === 0) {
    // Fallback: no chain → render readings as anonymous components.
    return readings.map((r, i) => ({
      name: `Component ${i + 1}`,
      body: normalizeComponentReading(r, []),
    }));
  }
  return names.map((name, i) => {
    const matched = findReadingForName(name, readings, i);
    const body = normalizeComponentReading(matched, names);
    return {
      name,
      role: roles?.[i],
      body,
    };
  });
}

/**
 * Presentation-layer normalization of §4 *Character* prose.
 *
 * The engine's `systemContext` field carries the entire legacy MemoFormat
 * narrative — eight bolded inline sub-headings (`**System read**`,
 * `**Emergent behavior**`, `**System logic**`, `**Primary leverage**`,
 * `**Decision**`, `**Trade-offs**`, `**Next step options**`,
 * `**Do nothing check**`). Inside the artifact, the only block that
 * semantically belongs in §4 *Character* is the first one — *System read*,
 * which characterizes the system's identity. The remaining seven blocks
 * either duplicate other sections (§7 Strengths and Honest Limits,
 * §8 What's Already Working, §9 If You Were to Change Something) or
 * duplicate visual chrome (§1 chain banner restated as arrow narration).
 *
 * This normalizer extracts the *System read* content and discards the
 * rest. Pure presentation transform — engine output unchanged.
 *
 * Returns undefined when the input collapses, so the section can
 * gracefully omit a body.
 */
function normalizeCharacterProse(systemContext: string | undefined): string | undefined {
  if (!systemContext) return undefined;
  let text = systemContext;

  // Phase 1: extract the System-read block.
  // Match `**System read**` (case-insensitive, allowing internal spaces)
  // and capture everything up to the next `**...**` marker or end of text.
  const systemReadMatch = text.match(/\*\*\s*system\s+read\s*\*\*\s*([\s\S]*?)(?=\*\*[\s\S]*?\*\*|$)/i);
  if (systemReadMatch) {
    text = systemReadMatch[1];
  } else {
    // No System-read marker. If text begins with content followed by
    // any `**...**` marker, keep only the pre-marker content. Otherwise
    // pass through as-is.
    const firstMarkerIdx = text.search(/\*\*[\s\S]{1,40}\*\*/);
    if (firstMarkerIdx > 0) {
      text = text.slice(0, firstMarkerIdx);
    }
  }

  // Phase 2: strip any residual bold markers and chain-arrow narration.
  // Arrow lines duplicate the §1 chain banner and break the editorial
  // register.
  text = text.replace(/\*\*[^*]*\*\*/g, '').trim();
  // Drop lines that contain → arrows OR contain "X and Y and Z reinforce
  // the same direction" chain-listing summary patterns.
  text = text
    .split(/\r?\n+/)
    .filter((line) => {
      const t = line.trim();
      if (t.length === 0) return false;
      if (t.includes('→')) return false;
      if (/\bre(?:in)?force\s+the\s+same\s+direction\b/i.test(t)) return false;
      return true;
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Phase 3: trim to the target window at sentence boundaries.
  // §4 Character target: 500–800 characters. Use sentence-boundary
  // trim (already proven for §5) and cap by character count rather
  // than word count since the target is character-defined.
  const sentences = splitSentences(text);
  const kept: string[] = [];
  let runningChars = 0;
  for (const s of sentences) {
    if (kept.length > 0 && runningChars + s.length > 800) break;
    kept.push(s);
    runningChars += s.length + 1; // +1 for the joining space
  }
  const result = kept.join(' ').trim();
  return result.length > 0 ? result : undefined;
}

/**
 * Presentation-layer normalization of §6 *How They Work Together*.
 *
 * The engine's `systemInteraction` field can mix true interaction
 * analysis with product-review drift — single-component spec rundowns,
 * brand-history asides, off-chain product mentions (e.g. the CS300X
 * headphone amplifier mentioned for the Leben CS600X). For a section
 * titled *How They Work Together*, every sentence should either:
 *   (a) be a system-level statement (mentioning the system as a whole
 *       without naming specific components), OR
 *   (b) reference at least two chain components (true interaction
 *       prose).
 *
 * This normalizer applies four rules per sentence:
 *   1. Drop if the sentence starts with `"{ChainComponentName}:"` —
 *      the legacy product-header pattern from MemoFormat's
 *      per-component sub-blocks.
 *   2. Drop if the sentence mentions an off-chain product (reuses
 *      the §5 model-token heuristic).
 *   3. Drop if the sentence contains a spec pattern (`~32W`, `~96dB`,
 *      `~XX kHz`, etc.) — technical-spec sentences are review-mode.
 *   4. Drop if the sentence names exactly one chain component AND
 *      contains no system-level framing — single-component prose is
 *      review-mode, not interaction prose.
 *
 * Falls back to keeping the first sentence if the filter empties the
 * content, so the section still says something rather than disappearing.
 */
function normalizeInteractionProse(
  interaction: string | undefined,
  chainNames: string[],
): string | undefined {
  if (!interaction) return undefined;

  // Build brand-prefix tokens from chain names for sentence detection.
  // Each chain name typically begins with a brand: "Denafrips Pontus II"
  // → "Denafrips" + "Pontus". We collect both full names and first-word
  // prefixes so a sentence mentioning just "Leben" or just "Pontus" is
  // counted as referencing that chain component.
  const chainTokens = new Set<string>();
  for (const name of chainNames) {
    chainTokens.add(name.toLowerCase());
    const first = name.split(/\s+/)[0]?.toLowerCase();
    if (first && first.length >= 3) chainTokens.add(first);
  }

  function chainTokensInSentence(s: string): number {
    const lower = s.toLowerCase();
    let count = 0;
    for (const tok of chainTokens) {
      if (lower.includes(tok)) count += 1;
    }
    return count;
  }

  // Detect component-header label pattern: "Leben CS600X:" at the
  // start of a sentence. Case-insensitive; whitespace-tolerant.
  function startsWithChainNameLabel(s: string): boolean {
    const trimmed = s.trim();
    for (const name of chainNames) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match exact name followed by ":" at start.
      const re = new RegExp(`^${escaped}\\s*:`, 'i');
      if (re.test(trimmed)) return true;
    }
    return false;
  }

  // Detect spec patterns: tilde-prefixed numbers (`~32W`), or numbers
  // immediately followed by audio-spec units (W, V, dB, Hz, kHz, MHz,
  // Ω, ohm). These mark review-mode prose.
  const SPEC_REGEX = /(~\s*\d|\b\d+(?:\.\d+)?\s*(?:W|V|dB|Hz|kHz|MHz|[Ωohm]+))\b/i;
  function containsSpec(s: string): boolean {
    return SPEC_REGEX.test(s);
  }

  const sentences = splitSentences(interaction);
  const kept = sentences.filter((s) => {
    // Rule 1: drop component-header pattern
    if (startsWithChainNameLabel(s)) return false;
    // Rule 2: drop off-chain product mention (reuses §5 heuristic)
    if (sentenceMentionsOffChainProduct(s, chainNames)) return false;
    // Rule 3: drop spec sentences
    if (containsSpec(s)) return false;
    // Rule 4: drop single-component prose. A sentence is "system-level"
    // when no chain tokens appear (count === 0). Two or more chain
    // tokens = interaction statement. Exactly one chain token without
    // any other interaction language = likely review drift.
    const count = chainTokensInSentence(s);
    if (count === 1) return false;
    return true;
  });

  // Defensive fallback: if every sentence was filtered, keep the first
  // sentence as-is so the section is not silently emptied.
  const final = kept.length > 0 ? kept : sentences.slice(0, 1);
  const result = final.join(' ').trim();
  return result.length > 0 ? result : undefined;
}

/**
 * Presentation-layer derivation of the §2 *Profile* "What it trades" row.
 *
 * `primaryConstraint.componentName` is structurally a label (e.g. "DAC",
 * "Amplification", "Amplifier headroom") — useful for chrome but not a
 * trade-off sentence. The Profile card's third row needs a sentence-shaped
 * summary of what the system trades to deliver its character.
 *
 * Resolution order, by editorial preference:
 *   1. First assessmentLimitations entry — canonically the most
 *      representative trade-off the system makes.
 *   2. primaryConstraint.impact — narrative impact statement when the
 *      builder populated it.
 *   3. A small derived sentence from primaryConstraint.componentName
 *      so the row still says something useful in sparse-data cases.
 *   4. undefined → the row is gracefully omitted (Profile card handles
 *      independent row data-gating).
 *
 * No engine changes. No builder changes. Pure presentation derivation.
 */
function deriveWhatItTrades(a: AdvisoryResponse): string | undefined {
  if (a.assessmentLimitations && a.assessmentLimitations.length > 0) {
    return a.assessmentLimitations[0];
  }
  if (a.primaryConstraint?.impact) {
    return a.primaryConstraint.impact;
  }
  if (a.primaryConstraint?.componentName) {
    return `${a.primaryConstraint.componentName} is the system's primary constraint.`;
  }
  return undefined;
}

/**
 * Audio XX — System Assessment Artifact.
 *
 * The warm-editorial sibling of the Brand Authority page. Renders a
 * system-assessment response as a 10-section editorial document.
 *
 * Section structure (locked heading set, 2026-05-29):
 *   1.  Your System                       (SystemHero — chart + chain)
 *   2.  Profile                           (SystemProfileCard — 3 lines)
 *   3.  First Impressions                 (introSummary prose)
 *   4.  Character                         (systemContext + systemSynergy)
 *   5.  The Components                    (EditorialSubCard per component)
 *   6.  How They Work Together            (systemInteraction prose)
 *   7.  Strengths and Honest Limits       (two-column grid)
 *   8.  What's Already Working            (EditorialSubCard per kept item)
 *   9.  If You Were to Change Something   (upgradeDirection + paths + sequence)
 *  10.  Sources                           (AdvisorySources)
 *
 * Each section is independently data-gated — renders nothing when its
 * underlying field is absent. The artifact gracefully degrades for
 * sparse responses (consumer-wireless short-circuit, partial chains,
 * etc.) the same way Brand Authority pages degrade for sparse profiles.
 *
 * Visual contract: warm-editorial palette only (see `editorial-tokens.ts`).
 * No cool-slate colors, no chat-bubble chrome, no marketing voice.
 *
 * Gating: the dispatcher in `AdvisoryMessage.tsx` is responsible for
 * checking `SYSTEM_ASSESSMENT_ARTIFACT_ENABLED` before rendering this
 * component. This file does not check the flag itself.
 *
 * Engine, builders, intent classifier, cross-brand resolver, F4 gates,
 * listener-aware framing, listing-eval safety boundaries — none touched.
 */

interface SystemAssessmentArtifactProps {
  advisory: AdvisoryResponse;
}

export default function SystemAssessmentArtifact({
  advisory: a,
}: SystemAssessmentArtifactProps) {
  const hasComponents = !!(a.componentReadings && a.componentReadings.length > 0);
  const hasStrengths = !!(a.assessmentStrengths && a.assessmentStrengths.length > 0);
  const hasLimits = !!(a.assessmentLimitations && a.assessmentLimitations.length > 0);
  const hasStrengthsAndLimits = hasStrengths || hasLimits;
  const hasKeeps = !!(a.keepRecommendations && a.keepRecommendations.length > 0);
  const hasUpgradeDirection = !!a.upgradeDirection;
  const hasUpgradePaths = !!(a.upgradePaths && a.upgradePaths.length > 0);
  const hasSequence = !!(a.recommendedSequence && a.recommendedSequence.length > 0);
  const hasChangeSection = hasUpgradeDirection || hasUpgradePaths || hasSequence;
  // §10 gate: check POST-filter visible sources, not raw input count.
  // hasDisplayableSources() applies the same two-tier whitelist filter
  // that AdvisorySources uses internally — if it returns false, the
  // §10 heading must not render to avoid the orphaned-eyebrow bug
  // documented at source-whitelist.ts:188-205.
  const hasSources = hasDisplayableSources(a.sourceReferences);

  return (
    <article
      aria-label="System Assessment"
      style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '0 1rem',
        color: COLOR.textPrimary,
      }}
    >
      {/* ═══════════ §1 Your System ═══════════ */}
      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={sectionHeadingStyle}>Your System</h2>
        <SystemHero
          spiderChartData={a.spiderChartData}
          systemChain={
            a.systemChain
              ? { names: a.systemChain.names, roles: a.systemChain.roles }
              : undefined
          }
        />
      </section>

      {/* ═══════════ §2 Profile ═══════════ */}
      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={sectionHeadingStyle}>Profile</h2>
        <SystemProfileCard
          whatItIs={a.systemSignature}
          whatItLeansToward={a.tendencies}
          whatItTrades={deriveWhatItTrades(a)}
        />
      </section>

      {/* ═══════════ §3 First Impressions ═══════════ */}
      {a.introSummary && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={sectionHeadingStyle}>First Impressions</h2>
          <p style={proseStyle}>{a.introSummary}</p>
        </section>
      )}

      {/* ═══════════ §4 Character ═══════════
       *  Source: `systemContext` carries the entire legacy MemoFormat
       *  narrative with eight bolded inline sub-headings. Only the
       *  "System read" block belongs here — the rest duplicate other
       *  sections (§7, §8, §9) or duplicate visual chrome (§1 chain
       *  banner restated as arrow narration). `normalizeCharacterProse`
       *  extracts the System-read content and strips the rest. */}
      {(() => {
        const characterProse = normalizeCharacterProse(a.systemContext);
        if (!characterProse && !a.systemSynergy) return null;
        return (
          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={sectionHeadingStyle}>Character</h2>
            {characterProse && <p style={proseStyle}>{characterProse}</p>}
            {a.systemSynergy && (
              <p
                style={{
                  ...proseStyle,
                  marginTop: characterProse ? '0.65rem' : 0,
                  fontStyle: 'italic',
                  borderLeft: `3px solid ${COLOR.accent}`,
                  paddingLeft: '0.9rem',
                }}
              >
                {a.systemSynergy}
              </p>
            )}
          </section>
        );
      })()}

      {/* ═══════════ §5 The Components ═══════════
       *  Cards are built by `buildComponentCards`, which:
       *    - maps each chain name to its matching engine reading by
       *      identity (prefix match) rather than by array index — this
       *      fixes the swap defect where systemChain.names is sorted by
       *      signal-path role while componentReadings preserves
       *      input order;
       *    - strips sentences mentioning products outside the chain
       *      (off-chain drift);
       *    - trims each body to a consistent target word count for
       *      editorial balance.
       *  All transformations are presentation-layer. Engine output is
       *  unchanged; only how the artifact maps and shapes it. */}
      {hasComponents && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={sectionHeadingStyle}>The Components</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {buildComponentCards(
              a.systemChain?.names,
              a.systemChain?.roles,
              a.componentReadings,
            ).map((card, i) => (
              <EditorialSubCard
                key={i}
                name={card.name}
                subtitle={card.role}
                body={card.body}
              />
            ))}
          </div>
        </section>
      )}

      {/* ═══════════ §6 How They Work Together ═══════════
       *  Source: `systemInteraction` can mix true interaction analysis
       *  with single-component product-review drift (specs, brand
       *  history, off-chain product mentions). `normalizeInteractionProse`
       *  drops component-header labels, spec sentences, off-chain
       *  product mentions, and single-component review prose — keeping
       *  only system-level statements and multi-component interaction
       *  sentences. */}
      {(() => {
        const interactionProse = normalizeInteractionProse(
          a.systemInteraction,
          a.systemChain?.names ?? [],
        );
        if (!interactionProse) return null;
        return (
          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={sectionHeadingStyle}>How They Work Together</h2>
            <p style={proseStyle}>{interactionProse}</p>
          </section>
        );
      })()}

      {/* ═══════════ §7 Strengths and Honest Limits ═══════════ */}
      {hasStrengthsAndLimits && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={sectionHeadingStyle}>Strengths and Honest Limits</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
              gap: '1rem',
            }}
          >
            {hasStrengths && (
              <div>
                <h3
                  style={{
                    margin: '0 0 0.4rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: COLOR.textMuted,
                  }}
                >
                  Strengths
                </h3>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: '1.1rem',
                    listStyle: 'disc',
                    fontSize: '0.94rem',
                    lineHeight: 1.65,
                    color: COLOR.textSecondary,
                  }}
                >
                  {a.assessmentStrengths!.map((s, i) => (
                    <li key={i} style={{ marginBottom: '0.2rem', color: '#5a7050' }}>
                      <span style={{ color: COLOR.textSecondary }}>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {hasLimits && (
              <div>
                <h3
                  style={{
                    margin: '0 0 0.4rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: COLOR.textMuted,
                  }}
                >
                  Honest Limits
                </h3>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: '1.1rem',
                    listStyle: 'disc',
                    fontSize: '0.94rem',
                    lineHeight: 1.65,
                    color: COLOR.textSecondary,
                  }}
                >
                  {a.assessmentLimitations!.map((l, i) => (
                    <li key={i} style={{ marginBottom: '0.2rem', color: '#8a6a50' }}>
                      <span style={{ color: COLOR.textSecondary }}>{l}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ═══════════ §8 What's Already Working ═══════════ */}
      {hasKeeps && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={sectionHeadingStyle}>What&rsquo;s Already Working</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {a.keepRecommendations!.map((keep, i) => (
              <EditorialSubCard
                key={i}
                name={keep.name}
                body={keep.reason}
              />
            ))}
          </div>
        </section>
      )}

      {/* ═══════════ §9 If You Were to Change Something ═══════════ */}
      {hasChangeSection && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={sectionHeadingStyle}>If You Were to Change Something</h2>
          {a.upgradeDirection && (
            <p style={{ ...proseStyle, marginBottom: '0.85rem' }}>{a.upgradeDirection}</p>
          )}
          {hasUpgradePaths && (
            <AdvisoryUpgradePaths
              paths={a.upgradePaths!}
              stackedTraits={a.stackedTraitInsights}
              systemCharacterSummary={a.systemSignature}
            />
          )}
          {hasSequence && (
            <div
              style={{
                marginTop: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              {a.recommendedSequence!.map((step) => (
                <EditorialSubCard
                  key={step.step}
                  name={`Step ${step.step}`}
                  body={step.action}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ═══════════ §10 Sources ═══════════ */}
      {hasSources && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={sectionHeadingStyle}>Sources</h2>
          <AdvisorySources sources={a.sourceReferences!} />
        </section>
      )}
    </article>
  );
}
