/**
 * Product suite — analytics layer (MVP M5).
 *
 * The canonical event set, the privacy sanitizer, and the per-load
 * dedupe are product behaviour, not vendor configuration — pinned here.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@vercel/analytics', () => ({ track: vi.fn() }));

import { track as vendorTrack } from '@vercel/analytics';
import { EVENTS, sanitizeProps, track, __resetForTests } from '../analytics';

beforeEach(() => {
  vi.mocked(vendorTrack).mockClear();
  __resetForTests();
});

describe('canonical event set', () => {
  it('contains exactly the approved funnel events', () => {
    expect([...EVENTS].sort()).toEqual([
      'account_created', 'additional_system_saved', 'assessment_added',
      'assessment_failed', 'assessment_rendered', 'builder_started',
      'checkout_cancelled', 'checkout_started', 'composer_started',
      'copy_link_clicked', 'first_system_saved', 'identical_assessment_declined',
      'landing_viewed', 'my_systems_viewed', 'print_clicked',
      'save_started', 'sign_in_completed', 'subscription_activated',
      'subscription_cancelled', 'subscription_prompt_viewed', 'trial_action_blocked',
    ].sort());
  });
});

describe('privacy sanitizer', () => {
  it('drops non-allowlisted keys — names, notes, free text, emails can never pass', () => {
    const out = sanitizeProps({
      source: 'builder',
      systemName: 'Living Room',           // dropped
      notes: 'my private notes',           // dropped
      email: 'user@example.com',           // dropped
      systemText: 'Assess my system: …',   // dropped
      url: 'https://…?system=…',           // dropped
    });
    expect(out).toEqual({ source: 'builder' });
  });

  it('drops long strings even under allowlisted keys', () => {
    expect(sanitizeProps({ source: 'x'.repeat(200) })).toEqual({});
  });

  it('keeps booleans, finite numbers, and short enum strings', () => {
    expect(sanitizeProps({ first: true, days_left: 12, state: 'trial' }))
      .toEqual({ first: true, days_left: 12, state: 'trial' });
  });
});

describe('emission', () => {
  it('view events fire once per page load (hydration/strict-mode safe)', () => {
    track('landing_viewed');
    track('landing_viewed');
    track('landing_viewed');
    expect(vendorTrack).toHaveBeenCalledTimes(1);
  });

  it('action events fire every time', () => {
    track('copy_link_clicked');
    track('copy_link_clicked');
    expect(vendorTrack).toHaveBeenCalledTimes(2);
  });

  it('first and repeat saves are distinct events', () => {
    track('first_system_saved');
    track('additional_system_saved');
    expect(vi.mocked(vendorTrack).mock.calls.map((c) => c[0]))
      .toEqual(['first_system_saved', 'additional_system_saved']);
  });

  it('unknown event names are never sent', () => {
    // @ts-expect-error — deliberately invalid
    track('made_up_event');
    expect(vendorTrack).not.toHaveBeenCalled();
  });

  it('sanitization applies at the emission boundary', () => {
    track('save_started', { signed_in: true, notes: 'secret' });
    expect(vendorTrack).toHaveBeenCalledWith('save_started', { signed_in: true });
  });
});

describe('composer funnel instrumentation (Gate 3, G3-D1 regression)', () => {
  it('the conversation-embedded assessment emits assessment_rendered {source: composer}', async () => {
    // Structural pin: the embed component must call the canonical event
    // on mount — without it the composer half of the funnel never
    // registers a completed assessment.
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    // Emitted at the embed site (AdvisoryMessage) so every dispatch
    // branch — v2 artifact and legacy — counts a completed assessment.
    const src = readFileSync(
      resolve(__dirname, '../../components/advisory/AdvisoryMessage.tsx'),
      'utf8',
    );
    expect(src).toMatch(/track\('assessment_rendered',\s*\{\s*source:\s*'composer'\s*\}\)/);
    expect((src.match(/<TrackAssessmentEmbed \/>/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
