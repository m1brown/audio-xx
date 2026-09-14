/**
 * QA harness — compact failure reporting.
 *
 * Failures render one small block per finding — case, mutation, layer,
 * invariant, expected, actual, owning stage — never whole assessments.
 */
import type { Failure } from './schema';

export function formatFailure(f: Failure): string {
  return [
    `CASE ${f.caseId}`,
    `MUTATION ${f.mutation}`,
    `LAYER ${f.layer}`,
    `INVARIANT ${f.invariant}`,
    `EXPECTED ${f.expected}`,
    `ACTUAL ${f.actual}`,
    'STATUS FAIL',
    `OWNING STAGE ${f.owningStage}`,
  ].join('\n');
}

export function formatFailures(fails: Failure[]): string {
  return fails.map(formatFailure).join('\n\n');
}

export interface RunSummary {
  cases: number;
  mutations: number;
  checks: number;
  failuresByLayer: Record<string, number>;
}

export function summarize(
  cases: number, mutations: number, checks: number, fails: Failure[],
): RunSummary {
  const failuresByLayer: Record<string, number> = {};
  for (const f of fails) {
    failuresByLayer[f.layer] = (failuresByLayer[f.layer] ?? 0) + 1;
  }
  return { cases, mutations, checks, failuresByLayer };
}
