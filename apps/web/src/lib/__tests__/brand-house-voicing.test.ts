/**
 * Audio XX — Brand House Voicing data-layer unit tests (Phase E-5B.1).
 *
 * Covers §8.1 of `docs/phase-E-5B-implementation-design.md`:
 *   - schema conformance for the 23 + 6 = 29 production entries
 *   - structural absence of Audio Note (#18) and Shindo (#20) per
 *     E-5A §12.4
 *   - confidence calibration
 *   - commercial-entry shape (no voicing fields set; priority/confidence
 *     correctly low)
 *   - lookup specificity (split-tier + tier-narrowing for KEF, Focal,
 *     Tannoy, Klipsch Heritage)
 *   - first-match-wins ordering
 *   - performance smoke test
 *
 * These tests verify only the data layer and lookup helper. No
 * composer integration is tested (Stages E-5B.2 – E-5B.5).
 */

import { describe, expect, it } from 'vitest';

import {
  BRAND_HOUSE_VOICING,
  UNIVERSAL_AVOID_OVERCLAIMING,
  findBrandHouseVoicing,
  type BrandHouseVoicing,
} from '../brand-house-voicing';

describe('brand-house-voicing — data layer', () => {
  // U-1
  it('contains exactly 29 entries (23 audiophile-identity + 6 commercial)', () => {
    expect(BRAND_HOUSE_VOICING).toHaveLength(29);
    const audiophile = BRAND_HOUSE_VOICING.filter(
      (entry) =>
        entry.priority === 'audiophile-identity' || entry.priority === 'mixed',
    );
    const commercial = BRAND_HOUSE_VOICING.filter(
      (entry) => entry.priority === 'commercial',
    );
    expect(audiophile).toHaveLength(23);
    expect(commercial).toHaveLength(6);
  });

  // U-2 — structural absence of Audio Note and Shindo
  it('does NOT contain Audio Note at any confidence level', () => {
    const audioNote = BRAND_HOUSE_VOICING.find((entry) =>
      entry.matchTokens.some((token) =>
        token.toLowerCase().includes('audio note'),
      ),
    );
    expect(audioNote).toBeUndefined();
  });

  it('does NOT contain Shindo at any confidence level', () => {
    const shindo = BRAND_HOUSE_VOICING.find((entry) =>
      entry.matchTokens.some((token) => token.toLowerCase().includes('shindo')),
    );
    expect(shindo).toBeUndefined();
  });

  // U-3 — every entry has the required schema fields populated
  it('every entry has required fields populated', () => {
    for (const entry of BRAND_HOUSE_VOICING) {
      expect(entry.brand, `${entry.brand}.brand`).toBeTruthy();
      expect(entry.matchTokens.length, `${entry.brand}.matchTokens`).toBeGreaterThan(0);
      expect(entry.priority, `${entry.brand}.priority`).toBeTruthy();
      expect(entry.confidence, `${entry.brand}.confidence`).toBeTruthy();
      expect(entry.commonStrengths.length, `${entry.brand}.commonStrengths`).toBeGreaterThan(0);
      expect(Array.isArray(entry.commonTradeoffs), `${entry.brand}.commonTradeoffs is array`).toBe(true);
      expect(Array.isArray(entry.upgradeCautions), `${entry.brand}.upgradeCautions is array`).toBe(true);
      expect(entry.avoidOverclaiming.length, `${entry.brand}.avoidOverclaiming`).toBeGreaterThan(0);
      expect(entry.appliesToRoles.length, `${entry.brand}.appliesToRoles`).toBeGreaterThan(0);
      expect(entry.exampleModels.length, `${entry.brand}.exampleModels`).toBeGreaterThan(0);
    }
  });

  // U-4 — every audiophile-identity / mixed entry has appliesToRoles ≥ 1
  it('every audiophile-identity / mixed entry has at least one applicable role', () => {
    for (const entry of BRAND_HOUSE_VOICING) {
      if (entry.priority === 'audiophile-identity' || entry.priority === 'mixed') {
        expect(entry.appliesToRoles.length, `${entry.brand}`).toBeGreaterThan(0);
      }
    }
  });

  // U-5 — commercial entries: priority + confidence, no voicing fields
  it('every commercial entry is correctly shaped (no identity voicing fields)', () => {
    const commercial = BRAND_HOUSE_VOICING.filter(
      (entry) => entry.priority === 'commercial',
    );
    expect(commercial).toHaveLength(6);
    for (const entry of commercial) {
      expect(entry.priority, `${entry.brand}.priority`).toBe('commercial');
      expect(entry.confidence, `${entry.brand}.confidence`).toBe('low');
      expect(entry.houseVoicing, `${entry.brand}.houseVoicing`).toBeUndefined();
      expect(entry.designPhilosophy, `${entry.brand}.designPhilosophy`).toBeUndefined();
      expect(entry.systemBuildingLogic, `${entry.brand}.systemBuildingLogic`).toBeUndefined();
    }
  });

  // U-6 — first-token uniqueness across the array
  it('no two entries share the same lowercase first matchToken', () => {
    const firstTokens = BRAND_HOUSE_VOICING.map((entry) =>
      entry.matchTokens[0]!.toLowerCase(),
    );
    const unique = new Set(firstTokens);
    expect(unique.size).toBe(firstTokens.length);
  });

  // U-7 — confidence calibration
  it('every high-confidence audiophile-identity entry has at least one voicing field set', () => {
    for (const entry of BRAND_HOUSE_VOICING) {
      if (entry.priority === 'audiophile-identity' && entry.confidence === 'high') {
        const hasVoicing =
          !!entry.houseVoicing ||
          !!entry.designPhilosophy ||
          !!entry.systemBuildingLogic;
        expect(hasVoicing, `${entry.brand}.high needs at least one voicing field`).toBe(true);
      }
    }
  });

  it('every medium-confidence audiophile-identity / mixed entry has at least one voicing field set', () => {
    for (const entry of BRAND_HOUSE_VOICING) {
      if (
        (entry.priority === 'audiophile-identity' || entry.priority === 'mixed') &&
        entry.confidence === 'medium'
      ) {
        const hasVoicing =
          !!entry.houseVoicing ||
          !!entry.designPhilosophy ||
          !!entry.systemBuildingLogic;
        expect(hasVoicing, `${entry.brand}.medium needs at least one voicing field`).toBe(true);
      }
    }
  });

  // U-8 — universal cliché coverage in avoidOverclaiming
  it('every audiophile-identity entry blocks at least one core cliché token', () => {
    const coreClicheTokens = ['endgame', 'world class', 'magic'];
    for (const entry of BRAND_HOUSE_VOICING) {
      if (entry.priority !== 'audiophile-identity' && entry.priority !== 'mixed') {
        continue;
      }
      const blocksAtLeastOne = entry.avoidOverclaiming.some((phrase) =>
        coreClicheTokens.some((token) =>
          phrase.toLowerCase().includes(token.toLowerCase()),
        ),
      );
      expect(
        blocksAtLeastOne,
        `${entry.brand}.avoidOverclaiming must include at least one of: endgame / world class / magic`,
      ).toBe(true);
    }
  });

  it('UNIVERSAL_AVOID_OVERCLAIMING includes the core cliché vocabulary', () => {
    const requiredTokens = [
      'magic',
      'endgame',
      'world class',
      'best in class',
      'cult',
      'legendary',
      'unrivalled',
    ];
    for (const token of requiredTokens) {
      expect(UNIVERSAL_AVOID_OVERCLAIMING).toContain(token);
    }
  });
});

