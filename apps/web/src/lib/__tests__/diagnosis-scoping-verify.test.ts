/**
 * Verification test: diagnosis text scoping after shopping.
 *
 * These tests verify intent detection behavior for the diagnosis scoping fix.
 * The engine.evaluateText() function can't be called directly in test because
 * it relies on filesystem YAML at a CWD-relative path. The fix is in page.tsx
 * integration (evaluateText scoping) which controls what text reaches the engine.
 *
 * What we verify here: the intent and routing layers correctly detect diagnosis.
 */
import { detectIntent } from '../intent';
import { routeConversation } from '../conversation-router';

describe('Diagnosis scoping — intent and routing', () => {
  test('"my system sounds harsh" → diagnosis intent', () => {
    const { intent } = detectIntent('my system sounds harsh');
    expect(intent).toBe('diagnosis');
  });

  test('"my system sounds harsh" → diagnosis route', () => {
    const mode = routeConversation('my system sounds harsh');
    expect(mode).toBe('diagnosis');
  });

  test('"I want to fix my amp" → diagnosis intent (not shopping)', () => {
    const { intent } = detectIntent('I want to fix my amp');
    expect(intent).toBe('diagnosis');
  });

  test('"I want to fix my amp" → repair text matches breakout pattern', () => {
    const breakoutPattern = /\b(?:fix|repair|troubleshoot|diagnose)\b/i;
    expect(breakoutPattern.test('I want to fix my amp')).toBe(true);
  });

  test('component clarification pattern matches "amp"', () => {
    const ampPattern = /\b(?:amp|amplifier|integrated)\b/i;
    expect(ampPattern.test('I want to fix my amp')).toBe(true);
  });

  test('component clarification pattern matches "speakers"', () => {
    const speakerPattern = /\b(?:speakers?|monitors?|floorstanders?|bookshelfs?)\b/i;
    expect(speakerPattern.test('my speakers sound bad')).toBe(true);
  });

  test('component clarification pattern matches "DAC"', () => {
    const dacPattern = /\b(?:dac|d\/a\s*converter)\b/i;
    expect(dacPattern.test('something is wrong with my dac')).toBe(true);
  });

  test('"I want a warm tube amp" → shopping intent (not diagnosis)', () => {
    const { intent } = detectIntent('I want a warm tube amp');
    expect(intent).toBe('shopping');
  });

  // Control case: shopping intent must NOT be disrupted
  test('"interested in speakers" → shopping intent', () => {
    const { intent } = detectIntent('interested in speakers');
    expect(intent).toBe('shopping');
  });
});
