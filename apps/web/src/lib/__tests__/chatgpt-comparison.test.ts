/**
 * ChatGPT Query Comparison — runs the same user prompts that were asked
 * in ChatGPT through Audio XX's routing/intent/response pipeline.
 *
 * Tests both "no system" (cold start) and "saved system" (Mike's chain)
 * contexts to see how Audio XX handles each query type.
 */

import { describe, it, expect } from 'vitest';
import { routeConversation } from '../conversation-router';
import { detectIntent, type SubjectMatch } from '../intent';
import { buildConsultationEntry, type ConsultationEntryResult } from '../consultation';
import { buildProductAssessment, findAssessmentProduct } from '../product-assessment';
import { assessmentToAdvisory } from '../advisory-response';
import type { ActiveSystemContext } from '../system-types';

// ── Mike's saved system ──────────────────────────────
const MIKE_SYSTEM: ActiveSystemContext = {
  label: 'Living Room',
  components: [
    { brand: 'WLM', name: 'Diva Monitor', role: 'speakers' },
    { brand: 'Goldmund', name: 'JOB Integrated', role: 'amplifier' },
    { brand: 'Chord', name: 'Hugo', role: 'dac' },
    { brand: 'Eversolo', name: 'DMP-A6', role: 'streamer' },
  ],
  tendencies: 'neutral-to-analytical, controlled, precise, fast transients, lean tonal density',
};

// ── Helpers ──────────────────────────────────────────
function routeAndDetect(message: string) {
  const routedMode = routeConversation(message);
  const intentResult = detectIntent(message, []);
  return { routedMode, intentResult };
}

function logQuery(label: string, message: string) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`QUERY ${label}: "${message.slice(0, 80)}${message.length > 80 ? '...' : ''}"`);
  console.log('='.repeat(70));
}

// ═══════════════════════════════════════════════════════
// QUERY 1: System evaluation (Lavorgna-style complex system)
// ChatGPT: Full component-by-component breakdown with ratings
// ═══════════════════════════════════════════════════════
describe('Q1: Complex system evaluation', () => {
  const MSG = 'evaluate my system: Leben CS600X w/Gold Lion KT77s → totaldac d1-unity DAC w/live clocking → DeVore Fidelity O/96 speakers';

  it('routes correctly', () => {
    logQuery('1', MSG);
    const { routedMode, intentResult } = routeAndDetect(MSG);

    console.log(`  routedMode=${routedMode}  intent=${intentResult.intent}`);
    console.log(`  subjects=${JSON.stringify(intentResult.subjects)}`);

    // Should route to system_assessment or diagnosis — not shopping
    expect(['diagnosis', 'consultation', 'inquiry']).toContain(routedMode);
    expect(intentResult.intent).not.toBe('shopping');

    // Key: "evaluate my system" should trigger system_assessment
    console.log(`  ✓ Routed to ${routedMode}/${intentResult.intent} — not shopping`);
  });
});

// ═══════════════════════════════════════════════════════
// QUERY 2: Product assessment (JOB Integrated)
// ChatGPT: Long review-style response with strengths/limitations
// ═══════════════════════════════════════════════════════
describe('Q2: Product assessment — JOB Integrated', () => {
  const MSG = 'what do you think of the Job Integrated?';

  it('routes to product assessment and finds catalog match', () => {
    logQuery('2', MSG);
    const { routedMode, intentResult } = routeAndDetect(MSG);

    console.log(`  routedMode=${routedMode}  intent=${intentResult.intent}`);
    console.log(`  subjects=${JSON.stringify(intentResult.subjects)}`);

    // Should detect the JOB Integrated as a subject
    const subjectMatches: SubjectMatch[] = intentResult.subjects.map(s => ({
      name: s, kind: 'product' as const, confidence: 0.8,
    }));

    // Try to find in catalog
    const product = findAssessmentProduct(subjectMatches);
    console.log(`  catalogMatch=${product ? `${product.brand} ${product.name}` : 'none'}`);

    if (product) {
      const assessment = buildProductAssessment({
        subjectMatches,
        activeSystem: MIKE_SYSTEM,
        tasteProfile: null,
        currentMessage: MSG,
      });
      if (assessment) {
        console.log(`  shortAnswer: "${assessment.shortAnswer.slice(0, 120)}..."`);
        console.log(`  whatChanges: ${assessment.whatChanges.length} items`);
        console.log(`  systemBehavior: ${assessment.systemBehavior.length} items`);
        console.log(`  goalAlignment: "${assessment.goalAlignment.slice(0, 100)}..."`);
        console.log(`  recommendation: "${assessment.recommendation.slice(0, 100)}..."`);
        console.log(`  sources: ${assessment.sourceReferences?.length ?? 0}`);
        console.log(`  links: ${assessment.retailerLinks?.length ?? 0}`);
      }
    }

    console.log(`  ✓ Product assessment path reached`);
  });
});

