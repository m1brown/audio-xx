import { describe, it, expect } from 'vitest';
import { buildKnowledgeResponse } from '../audio-lanes';
import { detectIntent } from '../intent';

/**
 * A user's own system is not a shoot-out.
 *
 * Verified on production: "is my amplifier powerful enough? i have a leben
 * cs300 and harbeth p3esr" rendered under the heading
 * "LEBEN CS300 VS P3ESR VS HARBETH" — extractTopic joined every recognized
 * subject with " vs " unconditionally. The heading now only uses "vs" when
 * the message itself compares; ownership questions join with "+".
 */

function topic(q: string): string {
  const r = detectIntent(q);
  return buildKnowledgeResponse({ currentMessage: q, subjectMatches: r.subjectMatches }).topic;
}

describe('knowledge topic heading', () => {
  it('does not frame an ownership question as a comparison', () => {
    const t = topic('is my amplifier powerful enough? i have a leben cs300 and harbeth p3esr');
    expect(t).not.toMatch(/\bvs\b/i);
    expect(t).toMatch(/\+/);
  });

  it('keeps vs for genuine comparisons', () => {
    const t = topic('leben cs300 vs harbeth p3esr which is better');
    expect(t).toMatch(/\bvs\b/i);
  });
});
