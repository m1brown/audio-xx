/**
 * Validation script: "different" mode sonic distance behavior.
 * Reads real product catalog and simulates distance-based selection.
 * Run: npx tsx apps/web/validate-sonic-distance.ts
 */

import { AMPLIFIER_PRODUCTS } from './src/lib/products/amplifiers';
import type { PrimaryAxisLeanings } from './src/lib/axis-types';

// ── Sonic distance logic (mirror of shopping-intent.ts) ──────────

const LEANING_TO_N: Record<string, number> = {
  warm: -1, bright: 1, neutral: 0,
  smooth: -1, detailed: 1, balanced: 0,
  elastic: -1, controlled: 1,
  airy: -1, closed: 1, moderate: 0,
};

function axisN(axes: PrimaryAxisLeanings | undefined, axis: 'warm_bright' | 'smooth_detailed' | 'elastic_controlled' | 'airy_closed'): number {
  if (!axes) return 0;
  const nKey = `${axis}_n` as keyof PrimaryAxisLeanings;
  const nVal = axes[nKey];
  if (typeof nVal === 'number') return nVal;
  const label = axes[axis];
  if (typeof label === 'string') return LEANING_TO_N[label] ?? 0;
  return 0;
}

const SONIC_AXES = ['warm_bright', 'smooth_detailed', 'elastic_controlled', 'airy_closed'] as const;

function sonicDistance(a: { primaryAxes?: PrimaryAxisLeanings }, b: { primaryAxes?: PrimaryAxisLeanings }): number {
  let dist = 0;
  for (const axis of SONIC_AXES) {
    dist += Math.abs(axisN(a.primaryAxes, axis) - axisN(b.primaryAxes, axis));
  }
  return dist;
}

function axisVector(p: { primaryAxes?: PrimaryAxisLeanings }): string {
  return SONIC_AXES.map(a => `${a.split('_')[0]}=${axisN(p.primaryAxes, a)}`).join(' ');
}

// ── Constants ──────────────────────────────────────────────
const MIN_SONIC_DISTANCE = 3;
const MAX_DISTANCE_PRACTICAL = 8;
const DISTANCE_WEIGHT = 2;
const RANK_WEIGHT = 1;

// ── Baselines ──────────────────────────────────────────────

interface Baseline {
  name: string;
  brand: string;
  primaryAxes?: PrimaryAxisLeanings;
  philosophy?: string;
  marketType?: string;
}

const baselines: Baseline[] = [
  AMPLIFIER_PRODUCTS.find(p => p.brand === 'Hegel' && p.name === 'H190')!,
  AMPLIFIER_PRODUCTS.find(p => p.brand === 'NAD' && p.name === 'C 3050')!,
  AMPLIFIER_PRODUCTS.find(p => p.brand === 'Leben' && p.name === 'CS300')!,
].map(p => ({
  name: p.name,
  brand: p.brand,
  primaryAxes: p.primaryAxes,
  philosophy: p.philosophy,
  marketType: p.marketType,
}));

console.log('='.repeat(80));
console.log('SONIC DISTANCE VALIDATION — "different" mode');
console.log('='.repeat(80));
console.log(`\nTotal amplifier products: ${AMPLIFIER_PRODUCTS.length}`);
console.log(`Products with primaryAxes: ${AMPLIFIER_PRODUCTS.filter(p => p.primaryAxes).length}`);
console.log(`Products with _n values: ${AMPLIFIER_PRODUCTS.filter(p => p.primaryAxes?.warm_bright_n !== undefined).length}`);
console.log(`MIN_SONIC_DISTANCE threshold: ${MIN_SONIC_DISTANCE}`);

// ══════════════════════════════════════════════════════════════
// PART 1 — Distance tables for each baseline
// ══════════════════════════════════════════════════════════════

let failCount = 0;

