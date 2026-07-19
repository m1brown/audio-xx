/**
 * Builder → engine text composition (MVP M1).
 *
 * The System Builder produces exactly the phrasing the assessment
 * pipeline is proven on ("Assess my system: A, B, C") and the artifact
 * URL that renders it. Pure functions — the product test suite pins the
 * round-trip: fields → text → URL → decoded text.
 */

/** Compose engine input from builder field values. Null until ≥2 components. */
export function composeSystemText(fields: string[]): string | null {
  const parts = fields
    .map((f) => f.trim().replace(/\s+/g, ' ').replace(/,+$/g, ''))
    .filter(Boolean);
  if (parts.length < 2) return null;
  return `Assess my system: ${parts.join(', ')}`;
}

/** Self-contained, shareable assessment URL for the composed system. */
export function artifactUrlFor(fields: string[]): string | null {
  const text = composeSystemText(fields);
  if (!text) return null;
  return `/artifact?system=${encodeURIComponent(text)}`;
}
