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

  it('"compare kinki ex-m1 with hegel h190" treats EX-M1 as known, Hegel as unknown', () => {
    const text = 'compare kinki ex-m1 with hegel h190';
    const { intent, subjects, subjectMatches, desires } = detectIntent(text);

    // 1. Intent should be comparison
    expect(intent).toBe('comparison');
    console.log('INTENT:', intent);
    console.log('SUBJECTS:', subjects);
    console.log('SUBJECT_MATCHES:', subjectMatches.map(m => `${m.name}(${m.kind})`));

    // 2. Build the gear response
    const result = buildGearResponse('comparison', subjects, text, desires);
    expect(result).not.toBeNull();

    const anchor = result!.anchor.toLowerCase();
    console.log('ANCHOR:', result!.anchor.substring(0, 500));

    // 3. Should reference the Kinki Studio EX-M1 (known product)
    expect(anchor).toContain('ex-m1');

    // 4. Should reference "Hegel" as the unknown side, NOT "Hegel Rost"
    //    (H190 is not in the catalog, so brand fallback to Rost is wrong)
    expect(anchor).not.toContain('rost');

    // 5. The unknown name should be "Hegel" not "Kinki Hegel"
    //    (partial brand "kinki" must be recognized as belonging to EX-M1)
    expect(anchor).not.toMatch(/kinki\s+hegel/i);
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
});
