import { describe, it, expect } from 'vitest';
import { extractSubjectMatches, detectIntent } from '@/lib/intent';
import { buildSystemAssessment } from '@/lib/consultation';
import { samePhysicalComponent, physicalIdentityKey } from '../physical-identity';

/**
 * ONE PHYSICAL COMPONENT → ONE CANONICAL NODE.
 *
 * Regardless of whether the evidence arrives from the active saved system,
 * prior conversation state, or the current message.
 *
 * Production, signed in, saved "Test system" active, listener types the same
 * four boxes: "dCS Rossini Apex and dCS Rossini Apex both appear as dacs. Are
 * both active in the signal path, or has one replaced the other?"
 *
 * The merge deduplicated on DISPLAY STRINGS. The saved side registered
 * "rossini apex" and "dcs"; the message side asked whether it had seen "dcs
 * rossini apex", which it had not. Neither string equality nor role equality
 * could catch that — both nodes had the same role, which is why the
 * duplicate-role validator was the thing that noticed. The invariant belongs
 * at identity.
 */

const NATHAN_MSG =
  'Assess my system: - Dac/Streamer: dCS Rossini Apex. - Pre-amp: ARC ref 5. '
  + '- Amps: Butler Monads. - Speakers: Acora QRC-2.';

const savedNathan = [
  { brand: 'dCS', name: 'Rossini Apex', category: 'dac' },
  { brand: 'ARC', name: 'ref', category: 'preamplifier' },
  { brand: 'Butler', name: 'Monads', category: 'amplifier' },
  { brand: 'Acora', name: 'QRC-2', category: 'speaker' },
];

const run = (message: string, components?: Array<Record<string, string>>) => {
  const { desires } = detectIntent(message) as never as { desires: unknown };
  const active = components
    ? ({ name: 'Test system', components } as never)
    : null;
  return buildSystemAssessment(
    message, extractSubjectMatches(message), active, desires as never,
  ) as never as {
    kind?: string;
    components?: Array<{ displayName: string; role: string }>;
    clarification?: { question?: string };
  };
};

const names = (r: ReturnType<typeof run>) => (r.components ?? []).map((c) => c.displayName);
const dacs = (r: ReturnType<typeof run>) =>
  (r.components ?? []).filter((c) => /dac|streamer/.test(c.role)).length;

describe('the identity key is canonical, not a display string', () => {
  it('reconciles a saved split brand/name with a typed full name', () => {
    expect(samePhysicalComponent(
      { brand: 'dCS', name: 'Rossini Apex' }, { brand: '', name: 'dCS Rossini Apex' },
    )).toBe(true);
  });

  it('ignores case, punctuation and separators', () => {
    expect(physicalIdentityKey('', 'Acora QRC-2'))
      .toBe(physicalIdentityKey('', 'acora  qrc 2'));
  });

  it('does NOT let a bare brand swallow a product', () => {
    // A listener who names only a brand must not silently inherit a saved
    // component's identity.
    expect(samePhysicalComponent(
      { brand: '', name: 'dCS' }, { brand: '', name: 'dCS Rossini Apex' },
    )).toBe(false);
  });

  it('keeps genuinely different variants apart', () => {
    // The mirror of this defect would be merging two boxes that are two.
    expect(samePhysicalComponent(
      { brand: 'Leben', name: 'CS600' }, { brand: 'Leben', name: 'CS600X' },
    )).toBe(false);
  });
});

describe('an explicitly supplied system is authoritative', () => {
  it('saved Nathan + typed identical Nathan → four nodes, no clarification', () => {
    const r = run(NATHAN_MSG, savedNathan);
    expect(r.components).toHaveLength(4);
    expect(dacs(r)).toBe(1);
    expect(r.clarification?.question ?? '').not.toMatch(/both appear as/i);
  });

  it('the same system in different words is still four', () => {
    const r = run(
      'Assess my system: Dac/Streamer: dCS Rossini Apex, Pre-amp: ARC Reference 5, '
      + 'Power amp: Butler MONAD A100, Speakers: Acora QRC-2',
      savedNathan,
    );
    expect(r.components ?? []).toHaveLength(4);
    expect(dacs(r)).toBe(1);
  });

  it('saved full name + typed short name → one node', () => {
    const r = run(
      'Assess my system: Dac: Rossini Apex, Amp: Butler Monads, Speakers: Acora QRC-2',
      [{ brand: 'dCS', name: 'dCS Rossini Apex', category: 'dac' }, ...savedNathan.slice(2)],
    );
    expect(dacs(r)).toBe(1);
  });

  it('saved "ARC Reference 5" + typed "ARC ref 5" → one node', () => {
    const r = run(NATHAN_MSG, [
      { brand: 'Audio Research', name: 'ARC Reference 5', category: 'preamplifier' },
      ...savedNathan.filter((c) => c.brand !== 'ARC'),
    ]);
    const preamps = (r.components ?? []).filter((c) => /preamp/.test(c.role));
    expect(preamps).toHaveLength(1);
  });

  it('an active FRANCE system does not contaminate an explicit Nathan', () => {
    const r = run(NATHAN_MSG, [
      { brand: 'Eversolo', name: 'DMP-A6', category: 'streamer' },
      { brand: 'JOB', name: 'INTegrated', category: 'integrated' },
      { brand: 'WLM', name: 'Diva Monitor', category: 'speaker' },
    ]);
    const joined = names(r).join(' ').toLowerCase();
    expect(joined).not.toMatch(/eversolo|diva|job/);
    expect(r.components).toHaveLength(4);
  });
});

