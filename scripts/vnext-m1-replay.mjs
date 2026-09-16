#!/usr/bin/env node
/**
 * Migration 1 — five-system replay through the PRODUCTION lane route.
 *
 * Drives /api/reasoning-lane exactly as the founder client does (same state
 * threading: history of its own answers, hypothetical carry, verbatim
 * observation list) for the five canonical conversations. Proves the
 * migrated route publishes B2 answers with real statuses.
 *
 *   node scripts/vnext-m1-replay.mjs [baseUrl]   (default http://localhost:3000)
 */
const BASE = process.argv[2] ?? 'http://localhost:3000';

const SYSTEMS = {
  accuphase: {
    components: [
      { displayName: 'Accuphase E-600', role: 'amplifier' },
      { displayName: 'Accuphase DP-450', role: 'cd player' },
      { displayName: 'Harbeth SHL5 Plus', role: 'speaker' },
    ],
    turns: [
      'Is the amp powerful enough for these speakers?',
      'I sit about nine feet away and I don’t listen very loud.',
      'What if I replaced the Accuphase with a Hegel H390?',
      'Actually forget the Hegel. Would changing the DAC side matter more?',
      'So should I just leave it alone?',
    ],
  },
  nad: {
    components: [
      { displayName: 'NAD AV716', role: 'receiver' },
      { displayName: 'Topping D70 Pro OCTO', role: 'dac' },
      { displayName: 'Dynaco A35', role: 'speaker' },
    ],
    turns: [
      'Is that receiver good enough for the Dynacos?',
      'It’s a small room and I listen at modest volume.',
      'Say I swapped in a Rega Elex Mk4 — what changes?',
      'What would you change first, if anything?',
      'Or should I keep it as it is and enjoy it?',
    ],
  },
  'job-boenicke': {
    components: [
      { displayName: 'JOB INTegrated', role: 'amplifier' },
      { displayName: 'Boenicke W5', role: 'speaker' },
    ],
    turns: [
      'Are those little speakers hard to drive?',
      'Is the amp the right match here?',
      'What would you change, if anything?',
    ],
  },
  'decware-magnepan': {
    components: [
      { displayName: 'Decware SE84UFO', role: 'amplifier' },
      { displayName: 'Magnepan LRS+', role: 'speaker' },
    ],
    turns: [
      'It does sound thin and quiet unless I crank it.',
      'So what exactly is the problem?',
      'Would a Hegel H190 fix it?',
    ],
  },
  nathan: {
    components: [
      { displayName: 'dCS Rossini Apex', role: 'dac' },
      { displayName: 'ARC Reference 5', role: 'preamplifier' },
      { displayName: 'Butler Monads', role: 'amplifier' },
      { displayName: 'Acora QRC-2', role: 'speaker' },
    ],
    turns: [
      'Anything in that chain look mismatched to you?',
      'Which component is doing the least for me?',
      'Or is this a system I should simply stop touching?',
    ],
  },
};

const isObservation = (t) => !t.trim().endsWith('?') && t.length <= 300
  && /\b(?:i|my|our|we)\b/i.test(t)
  && /\b(?:sit|sitting|seat|listen|hear|hearing|find|prefer|room|feet|foot|meters?|metres?|level|volume|loud|quiet|softly|bright|harsh|strain|strained|compress\w*|soft|thin|boomy|fatigu\w*|desk|night|apartment)\b/i.test(t);

let pass = 0, fail = 0;
for (const [id, sys] of Object.entries(SYSTEMS)) {
  const history = [];
  const observations = [];
  let hypothetical = null;
  for (let i = 0; i < sys.turns.length; i++) {
    const q = sys.turns[i];
    if (isObservation(q) && !observations.includes(q)) observations.push(q);
    const t0 = Date.now();
    const r = await fetch(`${BASE}/api/reasoning-lane`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activeSystem: { components: sys.components, source: 'stated' },
        currentHypothetical: hypothetical,
        question: q,
        recentTurns: history.slice(-10),
        userObservations: observations,
      }),
    });
    const data = await r.json().catch(() => ({}));
    const ok = r.ok && (data.status === 'CHECKED' || data.status === 'REPAIRED')
      && typeof data.answer === 'string' && data.answer.trim().length > 0;
    const hyp = data?.contextMeta?.hypothetical;
    if (hyp !== undefined) hypothetical = hyp;
    console.log(`[replay] ${id} t${i + 1}: http=${r.status} status=${data.status ?? '-'} `
      + `viol=${data?.validation?.violations?.length ?? '-'} rep=${data?.validation?.repaired ?? '-'} `
      + `hyp=${hypothetical ? 'set' : 'none'} ms=${Date.now() - t0} ${ok ? 'OK' : 'FAIL'}`);
    if (ok) {
      pass++;
      history.push({ role: 'user', content: q });
      history.push({ role: 'assistant', content: data.answer });
    } else {
      fail++;
      console.log('  detail:', JSON.stringify(data).slice(0, 300));
      history.push({ role: 'user', content: q });
      history.push({ role: 'assistant', content: '[legacy fallback took this turn]' });
    }
  }
}
console.log(`\n[replay] published=${pass} fallback/fail=${fail}`);
process.exit(fail > pass ? 1 : 0);
