import { describe, it, expect } from 'vitest';
import { composeSystemReview } from '../system-review';
import type { DossierView } from '@/lib/evidence/dossier-presentation';

/**
 * LENGTH IS AN OUTPUT OF THE EVIDENCE.
 *
 * The review must get richer where more is held and shorter where less is —
 * and it must never contain a sentence that survives the removal of the facts
 * that licensed it. That property is what separates "a substantial review"
 * from "a padded one", and it is the only thing these tests really check.
 */

const dcs: DossierView = {
  displayName: 'dCS Rossini Apex',
  primary: [{ label: 'independent review', value: 'Stereophile' }],
  secondary: [
    { label: 'Stereophile', value: 'deeper silences — only direct A/B comparison with earlier Rossini DAC under same setup', publication: 'Stereophile', sourceClass: 'listening_observation' },
    { label: 'Stereophile', value: 'more saturated colors — only comparison between Ethernet input and USB input', publication: 'Stereophile', sourceClass: 'listening_observation' },
  ],
  gaps: [], hasDetail: true,
};

const arc: DossierView = {
  displayName: 'ARC ref 5',
  primary: [],
  secondary: [{ label: 'tube complement', value: '(4)-6H30P dual triodes', sourceClass: 'third_party_reported' }],
  gaps: [], hasDetail: true,
};

const butler: DossierView = {
  displayName: 'Butler Monads',
  primary: [{ label: 'power output', value: 'Minimum 100 Watts RMS @ 8 Ohms; 200 Watts, RMS typical @ 4 Ohms', sourceClass: 'maker_published' }],
  secondary: [{ label: 'tube complement', value: 'Butler Model 300B directly heated power triode', sourceClass: 'maker_published' }],
  gaps: [], hasDetail: true,
};

const acora: DossierView = {
  displayName: 'Acora QRC-2',
  primary: [
    { label: 'impedance', value: '4 ohm', sourceClass: 'maker_published' },
    { label: 'power handling', value: '10 W – 250 W', sourceClass: 'maker_published' },
    { label: 'drivers', value: '7" Sandwich Paper Cone (2); 1" Beryllium Dome Tweeter', sourceClass: 'maker_published' },
  ],
  secondary: [], gaps: ['the published sensitivity figure'], hasDetail: false,
};

const NATHAN = {
  components: [
    { displayName: 'dCS Rossini Apex', role: 'dac' },
    { displayName: 'ARC ref 5', role: 'preamplifier' },
    { displayName: 'Butler Monads', role: 'amplifier' },
    { displayName: 'Acora QRC-2', role: 'speaker' },
  ],
  dossiers: [dcs, arc, butler, acora],
  driveFinding: 'Published figures put the Butler Monads at 200 watts into 4 ohms.',
  driveQualification: "The Acora QRC-2's sensitivity is not published.",
  coverageNote: 'Audio XX does not hold enough product-specific listening evidence.',
};

const joined = (i: Parameters<typeof composeSystemReview>[0]) =>
  composeSystemReview(i).join('\n\n');

describe('every paragraph is licensed by facts that are actually held', () => {
  it('produces a substantial review for a well-evidenced system', () => {
    const paras = composeSystemReview(NATHAN);
    expect(paras.length).toBeGreaterThanOrEqual(5);
  });

  it('the chain architecture disappears without the roles', () => {
    const out = joined({ ...NATHAN, components: [] });
    expect(out).not.toMatch(/keeps every stage separate/);
  });

  it('the two-valve-stage statement disappears without tube complements', () => {
    const noTubes = joined({
      ...NATHAN,
      dossiers: [dcs, { ...arc, secondary: [] }, { ...butler, secondary: [] }, acora],
    });
    expect(noTubes).not.toMatch(/vacuum tubes twice/);
  });

  it('the power-window relation disappears without the loudspeaker rating', () => {
    const out = joined({ ...NATHAN, dossiers: [dcs, arc, butler, { ...acora, primary: acora.primary.filter((l) => l.label !== 'power handling') }] });
    expect(out).not.toMatch(/sits inside the window/);
  });

  it('the conditioned-observation paragraph disappears without observations', () => {
    const out = joined({ ...NATHAN, dossiers: [{ ...dcs, secondary: [] }, arc, butler, acora] });
    expect(out).not.toMatch(/evidence about a DIFFERENCE/);
  });

  it('the gap paragraph disappears when nothing is missing', () => {
    const out = joined({ ...NATHAN, dossiers: [dcs, arc, butler, { ...acora, gaps: [] }] });
    expect(out).not.toMatch(/The gap is narrow/);
  });

  it('an empty system yields an empty review, not a reassuring one', () => {
    expect(composeSystemReview({ components: [], dossiers: [] })).toEqual([]);
  });
});

