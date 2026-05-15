/**
 * Comparison consistency regression — Stage 11.1.
 *
 * Guards against trait inversions in initial brand comparisons. The bug
 * this test prevents: independent bag-of-words classifiers inside
 * `buildProvisionalTasteInference` and `buildComparisonRecommendation`
 * re-classifying a brand from the same tendency text and reaching the
 * opposite conclusion from the canonical axis assignment.
 *
 * Concrete example pre-fix (Shindo vs Goldmund):
 *   - Canonical: Shindo='warm', Goldmund='control'
 *   - Reclassified inside buildComparisonRecommendation: both 'mixed',
 *     falls through to the flow-tie-breaker, which emits
 *     "Goldmund offers more tonal weight and density" — inverting
 *     Goldmund's actual control-dominant character.
 *
 * Post-fix the canonical axes flow through both helpers and the
 * forbidden phrasings cannot appear when the axes disagree.
 *
 * Coverage:
 *   1. Shindo (warm) / Goldmund (control)    — the reproducer
 *   2. Leben (warm) / Hegel (control)         — same axis split
 *   3. First Watt (warm) / CH Precision (control) — synthetic CH profile
 *   4. Audio Note (warm) / Soulution (control)    — synthetic Soulution
 *   5. DeVore (warm) / Magico (control)            — synthetic Magico
 *
 * Brands without an in-codebase BrandProfile (CH Precision, Soulution,
 * Magico) are represented by minimal synthetic fixtures that capture
 * their published character — enough to exercise the canonical-axis
 * machinery without depending on catalog content that may shift.
 */

import { describe, it, expect } from 'vitest';

import {
  buildInitialComparisonPayload,
  buildEducationalRationale,
  findBrandProfileByName,
} from '../consultation';
import { renderComparisonPayload, detectDominantAxis } from '../comparison-payload';
import type { BrandProfile } from '../consultation';

// ── Synthetic fixtures for brands without in-codebase profiles ─────

const SYNTHETIC_CH_PRECISION: { name: string; philosophy: string; tendencies: string } = {
  name: 'CH Precision',
  philosophy:
    'CH Precision designs reference-level Swiss electronics. The engineering prioritises measured accuracy, controlled grip, and signal-path neutrality — modular construction with discrete current-feedback topologies.',
  tendencies:
    'CH Precision components are described as composed, controlled, neutral, and analytical. Tonal balance is precise and tight, with restrained dynamics and clean transient resolution. The presentation is refined rather than warm.',
};

const SYNTHETIC_SOULUTION: { name: string; philosophy: string; tendencies: string } = {
  name: 'Soulution',
  philosophy:
    'Soulution builds Swiss reference electronics around extremely wide bandwidth, very low distortion, and extremely fast feedback correction. The engineering philosophy is uncompromising measurement-driven design.',
  tendencies:
    'Soulution amplifiers are described as transparent, neutral, controlled, and analytical. Tonal balance is clean and precise with tight bass, restrained colouration, and resolving detail. The presentation is composed rather than tonally rich.',
};

const SYNTHETIC_MAGICO: { name: string; philosophy: string; tendencies: string } = {
  name: 'Magico',
  philosophy:
    'Magico designs ultra-precise sealed-enclosure speakers using aluminium and carbon composite cabinetry. The engineering philosophy prioritises measured accuracy, low resonance, and tight dynamic control.',
  tendencies:
    'Magico speakers are described as neutral, precise, controlled, and analytical. Tonal balance is clean and tight with restrained warmth and resolving transient detail. The presentation is composed and articulate rather than tonally dense.',
};

// ── Test pairs ─────────────────────────────────────────

interface Pair {
  label: string;
  warmSide: () => BrandProfile | { name: string; philosophy: string; tendencies: string } | undefined;
  controlSide: () => BrandProfile | { name: string; philosophy: string; tendencies: string } | undefined;
}

