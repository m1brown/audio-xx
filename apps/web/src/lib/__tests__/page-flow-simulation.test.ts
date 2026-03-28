/**
 * Page.tsx runtime flow simulation — Request 12.
 *
 * This test simulates the EXACT page.tsx flow, tracing every turn through:
 *   1. Conversation state machine (convTransition / detectInitialMode)
 *   2. Intent detection
 *   3. Shopping context construction (allUserText)
 *   4. Budget/context injection from lastShoppingFactsRef
 *   5. Product ranking and advisory output
 *
 * Critical page.tsx routing rules reproduced:
 *   - convState active → convTransition() absorbs turns
 *   - music_input mode → first message sets musicDescription, "speakers"→listeningPath
 *   - shopping/clarify_budget → plain numbers match PLAIN_BUDGET_PATTERN
 *   - ready_to_recommend → synthesizedQuery OR fallthrough to main pipeline
 *   - After first advisory: convState resets to idle, effectiveMode='shopping'
 *   - Subsequent turns: skip state machine (shoppingAnswerCount > 0 bypass)
 *   - allUserText = all prior user messages + current message, joined with \n
 */

import { describe, it, expect } from 'vitest';
import {
  transition as convTransition,
  detectInitialMode as detectConvMode,
  INITIAL_CONV_STATE,
} from '../conversation-state';
import type { ConvState } from '../conversation-state';
import { detectIntent } from '../intent';
import {
  detectShoppingIntent,
  buildShoppingAnswer,
  getShoppingClarification,
  countPreferenceSignals,
} from '../shopping-intent';
import type { ShoppingContext } from '../shopping-intent';
import { reason } from '../reasoning';
import { AMPLIFIER_PRODUCTS } from '../products/amplifiers';
import { SPEAKER_PRODUCTS } from '../products/speakers';
import type { ExtractedSignals } from '../signal-types';

const EMPTY_SIGNALS: ExtractedSignals = {
  traits: {},
  symptoms: [],
  archetype_hints: [],
  uncertainty_level: 0,
  matched_phrases: [],
  matched_uncertainty_markers: [],
};

interface TurnTrace {
  turn: number;
  userMessage: string;
  convMode: string;
  convStage: string;
  action: string;
  // Shopping fields (only when pipeline runs)
  category?: string;
  budget?: number | null;
  roomContext?: string | null;
  constraints?: { exclude: string[]; require: string[]; newOnly: boolean };
  semanticBigScale?: boolean;
  semanticEnergy?: string | null;
  products?: Array<{
    brand: string;
    name: string;
    price: number;
    topology?: string;
    availability?: string;
    brandScale?: string;
    dynamics?: number;
    budgetRealism?: string;
    pickRole?: string;
    subcategory?: string;
  }>;
}

