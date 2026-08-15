import { describe, it, expect } from 'vitest';
import {
  findLicensingViolations,
  buildLicensedProvisionalResponse,
} from '../llm-system-inference';

/**
 * D-7 in the provisional layer — real beta defect, second order (2026-08-15).
 *
 * After the labelled-graph repair, the engine correctly marked Butler Monads
 * and Acora QRC-2 as opaque nodes: named, role-placed, no brandProfile, no
 * invented character. Production then printed this anyway:
 *
 *   "The Butler Monad amplifiers are known for their hybrid design, blending
 *    tube and solid-state technologies... community consensus suggests..."
 *
 * for two components Audio XX has never heard of. The graph was honest and the
 * prose written from it was not.
 *
 * The cause was instructed, not accidental. The provisional prompt said
 * "Never fabricate specifications. Use known design heritage and community
 * consensus", and the user prompt told the model that uncatalogued components
 * meant "use general knowledge". The prompt predated the opaque-node rule.
 *
 * The prompt now states the licensing rule — but a prompt is a preference. The
 * check below is what makes it a guarantee, and it is the reason the model may
 * be trusted to write this prose at all: licensing is enforced downstream,
 * deterministically, on the model's output.
 */
const UNRESOLVED = ['Butler Monads', 'Acora QRC-2'];

describe('unlicensed claims about unresolved components are caught', () => {
  // The exact prose production emitted.
  const PRODUCTION_VIOLATION =
    'The Butler Monad amplifiers are known for their hybrid design, blending tube and '
    + 'solid-state technologies to offer a controlled yet organic sound. Acora QRC-2 '
    + 'speakers are typically noted for their use of substantial cabinet materials, '
    + 'providing an accurate and coherent sound that is both detailed and airy.';

  it('catches the exact production violation', () => {
    const v = findLicensingViolations(PRODUCTION_VIOLATION, UNRESOLVED);
    expect(v.map((x) => x.component).sort()).toEqual(['Acora QRC-2', 'Butler Monads']);
  });

  const CASES: Array<[string, string]> = [
    ['reputation', 'The Butler Monads are widely regarded as excellent.'],
    ['community consensus', 'Community consensus suggests the Butler Monads are strong performers.'],
    ['sonic character', 'The Acora QRC-2 delivers a warm, detailed presentation.'],
    ['axis placement', 'The Butler Monads sit toward the controlled end of the dynamic axis.'],
    ['topology', 'The Butler Monads use a hybrid tube and solid-state circuit.'],
    ['cabinet/driver', 'The Acora QRC-2 uses a granite cabinet with a soft-dome driver.'],
    ['known for', 'Acora QRC-2 is known for its spatial precision.'],
  ];
  for (const [label, prose] of CASES) {
    it(`catches ${label}`, () => {
      expect(findLicensingViolations(prose, UNRESOLVED).length).toBeGreaterThan(0);
    });
  }

  it('hedging does not launder the claim', () => {
    // "likely warm" and "reportedly warm" are the same violation as "warm".
    expect(findLicensingViolations('The Acora QRC-2 is likely quite warm.', UNRESOLVED).length)
      .toBeGreaterThan(0);
    expect(findLicensingViolations('The Acora QRC-2 is reportedly detailed.', UNRESOLVED).length)
      .toBeGreaterThan(0);
  });
});

describe('the rule does not suppress licensed or honest prose', () => {
  it('a disclaimer naming the component is not a violation', () => {
    const prose =
      'Butler Monads sits in the amplification position, but it is not in our catalog, '
      + 'so I have no verified data on how it behaves. Acora QRC-2 is likewise unresolved '
      + 'and I cannot assess it.';
    expect(findLicensingViolations(prose, UNRESOLVED)).toEqual([]);
  });

  it('structural reasoning about an unresolved position is allowed', () => {
    const prose =
      'Your chain runs from a preamplifier through Butler Monads into Acora QRC-2. '
      + 'I can place both, but not evaluate them.';
    expect(findLicensingViolations(prose, UNRESOLVED)).toEqual([]);
  });

  it('a RESOLVED component may be characterised in full', () => {
    // The dCS Bartok is catalogued; richer analysis must survive untouched.
    const prose = 'The dCS Bartok is transparent, controlled and spatially precise, with a '
      + 'neutral-to-cool balance from its Ring DAC topology.';
    expect(findLicensingViolations(prose, UNRESOLVED)).toEqual([]);
  });

  it('no unresolved components means nothing to enforce', () => {
    expect(findLicensingViolations('Anything at all, warm and tube-based.', [])).toEqual([]);
  });
});

describe('the licensed answer is honest, useful and never empty', () => {
  const BETA_NAMES = ['ARC ref 5', 'Butler Monads', 'dCS Rossini Apex', 'Acora QRC-2'];
  const BETA_UNRESOLVED = [
    { name: 'ARC ref 5', role: 'preamplifier' },
    { name: 'Butler Monads', role: 'amplifier' },
    { name: 'dCS Rossini Apex', role: 'dac' },
    { name: 'Acora QRC-2', role: 'speaker' },
  ];
  const r = buildLicensedProvisionalResponse(BETA_NAMES, [], BETA_UNRESOLVED);
  const prose = r.philosophy ?? '';

  it('names every component the listener supplied', () => {
    for (const n of BETA_NAMES) expect(prose).toContain(n);
  });

  it('states the role structure', () => {
    expect(prose).toMatch(/preamplification/);
    expect(prose).toMatch(/amplification/);
    expect(prose).toMatch(/loudspeaker position/);
  });

  it('states the coverage limit at the point where it matters', () => {
    expect(prose).toMatch(/no verified data/i);
  });

  it('is itself free of unlicensed claims', () => {
    expect(findLicensingViolations(prose, BETA_UNRESOLVED.map((u) => u.name))).toEqual([]);
  });

  it('is never an empty turn', () => {
    expect(prose.length).toBeGreaterThan(200);
    expect(r.followUp).toBeTruthy();
  });
});
