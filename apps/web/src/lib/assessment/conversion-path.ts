/**
 * Conversion-path authority — what the component list does NOT establish.
 *
 * P1 (2026-09-03, France II): Audio XX knew four components — Eversolo
 * DMP-A6, Chord Hugo, JOB INTegrated, WLM Diva monitor — and reasoned as if
 * it knew a signal path. The review compared "Eversolo conversion vs JOB
 * onboard conversion" while the explicitly supplied Chord Hugo disappeared,
 * because two role lookups each take the FIRST component matching a source
 * role and never look again. Identity does not license topology: a listener
 * who names three DAC-capable boxes has told us what they own, not how the
 * signal moves between them.
 *
 * The invariant this module serves:
 *
 *   COMPONENT IDENTITY MUST NOT IMPLY UNSUPPLIED SIGNAL FLOW.
 *
 * It answers one narrow question — is the conversion path through this
 * system established, or are there materially different plausible paths? —
 * and it answers it deterministically from roles, dossier evidence and the
 * listener's own words. It builds no topology model and asserts no path of
 * its own; ambiguity is a finding, not a graph.
 *
 * Ambiguity rule (kept deliberately narrow so ordinary systems stay
 * frictionless):
 *
 *   - a dedicated external DAC alongside an amplifier whose own evidence
 *     shows onboard conversion → two materially different termination
 *     points for the digital signal → ambiguous;
 *   - two dedicated external DACs → ambiguous;
 *   - everything else — single conversion stage, source-with-DAC into an
 *     analogue amplifier, streamer into dedicated DAC into analogue
 *     integrated, source-with-DAC + converting amplifier with NO third
 *     stage — has one natural reading and proceeds normally.
 *
 * The listener always outranks the inference: an explicit connection
 * statement establishes the path, and an explicit "isn't being used"
 * removes a component from conversion reasoning entirely.
 */

import type { DossierView, DossierLine } from '@/lib/evidence/dossier-presentation';

export interface ConversionStage {
  name: string;
  kind: 'dedicated_dac' | 'source_with_dac' | 'amp_with_dac';
}

export interface ConversionPathAnalysis {
  /** Every component with an evidenced or role-declared conversion stage. */
  stages: ConversionStage[];
  /** Materially different plausible conversion paths, none established. */
  ambiguous: boolean;
  /** The listener stated how components connect; reason over their path. */
  explicit: boolean;
  /** Components the listener said are not in use. */
  excluded: string[];
}

const dossierLines = (d: DossierView): DossierLine[] => [...d.primary, ...d.secondary];

/**
 * Whether a component's own dossier evidences a conversion stage. The same
 * test the review composer already applied to amplifiers — a line that names
 * digital input or D/A conversion — now applied uniformly, so conversion
 * capability is claimed from evidence, never from a role word alone.
 */
function dossierShowsConversion(d: DossierView | undefined): boolean {
  if (!d) return false;
  return dossierLines(d).some((l) =>
    /d\/a|dac|onboard.*conversion|digital.*input/i.test(l.value)
    && /conver|d\/a|dac/i.test(l.value));
}

/**
 * Connection statements. These only ever RESOLVE ambiguity — a false match
 * suppresses a clarifying question, it never creates one — so common verbs
 * like "into" are safe to accept.
 */
const CONNECTOR = /(→|->|\binto\b|\bfeed(?:s|ing)?\b|\bdriv(?:es|ing)\b|\bout\s+(?:to|into)\b|\bthen\s+(?:to|into)\b|\bconnected\s+to\b|\bvia\b)/i;

/** "the Hugo isn't being used", "not connected", "not in the chain". */
const NOT_USED = /\b(?:isn't|is\s+not|not|no\s+longer)\s+(?:being\s+)?(?:used|in\s+use|connected|hooked\s+up|in\s+the\s+chain|in\s+the\s+system)\b|\bunused\b|\bbypass(?:ed|ing)\b/i;

/** Last meaningful token of a display name — "Chord Hugo" → "hugo". */
function nameTokens(displayName: string): string[] {
  return displayName.toLowerCase().split(/[\s/-]+/).filter((t) => t.length > 2);
}

function mentionedIn(text: string, displayName: string): boolean {
  const t = text.toLowerCase();
  return nameTokens(displayName).some((tok) => t.includes(tok));
}

export function analyzeConversionPath(
  components: Array<{ displayName: string; role: string }>,
  dossiers: DossierView[],
  rawMessage?: string,
): ConversionPathAnalysis {
  const dossierFor = (name: string) => dossiers.find((d) => d.displayName === name);

  // Exclusions first: a sentence saying a component is not in use removes it
  // from conversion reasoning before anything is counted.
  const excluded: string[] = [];
  if (rawMessage) {
    const sentences = rawMessage.split(/(?<=[.!?])\s+|\n+/);
    for (const c of components) {
      if (sentences.some((s) => NOT_USED.test(s) && mentionedIn(s, c.displayName))) {
        excluded.push(c.displayName);
      }
    }
  }
  const active = components.filter((c) => !excluded.includes(c.displayName));

  const stages: ConversionStage[] = [];
  for (const c of active) {
    const role = (c.role ?? '').toLowerCase();
    if (role === 'dac') {
      stages.push({ name: c.displayName, kind: 'dedicated_dac' });
    } else if (role === 'streamer_dac') {
      stages.push({ name: c.displayName, kind: 'source_with_dac' });
    } else if ((role === 'streamer' || role === 'source')
      && dossierShowsConversion(dossierFor(c.displayName))) {
      stages.push({ name: c.displayName, kind: 'source_with_dac' });
    } else if ((role === 'integrated' || role === 'amplifier')
      && dossierShowsConversion(dossierFor(c.displayName))) {
      stages.push({ name: c.displayName, kind: 'amp_with_dac' });
    }
  }

  const dedicated = stages.filter((s) => s.kind === 'dedicated_dac').length;
  const ampWithDac = stages.filter((s) => s.kind === 'amp_with_dac').length;

  // Explicit path: a connection statement touching at least two of the
  // system's components. The listener has described flow; we do not
  // second-guess it, and we do not interrogate.
  let explicit = false;
  if (rawMessage && CONNECTOR.test(rawMessage)) {
    const mentioned = components.filter((c) => mentionedIn(rawMessage, c.displayName));
    explicit = mentioned.length >= 2;
  }

  const ambiguous = !explicit
    && ((dedicated >= 1 && ampWithDac >= 1) || dedicated >= 2);

  return { stages, ambiguous, explicit, excluded };
}
