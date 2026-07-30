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
  /**
   * Optional product imagery for each component in the credit line.
   * When present, the artifact renders an editorial three-up photo strip
   * below the standfirst — the system, shown rather than only named.
   * When absent, the credit line is the only naming.
   * Order matches `componentCredit`. A null entry indicates an unknown
   * image for that component; the strip skips it (does not render a
   * placeholder square that would read as broken).
   */
  componentPhotos?: Array<{ src: string; alt: string } | null>;
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
  /**
   * System-level tonal axis readings (e.g. { warm_bright: 'warm', ... }).
   * Carried in the payload so the three-axis Tonal Signature graph survives
   * surfaces that render from the payload alone — the chat embed and saved
   * assessment snapshots — where the raw engine result is not re-threaded.
   * Stabilization Gate 1: the graph is a structurally required artifact
   * element; it must not depend on call-site `raw` threading.
   */
  systemAxes?: Record<string, string>;
}
