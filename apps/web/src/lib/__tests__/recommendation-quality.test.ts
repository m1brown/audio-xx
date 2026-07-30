/**
 * Product Quality Phase 2 — recommendation experience protections.
 *
 * 1. Facts are sacred: no card claim may contradict the catalog spec
 *    (production escape: Rotel A11 Tribute, Class AB, rendered with
 *    "Pure Class A bias" — substring bug 'class-ab'.includes('class-a')).
 * 2. No two cards explain themselves the same way (whyFitsSystem de-dup).
 * 3. Editorial language: no engine vocabulary in card trade-offs.
 * 4. Complete system: elision is transparent, never silent.
 */
import { describe, it, expect } from 'vitest';
import { cardFactViolations, detectShoppingIntent, buildShoppingAnswer, type ShoppingAnswer } from '@/lib/shopping-intent';
import { AMPLIFIER_PRODUCTS } from '@/lib/products/amplifiers';
import type { Product } from '@/lib/products/dacs';

const SIGNALS = { traits: {}, symptoms: [], direction: [], preserve: [], context: [] } as never;

/** Build a live answer through the public path for a given ask. */
function answerFor(utterance: string, system: string[] = ['Wharfedale Linton Heritage']): ShoppingAnswer {
  const ctx = detectShoppingIntent(utterance, SIGNALS, system, utterance);
  return buildShoppingAnswer(ctx, SIGNALS, undefined, undefined, system);
}

/** Every rendered card text checked against that card's own catalog facts. */
function factViolationsIn(answer: ShoppingAnswer): string[] {
  const out: string[] = [];
  for (const ex of answer.productExamples ?? []) {
    const shim = { topology: ex.catalogTopology, architecture: ex.catalogArchitecture, brand: ex.brand, name: ex.name } as Product;
    const texts = [ex.character ?? '', ...(ex.soundProfile ?? []), ...(ex.standoutFeatures ?? [])].filter(Boolean);
    for (const t of texts) {
      for (const v of cardFactViolations(shim, t)) out.push(`${ex.brand} ${ex.name}: "${t}" (${v})`);
    }
  }
  return out;
}

describe('facts are sacred — card fact consistency', () => {
  const a11 = AMPLIFIER_PRODUCTS.find((p) => p.name === 'A11 Tribute')!;

  it('the production escape: Class AB amp must never claim Pure Class A', () => {
    expect(a11.topology).toContain('class-ab');
    expect(cardFactViolations(a11, 'Pure Class A bias — effortless transients with no crossover artifacts.')).not.toHaveLength(0);
  });

  it('a genuine Class A claim on a Class A product is not a violation', () => {
    const classA = { topology: 'class-a-solid-state', architecture: 'Class A, 25W' } as Product;
    expect(cardFactViolations(classA, 'Pure Class A bias — effortless transients.')).toHaveLength(0);
  });

  it('tube claim on a solid-state product is a violation; hybrid is exempt', () => {
    const ss = { topology: 'class-ab-solid-state', architecture: 'Class AB' } as Product;
    const hybrid = { topology: 'hybrid', architecture: 'hybrid tube/solid-state' } as Product;
    expect(cardFactViolations(ss, 'Tube harmonic colour throughout.')).not.toHaveLength(0);
    expect(cardFactViolations(hybrid, 'Tube harmonic colour with solid-state grip.')).toHaveLength(0);
  });

  it('no rendered card contradicts its own catalog facts, across budget tiers', () => {
    const asks = [
      'What integrated amp should I get for around $700? I like a warm sound.',
      'What integrated amp should I get for around $1200? I like a warm, full-bodied sound.',
      'What integrated amp should I get for around $3000? I want precision and control.',
      'Recommend a DAC around $1000 with a natural, relaxed presentation.',
    ];
    for (const ask of asks) {
      expect(factViolationsIn(answerFor(ask)), ask).toEqual([]);
    }
  });

  it('curated catalog tendencies never contradict their own product spec', () => {
    for (const p of AMPLIFIER_PRODUCTS) {
      const tendencies = (p as Product & { tendencies?: { character?: Array<{ tendency: string }> } }).tendencies?.character ?? [];
      for (const t of tendencies) {
        expect(cardFactViolations(p, t.tendency), `${p.brand} ${p.name}: "${t.tendency}"`).toHaveLength(0);
      }
    }
  });
});

describe('no two cards explain themselves the same way', () => {
  it('shortlists never repeat a whyFitsSystem sentence verbatim', () => {
    const answer = answerFor('What integrated amp should I get for around $1200? I like a warm, full-bodied sound.');
    const whys = (answer.productExamples ?? [])
      .map((p) => p.systemDelta?.whyFitsSystem)
      .filter((w): w is string => !!w);
    expect(new Set(whys).size).toBe(whys.length);
  });
});

describe('listen first — stated preference is the starting point', () => {
  const WARM_ASK = "My amp died. What integrated amp should I get for around $1200? I like a warm, full-bodied sound.";

  it('captures statedPreferences from the current message (survives empty signals)', () => {
    const ctx = detectShoppingIntent(WARM_ASK, SIGNALS, ['Wharfedale Linton Heritage'], WARM_ASK);
    expect(ctx.statedPreferences?.some((d) => d.quality === 'warmth' && d.direction === 'more')).toBe(true);
  });

  it('never reports "missing: sonic preferences" after the user just stated them', () => {
    const answer = answerFor(WARM_ASK);
    expect(answer.statedGaps ?? []).not.toContain('taste');
  });

  it('never asks the taste question the user already answered', () => {
    const answer = answerFor(WARM_ASK);
    const prompts = (answer.refinementPrompts ?? []).join(' ') + (answer.tasteQuestion ?? '');
    expect(prompts).not.toMatch(/prefer more warmth and body, or more precision/);
  });

  it('warm request on a warm system → expert disagreement sentence, not silent override', () => {
    const answer = answerFor(WARM_ASK);
    // The adviser names the tension and explains the direction (founder pattern).
    expect(answer.bestFitDirection).toMatch(/You asked for more warmth/);
    expect(answer.bestFitDirection).toMatch(/already leans/);
    expect(answer.bestFitDirection).toMatch(/preserve the warmth/);
  });

  it('preference aligned with system (bright system, warm ask) → no tension sentence', () => {
    const ask = 'What integrated amp should I get for around $1200? I like a warm, full-bodied sound. My system sounds bright and harsh.';
    const answer = answerFor(ask, ['KEF R3']);
    expect(answer.bestFitDirection ?? '').not.toMatch(/You asked for more warmth — and your system already leans/);
  });
});

describe('editorial language — no engine vocabulary in card prose', () => {
  it('trade-offs never use the "deficit ... untouched" construction or "-leaning chain"', () => {
    const answer = answerFor('What integrated amp should I get for around $1200? I like a warm, full-bodied sound.');
    const allText = JSON.stringify(answer.productExamples ?? []);
    expect(allText).not.toMatch(/deficit in the surrounding setup untouched/);
    expect(allText).not.toMatch(/-leaning chain/); // user-facing "chain" retired in card posture prose
  });
});
