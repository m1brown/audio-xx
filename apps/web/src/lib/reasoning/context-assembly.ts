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

/**
 * One-slot hypothetical maintenance — the ONLY conversational state the
 * substrate keeps (Substrate Doctrine). Derived deterministically from the
 * current turn: substitution phrasing sets it, revert phrasing clears it,
 * anything else carries the incoming slot forward. The model still resolves
 * richer semantics (chains, comparisons, referents) from raw recent turns;
 * this slot exists so retrieval and computation know which counterfactual
 * is live.
 */
export function deriveHypothetical(
  question: string,
  components: Array<{ displayName: string; role: string }>,
  incoming: { candidate: string; incumbent: string } | null,
): { candidate: string; incumbent: string } | null {
  const lower = question.toLowerCase();
  const tokensOf = (name: string) => name.toLowerCase().split(/[^a-z0-9+]+/)
    .filter((t) => t.length >= 3 && !['the', 'and', 'with'].includes(t));
  const componentNear = (pos: number, span: number, after: boolean) => {
    let best: { c: { displayName: string; role: string }; d: number } | undefined;
    for (const c of components) {
      for (const t of tokensOf(c.displayName)) {
        let i = -1;
        while ((i = lower.indexOf(t, i + 1)) >= 0) {
          const d = after ? i - pos : pos - (i + t.length);
          if (d >= 0 && d <= span && (!best || d < best.d)) best = { c, d };
        }
      }
    }
    return best?.c;
  };

  // Reverts clear the slot: "keep the <incumbent>", "go back", "revert",
  // "my real/original system".
  if (/\bgo(?:ing)?\s+back\b|\brevert\b|\b(?:real|original)\s+system\b/.test(lower)) return null;
  const keep = /\bkeep\s+(?:the\s+|my\s+)?([a-z0-9][a-z0-9 +/-]{2,30})/.exec(lower);
  if (keep && incoming) {
    const kept = keep[1];
    if (tokensOf(incoming.incumbent).some((t) => kept.includes(t))) return null;
  }

  // Substitution phrasing sets it. The candidate is whatever the turn names
  // that is NOT a system component (detection handles identity separately);
  // the incumbent is the named or unique-role component being displaced.
  const marker = /\binstead\s+of\b|\bin\s+place\s+of\b|\brather\s+than\b/.exec(lower);
  const candidates = detectCandidates(question, components);
  const cand = candidates[0]?.displayName;
  if (marker && cand) {
    const inc = componentNear(marker.index + marker[0].length, 50, true);
    if (inc) return { candidate: cand, incumbent: inc.displayName };
  }
  if (/\binstead\b/.test(lower) && cand && incoming) {
    // "…a Hegel H590 instead?" — same slot, new candidate.
    return { candidate: cand, incumbent: incoming.incumbent };
  }
  const repl = /\breplac(?:e|ing)\b|\bswap(?:ping)?\b/.exec(lower);
  if (repl && cand) {
    const inc = componentNear(repl.index, 60, true);
    if (inc) return { candidate: cand, incumbent: inc.displayName };
  }
  return incoming;
}

export async function assembleGovernedContext(input: AssemblyInput): Promise<GovernedContext> {
  const now = input.now ?? Date.now();
  const comps = input.activeSystem.components;
  const hypothetical = deriveHypothetical(input.question, comps, input.currentHypothetical);

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
  if (hypothetical) scan(hypothetical.candidate);

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
    hypothetical,
    now,
  });

  return {
    activeSystem: input.activeSystem,
    currentHypothetical: hypothetical,
    candidates,
    systemEvidence,
    computedFacts,
    userObservations: input.userObservations ?? [],
  };
}