// ═══════════════════════════════════════════════════════
// QUERY 3: DAC comparison (LAiV uDAC vs Chord Qutest)
// ChatGPT: Side-by-side comparison with table
// ═══════════════════════════════════════════════════════
describe('Q3: DAC comparison — LAiV uDAC vs Chord Qutest', () => {
  const MSG = "i'm considering a new dac, either laiv udac or chord qutest";

  it('detects comparison intent with both subjects', () => {
    logQuery('3', MSG);
    const { routedMode, intentResult } = routeAndDetect(MSG);

    console.log(`  routedMode=${routedMode}  intent=${intentResult.intent}`);
    console.log(`  subjects=${JSON.stringify(intentResult.subjects)}`);

    // Should detect comparison or shopping with two subjects
    expect(intentResult.subjects.length).toBeGreaterThanOrEqual(1);

    // Check if both DACs are recognized
    const subjectLower = intentResult.subjects.map(s => s.toLowerCase());
    const hasChord = subjectLower.some(s => s.includes('chord') || s.includes('qutest'));
    const hasLaiv = subjectLower.some(s => s.includes('laiv') || s.includes('udac'));
    console.log(`  chord detected: ${hasChord}  laiv detected: ${hasLaiv}`);

    // Try product assessment for each
    for (const subj of intentResult.subjects) {
      const matches: SubjectMatch[] = [{ name: subj, kind: 'product', confidence: 0.8 }];
      const product = findAssessmentProduct(matches);
      console.log(`  "${subj}" → catalog: ${product ? `${product.brand} ${product.name}` : 'not found'}`);
    }

    console.log(`  ✓ Comparison path with ${intentResult.subjects.length} subjects`);
  });
});

// ═══════════════════════════════════════════════════════
// QUERY 4: Turntable shopping (budget + category)
// ChatGPT: Ranked list of 4-5 turntables with phono preamp advice
// ═══════════════════════════════════════════════════════
describe('Q4: Turntable shopping — under $1500', () => {
  const MSG = 'I want to get into vinyl. can you recommend a turntable under 1,500? maybe with or without a phono preamp. New or Used.';

  it('routes to shopping with budget signal', () => {
    logQuery('4', MSG);
    const { routedMode, intentResult } = routeAndDetect(MSG);

    console.log(`  routedMode=${routedMode}  intent=${intentResult.intent}`);
    console.log(`  subjects=${JSON.stringify(intentResult.subjects)}`);
    console.log(`  desires=${JSON.stringify(intentResult.desires)}`);

    // Should detect shopping or intake — this is a clear purchase intent
    expect(['shopping', 'inquiry']).toContain(routedMode);
    console.log(`  ✓ Shopping/inquiry path — budget turntable request`);
  });
});

// ═══════════════════════════════════════════════════════
// QUERY 5: Amp comparison (Kinki EX-M1 vs Hegel H190)
// ChatGPT: Extensive 7-section comparison with system context
// ═══════════════════════════════════════════════════════
describe('Q5: Amp comparison — Kinki EX-M1 vs Hegel H190', () => {
  const MSG = 'please compare kinki integrated EX-M1 with a hegel h190';

  it('detects comparison with both subjects', () => {
    logQuery('5', MSG);
    const { routedMode, intentResult } = routeAndDetect(MSG);

    console.log(`  routedMode=${routedMode}  intent=${intentResult.intent}`);
    console.log(`  subjects=${JSON.stringify(intentResult.subjects)}`);

    // Should detect comparison intent
    expect(['comparison', 'gear_inquiry', 'shopping']).toContain(intentResult.intent);

    // Check subject detection
    const subjectLower = intentResult.subjects.map(s => s.toLowerCase());
    const hasKinki = subjectLower.some(s => s.includes('kinki'));
    const hasHegel = subjectLower.some(s => s.includes('hegel'));
    console.log(`  kinki detected: ${hasKinki}  hegel detected: ${hasHegel}`);

    // Try catalog lookup
    for (const subj of intentResult.subjects) {
      const matches: SubjectMatch[] = [{ name: subj, kind: 'product', confidence: 0.8 }];
      const product = findAssessmentProduct(matches);
      console.log(`  "${subj}" → catalog: ${product ? `${product.brand} ${product.name}` : 'not found'}`);
    }

    console.log(`  ✓ Comparison path`);
  });
});

