/**
 * Migration 1 P1 — founder lane authority regression (2026-09-16).
 *
 * The live failure: after a four-component assessment (Eversolo DMP-A6,
 * Chord Hugo, JOB INTegrated, WLM Diva Monitor) the founder's
 * post-assessment DAC conversation was consumed by legacy semantic
 * routing — detectExplicitCategoryPivot reset the assessment state on
 * "which dac of the three should be the best…", the turn fell into the
 * legacy shopping tower (catalog DAC picks, budget-solicitation loop),
 * and a role-slotted hypothetical-chain projection displayed the system
 * as three components. The B2 lane, nested inside the state machine's
 * ready_to_assess branch, never received a single turn.
 *
 * These pins hold the repair: the authority decision (the same pure
 * function page.tsx calls), the request roster integrity, and the
 * SOURCE ORDER of the real handleSubmit path — the lane attempt must
 * precede every legacy semantic intercept. Prose is never pinned;
 * authority, state and ordering are.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  laneFirstAuthority,
  statesNewSystem,
  restatesLaneRoster,
  buildLaneRequest,
  type LaneComponent,
} from '../lane-authority';
import { extractSubjectMatches } from '../../intent';
import { detectSystemDescription } from '../../system-extraction';

/** The roster the assessment armed the lane with — all four components. */
const ROSTER: LaneComponent[] = [
  { displayName: 'Eversolo DMP-A6', role: 'source' },
  { displayName: 'Chord Hugo', role: 'dac' },
  { displayName: 'JOB INTegrated', role: 'amplifier' },
  { displayName: 'WLM Diva Monitor', role: 'speaker' },
];

/** The founder's actual post-assessment turns, verbatim. */
const FOUNDER_TURNS = [
  "which dac of the three should be the best, for me that's provide the most intimacy and connection",
  'oh i meant of the three existing ones: Chord Hugo, Job Integrated, Eversolo DMP A6. I think i like Hugo the best and the Job next.',
  "let's stick with the dac for the moment, of the three (Chord Hugo, Job Integrated, Eversolo DMP A6)",
  'which do you suggest of the three?',
  'so not the internal dac in the job integrated?',
  'the job integrated includes an internal dac',
];

/** Message-level system parse — the same call page.tsx makes. */
function messageComponents(text: string) {
  const empty = {
    savedSystems: [], activeSystemRef: null, draftSystem: null, proposedSystem: null,
  } as never;
  return detectSystemDescription(text, extractSubjectMatches(text), empty)?.components ?? [];
}

describe('founder lane authority — the six live turns', () => {
  it.each(FOUNDER_TURNS.map((t, i) => [i + 1, t] as const))(
    'turn %d enters the lane first',
    (_i, turn) => {
      expect(laneFirstAuthority({
        laneActive: true,
        laneComponents: ROSTER,
        hasImages: false,
        messageSystemComponents: messageComponents(turn),
      })).toBe(true);
    },
  );

  it('a restatement of existing components is conversation, not a new system', () => {
    // Turn 2 names three of the four existing components. That is the
    // listener talking ABOUT the system — the lane keeps the turn and the
    // model resolves "the three existing ones" from history.
    const msg = messageComponents(FOUNDER_TURNS[1]);
    expect(statesNewSystem(msg, ROSTER)).toBe(false);
    if (msg.length > 0) expect(restatesLaneRoster(msg, ROSTER)).toBe(true);
  });

  it('a genuinely new system statement re-enters the assessment pipeline', () => {
    const msg = messageComponents('Assess my system: NAD C316BEE and KEF LS50 Meta.');
    expect(msg.length).toBeGreaterThanOrEqual(2);
    expect(statesNewSystem(msg, ROSTER)).toBe(true);
    expect(laneFirstAuthority({
      laneActive: true, laneComponents: ROSTER, hasImages: false,
      messageSystemComponents: msg,
    })).toBe(false);
  });

  it('never fires for ineligible users, attachment turns, or an unarmed lane', () => {
    const base = {
      laneActive: true, laneComponents: ROSTER, hasImages: false,
      messageSystemComponents: [] as never[],
    };
    expect(laneFirstAuthority({ ...base, laneActive: false })).toBe(false);
    expect(laneFirstAuthority({ ...base, hasImages: true })).toBe(false);
    expect(laneFirstAuthority({ ...base, laneComponents: [ROSTER[0]] })).toBe(false);
    expect(laneFirstAuthority(base)).toBe(true);
  });
});

