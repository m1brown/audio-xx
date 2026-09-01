/**
 * Parser defect — accessory field-labels must suppress component matches.
 *
 * Reported case: a speaker cable ("Canare 4S11G Star Quad") was parsed as a
 * second loudspeaker because the token "Quad" matches the Quad brand. The
 * explicit field label "speaker cables:" carries the highest classification
 * prior — anything inside a labelled accessory segment is a wire, not a
 * signal-path component, and must not surface as a subject match.
 */
import { describe, it, expect } from 'vitest';
import { extractSubjectMatches } from '../intent';
import { detectSystemDescription } from '../system-extraction';
import type { AudioSessionState } from '../system-types';

const EMPTY_STATE = {
  activeSystemRef: null,
  savedSystems: [],
  draftSystem: null,
} as unknown as AudioSessionState;

const REPORTED =
  'evaluate my system: - Streamer: Eversolo DMP-A6 - Amplifier: JOB Job integrated - Speakers: WLM Diva monitor - Dac: Chord Hugo - speaker cables: CANARE 4S11G STAR QUAD';

describe('accessory field-label suppression', () => {
  it('does not surface the Quad brand from a "speaker cables:" segment', () => {
    const names = extractSubjectMatches(REPORTED).map((m) => m.name.toLowerCase());
    expect(names).not.toContain('quad');
  });

  it('still recognises the real signal-path components', () => {
    const names = extractSubjectMatches(REPORTED).map((m) => m.name.toLowerCase());
    // Diva (WLM speaker), Hugo (Chord DAC), DMP-A6 (Eversolo streamer)
    expect(names.some((n) => n.includes('diva'))).toBe(true);
    expect(names.some((n) => n.includes('hugo'))).toBe(true);
    expect(names.some((n) => n.includes('dmp-a6'))).toBe(true);
  });

  it('generalises across accessory labels (interconnects / power / usb)', () => {
    const cases = [
      'my system: Naim Nait 5si, Harbeth P3ESR, interconnects: Chord Signature',
      'system: Rega Planar 3, Rega Brio, power cable: Nordost Quad',
      'setup: Bluesound Node, KEF LS50, usb cable: Chord C-USB',
    ];
    for (const c of cases) {
      const names = extractSubjectMatches(c).map((m) => m.name.toLowerCase());
      // The accessory-labelled brand token must not leak in as a component.
      expect(names).not.toContain('quad');
      // "Chord" from an interconnect/usb label must not surface as a DAC brand
      // when it appears only inside the accessory segment.
      if (/interconnects:|usb cable:/.test(c)) {
        // Chord may legitimately appear elsewhere; here it only appears in the
        // accessory segment, so it must be suppressed.
        expect(names).not.toContain('chord');
      }
    }
  });

  it('a bare "speakers:" label (no cable) still yields the speaker', () => {
    const names = extractSubjectMatches(
      'my system: streamer: Bluesound Node, speakers: WLM Diva monitor',
    ).map((m) => m.name.toLowerCase());
    expect(names.some((n) => n.includes('diva'))).toBe(true);
  });

  // End-to-end at the component-graph level: the built system must contain
  // exactly one speaker (WLM Diva) and no phantom Quad component.
  it('builds a single-speaker component graph with no phantom Quad', () => {
    const owned =
      'my system: Streamer Eversolo DMP-A6, Amplifier JOB Job integrated, Speakers WLM Diva monitor, Dac Chord Hugo, speaker cables: CANARE 4S11G STAR QUAD';
    const proposed = detectSystemDescription(owned, extractSubjectMatches(owned), EMPTY_STATE);
    expect(proposed).not.toBeNull();
    const comps = proposed!.components;
    const speakers = comps.filter((c) => c.category === 'speaker');
    expect(speakers.length).toBe(1);
    expect(speakers[0].name.toLowerCase()).toContain('diva');
    const joined = comps.map((c) => `${c.brand} ${c.name}`).join(' | ').toLowerCase();
    expect(joined).not.toContain('quad');
  });
});
