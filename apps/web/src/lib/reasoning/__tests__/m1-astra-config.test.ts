/**
 * M1 astra promotion — configuration pins (2026-09-17).
 *
 * The model switch is config, not architecture: these pins hold the
 * transport-compatibility rule, the raised timeouts, and the pinned
 * validator observable, so a later edit cannot silently regress the
 * promoted configuration.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generationParams } from '../model-params';

describe('generation-parameter compatibility', () => {
  it('gpt-4 family keeps the historical temperature 0.4', () => {
    expect(generationParams('gpt-4o')).toEqual({ temperature: 0.4 });
    expect(generationParams('gpt-4o-2024-11-20')).toEqual({ temperature: 0.4 });
  });

  it('gpt-6-astra (and any non-gpt-4 model) runs at API default — the winning arm configuration', () => {
    expect(generationParams('gpt-6-astra')).toEqual({});
    expect(generationParams('gpt-5.2')).toEqual({});
  });
});

describe('route configuration pins', () => {
  const ROUTE = readFileSync(
    join(__dirname, '../../../app/api/reasoning-lane/route.ts'), 'utf8',
  );

  it('generation timeout covers the measured astra tail (90s)', () => {
    expect(ROUTE).toContain('const TIMEOUT_MS = 90000;');
  });

  it('generation body derives parameters through the compatibility helper (no unconditional temperature)', () => {
    expect(ROUTE).toContain('...generationParams(getModel())');
    expect(ROUTE).not.toMatch(/temperature:\s*0\.4/);
  });

  it('validator model is resolved once and reported in observability (vmodel)', () => {
    expect(ROUTE).toContain("const validatorModel = process.env.REASONING_VALIDATOR_MODEL ?? getModel();");
    expect(ROUTE).toContain('vmodel=%s');
  });
});

describe('client lane budget pins', () => {
  const PAGE = readFileSync(join(__dirname, '../../../app/page.tsx'), 'utf8');

  it('one lane request budget exceeds the server worst case (120s), used by both lane sites', () => {
    expect(PAGE).toContain('const LANE_FETCH_TIMEOUT_MS = 120000;');
    expect(PAGE.split('}, LANE_FETCH_TIMEOUT_MS);').length - 1).toBe(2);
    // The old 60s lane budget is gone entirely.
    expect(PAGE).not.toContain('}, 60000);');
  });
});