describe('saved context still works where the message does not override it', () => {
  it('a genuine second DAC is still two DACs', () => {
    // Reconciliation must not collapse products that differ. A listener who
    // really runs two converters gets two nodes, and the clarification that
    // goes with them.
    const r = run(
      'Assess my system: dCS Rossini Apex and Chord Qutest both as dacs, '
      + 'Butler Monads, Acora QRC-2',
      savedNathan,
    );
    expect(dacs(r)).toBeGreaterThanOrEqual(2);
  });

  it('a replacement names the new component, not both', () => {
    const r = run(
      'Assess my system: Dac: dCS Bartok, Pre-amp: ARC ref 5, '
      + 'Amps: Butler Monads, Speakers: Acora QRC-2',
      savedNathan,
    );
    const joined = names(r).join(' ').toLowerCase();
    expect(joined).toMatch(/bartok/);
    expect(dacs(r)).toBe(1);
  });

  it('components the message never mentions are not injected', () => {
    // The mention guard predates this fix and must survive it: a saved
    // component absent from the message is context, not a silent addition.
    const r = run('Assess my system: Amp: Butler Monads, Speakers: Acora QRC-2', savedNathan);
    expect(names(r).join(' ').toLowerCase()).not.toMatch(/rossini/);
  });
});

describe('a model number is not a list marker', () => {
  /**
   * "- Pre-amp: ARC Reference 5. - Speakers: Acora QRC-2" ends its first item
   * with a model number and a full stop — character-for-character what a
   * numbered marker looks like. The boundary matched at "5." and production
   * rendered the preamplifier as "ARC Reference", which also cost it the three
   * specifications the store holds under "arc reference 5". A truncated
   * identity finds no evidence.
   *
   * The discriminator is what FOLLOWS: a marker introduces an item, so content
   * comes after it; a model number ends one, so a bullet does.
   */
  const preampName = (msg: string) => {
    const r = run(msg);
    return (r.components ?? []).find((c) => /preamp/.test(c.role))?.displayName ?? '';
  };

  it('keeps the number when a bullet opens the next item', () => {
    expect(preampName(
      'Assess my system: - Dac: dCS Rossini Apex. - Pre-amp: ARC Reference 5. '
      + '- Amps: Butler MONAD A100. - Speakers: Acora QRC-2.',
    )).toMatch(/Reference 5$/);
  });

  it('keeps it without the full stop too', () => {
    expect(preampName(
      'Assess my system: Dac: dCS Rossini Apex, Pre-amp: ARC Reference 5, '
      + 'Amps: Butler MONAD A100, Speakers: Acora QRC-2',
    )).toMatch(/Reference 5$/);
  });

  it('strips the terminal full stop from the model', () => {
    expect(preampName(
      'Assess my system: - Pre-amp: ARC Reference 5. - Speakers: Acora QRC-2.',
    )).not.toMatch(/\.$/);
  });

  it('still truncates a genuine numbered marker', () => {
    // "1. Pre-amp: ARC ref 5 2. Amps: ..." — "2." introduces an item, so it is
    // a marker and the preamp name must not swallow it.
    const r = run(
      'Assess my system: 1. Pre-amp: ARC ref 5 2. Amps: Butler MONAD A100 '
      + '3. Speakers: Acora QRC-2',
    );
    const pre = (r.components ?? []).find((c) => /preamp/.test(c.role))?.displayName ?? '';
    expect(pre).not.toMatch(/\b2\b\s*$/);
  });
});

describe('a saved system injected as TEXT reconciles too', () => {
  /**
   * The saved system reaches the engine two ways. As `activeSystem`, which the
   * seeding guard reconciles — and as synthetic TEXT prepended to the
   * accumulated message ("My system: dCS Rossini Apex, ARC ref, ..."), which
   * bypasses that guard entirely: by the time the parser runs it is just more
   * prose, and the listener's own turn names the same four boxes again.
   *
   * Signed-in production: the graph carried "ARC ref" from the injection and
   * "ARC ref 5" from the message, and Audio XX asked which components it could
   * not match while listing all four as recognised.
   *
   * One physical component, one node — regardless of source.
   */
  const SEP = String.fromCharCode(0x1e);
  const injected = 'My system: dCS Rossini Apex, ARC ref, Butler Monads, Acora QRC-2.';
  const typed = 'Assess my system: - Dac/Streamer: dCS Rossini Apex. - Pre-amp: ARC ref 5. '
    + '- Amps: Butler Monads. - Speakers: Acora QRC-2.';

  const r = run(`${injected}${SEP}${typed}`, savedNathan);

  it('produces four nodes, not eight', () => {
    expect(r.components ?? []).toHaveLength(4);
  });

  it('asks no clarification at all', () => {
    // It previously asked how many components it could not match — while
    // listing every one of them as recognised.
    expect(r.kind).not.toBe('clarification');
    expect(r.clarification?.question ?? '').toBe('');
  });

  it('keeps the better-specified spelling of the shared box', () => {
    const pre = (r.components ?? []).find((c) => /preamp/.test(c.role))?.displayName ?? '';
    expect(pre).toMatch(/ref 5/);
  });

  it('counts one mention per physical box across turns', () => {
    // The expected-vs-resolved gate ran on wording, so "ARC ref" and "ARC ref
    // 5" counted as two boxes and the expected total ran ahead of the graph.
    expect(dacs(r)).toBe(1);
  });
});