const PAIRS: Pair[] = [
  {
    label: 'Shindo vs Goldmund',
    warmSide: () => findBrandProfileByName('Shindo'),
    controlSide: () => findBrandProfileByName('Goldmund'),
  },
  {
    label: 'Leben vs Hegel',
    warmSide: () => findBrandProfileByName('Leben'),
    controlSide: () => findBrandProfileByName('Hegel'),
  },
  {
    label: 'First Watt vs CH Precision',
    warmSide: () => findBrandProfileByName('First Watt') ?? findBrandProfileByName('Pass Labs'),
    controlSide: () => SYNTHETIC_CH_PRECISION,
  },
  {
    label: 'Audio Note vs Soulution',
    warmSide: () => findBrandProfileByName('Audio Note'),
    controlSide: () => SYNTHETIC_SOULUTION,
  },
  {
    label: 'DeVore vs Magico',
    warmSide: () => findBrandProfileByName('DeVore'),
    controlSide: () => SYNTHETIC_MAGICO,
  },
];

// ── Forbidden phrasings (inversion patterns) ───────────
//
// When the warm side is on the left and the control side is on the
// right, these phrasings would be inversions of each side's actual
// character. The patterns are intentionally tight — they target the
// exact templates that produced the Shindo/Goldmund contradiction.

interface InversionPattern {
  description: string;
  test: (warmName: string, controlName: string, rendered: string) => string | null;
}

