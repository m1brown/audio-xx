/**
 * Comparison Pair Resolution — validates that system-vs-system queries
 * compare the correct entities with shared components held constant.
 */
import { describe, it, expect } from 'vitest';
import { detectIntent } from '../intent';

// We can't directly import resolveComparisonPair (not exported),
// so we test through buildGearResponse which uses it internally.
import { buildGearResponse } from '../gear-response';

describe('Comparison Pair Resolution', () => {
  it('"compare JOB integrated + WLM Diva vs Crayon + WLM Diva" compares JOB vs Crayon', () => {
    const text = 'compare JOB integrated + WLM Diva vs Crayon + WLM Diva';
    const { subjects, desires } = detectIntent(text);
    const result = buildGearResponse('comparison', subjects, text, desires);
    expect(result).not.toBeNull();
    // The anchor should mention both JOB and Crayon as the compared pair
    const anchor = result!.anchor.toLowerCase();
    expect(anchor).toContain('job');
    expect(anchor).toContain('crayon');
    // Should acknowledge the shared WLM Diva
    expect(anchor).toContain('diva');
    // Should NOT frame this as "JOB Integrated vs WLM Diva"
    expect(anchor).not.toMatch(/job\s+integrated.*vs.*wlm\s+diva/i);
    console.log('ANCHOR:', result!.anchor.substring(0, 300));
  });

  it('"compare JOB vs Crayon with WLM Diva" compares JOB vs Crayon', () => {
    const text = 'compare JOB vs Crayon with WLM Diva';
    const { subjects, desires } = detectIntent(text);
    const result = buildGearResponse('comparison', subjects, text, desires);
    expect(result).not.toBeNull();
    const anchor = result!.anchor.toLowerCase();
    expect(anchor).toContain('job');
    expect(anchor).toContain('crayon');
    console.log('ANCHOR:', result!.anchor.substring(0, 300));
  });

  it('"compare JOB integrated vs Crayon CIA" is a simple comparison (no shared)', () => {
    const text = 'compare JOB integrated vs Crayon CIA';
    const { subjects, desires } = detectIntent(text);
    const result = buildGearResponse('comparison', subjects, text, desires);
    expect(result).not.toBeNull();
    const anchor = result!.anchor.toLowerCase();
    expect(anchor).toContain('job');
    expect(anchor).toContain('crayon');
    console.log('ANCHOR:', result!.anchor.substring(0, 300));
  });

  it('matched products include the correct pair', () => {
    const text = 'compare JOB integrated + WLM Diva vs Crayon + WLM Diva';
    const { subjects, desires } = detectIntent(text);
    const result = buildGearResponse('comparison', subjects, text, desires);
    expect(result).not.toBeNull();
    const productNames = (result!.matchedProducts ?? []).map(
      (p) => `${p.brand} ${p.name}`.toLowerCase(),
    );
    // Should include JOB, Crayon, and WLM Diva (shared)
    expect(productNames.some((n) => n.includes('job'))).toBe(true);
    expect(productNames.some((n) => n.includes('diva'))).toBe(true);
    console.log('MATCHED:', productNames);
  });

  it('"JOB integrated + WLM Diva or Crayon + WLM Diva?" detects comparison intent', () => {
    const text = 'JOB integrated + WLM Diva or Crayon + WLM Diva?';
    const { intent, subjects, desires } = detectIntent(text);
    expect(intent).toBe('comparison');
    const result = buildGearResponse('comparison', subjects, text, desires);
    expect(result).not.toBeNull();
    const anchor = result!.anchor.toLowerCase();
    expect(anchor).toContain('job');
    expect(anchor).toContain('crayon');
    expect(anchor).toContain('diva');
    console.log('ANCHOR:', result!.anchor.substring(0, 300));
  });

  it('simple "X vs Y" comparison still works correctly', () => {
    const text = 'compare Chord Qutest vs Denafrips Ares II';
    const { subjects, desires } = detectIntent(text);
    const result = buildGearResponse('comparison', subjects, text, desires);
    expect(result).not.toBeNull();
    const anchor = result!.anchor.toLowerCase();
    expect(anchor).toContain('qutest');
    expect(anchor).toContain('ares');
    console.log('ANCHOR:', result!.anchor.substring(0, 300));
  });
});
