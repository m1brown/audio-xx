// @ts-nocheck — vitest globals injected via apps/web vitest config

/**
 * Saved-system upgrade-followup regression — `buildConsultationEntry`.
 *
 * Block A2 follow-up (2026-05-13). After commit a46df35 fixed the saved-
 * system pivot regression, deployed-preview verification surfaced a
 * separate pre-existing bug:
 *
 *   With My System attached:
 *     1. "my system sounds harsh"         → saved-system harshness diagnosis
 *     2. "what should I change first?"    → generic "what components make up
 *                                            your current system?" intake,
 *                                            even though the saved chain is
 *                                            attached.
 *
 * Root cause: page.tsx ~line 1307 sets
 *   const generalActiveSystem = isInlineSystem ? turnCtx.activeSystem : null;
 * to prevent saved-system context from leaking into general advisory
 * builders. For `buildConsultationEntry` specifically, that null-on-saved
 * policy is wrong — the intent classifier already gates consultation_entry
 * on `hasActiveSavedSystem`, so the routing decision relied on the saved
 * system being present. The builder needs that same context to produce
 * the targeted upgrade-direction response the routing implied.
 *
 * Fix (this commit): at the `intent === 'consultation_entry'` call site
 * only, pass `turnCtx.activeSystem` when the system source is saved/draft
 * OR inline. Other builders sharing `generalActiveSystem` keep their
 * existing null-on-saved-system behavior.
 *
 * This file pins the builder's behavior — the page.tsx wiring is verified
 * separately by the conversation-state Playwright harness and the
 * deployed-preview smokes.
 */

import { buildConsultationEntry } from '../consultation';
import type { ActiveSystemContext } from '../system-types';

// ── Fixtures ────────────────────────────────────────────────────────

/**
 * Mirror of the production "My System" used in the deployed-preview
 * smoke: WLM Diva Monitor → JOB Integrated → Eversolo DMP-A6 → Chord
 * Hugo. The components include the brands and names that the
 * saved-system branch of buildConsultationEntry expands into prose.
 */
const SAVED_MY_SYSTEM: ActiveSystemContext = {
  name: 'My System',
  components: [
    { brand: 'WLM', name: 'Diva Monitor', role: 'speakers' },
    { brand: 'JOB', name: 'Integrated', role: 'amplifier' },
    { brand: 'Eversolo', name: 'DMP-A6', role: 'streamer' },
    { brand: 'Chord', name: 'Hugo', role: 'dac' },
  ],
  tendencies: 'speed-first, lean, controlled',
};

const UPGRADE_FOLLOWUP_TURN = 'what should I change first?';
const ASSESSMENT_TURN = 'assess my system';
const NEUTRAL_GUIDANCE_TURN = 'help me improve my system';

describe('Block A2 follow-up — saved-system upgrade-followup', () => {
  it('with saved system attached, "what should I change first?" anchors on the saved chain', () => {
    const r = buildConsultationEntry(UPGRADE_FOLLOWUP_TURN, [], SAVED_MY_SYSTEM);

    // Subject must include the saved-system name — the saved-system branch
    // in consultation.ts uses `system guidance — ${activeSystem.name}`.
    expect(r.subject).toMatch(/system guidance — My System/i);

    // Philosophy must reference the saved chain components — not generic
    // "what components make up your current system?" intake prose.
    expect(r.philosophy).toMatch(/working from your My System/i);
    expect(r.philosophy).toMatch(/Diva Monitor/i);
    expect(r.philosophy).toMatch(/Hugo/i);

    // Must NOT ask for system components — the saved chain is attached.
    expect(r.followUp ?? '').not.toMatch(/what components make up your current system/i);
    expect(r.followUp ?? '').not.toMatch(/source\s*\(DAC,\s*streamer/i);
  });

  it('upgrade-focused phrasing surfaces the upgrade-priorities framing', () => {
    const r = buildConsultationEntry(UPGRADE_FOLLOWUP_TURN, [], SAVED_MY_SYSTEM);
    // The isUpgradeFocused branch (consultation.ts ~line 12043) produces
    // "I can map upgrade priorities against the current balance — identifying
    // the most effective intervention point."
    expect(r.philosophy).toMatch(/upgrade priorities|intervention point|map.*upgrade/i);
  });

  it('with saved system, assessment phrasing anchors on the saved chain too', () => {
    const r = buildConsultationEntry(ASSESSMENT_TURN, [], SAVED_MY_SYSTEM);
    expect(r.subject).toMatch(/system guidance — My System/i);
    expect(r.philosophy).toMatch(/Your My System/i);
    expect(r.philosophy).toMatch(/Diva Monitor/i);
  });

  it('with saved system, neutral guidance phrasing also anchors on the chain', () => {
    const r = buildConsultationEntry(NEUTRAL_GUIDANCE_TURN, [], SAVED_MY_SYSTEM);
    // Neutral phrasing falls into the else branch (line 12046) — still
    // anchored on the saved system.
    expect(r.subject).toMatch(/system guidance — My System/i);
    expect(r.philosophy).toMatch(/Diva Monitor/i);
  });
});

// ── No-saved-system control ─────────────────────────────────────────

describe('Block A2 follow-up — no-saved-system control (must NOT regress)', () => {
  it('without a saved system, "what should I change first?" produces the generic intake', () => {
    const r = buildConsultationEntry(UPGRADE_FOLLOWUP_TURN, [], null);
    // The no-active-system branch (~line 12093) produces the generic
    // "what components make up your current system?" intake. This must
    // be preserved — users without a saved system have no chain to
    // anchor on, so the builder asks for it.
    expect(r.subject).toBe('system guidance');
    expect(r.followUp).toMatch(/what components make up your current system/i);
    expect(r.followUp).toMatch(/source\s*\(DAC,\s*streamer/i);
    expect(r.philosophy).toMatch(/Before recommending an upgrade path|architectural balance/i);
  });

  it('without a saved system, undefined activeSystem also falls through to intake', () => {
    const r = buildConsultationEntry(UPGRADE_FOLLOWUP_TURN, [], undefined);
    expect(r.subject).toBe('system guidance');
    expect(r.followUp).toMatch(/what components make up your current system/i);
  });

  it('without a saved system, empty-components activeSystem falls through to intake', () => {
    const emptySystem: ActiveSystemContext = {
      name: 'Empty',
      components: [],
    };
    const r = buildConsultationEntry(UPGRADE_FOLLOWUP_TURN, [], emptySystem);
    // The saved-system branch is gated on `activeSystem.components.length > 0`,
    // so an empty system falls through to the no-active-system path.
    expect(r.subject).toBe('system guidance');
    expect(r.followUp).toMatch(/what components make up your current system/i);
  });
});
