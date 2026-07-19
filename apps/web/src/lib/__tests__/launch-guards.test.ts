/**
 * Launch guards (MVP gate, 2026-07-19) — the small set of tests that pin
 * the launch-condition behaviour. Each one exists because its failure
 * mode was graded a launch blocker in the MVP readiness review.
 */
import { describe, it, expect } from 'vitest';
import { detectIntent } from '../intent';
import { detectShoppingIntent, buildShoppingAnswer } from '../shopping-intent';
import { buildSystemAssessment } from '../consultation';
import { findProductByComponentName } from '../catalog/lookups';
import { processText } from '../engine';
import { reason } from '../reasoning';

function shop(q: string) {
  const signals = processText(q);
  const ctx = detectShoppingIntent(q, signals);
  const reasoning = reason(q, [], signals, null, ctx, undefined);
  return buildShoppingAnswer(ctx, signals, undefined, reasoning);
}

function assess(msg: string) {
  const { subjectMatches, desires } = detectIntent(msg);
  return buildSystemAssessment(msg, subjectMatches, null, desires);
}

// ── Blocker 1: shopping price/use-case guard ────────────────────────

describe('shopping guard — no absurd anchors on cold/lifestyle queries', () => {
  it('lifestyle/mismatch queries decline shopping (knowledge lane answers)', () => {
    for (const q of [
      'best headphones for the gym',
      'I want a record player with built in speakers',
      'interested in a phono preamp',
    ]) {
      expect(detectIntent(q).intent, q).toBe('audio_knowledge');
    }
  });

  it('"best used amplifier bargains" never surfaces $10k+ gear', () => {
    const a = shop('What are the best used amplifier bargains right now?');
    for (const p of a.productExamples) {
      expect(p.price, `${p.brand} ${p.name}`).toBeLessThan(10000);
    }
  });

  it('cold amplifier query for LS50 excludes low-watt SETs and $10k+ anchors', () => {
    const a = shop('amp for kef ls50 meta pls');
    for (const p of a.productExamples) {
      expect(p.price, `${p.brand} ${p.name}`).toBeLessThan(10000);
      expect((p.topology ?? '').toLowerCase().includes('set'), `${p.name} is a SET`).toBe(false);
    }
  });

  it('prestige cue lifts the mainstream ceiling', () => {
    const ctx = detectShoppingIntent('recommend a high-end reference amplifier, cost no object', processText('recommend a high-end reference amplifier, cost no object'));
    expect(ctx.prestigeIntent).toBe(true);
  });
});

// ── Blocker 3: concept/power questions route to the knowledge lane ──

describe('routing guard — concept and power questions reach the knowledge lane', () => {
  for (const q of [
    'Can my Naim Nait 50 drive Falcon LS3/5a speakers?',
    'Is a Pass XA25 enough power for Magnepan LRS+?',
    'Is a streamer upgrade audible if I already have a good DAC?',
    'Should I add a subwoofer or upgrade my bookshelf speakers?',
  ]) {
    it(`"${q.slice(0, 55)}" → audio_knowledge`, () => {
      expect(detectIntent(q).intent).toBe('audio_knowledge');
    });
  }

  it('symptom complaints still route to diagnosis, not knowledge', () => {
    expect(detectIntent('my system sounds harsh').intent).toBe('diagnosis');
  });
});

// ── Blocker 2: assessment consistency gates ─────────────────────────

describe('assessment consistency — no self-contradiction on screen', () => {
  it('"no obvious weak point" never co-occurs with a change verdict', () => {
    // The SA-12 chain: balanced-identity fallback + speaker leverage.
    const r = assess('Assess my system: Rega Aethos, Harbeth C7ES-3, Chord Qutest');
    if (r?.kind === 'assessment') {
      const t = r.response.systemContext ?? '';
      const balanced = t.includes('no obvious weak point');
      const change = /Primary leverage\*\*\n\nThe (?:dac|amplifier|speaker)/i.test(t)
        && !/no obvious bottleneck/i.test(t);
      expect(balanced && change).toBe(false);
    }
  });
});

// ── Phase 2A/2B knowledge surfacing (previously untested) ───────────

describe('knowledge surfacing — alias resolution and evidence', () => {
  it('SHL5+ owner shorthand resolves to the full product entry', () => {
    expect(findProductByComponentName('Harbeth SHL5+')?.id).toBe('harbeth-shl5-plus');
    expect(findProductByComponentName('Naim SuperNait')?.id).toBe('naim-supernait-3');
  });

  it('Leben + DeVore surfaces the documented pairing', () => {
    const r = assess('Assess my system: Denafrips Pontus II, Leben CS600X, DeVore O/96');
    expect(r?.kind).toBe('assessment');
    if (r?.kind === 'assessment') {
      expect(r.response.systemContext).toMatch(/documented match/);
    }
  });

  it('transparency-declared amp is never the tonal bottleneck', () => {
    const r = assess('Assess my system: Benchmark AHB2, KEF LS50 Meta');
    if (r?.kind === 'assessment') {
      const t = r.response.systemContext ?? '';
      expect(/Benchmark AHB2 limits tonal/i.test(t)).toBe(false);
    }
  });
});

// ── Editorial guards — banned vocabulary stays gone ─────────────────

describe('editorial guard — internal taxonomy and certainty stay out of prose', () => {
  const BANNED = /control emphasis|detail emphasis|detail-first system|tone-first system|microdetail|no dominant bias|prioritising tonal|dominate throughout|signal-flow order/i;
  for (const msg of [
    'Assess my system: Harbeth SHL5+, Hegel H190, Bluesound Node',
    'Assess my system: Chord Hugo, Job integrated, WLM Diva Monitor',
    'Assess my system: Rega Planar 3, Rega io, Wharfedale Linton',
  ]) {
    it(`no banned phrases: "${msg.slice(18, 60)}"`, () => {
      const r = assess(msg);
      if (r?.kind === 'assessment') {
        const all = JSON.stringify(r.response);
        expect(BANNED.test(all)).toBe(false);
      }
    });
  }
});
