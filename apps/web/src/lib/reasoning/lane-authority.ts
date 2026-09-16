/**
 * Migration 1 — founder lane authority (P1 repair, 2026-09-16).
 *
 * THE AUTHORITY RULE: for an eligible founder with an established system
 * conversation, a post-assessment listener turn ENTERS THE B2 REASONING
 * LANE BEFORE ANY LEGACY SEMANTIC ROUTING. The model — not detectIntent,
 * not the state-machine pivot guards, not the shopping tower — owns the
 * semantic interpretation of such a turn: referents ("of the three"),
 * whether the listener is comparing existing components, substitutions,
 * reverts, and whether the question is shopping at all.
 *
 * The live failure this encodes: after a four-component assessment
 * (Eversolo DMP-A6, Chord Hugo, JOB INTegrated, WLM Diva Monitor), the
 * founder asked "which dac of the three should be the best…".
 * `detectExplicitCategoryPivot` — a guard built for genuine topic pivots
 * ("i'm thinking about a turntable") — matched "which…dac", reset the
 * conversation state machine to idle, and the turn fell into the legacy
 * shopping tower, which recommended catalog DACs the listener never asked
 * about and then looped on budget solicitation. The reasoning lane, nested
 * INSIDE the state machine's ready_to_assess branch, was never reached.
 *
 * This module is the pure, testable half of the repair: the authority
 * predicate and the request builder. page.tsx hoists the lane attempt to
 * the top of handleSubmit using exactly these functions, so the regression
 * suite exercises the same decision the production path makes.
 *
 * The ONLY intercepts that may run before this authority check are
 * non-semantic hard boundaries: input guards, attachment handling (a
 * photo turn is a listing evaluation), and authentication. Glossary,
 * beta intercepts, A3, pivot guards, the conversation state machine and
 * every advisory author come after — they run only when the lane
 * declines the turn (miss, INCOMPLETE/REJECTED, or transport failure).
 */

export interface LaneComponent {
  displayName: string;
  role: string;
}

export interface MessageComponent {
  brand?: string | null;
  name?: string | null;
}

/** Token fold shared with turn-context's saved-system restatement guard:
 *  lowercase, alphanumeric words of ≥2 chars, trailing plural-s stripped. */
function fold(x: string): Set<string> {
  return new Set(
    (x ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ')
      .filter((t) => t.length >= 2).map((t) => t.replace(/s$/, '')),
  );
}

/**
 * Does every component the message names match something already in the
 * lane roster? A restatement ("oh i meant of the three existing ones:
 * Chord Hugo, Job Integrated, Eversolo DMP A6") is CONVERSATION about the
 * established system — it stays with the lane. One component that matches
 * nothing in the roster means the listener has stated new equipment.
 */
export function restatesLaneRoster(
  msgComponents: readonly MessageComponent[],
  laneComponents: readonly LaneComponent[],
): boolean {
  if (msgComponents.length === 0 || laneComponents.length === 0) return false;
  return msgComponents.every((c) => {
    const inlineToks = fold(`${c.brand ?? ''} ${c.name ?? ''}`);
    if (inlineToks.size === 0) return true;
    return laneComponents.some((lc) => {
      const laneToks = fold(lc.displayName);
      const overlap = [...inlineToks].filter((t) => laneToks.has(t)).length;
      return overlap >= Math.min(2, inlineToks.size, laneToks.size);
    });
  });
}

/**
 * A state-establishing boundary, not a semantic classification: a turn
 * that explicitly states a NEW system (≥2 components, at least one of
 * which matches nothing in the established roster) replaces the actual
 * system, and that belongs to the assessment pipeline that arms the lane
 * — the lane must not answer conversationally over a roster the listener
 * has just replaced.
 */
export function statesNewSystem(
  msgComponents: readonly MessageComponent[],
  laneComponents: readonly LaneComponent[],
): boolean {
  return msgComponents.length >= 2 && !restatesLaneRoster(msgComponents, laneComponents);
}

export interface LaneAuthorityInput {
  /** laneActive() — flag or founder-cohort eligibility. */
  laneActive: boolean;
  /** The established actual system held by the client (laneStateRef). */
  laneComponents: readonly LaneComponent[];
  /** Attachment turns are listing evaluations — a hard boundary. */
  hasImages: boolean;
  /** Components the CURRENT message explicitly states (message-level
   *  parse — detectSystemDescription — NOT the persisted proposal). */
  messageSystemComponents: readonly MessageComponent[];
}

/** The single authority decision the hoisted page.tsx block makes. */
export function laneFirstAuthority(input: LaneAuthorityInput): boolean {
  if (!input.laneActive) return false;
  if (input.hasImages) return false;
  if (input.laneComponents.length < 2) return false;
  if (statesNewSystem(input.messageSystemComponents, input.laneComponents)) return false;
  return true;
}

export interface LaneRequestState {
  components: readonly LaneComponent[];
  source: 'saved' | 'stated';
  hypothetical: unknown;
  observations: readonly string[];
}

/**
 * The exact /api/reasoning-lane request body. Pure so the regression
 * suite can pin that the FULL roster travels on every turn — the live
 * failure also showed a shopping surface projecting the four-component
 * system as three; the lane request must never inherit a reduced roster.
 */
export function buildLaneRequest(
  state: LaneRequestState,
  question: string,
  recentTurns: ReadonlyArray<{ role: string; content: string }>,
): Record<string, unknown> {
  return {
    activeSystem: {
      components: state.components.map((c) => ({ displayName: c.displayName, role: c.role })),
      source: state.source,
    },
    currentHypothetical: state.hypothetical,
    question,
    recentTurns: recentTurns.slice(-10),
    userObservations: [...state.observations],
  };
}
