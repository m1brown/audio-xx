/**
 * Golden System Conversations — reusable scenario definitions.
 *
 * Each scenario covers the canonical shape: assessment, strongest aspect,
 * limiting factor, amplifier/system relationship, one-change, hypothetical
 * substitution + discussion + return to the actual system, listener
 * observation, revised recommendation, specific candidates, leave-alone.
 *
 * Key turns carry 2–3 paraphrase VARIANTS so the corpus measures semantics
 * rather than memorized routing: repetition r uses variants[r % length].
 * Wording differs across systems on purpose — four listeners, not one
 * template.
 *
 * NOTHING here fixes an answer. Slots exist so the analyzer and judge know
 * which behavior each turn exercises.
 */

export type TurnSlot =
  | 'assessment'
  | 'strongest'
  | 'limiting'
  | 'amp_relationship'
  | 'one_change'
  | 'hypothetical'
  | 'hypo_discussion'
  | 'return_actual'
  | 'observation'
  | 'revised'
  | 'candidates'
  | 'leave_alone';

export interface GoldenTurn {
  slot: TurnSlot;
  /** Paraphrase variants; rep r uses variants[r % variants.length]. */
  variants: string[];
  /** Listener-stated fact — appended verbatim to userObservations. */
  observation?: boolean;
}

export interface GoldenScenario {
  systemId: 'france-ii' | 'nathan' | 'nad' | 'accuphase';
  turns: GoldenTurn[];
}

export const GOLDEN_SCENARIOS: GoldenScenario[] = [
  {
    systemId: 'france-ii',
    turns: [
      { slot: 'assessment', variants: [
        'Assess my system: Eversolo DMP-A6, Chord Hugo, JOB INTegrated, WLM Diva Monitor.',
      ] },
      { slot: 'strongest', variants: [
        'What does this system do best?',
        'What is the strongest thing about this setup?',
      ] },
      { slot: 'limiting', variants: [
        'And what is holding it back, if anything?',
        'Where is the ceiling — what limits it?',
      ] },
      { slot: 'amp_relationship', variants: [
        'How well does the JOB actually suit the Divas?',
        'Is the amp the right partner for these speakers?',
      ] },
      { slot: 'hypothetical', variants: [
        'What if I replaced the Divas with Boenicke W5s?',
        'Suppose I tried Boenicke W5s instead of the Divas.',
      ] },
      { slot: 'hypo_discussion', variants: [
        'Would the JOB still be the right amp in that setup?',
        'Does the rest of the chain still make sense with those speakers?',
      ] },
      { slot: 'return_actual', variants: [
        'Forget that change — back to my actual system.',
        'Never mind the Boenickes. Back to what I actually own.',
      ] },
      { slot: 'observation', observation: true, variants: [
        'I mostly listen in the evening at low volume, and what I love about this system is how intimate voices sound.',
        'Most of my listening is quiet and late; the intimacy on voices is what keeps me here.',
      ] },
      { slot: 'revised', variants: [
        'Given that, I have about $5k. What should I change, if anything?',
        'With that in mind — I could spend up to five grand. What would you do?',
      ] },
      { slot: 'candidates', variants: [
        'Can you name actual components you would consider for that?',
        'Give me real candidates — specific models, not categories.',
      ] },
      { slot: 'leave_alone', variants: [
        'Or should I just leave it alone and keep the money?',
        'Honestly — is doing nothing the better move here?',
      ] },
    ],
  },
  {
    systemId: 'nathan',
    turns: [
      { slot: 'assessment', variants: [
        'Assess my system: dCS Rossini Apex, Audio Research Reference 5, Butler Monad monoblocks, Acora QRC-2.',
      ] },
      { slot: 'strongest', variants: [
        'What is this system best at?',
        'What would you say its defining strength is?',
      ] },
      { slot: 'amp_relationship', variants: [
        'Do the Butlers and the Acoras make sense together electrically?',
        'Anything about the amp/speaker interface I should worry about?',
      ] },
      { slot: 'limiting', variants: [
        'Which component is doing the least for me?',
        'If something in this chain is the weak point, what is it?',
      ] },
      { slot: 'hypothetical', variants: [
        'What if I replaced the Ref 5 with running the Rossini direct into the amps?',
        'Suppose I took the preamp out and ran the Rossini straight into the Butlers.',
      ] },
      { slot: 'hypo_discussion', variants: [
        'What would I actually gain or lose that way?',
        'Is that an improvement or just a change?',
      ] },
      { slot: 'return_actual', variants: [
        'OK, forget that — assume the Ref 5 stays.',
        'Back to the system as it is, preamp included.',
      ] },
      { slot: 'observation', observation: true, variants: [
        'Sometimes the top end gets a little dry on massed strings, and I care about that repertoire a lot.',
        'On big string sections the treble can turn slightly dry — and orchestral music is most of what I play.',
      ] },
      { slot: 'revised', variants: [
        'Does that change what you would do first?',
        'Knowing that, what would you now change first, if anything?',
      ] },
      { slot: 'candidates', variants: [
        'If I did make one move, name the specific components you would audition.',
        'Give me the actual shortlist you would listen to for that.',
      ] },
      { slot: 'leave_alone', variants: [
        'Or is this a system I should simply stop touching?',
        'Straight answer: should I leave this system alone?',
      ] },
    ],
  },
  {
    systemId: 'nad',
    turns: [
      { slot: 'assessment', variants: [
        'Assess my system: NAD AV716 receiver, Topping D70 Pro OCTO DAC, Dynaco A35 speakers.',
      ] },
      { slot: 'amp_relationship', variants: [
        'Does running the Topping into the NAD even make sense — does the receiver redigitize it?',
        'Is the DAC wasted on this receiver? I do not know what the NAD does to its analog inputs.',
      ] },
      { slot: 'strongest', variants: [
        'What is actually good about this setup?',
        'Before we talk about changes — what does it do well?',
      ] },
      { slot: 'limiting', variants: [
        'What is limiting this system the most?',
        'Where is the real bottleneck?',
      ] },
      { slot: 'observation', observation: true, variants: [
        'It is a small room, about 12 by 14, and I listen at modest volume in the evenings.',
        'The room is small — roughly 12 by 14 feet — and I keep the volume moderate.',
      ] },
      { slot: 'revised', variants: [
        'Given that, is the receiver actually the problem people assume it is?',
        'Does that change how much the amplification matters here?',
      ] },
      { slot: 'hypothetical', variants: [
        'What if I replaced the Dynacos with a modern standmount?',
        'Suppose I tried a current bookshelf speaker in place of the A35s.',
      ] },
      { slot: 'hypo_discussion', variants: [
        'What would I lose that the Dynacos are giving me now?',
        'Would that actually be an upgrade, or just newer?',
      ] },
      { slot: 'return_actual', variants: [
        'Forget the swap — the Dynacos stay.',
        'Never mind. Back to my actual speakers.',
      ] },
      { slot: 'candidates', variants: [
        'If I changed one thing, name specific components you would consider.',
        'Give me actual candidate models for the one change you would make.',
      ] },
      { slot: 'leave_alone', variants: [
        'Or should I keep it exactly as it is and enjoy it?',
        'Is the honest answer to change nothing?',
      ] },
    ],
  },
  {
    systemId: 'accuphase',
    turns: [
      { slot: 'assessment', variants: [
        'Assess my system: Accuphase E-600, Accuphase DP-450 and Harbeth SHL5 Plus.',
      ] },
      { slot: 'amp_relationship', variants: [
        'Is the E-600 powerful enough for the Harbeths?',
        'Do the Harbeths need more power than the E-600 gives them?',
      ] },
      { slot: 'observation', observation: true, variants: [
        'I sit about nine feet away and I rarely listen loud.',
        'My seat is close — around nine feet — and my levels are modest.',
      ] },
      { slot: 'strongest', variants: [
        'What is the best thing this system does?',
        'What should I be careful not to lose here?',
      ] },
      { slot: 'limiting', variants: [
        'What is the weakest part of the system?',
        'If anything is limiting it, what?',
      ] },
      { slot: 'hypothetical', variants: [
        'What if I replaced the E-600 with a Luxman L-590AXII?',
        'Suppose I swapped in a Luxman L-590AXII for the Accuphase.',
      ] },
      { slot: 'hypo_discussion', variants: [
        'For the way I listen, what would actually change?',
        'Would I hear the difference at my levels and distance?',
      ] },
      { slot: 'return_actual', variants: [
        'Forget the Luxman. Back to my actual system.',
        'Leave the Luxman aside — the Accuphase stays for now.',
      ] },
      { slot: 'revised', variants: [
        'Given how I listen, what would you try first, if anything?',
        'So for my seat and my levels — what is the first move, if there is one?',
      ] },
      { slot: 'candidates', variants: [
        'Can you suggest actual components for that — even ones you hold little data on, like a Leben CS-600?',
        'Name real candidates, including gear you may not have full data for, say a Leben CS-600.',
      ] },
      { slot: 'leave_alone', variants: [
        'So should I just leave it alone?',
        'Is keeping it exactly as it is the right call?',
      ] },
    ],
  },
];

