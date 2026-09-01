import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Mentioning "my system" is not evidence that the system has been described.
 *
 * `clarification.ts` acknowledged supplied system context whenever the message
 * contained the phrase "my system", "my setup" or "i have". Verified on
 * production: "is my system balanced", "weakest link in my setup?" and "does
 * anything need changing in my setup" each returned the identical line —
 *
 *   "Good to know the system context — that shapes what would make sense."
 *
 * — thanking the user for context they had never supplied. That is a claim with
 * no licensing evidence, in user-visible prose.
 *
 * The rule was removed rather than gated, because `ExtractedSignals` carries
 * traits, symptoms and phrases but no component or system field: there is no
 * honest signal available at that point to condition the claim on. This test is
 * a source-level assertion for that reason — the acknowledgement composer is
 * module-private, and what needs pinning is that the unsupported sentence is
 * not reintroduced.
 */

const SOURCE = readFileSync(
  join(process.cwd(), 'apps/web/src/lib/clarification.ts'),
  'utf8',
);

// Strip block and line comments so the explanatory note above the removal
// (which necessarily quotes the old sentence) does not satisfy the check.
const CODE_ONLY = SOURCE
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((line) => !line.trim().startsWith('//'))
  .join('\n');

describe('clarification never claims unsupplied system context', () => {
  it('does not acknowledge system context it cannot verify', () => {
    expect(CODE_ONLY).not.toContain('Good to know the system context');
  });

  it('does not treat the phrase "my system" as proof of system context', () => {
    // The removed rule keyed on these substrings to assert context existed.
    // Any future rule doing the same would reproduce the defect.
    const phraseGatedContextClaim = /includes\(['"]my (?:system|setup)['"]\)[\s\S]{0,200}?system context/i;
    expect(CODE_ONLY).not.toMatch(phraseGatedContextClaim);
  });
});
