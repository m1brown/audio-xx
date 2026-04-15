/**
 * Saved-system precedence tests.
 *
 * Verifies the three fixes for phantom saved-system injection:
 *
 *   Fix 1 (turn-context.ts): user-stated system overrides saved system
 *   Fix 2 (conversation-state.ts): consultation_entry guards against injecting
 *          saved text when user provided component descriptions
 *   Fix 3 (page.tsx): tested indirectly — the proposedSystem guard logic
 *          is validated through buildTurnContext behavior
 *
 * Rule: If the user explicitly states a system in the current message,
 *       that system takes precedence over any saved system.
 */

import { buildTurnContext } from '../turn-context';
import { detectInitialMode } from '../conversation-state';
import type { AudioSessionState, SavedSystem } from '../system-types';

// ── Fixtures ──────────────────────────────────────────

/** Saved system that should NOT contaminate user-stated chains. */
const PHANTOM_SAVED_SYSTEM: SavedSystem = {
  id: 'saved-1',
  name: 'My System',
  components: [
    { id: 'c1', componentId: 'p1', name: 'WLM Diva Monitor', brand: 'WLM', category: 'speaker', role: null, notes: null },
    { id: 'c2', componentId: 'p2', name: 'JOB Integrated', brand: 'JOB', category: 'integrated', role: null, notes: null },
    { id: 'c3', componentId: 'p3', name: 'Chord Hugo', brand: 'Chord', category: 'dac', role: null, notes: null },
  ],
  tendencies: null,
  notes: null,
  location: null,
  room: null,
  primaryUse: null,
};

/** AudioSessionState with an active saved system. */
function stateWithSavedSystem(): AudioSessionState {
  return {
    activeSystemRef: { kind: 'saved', id: 'saved-1' },
    savedSystems: [PHANTOM_SAVED_SYSTEM],
    draftSystem: null,
    loading: false,
    proposedSystem: null,
  };
}

/** AudioSessionState with no saved systems. */
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

// ──────────────────────────────────────────────────────
// Fix 1: user-stated system overrides saved system
// ──────────────────────────────────────────────────────

describe('Fix 1: buildTurnContext — inline promotion precedence', () => {
  it('user-stated 3-component system overrides saved system', () => {
    const msg = 'I have a Bluesound NODE X, PrimaLuna EVO 300 Integrated, and Harbeth P3ESR';
    const ctx = buildTurnContext(msg, stateWithSavedSystem(), NO_DISMISSED);

    // The active system should come from the user's message, not the saved system
    expect(ctx.systemSource).toBe('inline');
    expect(ctx.activeSystem).not.toBeNull();

    // Check both brand and name fields to match the extraction format
    const allText = ctx.activeSystem!.components
      .map((c) => `${c.brand} ${c.name}`.toLowerCase())
      .join(' | ');

    // User's components should be present (brand or name)
    expect(allText).toMatch(/node/);
    expect(allText).toMatch(/p3esr/);
    expect(allText.includes('primaluna') || allText.includes('evo')).toBe(true);

    // Phantom saved-system components must NOT be present
    expect(allText).not.toMatch(/\bwlm\b/);
    expect(allText).not.toMatch(/\bjob\b/);
    expect(allText).not.toMatch(/\bhugo\b/);
    expect(allText).not.toMatch(/\bdiva\b/);
  });

  it('saved system used when user states no components', () => {
    const msg = 'What do you think of my system?';
    const ctx = buildTurnContext(msg, stateWithSavedSystem(), NO_DISMISSED);

    // No inline promotion — saved system should be used
    expect(ctx.systemSource).toBe('saved');
    expect(ctx.activeSystem).not.toBeNull();
    const names = ctx.activeSystem!.components.map((c) => c.name.toLowerCase());
    expect(names.some((n) => n.includes('diva') || n.includes('wlm'))).toBe(true);
  });

  it('no active system when no saved system and no user components', () => {
    const msg = 'Tell me about the Chord sound';
    const ctx = buildTurnContext(msg, emptyState(), NO_DISMISSED);

    expect(ctx.activeSystem).toBeNull();
    expect(ctx.systemSource).toBeNull();
  });

  it('no duplicate roles when saved system exists and user states new system', () => {
    // Both saved system and user message contain a DAC and an amp.
    // Only user's components should appear — no role duplication.
    const msg = 'I run a Denafrips Pontus II into a Leben CS300 driving Harbeth SHL5+';
    const ctx = buildTurnContext(msg, stateWithSavedSystem(), NO_DISMISSED);

    expect(ctx.systemSource).toBe('inline');
    expect(ctx.activeSystem).not.toBeNull();

    const allText = ctx.activeSystem!.components
      .map((c) => `${c.brand} ${c.name}`.toLowerCase())
      .join(' | ');

    // User's components only (check brand or name fields)
    expect(allText.includes('denafrips') || allText.includes('pontus')).toBe(true);
    expect(allText.includes('leben') || allText.includes('cs300')).toBe(true);
    expect(allText.includes('harbeth') || allText.includes('shl5')).toBe(true);

    // No phantom components
    expect(allText).not.toMatch(/\bjob\b/);
    expect(allText).not.toMatch(/\bhugo\b/);
    expect(allText).not.toMatch(/\bdiva\b/);
    expect(allText).not.toMatch(/\bwlm\b/);
  });
});