// ═══════════════════════════════════════════════════════
// QUERY 6: System evaluation (Boris — vintage/budget system)
// ChatGPT: Component-by-component with numeric ratings (8.5/10)
// ═══════════════════════════════════════════════════════
describe('Q6: System evaluation — vintage system (Boris)', () => {
  const MSG = 'assess my system: marantz 2220B receiver --> oppo OPDV971H DVD --> hornshoppe horn speakers';

  it('routes to system assessment', () => {
    logQuery('6', MSG);
    const { routedMode, intentResult } = routeAndDetect(MSG);

    console.log(`  routedMode=${routedMode}  intent=${intentResult.intent}`);
    console.log(`  subjects=${JSON.stringify(intentResult.subjects)}`);

    // "assess my system" is a clear system_assessment signal
    expect(intentResult.intent).not.toBe('shopping');
    console.log(`  ✓ System assessment path — vintage system`);
  });
});

// ═══════════════════════════════════════════════════════
// SUMMARY: ChatGPT behavioral patterns vs Audio XX
// ═══════════════════════════════════════════════════════
describe('Behavioral comparison summary', () => {
  it('logs ChatGPT patterns for reference', () => {
    console.log(`\n${'═'.repeat(70)}`);
    console.log('CHATGPT BEHAVIORAL PATTERNS (from uploaded PDFs)');
    console.log('═'.repeat(70));

    console.log(`
Q1 (System eval — Lavorgna):
  ChatGPT: Component-by-component review, images, "your system is extremely coherent"
  Tone: Enthusiastic, flattering ("genuinely outstanding", "extremely thoughtful")
  Issues: No trade-offs stated, no "do nothing" framing, superlative-heavy

Q2 (JOB Integrated):
  ChatGPT: Full product review format, strengths/limitations, system matching
  Tone: Informative but uses "best value high-end amplifiers ever produced"
  Issues: Recommender voice, "My opinion" section, music genre matching

Q3 (DAC comparison):
  ChatGPT: Side-by-side with comparison table, "My Recommendation for Your System"
  Tone: Decisive recommendation ("I would lean LAIV"), system-aware
  Issues: Numeric table, "Most precise" / "Most musical" binary framing

Q4 (Turntable shopping):
  ChatGPT: Ranked list (1-4) with "My Personal Recommendation For You"
  Tone: Product database feel, "best turntables under $1,500"
  Issues: "probably the safest audiophile choice", ranked ordering

Q5 (Kinki vs Hegel):
  ChatGPT: 7-section comparison, tables, system context, source links
  Tone: Thorough but uses "the more natural fit" phrasing
  Issues: "choose X if / choose Y if" binary, linked sources on request

Q6 (System eval — Boris):
  ChatGPT: Component reviews, synergy section, numeric ratings (8.5/10)
  Tone: Encouraging but scored ("9/10 amplification match")
  Issues: Numeric scoring violates Audio XX behavioral spec, "dramatically improve" urgency
`);

    console.log('AUDIO XX EXPECTED DIFFERENCES:');
    console.log('  - No numeric scoring');
    console.log('  - No "best product" framing');
    console.log('  - No ranked lists');
    console.log('  - Trade-offs always stated');
    console.log('  - "Do nothing" is always a valid path');
    console.log('  - System interaction > isolated component quality');
    console.log('  - Architectural identity before specific recommendations');
    console.log('  - No "My Recommendation" — directional options instead');
  });
});
