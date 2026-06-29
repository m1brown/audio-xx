/**
 * Tests for the Assess CTA template helpers.
 *
 * The helpers feed the homepage Assess door's onClick: they map a
 * saved system's components into the four labelled slots and produce
 * the populated template + cursor position the textarea will display.
 */

import { describe, it, expect } from 'vitest';
import {
  ASSESS_SLOTS,
  slotForComponent,
  formatComponentLabel,
  populateAssessTemplate,
} from '../cta-template';

describe('slotForComponent', () => {
  it('maps category to the right slot', () => {
    expect(slotForComponent({ category: 'speaker' })).toBe('Speakers');
    expect(slotForComponent({ category: 'amplifier' })).toBe('Amplifier');
    expect(slotForComponent({ category: 'integrated' })).toBe('Amplifier');
    expect(slotForComponent({ category: 'dac' })).toBe('DAC / Streamer');
    expect(slotForComponent({ category: 'streamer' })).toBe('DAC / Streamer');
    expect(slotForComponent({ category: 'turntable' })).toBe('Source');
    expect(slotForComponent({ category: 'phono' })).toBe('Source');
  });

  it('returns null for categories outside the four-slot template', () => {
    expect(slotForComponent({ category: 'cartridge' })).toBe(null);
    expect(slotForComponent({ category: 'headphone' })).toBe(null);
    expect(slotForComponent({ category: 'iem' })).toBe(null);
    expect(slotForComponent({ category: 'cable' })).toBe(null);
    expect(slotForComponent({ category: 'other' })).toBe(null);
  });

  it('routes phono_stage role to Source regardless of category', () => {
    // A phono stage tagged as 'amplifier' category should still go to Source.
    expect(slotForComponent({ category: 'amplifier', role: 'phono_stage' })).toBe('Source');
  });
});

describe('formatComponentLabel', () => {
  it('joins brand + name when name does not already start with brand', () => {
    expect(formatComponentLabel({ brand: 'WLM', name: 'Diva monitor' })).toBe('WLM Diva monitor');
  });

  it('returns name alone when name already starts with brand', () => {
    expect(formatComponentLabel({ brand: 'Job', name: 'Job 225' })).toBe('Job 225');
  });

  it('falls back to brand if name is empty', () => {
    expect(formatComponentLabel({ brand: 'Naim', name: '' })).toBe('Naim');
  });

  it('falls back to "Unknown" when both are empty', () => {
    expect(formatComponentLabel({})).toBe('Unknown');
  });
});

describe('populateAssessTemplate — FRANCE-like saved system', () => {
  // Mike's actual FRANCE saved system from production:
  //   Job integrated  → WLM Diva monitor → Eversolo DMP-A6
  // (integrated amp, speakers, streaming DAC. No Source.)
  const FRANCE_COMPONENTS = [
    { brand: 'Job', name: 'integrated', category: 'integrated' as const, role: null as const },
    { brand: 'WLM', name: 'Diva monitor', category: 'speaker' as const, role: null as const },
    { brand: 'Eversolo', name: 'DMP-A6', category: 'streamer' as const, role: null as const },
  ];

  it('populates three slots and leaves Source empty', () => {
    const { text } = populateAssessTemplate(FRANCE_COMPONENTS);
    expect(text).toBe(
      [
        'Assess my system',
        '',
        'Speakers: WLM Diva monitor',
        'Amplifier: Job integrated',
        'DAC / Streamer: Eversolo DMP-A6',
        'Source: ',
      ].join('\n'),
    );
  });

  it('places cursor at end of the empty Source label (after trailing space)', () => {
    const { text, cursor } = populateAssessTemplate(FRANCE_COMPONENTS);
    // Cursor must land immediately after "Source: " so typing a turntable
    // name immediately appears in the right slot.
    expect(text.slice(0, cursor)).toMatch(/Source: $/);
    expect(text.slice(cursor)).toBe('');
  });
});

describe('populateAssessTemplate — all slots filled', () => {
  it('joins multi-component slots with ", " and places cursor at end of text', () => {
    const components = [
      { brand: 'Harbeth', name: 'M30.1', category: 'speaker' as const, role: null as const },
      { brand: 'Naim', name: 'NAC 282', category: 'amplifier' as const, role: 'preamp' as const },
      { brand: 'Naim', name: 'NAP 250', category: 'amplifier' as const, role: 'power_amp' as const },
      { brand: 'Chord', name: 'Qutest', category: 'dac' as const, role: null as const },
      { brand: 'Rega', name: 'P8', category: 'turntable' as const, role: null as const },
    ];
    const { text, cursor } = populateAssessTemplate(components);
    expect(text).toContain('Speakers: Harbeth M30.1');
    expect(text).toContain('Amplifier: Naim NAC 282, Naim NAP 250');
    expect(text).toContain('DAC / Streamer: Chord Qutest');
    expect(text).toContain('Source: Rega P8');
    // All four slots filled → cursor at end of text.
    expect(cursor).toBe(text.length);
    // No trailing space on any slot line.
    expect(text.endsWith('Source: Rega P8')).toBe(true);
  });
});

describe('populateAssessTemplate — phono-stage routing', () => {
  it('groups a phono stage with the turntable on the Source line', () => {
    const components = [
      { brand: 'KEF', name: 'LS50 Meta', category: 'speaker' as const, role: null as const },
      { brand: 'Rega', name: 'P3', category: 'turntable' as const, role: null as const },
      { brand: 'Rega', name: 'Aria', category: 'amplifier' as const, role: 'phono_stage' as const },
    ];
    const { text } = populateAssessTemplate(components);
    expect(text).toContain('Source: Rega P3, Rega Aria');
    // Phono stage must NOT have landed on the Amplifier line.
    expect(text).toMatch(/Amplifier:\s*\n/);
  });
});

describe('populateAssessTemplate — empty / mostly-empty inputs', () => {
  it('with no components → empty scaffold with cursor on Speakers', () => {
    const { text, cursor } = populateAssessTemplate([]);
    expect(text).toBe(
      [
        'Assess my system',
        '',
        'Speakers: ',
        'Amplifier:',
        'DAC / Streamer:',
        'Source:',
      ].join('\n'),
    );
    expect(text.slice(0, cursor)).toMatch(/Speakers: $/);
  });

  it('with only speakers → cursor moves to Amplifier (first remaining empty slot)', () => {
    const components = [
      { brand: 'Magnepan', name: 'LRS+', category: 'speaker' as const, role: null as const },
    ];
    const { text, cursor } = populateAssessTemplate(components);
    expect(text).toContain('Speakers: Magnepan LRS+');
    expect(text.slice(0, cursor)).toMatch(/Amplifier: $/);
  });

  it('drops components outside the four-slot template (cables, headphones)', () => {
    const components = [
      { brand: 'KEF', name: 'LS50', category: 'speaker' as const, role: null as const },
      { brand: 'Audeze', name: 'LCD-X', category: 'headphone' as const, role: null as const },
      { brand: 'Nordost', name: 'Heimdall', category: 'cable' as const, role: null as const },
    ];
    const { text } = populateAssessTemplate(components);
    expect(text).toContain('Speakers: KEF LS50');
    expect(text).not.toContain('Audeze');
    expect(text).not.toContain('Nordost');
  });
});

describe('ASSESS_SLOTS ordering', () => {
  it('is the canonical four-slot order — Speakers, Amplifier, DAC/Streamer, Source', () => {
    expect([...ASSESS_SLOTS]).toEqual(['Speakers', 'Amplifier', 'DAC / Streamer', 'Source']);
  });
});