function simulatePageFlow(turns: string[]): TurnTrace[] {
  let convState: ConvState = { ...INITIAL_CONV_STATE };
  let lastShoppingFacts: Record<string, any> | null = null;
  const userMessages: string[] = [];
  let shoppingAnswerCount = 0;
  let effectiveMode: string = 'idle';
  const traces: TurnTrace[] = [];

  for (let i = 0; i < turns.length; i++) {
    const text = turns[i];
    const turnNum = i + 1;
    const { intent } = detectIntent(text);
    let finalIntent = intent;
    let convModeHint: string | undefined;

    // ─── PHASE 1: Conversation state machine (when active) ───
    if (convState.mode !== 'idle') {
      const result = convTransition(convState, text, {
        hasSystem: false,
        subjectCount: 0,
        detectedIntent: intent,
      });
      convState = result.state;

      if (result.response) {
        if (result.response.kind === 'question') {
          traces.push({
            turn: turnNum,
            userMessage: text,
            convMode: convState.mode,
            convStage: convState.stage,
            action: `STATE_MACHINE_QUESTION: "${result.response.question}"`,
          });
          continue;
        }

        if (result.response.kind === 'proceed') {
          if (result.response.synthesizedQuery) {
            // ── SYNTHESIZED QUERY → shopping ──
            const synQuery = result.response.synthesizedQuery;
            const ctx = detectShoppingIntent(synQuery, EMPTY_SIGNALS);
            const r = reason(synQuery, [], EMPTY_SIGNALS, null, ctx, undefined);
            const answer = buildShoppingAnswer(ctx, EMPTY_SIGNALS, undefined, r);

            lastShoppingFacts = {
              budget: convState.facts.budget,
              fromScratch: convState.facts.fromScratch,
              roomContext: ctx.roomContext,
              musicHints: ctx.semanticPreferences.musicHints,
              energyLevel: ctx.semanticPreferences.energyLevel,
              wantsBigScale: ctx.semanticPreferences.wantsBigScale,
            };
            convState = { ...INITIAL_CONV_STATE };
            shoppingAnswerCount++;
            effectiveMode = 'shopping';

            const products = answer.productExamples.map((p) => {
              const cat = [...SPEAKER_PRODUCTS, ...AMPLIFIER_PRODUCTS].find(
                (c) => c.name === p.name && c.brand === p.brand,
              );
              return {
                brand: p.brand, name: p.name, price: p.price,
                topology: cat?.topology, availability: cat?.availability,
                brandScale: cat?.brandScale, dynamics: cat?.traits?.dynamics,
                budgetRealism: p.budgetRealism, pickRole: p.pickRole,
                subcategory: (cat as any)?.subcategory,
              };
            });

            traces.push({
              turn: turnNum,
              userMessage: text,
              convMode: 'shopping',
              convStage: 'synthesized',
              action: `SYNTHESIZED_ADVISORY: "${synQuery}"`,
              category: ctx.category,
              budget: ctx.budgetAmount,
              roomContext: ctx.roomContext,
              constraints: { exclude: ctx.constraints.excludeTopologies, require: ctx.constraints.requireTopologies, newOnly: ctx.constraints.newOnly },
              semanticBigScale: ctx.semanticPreferences.wantsBigScale,
              semanticEnergy: ctx.semanticPreferences.energyLevel,
              products,
            });
            userMessages.push(text);
            continue;
          }

          // ready_to_recommend without synthesized query
          if (convState.stage === 'ready_to_recommend') {
            convModeHint = 'shopping';
            lastShoppingFacts = {
              budget: convState.facts.budget,
              fromScratch: convState.facts.fromScratch,
            };
            convState = { ...INITIAL_CONV_STATE };
          }
        }
      }
    }

    // ─── PHASE 2: Initial mode detection (when idle) ───
    if (convState.mode === 'idle' && !convModeHint && !(effectiveMode === 'shopping' && shoppingAnswerCount > 0)) {
      const initialMode = detectConvMode(text, {
        detectedIntent: intent,
        hasSystem: false,
        subjectCount: 0,
      });

      if (initialMode) {
        convState = initialMode;

        // music_input → falls through to music handler (not shopping)
        if (initialMode.mode === 'music_input') {
          traces.push({
            turn: turnNum,
            userMessage: text,
            convMode: 'music_input',
            convStage: initialMode.stage,
            action: 'MUSIC_INPUT_ENTRY (waiting for listening path)',
          });
          userMessages.push(text);
          continue;
        }

        // orientation → asks buy/improve/fix
        if (initialMode.mode === 'orientation') {
          traces.push({
            turn: turnNum,
            userMessage: text,
            convMode: 'orientation',
            convStage: 'entry',
            action: 'ORIENTATION_QUESTION',
          });
          userMessages.push(text);
          continue;
        }

        // shopping → set intent override
        if (initialMode.mode === 'shopping') {
          finalIntent = 'shopping';
          if (initialMode.stage !== 'ready_to_recommend') {
            traces.push({
              turn: turnNum,
              userMessage: text,
              convMode: 'shopping',
              convStage: initialMode.stage,
              action: `STATE_MACHINE_CLARIFY: stage=${initialMode.stage}`,
            });
            userMessages.push(text);
            continue;
          }
        }
      }
    }

    // ─── PHASE 3: Shopping pipeline ───
    if (finalIntent === 'shopping' || convModeHint === 'shopping' || (effectiveMode === 'shopping' && shoppingAnswerCount > 0)) {
      userMessages.push(text);
      const allUserText = userMessages.join('\n');

      const shoppingCtx = detectShoppingIntent(
        allUserText, EMPTY_SIGNALS, undefined,
        shoppingAnswerCount > 0 ? text : undefined,
      );

      // ── Inject preserved context from prior round ──
      if (shoppingAnswerCount > 0 && lastShoppingFacts) {
        const saved = lastShoppingFacts;
        // Budget: check budgetAmount, not budgetMentioned (same-budget fix)
        if (!shoppingCtx.budgetAmount && saved.budget) {
          const amount = parseInt(String(saved.budget).replace(/[$,]/g, ''), 10);
          if (!isNaN(amount)) {
            shoppingCtx.budgetMentioned = true;
            shoppingCtx.budgetAmount = amount;
          }
        }
        if (!shoppingCtx.roomContext && saved.roomContext) {
          shoppingCtx.roomContext = saved.roomContext;
        }
        const sp = shoppingCtx.semanticPreferences;
        if (!sp.energyLevel && saved.energyLevel) sp.energyLevel = saved.energyLevel;
        if (!sp.wantsBigScale && saved.wantsBigScale) sp.wantsBigScale = true;
        if (sp.musicHints.length === 0 && saved.musicHints?.length > 0) sp.musicHints = saved.musicHints;

        // Constraint accumulation: merge saved constraints with current
        if (saved.constraints) {
          const cur = shoppingCtx.constraints;
          for (const t of (saved.constraints.excludeTopologies ?? [])) {
            if (!cur.excludeTopologies.includes(t)) cur.excludeTopologies.push(t);
          }
          for (const t of (saved.constraints.requireTopologies ?? [])) {
            if (!cur.requireTopologies.includes(t)) cur.requireTopologies.push(t);
          }
          if (saved.constraints.newOnly && !cur.newOnly) cur.newOnly = true;
          if (saved.constraints.usedOnly && !cur.usedOnly) cur.usedOnly = true;
        }

        // Category carry-forward
        if (shoppingCtx.category === 'general' && saved.category && saved.category !== 'general') {
          shoppingCtx.category = saved.category;
        }
      }

      // Clarification or recommendation?
      const pastClarificationCap = shoppingAnswerCount > 0 || userMessages.length > 2;
      const question = pastClarificationCap
        ? null
        : getShoppingClarification(shoppingCtx, EMPTY_SIGNALS, userMessages.length, false);

      if (question) {
        traces.push({
          turn: turnNum,
          userMessage: text,
          convMode: 'shopping',
          convStage: 'clarifying',
          action: `SHOPPING_CLARIFICATION: "${question}"`,
          category: shoppingCtx.category,
          budget: shoppingCtx.budgetAmount,
        });
        continue;
      }

      // Build recommendation
      const r = reason(allUserText, [], EMPTY_SIGNALS, null, shoppingCtx, undefined);
      const answer = buildShoppingAnswer(shoppingCtx, EMPTY_SIGNALS, undefined, r);

      // Preserve context (with constraint accumulation)
      const mergedConstraints = {
        excludeTopologies: [
          ...new Set([
            ...(lastShoppingFacts?.constraints?.excludeTopologies ?? []),
            ...shoppingCtx.constraints.excludeTopologies,
          ]),
        ],
        requireTopologies: [
          ...new Set([
            ...(lastShoppingFacts?.constraints?.requireTopologies ?? []),
            ...shoppingCtx.constraints.requireTopologies,
          ]),
        ],
        newOnly: shoppingCtx.constraints.newOnly || (lastShoppingFacts?.constraints?.newOnly ?? false),
        usedOnly: shoppingCtx.constraints.usedOnly || (lastShoppingFacts?.constraints?.usedOnly ?? false),
      };
      lastShoppingFacts = {
        ...(lastShoppingFacts ?? {}),
        budget: shoppingCtx.budgetAmount ? `$${shoppingCtx.budgetAmount}` : lastShoppingFacts?.budget,
        roomContext: shoppingCtx.roomContext ?? lastShoppingFacts?.roomContext,
        musicHints: shoppingCtx.semanticPreferences.musicHints.length > 0
          ? shoppingCtx.semanticPreferences.musicHints
          : lastShoppingFacts?.musicHints,
        energyLevel: shoppingCtx.semanticPreferences.energyLevel ?? lastShoppingFacts?.energyLevel,
        wantsBigScale: shoppingCtx.semanticPreferences.wantsBigScale || lastShoppingFacts?.wantsBigScale,
        constraints: mergedConstraints,
        category: shoppingCtx.category !== 'general' ? shoppingCtx.category : lastShoppingFacts?.category,
      };

      shoppingAnswerCount++;
      effectiveMode = 'shopping';

      const products = answer.productExamples.map((p) => {
        const cat = [...SPEAKER_PRODUCTS, ...AMPLIFIER_PRODUCTS].find(
          (c) => c.name === p.name && c.brand === p.brand,
        );
        return {
          brand: p.brand, name: p.name, price: p.price,
          topology: cat?.topology, availability: cat?.availability,
          brandScale: cat?.brandScale, dynamics: cat?.traits?.dynamics,
          budgetRealism: p.budgetRealism, pickRole: p.pickRole,
          subcategory: (cat as any)?.subcategory,
        };
      });

      traces.push({
        turn: turnNum,
        userMessage: text,
        convMode: 'shopping',
        convStage: `advisory_#${shoppingAnswerCount}`,
        action: `SHOPPING_ADVISORY`,
        category: shoppingCtx.category,
        budget: shoppingCtx.budgetAmount,
        roomContext: shoppingCtx.roomContext,
        constraints: { exclude: shoppingCtx.constraints.excludeTopologies, require: shoppingCtx.constraints.requireTopologies, newOnly: shoppingCtx.constraints.newOnly },
        semanticBigScale: shoppingCtx.semanticPreferences.wantsBigScale,
        semanticEnergy: shoppingCtx.semanticPreferences.energyLevel,
        products,
      });
      continue;
    }

    // Fallthrough
    userMessages.push(text);
    traces.push({
      turn: turnNum,
      userMessage: text,
      convMode: convState.mode,
      convStage: convState.stage,
      action: `FALLTHROUGH: intent=${finalIntent}`,
    });
  }

  return traces;
}

