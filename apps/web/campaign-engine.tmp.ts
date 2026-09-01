import { readFileSync } from 'node:fs';
import { detectIntent, extractSubjectMatches } from './src/lib/intent';
import { buildTurnContext } from './src/lib/turn-context';
import { buildSystemAssessment } from './src/lib/consultation';
import { normalizeRole } from './src/lib/assessment/authoritative';
const systems = JSON.parse(readFileSync('campaign-systems.json', 'utf8'));
const EMPTY = { savedSystems: [], activeSystemRef: null, draftSystem: null, proposedSystem: null } as never;
for (const sys of systems) {
  try {
    const ctx: any = buildTurnContext(sys.msg, EMPTY, new Set(), null as never);
    const r: any = buildSystemAssessment(sys.msg, extractSubjectMatches(sys.msg), ctx.activeSystem, (detectIntent(sys.msg) as any).desires);
    const chain = r?.findings?.systemChain;
    const comps = r?.components?.map((c: any) => ({ n: c.displayName, r: c.role }))
      ?? chain?.names?.map((n: string, i: number) => ({ n, r: chain.roles[i] }));
    const intent = (detectIntent(sys.msg) as any).intent;
    console.log(JSON.stringify({ id: sys.id, intent, kind: r?.kind,
      comps: comps?.map((c: any) => `${c.n}[${normalizeRole(c.r) ?? c.r}]`),
      clar: r?.clarification?.question?.slice(0, 90) }));
  } catch (e) {
    console.log(JSON.stringify({ id: sys.id, CRASH: String(e).slice(0, 150) }));
  }
}
