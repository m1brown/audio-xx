import { describe, it, expect } from 'vitest';
import { buildTasteReflection } from '../listener-profile';
import type { ListenerProfile } from '../listener-profile';

/**
 * D6 (production hardening, 2026-08-11) — the taste reflection must not
 * contradict the current request.
 *
 * Live repro: a session whose accumulated listener profile leaned
 * clarity/rhythm asked "i want a warm but detailed integrated under
 * 1500". The reflection above the recommendations read "You prioritize
 * clarity and detail and rhythmic energy over harmonic density or warmth
 * and body" — claiming the user deprioritizes the very quality the
 * current message explicitly asked for. Parallel fact stores: the
 * persisted profile spoke over the present request.
 *
 * Encoded rule: a quality explicitly desired in the CURRENT turn can
 * never be named as a depriority, and joins the stated priorities.
 */

function profileWith(traits: Partial<Record<string, number>>): ListenerProfile {
  const base: Record<string, number> = {
    flow: 0, clarity: 0, rhythm: 0, tonal_density: 0,
    spatial_depth: 0, dynamics: 0, warmth: 0,
  };
  return {
    inferredTraits: { ...base, ...traits },
    confidence: 0.6,
  } as unknown as ListenerProfile;
}

const DETAIL_LEANING = profileWith({ clarity: 0.8, rhythm: 0.5, warmth: 0.05 });

describe('taste reflection respects current-turn desires', () => {
  it('a currently-desired quality is never a depriority', () => {
    const text = buildTasteReflection(DETAIL_LEANING, [
      { quality: 'warmth', direction: 'more', raw: 'warm' },
    ]);
    expect(text).toBeTruthy();
    expect(text!).not.toMatch(/over[^.]*warmth/i);
  });

  it('a currently-desired quality joins the priorities', () => {
    const text = buildTasteReflection(DETAIL_LEANING, [
      { quality: 'warmth', direction: 'more', raw: 'warm' },
    ]);
    expect(text!).toMatch(/warmth/i);
    expect(text!.indexOf('warmth')).toBeLessThan(text!.indexOf('over') === -1 ? text!.length : text!.indexOf('over'));
  });

  it('control: without current desires the profile speaks unchanged', () => {
    const text = buildTasteReflection(DETAIL_LEANING);
    expect(text).toBeTruthy();
    expect(text!).toMatch(/clarity and detail/);
  });

  it('control: a "less" desire does not join priorities', () => {
    const text = buildTasteReflection(DETAIL_LEANING, [
      { quality: 'brightness', direction: 'less', raw: 'less bright' },
    ]);
    expect(text!).not.toMatch(/^You prioritize brightness/i);
  });
});
