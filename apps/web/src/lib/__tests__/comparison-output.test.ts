/**
 * Quick output inspection — prints actual comparison responses.
 */

import { detectIntent } from '../intent';
import { buildConsultationResponse } from '../consultation';

function showComparison(query: string) {
  const { intent, subjectMatches } = detectIntent(query, [], undefined);
  const brands = subjectMatches.filter((m) => m.kind === 'brand').map((m) => m.name);
  console.log(`\n───── ${query} ─────`);
  console.log(`Intent: ${intent} | Brands: ${brands.join(', ')}`);
  if (intent === 'comparison' && brands.length >= 2) {
    const r = buildConsultationResponse(query, subjectMatches);
    if (r) {
      console.log(`\n${r.comparisonSummary}\n`);
      console.log(`Follow-up: ${r.followUp}`);
      console.log(`Length: ${r.comparisonSummary?.length ?? 0} chars`);
      console.log(`Has philosophy: ${!!r.philosophy}`);
      console.log(`Has tendencies: ${!!r.tendencies}`);
      console.log(`Has systemContext: ${!!r.systemContext}`);
    }
  }
}

test('output inspection', () => {
  showComparison('KEF vs ELAC');
  showComparison('Chord vs Denafrips');
  showComparison('Wharfedale vs KEF');
  showComparison('Harbeth or Magnepan for vocals?');
  expect(true).toBe(true);
});