describe('the review reasons ACROSS facts rather than restating them', () => {
  it('relates the amplifier output to the loudspeaker rating — a new conclusion', () => {
    const out = joined(NATHAN);
    // Neither dossier says this; it exists only by putting two figures together.
    // Wording changed by the D-7 audit: "comfortably within it" implied an
    // easy match, which two published numbers do not license. The claim is now
    // explicitly about published LIMITS, not about difficulty.
    expect(out).toMatch(/within the limits both makers state/);
    expect(out).toMatch(/not that the match is an easy one/);
  });

  it('separates electrical suitability from loudness capability', () => {
    const out = joined(NATHAN);
    expect(out).toMatch(/Suitability and loudness are two different questions/i);
    expect(out).toMatch(/sensitivity/i);
  });

  it('says what conditioned observations do NOT establish', () => {
    const out = joined(NATHAN);
    expect(out).toMatch(/not a description of how the unit sounds/i);
    expect(out).toMatch(/supports nothing about the other components/i);
  });
});

describe('the review never exceeds its licence', () => {
  const out = joined(NATHAN);

  it('predicts no tonal character for the system', () => {
    for (const claim of [
      /the system will sound/i, /you will hear/i,
      /warm and detailed/i, /musical and engaging/i, /synerg/i,
    ]) expect(out, String(claim)).not.toMatch(claim);
  });

  it('never compares bandwidths across component types', () => {
    // An amplifier's ±0.6 dB window and a loudspeaker's response are different
    // measurements; setting them side by side implies a commensurability that
    // typed quantities exist to deny.
    expect(out).not.toMatch(/20\s*-\s*20,?000\s*Hz.*29\s*Hz/s);
    expect(out).not.toMatch(/wider bandwidth|narrowest bandwidth|extends lower than/i);
  });

  it('attributes listening evidence to its publication and its scope', () => {
    expect(out).toMatch(/Stereophile/);
    expect(out).toMatch(/dCS Rossini Apex/);
  });

  it('marks the architecture claim as architecture, not sound', () => {
    expect(out).toMatch(/architectural fact about the chain, not a prediction/i);
  });
});

describe('other systems get their own shape, not Nathan\'s', () => {
  it('a two-box system with no tubes and no reviews still reviews what it holds', () => {
    const paras = composeSystemReview({
      components: [
        { displayName: 'Leben CS600X', role: 'integrated' },
        { displayName: 'Klipsch Cornwall IV', role: 'speaker' },
      ],
      dossiers: [
        { displayName: 'Leben CS600X', primary: [{ label: 'power output', value: '32 Watts @ 8 Ohms' }], secondary: [], gaps: [], hasDetail: false },
        { displayName: 'Klipsch Cornwall IV', primary: [{ label: 'impedance', value: '8 ohm' }], secondary: [], gaps: [], hasDetail: false },
      ],
    });
    const text = paras.join(' ');
    // No preamp/source, so no chain-separation claim; no tubes, no valve claim.
    expect(text).not.toMatch(/keeps every stage separate/);
    expect(text).not.toMatch(/vacuum tubes twice/);
    // And crucially it does not manufacture length to match Nathan.
    expect(paras.length).toBeLessThan(5);
  });
});

describe('the review never repeats what the document already renders', () => {
  it('does not restate the verdict or the qualification verbatim', () => {
    // Both are rendered in large type directly above this section. Saying them
    // again reads as padding, and padding is what the founder asked not to add.
    const out = joined(NATHAN);
    expect(out).not.toContain(NATHAN.driveFinding);
    expect(out).not.toContain(NATHAN.driveQualification);
  });

  it('but still reasons FROM them', () => {
    // The power-window paragraph exists only because the drive finding did.
    const out = joined(NATHAN);
    expect(out).toMatch(/within the limits both makers state/);
  });
});

describe('the review compares LIKE conditions', () => {
  const multi: DossierView = {
    displayName: 'Butler Monads',
    primary: [{
      label: 'power output',
      // The maker publishes a MINIMUM and a TYPICAL at 8 ohms, and a typical
      // at 4. Reading the first match picks minimum-vs-typical, which would
      // report an amplifier doubling its power when like-for-like says 1.6x.
      value: 'Minimum 100 Watts RMS @ 8 Ohms; 128 Watts, RMS typical @ 8 Ohms; 200 Watts, RMS typical @ 4 Ohms',
      sourceClass: 'maker_published',
    }],
    secondary: [], gaps: [], hasDetail: false,
  };

  const out = composeSystemReview({ ...NATHAN, dossiers: [dcs, arc, multi, acora] }).join('\n\n');

  it('compares typical to typical, not minimum to typical', () => {
    expect(out).toMatch(/128 watts into 8 ohms becomes 200 into 4/);
    expect(out).not.toMatch(/100 watts into 8 ohms/);
  });

  it('states the ratio it actually computed', () => {
    expect(out).toMatch(/about 1\.6×/);
    // It must not CLAIM the amplifier doubles. Naming doubling as the thing
    // that did not happen — "rather than the doubling an ideal voltage source
    // would manage" — is the point of the sentence.
    expect(out).not.toMatch(/the amplifier doubles|output doubles|doubles its (?:power|output)/i);
  });

  it('stops at the electrical statement — no sonic consequence is claimed', () => {
    expect(out).not.toMatch(/will sound|bass will|grip|slam|control of the woofer/i);
  });

  it('D-7: nominal impedance never establishes electrical DIFFICULTY', () => {
    // A nominal impedance is one summary number. It does not establish minimum
    // impedance, phase angle, or current drawn across the real curve — so it
    // cannot license "demanding", "current hungry", "easy" or "hard".
    for (const overclaim of [
      /demand for current rather than for voltage/i,
      /current[- ]hungry/i, /difficult load/i, /demanding load/i,
      /easy to drive/i, /hard to drive/i, /punishing/i,
    ]) expect(out, String(overclaim)).not.toMatch(overclaim);
  });

  it('D-7: says explicitly what a nominal figure cannot establish', () => {
    expect(out).toMatch(/nominal figure does not establish is how demanding/i);
    expect(out).toMatch(/impedance minimum and phase behaviour/i);
  });

  it('D-7: never claims the lower-impedance reading flatters the pairing', () => {
    // It was backwards. Butler's 8-ohm figure is LOWER than its 4-ohm figure,
    // so reading the 8-ohm one understates the output into this loudspeaker.
    expect(out).not.toMatch(/would flatter the pairing/i);
  });

  it('makes no unlicensed generalisation about the amplifier class', () => {
    expect(out).not.toMatch(/ordinary for the type|typical of such designs|most amplifiers/i);
  });
});