const INVERSION_PATTERNS: InversionPattern[] = [
  {
    description: 'control-side claimed as "more tonal weight and density"',
    test: (_warmName, controlName, rendered) => {
      // Matches both "**Goldmund** offers more tonal weight" and the
      // rationale form "Goldmund suits listeners who prioritise immersive
      // harmonic saturation".
      const re1 = new RegExp(`\\*\\*${escapeRegex(controlName)}\\*\\*\\s+offers more tonal weight`, 'i');
      const re2 = new RegExp(`${escapeRegex(controlName)}\\s+suits listeners who prioritise immersive harmonic saturation`, 'i');
      const m1 = rendered.match(re1);
      if (m1) return m1[0];
      const m2 = rendered.match(re2);
      if (m2) return m2[0];
      return null;
    },
  },
  {
    description: 'control-side claimed to bring "stronger rhythmic drive"',
    test: (_warmName, controlName, rendered) => {
      const re = new RegExp(`\\*\\*${escapeRegex(controlName)}\\*\\*\\s+brings stronger rhythmic drive`, 'i');
      const m = rendered.match(re);
      return m ? m[0] : null;
    },
  },
  {
    description: 'both sides claimed to "prioritise musical warmth" when one is control',
    test: (warmName, controlName, rendered) => {
      // Match "Both X and Y prioritise musical warmth" or
      // "Both prioritise musical warmth" appearing alongside both names.
      if (/Both\s+\S.*?\s+prioritise musical warmth/i.test(rendered)
        && rendered.toLowerCase().includes(warmName.toLowerCase())
        && rendered.toLowerCase().includes(controlName.toLowerCase())) {
        const m = rendered.match(/Both[^.]*?prioritise musical warmth[^.]*\./i);
        return m ? m[0] : 'Both [...] prioritise musical warmth';
      }
      return null;
    },
  },
  {
    description: 'taste frame mis-identifies control-side as "long listening sessions and tonal comfort" winner',
    test: (warmName, controlName, rendered) => {
      // The valid form is "...matter to you, **{warmName}** is the better fit...
      // ...**{controlName}** is where that lives." (clarity/precision)
      // An inversion would be "...matter to you, **{controlName}** is the better fit..."
      const re = new RegExp(
        `long listening sessions and tonal comfort matter to you,\\s+\\*\\*${escapeRegex(controlName)}\\*\\*\\s+is likely the better fit`,
        'i',
      );
      const m = rendered.match(re);
      return m ? m[0] : null;
    },
  },
  {
    description: '"recommended" line points control-side as the "more natural match" on the warm posture',
    test: (warmName, controlName, rendered) => {
      const re = new RegExp(
        `\\*\\*${escapeRegex(controlName)}\\*\\*\\s+is the more natural match unless you're explicitly chasing maximum control`,
        'i',
      );
      const m = rendered.match(re);
      return m ? m[0] : null;
    },
  },
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Tests ──────────────────────────────────────────────

describe('comparison-consistency (Stage 11.1)', () => {
  for (const pair of PAIRS) {
    describe(pair.label, () => {
      const warmProfile = pair.warmSide();
      const controlProfile = pair.controlSide();

      if (!warmProfile || !controlProfile) {
        it.skip(`${pair.label}: missing brand profile in codebase — skipped`, () => {});
        return;
      }

      const warmName = capitalize('names' in warmProfile ? warmProfile.names[0] : warmProfile.name);
      const controlName = capitalize('names' in controlProfile ? controlProfile.names[0] : controlProfile.name);

      it('classifies the warm side as warm/flow (not control) and the control side as control (not warm/flow)', () => {
        // Use the same input shape the canonical-axis computation does.
        const axisWarm = detectDominantAxis(warmName, warmProfile.tendencies);
        const axisControl = detectDominantAxis(controlName, controlProfile.tendencies);
        // The warm side may legitimately read as 'warm' or (rarely) 'flow';
        // both are taste-frame "ease" postures.
        expect(['warm', 'flow']).toContain(axisWarm);
        expect(axisControl).toBe('control');
      });

      it('rendered comparison contains no trait inversions', () => {
        const payload = buildInitialComparisonPayload(warmProfile, controlProfile);
        const rendered = renderComparisonPayload(payload).comparisonSummary;

        const offences: string[] = [];
        for (const pattern of INVERSION_PATTERNS) {
          const offence = pattern.test(warmName, controlName, rendered);
          if (offence) {
            offences.push(`  • ${pattern.description}\n    Offending text: "${offence}"`);
          }
        }
        if (offences.length > 0) {
          throw new Error(
            `Trait inversion detected in ${pair.label}:\n${offences.join('\n')}\n\nFull rendered output:\n${rendered}`,
          );
        }
      });

      it('rendered comparison also withstands the reversed-side order', () => {
        // Same pair, swapped order. The fix should be order-independent.
        const payload = buildInitialComparisonPayload(controlProfile, warmProfile);
        const rendered = renderComparisonPayload(payload).comparisonSummary;

        // Mirror the patterns: in the swapped order the "control side"
        // is on the left. The forbidden phrasings still target the
        // control-side brand name.
        const offences: string[] = [];
        for (const pattern of INVERSION_PATTERNS) {
          const offence = pattern.test(warmName, controlName, rendered);
          if (offence) {
            offences.push(`  • ${pattern.description}\n    Offending text: "${offence}"`);
          }
        }
        if (offences.length > 0) {
          throw new Error(
            `Trait inversion detected in ${pair.label} (reversed order):\n${offences.join('\n')}\n\nFull rendered output:\n${rendered}`,
          );
        }
      });

      it('control-side core character carries no contrastive-leaked warm trait words (Stage 11.2)', () => {
        // The control-side brand's published character is dominant on
        // control (precision, clarity, neutrality). When extractCoreCharacter
        // pulls trait words, it must not surface warm/density/harmonic
        // descriptors that came from a contrastive right-hand side like
        // "dominate over warmth or harmonic density" (Goldmund).
        const payload = buildInitialComparisonPayload(warmProfile, controlProfile);
        const controlChar = payload.sideB.character.toLowerCase();
        const leakyTraits: Array<{ name: string; re: RegExp }> = [
          { name: 'warmth', re: /\bwarmth\b/ },
          { name: 'tonal density', re: /\btonal density\b/ },
          { name: 'harmonic richness', re: /\bharmonic richness\b/ },
          { name: 'tonal saturation', re: /\btonal saturation\b/ },
        ];
        const leaks = leakyTraits.filter((p) => p.re.test(controlChar));
        if (leaks.length > 0) {
          throw new Error(
            `Control-side (${controlName}) character "${payload.sideB.character}" leaked warm trait words from contrastive context: ${leaks.map((l) => l.name).join(', ')}`,
          );
        }
      });
    });
  }

  // Stage 11.4 — Educational rationale routing tests.
  // Verify that the helper returns expected output for pairs where
  // qualifying authored fields exist on both sides, AND that the
  // helper returns null (preserving the existing rationale) when
  // either side lacks qualifying fields.
  describe('educational rationale (Stage 11.4)', () => {
    it('Shindo + Goldmund both resolve via pilot capsule and produce engineering+perception sentences', () => {
      const shindo = findBrandProfileByName('Shindo');
      const goldmund = findBrandProfileByName('Goldmund');
      expect(shindo).toBeTruthy();
      expect(goldmund).toBeTruthy();
      const rationale = buildEducationalRationale('Shindo', shindo!, 'Goldmund', goldmund!);
      expect(rationale).not.toBeNull();
      // Engineering sentence — pilot.mechanism first-clause from each side
      expect(rationale!).toMatch(/Shindo —.*tube design/i);
      expect(rationale!).toMatch(/Goldmund —.*mechanically grounded chassis/i);
      // Perception sentence — perceptionTraits[0] from each side
      expect(rationale!).toMatch(/The listener hears Shindo as.*harmonically saturated/i);
      expect(rationale!).toMatch(/Goldmund as.*fast transient definition/i);
    });

    it('Shindo vs Goldmund rendered comparison surfaces the educational rationale (not the boilerplate)', () => {
      const shindo = findBrandProfileByName('Shindo');
      const goldmund = findBrandProfileByName('Goldmund');
      expect(shindo && goldmund).toBeTruthy();
      const payload = buildInitialComparisonPayload(shindo!, goldmund!);
      const rendered = renderComparisonPayload(payload).comparisonSummary;
      // The boilerplate rationale must NOT be present
      expect(rendered).not.toMatch(/leans toward warmth, density, and listening ease — traits that tend to sustain comfort over long sessions/);
      // The educational sentences MUST be present
      expect(rendered).toMatch(/Shindo —.*tube design/i);
      expect(rendered).toMatch(/The listener hears Shindo as/i);
    });

    it('Leben + Hegel return null (both lack pilot capsule, short fields, and philosophyExtended)', () => {
      // Neither brand has a pilot capsule, neither has the
      // designPhilosophy+sonicTendency short-field triplet, and
      // neither has philosophyExtended. Helper falls through to (d).
      const leben = findBrandProfileByName('Leben');
      const hegel = findBrandProfileByName('Hegel');
      expect(leben && hegel).toBeTruthy();
      const rationale = buildEducationalRationale('Leben', leben!, 'Hegel', hegel!);
      expect(rationale).toBeNull();
    });

    it('Leben vs Hegel rendered comparison keeps the existing boilerplate rationale (graceful fallback)', () => {
      const leben = findBrandProfileByName('Leben');
      const hegel = findBrandProfileByName('Hegel');
      expect(leben && hegel).toBeTruthy();
      const payload = buildInitialComparisonPayload(leben!, hegel!);
      const rendered = renderComparisonPayload(payload).comparisonSummary;
      // The boilerplate rationale phrase IS the expected fallback here
      expect(rendered).toMatch(/leans toward warmth, density, and listening ease/);
      // And the helper-shape sentences must NOT have leaked in
      expect(rendered).not.toMatch(/The listener hears Leben as/i);
    });

    it('asymmetric coverage returns null (one side has pilot, the other has nothing)', () => {
      const shindo = findBrandProfileByName('Shindo');
      expect(shindo).toBeTruthy();
      const bareControl = {
        name: 'BareControl',
        philosophy: 'BareControl designs neutral electronics.',
        tendencies: 'BareControl reads as controlled and clean.',
      };
      const rationale = buildEducationalRationale('Shindo', shindo!, 'BareControl', bareControl);
      expect(rationale).toBeNull();
    });

    it('tier-(b) short-field pair resolves (synthetic warm with designPhilosophy + sonicTendency)', () => {
      // Build a synthetic pair that uses tier (b) on the warm side and
      // pilot on the precise side — to exercise the short-fields path.
      const warmShortFields = {
        name: 'WarmShorts',
        philosophy: 'WarmShorts designs around tonal richness.',
        tendencies: 'WarmShorts amplifiers are described as warm, dense, and harmonically alive.',
        designPhilosophy: 'Single-ended class-A bias for harmonic continuity.',
        sonicTendency: 'Warm, harmonically dense, gently flowing.',
      };
      const goldmund = findBrandProfileByName('Goldmund');
      expect(goldmund).toBeTruthy();
      const rationale = buildEducationalRationale('WarmShorts', warmShortFields, 'Goldmund', goldmund!);
      expect(rationale).not.toBeNull();
      expect(rationale!).toMatch(/WarmShorts — Single-ended class-A bias/);
      expect(rationale!).toMatch(/The listener hears WarmShorts as Warm, harmonically dense/);
    });

    it('tier-(c) extended-philosophy pair resolves (synthetic warm with philosophyExtended + tendencies trait clause)', () => {
      const warmExtended = {
        name: 'WarmExt',
        philosophy: 'WarmExt builds tube electronics.',
        philosophyExtended: 'WarmExt designs each circuit individually around its chosen tubes, preserving harmonic continuity across the conversion stage.',
        tendencies: 'WarmExt amplifiers are described as warm, dense, harmonically rich, and physically present.',
      };
      const goldmund = findBrandProfileByName('Goldmund');
      expect(goldmund).toBeTruthy();
      const rationale = buildEducationalRationale('WarmExt', warmExtended, 'Goldmund', goldmund!);
      expect(rationale).not.toBeNull();
      // tier (c) engineering pulls philosophyExtended first sentence
      expect(rationale!).toMatch(/WarmExt — WarmExt designs each circuit individually/);
      // tier (c) perception pulls the "described as ..." clause
      expect(rationale!).toMatch(/The listener hears WarmExt as warm, dense, harmonically rich, and physically present/);
    });
  });

  // Pair-specific decisiveness test: the reproducer pair must produce a
  // recommendation that actually points somewhere, not the generic
  // "Both are strong choices" tie fallback. After Stage 11.2 cleans up
  // contrastive leakage, Goldmund classifies as control (not neutral)
  // and the warm-vs-precise high-confidence branch fires.
  describe('Shindo vs Goldmund — Stage 11.2 decisiveness', () => {
    const shindo = findBrandProfileByName('Shindo');
    const goldmund = findBrandProfileByName('Goldmund');
    if (!shindo || !goldmund) {
      it.skip('missing brand profile — skipped', () => {});
      return;
    }
    it('rendered output retains a decisive recommendation, not a "Both are strong choices" fallback', () => {
      const payload = buildInitialComparisonPayload(shindo, goldmund);
      const rendered = renderComparisonPayload(payload).comparisonSummary;
      // Forbidden: flattened tie fallback
      if (/Both are strong choices with different strengths/i.test(rendered)) {
        throw new Error(
          `Shindo vs Goldmund flattened to tie fallback. Rendered:\n${rendered}`,
        );
      }
      // Required: a directional recommendation phrase
      const decisivePatterns: RegExp[] = [
        /\*\*Shindo\*\* is the more natural match/i,
        /\*\*Shindo\*\* leans toward tonal density and ease/i,
        /In most systems, \*\*Shindo\*\*/i,
      ];
      if (!decisivePatterns.some((re) => re.test(rendered))) {
        throw new Error(
          `Shindo vs Goldmund did not contain any decisive recommendation phrase. Rendered:\n${rendered}`,
        );
      }
    });
  });
});

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
