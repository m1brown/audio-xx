/**
 * QA Rerun — Execute the 6-turn conversation in both contexts
 * against the actual routing and builder functions.
 *
 * Also includes:
 * - intakeShownRef validation with a simpler intake-triggering prompt
 * - Additional hypothetical system modification scenarios
 * - Turn 1 clarification quality check
 */
import { describe, it } from 'vitest';
import { routeConversation, resolveMode, type ConversationMode } from '@/lib/conversation-router';
import { detectIntent } from '@/lib/intent';
import { isIntakeQuery, buildIntakeResponse } from '@/lib/intake';
import { buildConsultationEntry } from '@/lib/consultation';
import { getClarificationQuestion } from '@/lib/clarification';
import type { ExtractedSignals } from '@/lib/signal-types';
import type { EvaluationResult } from '@/lib/rule-types';
import type { ActiveSystemContext } from '@/lib/system-types';

const TURNS = [
  { label: 'T1', msg: 'I want to build a simple stereo for a small room. I mostly listen to jazz, acoustic music, and vocals. I care more about natural tone and flow than hyper-detail. Where should I start?' },
  { label: 'T2', msg: "I'm sensitive to brightness and fatigue. I want something engaging, but not sharp or clinical." },
  { label: 'T3', msg: "Let's say I already have a tube amp. How would that change the direction?" },
  { label: 'T4', msg: "I've been reading about Chord and Denafrips — how do those two approaches compare for someone with my preferences?" },
  { label: 'T5', msg: "Actually, maybe I shouldn't change anything yet. Based on what I've said so far, is there a case for doing nothing for now?" },
  { label: 'T6', msg: "Also, what if one of the products I'm considering isn't in your database? How would you handle that?" },
];

const SAVED_SYSTEM: ActiveSystemContext = {
  name: 'Living Room',
  components: [
    { brand: 'WLM', name: 'Diva Monitor', role: 'speakers' },
    { brand: 'Goldmund', name: 'JOB Integrated', role: 'amplifier' },
    { brand: 'Chord', name: 'Hugo', role: 'dac' },
    { brand: 'Eversolo', name: 'DMP-A6', role: 'streamer' },
  ],
  tendencies: 'neutral-to-analytical, controlled, precise',
};

function runConversation(activeSystem: ActiveSystemContext | null): void {
  let priorMode: ConversationMode | undefined;
  let intakeShown = false;

  for (const turn of TURNS) {
    console.log(`\n--- ${turn.label}: "${turn.msg.slice(0, 80)}${turn.msg.length > 80 ? '...' : ''}" ---`);

    const routedMode = routeConversation(turn.msg);
    const effectiveMode = resolveMode(routedMode, priorMode);

    let { intent, subjects, subjectMatches, desires } = detectIntent(turn.msg);

    let intakeOverride = false;
    if (intakeShown) {
      intakeShown = false;
      const strongNonShoppingMode = routedMode === 'diagnosis' || routedMode === 'consultation';
      if (!strongNonShoppingMode) {
        intent = 'shopping';
        intakeOverride = true;
      }
    }

    const isIntake = isIntakeQuery(turn.msg, subjectMatches.length);

    // Mode-aware override (mirrors page.tsx)
    let modeOverride = '';
    if (effectiveMode === 'shopping' && intent !== 'shopping' && intent !== 'product_assessment') {
      intent = 'shopping';
      modeOverride = ' [SHOPPING MODE OVERRIDE]';
    }
    if (effectiveMode === 'diagnosis' && intent !== 'comparison' && intent !== 'gear_inquiry' && intent !== 'system_assessment') {
      intent = 'diagnosis';
      modeOverride = ' [DIAGNOSIS MODE OVERRIDE]';
    }

    console.log(`  routedMode=${routedMode}  effectiveMode=${effectiveMode}  prior=${priorMode ?? 'none'}`);
    console.log(`  intent=${intent}${intakeOverride ? ' [INTAKE→SHOP]' : ''}${modeOverride}`);
    console.log(`  subjects=[${subjects.join(', ')}]  desires=[${desires.map(d => `${d.direction} ${d.quality}`).join(', ')}]  isIntake=${isIntake}`);

    // Simulate dispatch
    if (isIntake && intent === 'intake') {
      const intake = buildIntakeResponse(turn.msg);
      console.log(`  → INTAKE: scope=${intake.scope}`);
      console.log(`    "${intake.greeting.slice(0, 120)}"`);
      intakeShown = true;
    } else if (intent === 'consultation_entry') {
      const result = buildConsultationEntry(turn.msg, desires, activeSystem);
      console.log(`  → CONSULTATION_ENTRY: subject="${result.subject}"`);
      console.log(`    philosophy: "${result.philosophy?.slice(0, 200)}"`);
      console.log(`    tendencies: "${result.tendencies?.slice(0, 250)}"`);
      console.log(`    followUp: "${result.followUp?.slice(0, 200)}"`);
    } else if (intent === 'diagnosis') {
      console.log(`  → DIAGNOSIS PATH (evaluation engine fires)`);
    } else if (intent === 'shopping') {
      console.log(`  → SHOPPING PATH`);
    } else if (intent === 'comparison') {
      console.log(`  → COMPARISON BUILDER (subjects: ${subjects.join(' vs ')})`);
    } else if (intent === 'gear_inquiry') {
      console.log(`  → GEAR INQUIRY (subjects: ${subjects.join(', ')})`);
    } else {
      console.log(`  → ${intent.toUpperCase()} PATH`);
    }

    priorMode = effectiveMode;
  }
}

