/** B++ — the Substrate Experiment battery through the REAL reasoning-lane
 *  modules (context assembly + serialization), model gpt-4o. Read-only. */
import { readFileSync, writeFileSync } from 'node:fs';
import { assembleGovernedContext, type ConversationTurn } from '@/lib/reasoning/context-assembly';
import { serializeGovernedContext, REASONING_RULES } from '@/lib/reasoning/governed-context';
import { buildSystemAssessment } from '@/lib/consultation';
import { buildTurnContext } from '@/lib/turn-context';

const S = '/private/tmp/claude-501/-Users-mikebrown-audio-xx/4b31ef88-a78c-4b6b-a49b-9a695d816a5f/scratchpad';
const KEY = readFileSync('/Users/mikebrown/audio-xx/audio-xx/apps/web/.env', 'utf8')
  .split('\n').find((l) => l.startsWith('OPENAI_API_KEY='))!.slice('OPENAI_API_KEY='.length).trim();
const ONLY = process.env.BPP_ONLY?.split(',');
const CASES = JSON.parse(readFileSync(`${S}/exp-cases.json`, 'utf8'))
  .filter((c: any) => !ONLY || ONLY.includes(c.id));
const HYP = JSON.parse(readFileSync(`${S}/exp-hyp.json`, 'utf8'));

const GUEST: any = { activeSystemRef: { kind: 'none' }, savedSystems: [], draftSystem: null, loading: false, proposedSystem: null };

async function ask(messages: Array<{ role: string; content: string }>): Promise<string> {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: 'gpt-4o', temperature: 0.4, messages }),
  });
  const j = await r.json();
  if (!j.choices) throw new Error(JSON.stringify(j).slice(0, 300));
  return j.choices[0].message.content;
}

async function main() {
  for (const cs of CASES) {
    // T1 components from the engine's own parse of the assess message.
    const tc = buildTurnContext(cs.assess, GUEST, new Set(), undefined);
    const r: any = buildSystemAssessment(cs.assess, tc.subjectMatches, tc.activeSystem, []);
    let comps: Array<{ displayName: string; role: string }> =
      (r?.components ?? []).map((c: any) => ({ displayName: c.displayName, role: c.role ?? '' }));
    if (!comps.length) {
      const chain = r?.findings?.systemChain;
      comps = (chain?.names ?? []).map((n: string, i: number) => ({
        displayName: n, role: chain?.roles?.[i] ?? '',
      }));
    }
    if (!comps.length) { console.log(cs.id, 'NO COMPONENTS — skipped'); continue; }

    const turns: ConversationTurn[] = [];
    const transcript: Array<{ q: string; a: string; meta?: unknown }> = [];

    // T1 through the lane too, so the whole conversation is one substrate.
    const t1ctx = await assembleGovernedContext({
      activeSystem: { components: comps, source: 'stated' },
      currentHypothetical: null, question: cs.assess, recentTurns: [],
    });
    let a = await ask([
      { role: 'system', content: `${REASONING_RULES}\n\n${serializeGovernedContext(t1ctx)}` },
      { role: 'user', content: cs.assess },
    ]);
    turns.push({ role: 'user', content: cs.assess }, { role: 'assistant', content: a });
    transcript.push({ q: cs.assess, a });

    for (let i = 0; i < cs.questions.length; i++) {
      const q = cs.questions[i];
      const hyp = HYP[cs.id]?.[i] ?? null;
      const ctx = await assembleGovernedContext({
        activeSystem: { components: comps, source: 'stated' },
        currentHypothetical: hyp,
        question: q,
        recentTurns: turns.slice(-10),
      });
      a = await ask([
        { role: 'system', content: `${REASONING_RULES}\n\n${serializeGovernedContext(ctx)}` },
        ...turns.slice(-10),
        { role: 'user', content: q },
      ]);
      turns.push({ role: 'user', content: q }, { role: 'assistant', content: a });
      transcript.push({
        q, a,
        meta: { hyp, candidates: ctx.candidates.map((c) => `${c.displayName}:${c.identity}:${c.items.length}`), computed: ctx.computedFacts.length },
      });
      process.stdout.write('.');
    }
    writeFileSync(`${S}/expBPP-${cs.id}.json`, JSON.stringify(transcript, null, 1));
    console.log(' ', cs.id, 'done');
  }
  console.log('EXP-BPP-DONE');
}
main();
