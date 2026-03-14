/**
 * Test system validation: Eversolo DMP-A6 → Chord Hugo → JOB Integrated → WLM Diva Monitor
 */
// @ts-nocheck
import { detectIntent } from '../intent';
import { buildSystemAssessment } from '../consultation';
import { _test } from '../consultation';

const input = 'My system is Eversolo DMP-A6 → Chord Hugo → JOB Integrated → WLM Diva. How does it look?';
const { subjectMatches, desires } = detectIntent(input);
const result = buildSystemAssessment(input, subjectMatches, null, desires);

if (!result || result.kind === 'clarification') {
  console.log('No assessment result:', result);
  process.exit(1);
}

const memo = (result as any).findings;
console.log('=== SYSTEM AXES ===');
console.log(JSON.stringify(memo?.systemAxes, null, 2));
console.log('\n=== STACKED TRAITS ===');
console.log(JSON.stringify(memo?.stackedTraits, null, 2));
console.log('\n=== ALL FINDINGS KEYS ===');
console.log(Object.keys(memo));
console.log('\n=== BOTTLENECK ===');
console.log(JSON.stringify(memo?.primaryConstraint ?? memo?.bottleneck, null, 2));
console.log('\n=== UPGRADE PATHS ===');
const paths = memo?.upgradePaths ?? memo?.upgradeSteps;
if (paths) {
  for (const p of paths) {
    console.log(JSON.stringify(p));
  }
}
console.log('\n=== PER-COMPONENT AXES ===');
if (memo?.perComponentAxes) {
  for (const p of memo.perComponentAxes) {
    console.log(`${p.name}: ${JSON.stringify(p.axes)} (${p.source})`);
  }
}
console.log('\n=== COMPONENT VERDICTS ===');
if (memo?.componentVerdicts) {
  for (const v of memo.componentVerdicts) {
    console.log(`${v.name} [${v.role}]: ${v.verdict} — ${v.strengths?.join(', ')} | weaknesses: ${v.weaknesses?.join(', ')}`);
  }
}
