/**
 * Product suite — Build Your System → Assessment (MVP M1).
 *
 * Pins the whole anonymous core loop below the React layer:
 * builder fields → composed engine text → shareable URL → decoded
 * text → engine → synthesized artifact payload. This is the product's
 * spine; if any link breaks, the first-visit experience breaks.
 */
import { describe, it, expect } from 'vitest';
import { composeSystemText, artifactUrlFor } from '../compose-system-text';
import { buildSystemAssessment } from '@/lib/consultation';
import { extractSubjectMatches, detectIntent } from '@/lib/intent';
import { synthesizeArtifact } from '@/lib/artifact/synthesizeArtifact';

describe('composition — fields → engine text', () => {
  it('composes the proven assessment phrasing', () => {
    expect(composeSystemText(['Denafrips Pontus II', 'Leben CS600X', 'DeVore O/96']))
      .toBe('Assess my system: Denafrips Pontus II, Leben CS600X, DeVore O/96');
  });

  it('requires at least two components', () => {
    expect(composeSystemText(['KEF R3'])).toBeNull();
    expect(composeSystemText(['', '  ', 'KEF R3'])).toBeNull();
    expect(composeSystemText([])).toBeNull();
  });

  it('normalises whitespace and stray trailing commas', () => {
    expect(composeSystemText(['  Bluesound   Node, ', 'KEF  R3']))
      .toBe('Assess my system: Bluesound Node, KEF R3');
  });

  it('URL round-trips to the exact composed text', () => {
    const fields = ['Chord Qutest', 'Naim SuperNait 3', 'Harbeth Super HL5 Plus'];
    const url = artifactUrlFor(fields)!;
    expect(url.startsWith('/artifact?system=')).toBe(true);
    const decoded = decodeURIComponent(url.split('system=')[1]);
    expect(decoded).toBe(composeSystemText(fields));
  });
});

describe('spine — composed text → engine → artifact payload', () => {
  // Exactly the pipeline /artifact/page.tsx runs, for builder-composed input.
  function renderPipeline(fields: string[]) {
    const text = composeSystemText(fields)!;
    const subjects = extractSubjectMatches(text);
    const { desires } = detectIntent(text);
    const result = buildSystemAssessment(text, subjects, null, desires);
    if (!result || result.kind !== 'assessment') return null;
    return synthesizeArtifact(result);
  }

  it('a catalog system renders a complete artifact payload', () => {
    const out = renderPipeline(['Denafrips Pontus II', 'Leben CS600X', 'DeVore O/96']);
    expect(out).not.toBeNull();
    const p = out!.payload as Record<string, unknown>;
    const flat = JSON.stringify(p);
    expect(flat).toMatch(/Pontus/);
    expect(flat).toMatch(/Leben/i);
    expect(flat).toMatch(/DeVore/i);
    expect(flat.length).toBeGreaterThan(500);
  });

  it('a mainstream two-component system still renders', () => {
    const out = renderPipeline(['Marantz PM8006', 'KEF R3']);
    expect(out).not.toBeNull();
  });

  it('free-text (uncatalogued) components do not crash the pipeline', () => {
    // Unknown gear may return null (the page shows the guided failure
    // path) — the requirement is no throw either way.
    expect(() => renderPipeline(['Frankenamp 9000', 'Garage Speaker Mk1'])).not.toThrow();
  });

  it('artifact payloads never leak internal taxonomy vocabulary', () => {
    const out = renderPipeline(['Bluesound Node', 'Marantz PM8006', 'KEF R3']);
    expect(out).not.toBeNull();
    const flat = JSON.stringify(out!.payload);
    expect(flat).not.toMatch(/warm_bright|smooth_detailed|elastic_controlled|airy_closed/);
    expect(flat).not.toMatch(/undefined|\bNaN\b/);
  });
});