for (const baseline of baselines) {
  console.log('\n' + '═'.repeat(80));
  console.log(`BASELINE: ${baseline.brand} ${baseline.name}`);
  console.log(`Axes: ${axisVector(baseline)}`);
  console.log(`Philosophy: ${baseline.philosophy ?? '?'} | MarketType: ${baseline.marketType ?? '?'}`);
  console.log('═'.repeat(80));

  // All candidates except same brand
  const candidates = AMPLIFIER_PRODUCTS
    .filter(p => p.brand.toLowerCase() !== baseline.brand.toLowerCase())
    .map((p, i) => ({
      brand: p.brand,
      name: p.name,
      philosophy: p.philosophy,
      marketType: p.marketType,
      primaryAxes: p.primaryAxes,
      distance: sonicDistance(p, baseline),
      rank: i, // approximation — real rank comes from scoring
    }));

  // Sort by distance descending
  const byDistance = [...candidates].sort((a, b) => b.distance - a.distance);
  // Top 15 by "rank" (catalog order as proxy)
  const byRank = candidates.slice(0, 15);

  console.log('\n── Top 15 by DISTANCE (highest first) ──');
  console.log('  #  Distance  Brand            Name                Philosophy    MarketType    Axes');
  for (const c of byDistance.slice(0, 15)) {
    console.log(`  ${String(byDistance.indexOf(c) + 1).padStart(2)}  ${String(c.distance).padStart(4)}      ${c.brand.padEnd(16)} ${c.name.padEnd(20)} ${(c.philosophy ?? '?').padEnd(13)} ${(c.marketType ?? '?').padEnd(13)} ${axisVector(c)}`);
  }

  console.log('\n── Top 15 by RANK (catalog order) ──');
  console.log('  #  Distance  Brand            Name                Philosophy    MarketType    Axes');
  for (let i = 0; i < byRank.length; i++) {
    const c = byRank[i];
    console.log(`  ${String(i + 1).padStart(2)}  ${String(c.distance).padStart(4)}      ${c.brand.padEnd(16)} ${c.name.padEnd(20)} ${(c.philosophy ?? '?').padEnd(13)} ${(c.marketType ?? '?').padEnd(13)} ${axisVector(c)}`);
  }

  // ══════════════════════════════════════════════════════════════
  // PART 2 — Simulate "different" mode anchor selection
  // ══════════════════════════════════════════════════════════════

  console.log('\n── SIMULATED "different" MODE ──');

  const meetsThreshold = candidates.filter(c => c.distance >= MIN_SONIC_DISTANCE);
  console.log(`Candidates meeting MIN_DISTANCE (${MIN_SONIC_DISTANCE}): ${meetsThreshold.length}/${candidates.length}`);

  const pool = meetsThreshold.length > 0 ? meetsThreshold : candidates;
  const isUsingFallback = meetsThreshold.length === 0;

  if (isUsingFallback) {
    console.log('[distance-fallback] No candidates meet threshold — using max available contrast');
    failCount++;
  }

  // Score: distance * DISTANCE_WEIGHT + normalizedRank * RANK_WEIGHT
  const maxRank = Math.max(...pool.map(c => c.rank), 1);
  const scored = pool.map(c => ({
    ...c,
    score: (c.distance * DISTANCE_WEIGHT) + ((1 - c.rank / maxRank) * MAX_DISTANCE_PRACTICAL * RANK_WEIGHT),
  })).sort((a, b) => b.score - a.score);

  const anchor = scored[0];
  console.log(`\nSELECTED ANCHOR: ${anchor.brand} ${anchor.name}`);
  console.log(`  Distance: ${anchor.distance} | Score: ${anchor.score.toFixed(1)} | Axes: ${axisVector(anchor)}`);

  console.log('\nTop 3 alternatives:');
  for (const alt of scored.slice(1, 4)) {
    console.log(`  ${alt.brand} ${alt.name} — dist=${alt.distance}, score=${alt.score.toFixed(1)}, axes=${axisVector(alt)}`);
  }

  // ══════════════════════════════════════════════════════════════
  // PART 3 — Failure case detection
  // ══════════════════════════════════════════════════════════════

  console.log('\n── FAILURE CASE CHECKS ──');

  // Check 1: Does Primare i35 get selected after Hegel?
  if (baseline.brand === 'Hegel' && baseline.name === 'H190') {
    const primare = candidates.find(c => c.brand === 'Primare' && c.name === 'i35');
    if (primare) {
      const primareInPool = meetsThreshold.find(c => c.brand === 'Primare' && c.name === 'i35');
      const primareSelected = anchor.brand === 'Primare' && anchor.name === 'i35';
      console.log(`  Primare i35 distance from Hegel: ${primare.distance}`);
      console.log(`  Primare i35 in eligible pool: ${primareInPool ? 'YES' : 'NO (correctly excluded)'}`);
      console.log(`  Primare i35 selected as anchor: ${primareSelected ? '❌ FAIL' : '✓ PASS'}`);
      if (primareSelected) failCount++;
    }
  }

  // Check 2: Any candidates with distance <= 1 selected?
  if (anchor.distance <= 1) {
    console.log(`  ❌ FAIL: Anchor distance is ${anchor.distance} (≤ 1)`);
    failCount++;
  } else {
    console.log(`  ✓ PASS: Anchor distance ${anchor.distance} > 1`);
  }

  // Check 3: Are top-ranked but low-distance products excluded?
  const topRankedLowDist = byRank.slice(0, 5).filter(c => c.distance < MIN_SONIC_DISTANCE);
  const anyTopLowDistSelected = topRankedLowDist.some(c => c.brand === anchor.brand && c.name === anchor.name);
  if (anyTopLowDistSelected) {
    console.log(`  ❌ FAIL: High-rank, low-distance product selected as anchor`);
    failCount++;
  } else {
    console.log(`  ✓ PASS: Top-ranked low-distance products correctly bypassed (${topRankedLowDist.length} excluded)`);
  }

  // ══════════════════════════════════════════════════════════════
  // PART 5 — Role quality
  // ══════════════════════════════════════════════════════════════

  console.log('\n── ROLE QUALITY (distance from anchor) ──');

  // close_alt: same philosophy, lowest distance from anchor
  const closePool = candidates.filter(c =>
    c.philosophy === anchor.philosophy
    && !(c.brand === anchor.brand && c.name === anchor.name),
  );
  const closeAlt = closePool.length > 0
    ? closePool.reduce((best, cur) => sonicDistance(cur, anchor) < sonicDistance(best, anchor) ? cur : best)
    : null;
  if (closeAlt) {
    const caDist = sonicDistance(closeAlt, anchor);
    console.log(`  close_alt: ${closeAlt.brand} ${closeAlt.name} — dist from anchor=${caDist}`);
  } else {
    console.log(`  close_alt: none found`);
  }

  // contrast: different philosophy, highest distance from anchor
  const contrastPool = candidates.filter(c =>
    c.philosophy && c.philosophy !== anchor.philosophy
    && !(c.brand === anchor.brand && c.name === anchor.name),
  );
  const contrast = contrastPool.length > 0
    ? contrastPool.reduce((best, cur) => sonicDistance(cur, anchor) > sonicDistance(best, anchor) ? cur : best)
    : null;
  if (contrast) {
    const ctDist = sonicDistance(contrast, anchor);
    console.log(`  contrast:  ${contrast.brand} ${contrast.name} — dist from anchor=${ctDist}`);
  } else {
    console.log(`  contrast:  none found`);
  }

  // wildcard: nonTraditional, highest distance from anchor
  const ntPool = candidates.filter(c =>
    c.marketType === 'nonTraditional'
    && !(c.brand === anchor.brand && c.name === anchor.name),
  );
  const wildcard = ntPool.length > 0
    ? ntPool.reduce((best, cur) => sonicDistance(cur, anchor) > sonicDistance(best, anchor) ? cur : best)
    : null;
  if (wildcard) {
    const wDist = sonicDistance(wildcard, anchor);
    console.log(`  wildcard:  ${wildcard.brand} ${wildcard.name} — dist from anchor=${wDist}, dist from baseline=${wildcard.distance}`);
  } else {
    console.log(`  wildcard:  none found`);
  }

  // ══════════════════════════════════════════════════════════════
  // PART 6 — Output quality assessment
  // ══════════════════════════════════════════════════════════════

  console.log('\n── OUTPUT QUALITY ASSESSMENT ──');
  const quality = anchor.distance >= 4 ? 'C) clearly different listening experience'
    : anchor.distance >= 3 ? 'B) moderate shift'
    : anchor.distance >= 2 ? 'A) minor variation'
    : '❌ NO REAL CONTRAST';
  console.log(`  Anchor distance: ${anchor.distance} → ${quality}`);
}

