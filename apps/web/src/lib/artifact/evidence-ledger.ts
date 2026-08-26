/**
 * The evidence ledger — DERIVED from the assessment, never maintained beside it.
 *
 * THE DEFECT THIS REPLACES. The ledger was built from a hardcoded table of four
 * products (Eversolo, Chord Hugo, JOB, WLM — the FRANCE system). Any assessment
 * outside that table produced no sources at all and fell back to a fixed
 * sentence, so Nathan's artifact — resting on published specifications for four
 * components and three attributed Stereophile observations — ended with
 * "Assessment based on Audio XX analysis of the components as described."
 *
 * That is an independent bibliography, and an independent bibliography drifts
 * from the assessment it describes. This module derives the ledger from the
 * dossiers the snapshot already froze, so the two cannot disagree: a source
 * appears here only because evidence from it survives in the assessment.
 *
 * TWO INDEPENDENT DIMENSIONS, NOT ONE RANKING. A maker's published figure and a
 * reviewer's listening observation are different KINDS of evidence, not
 * different strengths of one kind. They are reported separately and never
 * merged, because merging them is how "Stereophile said the Apex has deeper
 * silences" turns into "Stereophile supports this system assessment".
 *
 * SCOPE TRAVELS WITH THE SOURCE. Every entry records which components it
 * actually licensed something about. Stereophile licensed observations about
 * the dCS Rossini Apex; it licensed nothing about the Butler/Acora power
 * finding, and the ledger must not let a reader infer otherwise.
 */
import type { DossierView } from '@/lib/evidence/dossier-presentation';

export type LedgerClass =
  /** The maker states it about its own product. */
  | 'maker_published'
  /** A named publication heard or measured something. */
  | 'independent_review'
  /** A third party published a measurement it made itself. */
  | 'independent_measurement'
  /** An owner or community member reporting on gear they use. */
  | 'owner_report'
  /** Audio XX's own curated catalog record. */
  | 'catalog'
  /** A third party restates a specification it did not originate. */
  | 'third_party_reported'
  /** A relationship Audio XX derived itself from the evidence above. */
  | 'audio_xx_derived';

/** Reader-facing name for each class. They are kinds, not strengths. */
export const LEDGER_CLASS_LABEL: Record<LedgerClass, string> = {
  maker_published: 'Manufacturer published',
  independent_review: 'Independent review',
  independent_measurement: 'Independent measurement',
  owner_report: 'Owner report',
  catalog: 'Audio XX catalog',
  third_party_reported: 'Third-party reported specification',
  audio_xx_derived: 'Audio XX derived',
};

export interface LedgerEntry {
  /** What the reader sees: a publication, or a maker's name. */
  label: string;
  url?: string;
  evidenceClass: LedgerClass;
  /**
   * The components this source licensed something about — never more.
   *
   * A ledger that listed sources without scope would let a reader carry a
   * reviewer's authority across the whole system. Naming the component is what
   * keeps a source's displayed role equal to the proposition it licensed.
   */
  licensedFor: string[];
}

export interface EvidenceLedger {
  /** One sentence describing what the assessment actually rests on. */
  statement: string;
  entries: LedgerEntry[];
}

const CLASS_OF: Record<string, LedgerClass | undefined> = {
  maker_published: 'maker_published',
  listening_observation: 'independent_review',
  independently_measured: 'independent_review',
  third_party_reported: 'third_party_reported',
  catalog: 'catalog',
};

/**
 * Who published this, stated rather than guessed.
 *
 * An earlier version inferred the maker from the product's display name by
 * counting capitalised words. It read "Butler Monads" as a company called
 * Butler Monads, and would have printed that as the attribution. Guessing an
 * attribution is precisely what a provenance ledger must never do — a wrong
 * credit is worse than a plain one.
 *
 * The host of the source URL is not a guess: it is who served the document.
 * Where there is no URL, the component names itself and the class says the
 * rest ("dCS Rossini Apex — published by the manufacturer").
 */
function publisherLabel(sourceUrl: string | undefined, displayName: string): string {
  if (!sourceUrl) return displayName;
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, '');
  } catch {
    return displayName;
  }
}

/**
 * Build the ledger from the frozen dossiers.
 *
 * Pure and total: given the same dossiers it returns the same ledger, and an
 * assessment holding no attributable evidence returns no entries rather than a
 * reassuring sentence.
 */
/**
 * The shape the ledger needs from the synthesis, stated structurally.
 *
 * Deliberately not an import. This module's dependency list is asserted by the
 * snapshot purity gate, and the ledger needs three fields rather than a
 * module: what survived, who published it, and where. Naming them here keeps
 * the ledger a pure function of frozen material.
 */
export interface LedgerSynthesis {
  character: Map<string, Array<{
    publications: string[];
    support: Array<{ publication: string; sourceUrl: string; observationType?: string }>;
  }>>;
}

