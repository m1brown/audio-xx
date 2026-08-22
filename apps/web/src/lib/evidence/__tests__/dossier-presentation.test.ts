import { describe, it, expect } from 'vitest';
import { presentDossier } from '../dossier-presentation';
import { dossierFor } from '../product-dossier';
import { FRANCE_FACTS, FRANCE_UNKNOWN_BY_PRODUCT } from '../france-product-facts';

const eversolo = () => presentDossier(dossierFor('eversolo dmp-a6', 'Eversolo DMP-A6', {
  authoredFacts: FRANCE_FACTS, role: 'streamer', brandOriginCountry: 'China',
  heldSpecs: [
    { field: 'power_output', value: '13W' },
    { field: 'frequency_response', value: '20Hz~20KHz (±0.15dB)' },
    { field: 'dimensions', value: 'L 187mm * W 270mm * H 90mm' },
  ],
}));

describe('the dossier shows what is useful, not what is filled', () => {
  it('leads with lineage, brand and range position', () => {
    const labels = eversolo().primary.map((l) => l.label);
    expect(labels).toContain('Superseded by');
    expect(labels).toContain('Brand');
    expect(labels).toContain('In the range');
  });

  it('demotes shipping data below the fold', () => {
    const v = eversolo();
    const secondary = v.secondary.map((l) => l.label);
    expect(secondary).toContain('dimensions');
    expect(v.primary.map((l) => l.label)).not.toContain('dimensions');
  });

  it('does not promote a source-output watt figure as a useful spec', () => {
    // 13 W on a streaming DAC is not a figure a listener acts on, and
    // promoting it is how the role collision became visible in the first place.
    expect(eversolo().primary.map((l) => l.label)).not.toContain('power output');
  });

  it('emits STRUCTURE, never sentences', () => {
    // Prose here would have to pass the relational filter; typed lines do not.
    for (const l of [...eversolo().primary, ...eversolo().secondary]) {
      expect(l.value.split(' ').length, l.value).toBeLessThan(22);
      expect(l.value.trim()).not.toMatch(/\.$/);
    }
  });
});

describe('standing travels with the value', () => {
  it('marks a reported fact and names its publication', () => {
    const v = presentDossier(dossierFor('job integrated', 'JOB INTegrated', {
      authoredFacts: FRANCE_FACTS, brandOriginCountry: 'Switzerland',
    }));
    const designed = [...v.primary, ...v.secondary].find((l) => l.label === 'Designed in');
    expect(designed?.standing).toBe('reported');
    expect(designed?.publication).toBe('Sound & Vision');
  });

  it('leaves maker-published facts unmarked', () => {
    const brand = eversolo().primary.find((l) => l.label === 'Brand');
    expect(brand?.standing).toBeUndefined();
  });
});

describe('absence surfaces only when it is decision-relevant', () => {
  it('states the WLM gap, because it blocks the drive question', () => {
    const v = presentDossier(dossierFor('wlm diva monitor', 'WLM Diva Monitor', {
      authoredFacts: FRANCE_FACTS, brandOriginCountry: 'Austria',
      unknowns: FRANCE_UNKNOWN_BY_PRODUCT['wlm diva monitor'],
    }));
    expect(v.gaps).toHaveLength(1);
    expect(v.gaps[0]).toContain('sensitivity');
  });

  it('states nothing for a product with no decision-relevant gap', () => {
    expect(eversolo().gaps).toEqual([]);
  });
});
