import { describe, it, expect } from 'vitest';
import { detectIntent } from '../intent';

/**
 * Mission 3 F1 — a judgment question about a system the user names in the
 * SAME message must route to system_assessment, not to diagnosis triage.
 *
 * Measured live on production (010f5c3, 2026-08-10): "my system is a
 * denafrips pontus ii into a leben cs600 driving harbeth 30.2 — what do
 * you make of it?" was answered with "What components are in your
 * system?" — the extractor had already recognized all three components
 * (the save-chip listed them), and the follow-up turn dead-ended in
 * symptom triage ("Describe one thing that sounds wrong") for a user who
 * never reported a problem.
 *
 * Root cause: "what do you make of it" was not assessment language, so
 * the ownership+subjects assessment gate never fired and the turn fell
 * to gear_inquiry → diagnosis routing → checkDiagnosticUncertainty.
 *
 * The "+"-separated form of the same request already routed correctly —
 * pinned below as the control.
 */

describe('judgment of a named system routes to assessment', () => {
  it('natural-prose chain + "what do you make of it"', () => {
    expect(detectIntent(
      'my system is a denafrips pontus ii into a leben cs600 driving harbeth 30.2 — what do you make of it?',
    ).intent).toBe('system_assessment');
  });

  it('"what do you make of my system" with listed components', () => {
    expect(detectIntent(
      'what do you make of my system? pontus ii, leben cs600, harbeth 30.2',
    ).intent).toBe('system_assessment');
  });

  it('control: the "+"-chain form keeps routing to assessment', () => {
    expect(detectIntent(
      'denafrips pontus ii + leben cs600 + harbeth 30.2 — what do you think of this system?',
    ).intent).toBe('system_assessment');
  });
});

describe('the new phrasing does not overreach', () => {
  it('"what do you make of" a single product is not a system assessment', () => {
    expect(detectIntent('what do you make of the pontus ii?').intent)
      .not.toBe('system_assessment');
  });

  it('bare "what do you make of it" with no subjects is not a system assessment', () => {
    expect(detectIntent('what do you make of it?').intent)
      .not.toBe('system_assessment');
  });

  it('symptom reports keep diagnosis priority', () => {
    expect(detectIntent('my system sounds bright').intent).toBe('diagnosis');
    expect(detectIntent(
      'my pontus ii into leben cs600 sounds harsh — what do you make of it?',
    ).intent).toBe('diagnosis');
  });
});
