/**
 * Assessment Snapshot — the frozen representation of an assessment Audio XX
 * already produced.
 *
 * GOVERNING DOCTRINE (founder, 2026-08-22):
 *
 *   An Assessment Artifact is a frozen representation of an assessment Audio XX
 *   already produced. Opening, printing or sharing it must never cause the
 *   system to reassess the equipment.
 *
 * THE DEFECT THIS FIXES. `/artifact?system=<text>` carried the ENGINE INPUT and
 * re-ran `buildSystemAssessment` on every open. Three consequences, all
 * observed on production:
 *
 *   Nathan did not render at all — "I couldn't read that as a system" — because
 *   his components are uncatalogued and the artifact route implements only the
 *   deterministic catalog path.
 *
 *   Leben/Cornwall rendered a DIFFERENT assessment from the conversation: a
 *   different product resolved (CS600X, not CS600), a different axis value
 *   (detailed, not balanced) and a different standfirst.
 *
 *   Every open re-derived against whatever the engine had become, so a link
 *   shared today would say something else next month.
 *
 * The authoritative object is therefore the assessment RESULT, not the input.
 * This module defines that result as a self-contained value: everything the
 * artifact renders and nothing it would need to recompute.
 *
 * WHY NOT `ArtifactPayload`. The existing `AssessmentSnapshot` row stores one,
 * and it is not sufficient. `toCanonicalAssessment(payload, raw)` reads `raw`
 * for the listening session, and `primarySources` are looked up from catalog
 * data at render time — so a stored payload still re-derives, and still drifts
 * when the catalog changes. A snapshot has to hold the RESOLVED output.
 *
 * WHY ONE SHAPE FOR TWO PATHS. Audio XX has two reasoning paths — the
 * deterministic catalog path and the provisional path for uncatalogued systems
 * — and the artifact surface implemented only the first. One snapshot shape
 * with two adapters is what makes "one assessment, multiple surfaces" true
 * rather than aspirational.
 */
import type { AxisReading, CanonicalAssessment, PrimarySource } from './canonical';
import { deriveEvidenceLedger, type EvidenceLedger } from './evidence-ledger';
import { composeSystemReview } from './system-review';
import type { DossierView } from '../evidence/dossier-presentation';

export const ASSESSMENT_SCHEMA_V1 = 'axx.assessment.v1' as const;

/** One titled block of assessment prose, in reading order. */
export interface SnapshotSection {
  /** Rendered heading. Absent = unlabelled prose, as the conversation shows it. */
  label?: string;
  paragraphs: string[];
}

/** A licensed relation, recorded as it was licensed. Never re-derived. */
export interface SnapshotRelation {
  components: [string, string];
  axis: string;
  kind: string;
  tier: string;
  publications?: string[];
  conditions?: string[];
}

export interface AssessmentSnapshotV1 {
  /** Identifies the frozen historical representation. */
  schema: typeof ASSESSMENT_SCHEMA_V1;
  /** ISO instant the assessment was produced. */
  createdAt: string;
  /** Engine build that produced it. Provenance only — never a re-run key. */
  engineVersion: string;
  /**
   * Which reasoning path produced this assessment.
   *
   * Recorded for provenance and rendering shape. It is NOT a re-derivation
   * key: nothing downstream may consult it to decide how to reassess.
   */
  origin: 'catalog' | 'provisional';

  /** Component identities AS DISPLAYED, with the basis shown beside them. */
  components: Array<{ name: string; role?: string; basis?: string }>;

  verdict: string;
  /** A material limitation on the verdict. Rendered subordinate to it. */
  qualification?: string;
  standfirst?: string;
  actionVerdict?: string;
  recognition?: string;
  tonalSignature?: AxisReading[];
  recommendation?: string;
  cost?: string;

  /** The assessment body, in reading order. */
  sections: SnapshotSection[];
  operatingCondition?: string;
  /** The diagnostic question the assessment closed on. */
  question?: string;

  /**
   * Component dossiers, exactly as the presentation layer resolved them.
   *
   * Carried rather than recomputed. The artifact previously rendered NEITHER
   * dossiers nor the tonal signature, so `VIEW ASSESSMENT` showed strictly
   * less than the conversation it froze — four component cards on Nathan and
   * the Warm/Balanced/Elastic graph on FRANCE simply disappeared.
   *
   * `DossierView` already holds the primary/secondary/gap decisions. The
   * renderer displays them and makes none of its own: a second editorial
   * selection layer is how two surfaces start disagreeing about what is known.
   */
  componentDossiers?: DossierView[];