describe('the review never asserts a specification in order to contrast with it', () => {
  const spk8: DossierView = {
    displayName: 'Klipsch Cornwall IV',
    primary: [
      { label: 'impedance', value: '8 ohm', sourceClass: 'maker_published' },
      { label: 'power handling', value: '10 W - 150 W', sourceClass: 'maker_published' },
    ],
    secondary: [], gaps: [], hasDetail: false,
  };
  const amp8: DossierView = {
    displayName: 'Leben CS600X',
    primary: [{ label: 'power output', value: '32 Watts @ 8 Ohms', sourceClass: 'maker_published' }],
    secondary: [], gaps: [], hasDetail: false,
  };

  const out = composeSystemReview({
    components: [
      { displayName: 'Leben CS600X', role: 'integrated' },
      { displayName: 'Klipsch Cornwall IV', role: 'speaker' },
    ],
    dossiers: [amp8, spk8],
  }).join('\n\n');

  it('D-7: invents no figure at a load the maker never published', () => {
    // The contrast clause was computed as `ohms * 2` from the LOUDSPEAKER's
    // load alone, so an 8-ohm speaker produced "rather than the 16-ohm figure
    // quoted first on most specification sheets" — a specification no maker
    // publishes and this one certainly had not.
    expect(out).not.toMatch(/16-ohm/);
    expect(out).not.toMatch(/quoted first on most specification sheets/);
  });

  it('still states which figure applies', () => {
    expect(out).toMatch(/the maker's 8-ohm figure is the one to read here\./);
  });

  it('names the other figure when the maker really does publish one', () => {
    const out4 = joined(NATHAN);
    expect(out4).toMatch(/rather than the 8-ohm figure the same specification also states/);
  });
});

describe('a figure at SOME load does not license a claim about THIS load', () => {
  /**
   * Production, 25 August 2026: a Leben CS600 against a Klipsch Cornwall IV
   * printed "the maker's 8-ohm figure is the one to read here" three lines
   * above "no published output figure at 8 ohms". Leben states "32W x 2
   * (6L6GC) at 1KHz" — watts with no load at all — so the first sentence was
   * the false one. The paragraph is licensed by a figure AT THAT LOAD.
   */
  const spk8: DossierView = {
    displayName: 'Klipsch Cornwall IV',
    primary: [{ label: 'impedance', value: '8 ohm', sourceClass: 'maker_published' }],
    secondary: [], gaps: [], hasDetail: false,
  };
  const ampNoLoad: DossierView = {
    displayName: 'Leben CS600',
    primary: [{
      label: 'power output',
      value: '32W x 2 (6L6GC) at 1KHz; 28W x 2 (EL34) at 1KHz',
      sourceClass: 'maker_published',
    }],
    secondary: [], gaps: [], hasDetail: false,
  };

  const out = composeSystemReview({
    components: [
      { displayName: 'Leben CS600', role: 'integrated' },
      { displayName: 'Klipsch Cornwall IV', role: 'speaker' },
    ],
    dossiers: [ampNoLoad, spk8],
  }).join('\n\n');

  it('does not claim a figure at the loudspeaker load exists', () => {
    expect(out).not.toMatch(/8-ohm figure is the one to read/);
  });

  it('makes no power claim at all from a load-less figure', () => {
    expect(out).not.toMatch(/within the limits both makers state/);
    expect(out).not.toMatch(/do not meet/);
  });

  it('produces nothing at all rather than something weaker', () => {
    // These two dossiers hold a load-less power figure and a nominal
    // impedance. Nothing relates them, so the correct output is no review —
    // not a hedged sentence gesturing at a comparison that cannot be made.
    // In production this same system DOES get a review, because Leben's
    // dossier also holds a tube complement, and that licenses a different
    // paragraph entirely.
    expect(out).toBe('');
  });
});
