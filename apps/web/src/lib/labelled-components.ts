/**
 * Explicit component labels — the graph structure the user stated outright.
 *
 * Real-user beta defect (2026-08-15). A tester submitted:
 *
 *   Assess my system: Pre-amp: ARC ref 5 Amps: Butler Monads
 *   Dac/Streamer: dCS Rossini Apex Speakers: Acora QRC-2
 *
 * and got no assessment. Three separate mechanisms failed on a description
 * that is about as explicit as a system description can be:
 *
 *   1. "Dac/Streamer:" was split on "/" as if it were a CHAIN separator, so
 *      only the half after the slash survived as the role. The failure was a
 *      pure ordering artifact — "Streamer/DAC:" assessed cleanly while
 *      "Dac/Streamer:" did not, because the second word happened to match the
 *      catalog category. The same true statement passed or failed on word
 *      order alone.
 *
 *   2. Role for brand-resolved components was inferred from a fixed
 *      ±40-CHARACTER window around the name, with priority stream→dac→amp.
 *      Whether "streamer" fell inside that window depended on the character
 *      length of the preceding label, so a component's role was effectively
 *      decided by typography. That is what made the dCS "appear as an
 *      amplifier" — the window reached forward into the next "Amp:" label.
 *
 *   3. Components the catalog could not resolve were dropped SILENTLY. The
 *      assessment then described "your system" having quietly discarded a
 *      node the user named.
 *
 * This module replaces all three with one idea: when the user writes
 * `<role label>: <name>`, that is a stated fact about their system, and it is
 * the best evidence available about the graph — better than proximity, better
 * than catalog inference, and independent of whether we have ever heard of
 * the component.
 *
 * ── Doctrine boundary ────────────────────────────────────────────────
 *
 * This distinguishes two questions the implementation had conflated:
 *
 *   A. Is the system GRAPH trustworthy?      → explicit labels can establish it
 *   B. Do we KNOW anything about each node?  → only the catalog can establish it
 *
 * Catalog coverage governs what Audio XX may SAY about a node. It does not
 * govern whether the node may EXIST in the graph. An unresolved component
 * becomes an opaque node: name preserved verbatim, role preserved from the
 * label, characteristics unknown and never invented.
 *
 * The graph-integrity doctrine is unchanged — an untrusted graph is still not
 * assessed. This narrows what "untrusted" means: a graph the user labelled
 * explicitly is trusted structurally, even where identity coverage is partial.
 *
 * Scope is deliberately narrow. This reads ONLY explicit `label:` syntax.
 * Ambiguous prose grants no structure and must continue through the existing
 * inference path.
 */

/**
 * Role words that may appear in a label, mapped to the canonical role.
 *
 * Ordered longest-first within each family so "pre-amp" claims its text
 * before "amp" can, and "tone arm" before "arm".
 */
const LABEL_ROLE_WORDS: Array<{ word: RegExp; role: string }> = [
  // "Pre" alone is how most people label a preamplifier, and it did not match:
  // "amp" was required after "pre". An ARC Reference 5 behind a `Pre:` label
  // resolved as an AMPLIFIER, collided with the power amp, and a textbook
  // pre/power separates system was stopped to ask which of the two had
  // replaced the other instead of being assessed. Kept first in the family so
  // "pre-amp" still claims its own text before the bare form or "amp" can.
  { word: /pre[-\s]?amp(?:lifier)?s?/, role: 'preamplifier' },
  { word: /pre/, role: 'preamplifier' },
  { word: /power[-\s]?amp(?:lifier)?s?/, role: 'amplifier' },
  { word: /integrated(?:\s+amp(?:lifier)?)?s?/, role: 'integrated' },
  { word: /amp(?:lifier)?s?/, role: 'amplifier' },
  { word: /stream(?:er|ing)?s?/, role: 'streamer' },
  { word: /dacs?/, role: 'dac' },
  { word: /transports?/, role: 'transport' },
  { word: /speakers?|loudspeakers?|monitors?/, role: 'speaker' },
  { word: /headphones?|cans/, role: 'headphone' },
  { word: /turntables?|decks?/, role: 'turntable' },
  { word: /tone\s*arms?/, role: 'tonearm' },
  { word: /cartridges?/, role: 'cartridge' },
  { word: /phono(?:\s+stages?)?/, role: 'phono' },
  { word: /sources?/, role: 'source' },
];

