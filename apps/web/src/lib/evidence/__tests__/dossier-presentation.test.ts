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

describe('the FRANCE chain produces dossiers for every component', () => {
  // The first wiring read `assessmentResult.components`, which is EMPTY on the
  // catalog path — so dossiers were built for nothing and the region never
  // rendered. `systemChain` is the authoritative list.
  const CHAIN = [
    { displayName: 'Eversolo DMP-A6', role: 'streamer' },
    { displayName: 'JOB Integrated', role: 'integrated' },
    { displayName: 'WLM Diva Monitor', role: 'speaker' },
  ];

  const views = CHAIN.map((c) => {
    const key = c.displayName.toLowerCase().replace(/[^\w\s/-]/g, ' ').replace(/\s+/g, ' ').trim();
    return presentDossier(dossierFor(key, c.displayName, {
      authoredFacts: FRANCE_FACTS, role: c.role, unknowns: FRANCE_UNKNOWN_BY_PRODUCT[key],
    }));
  });

  it('every FRANCE component gets a non-empty dossier', () => {
    for (const v of views) {
      expect(v.primary.length + v.gaps.length, v.displayName).toBeGreaterThan(0);
    }
  });

  it('Eversolo leads with lineage and the parent company', () => {
    const labels = views[0].primary.map((l) => l.label);
    expect(labels).toContain('Superseded by');
    expect(labels).toContain('Brand');
  });

  it('JOB shows the Goldmund relationship and marks reported facts', () => {
    const lines = [...views[1].primary, ...views[1].secondary];
    expect(lines.find((l) => l.label === 'Brand')?.value).toContain('Goldmund');
    expect(lines.find((l) => l.label === 'Designed in')?.standing).toBe('reported');
    expect(views[1].gaps[0]).toContain('rated output');
  });

  it('WLM shows lineage and the decision-relevant gap, not the aggregator specs', () => {
    const v = views[2];
    expect(v.primary.find((l) => l.label === 'Superseded by')?.value).toBe('Diva MK IV');
    expect(JSON.stringify(v)).not.toContain('97');
    expect(v.gaps[0]).toContain('sensitivity');
  });
});
