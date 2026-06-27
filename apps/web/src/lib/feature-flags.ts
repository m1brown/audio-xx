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

/**
 * Brand House Voicing surface gate (Phase E-5B.2).
 *
 * Env var: `NEXT_PUBLIC_BRAND_HOUSE_VOICING=on`
 *
 * - **On**: §5 component cards in the System Assessment Artifact may
 *   surface a single brand-house-voicing sentence after the existing
 *   contribution prose, subject to the gate stack documented in
 *   `apps/web/src/lib/brand-house-voicing-gates.ts`.
 * - **Off (default)**: §5 cards render unchanged from Stage E-5B.1.
 *
 * Safe-off invariant: the data layer (`brand-house-voicing.ts`) and
 * the gate stack (`brand-house-voicing-gates.ts`) are pure modules; no
 * other code path consults them when the flag is off. Phase A B3
 * (conflict-signal), Phase A B5 (primary-constraint protection),
 * Phase E-2 (auxiliary handling), Phase E-1 (headphone-system grammar),
 * Phase E-4 (destination-speaker model allowlist), and every existing
 * §5 composer template are unaffected. Flipping the flag is a pure
 * presentation surface change scoped to §5 cards only — §8 and §10
 * brand integration land in Stages E-5B.3 and E-5B.4.
 *
 * The constant captures the env var at module load (matching the
 * other flags in this module). The companion {@link isBrandHouseVoicingEnabled}
 * getter re-evaluates per-call so test suites can toggle the flag
 * between renders by mutating `process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING`
 * without resetting the module cache.
 */
export const BRAND_HOUSE_VOICING_ENABLED: boolean =
  process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING === 'on';

/**
 * Assessment Artifact v2 (editorial /artifact renderer) — main-flow gate.
 *
 * Env var: `NEXT_PUBLIC_ASSESSMENT_ARTIFACT_V2=on`
 *
 * - **On**: when a system-assessment response carries the optional raw
 *   engine result (`__rawAssessment`), the chat surface renders the v2
 *   editorial artifact (`apps/web/src/app/artifact/AssessmentArtifact`)
 *   in embedded mode in place of the legacy `MemoFormat` /
 *   `SystemAssessmentArtifact` dispatch.
 * - **Off (default)**: the existing dispatch is unchanged — `MemoFormat`
 *   renders unless `SYSTEM_ASSESSMENT_ARTIFACT_ENABLED` selects the
 *   legacy warm-editorial component.
 *
 * Safe-off invariant: the new flag is purely a presentation toggle. The
 * advisory engine, builders, intent dispatcher, AdvisoryResponse shape
 * (off-path), and all existing tests are identical whether the flag is
 * on or off. The legacy `SYSTEM_ASSESSMENT_ARTIFACT_ENABLED` flag and
 * its renderer are preserved as a separate fallback.
 *
 * Precedence when both flags are on: v2 wins. Two flags can co-exist
 * during cohort comparison; once v2 reaches default-on, the legacy flag
 * will be retired in a separate commit.
 */
export const ASSESSMENT_ARTIFACT_V2_ENABLED: boolean =
  process.env.NEXT_PUBLIC_ASSESSMENT_ARTIFACT_V2 === 'on';

/**
 * Runtime-evaluated alternative to {@link BRAND_HOUSE_VOICING_ENABLED}.
 *
 * Production code paths can use either form interchangeably; the getter
 * exists so tests can flip the flag mid-suite by mutating
 * `process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING` and asserting renderer
 * behavior on both sides of the toggle. Read once per render; do not
 * cache.
 */
export function isBrandHouseVoicingEnabled(): boolean {
  return process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING === 'on';
}
