// Latency decomposition — five representative governed turns, N runs each,
// direct against the instrumented route.
import { writeFileSync } from 'node:fs';
const BASE = process.argv[2] ?? 'http://localhost:54216';
const N = Number(process.argv[3] ?? 3);
const NATHAN = [
  { displayName: 'dCS Rossini Apex', role: 'dac' },
  { displayName: 'ARC ref 5', role: 'preamplifier' },
  { displayName: 'Butler Monads', role: 'amplifier' },
  { displayName: 'Acora QRC-2', role: 'speaker' },
];
const HYP = { candidate: 'Leben CS600', incumbent: 'Butler Monads' };
const TURNS = [
  { id: 'simple-followup', body: { activeSystem: { components: NATHAN, source: 'stated' }, currentHypothetical: null, question: 'Anything else you would look at?', recentTurns: [] } },
  { id: 'evidence-substitution', body: { activeSystem: { components: NATHAN, source: 'stated' }, currentHypothetical: HYP, question: 'Would I lose bass control?', recentTurns: [{ role: 'user', content: 'What about a Leben CS600 instead of the Butler?' }] } },
  { id: 'referent-heavy', body: { activeSystem: { components: NATHAN, source: 'stated' }, currentHypothetical: { candidate: 'Hegel H590', incumbent: 'Butler Monads' }, question: 'Which of the three would you choose?', recentTurns: [
    { role: 'user', content: 'What about a Leben CS600 instead of the Butler?' },
    { role: 'assistant', content: 'The Leben CS600 would reduce rated power from 200W to 32W at the 4-ohm load; its licensed character is uncoloured and unforced.' },
    { role: 'user', content: 'What about a Hegel H590 instead?' },
    { role: 'assistant', content: 'The Hegel H590 has no licensed evidence here; as a class, high-power solid-state designs typically prioritise control.' },
  ] } },
  { id: 'shopping-transition', body: { activeSystem: { components: NATHAN, source: 'stated' }, currentHypothetical: null, question: 'What amplifier should I audition?', recentTurns: [] } },
  { id: 'sparse-candidate', body: { activeSystem: { components: NATHAN, source: 'stated' }, currentHypothetical: { candidate: 'Bakoon AMP-13R', incumbent: 'Butler Monads' }, question: 'What about a Bakoon AMP-13R instead of the Butler?', recentTurns: [] } },
];
const out = [];
for (const t of TURNS) {
  for (let i = 0; i < N; i++) {
    const w0 = Date.now();
    const r = await fetch(`${BASE}/api/reasoning-lane`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t.body),
    });
    const wall = Date.now() - w0;
    const j = await r.json().catch(() => ({}));
    const tm = j.timing ?? {};
    const u = tm.primaryUsage ?? {};
    const row = {
      id: t.id, run: i, wall,
      assembly: tm.assemblyMs, primary: tm.primaryMs, validator: tm.validatorMs, total: tm.totalMs,
      inTok: u.prompt_tokens, outTok: u.completion_tokens, ctxChars: tm.contextChars,
      repaired: j.validation?.repaired, answerLen: (j.answer ?? '').length,
    };
    out.push(row);
    console.log(JSON.stringify(row));
  }
}
writeFileSync('/private/tmp/claude-501/-Users-mikebrown-audio-xx/4b31ef88-a78c-4b6b-a49b-9a695d816a5f/scratchpad/latency-baseline.json', JSON.stringify(out, null, 1));
console.log('LATENCY-DONE');
