/**
 * QA harness — observation layer.
 *
 * Runs the REAL production entry points and returns structured observations.
 * No parallel parser, evidence engine, or reasoning engine lives here: every
 * observation is produced by the same functions the product runs.
 */
import { extractSubjectMatches } from '@/lib/intent';
import { detectSystemDescription } from '@/lib/system-extraction';
import { buildTurnContext } from '@/lib/turn-context';
import { buildSystemAssessment } from '@/lib/consultation';
import { composeSystemReviewDetailed } from '@/lib/artifact/system-review';
import { synthesiseChain } from '@/lib/artifact/sonic-synthesis';
import type { DossierView } from '@/lib/evidence/dossier-presentation';
import type { AudioSessionState } from '@/lib/system-types';
import type { EvidenceLine, GoldenCase, Observation } from './schema';

export const GUEST = {
  activeSystemRef: { kind: 'none' },
  savedSystems: [],
  draftSystem: null,
  loading: false,
  proposedSystem: null,
} as unknown as AudioSessionState;

/** Identity observation: what the canonical message parse names. */
export function observeIdentity(input: string, state: AudioSessionState = GUEST): {
  identities: string[]; categories: string[];
} {
  const p = detectSystemDescription(input, extractSubjectMatches(input), state);
  const comps = (p?.components ?? []).map((c) => ({
    id: `${c.brand} ${c.name}`.trim().toLowerCase(),
    cat: (c.category ?? '') as string,
  }));
  comps.sort((a, b) => a.id.localeCompare(b.id));
  return { identities: comps.map((c) => c.id), categories: comps.map((c) => c.cat) };
}

/** End-to-end observation through the live turn path. */
export function observeE2E(input: string, state: AudioSessionState = GUEST): {
  kind: string; chainNames: string[];
} {
  const tc = buildTurnContext(input, state, new Set(), undefined);
  const r = buildSystemAssessment(input, tc.subjectMatches, tc.activeSystem, []) as {
    kind?: string;
    response?: { systemChain?: { names?: string[] } };
  };
  return {
    kind: r?.kind ?? 'null',
    chainNames: (r?.response?.systemChain?.names ?? []).map((n) => n.toLowerCase()),
  };
}

function dossier(displayName: string, role: string, lines: EvidenceLine[]): DossierView {
  return {
    displayName,
    role,
    secondary: [],
    gaps: [],
    primary: lines
      .filter((l) => l.component === displayName)
      .map((l) => ({ label: l.label, value: l.value, provenance: 'maker_published', source: 'maker' })),
  } as unknown as DossierView;
}

/** Compose-stage observation: the deterministic review over declared evidence. */
export function observeCompose(c: GoldenCase): string {
  // The component set is the union of declared roles and evidence bearers —
  // a component with no evidence (the DP-450 shape) still exists.
  const names = [...new Set([
    ...Object.keys(c.composeRoles ?? {}),
    ...(c.evidence ?? []).map((l) => l.component),
  ])];
  const roleOf = (n: string) => c.composeRoles?.[n] ?? '';
  const comps = names.map((n) => ({ displayName: n, role: roleOf(n) }));
  const det = composeSystemReviewDetailed({
    components: comps,
    dossiers: names.map((n) => dossier(n, roleOf(n), c.evidence ?? [])),
    synthesis: synthesiseChain(comps),
    rawQuery: c.input,
  });
  return det.paragraphs.join('\n');
}

/** Full observation of one input for one case. */
export function observeCase(
  c: GoldenCase,
  mutation = 'base',
  input = c.input,
  opts: { e2e?: boolean; compose?: boolean } = {},
): Observation {
  const { identities, categories } = observeIdentity(input);
  const o: Observation = { caseId: c.id, mutation, input, identities, categories };
  if (opts.e2e) {
    const e = observeE2E(input);
    o.kind = e.kind;
    o.chainNames = e.chainNames;
  }
  if (opts.compose && c.evidence) {
    o.composedText = observeCompose(c);
    o.evidence = c.evidence;
  }
  return o;
}
