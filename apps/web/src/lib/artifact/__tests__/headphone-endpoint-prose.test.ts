/**
 * Beta hardening: a headphone system must not be described as a loudspeaker.
 *
 * The coherent-prose templates assume a loudspeaker endpoint ("hand the
 * speaker a signal", "composure left to the speaker"). On a headphone rig —
 * or any system with no resolved speaker — that reads wrong. When the graph
 * carries no speaker/monitor role, the endpoint noun is neutralized to
 * "the output". Speaker systems are unaffected.
 */
import { describe, it, expect } from 'vitest';
import { detectIntent, extractSubjectMatches } from '../../intent';
import { buildSystemAssessment } from '../../consultation';
import { synthesizeArtifact } from '../synthesizeArtifact';

function prose(text: string): string {
  const subs = extractSubjectMatches(text);
  const { desires } = detectIntent(text);
  const r: any = buildSystemAssessment(text, subs, null, desires);
  if (r?.kind !== 'assessment') return '';
  const p = synthesizeArtifact(r).payload;
  return [p.standfirst ?? '', p.recognition, ...(p.caseParagraphs ?? [])].join('\n');
}

describe('headphone systems are not called loudspeakers', () => {
  it('a DAC + headphones rig never says "the speaker"', () => {
    for (const s of [
      'Assess my system: Schiit Bifrost 2, Sennheiser HD650',
      'Assess my system: Chord Hugo, Sennheiser HD800',
    ]) {
      const body = prose(s);
      expect(body, s).not.toBe('');
      expect(body, `"${s}" should not call headphones a speaker`).not.toMatch(/\bthe speaker\b/i);
    }
  });

  it('a speaker system is unchanged — still says "the speaker" where it did before', () => {
    // Warm coherent speaker system → the warm equilibrium beat ("hand the
    // speaker a tone-rich signal"). Confirms the neutralization does NOT touch
    // systems that actually have a speaker.
    const body = prose('Assess my system: Denafrips Pontus II, Leben CS600X, DeVore O/96');
    expect(body).toMatch(/\bthe speaker\b/i);
  });
});
