import { describe, it, expect } from 'vitest';
import {
  dossierFor, specRoleFor, admitReportedSpec, usableInCalculation,
  admissibleAsPremise, specsWithRole, type ProductFact,
} from '../product-dossier';
import { FRANCE_FACTS, FRANCE_UNKNOWN_BY_PRODUCT } from '../france-product-facts';
import { parseQuantities, amplifierPowers, assessDriveCapability } from '../physical-quantities';

const fact = (over: Partial<ProductFact>): ProductFact => ({
  productKey: 'x', predicate: 'specification', value: '1',
  sourceClass: 'maker_published', state: 'established', ...over,
});

describe('provenance and knowledge state are independent axes', () => {
  it('an absence is a STATE, never a source class', () => {
    // "not_established" as an Audio XX interpretation would make our silence
    // look like our opinion.
    const d = dossierFor('wlm diva monitor', 'WLM Diva Monitor', {
      unknowns: FRANCE_UNKNOWN_BY_PRODUCT['wlm diva monitor'],
    });
    expect(d.unknowns[0].decisionRelevant).toBe(true);
    expect(d.facts.every((f) => f.state !== 'not_established')).toBe(true);
  });

  it('holds no Audio XX interpretation as a fact', () => {
    // A dossier that can contain our prose is a dossier that will fill with it.
    const classes = [...new Set(FRANCE_FACTS.map((f) => f.sourceClass))];
    expect(classes).not.toContain('audio_xx_interpretation');
    for (const f of FRANCE_FACTS) expect(f.value.split(' ').length).toBeLessThan(22);
  });
});

describe('type 3 admission — approved references only', () => {
  const base = { requestedProductName: 'WLM Diva Monitor', field: 'sensitivity' };

  it('REFUSES the aggregator the FRANCE figures came from', () => {
    expect(admitReportedSpec({ ...base, reportedProductName: 'WLM Diva Monitor',
      sourceUrl: 'https://www.hifi-guide.com/loudspeaker/wlm-diva-monitor/' }))
      .toEqual({ admitted: false, reason: 'source_not_approved' });
  });

  it('refuses retailers and marketplaces', () => {
    for (const u of ['https://www.ebay.com/itm/1', 'https://listenup.com/products/x',
      'https://www.musicdirect.com/equipment/x']) {
      expect(admitReportedSpec({ ...base, reportedProductName: 'WLM Diva Monitor', sourceUrl: u })
        .admitted, u).toBe(false);
    }
  });

  it('refuses an approved source that names the wrong variant', () => {
    // WLM has shipped four Diva generations. "Diva" does not establish
    // "Diva Monitor" — a concrete reason, not a procedural one.
    expect(admitReportedSpec({ ...base, reportedProductName: 'WLM Diva',
      sourceUrl: 'https://www.stereophile.com/content/wlm-diva' }))
      .toEqual({ admitted: false, reason: 'identity_not_exact' });
  });

  it('accepts an approved source naming the exact product', () => {
    expect(admitReportedSpec({ ...base, reportedProductName: 'Diva Monitor',
      sourceUrl: 'https://www.stereophile.com/content/wlm-diva' }))
      .toEqual({ admitted: true, publication: 'Stereophile' });
  });

  it('refuses a field a maker would not publish as a spec', () => {
    expect(admitReportedSpec({ requestedProductName: 'WLM Diva Monitor',
      reportedProductName: 'WLM Diva Monitor', field: 'soundstage',
      sourceUrl: 'https://www.stereophile.com/content/wlm-diva' }))
      .toEqual({ admitted: false, reason: 'field_not_a_stable_spec' });
  });
});

describe('a reported spec may be displayed and never reasoned from', () => {
  const reported = fact({ sourceClass: 'third_party_reported', state: 'reported' });

  it('is excluded from calculations but published ones are not', () => {
    expect(usableInCalculation(reported)).toBe(false);
    expect(usableInCalculation(fact({}))).toBe(true);
    expect(usableInCalculation(fact({ sourceClass: 'independently_measured' }))).toBe(true);
  });

  it('is excluded from D-12 premises', () => {
    expect(admissibleAsPremise(reported)).toBe(false);
    expect(admissibleAsPremise(fact({ sourceClass: 'listening_observation' }))).toBe(true);
  });

  it('never reaches the drive rule even carrying the right role', () => {
    const d = dossierFor('p', 'P', { authoredFacts: [fact({
      productKey: 'p', specRole: 'loudspeaker_sensitivity',
      sourceClass: 'third_party_reported', state: 'reported', value: '97',
    })] });
    expect(specsWithRole(d, 'loudspeaker_sensitivity')).toEqual([]);
  });
});