describe('brand-house-voicing — lookup behavior', () => {
  // U-9 — basic positive lookup
  it('matches Naim on a component containing the brand name', () => {
    const entry = findBrandHouseVoicing('Naim NDX 2');
    expect(entry).not.toBeNull();
    expect(entry?.brand).toBe('Naim Audio');
  });

  it('is case-insensitive', () => {
    const lower = findBrandHouseVoicing('naim ndx 2');
    const upper = findBrandHouseVoicing('NAIM NDX 2');
    const mixed = findBrandHouseVoicing('Naim NDX 2');
    expect(lower?.brand).toBe('Naim Audio');
    expect(upper?.brand).toBe('Naim Audio');
    expect(mixed?.brand).toBe('Naim Audio');
  });

  it('returns null for empty / null / undefined input', () => {
    expect(findBrandHouseVoicing('')).toBeNull();
    expect(findBrandHouseVoicing(null)).toBeNull();
    expect(findBrandHouseVoicing(undefined)).toBeNull();
  });

  it('returns null for components with no recognized brand', () => {
    expect(findBrandHouseVoicing('Unknown Reference XYZ')).toBeNull();
    expect(findBrandHouseVoicing('Generic Streamer')).toBeNull();
  });

  // U-10 — Klipsch RP-600M must NOT match Klipsch Heritage
  it('does NOT match Klipsch Heritage on a Klipsch RP / Reference Premiere component', () => {
    expect(findBrandHouseVoicing('Klipsch RP-600M')).toBeNull();
    expect(findBrandHouseVoicing('Klipsch RP-8000F')).toBeNull();
    expect(findBrandHouseVoicing('Klipsch R-15M')).toBeNull();
    expect(findBrandHouseVoicing('Klipsch Reference Premiere')).toBeNull();
  });

  // U-11 — KEF Q-series tier narrowing
  it('does NOT match KEF on the Q-series (tier-narrowed at the data layer)', () => {
    expect(findBrandHouseVoicing('KEF Q350')).toBeNull();
    expect(findBrandHouseVoicing('KEF Q150')).toBeNull();
    expect(findBrandHouseVoicing('KEF Q950')).toBeNull();
  });

  // U-12 — KEF higher tiers match
  it('matches KEF on the Blade / Reference / R-series', () => {
    expect(findBrandHouseVoicing('KEF Blade Two Meta')?.brand).toBe('KEF');
    expect(findBrandHouseVoicing('KEF Reference 3 Meta')?.brand).toBe('KEF');
    expect(findBrandHouseVoicing('KEF R3 Meta')?.brand).toBe('KEF');
    expect(findBrandHouseVoicing('KEF R7 Meta')?.brand).toBe('KEF');
    expect(findBrandHouseVoicing('KEF R11 Meta')?.brand).toBe('KEF');
  });

  // U-13 — Focal Chora / Aria tier narrowing
  it('does NOT match Focal on Chora or Aria (tier-narrowed at the data layer)', () => {
    expect(findBrandHouseVoicing('Focal Chora 826')).toBeNull();
    expect(findBrandHouseVoicing('Focal Aria 906')).toBeNull();
    expect(findBrandHouseVoicing('Focal Aria 936')).toBeNull();
  });

  // U-14 — Focal Sopra / Utopia match
  it('matches Focal on Sopra / Utopia (and flagship variants)', () => {
    expect(findBrandHouseVoicing('Focal Sopra No. 2')?.brand).toBe('Focal');
    expect(findBrandHouseVoicing('Focal Utopia III')?.brand).toBe('Focal');
    expect(findBrandHouseVoicing('Focal Grande Utopia EM Evo')?.brand).toBe('Focal');
    expect(findBrandHouseVoicing('Focal Maestro Utopia')?.brand).toBe('Focal');
    expect(findBrandHouseVoicing('Focal Stella Utopia')?.brand).toBe('Focal');
  });

  // U-15 — Tannoy non-Prestige/Legacy products must not match
  it('does NOT match Tannoy on non-Prestige / non-Legacy products', () => {
    expect(findBrandHouseVoicing('Tannoy Definition DC10')).toBeNull();
    expect(findBrandHouseVoicing('Tannoy Revolution XT')).toBeNull();
    expect(findBrandHouseVoicing('Tannoy Mercury 7.4')).toBeNull();
  });

  // U-16 — Tannoy Prestige / Legacy model match
  it('matches Tannoy on Prestige / Legacy model names', () => {
    expect(findBrandHouseVoicing('Tannoy Canterbury GR')?.brand).toBe('Tannoy');
    expect(findBrandHouseVoicing('Tannoy Westminster Royal GR')?.brand).toBe('Tannoy');
    expect(findBrandHouseVoicing('Tannoy Kensington')?.brand).toBe('Tannoy');
    expect(findBrandHouseVoicing('Tannoy Turnberry GR')?.brand).toBe('Tannoy');
    expect(findBrandHouseVoicing('Tannoy Cheviot')?.brand).toBe('Tannoy');
  });

  // U-17 — Klipsch Heritage models match
  it('matches Klipsch Heritage on Heritage model names', () => {
    expect(findBrandHouseVoicing('Klipsch Heresy IV')?.brand).toBe('Klipsch Heritage');
    expect(findBrandHouseVoicing('Klipschorn AK6')?.brand).toBe('Klipsch Heritage');
    expect(findBrandHouseVoicing('Klipsch La Scala AL5')?.brand).toBe('Klipsch Heritage');
    expect(findBrandHouseVoicing('Klipsch Forte IV')?.brand).toBe('Klipsch Heritage');
    expect(findBrandHouseVoicing('Klipsch Cornwall IV')?.brand).toBe('Klipsch Heritage');
  });

  it('matches Quad ESL on heritage-only names; non-ESL Quad is not in scope', () => {
    expect(findBrandHouseVoicing('Quad ESL-57')?.brand).toBe('Quad');
    expect(findBrandHouseVoicing('Quad ESL-63')?.brand).toBe('Quad');
    expect(findBrandHouseVoicing('Quad II Classic')?.brand).toBe('Quad');
    expect(findBrandHouseVoicing('Quad Vena')).toBeNull();
    expect(findBrandHouseVoicing('Quad 99 CDP')).toBeNull();
  });

  it('matches Chord Electronics only on specific product tokens', () => {
    expect(findBrandHouseVoicing('Chord DAVE')?.brand).toBe('Chord Electronics');
    expect(findBrandHouseVoicing('Chord Hugo TT2')?.brand).toBe('Chord Electronics');
    expect(findBrandHouseVoicing('Chord M Scaler')?.brand).toBe('Chord Electronics');
    expect(findBrandHouseVoicing('Chord Qutest')?.brand).toBe('Chord Electronics');
    // "Chord Company" (cables) must not match
    expect(findBrandHouseVoicing('Chord Company Sarum T speaker cable')).toBeNull();
    expect(findBrandHouseVoicing('Chord Signature Reference')).toBeNull();
  });

  it('matches JBL Studio Monitor & Synthesis only on 4xxx / K2 / M2 / Everest tokens', () => {
    expect(findBrandHouseVoicing('JBL 4349')?.brand).toBe('JBL Studio Monitor & Synthesis');
    expect(findBrandHouseVoicing('JBL 4367')?.brand).toBe('JBL Studio Monitor & Synthesis');
    expect(findBrandHouseVoicing('JBL K2 S9900')?.brand).toBe('JBL Studio Monitor & Synthesis');
    expect(findBrandHouseVoicing('JBL Everest')?.brand).toBe('JBL Studio Monitor & Synthesis');
    // Mid-tier JBL (Stage / Studio / L100 Classic) must not match
    expect(findBrandHouseVoicing('JBL Stage A180')).toBeNull();
    expect(findBrandHouseVoicing('JBL Studio 590')).toBeNull();
    expect(findBrandHouseVoicing('JBL L100 Classic')).toBeNull();
  });

  it('matches Wilson Audio on Wilson Audio / Sasha / Sabrina / Alexx / Watt / WAMM', () => {
    expect(findBrandHouseVoicing('Wilson Audio Sabrina X')?.brand).toBe('Wilson Audio Specialties');
    expect(findBrandHouseVoicing('Wilson Sasha DAW')?.brand).toBe('Wilson Audio Specialties');
    expect(findBrandHouseVoicing('Wilson Alexx V')?.brand).toBe('Wilson Audio Specialties');
    expect(findBrandHouseVoicing('Wilson WAMM Master Chronosonic')?.brand).toBe(
      'Wilson Audio Specialties',
    );
    // Wilson Benesch is a separate brand; must not match
    expect(findBrandHouseVoicing('Wilson Benesch Discovery')).toBeNull();
  });

  it('matches Pass Labs on either "pass labs" or "pass laboratories"', () => {
    expect(findBrandHouseVoicing('Pass Labs XA25')?.brand).toBe('Pass Labs');
    expect(findBrandHouseVoicing('Pass Laboratories XP-32')?.brand).toBe('Pass Labs');
    expect(findBrandHouseVoicing('Pass Labs INT-60')?.brand).toBe('Pass Labs');
    // FirstWatt is a separate brand even though Nelson Pass runs it
    expect(findBrandHouseVoicing('FirstWatt SIT-3')).toBeNull();
  });

  // Commercial-entry lookup smoke tests — lookup returns the entry;
  // gate stack (Stage E-5B.2) will refuse to surface identity prose.
  it('returns the commercial entry on commercial-brand lookups', () => {
    expect(findBrandHouseVoicing('WiiM Pro')?.priority).toBe('commercial');
    expect(findBrandHouseVoicing('Eversolo DMP-A6')?.priority).toBe('commercial');
    expect(findBrandHouseVoicing('Bluesound Node')?.priority).toBe('commercial');
    expect(findBrandHouseVoicing('Schiit Yggdrasil')?.priority).toBe('commercial');
    expect(findBrandHouseVoicing('iFi Zen DAC')?.priority).toBe('commercial');
    expect(findBrandHouseVoicing('Topping D90')?.priority).toBe('commercial');
  });

  // First-match-wins specificity — Group 1 entries win over Group 2
  // when tokens could theoretically overlap. The production set has
  // no real overlap, so this test constructs a probe that verifies
  // ordering rather than collision-resolution.
  it('first-match-wins ordering: specific-token entries appear before bare-brand entries', () => {
    // Group 1 (specific-token entries) must precede Group 2 (bare-brand).
    // Probe: locate the first audiophile-identity entry whose only
    // matchToken is a bare brand (e.g. ['naim']) — it must appear
    // AFTER at least one entry with multi-token narrowing.
    const firstBareBrandIdx = BRAND_HOUSE_VOICING.findIndex((entry) => {
      if (entry.priority !== 'audiophile-identity' && entry.priority !== 'mixed') {
        return false;
      }
      // Bare-brand = single-token entry where the token has no space
      // (e.g. 'naim', 'dcs', 'rega'). Multi-token entries (Pass Labs:
      // ['pass labs', 'pass laboratories']) also count as bare-brand
      // for ordering purposes, but the test simplifies to the
      // unambiguous case.
      return entry.matchTokens.length === 1 && !entry.matchTokens[0]!.includes(' ');
    });
    expect(firstBareBrandIdx).toBeGreaterThan(0);

    // Anything before the first bare-brand entry must have either a
    // multi-token list or a compound-token list (containing spaces).
    for (let i = 0; i < firstBareBrandIdx; i += 1) {
      const entry = BRAND_HOUSE_VOICING[i]!;
      const isSpecific =
        entry.matchTokens.length > 1 ||
        entry.matchTokens[0]!.includes(' ');
      expect(isSpecific, `entry "${entry.brand}" at index ${i} must be specific-token`).toBe(true);
    }
  });

  // U-18 — performance smoke test
  it('completes 1000 lookups in under 50ms', () => {
    const probes = [
      'Naim NDX 2',
      'Klipsch Heresy IV',
      'KEF Blade Two Meta',
      'Focal Sopra No. 2',
      'Topping D90',
      'Wilson Sasha DAW',
      'Some Unknown Component',
      '',
      'dCS Bartók',
      'Tannoy Canterbury GR',
    ];
    const start = performance.now();
    for (let i = 0; i < 100; i += 1) {
      for (const probe of probes) {
        findBrandHouseVoicing(probe);
      }
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});

describe('brand-house-voicing — invariants for future maintainers', () => {
  it('every entry brand-name is unique', () => {
    const brands = BRAND_HOUSE_VOICING.map((entry) => entry.brand);
    const unique = new Set(brands);
    expect(unique.size).toBe(brands.length);
  });

  it('matchTokens are stored lowercase (case-folding happens at lookup-time)', () => {
    for (const entry of BRAND_HOUSE_VOICING) {
      for (const token of entry.matchTokens) {
        expect(token, `${entry.brand} token "${token}"`).toBe(token.toLowerCase());
      }
    }
  });

  it('TypeScript schema is satisfied by every entry (compile-time validated)', () => {
    // Runtime sanity: each entry is the expected shape.
    for (const entry of BRAND_HOUSE_VOICING) {
      const e: BrandHouseVoicing = entry;
      expect(typeof e.brand).toBe('string');
      expect(typeof e.priority).toBe('string');
      expect(typeof e.confidence).toBe('string');
    }
  });
});