export function deriveEvidenceLedger(
  dossiers: DossierView[] | undefined,
  /**
   * Review evidence that survived into the rendered assessment.
   *
   * THE DEFECT THIS CLOSES. The review quoted The Absolute Sound on the ARC
   * and Stereophile and SoundStage! on the Acora, and the EVIDENCE section
   * named none of them — because the ledger read dossier lines only, and
   * review-derived character does not travel as a dossier line. A reader
   * checking what the assessment rested on was shown a bibliography missing
   * the sources of its own strongest claims.
   *
   * Passing the synthesis rather than re-deriving it is the point: an entry
   * appears here only because a proposition built from it survived into the
   * document, so the ledger cannot list a source the review did not use, nor
   * omit one it did.
   */
  synthesis?: LedgerSynthesis,
): EvidenceLedger {
  const byKey = new Map<string, LedgerEntry>();

  for (const d of dossiers ?? []) {
    for (const line of [...d.primary, ...d.secondary]) {
      const cls = line.sourceClass ? CLASS_OF[line.sourceClass] : undefined;
      if (!cls) continue;

      // A publication names itself; a maker's specification is attributed to
      // the maker of the product it describes.
      const label = cls === 'independent_review'
        ? (line.publication ?? 'Independent review')
        : publisherLabel(line.sourceUrl, d.displayName);

      // Keyed by label AND class so one organisation publishing both kinds
      // does not collapse into a single undifferentiated entry.
      const key = `${cls}::${label.toLowerCase()}`;
      const existing = byKey.get(key);
      if (existing) {
        if (!existing.licensedFor.includes(d.displayName)) {
          existing.licensedFor.push(d.displayName);
        }
        existing.url ??= line.sourceUrl;
        continue;
      }
      byKey.set(key, {
        label,
        url: line.sourceUrl,
        evidenceClass: cls,
        licensedFor: [d.displayName],
      });
    }
  }

  /*
   * Review propositions that survived, with their scope.
   *
   * `licensedFor` is the component the proposition is about — never the
   * system. A publication that characterised one loudspeaker has licensed
   * nothing about the amplifier feeding it, and the ledger is the last place
   * that distinction could quietly be lost.
   */
  for (const [component, propositions] of synthesis?.character ?? []) {
    for (const proposition of propositions) {
      for (const observation of proposition.support) {
        const label = observation.publication;
        if (!label) continue;
        const cls: LedgerClass = observation.observationType === 'measurement'
          ? 'independent_measurement'
          : 'independent_review';
        const key = `${cls}::${label.toLowerCase()}`;
        const existing = byKey.get(key);
        if (existing) {
          if (!existing.licensedFor.includes(component)) existing.licensedFor.push(component);
          existing.url ??= observation.sourceUrl;
          continue;
        }
        byKey.set(key, {
          label, url: observation.sourceUrl, evidenceClass: cls, licensedFor: [component],
        });
      }
    }
  }

  const entries = [...byKey.values()].sort((a, b) => {
    // Published specifications lead; observations follow. Not a ranking of
    // authority — a reading order, so the reader meets the maker's own figures
    // before anyone's impression of them.
    // Reading order, not authority: the maker's own figures, then the catalog
    // record, then measurements, then what people heard, then owners.
    const order: LedgerClass[] = [
      'maker_published', 'third_party_reported', 'catalog',
      'independent_measurement', 'independent_review', 'owner_report', 'audio_xx_derived',
    ];
    const rank = (c: LedgerClass) => order.indexOf(c);
    return rank(a.evidenceClass) - rank(b.evidenceClass) || a.label.localeCompare(b.label);
  });

  return { statement: statementFor(entries), entries };
}

/**
 * Describe what the assessment rests on, asserting only classes present.
 *
 * "Audio XX analysis" is always true of a rendered assessment — the reading,
 * the axes and the verdict are ours — and is always last, so the reader sees
 * the external evidence first.
 */
function statementFor(entries: LedgerEntry[]): string {
  const classes = new Set(entries.map((e) => e.evidenceClass));
  const parts: string[] = [];
  if (classes.has('maker_published')) parts.push('published manufacturer specifications');
  if (classes.has('third_party_reported')) parts.push('reported specifications');
  if (classes.has('independent_measurement')) parts.push('independent measurements');
  if (classes.has('owner_report')) parts.push('owner reports, identified as such');
  if (classes.has('independent_review')) {
    const pubs = [...new Set(entries
      .filter((e) => e.evidenceClass === 'independent_review')
      .map((e) => e.label))];
    parts.push(pubs.length === 1
      ? `listening observations published by ${pubs[0]}`
      : 'published listening observations');
  }
  if (classes.has('catalog')) parts.push('the Audio XX catalog');
  parts.push('Audio XX analysis');

  const list = parts.length > 2
    ? `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
    : parts.join(' and ');
  return `Assessment based on ${list}.`;
}