describe('QA Rerun — 6-Turn Conversation', () => {
  it('Context 1 — New User (no saved system)', () => {
    console.log('\n' + '='.repeat(70));
    console.log('CONTEXT 1: NEW USER (no saved system)');
    console.log('='.repeat(70));
    runConversation(null);
  });

  it('Context 2 — Saved System (WLM Diva → JOB → Hugo → Eversolo)', () => {
    console.log('\n' + '='.repeat(70));
    console.log('CONTEXT 2: SAVED SYSTEM');
    console.log('='.repeat(70));
    runConversation(SAVED_SYSTEM);
  });
});

describe('intakeShownRef Fix Validation', () => {
  it('Simple prompt triggers intake, then diagnosis breaks lock', () => {
    console.log('\n' + '='.repeat(70));
    console.log('INTAKE LOCK VALIDATION');
    console.log('='.repeat(70));

    const intakeMsg = 'I want a new stereo';
    const diagnosisMsg = "I'm sensitive to brightness and fatigue. I want something engaging, but not sharp or clinical.";

    // Turn 1: should trigger intake
    const r1 = routeConversation(intakeMsg);
    const { intent: i1, subjectMatches: sm1 } = detectIntent(intakeMsg);
    const isIntake = isIntakeQuery(intakeMsg, sm1.length);
    console.log(`\n--- INTAKE TURN: "${intakeMsg}" ---`);
    console.log(`  routedMode=${r1}  intent=${i1}  isIntake=${isIntake}`);
    if (isIntake) {
      const intake = buildIntakeResponse(intakeMsg);
      console.log(`  → INTAKE FIRES: scope=${intake.scope}`);
      console.log(`    "${intake.greeting}"`);
    }

    // Turn 2: diagnosis after intake — should NOT be forced to shopping
    const r2 = routeConversation(diagnosisMsg);
    const e2 = resolveMode(r2, r1);
    let { intent: i2 } = detectIntent(diagnosisMsg);

    // Simulate intakeShownRef logic
    let intakeShown = isIntake;
    if (intakeShown) {
      intakeShown = false;
      const strongNonShoppingMode = r2 === 'diagnosis' || r2 === 'consultation';
      if (!strongNonShoppingMode) {
        i2 = 'shopping';
      }
    }
    console.log(`\n--- POST-INTAKE DIAGNOSIS: "${diagnosisMsg.slice(0, 70)}..." ---`);
    console.log(`  routedMode=${r2}  effectiveMode=${e2}  intent=${i2}`);
    console.log(`  → ${i2 === 'diagnosis' ? 'PASS: Diagnosis intent preserved (intake lock broken)' : `FAIL: Intent forced to ${i2}`}`);

    // Turn 3: also try a shopping message after intake to verify shopping still works
    const shopMsg = "I'm looking for a DAC under $1000";
    const r3 = routeConversation(shopMsg);
    let { intent: i3, subjectMatches: sm3 } = detectIntent(shopMsg);
    const isIntake3 = isIntakeQuery(shopMsg, sm3.length);

    // Reset intakeShown for this simulation
    let intakeShown2 = true; // simulate post-intake
    if (intakeShown2) {
      intakeShown2 = false;
      const strongNonShoppingMode = r3 === 'diagnosis' || r3 === 'consultation';
      if (!strongNonShoppingMode) {
        i3 = 'shopping';
      }
    }
    console.log(`\n--- POST-INTAKE SHOPPING: "${shopMsg}" ---`);
    console.log(`  routedMode=${r3}  intent=${i3}`);
    console.log(`  → ${i3 === 'shopping' ? 'PASS: Shopping intent preserved after intake' : `FAIL: Intent became ${i3}`}`);
  });
});

