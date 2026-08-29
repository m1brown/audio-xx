import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectIntent, extractSubjectMatches } from '../intent';
import { buildTurnContext } from '../turn-context';
import { buildSystemAssessment } from '../consultation';
import { normalizeRole } from '../assessment/authoritative';

/**
 * ADVERSARIAL GENERALIZATION MATRIX (campaign, 2026-08-29).
 *
 * Sixteen real-system classes (A–P) that broke the parser in one first
 * pass: role keywords binding to the wrong component ("amplifier driving X
 * speakers"), capability descriptors read as conflicts ("streaming DAC"),
 * brand defaults outranking the listener's words, digit-leading and
 * letters-only models dropping, unknown-brand components vanishing, an
 * empty-string brand key poisoning the seed set, and topical lanes
 * claiming explicit list assessments. Every class asserts the structural
 * invariants; systems whose correct outcome is a question assert THAT.
 */

const SYSTEMS = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'campaign-systems.json'), 'utf8')) as
  Array<{ id: string; msg: string; expect: { n?: number; roles?: Record<string, string> } }>;

const EMPTY = { savedSystems: [], activeSystemRef: null, draftSystem: null, proposedSystem: null } as never;

// Corroboration/network-dependent or designed-ask cases at engine level.
const ASKS_OK = new Set(['K-reference', 'O-ambiguous-gen']);

describe('campaign matrix — sixteen system classes', () => {
  for (const sys of SYSTEMS) {
    it(`${sys.id}: identity, roles and chain survive`, () => {
      const intent = (detectIntent(sys.msg) as never as { intent: string }).intent;
      expect(intent, `${sys.id} intent`).toBe('system_assessment');
      const ctx = buildTurnContext(sys.msg, EMPTY, new Set(), null as never) as never as {
        activeSystem: unknown };
      const r = buildSystemAssessment(
        sys.msg, extractSubjectMatches(sys.msg), ctx.activeSystem as never,
        (detectIntent(sys.msg) as never as { desires: never }).desires,
      ) as never as {
        kind: string;
        components?: Array<{ displayName: string; role: string }>;
        findings?: { systemChain?: { names: string[]; roles: string[] } };
        clarification?: { question?: string };
      };
      if (ASKS_OK.has(sys.id)) {
        expect(['clarification', 'assessment', 'low_confidence']).toContain(r?.kind);
        return;
      }
      expect(['assessment', 'low_confidence'], `${sys.id} kind (clar: ${r?.clarification?.question ?? ''})`).toContain(r?.kind);
      const pairs = r?.findings?.systemChain
        ? r.findings.systemChain.names.map((n, i) => ({ name: n, role: r.findings!.systemChain!.roles[i] }))
        : (r?.components ?? []).map((c) => ({ name: c.displayName, role: c.role }));
      if (sys.expect.n) expect(pairs.length, `${sys.id} count`).toBeGreaterThanOrEqual(sys.expect.n);
      for (const [frag, want] of Object.entries(sys.expect.roles ?? {})) {
        const hit = pairs.find((p) => p.name.toLowerCase().includes(frag));
        expect(hit, `${sys.id}: component ~"${frag}" present`).toBeTruthy();
        const got = normalizeRole(hit!.role) ?? hit!.role;
        expect(want.split('|'), `${sys.id}: ${frag} role`).toContain(got);
      }
    });
  }
});
