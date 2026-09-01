/**
 * Trust: an uncatalogued model must never borrow a non-adjacent brand and
 * fabricate a product that does not exist.
 *
 * Root cause (Reddit spot-check): in "Technics SL-1200, Marantz 2270, …" the
 * model SL-1200's own adjacent brand (Technics) was consumed first, so the
 * brand-borrow grabbed the next-nearest brand (Marantz) and invented
 * "Marantz SL-1200". The borrow is now restricted to a brand immediately
 * preceding the model ("<Brand> <Model>"); no adjacent brand ⇒ render bare.
 */
import { describe, it, expect } from 'vitest';
import { detectIntent, extractSubjectMatches } from '../intent';
import { buildSystemAssessment } from '../consultation';
import { synthesizeArtifact } from '../artifact/synthesizeArtifact';

function credit(text: string): string[] {
  const subs = extractSubjectMatches(text);
  const { desires } = detectIntent(text);
  const r: any = buildSystemAssessment(text, subs, null, desires);
  if (r?.kind !== 'assessment') return [];
  return synthesizeArtifact(r).payload.componentCredit as string[];
}

describe('model→brand binding never fabricates a wrong-brand product', () => {
  it('SL-1200 binds to its adjacent Technics, never to Marantz', () => {
    const names = credit('Assess my system: Technics SL-1200, Marantz 2270, Klipsch Heresy');
    const joined = names.join(' | ');
    // The fabricated product must not appear.
    expect(joined).not.toMatch(/Marantz\s*SL-?1200/i);
    // The model belongs to Technics (its adjacent brand).
    expect(joined).toMatch(/Technics\s*SL-?1200/i);
  });

  it('the adjacent-brand pairing still works (Eversolo DMP-A6)', () => {
    const names = credit('Assess my system: Chord Hugo, Eversolo DMP-A6, WLM Diva monitor');
    const joined = names.join(' | ').toLowerCase();
    // DMP-A6 keeps its adjacent brand Eversolo, not Chord.
    expect(joined).toContain('eversolo');
    expect(joined).not.toMatch(/chord\s*dmp/i);
  });
});
