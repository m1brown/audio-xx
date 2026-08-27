import { describe, it, expect } from 'vitest';
import { seedObservations, PRODUCT_IDENTITIES } from '../evidence/independent-review-seed';
import { admitReviewObservation } from '../evidence/independent-review';
import { FRANCE_FACTS, FRANCE_UNKNOWN_BY_PRODUCT, FRANCE_SUPERSEDED_HELD_SPECS } from '../evidence/france-product-facts';
import { dossierFor } from '../evidence/product-dossier';
import { presentDossier } from '../evidence/dossier-presentation';
import { deriveCharacter } from '../evidence/component-character';

/**
 * SPARSE-EVIDENCE CAPABILITY (2026-08-27).
 *
 * The FRANCE diagnosis: Audio XX behaved as "exact-product evidence OR
 * abstention". The capability added here is the middle: acquire, classify by
 * strength, and derive the strongest LICENSED propositions — family evidence
 * through a maker-stated bridge, reported claims that keep their distance,
 * architecture judgments that never become sonic character.
 */

const JOB_ROWS = () => seedObservations().admitted
  .filter((o) => o.productKey === 'job integrated');

describe('family evidence — maker-bridged, never exact-product', () => {
  it('the JOB 225 observations admit under the INTegrated through the bridge', () => {
    const rows = JOB_ROWS();
    expect(rows.length).toBeGreaterThanOrEqual(5);
    for (const r of rows) {
      expect(r.productName).toBe('JOB 225');
      expect(r.familyBridge?.referenceName).toBe('JOB 225');
      expect(r.familyBridge?.makerStatementUrl).toContain('jobsys.com');
      expect(r.condition?.description ?? '').toMatch(/JOB 225/);
    }
  });

  it('the same observation WITHOUT the bridge is rejected as a different product', () => {
    const row = JOB_ROWS()[0];
    const stripped = { ...row, familyBridge: undefined };
    const v = admitReviewObservation('JOB INTegrated', stripped as never, true);
    expect(v.admitted).toBe(false);
    if (!v.admitted) expect(v.reason).toBe('different_product');
  });

  it('a bridge whose condition does not name the reference model is refused', () => {
    const row = JOB_ROWS()[0];
    const silent = {
      ...row,
      condition: { kind: 'other' as const, description: 'heard in the reviewer’s room' },
    };
    const v = admitReviewObservation('JOB INTegrated', silent as never, true);
    expect(v.admitted).toBe(false);
  });

  it('family evidence yields only conditional character — never unqualified', () => {
    const { propositions } = deriveCharacter(
      'job integrated', 'JOB INTegrated', JOB_ROWS() as never);
    expect(propositions.length).toBeGreaterThan(0);
    for (const prop of propositions) {
      expect(prop.basis).toBe('conditional');
      // The condition rides on the proposition's conditions list, and every
      // one names the reference model — the distance renders with the claim.
      const conds = (prop as never as { conditions: Array<{ description: string }> }).conditions;
      expect(conds.length).toBeGreaterThan(0);
      expect(conds[0].description).toMatch(/JOB 225/);
    }
  });
});

describe('reported claims keep their distance', () => {
  const wlmView = () => presentDossier(dossierFor('wlm diva monitor', 'WLM Diva Monitor', {
    authoredFacts: FRANCE_FACTS, role: 'speaker',
    unknowns: FRANCE_UNKNOWN_BY_PRODUCT['wlm diva monitor'],
  }));

  it('the WLM sensitivity renders as a reported claim, with the reporter named', () => {
    const v = wlmView();
    const line = [...v.primary, ...v.secondary]
      .find((l) => l.label.toLowerCase().startsWith('sensitivity'));
    expect(line).toBeTruthy();
    expect(line!.value).toContain('95');
    expect(line!.standing).toBe('reported');
    expect(line!.label).toMatch(/reported|claim/i);
  });

  it('the reported figure cannot satisfy the ESTABLISHED headroom lane', () => {
    // The established lane looks the figure up by exact label 'sensitivity';
    // a reported claim carries its provenance in the label and so never
    // matches — fail-closed by construction, pinned here so a label cleanup
    // cannot silently license arithmetic on a claim.
    const v = wlmView();
    const exact = [...v.primary, ...v.secondary]
      .find((l) => l.label.toLowerCase() === 'sensitivity');
    expect(exact).toBeUndefined();
  });
});

describe('identity discipline for the sparse products', () => {
  it('variant traps are declared for every FRANCE identity', () => {
    const byKey = Object.fromEntries(PRODUCT_IDENTITIES.map((i) => [i.productKey, i]));
    expect(byKey['job integrated'].excludes).toContain('job 225');
    expect(byKey['wlm diva monitor'].excludes).toContain('wlm diva mk iv');
    expect(byKey['eversolo dmp-a6'].excludes).toContain('eversolo dmp-a6 gen 2');
  });

  it('the contaminated Eversolo held rows are superseded, not shown', () => {
    expect(FRANCE_SUPERSEDED_HELD_SPECS['eversolo dmp-a6']).toContain('power_output');
    expect(FRANCE_SUPERSEDED_HELD_SPECS['eversolo dmp-a6']).toContain('frequency_response');
  });
});

describe('architecture judgment is never sonic character', () => {
  it('the JOB family power reference is not an amplifier_output spec', () => {
    const jobFacts = FRANCE_FACTS.filter((f) => f.productKey === 'job integrated');
    for (const f of jobFacts) {
      expect(f.specRole).not.toBe('amplifier_output');
    }
    const bridge = jobFacts.find((f) => /equivalent to the JOB 225/i.test(f.value));
    expect(bridge).toBeTruthy();
    expect(bridge!.predicate).toBe('architecture_element');
    expect(bridge!.quotedText).toContain('equivalent to a JOB 225');
  });
});
