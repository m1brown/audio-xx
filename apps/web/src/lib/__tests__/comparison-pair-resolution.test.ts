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

  // ── "compare X with Y" separator tests ───────────────

  it('"compare kinki ex-m1 with hegel h190" resolves both products for full comparison', () => {
    const text = 'compare kinki ex-m1 with hegel h190';
    const { intent, subjects, subjectMatches, desires } = detectIntent(text);

    // 1. Intent should be comparison
    expect(intent).toBe('comparison');
    console.log('INTENT:', intent);
    console.log('SUBJECTS:', subjects);
    console.log('SUBJECT_MATCHES:', subjectMatches.map(m => `${m.name}(${m.kind})`));

    // 2. H190 should now be extracted as a product subject (compound or bare)
    expect(subjectMatches.some(m => m.kind === 'product' && (m.name === 'h190' || m.name === 'hegel h190'))).toBe(true);

    // 3. Build the gear response
    const result = buildGearResponse('comparison', subjects, text, desires);
    expect(result).not.toBeNull();

    const anchor = result!.anchor.toLowerCase();
    console.log('ANCHOR:', result!.anchor.substring(0, 500));

    // 4. Should be a full comparison — both products resolved
    expect(anchor).toContain('ex-m1');
    expect(anchor).toContain('h190');

    // 5. Should NOT fall back to Rost or produce half-known output
    expect(anchor).not.toContain('rost');
    expect(anchor).not.toContain('don\'t have');
    expect(anchor).not.toContain('less represented');
  });

  it('"compare kinki ex-m1 with job integrated" resolves both products correctly', () => {
    const text = 'compare kinki ex-m1 with job integrated';
    const { subjects, desires } = detectIntent(text);
    const result = buildGearResponse('comparison', subjects, text, desires);
    expect(result).not.toBeNull();
    const anchor = result!.anchor.toLowerCase();
    console.log('ANCHOR:', result!.anchor.substring(0, 300));
    // Both products are in the catalog — full comparison should fire
    expect(anchor).toContain('ex-m1');
    expect(anchor).toContain('job');
    // Should NOT be a half-known comparison
    expect(anchor).not.toContain('don\'t have');
    expect(anchor).not.toContain('not in');
  });

  // ── Alias coverage tests ─────────────────────────────

  it('H190 aliases all extract as product subjects', () => {
    const aliases = ['h190', 'hegel h190', 'hegel h190 integrated'];
    for (const alias of aliases) {
      const { subjectMatches } = detectIntent(`tell me about the ${alias}`);
      const hasH190 = subjectMatches.some(
        (m) => m.kind === 'product' && (m.name === 'h190' || m.name === 'hegel h190'),
      );
      expect(hasH190).toBe(true);
      console.log(`ALIAS "${alias}": ${subjectMatches.map(m => `${m.name}(${m.kind})`).join(', ')}`);
    }
  });

  it('EX-M1 aliases all extract as product subjects', () => {
    const aliases = ['ex-m1', 'kinki ex-m1', 'kinki studio ex-m1', 'kinki ex m1', 'kinki studio ex m1'];
    for (const alias of aliases) {
      const { subjectMatches } = detectIntent(`tell me about the ${alias}`);
      const hasEXM1 = subjectMatches.some(
        (m) => m.kind === 'product' && (m.name === 'ex-m1' || m.name === 'ex-m1+' || m.name === 'ex m1'),
      );
      expect(hasEXM1).toBe(true);
      console.log(`ALIAS "${alias}": ${subjectMatches.map(m => `${m.name}(${m.kind})`).join(', ')}`);
    }
  });
});