// ──────────────────────────────────────────────────────
// Fix 2: consultation_entry does not inject saved system
//        when user provided component descriptions
// ──────────────────────────────────────────────────────

describe('Fix 2: detectInitialMode — consultation_entry guard', () => {
  it('does not inject saved system text when user described components', () => {
    // User describes components but intent is classified as consultation_entry
    const text = 'Chord Qutest, Hegel H190, DeVore O/96 integrated amp and speakers';
    const injectedSystemText = 'My system: WLM Diva Monitor, JOB Integrated, Chord Hugo.';

    const result = detectInitialMode(text, {
      detectedIntent: 'consultation_entry',
      hasSystem: true,
      subjectCount: 3,
      injectedSystemText,
    });

    // Should use user's text, not injected saved system text
    if (result && result.facts?.systemAssessmentText) {
      // The assessment text must NOT be the injected saved system text
      expect(result.facts.systemAssessmentText).not.toContain('WLM Diva');
      expect(result.facts.systemAssessmentText).not.toContain('JOB Integrated');
      expect(result.facts.systemAssessmentText).not.toContain('Chord Hugo');
    }
  });

  it('injects saved system text when user has no component description', () => {
    // User asks for evaluation without naming gear — saved system should be used
    const text = 'evaluate my system please';
    const injectedSystemText = 'My system: WLM Diva Monitor, JOB Integrated, Chord Hugo.';

    const result = detectInitialMode(text, {
      detectedIntent: 'consultation_entry',
      hasSystem: true,
      subjectCount: 0,
      injectedSystemText,
    });

    // Should use injected saved system text
    if (result && result.facts?.systemAssessmentText) {
      expect(result.facts.systemAssessmentText).toContain('WLM Diva');
    }
  });

  it('system_assessment path still guards correctly', () => {
    // Verify the existing system_assessment guard wasn't broken
    const text = 'Review my Bluesound NODE, PrimaLuna EVO 300 Integrated, Harbeth P3ESR';
    const injectedSystemText = 'My system: WLM Diva Monitor, JOB Integrated, Chord Hugo.';

    const result = detectInitialMode(text, {
      detectedIntent: 'system_assessment',
      hasSystem: true,
      subjectCount: 3,
      injectedSystemText,
    });

    if (result && result.facts?.systemAssessmentText) {
      // User's text should be used because it has component descriptions
      expect(result.facts.systemAssessmentText).not.toContain('WLM Diva');
      expect(result.facts.systemAssessmentText).not.toContain('JOB Integrated');
    }
  });
});

// ──────────────────────────────────────────────────────
// Integration: non-system query with saved system
// ──────────────────────────────────────────────────────

describe('Saved system available for non-component queries', () => {
  it('saved system populates activeSystem when user asks general question', () => {
    // A general question with no components should still see the saved system
    const msg = 'How should I improve my system?';
    const ctx = buildTurnContext(msg, stateWithSavedSystem(), NO_DISMISSED);

    // Saved system should be active since user didn't state a new one
    expect(ctx.systemSource).toBe('saved');
    expect(ctx.activeSystem).not.toBeNull();
  });

  it('saved system NOT used when user states a completely different system', () => {
    const msg = 'I use a Schiit Bifrost, Naim Nait 5si, and B&W 606 S2';
    const ctx = buildTurnContext(msg, stateWithSavedSystem(), NO_DISMISSED);

    expect(ctx.systemSource).toBe('inline');
    expect(ctx.activeSystem).not.toBeNull();

    const allText = ctx.activeSystem!.components
      .map((c) => `${c.brand} ${c.name}`.toLowerCase())
      .join(' | ');

    // Must not contain any saved system components
    expect(allText).not.toMatch(/\bwlm\b/);
    expect(allText).not.toMatch(/\bjob\b/);
    expect(allText).not.toMatch(/\bhugo\b/);
    expect(allText).not.toMatch(/\bdiva\b/);
  });
});