describe('THE POWER-OUTPUT ROLE COLLISION', () => {
  it('a streaming DAC publishing 13 W is not an amplifier', () => {
    expect(specRoleFor('power_output', 'streamer')).toBe('source_output');
    expect(specRoleFor('power_output', 'amplifier')).toBe('amplifier_output');
  });

  it('leaves the role UNDEFINED when the component role is unknown', () => {
    expect(specRoleFor('power_output', undefined)).toBeUndefined();
  });

  it('excludes the Eversolo figure from amplifier power selection', () => {
    const q = [
      ...parseQuantities('Eversolo DMP-A6', 'power_output', '13W', { role: 'streamer' }),
      ...parseQuantities('JOB INTegrated', 'power_output', '125 W into 8 ohms', { role: 'amplifier' }),
    ];
    expect(amplifierPowers(q).map((a) => a.subject)).toEqual(['JOB INTegrated']);
  });

  it('selects NOTHING rather than the streamer when the amplifier publishes nothing', () => {
    // The live FRANCE state. Before the fix this treated a 13 W streaming DAC
    // as the system's amplifier.
    const q = parseQuantities('Eversolo DMP-A6', 'power_output', '13W', { role: 'streamer' });
    expect(amplifierPowers(q)).toEqual([]);
    const load = parseQuantities('WLM Diva Monitor', 'impedance', '8 ohm', { role: 'speaker' })[0];
    expect(assessDriveCapability(amplifierPowers(q), load, undefined).status).toBe('incomplete');
  });
});

describe('country semantics stay separate', () => {
  it('maps catalog country to BRAND ORIGIN only, never manufacture', () => {
    const d = dossierFor('job integrated', 'JOB INTegrated', {
      authoredFacts: FRANCE_FACTS, brandOriginCountry: 'Switzerland',
    });
    expect(d.facts.find((f) => f.predicate === 'brand_origin_country')?.value).toBe('Switzerland');
    expect(d.facts.some((f) => f.predicate === 'manufacture_country')).toBe(false);
    expect(d.facts.find((f) => f.predicate === 'design_origin_country')?.state).toBe('reported');
  });
});

describe('the FRANCE dossiers', () => {
  it('Eversolo carries lineage, parent and range position', () => {
    const d = dossierFor('eversolo dmp-a6', 'Eversolo DMP-A6', {
      authoredFacts: FRANCE_FACTS, role: 'streamer',
      heldSpecs: [{ field: 'power_output', value: '13W' }], brandOriginCountry: 'China',
    });
    const p = (k: string) => d.facts.find((f) => f.predicate === k)?.value;
    expect(p('parent_company')).toBe('Zidoo');
    expect(p('successor')).toBe('DMP-A6 Gen 2');
    expect(p('range_position')).toContain('Master Edition');
// P0 2026-08-26: a watt figure on a component that drives nothing licenses
    // no dossier line at all — Eversolo's "Rated Power: 13W" is the unit's
    // power draw, and rendering it as POWER OUTPUT under the amplifier gloss
    // was the defect. Role-incompatible held specs are excluded, not retyped.
    expect(d.facts.find((f) => f.qualifier === 'power_output')).toBeUndefined();
  });

  it('does NOT back-apply Gen 2 architecture to the model the listener owns', () => {
    // The original now carries its own architecture fact, acquired from a
    // page that names the Gen 1 explicitly (2026-08-27). The invariant that
    // survives: nothing sourced from the Gen 2 announcement may appear here,
    // and the original's facts carry the weaker 'reported' provenance their
    // dealer sourcing honestly is.
    const d = dossierFor('eversolo dmp-a6', 'Eversolo DMP-A6', { authoredFacts: FRANCE_FACTS });
    const arch = d.facts.filter((f) => f.predicate === 'architecture_element');
    for (const f of arch) {
      expect(f.sourceUrl ?? '').not.toContain('shop.zidoo.tv');
      expect(f.state).toBe('reported');
    }
  });

  it('JOB carries the Goldmund relationship as first-party', () => {
    const d = dossierFor('job integrated', 'JOB INTegrated', { authoredFacts: FRANCE_FACTS });
    const rel = d.facts.find((f) => f.predicate === 'manufacturing_relationship');
    expect(rel?.sourceClass).toBe('maker_published');
    expect(rel?.value).toContain('Goldmund');
  });

  it('WLM carries lineage but NOT the aggregator specs', () => {
    const d = dossierFor('wlm diva monitor', 'WLM Diva Monitor', {
      authoredFacts: FRANCE_FACTS, unknowns: FRANCE_UNKNOWN_BY_PRODUCT['wlm diva monitor'],
    });
    expect(d.facts.find((f) => f.predicate === 'successor')?.value).toBe('Diva MK IV');
    expect(JSON.stringify(d.facts)).not.toContain('97');
    expect(d.unknowns[0].wouldCloseWith).toContain('sensitivity');
  });
});