describe('actual-system invariant — the full roster travels on every turn', () => {
  it('all four components, including Chord Hugo, reach the lane request', () => {
    // The live failure also projected the system as three components on
    // a shopping surface (the role-slotted hypothetical-chain override
    // keeps one component per role, silently dropping the second
    // source-role component). The lane request must never inherit a
    // reduced roster: it is built from laneStateRef verbatim.
    const observations: string[] = [];
    const history: Array<{ role: string; content: string }> = [];
    for (const turn of FOUNDER_TURNS) {
      const body = buildLaneRequest(
        { components: ROSTER, source: 'saved', hypothetical: null, observations },
        turn,
        history,
      ) as {
        activeSystem: { components: Array<{ displayName: string }> };
        question: string;
      };
      expect(body.activeSystem.components.map((c) => c.displayName)).toEqual([
        'Eversolo DMP-A6', 'Chord Hugo', 'JOB INTegrated', 'WLM Diva Monitor',
      ]);
      expect(body.question).toBe(turn);
      history.push({ role: 'user', content: turn });
      history.push({ role: 'assistant', content: '[lane answer]' });
    }
  });

  it('recentTurns is capped at 10 and observations travel verbatim', () => {
    const history = Array.from({ length: 14 }, (_, i) => ({ role: 'user', content: `t${i}` }));
    const body = buildLaneRequest(
      {
        components: ROSTER, source: 'stated', hypothetical: null,
        observations: ['I sit close, maybe five feet.'],
      },
      'q', history,
    ) as { recentTurns: unknown[]; userObservations: string[] };
    expect(body.recentTurns).toHaveLength(10);
    expect(body.userObservations).toEqual(['I sit close, maybe five feet.']);
  });
});

describe('production-path ordering — the real handleSubmit source', () => {
  const SRC = readFileSync(
    join(__dirname, '../../../app/page.tsx'), 'utf8',
  );

  const at = (marker: string): number => {
    const i = SRC.indexOf(marker);
    expect(i, `marker not found: ${marker}`).toBeGreaterThan(-1);
    return i;
  };

  it('the authority decision precedes every legacy semantic intercept', () => {
    const decision = at('Founder lane authority (Migration 1 P1 repair');
    const attempt = at('B2 lane attempt — FIRST AUTHORITY');
    const reunite = at('Consume pending clarification');
    const glossary = at('checkGlossaryQuestion(submittedText)');
    const beta = at('tryBetaInterceptRouting(submittedText');
    const pivot = at('detectExplicitCategoryPivot(submittedText)');
    const machine = at('convTransition(convStateRef.current');

    expect(decision).toBeLessThan(reunite);
    expect(attempt).toBeLessThan(glossary);
    expect(attempt).toBeLessThan(beta);
    expect(attempt).toBeLessThan(pivot);
    expect(attempt).toBeLessThan(machine);
  });

  it('a published lane answer returns before any legacy author runs', () => {
    const attempt = at('B2 lane attempt — FIRST AUTHORITY');
    const glossary = at('checkGlossaryQuestion(submittedText)');
    const block = SRC.slice(attempt, glossary);
    // Publication boundary + verbatim display + return, inside the block.
    expect(block).toContain("data?.status === 'CHECKED' || data?.status === 'REPAIRED'");
    expect(block).toContain("dispatch({ type: 'ADD_NOTE', content: data.answer })");
    expect(block).toContain('return;');
    // The block builds its request through the tested pure builder.
    expect(block).toContain('buildLaneRequest(');
  });

  it('semantic intercepts ahead of the attempt are lane-guarded', () => {
    // The pending-clarification reunite and A3 sit before the lane block
    // in source order; both must stand down for lane-owned turns.
    expect(SRC).toContain('&& !laneFirst) {');
    expect(SRC).toContain('a3Enabled() && !laneFirst');
    // The review-anchored net's stand-down includes the authority predicate.
    expect(SRC).toContain('const laneWillOwnTurn = laneFirst ||');
  });

  it('a declined turn is never re-attempted at the nested site', () => {
    expect(SRC).toContain('if (!laneAttempted && laneActive() && laneStateRef.current');
  });

  it('the authority decision uses the pure, tested predicate', () => {
    expect(SRC).toContain('const laneFirst = laneFirstAuthority({');
    expect(SRC).toContain('messageSystemComponents: detectSystemDescription(');
  });
});
