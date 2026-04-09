/**
 * Standalone runtime validation script for inferActiveDAC().
 * Run with: npx tsx apps/web/src/lib/__tests__/run-dac-validation.ts
 *
 * Tests both inference logic and narrative output for all 7 scenarios.
 */

import { inferActiveDAC } from '../consultation';
import type { SystemComponent } from '../consultation';
import type { ActiveDACInference } from '../memo-findings';

// ── Helpers ────────────────────────────────────────────

function makeComponent(
  displayName: string,
  role: string,
  roles: string[],
): SystemComponent {
  return { displayName, role, roles, character: `${displayName} character` };
}

function buildDACNarrative(
  dac: ActiveDACInference,
  roleOverlaps: { role: string; components: string[] }[],
): string {
  if (dac.multipleDACs && dac.activeDACName && !dac.needsDACClarification) {
    const dacOverlap = roleOverlaps.find((o) => o.role === 'dac');
    const others = dacOverlap?.components.filter((n) => n !== dac.activeDACName) ?? [];

    if (dac.confidence === 'high') {
      return `Your system uses the ${dac.activeDACName} as its DAC.`;
    } else if (dac.confidence === 'medium') {
      if (dac.activeDACType === 'standalone' && others.length > 0) {
        return `Your system likely uses the ${dac.activeDACName} as the primary DAC. If it is handling digital conversion, the DAC stage in the ${others.join(' and ')} would typically not be used.`;
      } else if (dac.activeDACType === 'integrated' && others.length > 0) {
        return `Your system likely uses the DAC in your integrated amplifier (${dac.activeDACName}). If so, the ${others.join(' and ')} feeds it as a transport.`;
      } else {
        return `Your system likely uses the ${dac.activeDACName} as its primary DAC.`;
      }
    } else {
      return `Your system includes multiple DAC-capable components. The ${dac.activeDACName} is the most likely active DAC, but the actual conversion path depends on how they are connected.`;
    }
  } else if (dac.needsDACClarification) {
    return `Your system includes multiple DAC-capable components, and the active conversion path is unclear. Which DAC is handling conversion affects the sound — worth confirming your signal routing.`;
  }
  return '';
}

function buildRoleOverlaps(components: SystemComponent[]): { role: string; components: string[] }[] {
  const roleCounts = new Map<string, string[]>();
  for (const c of components) {
    for (const r of (c.roles ?? [])) {
      const norm = r.toLowerCase();
      if (!roleCounts.has(norm)) roleCounts.set(norm, []);
      roleCounts.get(norm)!.push(c.displayName);
    }
  }
  const overlaps: { role: string; components: string[] }[] = [];
  for (const [role, names] of roleCounts) {
    if (names.length >= 2) overlaps.push({ role, components: names });
  }
  return overlaps;
}

// ── Test runner ────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${label}${detail ? ' — ' + detail : ''}`);
  }
}

function runCase(
  label: string,
  components: SystemComponent[],
  checks: (result: ActiveDACInference, narrative: string) => void,
): void {
  console.log(`\n── ${label} ──`);
  const result = inferActiveDAC(components);
  const overlaps = buildRoleOverlaps(components);
  const narrative = buildDACNarrative(result, overlaps);

  console.log(`  Inference: activeDACName=${result.activeDACName ?? 'null'}, type=${result.activeDACType ?? 'null'}, confidence=${result.confidence}, multipleDACs=${result.multipleDACs}, needsClarification=${result.needsDACClarification}`);
  console.log(`  Narrative: "${narrative || '(empty)'}"`);

  checks(result, narrative);
}

// ── Cases ──────────────────────────────────────────────

runCase('Case 1 — Source-only DAC (Bluesound Node)', [
  makeComponent('Bluesound Node', 'streamer', ['streamer', 'dac']),
  makeComponent('NAD C 316BEE', 'amplifier', ['amplifier']),
  makeComponent('ELAC Debut B6.2', 'speaker', ['speaker']),
], (r, n) => {
  assert(r.activeDACName === 'Bluesound Node', 'activeDACName = Bluesound Node');
  assert(r.activeDACType === 'source', 'activeDACType = source');
  assert(r.confidence === 'high', 'confidence = high', `got ${r.confidence}`);
  assert(r.needsDACClarification === false, 'needsDACClarification = false');
  assert(r.multipleDACs === false, 'multipleDACs = false');
  assert(n === '', 'narrative is empty (single DAC, no note needed)');
});

runCase('Case 2 — Source + integrated amp DAC', [
  makeComponent('Bluesound Node', 'streamer', ['streamer', 'dac']),
  makeComponent('Hegel H190', 'amplifier', ['integrated', 'amp', 'dac']),
  makeComponent('Focal Aria 906', 'speaker', ['speaker']),
], (r, n) => {
  assert(r.activeDACName === 'Hegel H190', 'activeDACName = Hegel H190', `got ${r.activeDACName}`);
  assert(r.activeDACType === 'integrated', 'activeDACType = integrated', `got ${r.activeDACType}`);
  assert(r.confidence === 'medium', 'confidence = medium', `got ${r.confidence}`);
  assert(r.needsDACClarification === false, 'needsDACClarification = false');
  assert(n.includes('likely'), 'narrative contains "likely"');
  assert(n.includes('Hegel H190'), 'narrative mentions Hegel H190');
  assert(!n.includes('is the active DAC'), 'no definitive "is the active DAC"');
  assert(!n.includes('is bypassed'), 'no "is bypassed"');
});

