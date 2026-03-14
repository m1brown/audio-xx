/**
 * Routing & entity resolution verification — commit 88758ea
 *
 * Traces the full execution path for each test query:
 *   1. detectIntent() → intent, subjectMatches, desires
 *   2. findProducts() via buildGearResponse path
 *   3. routing decision
 *   4. activeSystem propagation
 *   5. output structure
 */

import { detectIntent, isBrandOnlyComparison } from '../intent';
import type { ActiveSystemContext } from '../system-types';

// ── Inline product lookup (mirrors gear-response.ts findProducts) ────
import { DAC_PRODUCTS } from '../products/dacs';
import { SPEAKER_PRODUCTS } from '../products/speakers';

const ALL_PRODUCTS = [...DAC_PRODUCTS, ...SPEAKER_PRODUCTS];

function findProducts(subjects: string[]) {
  if (subjects.length === 0) return [];
  const found: typeof ALL_PRODUCTS = [];

  for (const subject of subjects) {
    const lower = subject.toLowerCase();
    let bestMatch: (typeof ALL_PRODUCTS)[number] | null = null;
    let bestScore = 0;

    for (const product of ALL_PRODUCTS) {
      const brandLower = product.brand.toLowerCase();
      const nameLower = product.name.toLowerCase();
      const fullLower = `${brandLower} ${nameLower}`;

      let score = 0;
      if (nameLower === lower || fullLower === lower) {
        score = 4;
      } else if (lower.includes(nameLower) && lower.includes(brandLower)) {
        score = 3;
      } else if (lower.includes(nameLower)) {
        score = 2;
      } else if (nameLower.includes(lower)) {
        score = 1;
      } else if (lower.includes(brandLower) || brandLower === lower) {
        score = 0;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = product;
      }
    }

    if (bestMatch && !found.some((p) => p.id === bestMatch!.id)) {
      found.push(bestMatch);
    }
  }
  return found;
}

// ── Mock active system (user has a Hugo + some amplifier + speakers) ──
const MOCK_ACTIVE_SYSTEM: ActiveSystemContext = {
  systemId: 'test-system',
  systemName: 'Test System',
  components: [
    { brand: 'Chord', name: 'Hugo', category: 'dac' },
    { brand: 'Naim', name: 'Nait 5i', category: 'amplifier' },
    { brand: 'Harbeth', name: 'P3ESR', category: 'speaker' },
  ],
};

// ── Test runner ──────────────────────────────────────

interface TestCase {
  query: string;
  expectIntent: string;
  expectProductIds: string[];
  expectRouting: 'comparison' | 'gear_inquiry' | 'shopping' | string;
}

const TEST_CASES: TestCase[] = [
  {
    query: 'What would an upgrade from a Chord Hugo to a Chord Hugo TT2 change in my system?',
    expectIntent: 'comparison',
    expectProductIds: ['chord-hugo-tt2', 'chord-hugo'],
    expectRouting: 'comparison',
  },
  {
    query: 'Chord Hugo vs Chord Qutest',
    expectIntent: 'comparison',
    expectProductIds: ['chord-hugo', 'chord-qutest'],
    expectRouting: 'comparison',
  },
  {
    query: 'Replace my Hugo with a TT2',
    expectIntent: 'comparison',
    expectProductIds: ['chord-hugo', 'chord-hugo-tt2'],
    expectRouting: 'comparison',
  },
  {
    query: 'What would a TT2 change in my system?',
    expectIntent: 'comparison',  // "what would...change" matches upgrade pattern
    expectProductIds: ['chord-hugo-tt2'],
    expectRouting: 'comparison',
  },
];

// ── Edge cases ───────────────────────────────────────
const EDGE_CASES: { query: string; note: string }[] = [
  { query: 'TT2 vs Hugo', note: 'Reversed order — should still resolve both products' },
  { query: 'Hugo TT2', note: 'Bare compound name — entity resolution only, no comparison' },
  { query: 'Chord Hugo TT2 vs Denafrips Pontus', note: 'Cross-brand comparison with compound name' },
  { query: 'I want more warmth from my Hugo', note: 'Desire + product — should NOT be comparison' },
  { query: 'Hugo 2 vs Hugo TT2', note: 'Two compound Chord names' },
];

console.log('═══════════════════════════════════════════════════');
console.log('  ROUTING & ENTITY RESOLUTION VERIFICATION');
console.log('  Commit: 88758ea');
console.log('═══════════════════════════════════════════════════\n');

let passCount = 0;
let failCount = 0;

