import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A system judgment cannot be asked about until the system is known.
 *
 * Verified on production: "is my system balanced", "weakest link in my setup?"
 * and "does anything need changing in my setup" were each answered with
 * "Could you describe what specifically bothers or pleases you — is it about
 * how things sound (tone, brightness, warmth)…" — a symptom interview about a
 * complaint the user never made.
 *
 * These turns are not missing a symptom, they are missing the system. The
 * repair asks for the components instead, and only when no symptom was
 * actually reported (signals.symptoms empty), so genuine complaints such as
 * "my system sounds bright" keep the diagnostic question.
 *
 * Source-level assertions: the branch is module-private and the surrounding
 * function needs EvaluationResult fixtures to exercise directly. What must not
 * regress is the shape of the rule.
 */

const SRC = readFileSync(join(process.cwd(), 'apps/web/src/lib/clarification.ts'), 'utf8');

describe('system-judgment turns ask for the system', () => {
  it('asks for components rather than symptoms', () => {
    expect(SRC).toContain('What components are in your system?');
  });

  it('only diverts when no symptom was actually reported', () => {
    // Without this guard a real complaint would be met with an inventory
    // request instead of a diagnosis.
    expect(SRC).toMatch(/SYSTEM_JUDGMENT_REQUEST\.test\(currentMessage\)\s*&&\s*signals\.symptoms\.length === 0/);
  });

  it('recognises the three confirmed phrasings', () => {
    const m = SRC.match(/const SYSTEM_JUDGMENT_REQUEST =\s*([\s\S]*?);/);
    expect(m).toBeTruthy();
    const re = new RegExp(m![1].trim().replace(/^\/|\/i$/g, ''), 'i');
    expect(re.test('is my system balanced')).toBe(true);
    expect(re.test('weakest link in my setup?')).toBe(true);
    expect(re.test('does anything need changing in my setup')).toBe(true);
  });

  it('keeps the symptom question for genuine complaints', () => {
    expect(SRC).toContain('bothers or pleases you');
  });
});
