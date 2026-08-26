import { it } from 'vitest';
import { detectIntent, extractSubjectMatches } from '../intent';
import { buildSystemAssessment } from '../consultation';
it('probe', () => {
  const N = 'Assess my system: Zorblax ZX-1 streamer, Quuxamp 9 amplifier, Blorp Minis speakers.';
  const i: any = detectIntent(N);
  console.log('intent:', i.intent, 'desires:', JSON.stringify(i.desires ?? []).slice(0, 80));
  const r: any = buildSystemAssessment(N, extractSubjectMatches(N), null as never, i.desires as never);
  console.log('assessment kind:', r?.kind, 'n:', r?.components?.length, 'clar:', r?.clarification?.question?.slice(0, 100));
});
