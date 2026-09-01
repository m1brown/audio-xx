import { it } from 'vitest';
import { parseLabelledComponents, TURN_SEPARATOR } from '../labelled-components';
import { extractSubjectMatches, detectIntent } from '../intent';
import { buildSystemAssessment } from '../consultation';
const T1 = 'Assess my system:\n1. Pre-amp: ARC ref 5\n2. Amps: Butler Monads\n3. Dac/Streamer: dCS Rossini Apex\n4. Speakers: Acora QRC-2';
const T2 = 'Assess my system:\n- Pre-amp: ARC ref 5\n- Amps: Butler Monads\n- Dac/Streamer: dCS Rossini Apex\n- Speakers: Acora QRC-2';
it('v', () => {
  for (const [n, m] of [
    ['T1 alone', T1], ['T2 alone', T2],
    ['T1 <SEP> T2', `${T1}${TURN_SEPARATOR}${T2}`],
    ['T2 <SEP> T1', `${T2}${TURN_SEPARATOR}${T1}`],
  ] as [string,string][]) {
    const r = parseLabelledComponents(m);
    console.log(`--- ${n}  (${r.length} labelled)`);
    for (const l of r) console.log(`    ${l.roles[0]}: "${l.rawName}"`);
    const { desires } = detectIntent(m) as any;
    const a: any = buildSystemAssessment(m, extractSubjectMatches(m), null, desires);
    const names = a?.components?.map((c: any) => c.displayName) ?? a?.findings?.componentNames ?? [];
    console.log(`    => kind=${a?.kind ?? 'assessment'} n=${names.length} [${names.join(', ')}]`);
    if (a?.kind === 'clarification') console.log(`    => Q: ${a.clarification.question}`);
  }
});
