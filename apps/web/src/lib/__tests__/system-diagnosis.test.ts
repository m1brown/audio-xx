/**
 * System diagnosis tests — verifies that system + complaint inputs
 * produce concise diagnostic responses instead of product profiles.
 */
import { detectIntent, extractSubjectMatches } from '../intent';
import { buildSystemDiagnosis } from '../consultation';

describe('System diagnosis detection', () => {
  test('"i have wilson speakers and a soulution amp. the sound is great but can be a little dry" → diagnosis intent', () => {
    const input = 'i have wilson speakers and a soulution amp. the sound is great but can be a little dry';
    const result = detectIntent(input);
    expect(result.intent).toBe('diagnosis');
    expect(result.subjects.length).toBeGreaterThanOrEqual(2);
  });

  test('"my system sounds thin and bright" → diagnosis intent', () => {
    const result = detectIntent('my system sounds thin and bright');
    expect(result.intent).toBe('diagnosis');
  });

  test('"can be a little harsh with certain recordings" → diagnosis intent', () => {
    const result = detectIntent('i have kef speakers and a naim amp. can be a little harsh with certain recordings');
    expect(result.intent).toBe('diagnosis');
  });

  test('"love it but a bit sterile" → diagnosis intent', () => {
    const result = detectIntent('i have harbeth speakers and chord electronics. love it but a bit sterile');
    expect(result.intent).toBe('diagnosis');
  });

  test('"great but cold" → diagnosis intent', () => {
    const result = detectIntent('great but cold sounding system with magnepan and bryston');
    expect(result.intent).toBe('diagnosis');
  });
});

describe('System diagnosis response format', () => {
  test('Wilson + Soulution + dry → concise diagnosis with adjustment paths', () => {
    const input = 'i have wilson speakers and a soulution amp. the sound is great but can be a little dry';
    const subjects = extractSubjectMatches(input);
    const result = buildSystemDiagnosis(input, subjects);

    expect(result).not.toBeNull();
    expect(result!.comparisonSummary).toBeDefined();
    expect(result!.followUp).toBeDefined();

    // Should acknowledge system
    expect(result!.comparisonSummary).toMatch(/Wilson|Soulution/i);
    // Should mention the complaint
    expect(result!.comparisonSummary).toMatch(/dry/i);
    // Should have numbered paths
    expect(result!.comparisonSummary).toMatch(/\*\*1\.\*\*/);
    expect(result!.comparisonSummary).toMatch(/\*\*2\.\*\*/);

    // Should NOT have product profile headers
    expect(result!.comparisonSummary).not.toMatch(/Tonality:/);
    expect(result!.comparisonSummary).not.toMatch(/Dynamics:/);
    expect(result!.comparisonSummary).not.toMatch(/Spatiality:/);
    expect(result!.comparisonSummary).not.toMatch(/Retail price:/);

    // philosophy and tendencies should be empty (concise format)
    expect(result!.philosophy).toBeUndefined();
    expect(result!.tendencies).toBeUndefined();
    expect(result!.systemContext).toBeUndefined();
  });

  test('diagnosis response is concise (under 1500 chars)', () => {
    const input = 'i have wilson speakers and a soulution amp. the sound is great but can be a little dry';
    const subjects = extractSubjectMatches(input);
    const result = buildSystemDiagnosis(input, subjects);

    expect(result).not.toBeNull();
    expect(result!.comparisonSummary!.length).toBeLessThan(1500);
  });

  test('follow-up asks about source for dry/sterile/clinical complaints', () => {
    const input = 'my denafrips dac and kef speakers sound a bit sterile';
    const subjects = extractSubjectMatches(input);
    const result = buildSystemDiagnosis(input, subjects);

    expect(result).not.toBeNull();
    expect(result!.followUp).toMatch(/source|DAC|streamer/i);
  });
});
