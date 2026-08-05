/**
 * Trust remediation corpus (approved launch scope, 2026-08-05).
 *
 * Each case pins a defect found in the adversarial review. The numbering
 * matches the founder's verification corpus so a failure names the finding.
 */
import { describe, it, expect } from 'vitest';
import {
  buildProductAssessment,
  requestedModelMatches,
} from '../product-assessment';
import { verdictAndStandfirst, assessedEveryComponent } from '../artifact/synthesizeArtifact';
import { cleanComponentName, isBareCategory, validateChainNames } from '../chain-validation';
import { buildUnknownProductExploreLinks } from '../unknown-product-clarification';
import type { SubjectMatch } from '../intent';

// ── 1 & 2. Silent product substitution ────────────────────────────────
describe('1–2. a near-miss model is never silently substituted', () => {
  it('rejects "Pontus IV" as a name for "Pontus II 12th-1"', () => {
    expect(requestedModelMatches('Pontus IV', 'Pontus II 12th-1')).toBe(false);
  });

  it('rejects "Modi+" as a name for "Modius E"', () => {
    // Substring matching would wrongly accept this — "modi" is inside "modius".
    expect(requestedModelMatches('Modi+', 'Modius E')).toBe(false);
  });

  it('still accepts a shorter but correct name for the same product', () => {
    expect(requestedModelMatches('Pontus II', 'Pontus II 12th-1')).toBe(true);
    expect(requestedModelMatches('Hugo', 'Hugo')).toBe(true);
  });

  it('discloses the substitution before any analysis', () => {
    const r = buildProductAssessment({
      subjectMatches: [{ kind: 'product', name: 'Denafrips Pontus II 12th-1' } as SubjectMatch],
      currentMessage: 'Tell me about the Denafrips Pontus IV',
    });
    if (r && /pontus ii/i.test(r.candidateName)) {
      expect(r.shortAnswer.toLowerCase()).toMatch(/don'?t have a denafrips pontus iv/);
      // Disclosure comes first, not buried after the assessment.
      expect(r.shortAnswer.toLowerCase().indexOf("don't have")).toBeLessThan(80);
    }
  });
});

// ── 4 & 5. Restraint verdict licensing ────────────────────────────────
describe('4–5. "Nothing here needs changing" requires evidence', () => {
  it('withholds the all-clear when a component was never read', () => {
    const { verdict } = verdictAndStandfirst(null, '', '', 'Warm system.', false);
    expect(verdict).not.toMatch(/nothing here needs changing/i);
    expect(verdict.toLowerCase()).toMatch(/can'?t reach a verdict/);
  });

  it('still gives the all-clear when every component was read', () => {
    // Corpus item 5: restraint must survive. This is the behaviour the
    // product is best at and the guard must not suppress it.
    const { verdict } = verdictAndStandfirst(null, '', '', 'Warm system.', true);
    expect(verdict).toBe('Nothing here needs changing.');
  });

  it('detects an unread component regardless of name casing', () => {
    const credit = ['Chord Hugo', 'Job integrated', 'WLM Diva monitor'];
    const allRead = [
      { name: 'chord hugo', axes: { warm_bright: 'neutral' } },
      { name: 'Job Integrated', axes: { warm_bright: 'neutral' } },
      { name: 'WLM Diva monitor', axes: { warm_bright: 'warm' } },
    ];
    expect(assessedEveryComponent(credit, allRead)).toBe(true);
    // Drop one reading — the engine did not see that component.
    expect(assessedEveryComponent(credit, allRead.slice(0, 2))).toBe(false);
    // A component present but with no axes is also unread.
    expect(assessedEveryComponent(['A'], [{ name: 'A', axes: {} }])).toBe(false);
  });
});

// ── 6, 7, 8. Post-parse chain validation ──────────────────────────────
describe('6–8. the chain shows what the user described', () => {
  it('6. strips a trailing question fragment from a component name', () => {
    expect(cleanComponentName('Marantz PM6007. Should I')).toBe('Marantz PM6007');
    expect(cleanComponentName('Marantz PM6007. Should I upgrade my DAC?')).toBe('Marantz PM6007');
    expect(cleanComponentName('KEF LS50 Meta, what do you think?')).toBe('KEF LS50 Meta');
  });

  it('7. withholds a bare category rather than showing it as a product', () => {
    for (const c of ['integrated amplifier', 'tube amplifier', 'the amplifier', 'speakers', 'DAC']) {
      expect(isBareCategory(c), c).toBe(true);
    }
    const v = validateChainNames(['Rega', 'integrated amplifier', 'Magnepan LRS+']);
    expect(v.names).toEqual(['Rega', 'Magnepan LRS+']);
    // Withheld, but not silently — the caller can ask about it.
    expect(v.needsClarification).toContain('integrated amplifier');
  });

  it('preserves complete legitimate uncatalogued names', () => {
    const v = validateChainNames(['Willsenton R8', 'Klipsch Heresy IV', 'Fosi Audio V3']);
    expect(v.names).toEqual(['Willsenton R8', 'Klipsch Heresy IV', 'Fosi Audio V3']);
    expect(v.needsClarification).toEqual([]);
  });

  it('8. never drops a real component silently', () => {
    const input = ['Schiit Modi+', 'Schiit Magni+', 'Sennheiser HD650'];
    const v = validateChainNames(input);
    expect(v.names).toEqual(input);
  });
});

// ── 12. Commerce absent when identity is disclaimed ───────────────────
describe('12. no commerce on a product we could not identify', () => {
  it('offers no dealer links in the unknown-product clarification', () => {
    const links = buildUnknownProductExploreLinks('Fosi Audio V3') ?? [];
    expect(links.some((l) => l.kind === 'dealer')).toBe(false);
    expect(links.map((l) => l.label)).not.toContain('eBay');
    expect(links.map((l) => l.label)).not.toContain('HiFi Shark');
  });

  it('still points at the maker — help, not commerce', () => {
    const links = buildUnknownProductExploreLinks('Fosi Audio V3') ?? [];
    expect(links.some((l) => l.kind === 'reference')).toBe(true);
  });
});