  relations?: SnapshotRelation[];
  /** What Audio XX did not hold, as stated to the listener. */
  coverageNote?: string;
  evidenceStatement: string;
  primarySources?: PrimarySource[];
  /**
   * The evidence ledger, DERIVED from this snapshot's own dossiers.
   *
   * Supersedes `evidenceStatement` + `primarySources`, which were built from a
   * hardcoded table of four products and were therefore empty — and silently
   * generic — for every other system. Those fields remain so snapshots frozen
   * before this contract still render; new snapshots carry the ledger.
   */
  evidenceLedger?: EvidenceLedger;
  /**
   * The system-level analysis, composed from the evidence this snapshot holds.
   *
   * Frozen with everything else, so the conversation, the artifact and the PDF
   * read one review rather than three renderings of one payload.
   */
  systemReview?: string[];
}

/** The shape the provisional path produces, narrowed to what a snapshot needs. */
export interface ProvisionalAssessmentLike {
  subject?: string;
  systemSignature?: string;
  qualification?: string;
  philosophy?: string;
  tendencies?: string;
  followUp?: string;
  actionVerdict?: string;
  systemRelations?: Array<{
    components: [string, string]; axis: string; kind: string; tier: string;
  }>;
  componentProvenance?: Array<{ name: string; basis: string }>;
}

const paragraphs = (v: string | undefined): string[] =>
  (v ?? '').split(/\n\n+/).map((p) => p.trim()).filter(Boolean);

/**
 * Freeze a catalog-path assessment.
 *
 * Reads the Canonical Assessment Model, which is already the presentation-
 * neutral boundary the renderer consumes — so this copies resolved values and
 * computes nothing. `coverageNote` has no catalog-path equivalent; the
 * evidence statement carries that role there.
 */
export function snapshotFromCanonical(
  cam: CanonicalAssessment,
  meta: {
    engineVersion: string; createdAt: string; actionVerdict?: string;
    componentDossiers?: DossierView[];
  },
): AssessmentSnapshotV1 {
  const sections: SnapshotSection[] = [];
  if (cam.reading.engineering.length) {
    sections.push({ label: 'Engineering', paragraphs: cam.reading.engineering });
  }
  if (cam.reading.listeningSession.length) {
    sections.push({ label: 'Listening Session', paragraphs: cam.reading.listeningSession });
  }
  if (cam.reading.dominantCharacter) {
    sections.push({ paragraphs: [cam.reading.dominantCharacter] });
  }

  return {
    schema: ASSESSMENT_SCHEMA_V1,
    createdAt: meta.createdAt,
    engineVersion: meta.engineVersion,
    origin: 'catalog',
    components: cam.subject.components.map((c) => ({ name: c.name })),
    verdict: cam.identity.verdict,
    standfirst: cam.identity.signature,
    actionVerdict: meta.actionVerdict,
    recognition: cam.identity.recognition || undefined,
    tonalSignature: cam.identity.tonalSignature,
    recommendation: cam.guidance.recommendation,
    cost: cam.guidance.oneCost,
    sections,
    operatingCondition: cam.reading.operatingCondition,
    componentDossiers: meta.componentDossiers,
    evidenceStatement: cam.evidence.statement,
    primarySources: cam.evidence.primarySources,
    // Derived from the dossiers this snapshot froze, so the ledger cannot
    // drift from the assessment it describes.
    evidenceLedger: deriveEvidenceLedger(meta.componentDossiers),
  };
}

/**
 * Freeze a provisional-path assessment.
 *
 * This is the path the artifact surface never had. Nathan's assessment —
 * derived quantity finding, named gap, coverage limitation, diagnostic
 * question — existed only inside the conversation and could not be viewed,
 * printed or shared at all.
 *
 * The conversation renders `systemSignature` as the lead and `philosophy` /
 * `tendencies` as unlabelled prose, so the snapshot records them unlabelled
 * too. Section LABELS are a rendering decision; inventing them here would be
 * the artifact reinterpreting the assessment, which is the whole defect.
 */
