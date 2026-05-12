/**
 * Tests for the Topology / Philosophy knowledge layer.
 *
 * The module must:
 *   - resolve topology aliases (case-insensitive, substring-bounded)
 *   - distinguish topology-question intent ("Why do X sound Y?") from
 *     shopping intent that merely mentions a topology ("Best R2R DAC")
 *   - produce stable, specialist-register prose via buildTopologyExplainer
 */

import { describe, it, expect } from 'vitest';
import {
  findTopologyMention,
  detectTopologyQuestion,
  getTopologyCapsule,
  buildTopologyExplainer,
  listTopologyIds,
  type TopologyId,
} from '../topology-philosophy';

describe('findTopologyMention — alias matching', () => {
  it.each<[string, TopologyId]>([
    ['Why do R2R DACs sound denser?', 'r2r'],
    ['Best R-2-R DAC under $1500', 'r2r'],
    ['What is a NOS DAC?', 'nos-dac'],
    ['Why are FPGA DACs precise?', 'fpga'],
    ['Pulse-array architecture', 'fpga'],
    ['Why do delta-sigma DACs measure so well?', 'delta-sigma'],
    ['ESS Sabre vs AKM', 'delta-sigma'],
    ['SET magic without rolled-off highs', 'set'],
    ['300B amp recommendation', 'set'],
    ['Push-pull vs SET emotionally', 'set'], // SET wins because shape order
    ['Push-pull tube amp under $5000', 'push-pull-tube'],
    ['Class A solid-state vs tube', 'class-a-solid-state'],
    ['Low-feedback amplifier design', 'low-feedback'],
    ['Zero-feedback Pass design', 'low-feedback'],
    ['horn speaker amplifier matching', 'horn-high-efficiency'],
    ['Single-driver Cube Audio', 'horn-high-efficiency'],
    ['BBC thin-wall cabinet philosophy', 'bbc-thin-wall'],
    ['LS3/5a clones', 'bbc-thin-wall'],
  ])('"%s" resolves to %s', (text, expected) => {
    const c = findTopologyMention(text);
    expect(c).not.toBeNull();
    expect(c!.id).toBe(expected);
  });

  it('returns null when no topology is mentioned', () => {
    expect(findTopologyMention('Best DAC under $1500')).toBeNull();
    expect(findTopologyMention('Leben CS600')).toBeNull();
    expect(findTopologyMention('I want a streamer')).toBeNull();
  });

  it('respects word boundaries for short aliases', () => {
    // "set" should NOT match inside "settled" or "setup"
    expect(findTopologyMention('I have a settled system')).toBeNull();
    expect(findTopologyMention('setup advice please')).toBeNull();
  });
});

describe('detectTopologyQuestion — question shape + topology', () => {
  it('"Why do R2R DACs sound denser?" → why + r2r', () => {
    const q = detectTopologyQuestion('Why do R2R DACs sound denser?');
    expect(q).not.toBeNull();
    expect(q!.shape).toBe('why');
    expect(q!.capsule.id).toBe('r2r');
  });

  it('"What is BBC thin-wall cabinet philosophy?" → what + bbc', () => {
    const q = detectTopologyQuestion('What is BBC thin-wall cabinet philosophy?');
    expect(q!.shape).toBe('what');
    expect(q!.capsule.id).toBe('bbc-thin-wall');
  });

  it('"How does FPGA reconstruction work?" → how + fpga', () => {
    const q = detectTopologyQuestion('How does FPGA reconstruction work?');
    expect(q!.shape).toBe('how');
    expect(q!.capsule.id).toBe('fpga');
  });

  it('"Explain Class A solid-state" → explain + class-a', () => {
    const q = detectTopologyQuestion('Explain Class A solid-state amplifiers');
    expect(q!.shape).toBe('explain');
    expect(q!.capsule.id).toBe('class-a-solid-state');
  });

  it('topology mention without a question word returns null', () => {
    // Shopping queries that mention a topology should NOT trigger the
    // topology-question intent — they need to route to shopping.
    expect(detectTopologyQuestion('Best R2R DAC under $1500')).toBeNull();
    expect(detectTopologyQuestion('I love my SET amp')).toBeNull();
  });

  it('question shape without a recognized topology returns null', () => {
    expect(detectTopologyQuestion('Why does my system sound thin?')).toBeNull();
  });
});

