/**
 * Personalization split tests.
 *
 * Verifies that saved-system context is separated from main answer framing:
 *
 *   1. Inline system still drives main answer (systemComponents populated)
 *   2. Saved system does NOT populate main answer for general queries
 *   3. Saved system appears as secondary savedSystemNote
 *   4. Assessment mode remains unchanged (systemComponents restored)
 *
 * These tests cover the advisory context split in page.tsx (tested indirectly
 * through buildTurnContext) and the converter threading in advisory-response.ts.
 */

import { buildTurnContext } from '../turn-context';
import {
  consultationToAdvisory,
  gearResponseToAdvisory,
  knowledgeToAdvisory,
  shoppingToAdvisory,
} from '../advisory-response';
import type { ShoppingAdvisoryContext } from '../advisory-response';
import type { AudioSessionState, SavedSystem } from '../system-types';
import type { ConsultationResponse } from '../consultation';
import type { GearResponse } from '../conversation-types';

// ── Fixtures ──────────────────────────────────────────

const SAVED_SYSTEM: SavedSystem = {
  id: 'saved-1',
  name: 'Studio Rig',
  components: [
    { id: 'c1', componentId: 'p1', name: 'Focal Utopia', brand: 'Focal', category: 'headphones', role: null, notes: null },
    { id: 'c2', componentId: 'p2', name: 'Chord Hugo TT2', brand: 'Chord', category: 'dac', role: null, notes: null },
  ],
  tendencies: 'resolving, fast transients',
  notes: null,
  location: null,
  room: null,
  primaryUse: null,
};

function stateWithSaved(): AudioSessionState {
  return {
    activeSystemRef: { kind: 'saved', id: 'saved-1' },
    savedSystems: [SAVED_SYSTEM],
    draftSystem: null,
    loading: false,
    proposedSystem: null,
  };
}

function emptyState(): AudioSessionState {
  return {
    activeSystemRef: null,
    savedSystems: [],
    draftSystem: null,
    loading: false,
    proposedSystem: null,
  };
}

const NO_DISMISSED = new Set<string>();

// Helper: simulate advisoryCtx split logic from page.tsx
function buildAdvisoryCtx(turnCtx: ReturnType<typeof buildTurnContext>): {
  advisoryCtx: ShoppingAdvisoryContext;
  generalActiveSystem: ReturnType<typeof buildTurnContext>['activeSystem'];
  savedSystemNote: string | undefined;
} {
  const activeComponentNames = turnCtx.activeSystem
    ? turnCtx.activeSystem.components.map((c) => {
        const b = (c.brand || '').trim();
        const n = (c.name || '').trim();
        if (!b) return n || 'Unknown';
        if (!n) return b;
        if (n.toLowerCase().startsWith(b.toLowerCase())) return n;
        return `${b} ${n}`;
      })
    : undefined;

  const isInlineSystem = turnCtx.systemSource === 'inline';
  const isSavedSystem = turnCtx.systemSource === 'saved' || turnCtx.systemSource === 'draft';

  const savedSystemNote =
    isSavedSystem && activeComponentNames && activeComponentNames.length > 0
      ? `For your current setup (${activeComponentNames.slice(0, 3).join(', ')}), this choice would interact with your existing chain — worth considering how it fits the character you already have.`
      : undefined;

  const advisoryCtx: ShoppingAdvisoryContext = {
    systemComponents: isInlineSystem ? activeComponentNames : undefined,
    systemTendencies: isInlineSystem ? (turnCtx.activeSystem?.tendencies ?? undefined) : undefined,
    savedSystemNote,
  };

  const generalActiveSystem = isInlineSystem ? turnCtx.activeSystem : null;

  return { advisoryCtx, generalActiveSystem, savedSystemNote };
}

// ──────────────────────────────────────────────────────
// 1. Inline system still drives main answer
// ──────────────────────────────────────────────────────