runCase('Case 3 — Source + standalone DAC', [
  makeComponent('Bluesound Node', 'streamer', ['streamer', 'dac']),
  makeComponent('Chord Qutest', 'dac', ['dac']),
  makeComponent('Pass Labs INT-25', 'amplifier', ['amplifier']),
  makeComponent('Harbeth P3ESR', 'speaker', ['speaker']),
], (r, n) => {
  assert(r.activeDACName === 'Chord Qutest', 'activeDACName = Chord Qutest');
  assert(r.activeDACType === 'standalone', 'activeDACType = standalone');
  assert(r.confidence === 'medium', 'confidence = medium', `got ${r.confidence}`);
  assert(n.includes('likely'), 'narrative contains "likely"');
  assert(n.includes('If '), 'narrative uses conditional "If"');
  assert(!n.includes('is bypassed'), 'no "is bypassed"');
  assert(n.includes('Chord Qutest'), 'narrative mentions Chord Qutest');
});

runCase('Case 4 — Full chain (source + standalone + integrated)', [
  makeComponent('Bluesound Node', 'streamer', ['streamer', 'dac']),
  makeComponent('Chord Qutest', 'dac', ['dac']),
  makeComponent('Hegel H190', 'amplifier', ['integrated', 'amp', 'dac']),
  makeComponent('Harbeth P3ESR', 'speaker', ['speaker']),
], (r, n) => {
  assert(r.activeDACName === 'Chord Qutest', 'activeDACName = Chord Qutest', `got ${r.activeDACName}`);
  assert(r.activeDACType === 'standalone', 'activeDACType = standalone');
  assert(r.confidence === 'medium', 'confidence = medium', `got ${r.confidence}`);
  assert(!n.includes('is bypassed'), 'no "is bypassed"');
  assert(!n.includes('is the active DAC'), 'no "is the active DAC"');
  assert(n.includes('likely') || n.includes('If '), 'has hedging language');
});

runCase('Case 5 — Two standalone DACs (ambiguity)', [
  makeComponent('Chord Qutest', 'dac', ['dac']),
  makeComponent('Denafrips Ares II', 'dac', ['dac']),
  makeComponent('Pass Labs INT-25', 'amplifier', ['amplifier']),
  makeComponent('Harbeth P3ESR', 'speaker', ['speaker']),
], (r, n) => {
  assert(r.activeDACName === null, 'activeDACName = null');
  assert(r.confidence === 'low', 'confidence = low');
  assert(r.needsDACClarification === true, 'needsDACClarification = true');
  assert(r.multipleDACs === true, 'multipleDACs = true');
  assert(n.includes('unclear'), 'narrative contains "unclear"');
  assert(!n.includes('is the active DAC'), 'no "is the active DAC"');
});

runCase('Case 6 — Malformed data (missing roles[])', [
  { displayName: 'Some DAC', role: 'dac', roles: undefined as unknown as string[], character: 'test' } as SystemComponent,
  makeComponent('Bluesound Node', 'streamer', ['streamer', 'dac']),
], (r, n) => {
  assert(r.confidence === 'low', 'confidence = low', `got ${r.confidence}`);
  assert(r.needsDACClarification === true, 'needsDACClarification = true');
  assert(r.multipleDACs === true, 'multipleDACs = true');
  // With needsDACClarification=true, narrative should show ambiguity
  assert(n.includes('unclear') || n.includes('depends on'), 'narrative reflects uncertainty');
  assert(!n.includes('is the active DAC'), 'no "is the active DAC"');
});

runCase('Case 7 — No DAC in system', [
  makeComponent('Rega Planar 3', 'turntable', ['turntable']),
  makeComponent('Rega Brio', 'amplifier', ['amplifier']),
  makeComponent('Wharfedale Linton', 'speaker', ['speaker']),
], (r, n) => {
  assert(r.activeDACName === null, 'activeDACName = null');
  assert(r.activeDACType === null, 'activeDACType = null');
  assert(r.confidence === 'low', 'confidence = low', `got ${r.confidence}`);
  assert(r.needsDACClarification === false, 'needsDACClarification = false');
  assert(r.multipleDACs === false, 'multipleDACs = false');
  assert(n === '', 'narrative is empty (no DAC behavior invented)');
});

// ── Summary ────────────────────────────────────────────

console.log(`\n${'═'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
if (failed > 0) {
  console.log('⚠ FAILURES DETECTED — see above');
  process.exit(1);
} else {
  console.log('✓ All assertions passed');
}
