/**
 * Diagnosis Pipeline Evaluation — runs 5 test inputs through the REAL
 * intent detection + response generation pipeline and logs full output.
 *
 * This is a diagnostic/evaluation test, not a pass/fail unit test.
 * All assertions are intentionally loose — the point is to inspect output.
 */
import { detectIntent, extractSubjectMatches, extractDesires } from '../intent';
import { buildSystemDiagnosis } from '../consultation';
import { routeConversation } from '../conversation-router';

const TEST_CASES = [
  'I have wilson speakers and a soulution amp. the sound is great but a little dry',
  'my system sounds thin',
  'kef speakers + hegel amp, a bit bright',
  'I get listening fatigue after 20 minutes',
  'my system is very detailed but not very musical',
];

for (const [i, input] of TEST_CASES.entries()) {
  test(`Test ${i + 1}: "${input}"`, () => {
    // ── Intent detection ──
    const intentResult = detectIntent(input);
    const subjects = extractSubjectMatches(input);
    const desires = extractDesires(input);
    const routerMode = routeConversation(input);

    console.log(`\n${'='.repeat(70)}`);
    console.log(`TEST ${i + 1}: "${input}"`);
    console.log(`${'='.repeat(70)}`);
    console.log(`\n### Detected mode`);
    console.log(`  Intent: ${intentResult.intent}`);
    console.log(`  Router mode: ${routerMode.mode} / ${routerMode.stage}`);

    console.log(`\n### Extracted context`);
    console.log(`  Subjects: ${subjects.map(s => `${s.name} (${s.kind})`).join(', ') || '(none)'}`);
    console.log(`  Desires: ${desires.map(d => `${d.direction} ${d.quality}`).join(', ') || '(none)'}`);

    // ── System diagnosis (short-circuit path) ──
    const sysDiag = buildSystemDiagnosis(input, subjects);

    console.log(`\n### Full system response`);
    if (sysDiag) {
      console.log(`  [System diagnosis path — concise format]`);
      console.log(`  Subject: ${sysDiag.subject}`);
      console.log(`\n  --- Body ---`);
      console.log(sysDiag.comparisonSummary);
      console.log(`\n  --- Follow-up ---`);
      console.log(sysDiag.followUp);

      if (sysDiag.philosophy) console.log(`\n  [WARNING] philosophy field populated: ${sysDiag.philosophy}`);
      if (sysDiag.tendencies) console.log(`\n  [WARNING] tendencies field populated: ${sysDiag.tendencies}`);
      if (sysDiag.systemContext) console.log(`\n  [WARNING] systemContext field populated: ${sysDiag.systemContext}`);
    } else {
      console.log(`  [No system diagnosis produced — would fall through to evaluate engine]`);
      console.log(`  Intent: ${intentResult.intent}`);
      console.log(`  Subjects: ${subjects.length}`);
      if (intentResult.intent !== 'diagnosis') {
        console.log(`  [WARNING] Intent is NOT diagnosis — this input may not trigger diagnosis behavior`);
      }
      if (subjects.length === 0) {
        console.log(`  [INFO] No system components detected — evaluate engine will handle generically`);
      }
    }

    // ── Basic assertions (loose — just ensure pipeline doesn't crash) ──
    expect(intentResult.intent).toBeDefined();
    expect(subjects).toBeDefined();
  });
}