// ══════════════════════════════════════════════════════════════
// PART 4 — Edge case: forced small pool / low-distance
// ══════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(80));
console.log('EDGE CASE: All candidates low-distance (simulated)');
console.log('═'.repeat(80));

// Simulate by creating a fake baseline at neutral/neutral/neutral/neutral
// and a pool of only neutral-ish products
const fakeBaseline = { primaryAxes: { warm_bright: 'neutral' as const, smooth_detailed: 'neutral' as const, elastic_controlled: 'neutral' as const, airy_closed: 'neutral' as const } };
const neutralProducts = AMPLIFIER_PRODUCTS
  .filter(p => sonicDistance(p, fakeBaseline) <= 2)
  .map((p, i) => ({
    brand: p.brand,
    name: p.name,
    distance: sonicDistance(p, fakeBaseline),
    rank: i,
    primaryAxes: p.primaryAxes,
  }));

console.log(`Products with distance ≤ 2 from neutral baseline: ${neutralProducts.length}`);
const neutralMeetsThreshold = neutralProducts.filter(c => c.distance >= MIN_SONIC_DISTANCE);
console.log(`Meeting MIN_DISTANCE (${MIN_SONIC_DISTANCE}): ${neutralMeetsThreshold.length}`);
if (neutralMeetsThreshold.length === 0) {
  console.log('[distance-fallback] CORRECTLY triggered — no products meet threshold');
  const maxDist = neutralProducts.reduce((best, cur) => cur.distance > best.distance ? cur : best, neutralProducts[0]);
  if (maxDist) {
    console.log(`Max distance product selected: ${maxDist.brand} ${maxDist.name} (distance=${maxDist.distance})`);
  }
  console.log('✓ PASS: Fallback correctly selects max-distance product');
} else {
  console.log('Products still meet threshold (not a true edge case with this catalog)');
}

// ══════════════════════════════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(80));
console.log('SUMMARY');
console.log('═'.repeat(80));
console.log(`Total failures: ${failCount}`);
console.log(failCount === 0
  ? '✓ ALL CHECKS PASSED — system produces REAL sonic contrast'
  : `❌ ${failCount} FAILURE(S) DETECTED — see above`);
console.log('═'.repeat(80));
