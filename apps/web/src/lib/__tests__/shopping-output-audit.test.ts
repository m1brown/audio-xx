/**
 * Shopping output audit — runs each query through the real pipeline
 * and prints the exact user-facing output structure.
 */

import { detectIntent } from '@/lib/intent';
import { detectShoppingIntent, buildShoppingAnswer, parseBudgetAmount } from '@/lib/shopping-intent';
import { shoppingToAdvisory } from '@/lib/advisory-response';
import { reason } from '@/lib/reasoning';
import { routeConversation } from '@/lib/conversation-router';

const SIGNALS = { traits: {}, symptoms: [], direction: [], preserve: [], context: [] } as any;

const QUERIES = [
  'I want speakers under 1500 for rock',
  'I want a DAC under 1000 for a lean system',
  'I want an amplifier under 3000 for KEF speakers',
  'I want a turntable under 1000',
  'I want headphones under 200',
];

describe('Shopping output audit — rendered content for each query', () => {
  for (const query of QUERIES) {
    it(`produces recommendation output for: "${query}"`, () => {
      // ── 1. Intent detection ──
      const { intent, desires } = detectIntent(query);
      const routedMode = routeConversation(query);

      // ── 2. Shopping context ──
      const ctx = detectShoppingIntent(query, SIGNALS);

      // ── 3. Reasoning ──
      const reasoningResult = reason(query, desires, SIGNALS, undefined, undefined);

      // ── 4. Shopping answer ──
      const answer = buildShoppingAnswer(ctx, SIGNALS, undefined, reasoningResult);

      // ── 5. Advisory response ──
      const advisory = shoppingToAdvisory(answer, SIGNALS, reasoningResult);

      // ── Print full audit ──
      const divider = '═'.repeat(70);
      const lines: string[] = [];
      lines.push('');
      lines.push(divider);
      lines.push(`QUERY: "${query}"`);
      lines.push(divider);
      lines.push(`  intent: ${intent}`);
      lines.push(`  routedMode: ${routedMode}`);
      lines.push(`  detected: ${ctx.detected}`);
      lines.push(`  category: ${ctx.category}`);
      lines.push(`  budgetAmount: ${ctx.budgetAmount}`);
      lines.push(`  budgetMentioned: ${ctx.budgetMentioned}`);
      lines.push(`  mode: ${ctx.mode}`);
      lines.push(`  tasteProvided: ${ctx.tasteProvided}`);
      lines.push(`  systemProvided: ${ctx.systemProvided}`);
      lines.push('');

      // Products
      lines.push(`  PRODUCTS (${answer.productExamples.length}):`);
      if (answer.productExamples.length === 0) {
        lines.push('    ⚠ NO PRODUCTS — user would see "balanced presentation" fallback');
      }
      for (let i = 0; i < answer.productExamples.length; i++) {
        const p = answer.productExamples[i];
        lines.push(`    ${i + 1}. ${p.brand} ${p.name}`);
        lines.push(`       Price: ~$${p.price?.toLocaleString() ?? '?'}${p.usedPriceRange ? ` · used $${p.usedPriceRange.low.toLocaleString()}–$${p.usedPriceRange.high.toLocaleString()}` : ''}`);
        if (p.standoutFeatures?.length) {
          for (const f of p.standoutFeatures.slice(0, 3)) {
            lines.push(`       • ${f}`);
          }
        }
        if (p.soundProfile?.length) {
          for (const s of p.soundProfile.slice(0, 2)) {
            lines.push(`       ♪ ${s}`);
          }
        }
        if (p.fitNote) {
          lines.push(`       → ${p.fitNote}`);
        }
        lines.push('');
      }

      // System interpretation (new reasoning layer)
      if (advisory.systemInterpretation) {
        lines.push(`  SYSTEM INTERPRETATION:`);
        lines.push(`    ${advisory.systemInterpretation}`);
        lines.push('');
      }

      // Strategy bullets (new conceptual guidance layer)
      if (advisory.strategyBullets && advisory.strategyBullets.length > 0) {
        lines.push(`  STRATEGY:`);
        for (const b of advisory.strategyBullets) {
          lines.push(`    • ${b}`);
        }
        lines.push('');
      }

      // Advisory fields
      lines.push(`  ADVISORY FIELDS:`);
      lines.push(`    options count: ${advisory.options?.length ?? 0}`);
      lines.push(`    has audioProfile: ${!!advisory.audioProfile}`);
      lines.push(`    provisional: ${advisory.provisional}`);
      lines.push(`    statedGaps: ${advisory.statedGaps?.join(', ') || 'none'}`);
      lines.push(`    followUp: ${advisory.followUp ?? 'none'}`);
      lines.push(`    comparisonSummary: ${advisory.comparisonSummary ? advisory.comparisonSummary.slice(0, 100) + '...' : 'none'}`);

      // Would EditorialFormat render?
      const wouldRenderEditorial = !!(advisory.options && advisory.options.length > 0);
      lines.push('');
      lines.push(`  RENDERS AS: ${wouldRenderEditorial ? '✅ EditorialFormat (product cards)' : '❌ StandardFormat (balanced presentation fallback)'}`);
      lines.push('');

      // Decision guidance (what EditorialFormat would build)
      if (advisory.options && advisory.options.length >= 2) {
        lines.push(`  DECISION GUIDANCE:`);
        for (const opt of advisory.options) {
          const name = [opt.brand, opt.name].filter(Boolean).join(' ');
          const raw = opt.fitNote || opt.character || '';
          if (raw) {
            const quality = raw.replace(/^best for\s+/i, '').split('.')[0].trim();
            if (quality && quality.length <= 60) {
              lines.push(`    If you want ${quality.toLowerCase()} → ${name}`);
            }
          }
        }
      }

      lines.push(divider);

      console.log(lines.join('\n'));

      // ── Assertions ──
      expect(ctx.detected).toBe(true);
      expect(answer.productExamples.length).toBeGreaterThanOrEqual(1);
      expect(advisory.options?.length).toBeGreaterThanOrEqual(1);
      expect(wouldRenderEditorial).toBe(true);
    });
  }
});