describe('Turn 1 Response Quality', () => {
  it('First-turn clarification mirrors priorities for system-building query', () => {
    console.log('\n' + '='.repeat(70));
    console.log('TURN 1 QUALITY — Clarification output');
    console.log('='.repeat(70));

    const msg = 'I want to build a simple stereo for a small room. I mostly listen to jazz, acoustic music, and vocals. I care more about natural tone and flow than hyper-detail. Where should I start?';

    // Synthetic signal data matching what processText would produce for this message.
    // "natural" and "flow" are the key matched phrases.
    const signals: ExtractedSignals = {
      traits: { naturalness: 'increase', flow: 'increase' },
      symptoms: ['naturalness_desired', 'flow_desired'],
      archetype_hints: [],
      uncertainty_level: 0,
      matched_phrases: ['natural', 'flow'],
      matched_uncertainty_markers: [],
    };

    // Simulate a generic result (only fallback fires) so ambiguity check triggers
    const result: EvaluationResult = {
      fired_rules: [{
        id: 'friendly-advisor-fallback',
        label: 'Friendly advisor fallback',
        priority: 99,
        outputs: {
          explanation: 'Generic fallback',
          suggestions: [],
          risks: [],
          next_step: '',
          verdict: 'no_purchase_recommended',
        },
      }],
      archetype_conflict_detected: false,
      uncertainty_level: 0,
    };

    console.log(`\n  Matched phrases: [${signals.matched_phrases.join(', ')}]`);
    console.log(`  Symptoms: [${signals.symptoms.join(', ')}]`);
    console.log(`  Fired rules: [${result.fired_rules.map(r => r.id).join(', ')}]`);

    const clarification = getClarificationQuestion(signals, result, 1, msg, msg);
    if (clarification) {
      console.log(`\n  CLARIFICATION FIRES:`);
      console.log(`    Acknowledge: "${clarification.acknowledge}"`);
      if (clarification.context) console.log(`    Context: "${clarification.context}"`);
      console.log(`    Question: "${clarification.question}"`);
    } else {
      console.log(`\n  NO CLARIFICATION — goes straight to analysis`);
    }
  });
});

describe('Hypothetical Scenarios', () => {
  it('Tube amp hypothetical (T3)', () => {
    console.log('\n' + '='.repeat(70));
    console.log('HYPOTHETICAL: tube amp');
    console.log('='.repeat(70));

    const msg = "Let's say I already have a tube amp. How would that change the direction?";
    const routedMode = routeConversation(msg);
    const { intent, desires } = detectIntent(msg);

    console.log(`  routedMode=${routedMode}  intent=${intent}`);

    if (intent === 'consultation_entry') {
      // Test with no system
      const r1 = buildConsultationEntry(msg, desires, null);
      console.log(`\n  [No system]`);
      console.log(`    subject: "${r1.subject}"`);
      console.log(`    philosophy: "${r1.philosophy?.slice(0, 200)}"`);
      console.log(`    tendencies: "${r1.tendencies?.slice(0, 250)}"`);

      // Test with saved system
      const r2 = buildConsultationEntry(msg, desires, SAVED_SYSTEM);
      console.log(`\n  [Saved system]`);
      console.log(`    subject: "${r2.subject}"`);
      console.log(`    philosophy: "${r2.philosophy?.slice(0, 250)}"`);
      console.log(`    tendencies: "${r2.tendencies?.slice(0, 250)}"`);
    }
  });

  it('R2R DAC hypothetical', () => {
    const msg = "What if I switched to an R2R DAC? Would that help with the analytical quality?";
    const routedMode = routeConversation(msg);
    const { intent, desires } = detectIntent(msg);

    console.log(`\n  msg: "${msg}"`);
    console.log(`  routedMode=${routedMode}  intent=${intent}`);

    if (intent === 'consultation_entry') {
      const result = buildConsultationEntry(msg, desires, SAVED_SYSTEM);
      console.log(`  subject: "${result.subject}"`);
      console.log(`  philosophy: "${result.philosophy?.slice(0, 250)}"`);
    }
  });

  it('Planar speaker hypothetical', () => {
    const msg = "Suppose I went with planar speakers instead — how would that change things?";
    const routedMode = routeConversation(msg);
    const { intent, desires } = detectIntent(msg);

    console.log(`\n  msg: "${msg}"`);
    console.log(`  routedMode=${routedMode}  intent=${intent}`);

    if (intent === 'consultation_entry') {
      const result = buildConsultationEntry(msg, desires, SAVED_SYSTEM);
      console.log(`  subject: "${result.subject}"`);
      console.log(`  philosophy: "${result.philosophy?.slice(0, 250)}"`);
    }
  });
});
