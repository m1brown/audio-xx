import { describe, it, expect } from 'vitest';
import { buildContextRefinement, buildConsultationResponse } from '../consultation';
import { detectIntent } from '../intent';

describe('print-scenario-outputs', () => {
  it('Scenario: chord vs denafrips (initial comparison)', () => {
    const response = buildConsultationResponse('chord vs denafrips', detectIntent('chord vs denafrips').subjectMatches);
    console.log('\n=== CHORD vs DENAFRIPS ===\n');
    console.log(response?.comparisonSummary);
    console.log('\n=== END ===\n');
    expect(response?.comparisonSummary).toBeDefined();
  });

  it('Scenario: job vs hegel (initial comparison)', () => {
    const response = buildConsultationResponse('job vs hegel', detectIntent('job vs hegel').subjectMatches);
    console.log('\n=== JOB vs HEGEL ===\n');
    console.log(response?.comparisonSummary);
    console.log('\n=== END ===\n');
    expect(response?.comparisonSummary).toBeDefined();
  });

  it('Scenario: job vs leben → devore o/96 (system-anchored)', () => {
    const comparison = {
      left: { name: 'Job', kind: 'brand' as const },
      right: { name: 'Leben', kind: 'brand' as const },
      scope: 'brand' as const,
    };
    const response = buildContextRefinement(comparison, 'devore o/96', 'speaker');
    console.log('\n=== JOB vs LEBEN → DEVORE O/96 ===\n');
    console.log(response.comparisonSummary);
    console.log('\n=== END ===\n');
    expect(response.comparisonSummary).toBeDefined();
  });
});
