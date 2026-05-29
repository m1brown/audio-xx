/**
 * Audio XX — runtime feature flags.
 *
 * Conventions:
 *   - One named export per flag — never a generic map. Keeps imports
 *     greppable and dead-code removal trivial when a flag is retired.
 *   - All flags read from `process.env.NEXT_PUBLIC_*` at module load.
 *     Reading once (not per-render) keeps SSR + client semantics
 *     identical and avoids hydration mismatch.
 *   - Truthy value: the literal string `'on'`. Anything else, including
 *     `'true'`, `'1'`, `undefined`, is treated as off. The narrow rule
 *     prevents "did we set it to true or 1?" ambiguity in CI / Vercel.
 *   - Tests can override by mutating `process.env.<NAME>` BEFORE
 *     importing the module under test (see brand-authority-preview tests).
 *
 * Adding a new flag:
 *   1. Add `export const <NAME>: boolean = ...` below.
 *   2. Document the safe-off behaviour in the JSDoc.
 *   3. Reference the env var name explicitly in the doc so ops can grep.
 */

/**
 * Brand Authority Preview tile renderer gate.
 *
 * Env var: `NEXT_PUBLIC_BRAND_AUTHORITY_PREVIEW=on`
 *
 * - **On**: bare-brand consultation responses render a compact authority
 *   tile above the prose, with a CTA link to `/brand/[slug]`.
 * - **Off (default)**: tile is suppressed; chat surface is unchanged.
 *
 * Safe-off invariant: every other code path (data population, tests,
 * cross-brand resolver, follow-up dispatch) is identical whether the
 * flag is on or off. Flipping the flag is a pure UI surface change.
 */
export const BRAND_AUTHORITY_PREVIEW_ENABLED: boolean =
  process.env.NEXT_PUBLIC_BRAND_AUTHORITY_PREVIEW === 'on';

/**
 * System Assessment Artifact renderer gate.
 *
 * Env var: `NEXT_PUBLIC_SYSTEM_ASSESSMENT_ARTIFACT=on`
 *
 * - **On**: system_assessment intent responses render via the new
 *   `SystemAssessmentArtifact` component (warm-editorial Brand Authority
 *   sibling) instead of the legacy `MemoFormat`.
 * - **Off (default)**: existing `MemoFormat` renders unchanged.
 *
 * Safe-off invariant: the advisory engine, builders, intent dispatcher,
 * cross-brand resolver, and all existing tests are identical whether
 * the flag is on or off. Flipping the flag is a pure presentation
 * surface change.
 */
export const SYSTEM_ASSESSMENT_ARTIFACT_ENABLED: boolean =
  process.env.NEXT_PUBLIC_SYSTEM_ASSESSMENT_ARTIFACT === 'on';
