import { describe, it, expect, beforeEach } from 'vitest';
import { processText, loadSignalDictionary, clearCache } from '../processor';
import { resolve } from 'path';

const SIGNALS_PATH = resolve(__dirname, '../../signals.yaml');

beforeEach(() => {
  clearCache();
});

function process(text: string) {
  const dict = loadSignalDictionary(SIGNALS_PATH);
  return processText(text, dict);
}

describe('Signal Processor', () => {
  // Test 10: Free text affects inferred traits and rule outcomes (not silently ignored)
  it('should extract trait signals from free text', () => {
    const result = process('The system sounds bright and harsh, very fatiguing');
    expect(result.symptoms).toContain('brightness_harshness');
    expect(result.symptoms).toContain('fatigue');
    expect(result.traits.fatigue_risk).toBe('up');
    expect(result.traits.glare_risk).toBe('up');
    expect(result.matched_phrases.length).toBeGreaterThan(0);
  });

  // Test 5: Uncertainty markers in free text increase conservatism
  it('should detect uncertainty markers and set uncertainty level', () => {
    const result = process('I think maybe the sound is sort of thin, not sure');
    expect(result.uncertainty_level).toBeGreaterThan(0);
    expect(result.matched_uncertainty_markers).toContain('I think');
    expect(result.matched_uncertainty_markers).toContain('maybe');
    expect(result.matched_uncertainty_markers).toContain('sort of');
    expect(result.matched_uncertainty_markers).toContain('not sure');
  });

  it('should cap uncertainty level at 3', () => {
    const result = process('maybe I think sort of kind of perhaps not sure possibly');
    expect(result.uncertainty_level).toBe(3);
  });

  // Test: Low-volume archetype hint detection
  it('should detect low-volume archetype hint from phrases', () => {
    const result = process('I listen quietly in my apartment at night');
    expect(result.archetype_hints).toContain('low_volume');
    expect(result.symptoms).toContain('low_volume_context');
  });

  it('should detect engagement archetype hint from too-polite phrases', () => {
    const result = process('The system is too polite, lacks excitement');
    expect(result.archetype_hints).toContain('engagement');
    expect(result.symptoms).toContain('too_polite');
  });

  it('should detect composure archetype hint from too-forward phrases', () => {
    const result = process("I can't relax, everything is too forward");
    expect(result.archetype_hints).toContain('composure');
  });

  it('should detect regression markers', () => {
    const result = process('I lost something after the change, worse than before');
    expect(result.symptoms).toContain('regression');
    expect(result.traits.flow).toBe('down');
  });

  it('should detect improvement markers', () => {
    const result = process('The system sounds much better after the change');
    expect(result.symptoms).toContain('improvement');
    expect(result.traits.flow).toBe('up');
  });

  it('should detect thin-at-low-volume symptom', () => {
    const result = process('sounds thin unless I turn it up');
    expect(result.symptoms).toContain('thin_at_low_volume');
    expect(result.traits.low_volume_integrity).toBe('down');
    expect(result.archetype_hints).toContain('low_volume');
  });

  it('should return empty results for unrecognized text', () => {
    const result = process('I went to the store today');
    expect(result.symptoms).toHaveLength(0);
    expect(Object.keys(result.traits)).toHaveLength(0);
    expect(result.uncertainty_level).toBe(0);
  });
});
