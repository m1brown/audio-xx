import { describe, it, expect } from 'vitest';
import { extractSubjectMatches, detectIntent } from '../intent';
import { buildSystemAssessment } from '../consultation';
import { synthesiseSystemAxisNumeric, type PrimaryAxisLeanings } from '../axis-types';

/**
 * Founder-caught by ear (2026-08-13): "I would have said the Job and this
 * system is quite elastic" — while the artifact read BALANCED.
 *
 * Cause: synthesiseSystemAxisNumeric zips component axes against roles BY
 * INDEX. The findings builder passed `chain.roles` (signal-chain order:
 * source → amp → speakers) alongside `profiles` (component order), so each
 * component was weighted with a DIFFERENT component's role. On the founder's
 * system the speaker's 3.0 weight landed on the streamer, flipping
 * elastic_controlled from -0.8 (elastic) to +0.2 (balanced) — an inverted
 * assessment, not a rounding difference.
 *
 * The categorical aggregation was always correct; only the numeric call was
 * misaligned. These tests pin the invariant from both ends.
 */
describe('axis aggregation: roles must align with component axes', () => {
  it('weights follow the component, not its position in the signal chain', () => {
    const speakerElastic: PrimaryAxisLeanings = {
      warm_bright: 'neutral', smooth_detailed: 'neutral',
      elastic_controlled: 'elastic', airy_closed: 'neutral',
    } as PrimaryAxisLeanings;
    const streamerControlled: PrimaryAxisLeanings = {
      warm_bright: 'neutral', smooth_detailed: 'neutral',
      elastic_controlled: 'controlled', airy_closed: 'neutral',
    } as PrimaryAxisLeanings;

    // Speaker (weight 3) elastic, streamer (weight 0.5) controlled →
    // the speaker must dominate.
    const correct = synthesiseSystemAxisNumeric(
      [speakerElastic, streamerControlled], ['speakers', 'streamer'],
    );
    expect(correct.elastic_controlled).toBeLessThan(-0.35);

    // Swapping only the roles inverts the result — which is exactly the
    // defect. Pinned so the asymmetry stays visible.
    const swapped = synthesiseSystemAxisNumeric(
      [speakerElastic, streamerControlled], ['streamer', 'speakers'],
    );
    expect(swapped.elastic_controlled).toBeGreaterThan(0);
  });

  it('a saved system and the same system as text produce identical axes', () => {
    const Q = 'Assess my system: Job integrated, WLM Diva monitor, Eversolo DMP-A6';
    const subs = extractSubjectMatches(Q);
    const { desires } = detectIntent(Q);

    const fromText: any = buildSystemAssessment(Q, subs as never, null, desires);
    const active = {
      name: 'FRANCE',
      components: [
        { name: 'Integrated', brand: 'JOB', category: 'amplifier', role: 'amplifier' },
        { name: 'Diva monitor', brand: 'WLM', category: 'speaker', role: 'speakers' },
        { name: 'DMP-A6', brand: 'Eversolo', category: 'streamer', role: 'streamer' },
      ],
      tendencies: null, location: null, primaryUse: null,
    };
    const fromSaved: any = buildSystemAssessment(Q, subs as never, active as never, desires);

    expect(fromSaved.findings.systemAxisNumeric).toEqual(fromText.findings.systemAxisNumeric);
    // And the reading matches the components: two of three lean elastic.
    expect(fromSaved.findings.systemAxisNumeric.elastic_controlled).toBeLessThan(-0.35);
  });
});