/**
 * `source:` names a position in the chain, not a product class. A user who
 * writes "Source: dCS Rossini Apex" has said something true and useful about
 * structure while saying nothing that could contradict the catalog. It
 * therefore expands to every class that can legitimately occupy that slot, so
 * a catalogued DAC, streamer or turntable in a `source:` slot agrees rather
 * than conflicts — while "Source: Harbeth P3ESR" still conflicts, because a
 * loudspeaker cannot be one.
 */
const SOURCE_ROLE_EXPANSION = ['source', 'dac', 'streamer', 'transport', 'turntable'];

/** Joiners that mean "this one component performs both functions". */
const ROLE_JOINER = String.raw`\s*(?:\/|\+|&|,|\band\b)\s*`;

const ROLE_WORD_UNION = LABEL_ROLE_WORDS.map(({ word }) => word.source).join('|');

/**
 * A label: one or more role words joined by / + & "and" or "," then a colon.
 * Anchored at a word boundary so "my dac:" matches but "cardac:" does not.
 */
const LABEL_RE = new RegExp(
  String.raw`\b((?:${ROLE_WORD_UNION})(?:${ROLE_JOINER}(?:${ROLE_WORD_UNION}))*)\s*:`,
  'gi',
);

export interface LabelledComponent {
  /** The component name exactly as the user typed it. Never normalised. */
  rawName: string;
  /**
   * Every role the label assigns to this ONE component. A compound label
   * ("DAC/Streamer") yields several. Order-independent by construction:
   * "DAC/Streamer" and "Streamer/DAC" produce the same set.
   */
  roles: string[];
  /** The label text as written, for provenance and diagnostics. */
  labelText: string;
  /** Character offset of the name, so callers can order the chain. */
  index: number;
}

/** Canonical roles named by one label, deduped, order-independent. */
function rolesFromLabel(labelText: string): string[] {
  const parts = labelText
    .split(new RegExp(ROLE_JOINER, 'i'))
    .map((p) => p.trim())
    .filter(Boolean);

  const roles = new Set<string>();
  for (const part of parts) {
    for (const { word, role } of LABEL_ROLE_WORDS) {
      if (new RegExp(`^(?:${word.source})$`, 'i').test(part)) {
        if (role === 'source') SOURCE_ROLE_EXPANSION.forEach((r) => roles.add(r));
        else roles.add(role);
        break;
      }
    }
  }
  return [...roles];
}

/**
 * Parse explicit `<role label>: <name>` pairs from a message.
 *
 * A component's name runs from its colon to the start of the next label, or
 * to the end of the message. Returns [] when the message carries no explicit
 * labels — the caller must then fall through to the existing inference path,
 * because this module never guesses structure from prose.
 */
export function parseLabelledComponents(message: string): LabelledComponent[] {
  if (!message) return [];

  const matches: Array<{ start: number; end: number; labelText: string }> = [];
  LABEL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LABEL_RE.exec(message)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length, labelText: m[1] });
  }
  if (matches.length === 0) return [];

  const out: LabelledComponent[] = [];
  for (let i = 0; i < matches.length; i++) {
    const here = matches[i];
    const next = matches[i + 1];
    const rawSegment = message.slice(here.end, next ? next.start : message.length);

    // Trim separators and trailing connective words the next label left behind.
    const rawName = rawSegment
      .replace(/^[\s,;:—–-]+/, '')
      .replace(/[\s,;:.!?—–]+$/, '')
      .replace(/\s+(?:and|with|plus)$/i, '')
      .trim();

    if (!rawName) continue;
    // A name that is itself only role words is a label fragment, not a product.
    if (rolesFromLabel(rawName).length > 0 && rawName.split(/\s+/).length <= 2) continue;

    const roles = rolesFromLabel(here.labelText);
    if (roles.length === 0) continue;

    out.push({
      rawName,
      roles,
      labelText: here.labelText.trim(),
      index: here.end,
    });
  }
  return out;
}

