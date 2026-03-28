/**
 * Request 12 validation flow — full constraint enforcement audit.
 *
 * Flow: van halen → speakers → $5000 → large living room → big scale
 *       → amps same budget → no tubes → new only → class AB → big and powerful
 */

import { describe, it, expect } from 'vitest';
import { detectShoppingIntent, buildShoppingAnswer } from '../shopping-intent';
import { reason } from '../reasoning';
import { AMPLIFIER_PRODUCTS } from '../products/amplifiers';
import { SPEAKER_PRODUCTS } from '../products/speakers';
import type { ExtractedSignals } from '../signal-types';

const EMPTY: ExtractedSignals = {
  traits: {},
  symptoms: [],
  archetype_hints: [],
  uncertainty_level: 0,
  matched_phrases: [],
  matched_uncertainty_markers: [],
};

describe('Request 12: Full validation flow', () => {
  it('speakers — large room, big scale, $5000: no standmounts, realistic budget', () => {
    const text = 'i like van halen\nspeakers\nstarting from scratch\n$5000\ni have a large living room\ni want big scale';
    const ctx = detectShoppingIntent(text, EMPTY);
    const r = reason(text, [], EMPTY, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, EMPTY, undefined, r);

    console.log('\n═══ SPEAKERS: large room, big scale, $5000 ═══');
    for (const p of answer.productExamples) {
      const cat = SPEAKER_PRODUCTS.find(s => s.name === p.name);
      const sub = (cat as any)?.subcategory ?? '?';
      const avail = cat?.availability ?? '?';
      const brand = cat?.brandScale ?? '?';
      console.log(`  ${p.brand} ${p.name} ($${p.price})`);
      console.log(`    subcategory: ${sub} | availability: ${avail} | brandScale: ${brand}`);
      console.log(`    budgetRealism: ${p.budgetRealism ?? 'n/a'} | pickRole: ${p.pickRole ?? 'n/a'}`);
    }

    // No standmounts in large room
    for (const p of answer.productExamples) {
      const cat = SPEAKER_PRODUCTS.find(s => s.name === p.name);
      const sub = (cat as any)?.subcategory;
      if (sub === 'standmount') {
        console.log(`  ❌ STANDMOUNT "${p.brand} ${p.name}" should not appear for large room`);
      }
      expect(sub).not.toBe('standmount');
    }

    // All within budget
    for (const p of answer.productExamples) {
      expect(p.price).toBeLessThanOrEqual(5000);
    }

    // Budget realism tiers present
    expect(answer.productExamples[0]?.budgetRealism).toBeDefined();
  });

  it('amps — same budget, no tubes, new, class AB, big+powerful: full constraint enforcement', () => {
    const text = [
      'i like van halen',
      'speakers',
      'starting from scratch',
      '$5000',
      'i have a large living room',
      'i want big scale',
      'what about amps? same budget',
      "i don't want tubes",
      'i want new',
      'class ab amps',
      'i want something big and powerful',
    ].join('\n');

    const ctx = detectShoppingIntent(text, EMPTY);
    const r = reason(text, [], EMPTY, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, EMPTY, undefined, r);

    console.log('\n═══ AMPS: same budget, no tubes, new, class AB, big+powerful ═══');
    console.log(`budget: $${ctx.budgetAmount}`);
    console.log(`constraints: ${JSON.stringify(ctx.constraints)}`);

    let failures = 0;
    for (const p of answer.productExamples) {
      const cat = AMPLIFIER_PRODUCTS.find(a => a.name === p.name);
      const topo = cat?.topology ?? '?';
      const avail = cat?.availability ?? '?';
      const brand = cat?.brandScale ?? '?';
      const dyn = cat?.traits?.dynamics ?? '?';
      console.log(`  ${p.brand} ${p.name} ($${p.price})`);
      console.log(`    topo: ${topo} | avail: ${avail} | brand: ${brand} | dynamics: ${dyn}`);
      console.log(`    budgetRealism: ${p.budgetRealism ?? 'n/a'} | pickRole: ${p.pickRole ?? 'n/a'}`);

      if (topo === 'set' || topo === 'push-pull-tube') {
        console.log('    ❌ TUBE AMP after "no tubes"');
        failures++;
      }
      if (avail === 'discontinued' || avail === 'vintage') {
        console.log('    ❌ DISCONTINUED after "new only"');
        failures++;
      }
      if (topo !== 'class-ab-solid-state') {
        console.log(`    ❌ TOPOLOGY ${topo} after "class ab amps"`);
        failures++;
      }
    }

    expect(failures).toBe(0);
    expect(answer.productExamples.length).toBeGreaterThan(0);

    // All should be class-ab-solid-state
    for (const p of answer.productExamples) {
      const cat = AMPLIFIER_PRODUCTS.find(a => a.name === p.name);
      expect(cat?.topology).toBe('class-ab-solid-state');
    }

    // Pick roles should be assigned (4-option model uses 'anchor' instead of 'top_pick')
    const roles = answer.productExamples.map(p => p.pickRole);
    expect(roles.some(r => r === 'anchor' || r === 'top_pick')).toBe(true);

    // Budget realism should be present
    for (const p of answer.productExamples) {
      expect(p.budgetRealism).toBeDefined();
      expect(p.budgetRealism).not.toBe('above_budget');
    }
  });

  it('no esoteric products dominate mainstream flow', () => {
    const text = 'i like van halen\namps\n$5000\ni want something big and powerful';
    const ctx = detectShoppingIntent(text, EMPTY);
    const r = reason(text, [], EMPTY, null, ctx, undefined);
    const answer = buildShoppingAnswer(ctx, EMPTY, undefined, r);

    console.log('\n═══ AMPS: mainstream flow (no niche signal) ═══');
    for (const p of answer.productExamples) {
      const cat = AMPLIFIER_PRODUCTS.find(a => a.name === p.name);
      const brand = cat?.brandScale ?? '?';
      console.log(`  ${p.brand} ${p.name} ($${p.price}) [brand: ${brand}]`);
    }

    // Check that Yamamoto (boutique, low-power SET) doesn't appear
    const hasYamamoto = answer.productExamples.some(p => p.brand.toLowerCase().includes('yamamoto'));
    expect(hasYamamoto).toBe(false);
  });
});