export function snapshotFromProvisional(
  response: ProvisionalAssessmentLike,
  meta: {
    engineVersion: string;
    createdAt: string;
    components: Array<{ name: string; role?: string }>;
    /** The coverage statement, when the assessment carried one. */
    coverageNote?: string;
    componentDossiers?: DossierView[];
  },
): AssessmentSnapshotV1 {
  const basisFor = new Map(
    (response.componentProvenance ?? []).map((p) => [p.name, p.basis]));

  const body = [...paragraphs(response.philosophy), ...paragraphs(response.tendencies)];
  // The coverage statement is already inside `philosophy` when the engine
  // emitted one — it is appended there after filtering. Recording it a second
  // time as a section would print it twice.
  /**
   * The engine's prose was written for a CHAT TURN, and the artifact is a
   * document. Rendered whole after the composed review it produced two voices
   * on one page — "I can place 3 components in the chain", "if you tell me
   * more" — a third statement of the chain the header already carries, and
   * per-component character notes sitting inside a system-level section.
   *
   * Each part is routed to where it belongs rather than dropped:
   *
   *   - a paragraph opening "<Component> — …" is about ONE component, so it
   *     joins that component's dossier in YOUR SYSTEM;
   *   - a paragraph that only restates the chain is omitted, because the
   *     document states the chain once, at the top;
   *   - first-person chat register is omitted from the DOCUMENT only. It
   *     carries no proposition the coverage note does not carry in editorial
   *     voice, and the conversation still renders it unchanged — this is a
   *     routing decision about one surface, not a deletion of content.
   */
  const componentNames = meta.components.map((c) => c.name);
  const restatesChain = (p: string) =>
    componentNames.length >= 2 && componentNames.every((n) => p.includes(n)) && p.length < 220;
  const chatRegister = (p: string) => /^(?:I can|I have|I'd|I would|What this means in practice)/.test(p.trim());
  const componentPrefix = (p: string) =>
    componentNames.find((n) => p.trim().startsWith(`${n} —`) || p.trim().startsWith(`${n} -`));

  const systemProse: string[] = [];
  const perComponent = new Map<string, string[]>();
  for (const p of body) {
    const owner = componentPrefix(p);
    if (owner) {
      perComponent.set(owner, [...(perComponent.get(owner) ?? []), p]);
      continue;
    }
    if (restatesChain(p) || chatRegister(p)) continue;
    systemProse.push(p);
  }

  const dossiers = meta.componentDossiers?.map((d) => {
    const notes = perComponent.get(d.displayName);
    return notes ? { ...d, character: notes.join(' ') } : d;
  });

  const sections: SnapshotSection[] = systemProse.length ? [{ paragraphs: systemProse }] : [];

  /**
   * The system-level analysis, reasoned across the dossiers this snapshot
   * already holds. It replaces the three-sentence review: a finding, its
   * qualification and a coverage note, followed by four specification sheets
   * with nothing in between explaining the system.
   *
   * Deterministic and evidence-gated — every paragraph names the facts it
   * rests on, and a paragraph whose facts are absent is not emitted.
   */
  const systemReview = composeSystemReview({
    components: meta.components.map((c) => ({
      displayName: c.name, role: c.role ?? '',
    })),
    dossiers: meta.componentDossiers ?? [],
    driveFinding: response.systemSignature ?? undefined,
    driveQualification: response.qualification,
    coverageNote: meta.coverageNote,
  });

  return {
    schema: ASSESSMENT_SCHEMA_V1,
    createdAt: meta.createdAt,
    engineVersion: meta.engineVersion,
    origin: 'provisional',
    components: meta.components.map((c) => ({
      name: c.name, role: c.role, basis: basisFor.get(c.name),
    })),
    verdict: response.systemSignature ?? '',
    qualification: response.qualification,
    actionVerdict: response.actionVerdict,
    sections,
    question: response.followUp,
    relations: (response.systemRelations ?? []).map((r) => ({
      components: r.components, axis: r.axis, kind: r.kind, tier: r.tier,
    })),
    componentDossiers: dossiers,
    coverageNote: meta.coverageNote,
    systemReview,
    // DERIVED, not fixed. The previous fixed string was chosen because
    // asserting source classes the path does not hold would be a false claim —
    // correct reasoning, wrong remedy. The path DOES hold evidence: its
    // dossiers carry published specifications and attributed observations, each
    // with its own source class. Deriving from them asserts exactly what is
    // there and nothing more, which is what the fixed string was protecting.
    evidenceStatement: deriveEvidenceLedger(meta.componentDossiers).statement,
    evidenceLedger: deriveEvidenceLedger(meta.componentDossiers),
  };
}

/**
 * Serialize for storage, with stable key order so equal snapshots compare equal.
 *
 * Hand-rolled because `JSON.stringify(v, Object.keys(v).sort())` does NOT sort
 * keys — the second argument is a recursive ALLOWLIST, so it silently deleted
 * every nested key that did not happen to appear at the top level. That
 * emptied `sections[]` on the way into storage. Caught by the round-trip test;
 * it would otherwise have corrupted every snapshot ever written.
 */
export function freezeSnapshot(s: AssessmentSnapshotV1): string {
  const stable = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(stable);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.keys(v as Record<string, unknown>).sort()
        .map((k) => [k, stable((v as Record<string, unknown>)[k])]));
    }
    return v;
  };
  return JSON.stringify(stable(s));
}

/**
 * Read a stored snapshot.
 *
 * Rejects an unknown schema rather than best-effort rendering it. A snapshot
 * whose shape we do not recognise is a historical record we cannot faithfully
 * display, and displaying it approximately is the same failure as re-running
 * it: the listener sees something other than what was assessed.
 */
export function parseSnapshot(json: string): AssessmentSnapshotV1 | null {
  try {
    const v = JSON.parse(json) as AssessmentSnapshotV1;
    if (v?.schema !== ASSESSMENT_SCHEMA_V1) return null;
    if (typeof v.verdict !== 'string' || !Array.isArray(v.sections)) return null;
    return v;
  } catch {
    return null;
  }
}