/**
 * §6 listener-observation metamorphic pairs — a two-turn probe per system:
 * assessment, then EITHER the baseline question OR the transformed question
 * carrying a material listener observation. The invariant is NOT that the
 * recommendation must change; it is that the observation must MATERIALLY
 * ENTER THE REASONING (ignored = failure; merely repeated = weak; causally
 * incorporated = success — including a reasoned explanation of why it does
 * not change the decision).
 */
export interface ObservationPair {
  systemId: GoldenScenario['systemId'];
  baseline: string;
  transformed: string;
}

export const OBSERVATION_PAIRS: ObservationPair[] = [
  {
    systemId: 'france-ii',
    baseline: 'What would you change first?',
    transformed: 'I mostly listen quietly from fairly close and care much more about tone than scale. What would you change first?',
  },
  {
    systemId: 'nathan',
    baseline: 'What would you change first?',
    transformed: 'I listen almost entirely to large-scale orchestral music at realistic levels in a big treated room. What would you change first?',
  },
  {
    systemId: 'nad',
    baseline: 'What would you change first?',
    transformed: 'The room is tiny and I never play loud — mostly late-night listening. What would you change first?',
  },
  {
    systemId: 'accuphase',
    baseline: 'What would you change first?',
    transformed: 'I sit close, listen at low levels, and some recordings already edge toward bright. What would you change first?',
  },
];

/** Deterministic pick: repetition r of a turn uses this variant. */
export function turnText(turn: GoldenTurn, rep: number): string {
  return turn.variants[rep % turn.variants.length];
}