describe('Page.tsx runtime flow simulation', () => {
  it('full 10-turn validation flow', () => {
    const turns = [
      'i like van halen',
      'speakers',
      'starting from scratch',
      '5000',
      'large living room',
      'i want big scale',
      'what about amps? same budget',
      "i don't want tubes",
      'i want new',
      'class ab amps',
    ];

    const traces = simulatePageFlow(turns);

    console.log('\n' + '═'.repeat(70));
    console.log('  PAGE.TSX RUNTIME FLOW SIMULATION (corrected)');
    console.log('═'.repeat(70));

    for (const t of traces) {
      console.log(`\n── TURN ${t.turn}: "${t.userMessage}" ──`);
      console.log(`  mode: ${t.convMode}/${t.convStage}`);
      console.log(`  action: ${t.action}`);

      if (t.category !== undefined) {
        console.log(`  category: ${t.category} | budget: $${t.budget} | room: ${t.roomContext}`);
      }
      if (t.constraints) {
        console.log(`  constraints: exclude=[${t.constraints.exclude}] require=[${t.constraints.require}] newOnly=${t.constraints.newOnly}`);
      }
      if (t.semanticBigScale !== undefined || t.semanticEnergy !== undefined) {
        console.log(`  semantic: bigScale=${t.semanticBigScale}, energy=${t.semanticEnergy}`);
      }

      if (t.products) {
        console.log(`  products (${t.products.length}):`);
        for (const p of t.products) {
          const flags: string[] = [];
          if (p.topology) flags.push(`topo:${p.topology}`);
          if (p.subcategory) flags.push(`sub:${p.subcategory}`);
          if (p.availability) flags.push(`avail:${p.availability}`);
          if (p.brandScale) flags.push(`brand:${p.brandScale}`);
          if (p.dynamics !== undefined) flags.push(`dyn:${p.dynamics}`);
          if (p.budgetRealism) flags.push(`realism:${p.budgetRealism}`);
          if (p.pickRole) flags.push(`role:${p.pickRole}`);
          console.log(`    ${p.brand} ${p.name} ($${p.price}) [${flags.join(', ')}]`);

          // VIOLATION CHECKS
          if (t.constraints?.require?.length && p.topology && !t.constraints.require.includes(p.topology)) {
            console.log(`      ❌ TOPOLOGY VIOLATION: ${p.topology} not in [${t.constraints.require}]`);
          }
          if (t.constraints?.exclude?.length && p.topology && t.constraints.exclude.includes(p.topology)) {
            console.log(`      ❌ EXCLUDED TOPOLOGY: ${p.topology}`);
          }
          if (t.constraints?.newOnly && (p.availability === 'discontinued' || p.availability === 'vintage')) {
            console.log(`      ❌ DISCONTINUED after newOnly`);
          }
          if (t.budget && p.price > t.budget * 1.15) {
            console.log(`      ❌ OVER BUDGET: $${p.price} > $${t.budget} (115%=$${Math.round(t.budget * 1.15)})`);
          }
          if (p.subcategory === 'standmount' && t.roomContext === 'large') {
            console.log(`      ❌ STANDMOUNT in large room`);
          }
        }
      }
    }

    // ── FINAL ASSERTIONS ──
    console.log('\n' + '─'.repeat(70));
    console.log('  ASSERTION CHECKS');
    console.log('─'.repeat(70));

    // Check that amp turns have budget
    const ampTurns = traces.filter(t => t.category === 'amplifier' && t.products?.length);
    const lastAmp = ampTurns[ampTurns.length - 1];
    console.log(`\n  Last amp turn: Turn ${lastAmp?.turn}`);
    console.log(`    Budget: $${lastAmp?.budget}`);
    expect(lastAmp?.budget).toBe(5000);

    // Check constraints on last amp turn
    if (lastAmp?.products) {
      let failures = 0;
      for (const p of lastAmp.products) {
        if (p.topology && p.topology !== 'class-ab-solid-state') failures++;
        if (p.availability === 'discontinued' || p.availability === 'vintage') failures++;
        if (lastAmp.budget && p.price > lastAmp.budget * 1.15) failures++;
      }
      console.log(`    Constraint violations: ${failures}`);
      expect(failures).toBe(0);
    }

    // Check no standmounts in large-room speaker turns
    const speakerTurns = traces.filter(t => t.category === 'speaker' && t.roomContext === 'large' && t.products?.length);
    for (const st of speakerTurns) {
      for (const p of st.products!) {
        expect(p.subcategory).not.toBe('standmount');
      }
    }

    console.log('\n' + '═'.repeat(70));
    console.log('  ALL ASSERTIONS PASSED');
    console.log('═'.repeat(70) + '\n');
  });
});
