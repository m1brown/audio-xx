/**
 * QA harness — fixture schema (development/test infrastructure only).
 *
 * The harness observes Audio XX through its real entry points and evaluates
 * the observations against per-case semantic expectations. Nothing here is
 * product architecture: cases declare WHAT must hold, the invariant engine
 * decides whether it held, and the report says which layer owns a failure.
 *
 * Three tiers:
 *   TIER 1  deterministic invariants — blocking.
 *   TIER 2  semantic golden expectations — blocking where deterministic.
 *   TIER 3  soft advisory evaluation — observational, never blocks.
 */

export type Layer = 'identity' | 'evidence' | 'reasoning' | 'advisory';

export type Degradation = 'assessment' | 'clarification' | 'low_confidence';

export type HeadroomState =
  | 'generous'
  | 'workable'
  | 'condition-dependent'
  | 'constrained'
  | 'unresolved'
  | 'none';

/** One dossier line of maker-published evidence for the compose stage. */
export interface EvidenceLine {
  component: string;
  label: string;
  value: string;
}

/** A deterministic drive-lane check (parse → assess → conclude). */
export interface DriveCheck {
  power: [name: string, value: string];
  impedance: [name: string, value: string];
  sensitivity: [name: string, value: string];
  expectStatus: 'assessable' | 'load_mismatch' | 'incomplete';
  must?: RegExp[];
  mustNot?: RegExp[];
}

export interface GoldenCase {
  /** Stable slug; also the targeted-P1 selector. */
  id: string;
  /** The distinct semantic condition this case exists to exercise. */
  why: string;
  /** Canonical input, as a listener would type it. */
  input: string;
  /**
   * Expected physical component set: each entry must match exactly one
   * extracted identity ("brand name", lowercased). Count is the physical
   * unit count unless `physicalUnits` overrides it.
   */
  components: RegExp[];
  physicalUnits?: number;
  /** Patterns that must match NO extracted identity (phantoms). */
  forbidden?: RegExp[];
  /** Expected category per component pattern index, where material. */
  roles?: Partial<Record<number, RegExp>>;
  /** Accepted end-to-end kinds. Default: ['assessment']. */
  allowedKinds?: Degradation[];
  /**
   * Component designations as typed, for the mutation engine
   * (e.g. ['Accuphase E-600', 'Accuphase DP-450', 'Harbeth SHL5 Plus']).
   * Cases without parts get no generated mutations.
   */
  parts?: string[];
  /** Extra fixed mutation inputs (permanent landmarks). */
  landmarkMutations?: Array<{ label: string; input: string; lossy?: boolean }>;
  /** Generate the standard mutation set from `parts`. */
  standardMutations?: boolean;
  /** Compose-stage evidence (maker_published dossier lines). */
  evidence?: EvidenceLine[];
  /** Compose-stage roles by displayName (defaults derived from `roles`). */
  composeRoles?: Record<string, string>;
  /** Expected single coherent headroom state of the composed output. */
  headroom?: HeadroomState;
  /** TIER 2 semantic expectations over the composed output. */
  must?: Array<{ id: string; re: RegExp }>;
  mustNot?: Array<{ id: string; re: RegExp }>;
  /** Deterministic drive-lane check (evidence layer). */
  drive?: DriveCheck;
  /** Whether the case declares admitted listening evidence (default false). */
  hasListeningEvidence?: boolean;
  /** TIER 3 observational questions for the soft judge. */
  soft?: string[];
  /** Related case ids for targeted-P1 runs. */
  related?: string[];
  /**
   * Skip extraction-level identity invariants — used only where a KNOWN P2
   * makes the extraction-level set unstable while the end-to-end outcome
   * stays safe (each use must name the P2 in `why`).
   */
  skipIdentity?: boolean;
  /** Multi-load power ladder pins: value string → expected watts per load. */
  ladder?: { value: string; expect: Record<number, number | undefined> };
}

/** One evaluated observation of a case (base input or a mutation). */
export interface Observation {
  caseId: string;
  mutation: string; // 'base' or the mutation label
  input: string;
  /** Extracted identities, "brand name" lowercased, sorted. */
  identities: string[];
  /** Extracted categories aligned with identities. */
  categories: string[];
  /** End-to-end kind + chain, when observed. */
  kind?: string;
  chainNames?: string[];
  /** Composed deterministic review text, when the case declares evidence. */
  composedText?: string;
  /** Declared evidence (for provenance checks). */
  evidence?: EvidenceLine[];
}

export interface Failure {
  caseId: string;
  mutation: string;
  layer: Layer;
  invariant: string;
  expected: string;
  actual: string;
  owningStage: string;
}