for (const tc of TEST_CASES) {
  console.log(`── Query: "${tc.query}"`);
  console.log('─'.repeat(60));

  // Step 1: detectIntent
  const result = detectIntent(tc.query);
  console.log(`  1. Intent:          ${result.intent}`);
  console.log(`  2. SubjectMatches:  ${JSON.stringify(result.subjectMatches.map(m => `${m.name} (${m.kind})`))}`);

  // Step 2: findProducts (using extracted subjects)
  const products = findProducts(result.subjects);
  console.log(`  3. Products:        ${products.map(p => `${p.brand} ${p.name} [${p.id}]`).join(', ') || '(none)'}`);

  // Step 3: routing decision
  const isComparison = result.intent === 'comparison';
  const isGear = result.intent === 'gear_inquiry';
  const routedTo = isComparison ? 'comparison' : isGear ? 'gear_inquiry' : result.intent;
  console.log(`  4. Routing:         ${routedTo}`);

  // Step 4: activeSystem passed?
  const activeSystemPassed = isComparison || isGear; // page.tsx passes it for both
  console.log(`  5. activeSystem:    ${activeSystemPassed ? 'YES (passed to buildGearResponse)' : 'NO (different path)'}`);

  // Step 5: output structure
  if (isComparison && products.length >= 2) {
    console.log(`  6. Output:          Comparison of ${products[0].brand} ${products[0].name} vs ${products[1].brand} ${products[1].name}`);
    if (products[0].brand === products[1].brand) {
      console.log(`                      → Same-brand lineage detected (${products[0].architecture})`);
    }
  } else if (isComparison && products.length === 1) {
    console.log(`  6. Output:          Half-known comparison (${products[0].brand} ${products[0].name} + unknown)`);
  } else if (isGear && products.length > 0) {
    console.log(`  6. Output:          Gear inquiry for ${products[0].brand} ${products[0].name}`);
  } else {
    console.log(`  6. Output:          Fallthrough to ${routedTo} handler`);
  }

  // Verify
  const intentPass = result.intent === tc.expectIntent;
  const productIds = products.map(p => p.id);
  const productsPass = tc.expectProductIds.every(id => productIds.includes(id));
  const routingPass = routedTo === tc.expectRouting;

  const allPass = intentPass && productsPass && routingPass;
  if (allPass) {
    passCount++;
    console.log(`  ✓ PASS\n`);
  } else {
    failCount++;
    if (!intentPass) console.log(`  ✗ FAIL: Expected intent '${tc.expectIntent}', got '${result.intent}'`);
    if (!productsPass) console.log(`  ✗ FAIL: Expected products ${JSON.stringify(tc.expectProductIds)}, got ${JSON.stringify(productIds)}`);
    if (!routingPass) console.log(`  ✗ FAIL: Expected routing '${tc.expectRouting}', got '${routedTo}'`);
    console.log();
  }
}

// ── Edge cases (trace only, no pass/fail) ──────────
console.log('\n═══════════════════════════════════════════════════');
console.log('  EDGE CASE EXPLORATION');
console.log('═══════════════════════════════════════════════════\n');

for (const ec of EDGE_CASES) {
  console.log(`── "${ec.query}" (${ec.note})`);
  const result = detectIntent(ec.query);
  const products = findProducts(result.subjects);
  console.log(`   Intent:    ${result.intent}`);
  console.log(`   Subjects:  ${JSON.stringify(result.subjectMatches.map(m => `${m.name} (${m.kind})`))}`);
  console.log(`   Products:  ${products.map(p => `${p.id}`).join(', ') || '(none)'}`);

  // Flag issues
  const issues: string[] = [];
  if (ec.query.toLowerCase().includes('hugo tt2') && !result.subjectMatches.some(m => m.name === 'hugo tt2')) {
    issues.push('ISSUE: "hugo tt2" not resolved as compound name');
  }
  if (result.subjectMatches.some(m => m.name === 'tt2') && result.subjectMatches.some(m => m.name === 'hugo tt2')) {
    issues.push('ISSUE: both "tt2" and "hugo tt2" matched — span claiming failed');
  }
  if (issues.length > 0) {
    console.log(`   ⚠ ${issues.join('; ')}`);
  } else {
    console.log(`   ✓ OK`);
  }
  console.log();
}

// ── Summary ──────────────────────────────────────────
console.log('═══════════════════════════════════════════════════');
console.log(`  RESULT: ${passCount} passed, ${failCount} failed out of ${TEST_CASES.length} test cases`);
console.log('═══════════════════════════════════════════════════');

process.exit(failCount > 0 ? 1 : 0);
