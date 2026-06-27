/**
 * Audio XX — Assessment Artifact payload contract.
 * The renderer's static slots. Filled by the synthesizer (Milestone 2) from
 * existing engine output; never authored by hand in production.
 */
export interface ArtifactPayload {
  /** Peak 1 — the decisive finding, one sentence. */
  verdict: string;
  standfirst?: string;
  /** The system, named — taken from the engine's clean component list. */
  componentCredit: string[];
  /** One short paragraph: what this system is. */
  recognition: string;
  /** The case, as shortening beats. */
  caseParagraphs: string[];
  /** Present only when the engine reports an objective limit (e.g. power). */
  heroDatum?: { value: string; caption: string };
  pullQuote?: string;
  /** Peak 2 — one owned line (a change, or restraint). Mirrors engine leverage. */
  recommendation: string;
  /** Present only when the engine recommends a product. Absent = dignified blank. */
  figure?: { src: string; alt: string; caption: string };
  cost?: string;
  date: string;
  /** Reserved for when assessments become stable, addressable artifacts.
   *  Held back in beta — a date is sufficient provenance. */
  edition?: string;
}
