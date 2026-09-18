/**
 * vNext Phase 0 — fixed conversation scripts.
 *
 * Fixed scripts keep arms comparable: every arm receives the same listener
 * turns in the same order (each arm sees its OWN prior answers as history —
 * that is the honest conversational condition). Collectively the scripts
 * exercise every §9 shape: initial assessment, ambiguity, referents,
 * listening observations, distance/level, substitution, comparison,
 * hypothetical, revert, "what is limiting it?", "what would you change?",
 * "should I leave it alone?".
 *
 * `observation: true` marks turns whose content is a listener-stated fact —
 * the runner appends these verbatim to arm B's userObservations, exactly as
 * the product would.
 */

export interface ScriptTurn {
  user: string;
  observation?: boolean;
}

export const CONVERSATIONS: Record<string, ScriptTurn[]> = {
  accuphase: [
    { user: 'Assess my system: Accuphase E-600, Accuphase DP-450 and Harbeth SHL5 Plus.' },
    { user: 'Is the amp powerful enough for these speakers?' },
    { user: 'I sit about nine feet away and I don’t listen very loud.', observation: true },
    { user: 'What is the weakest part of the system?' },
    { user: 'What if I replaced the Accuphase with a Hegel H390?' },
    { user: 'How would that compare to what I have now for the way I listen?' },
    { user: 'Actually forget the Hegel. Would changing the DAC side matter more?' },
    { user: 'I do find it a little bright on some recordings.', observation: true },
    { user: 'What would you try first?' },
    { user: 'So should I just leave it alone?' },
  ],
  nad: [
    { user: 'Assess my system: NAD AV716 receiver, Topping D70 Pro OCTO DAC, Dynaco A35 speakers.' },
    { user: 'Is that receiver good enough for the Dynacos?' },
    { user: 'It’s a small room, maybe 12 by 14 feet, and I listen at modest volume.', observation: true },
    { user: 'What’s limiting this system?' },
    { user: 'Would a modern amplifier be a meaningful upgrade over the NAD?' },
    { user: 'Say I swapped in a Rega Elex Mk4 — what changes?' },
    { user: 'The old speakers sound a bit soft in the bass to me.', observation: true },
    { user: 'Does the second one you mentioned matter more than the amp question?' },
    { user: 'What would you change first, if anything?' },
    { user: 'Or should I keep it as it is and enjoy it?' },
  ],
  'job-boenicke': [
    { user: 'Assess my system: JOB INTegrated amplifier and Boenicke W5 speakers.' },
    { user: 'Are those little speakers hard to drive?' },
    { user: 'My desk setup — I sit close, maybe five feet.', observation: true },
    { user: 'Is the amp the right match here?' },
    { user: 'What about a Naim Atom instead of the JOB?' },
    { user: 'Never mind that — is there anything actually wrong with what I have?' },
    { user: 'What information would settle the open questions?' },
    { user: 'What would you change, if anything?' },
    { user: 'And if I just leave it alone?' },
    { user: 'Give me the one-paragraph verdict.' },
  ],
  'decware-magnepan': [
    { user: 'Assess my system: Decware SE84UFO amplifier driving Magnepan LRS+ speakers.' },
    { user: 'I’ve heard SETs and Maggies described as magical together — true?' },
    { user: 'It does sound thin and quiet unless I crank it.', observation: true },
    { user: 'So what exactly is the problem?' },
    { user: 'Would a Hegel H190 fix it?' },
    { user: 'Or should I keep the Decware and change the speakers instead?' },
    { user: 'Which path preserves more of what I like about the sound?' },
    { user: 'I mostly listen to acoustic music at night.', observation: true },
    { user: 'What would you do in my position?' },
    { user: 'Is there any version of keeping both?' },
  ],
  nathan: [
    { user: 'Assess my system: dCS Rossini Apex, Audio Research Reference 5, Butler Monad monoblocks, Acora QRC-2.' },
    { user: 'Anything in that chain look mismatched to you?' },
    { user: 'The room is large and treated, and I listen at realistic levels.', observation: true },
    { user: 'Which component is doing the least for me?' },
    { user: 'What if I replaced the Butlers with a pair of ARC Reference 160 monos?' },
    { user: 'How does that compare with keeping the Butlers?' },
    { user: 'Forget the ARC amps. What about the preamp — is the Ref 5 the weak link?' },
    { user: 'Sometimes the top end gets a little dry on massed strings.', observation: true },
    { user: 'What would you change first?' },
    { user: 'Or is this a system I should simply stop touching?' },
  ],
  'holdout-luxman': [
    { user: 'Assess my system: Luxman L-505Z, Dynaudio Evoke 20 and a Bluesound Node.' },
    { user: 'Is the Luxman a good match for the Dynaudios?' },
    { user: 'I listen in a medium living room, about ten feet back.', observation: true },
    { user: 'What’s the weakest link?' },
    { user: 'Should I leave it alone or change something?' },
  ],
  'holdout-peachtree': [
    { user: 'What do you think of my setup? Peachtree Nova 300, Totem Arro floorstanders, iFi Zen Stream.' },
    { user: 'The Arros are small — do they need a subwoofer?' },
    { user: 'The room is 11 by 13 and I sit about eight feet away.', observation: true },
    { user: 'What would you change first, if anything?' },
    { user: 'And if the answer is nothing, tell me why.' },
  ],
  /*
   * Candidate-solicitation shape (M1 quality correction) — the founder
   * conversation class the Phase-0.1 corpus missed: the listener asks the
   * adviser to NAME candidate products, including products Audio XX holds
   * no exact-product evidence for. No answers are fixtured; runners and
   * audits assert properties (names survive publication, no unlicensed
   * figures, no evidence-voiced fabrication).
   */
  'accuphase-candidates': [
    { user: 'Assess my system: Accuphase E-600, Accuphase DP-450 and Harbeth SHL5 Plus.' },
    { user: 'Which of my two Accuphase sources would you choose for more intimacy and connection?' },
    { user: 'What upgrade gives me the most bang for the buck if I want more of the same?' },
    { user: 'Can you suggest a component in each category?' },
    { user: 'Can you give me actual components — something like a Kinki Studio or a Leben CS-600?' },
    { user: 'Is the Leben CS-600 worth auditioning here, even if you have no data on it?' },
    { user: 'Give me one concrete next step if I make a single change.' },
  ],
  /*
   * France II — the founder's actual conversation shapes (M1 model
   * selection). Nothing is fixtured: which DAC, which upgrade, which
   * candidates, and whether to change anything at all are the model's
   * questions to answer. The final turn is a genuine leave-it-alone
   * opportunity so recommending purchases is not implicitly rewarded.
   */
  'france-ii': [
    { user: 'Assess my system: Eversolo DMP-A6, Chord Hugo, JOB INTegrated, WLM Diva Monitor.' },
    { user: 'Which DAC of the three should be best for me if I want the most intimacy and connection?' },
    { user: 'What upgrade would give me the most bang for the buck if I want more of the same?' },
    { user: 'Can you suggest a component in each category?' },
    { user: 'Can I see actual components? For example Kinki Dazzle, Leben CS-600, etc.' },
    { user: 'Of those candidates, which single one would you prioritize for me, and why that one first?' },
    { user: 'Or is this a system I should simply leave alone?' },
  ],
};
