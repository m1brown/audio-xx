import { describe, it, expect } from 'vitest';
import { detectIntent } from '../intent';

/**
 * Founder-reported (2026-08-15): "is the Well Tempered Lab turntable any
 * good" produced generic component-character filler ("Every component has
 * a character…") under the subject "your question" — the named brand
 * vanished from its own answer.
 *
 * Cause was a number asymmetry in a shared trigger list. A routing-battery
 * fix on 2026-08-10 added the PLURAL opinion form (/are .+ any good/) but
 * not the singular. extractProductCandidateName is itself gated on those
 * patterns, so for the singular it returned null, gate 0a never
 * synthesized a subject, and the turn fell into gear_inquiry with nothing
 * to ground — where advisory-response.ts substitutes the literal string
 * 'your question' for a missing subject.
 *
 * The repair is to the shared pattern, not to the brand: number is not a
 * meaningful distinction in "is/are X any good". Every unknown product
 * asked about in the singular was affected; Well Tempered Lab was the one
 * someone happened to type.
 *
 * INVARIANT: when Audio XX cannot ground a product-specific judgment it
 * must acknowledge the named subject and degrade honestly. It must not
 * replace the subject with generic filler.
 */
const trace = (q: string) => {
  const d = detectIntent(q) as unknown as {
    intent: string;
    subjectMatches?: Array<{ name: string; kind: string }>;
  };
  return { intent: d.intent, subjects: d.subjectMatches ?? [] };
};

/** The failure mode: a gear turn with no subject at all renders as "your question". */
const isUngrounded = (q: string) => {
  const { intent, subjects } = trace(q);
  return intent === 'gear_inquiry' && subjects.length === 0;
};

describe('a named subject survives into its own answer', () => {
  const NAMED: string[] = [
    // the reported defect
    'is the Well Tempered Lab turntable any good',
    // adjacent phrasings that must behave identically
    'tell me about Well Tempered Lab',
    'what do you think of Well Tempered turntables?',
    'are the Well Tempered Lab turntables any good',
    // an entirely unknown brand — same path, no catalog presence at all
    'is the Zorblax 9000 turntable any good',
    'tell me about Zorblax Audio',
    // a known brand carrying zero catalog products
    'tell me about Aurender',
    // a fully covered product
    'is the Rega Planar 3 any good',
  ];
  for (const q of NAMED) {
    it(`"${q}" resolves a subject`, () => {
      const { subjects } = trace(q);
      expect(subjects.length).toBeGreaterThan(0);
    });
    it(`"${q}" does not fall through ungrounded`, () => {
      expect(isUngrounded(q)).toBe(false);
    });
  }

  it('the reported query names Well Tempered Lab as its subject', () => {
    const { subjects } = trace('is the Well Tempered Lab turntable any good');
    expect(subjects[0].name).toBe('Well Tempered Lab');
  });

  it('singular and plural of the same question agree', () => {
    const s = trace('is the Well Tempered Lab turntable any good');
    const p = trace('are the Well Tempered Lab turntables any good');
    expect(s.intent).toBe(p.intent);
    expect(s.subjects[0].name).toBe(p.subjects[0].name);
  });

  it('a covered product still routes to a grounded assessment with its catalog subject', () => {
    const { subjects } = trace('is the Rega Planar 3 any good');
    expect(subjects.map((s) => s.name)).toContain('planar 3');
  });
});

/**
 * The counter-pressure, and the reason this is a trigger repair rather
 * than a blanket "never emit a subject-less gear response" rule.
 *
 * Some questions are legitimately subject-less. "is a tube amp any good
 * for classical" names a topology, not a product, and generic
 * component-character guidance is the correct answer — there is no subject
 * being dropped. These must keep reaching the general path, and must not
 * be converted into "are you asking about the…?" clarifications.
 */
describe('genuinely subject-less questions keep their general answer', () => {
  const GENERAL = [
    'is a tube amp any good for classical',
    'what should I look for in a DAC',
    'recommend speakers',
  ];
  for (const q of GENERAL) {
    it(`"${q}" resolves no product subject`, () => {
      expect(trace(q).subjects.length).toBe(0);
    });
  }

  it('"is a tube amp any good for classical" is not treated as a named product', () => {
    expect(trace('is a tube amp any good for classical').intent).not.toBe('product_assessment');
  });
});
