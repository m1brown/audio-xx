import { describe, it, expect } from 'vitest';
import { evaluateText } from '../engine';
import { extractPriorityCategory } from '../shopping-intent';
import { detectSystemDescription } from '../system-extraction';
import { extractSubjectMatches } from '../intent';
import type { AudioSessionState } from '../system-types';

const audioState: AudioSessionState = {
  activeSystemRef: { type: 'none' },
  savedSystems: [],
  draftSystem: null,
  loading: false,
  proposedSystem: null,
};

describe('Phase K smoke', () => {
  it('signal extraction recognizes relaxed phrasings', () => {
    const cases: Array<[string, string]> = [
      ['noisy', 'electrical_noise'],
      ["it's noisy", 'electrical_noise'],
      ['ground hum', 'electrical_noise'],
      ['no bass', 'thinness'],
      ['sounds tiny', 'thinness'],
      ['sounds dark', 'flat_lifeless'],
    ];
    for (const [text, expectedSym] of cases) {
      const { signals } = evaluateText(text);
      console.log(`[smoke] "${text}" → symptoms=${JSON.stringify(signals.symptoms)}`);
      expect(signals.symptoms).toContain(expectedSym);
    }
  });

  it('electrical_noise fires the diagnostic rule (not the dismissive fallback)', () => {
    const { result } = evaluateText('it is noisy');
    const ids = result.fired_rules.map((r) => r.id);
    console.log('[smoke] electrical_noise fired:', ids);
    expect(ids).toContain('electrical-noise-diagnostic');
    expect(ids).not.toContain('friendly-advisor-fallback');
  });

  it('priority routes noun-first directives to the right category', () => {
    expect(extractPriorityCategory('recommend a turntable')?.category).toBe('turntable');
    expect(extractPriorityCategory('recommend a streamer')?.category).toBe('streamer');
    expect(extractPriorityCategory('looking for headphones')?.category).toBe('headphone');
    expect(extractPriorityCategory('want a dac')?.category).toBe('dac');
    expect(extractPriorityCategory('need a tube amp')?.category).toBe('amplifier');
    // Negative-lookahead carve-out for "headphone amp"
    expect(extractPriorityCategory('recommend a headphone amp')?.category).not.toBe('headphone');
  });

  it('system extraction picks up consumer brands (sonos + iphone = 2 components)', () => {
    const text = 'I have a sonos and iphone';
    const subjects = extractSubjectMatches(text);
    console.log('[smoke] subjects for "%s":', text, subjects);
    const sys = detectSystemDescription(text, subjects, audioState);
    console.log('[smoke] sonos+iphone system:', sys);
    expect(sys).not.toBeNull();
    expect(sys!.components.length).toBeGreaterThanOrEqual(2);
  });
});