describe('Inline system drives main answer', () => {
  it('systemComponents populated when user states components', () => {
    const msg = 'I have a Denafrips Ares II, Willsenton R8, and Klipsch Heresy IV';
    const turnCtx = buildTurnContext(msg, stateWithSaved(), NO_DISMISSED);
    const { advisoryCtx } = buildAdvisoryCtx(turnCtx);

    expect(turnCtx.systemSource).toBe('inline');
    expect(advisoryCtx.systemComponents).toBeDefined();
    expect(advisoryCtx.systemComponents!.length).toBeGreaterThanOrEqual(2);
    expect(advisoryCtx.savedSystemNote).toBeUndefined();
  });

  it('inline system passed to knowledge context', () => {
    const msg = 'I have a Schiit Bifrost, Naim Nait 5si, and B&W 606 — tell me about R2R DACs';
    const turnCtx = buildTurnContext(msg, stateWithSaved(), NO_DISMISSED);
    const { generalActiveSystem } = buildAdvisoryCtx(turnCtx);

    // generalActiveSystem should be the inline system, not null
    expect(generalActiveSystem).not.toBeNull();
    const names = generalActiveSystem!.components.map((c) => `${c.brand} ${c.name}`.toLowerCase()).join(' | ');
    expect(names).toMatch(/schiit|bifrost/);
  });
});

// ──────────────────────────────────────────────────────
// 2. Saved system does NOT populate main answer
// ──────────────────────────────────────────────────────

describe('Saved system excluded from main answer framing', () => {
  it('systemComponents is undefined when only saved system exists', () => {
    const msg = 'What do you think of the Chord Qutest?';
    const turnCtx = buildTurnContext(msg, stateWithSaved(), NO_DISMISSED);
    const { advisoryCtx } = buildAdvisoryCtx(turnCtx);

    expect(turnCtx.systemSource).toBe('saved');
    expect(advisoryCtx.systemComponents).toBeUndefined();
  });

  it('generalActiveSystem is null for general queries with saved system', () => {
    const msg = 'Tell me about tube amplifiers';
    const turnCtx = buildTurnContext(msg, stateWithSaved(), NO_DISMISSED);
    const { generalActiveSystem } = buildAdvisoryCtx(turnCtx);

    expect(generalActiveSystem).toBeNull();
  });
});

// ──────────────────────────────────────────────────────
// 3. Saved system appears as secondary note
// ──────────────────────────────────────────────────────

