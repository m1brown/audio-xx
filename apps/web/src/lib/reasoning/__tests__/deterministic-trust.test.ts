/**
 * Deterministic trust enforcement — pins (M1 quality correction).
 *
 * These are the guarantees the adversarial review found missing from
 * production: a hedge never licenses a figure; evidence voice requires
 * evidence; and product identifiers are never mistaken for quantities
 * (blocking them would block the bounded-knowledge candidate naming the
 * B2 licence exists to permit).
 */
import { describe, it, expect } from 'vitest';
import {
  deterministicTrustCheck,
  quantitativeFigures,
  wattLoadPairs,
} from '../deterministic-trust';

const CTX = `ACTIVE SYSTEM (saved — persisted; the real system unless the user explicitly changes it)
- Accuphase E-600 — amplifier
- Harbeth SHL5 Plus — speaker

LICENSED EVIDENCE (each item carries its class; nothing outside this list is an established product fact)

## System component: Accuphase E-600 — amplifier
- [MAKER-PUBLISHED] rated output: 30 W/ch (8 ohms), 60 W/ch (4 ohms), 120 W/ch (2 ohms) (source: https://www.accuphase.com)

## System component: Harbeth SHL5 Plus — speaker
- [THIRD-PARTY-REPORTED] sensitivity: 86dB/2.83V/1m (maker's claim as reported)
- [INDEPENDENT LISTENING — HiFi Critic] measurement: bass alignment measured mildly underdamped; condition: on its sample

## Candidate (not part of the saved system): leben cs-600
- No licensed evidence held for this exact product. Its sonic character and specifications are UNKNOWN to this application.`;

const CONV = 'user: I sit about nine feet away.\nuser: what about the leben cs-600?';

describe('watt/load pairing — a hedge never licenses a figure', () => {
  it('A: "could deliver 90 watts into 4 ohms" with no source → violation', () => {
    const r = deterministicTrustCheck(
      'The Leben CS-600 could deliver 90 watts into 4 ohms.', CTX, CONV);
    expect(r.unlicensedWattLoad.length).toBe(1);
    expect(r.clean).toBe(false);
  });

  it('B: "may deliver 90 watts into 4 ohms" → violation (hedge irrelevant)', () => {
    const r = deterministicTrustCheck(
      'The Leben CS-600 may deliver 90 watts into 4 ohms, which would suit these speakers.', CTX, CONV);
    expect(r.unlicensedWattLoad.length).toBe(1);
    expect(r.clean).toBe(false);
  });

  it('licensed restatement of the package ladder passes, paren connective included', () => {
    const r = deterministicTrustCheck(
      'The E-600 gives 30 W/ch (8 ohms), doubling to 60 W/ch (4 ohms).', CTX, CONV);
    expect(r.unlicensedWattLoad).toEqual([]);
    expect(r.strayFigures).toEqual([]);
    expect(r.clean).toBe(true);
  });

  it('a shifted pairing of licensed numbers is still unlicensed', () => {
    // 60 and 8 both appear in the package — but never as "60 W into 8".
    expect(wattLoadPairs('It makes 60 watts into 8 ohms.')[0]).toBeTruthy();
    const r = deterministicTrustCheck('It makes 60 watts into 8 ohms.', CTX, CONV);
    expect(r.unlicensedWattLoad.length).toBe(1);
  });
});

describe('stray figures — quantities need a source; identifiers are not quantities', () => {
  it('an invented sensitivity figure is caught, unit-suffixed form included', () => {
    const r = deterministicTrustCheck('Its sensitivity is around 87dB.', CTX, CONV);
    expect(r.strayFigures).toContain('87');
  });

  it('listener-stated numbers are licensed (their words are theirs)', () => {
    const r = deterministicTrustCheck(
      'At nine feet, roughly 9 feet as you say, level demands stay modest.', CTX, CONV);
    expect(r.strayFigures).toEqual([]);
  });

  it('model designators are identifiers, never stray figures', () => {
    // CS-600, H190, EX-M1, ES9038Q2M — digits inside product names must
    // not block bounded-knowledge candidate naming.
    const r = deterministicTrustCheck(
      'Worth comparing the Leben CS-600, the Hegel H190, and the Kinki EX-M1.', CTX, CONV);
    expect(r.strayFigures).toEqual([]);
    expect(r.unlicensedWattLoad).toEqual([]);
  });

  it('single digits (list numbering, counts) are ignored', () => {
    const r = deterministicTrustCheck('1. First option. 2. Second of 3 options.', CTX, CONV);
    expect(r.strayFigures).toEqual([]);
  });

  it('quantitativeFigures separates $ and unit forms', () => {
    expect(quantitativeFigures('It costs $1,450 and weighs 12kg.')).toEqual(
      expect.arrayContaining(['1450', '12']));
  });
});

describe('evidence voice — voiced basis requires matching evidence', () => {
  it('C: "Measurements show…" about a no-evidence product → violation', () => {
    const r = deterministicTrustCheck(
      'Measurements show the Leben CS-600 has exceptionally low distortion.', CTX, CONV);
    expect(r.unlicensedEvidenceVoice.length).toBe(1);
    expect(r.clean).toBe(false);
  });

  it('D: "Reviewers describe…" about an off-package product → violation', () => {
    const r = deterministicTrustCheck(
      'Reviewers describe the Kinki EX-M1 as warm and romantic.', CTX, CONV);
    expect(r.unlicensedEvidenceVoice.length).toBe(1);
  });

  it('measurement voice about a product whose section holds a measurement passes this layer', () => {
    const r = deterministicTrustCheck(
      'Measurements show the Harbeth SHL5 Plus mildly underdamped in the bass.', CTX, CONV);
    expect(r.unlicensedEvidenceVoice).toEqual([]);
  });

  it('maker voice about a product with maker-published items passes; without them, fails', () => {
    const ok = deterministicTrustCheck(
      'The maker rates the Accuphase E-600 conservatively.', CTX, CONV);
    expect(ok.unlicensedEvidenceVoice).toEqual([]);
    const bad = deterministicTrustCheck(
      'The manufacturer states the Leben CS-600 runs in class A.', CTX, CONV);
    expect(bad.unlicensedEvidenceVoice.length).toBe(1);
  });

  it('class-level evidence-voiced statements (no product named) are not this layer\'s business', () => {
    const r = deterministicTrustCheck(
      'Measurements show that low-sensitivity speakers demand more power for the same level.', CTX, CONV);
    expect(r.unlicensedEvidenceVoice).toEqual([]);
  });
});

describe('what this layer never judges', () => {
  it('bounded adviser character, suggestions, and conclusions pass untouched', () => {
    for (const s of [
      'The Leben CS-600 is often associated with a more intimate presentation.',
      'The Kinki EX-M1 may be worth auditioning if you want to preserve speed.',
      'The E-600 is definitely the strongest link in this chain.',
      'Given that you told me the Hugo gives you more connection, I would keep it.',
    ]) {
      const r = deterministicTrustCheck(s, CTX, CONV);
      expect(r.clean, s).toBe(true);
    }
  });
});
