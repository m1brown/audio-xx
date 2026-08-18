import { describe, it, expect } from 'vitest';
import {
  isAdmissible, weakerTier, TIER_RANK, CLASS_TIER, REQUIRES_ATTRIBUTION,
  type EvidenceItem,
} from '../evidence/evidence-types';
import {
  isManufacturerFactAcceptable, toEvidenceItem, physicalFactsFor,
  numericFigure, productKeyFor, isManufacturerFactField,
} from '../evidence/manufacturer-facts';

/**
 * Manufacturer evidence — first-party published fact.
 *
 * ARCHITECTURAL DECISION (founder, 2026-08-18):
 *   separate evidence regimes -> common typed interface -> shared consumers
 *
 * These tests hold the boundary that decision draws: the shape is shared, the
 * governance is not, and normalisation may never erase class, tier, scope or
 * attribution.
 */

const ACORA = 'Acora QRC-2';
const GOOD = {
  field: 'sensitivity' as const,
  value: '86 dB',
  sourceUrl: 'https://www.acoraacoustics.com/qrc-2',
  quotedText: 'Sensitivity: 86 dB / 2.83V / 1m',
};

describe('admission is about form, and the form is the audit trail', () => {
  it('accepts a quoted first-party specification', () => {
    expect(isManufacturerFactAcceptable(GOOD)).toBe(true);
  });

  it('refuses a field outside the controlled vocabulary', () => {
    expect(isManufacturerFactField('sound_signature')).toBe(false);
    expect(isManufacturerFactAcceptable({ ...GOOD, field: 'sound_signature' })).toBe(false);
  });

  it('refuses a fact that cannot be quoted', () => {
    expect(isManufacturerFactAcceptable({ ...GOOD, quotedText: '' })).toBe(false);
  });

  it('refuses a quote that does not contain the value it supposedly sources', () => {
    // Otherwise the quote is decoration rather than evidence.
    expect(isManufacturerFactAcceptable({
      ...GOOD, quotedText: 'A three-way floorstanding loudspeaker.',
    })).toBe(false);
  });

  it('refuses a URL with commentary attached', () => {
    // Same defect the corroboration layer met: new URL() percent-encodes the
    // space rather than throwing, so the check has to be explicit.
    expect(isManufacturerFactAcceptable({
      ...GOOD, sourceUrl: 'https://www.acoraacoustics.com/ (see spec tab)',
    })).toBe(false);
  });

  it('REFUSES manufacturer marketing dressed as specification', () => {
    // The failure this exists to prevent: a maker writes "the 96 dB
    // sensitivity delivers breathtaking dynamics" and the sonic half arrives
    // carrying the specification's authority.
    for (const value of [
      '96 dB of breathtaking dynamics',
      'natural, transparent 8 ohm load',
      'reference-grade 200W output',
    ]) {
      expect(isManufacturerFactAcceptable({
        ...GOOD, value, quotedText: `Specification: ${value}`,
      })).toBe(false);
    }
  });
});

describe('normalisation preserves what D-7 depends on', () => {
  const item = toEvidenceItem(ACORA, GOOD, 1_700_000_000_000);

  it('keeps class, tier, scope and attribution', () => {
    expect(item.evidenceClass).toBe('manufacturer');
    expect(item.tier).toBe('manufacturer');
    expect(item.scope).toBe('product');
    expect(item.attribution?.sourceUrl).toBe(GOOD.sourceUrl);
    expect(item.attribution?.quotedText).toBe(GOOD.quotedText);
  });

  it('keys by product identity, not by turn or assessment', () => {
    expect(item.productKey).toBe(productKeyFor(ACORA));
    expect(item.productKey).toBe('acora qrc-2');
    expect(JSON.stringify(item)).not.toMatch(/session|turn|assessment|listener/i);
  });

  it('refuses to admit an item whose tier disagrees with its class', () => {
    // The one way normalisation could silently launder authority.
    expect(isAdmissible({ ...item, tier: 'catalog' })).toBe(false);
    expect(isAdmissible({ ...item, tier: 'manufacturer' })).toBe(true);
  });

  it('refuses a manufacturer fact claiming brand scope', () => {
    // A maker publishes about the thing they made, not about their catalogue.
    expect(isAdmissible({ ...item, scope: 'brand' })).toBe(false);
  });

  it('refuses an attributable class with no attribution', () => {
    expect(REQUIRES_ATTRIBUTION.has('manufacturer')).toBe(true);
    expect(REQUIRES_ATTRIBUTION.has('independent_review')).toBe(true);
    expect(isAdmissible({ ...item, attribution: undefined })).toBe(false);
  });
});

describe('the tier order is the founder’s, and scope settles the rest', () => {
  it('ranks curated above manufacturer above review above model above listener', () => {
    expect(TIER_RANK.catalog).toBeGreaterThan(TIER_RANK.brand);
    expect(TIER_RANK.brand).toBeGreaterThan(TIER_RANK.manufacturer);
    expect(TIER_RANK.manufacturer).toBeGreaterThan(TIER_RANK.independent_review);
    expect(TIER_RANK.independent_review).toBeGreaterThan(TIER_RANK.model);
    expect(TIER_RANK.model).toBeGreaterThan(TIER_RANK.listener);
  });

  it('a manufacturer fact outranks model memory', () => {
    // The point of the class: attributable and checkable beats unverifiable.
    expect(weakerTier('manufacturer', 'model')).toBe('model');
  });

  it('maps every class to exactly one tier', () => {
    expect(CLASS_TIER.manufacturer).toBe('manufacturer');
    expect(CLASS_TIER.model).toBe('model');
    expect(CLASS_TIER.listener).toBe('listener');
  });
});

describe('the physical projection is parsed, never interpreted', () => {
  const items: EvidenceItem[] = [
    toEvidenceItem(ACORA, GOOD, Date.now()),
    toEvidenceItem(ACORA, { field: 'impedance', value: '8 ohms',
      sourceUrl: 'https://www.acoraacoustics.com/qrc-2',
      quotedText: 'Nominal impedance: 8 ohms' }, Date.now()),
  ];

  it('projects the figures a constraint layer can use', () => {
    const p = physicalFactsFor(items);
    expect(p.sensitivityDb).toBe(86);
    expect(p.impedanceOhms).toBe(8);
    expect(p.source.sensitivity).toContain('acoraacoustics.com');
  });

  it('returns undefined rather than guessing at an unparseable figure', () => {
    expect(numericFigure({ ...items[0], value: 'see chart' })).toBeUndefined();
    expect(physicalFactsFor([{ ...items[0], value: 'see chart' }]).sensitivityDb)
      .toBeUndefined();
  });

  it('ignores evidence from other regimes', () => {
    // The projection is manufacturer-only by construction; a review's
    // measurement is a different regime with different governance.
    const review: EvidenceItem = { ...items[0], evidenceClass: 'independent_review',
      tier: 'independent_review' };
    expect(physicalFactsFor([review]).sensitivityDb).toBeUndefined();
  });
});