describe('Saved system appears as savedSystemNote', () => {
  it('savedSystemNote populated when saved system active', () => {
    const msg = 'What are good DAC upgrades?';
    const turnCtx = buildTurnContext(msg, stateWithSaved(), NO_DISMISSED);
    const { savedSystemNote } = buildAdvisoryCtx(turnCtx);

    expect(savedSystemNote).toBeDefined();
    expect(savedSystemNote).toContain('your current setup');
    // Must reference saved system components
    expect(savedSystemNote).toMatch(/Focal|Chord/);
  });

  it('savedSystemNote absent when no saved system', () => {
    const msg = 'What are good DAC upgrades?';
    const turnCtx = buildTurnContext(msg, emptyState(), NO_DISMISSED);
    const { savedSystemNote } = buildAdvisoryCtx(turnCtx);

    expect(savedSystemNote).toBeUndefined();
  });

  it('consultationToAdvisory threads savedSystemNote', () => {
    const consultation: ConsultationResponse = {
      subject: 'Chord Qutest',
      philosophy: 'Precision-first engineering with Rob Watts FPGA approach.',
      tendencies: 'Resolving, analytical, rhythmically precise.',
      systemContext: 'Works well with warmer amplification.',
    };
    const ctx: ShoppingAdvisoryContext = {
      savedSystemNote: 'For your current setup (Focal Utopia, Chord Hugo TT2), this DAC shares the Chord house sound.',
    };

    const advisory = consultationToAdvisory(consultation, undefined, ctx);
    expect(advisory.savedSystemNote).toBe(ctx.savedSystemNote);
  });

  it('gearResponseToAdvisory threads savedSystemNote', () => {
    const gear: GearResponse = {
      intent: 'gear_question',
      anchor: 'The Qutest is Chord\'s entry-level desktop DAC.',
      character: 'Detailed, fast, precise timing.',
      direction: 'A natural step if you value transient speed.',
      subjects: ['Chord Qutest'],
    };
    const ctx: ShoppingAdvisoryContext = {
      savedSystemNote: 'For your setup, this adds another Chord piece to the chain.',
    };

    const advisory = gearResponseToAdvisory(gear, undefined, ctx);
    expect(advisory.savedSystemNote).toBe(ctx.savedSystemNote);
  });

  it('knowledgeToAdvisory threads savedSystemNote when no deterministic systemNote', () => {
    const knowledge = {
      topic: 'R2R DAC architecture',
      explanation: 'R2R DACs use a resistor ladder...',
    };
    const ctx: ShoppingAdvisoryContext = {
      savedSystemNote: 'Your Chord Hugo TT2 uses a different architecture (FPGA) — comparing approaches could be informative.',
    };

    const advisory = knowledgeToAdvisory(knowledge, ctx);
    expect(advisory.savedSystemNote).toBe(ctx.savedSystemNote);
    // Should also populate the knowledge response's systemNote for rendering
    expect(advisory.knowledgeResponse?.systemNote).toBe(ctx.savedSystemNote);
  });

  it('knowledgeToAdvisory preserves deterministic systemNote over savedSystemNote', () => {
    const knowledge = {
      topic: 'R2R DAC architecture',
      explanation: 'R2R DACs use a resistor ladder...',
      systemNote: 'Your current DAC uses delta-sigma — a different conversion approach.',
    };
    const ctx: ShoppingAdvisoryContext = {
      savedSystemNote: 'Generic saved system note.',
    };

    const advisory = knowledgeToAdvisory(knowledge, ctx);
    // Deterministic systemNote should win
    expect(advisory.knowledgeResponse?.systemNote).toBe(knowledge.systemNote);
    // savedSystemNote should NOT appear since deterministic note exists
    expect(advisory.savedSystemNote).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────
// 4. Assessment mode remains unchanged
// ──────────────────────────────────────────────────────

describe('Assessment mode uses full system context', () => {
  it('assessment advisory gets systemComponents even from saved system', () => {
    // Simulate the assessment safeguard from page.tsx:
    // When intent is system_assessment and activeComponentNames exist,
    // advisoryCtx.systemComponents is restored.
    const msg = 'Evaluate my system';
    const turnCtx = buildTurnContext(msg, stateWithSaved(), NO_DISMISSED);
    const { advisoryCtx } = buildAdvisoryCtx(turnCtx);

    // Before safeguard: systemComponents is undefined (saved system split)
    expect(advisoryCtx.systemComponents).toBeUndefined();

    // Apply assessment safeguard (mirrors page.tsx logic)
    const activeComponentNames = turnCtx.activeSystem
      ? turnCtx.activeSystem.components.map((c) => {
          const b = (c.brand || '').trim();
          const n = (c.name || '').trim();
          if (!b) return n || 'Unknown';
          if (!n) return b;
          if (n.toLowerCase().startsWith(b.toLowerCase())) return n;
          return `${b} ${n}`;
        })
      : undefined;

    if (activeComponentNames && !advisoryCtx.systemComponents) {
      advisoryCtx.systemComponents = activeComponentNames;
      advisoryCtx.savedSystemNote = undefined;
    }

    // After safeguard: systemComponents restored for assessment
    expect(advisoryCtx.systemComponents).toBeDefined();
    expect(advisoryCtx.savedSystemNote).toBeUndefined();
  });

  it('consultationToAdvisory suppresses savedSystemNote for assessments', () => {
    const consultation: ConsultationResponse = {
      subject: 'Studio Rig',
      componentReadings: [{ componentName: 'Focal Utopia', reading: 'Resolving headphone.' }],
      systemContext: 'Your system is built around resolution.',
    };
    const ctx: ShoppingAdvisoryContext = {
      systemComponents: ['Focal Utopia', 'Chord Hugo TT2'],
      savedSystemNote: 'Should not appear in assessment.',
    };

    const advisory = consultationToAdvisory(consultation, undefined, ctx);
    // Assessment path (has componentReadings) should suppress savedSystemNote
    expect(advisory.savedSystemNote).toBeUndefined();
  });
});