/**
 * Does the catalog's category for a component contradict what the user's
 * label said? Agreement with ANY labelled role is agreement — a multi-function
 * product is not a conflict, and the user is not required to resolve our
 * taxonomy for us (D-8).
 */
export function labelContradictsCategory(roles: string[], catalogCategory: string): boolean {
  if (roles.length === 0 || !catalogCategory) return false;
  const EQUIV: Record<string, string> = {
    amplifier: 'amplification',
    integrated: 'amplification',
    'integrated-amplifier': 'amplification',
    preamplifier: 'preamplification',
    preamp: 'preamplification',
  };
  const norm = (r: string) => EQUIV[r] ?? r;
  const catNorm = norm(catalogCategory.toLowerCase());
  return !roles.some((r) => norm(r) === catNorm);
}

/**
 * Reconcile an already-resolved node list against the explicit labels.
 *
 * THIS IS THE SINGLE MATCHING RULE. Three surfaces need to agree on what
 * components a message describes — the assessment graph, the recognition line,
 * and the save-system banner — and the beta defect was precisely that they did
 * not: the graph held four components while two other surfaces still showed
 * "Dcs, ARC" because each reconstructed the list its own way. Any surface that
 * needs the answer calls this; none of them re-derives it.
 *
 * Returns, for every label, the index of the node that already represents it
 * (or -1 when nothing does), so each caller can apply the result in its own
 * shape without duplicating the decision.
 */
export interface LabelReconciliation {
  hasLabels: boolean;
  matches: Array<{ label: LabelledComponent; existingIndex: number }>;
}

export function reconcileWithLabels(
  message: string,
  existingNames: string[],
): LabelReconciliation {
  const labels = parseLabelledComponents(message);
  if (labels.length === 0) return { hasLabels: false, matches: [] };

  const lower = existingNames.map((n) => n.toLowerCase().trim());
  const matches = labels.map((label) => {
    const target = label.rawName.toLowerCase().trim();
    const existingIndex = lower.findIndex(
      (n) => n === target || n.includes(target) || target.includes(n),
    );
    return { label, existingIndex };
  });
  return { hasLabels: true, matches };
}

/**
 * Split a user-typed component name into brand and model for surfaces that
 * store the two separately. The first token is the brand — "Butler Monads"
 * becomes Butler / Monads. This is a display convenience, never a claim that
 * the brand was recognised.
 */
export function splitUserSuppliedName(rawName: string): { brand: string; name: string } {
  const parts = rawName.trim().split(/\s+/);
  if (parts.length === 1) return { brand: parts[0], name: '' };
  return { brand: parts[0], name: parts.slice(1).join(' ') };
}

/**
 * Which name should a node carry — the one we resolved, or the one the
 * listener typed?
 *
 * Brand recognition alone reduces "ARC ref 5" to "Arc" and "dCS Rossini Apex"
 * to "Dcs". That impoverished form then reads as a bare brand concealing a
 * model, which trips the graph gate into asking for a model the listener
 * already supplied. Their words carry strictly more information, so when the
 * label is richer it wins.
 *
 * Shared so the assessment graph and the save prompt cannot disagree about
 * what a component is called.
 */
export function preferUserSuppliedName(existing: string, rawName: string): string {
  const tokens = (v: string) => v.trim().split(/\s+/).filter(Boolean).length;
  return tokens(rawName) > tokens(existing) ? rawName : existing;
}
