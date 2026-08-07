import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * LB-6 — in-product feedback capture must stay mounted, and stay correctly gated.
 *
 * `FeedbackPrompt` existed in the tree for a long time with zero importers, so
 * `feedback_submitted` never fired once in production. Nothing failed; the
 * capability was simply absent, and absence is invisible to every other test.
 * That is the failure this file exists to prevent recurring.
 *
 * It also pins the two gating rules, because loosening either one silently
 * corrupts the evidence rather than breaking anything:
 *
 *   - not on intake turns — an intake is a question put to the reader, so
 *     "was this helpful?" underneath one is incoherent;
 *   - only when a message id exists — the id is what joins a feedback event
 *     back to the advisory that produced it. Unjoinable feedback is not
 *     evidence, so no id must mean no prompt, never a synthesised id.
 */

const PAGE = join(__dirname, '..', '..', 'app', 'page.tsx');
const COMPONENT = join(__dirname, '..', 'FeedbackPrompt.tsx');

describe('LB-6 feedback capture mount', () => {
  const src = readFileSync(PAGE, 'utf8');

  it('FeedbackPrompt is imported by page.tsx', () => {
    expect(
      /import\s+FeedbackPrompt\s+from\s+['"]@\/components\/FeedbackPrompt['"]/.test(src),
      'FeedbackPrompt must be imported by page.tsx — without a render site the ' +
        'feedback_submitted event never fires and the beta has no evidence intake.',
    ).toBe(true);
  });

  it('FeedbackPrompt is rendered', () => {
    expect(src).toMatch(/<FeedbackPrompt\b/);
  });

  it('is gated off intake advisories', () => {
    // The render must be guarded by an explicit intake exclusion.
    const guarded = /message\.advisory\.kind\s*!==\s*'intake'[\s\S]{0,200}?<FeedbackPrompt\b/.test(src);
    expect(
      guarded,
      "The <FeedbackPrompt> render must be guarded by message.advisory.kind !== 'intake'.",
    ).toBe(true);
  });

  it('is gated on a present message id, and passes that id through', () => {
    const idGuarded = /'id'\s+in\s+message[\s\S]{0,200}?<FeedbackPrompt\b/.test(src);
    expect(
      idGuarded,
      "The <FeedbackPrompt> render must be guarded by `'id' in message` so feedback " +
        'is always joinable to its advisory.',
    ).toBe(true);
    expect(src).toMatch(/<FeedbackPrompt\s+advisoryId=\{message\.id\}/);
  });

  it('still emits the existing feedback_submitted event to the existing sink', () => {
    const component = readFileSync(COMPONENT, 'utf8');
    // No new event type, no new endpoint — LB-6 was explicitly scoped to a mount.
    expect(component).toMatch(/trackEvent\(\s*'feedback_submitted'/);
    expect(component).toMatch(/advisoryId/);
  });
});
