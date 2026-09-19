/**
 * Listener-observation detection pins (Migration 1 §3; widened 2026-09-19).
 *
 * Structure stays conservative: first person, not a question, ≤300 chars.
 * The widening captures the two families the Grok-parity mission showed
 * were being missed — stated preferences/aversions with sonic vocabulary,
 * and prior/reference systems — because both are high-value evidence
 * ABOUT THE LISTENER that must survive the raw-turn window and reach the
 * governed context verbatim.
 */
import { describe, it, expect } from 'vitest';
import { isListenerObservation } from '../listener-observation';

describe('original situational vocabulary still matches', () => {
  it('distance, level, symptoms', () => {
    expect(isListenerObservation('I sit about nine feet away and I rarely listen loud.')).toBe(true);
    expect(isListenerObservation('It does sound thin and quiet unless I crank it. I find it strained.')).toBe(true);
    expect(isListenerObservation('My room is small and I listen at night.')).toBe(true);
  });
});

describe('stated preference / aversion (widened)', () => {
  it('the France preference statement is captured', () => {
    expect(isListenerObservation('I value sweetness, flow, elasticity, detail, air, sparkle.')).toBe(true);
  });
  it('the aversion statement is captured', () => {
    expect(isListenerObservation("I don't like fatigue, glare, harshness, or excessive damping.")).toBe(true);
  });
  it('preference verbs without sonic vocabulary do not match on their own', () => {
    expect(isListenerObservation('I like this a lot.')).toBe(false);
    expect(isListenerObservation('I value your opinion.')).toBe(false);
  });
});

describe('prior / reference systems (widened)', () => {
  it('previous-system statements are captured', () => {
    expect(isListenerObservation('My previous system was a Scott 222B with Hornshoppe Horns, and it was excellent.')).toBe(true);
    expect(isListenerObservation('I used to own Boenicke W5s and loved them.')).toBe(true);
    expect(isListenerObservation('My reference system in the US was a Scott 222B EL-84 amp.')).toBe(true);
  });
});

describe('structure remains conservative', () => {
  it('questions never match', () => {
    expect(isListenerObservation('Do I value sweetness and air?')).toBe(false);
    expect(isListenerObservation('What was my previous system missing?')).toBe(false);
  });
  it('third-person product statements never match', () => {
    expect(isListenerObservation('The Hugo has a 2V output and sounds sweet.')).toBe(false);
    expect(isListenerObservation('Reviewers value its air and sparkle.')).toBe(false);
  });
  it('over-length statements never match', () => {
    expect(isListenerObservation(`I value sweetness ${'and air '.repeat(50)}`)).toBe(false);
  });
});
