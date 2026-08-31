/**
 * Context assembly — turns conversation inputs into one governed context
 * package (Substrate Doctrine, build items 1+2 composed).
 *
 * Selective by design: candidates are detected from the current turn AND the
 * recent raw window (a candidate revisited three turns later still has its
 * evidence), system evidence is always present, computed facts follow the
 * active hypothetical. Nothing is retrieved "because it exists".
 */
import { detectCandidates, type DetectedCandidate } from './candidate-detection';
import { retrieveCandidateEvidence, retrieveEvidenceFor } from './evidence-retrieval';
import { buildComputedFacts } from './computed-facts';
import type { ComponentEvidence, GovernedContext } from './governed-context';

export interface ConversationTurn { role: 'user' | 'assistant'; content: string }

export interface AssemblyInput {
  activeSystem: {
    components: Array<{ displayName: string; role: string }>;
    source: 'saved' | 'stated';
  };
  currentHypothetical: { candidate: string; incumbent: string } | null;
  question: string;
  /** Raw recent turns, oldest first. The assembler scans user turns for
   *  candidates; the reasoning call receives them verbatim as messages. */
  recentTurns: ConversationTurn[];
  userObservations?: string[];
  now?: number;
}

export async function assembleGovernedContext(input: AssemblyInput): Promise<GovernedContext> {
  const now = input.now ?? Date.now();
  const comps = input.activeSystem.components;

  // Candidates: current turn first, then recent user turns (revisits).
  const byKey = new Map<string, DetectedCandidate>();
  const scan = (text: string) => {
    for (const c of detectCandidates(text, comps)) {
      const k = c.displayName.toLowerCase();
      if (!byKey.has(k)) byKey.set(k, c);
    }
  };
  scan(input.question);
  for (const t of input.recentTurns.slice(-10)) {
    if (t.role === 'user') scan(t.content);
  }
  // The active hypothetical's candidate always has evidence, even when the
  // current turn no longer names it.
  if (input.currentHypothetical) scan(input.currentHypothetical.candidate);

  const candidates: ComponentEvidence[] = [];
  for (const c of byKey.values()) {
    candidates.push(await retrieveCandidateEvidence(c, { now }));
  }

  const systemEvidence: ComponentEvidence[] = [];
  for (const c of comps) {
    systemEvidence.push(await retrieveEvidenceFor(c.displayName, {
      role: c.role, resolution: 'exact', now,
    }));
  }

  const computedFacts = await buildComputedFacts({
    components: comps,
    hypothetical: input.currentHypothetical,
    now,
  });

  return {
    activeSystem: input.activeSystem,
    currentHypothetical: input.currentHypothetical,
    candidates,
    systemEvidence,
    computedFacts,
    userObservations: input.userObservations ?? [],
  };
}