describe('getTopologyCapsule + listTopologyIds', () => {
  it('lists all expected topologies', () => {
    const ids = listTopologyIds();
    expect(ids).toContain('r2r');
    expect(ids).toContain('fpga');
    expect(ids).toContain('delta-sigma');
    expect(ids).toContain('set');
    expect(ids).toContain('push-pull-tube');
    expect(ids).toContain('class-a-solid-state');
    expect(ids).toContain('low-feedback');
    expect(ids).toContain('horn-high-efficiency');
    expect(ids).toContain('bbc-thin-wall');
    expect(ids).toContain('nos-dac');
  });

  it('every id resolves to a complete capsule', () => {
    for (const id of listTopologyIds()) {
      const c = getTopologyCapsule(id)!;
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.aliases.length).toBeGreaterThan(0);
      expect(c.mechanism.length).toBeGreaterThan(60);
      expect(c.tradeoffs.length).toBeGreaterThan(60);
      expect(c.behavior.length).toBeGreaterThan(40);
      expect(c.perception.length).toBeGreaterThan(60);
      expect(c.misconceptions.length).toBeGreaterThan(40);
      expect(c.pairingImplication.length).toBeGreaterThan(40);
      expect(c.canonicalExamples.length).toBeGreaterThan(0);
    }
  });

  it('canonical examples have no marketing fluff tokens', () => {
    // Specialist register guard — flag tokens that mark generic AI prose.
    const fluffPatterns = [
      /\bgame[- ]?changing\b/i,
      /\bbest in class\b/i,
      /\brevolutionary\b/i,
      /\bcutting[- ]edge\b/i,
      /\baudiophile dream\b/i,
    ];
    for (const id of listTopologyIds()) {
      const c = getTopologyCapsule(id)!;
      const allProse = [c.mechanism, c.tradeoffs, c.behavior, c.perception, c.misconceptions, c.pairingImplication].join(' ');
      for (const p of fluffPatterns) {
        expect(allProse).not.toMatch(p);
      }
    }
  });
});

describe('intent integration — topology questions route to audio_knowledge with capsule', () => {
  it('"Why do R2R DACs sound denser?" → audio_knowledge + r2r capsule', async () => {
    const { detectIntent } = await import('../intent');
    const r = detectIntent('Why do R2R DACs sound denser?');
    expect(r.intent).toBe('audio_knowledge');
    expect(r.topologyQuestion).toBeTruthy();
    expect(r.topologyQuestion!.capsule.id).toBe('r2r');
    expect(r.topologyQuestion!.shape).toBe('why');
  });

  it('"What is BBC thin-wall cabinet philosophy?" → audio_knowledge + bbc capsule', async () => {
    const { detectIntent } = await import('../intent');
    const r = detectIntent('What is BBC thin-wall cabinet philosophy?');
    expect(r.intent).toBe('audio_knowledge');
    expect(r.topologyQuestion?.capsule.id).toBe('bbc-thin-wall');
  });

  it('"Best R2R DAC under $1500" does NOT route to audio_knowledge', async () => {
    const { detectIntent } = await import('../intent');
    const r = detectIntent('Best R2R DAC under $1500');
    // Topology mention without question word — stays in shopping flow.
    expect(r.intent).not.toBe('audio_knowledge');
    expect(r.topologyQuestion).toBeFalsy();
  });
});

describe('buildTopologyExplainer — deterministic prose', () => {
  it('emits multi-paragraph specialist prose for R2R', () => {
    const c = getTopologyCapsule('r2r')!;
    const prose = buildTopologyExplainer(c, 'why');
    // Should be substantial (mechanism + tradeoffs + behavior + perception + misconceptions + pairing + examples)
    expect(prose.length).toBeGreaterThan(500);
    // Includes paragraph breaks
    expect(prose.split('\n\n').length).toBeGreaterThanOrEqual(5);
    // Includes canonical examples at the end
    expect(prose).toMatch(/canonical examples?:/i);
    // Specialist register markers
    expect(prose.toLowerCase()).toContain('r2r');
  });

  it('emits stable output across calls', () => {
    const c = getTopologyCapsule('fpga')!;
    expect(buildTopologyExplainer(c, 'why')).toBe(buildTopologyExplainer(c, 'why'));
  });

  it('shape variation changes only the opener', () => {
    const c = getTopologyCapsule('bbc-thin-wall')!;
    const why = buildTopologyExplainer(c, 'why');
    const what = buildTopologyExplainer(c, 'what');
    expect(why).not.toBe(what);
    // The rest of the explainer should be substantively the same length
    const whyMid = why.split('\n\n').slice(1).join('\n\n');
    const whatMid = what.split('\n\n').slice(1).join('\n\n');
    expect(whyMid).toBe(whatMid);
  });
});
