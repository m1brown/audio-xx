/**
 * Audio XX — URL slug helper.
 *
 * Deterministic, lossy normalization for routing only. Inputs are user-facing
 * strings ("DeVore Fidelity", "Hugo TT 2", "Safe — same direction, finer
 * resolution"); output is a kebab-case ASCII slug suitable for a URL segment.
 *
 * Portability note: this helper has no audio-domain reasoning. It would work
 * unchanged in any product-routing context.
 */

export function toSlug(s: string | undefined | null): string {
  if (!s) return '';
  return s
    .toLowerCase()
    // Replace any run of non-alphanumeric characters with a single hyphen.
    .replace(/[^a-z0-9]+/g, '-')
    // Collapse leading/trailing hyphens.
    .replace(/^-+|-+$/g, '');
}
