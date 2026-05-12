/**
 * Tests for the bipolar optimization parser.
 *
 * The parser must:
 *   - identify "X without Y" / "X but Y" shapes
 *   - resolve both halves to canonical quality tokens
 *   - distinguish preserved traits (positive Y) from avoided failure modes (negative Y)
 *   - return null when neither half resolves
 *   - NOT match degenerate cases (X === Y, malformed phrases)
 */

import { describe, it, expect } from 'vitest';
import { extractBipolarPreference, formatBipolarPreference } from '../bipolar-preference';

describe('extractBipolarPreference — desired+preserved (positive Y)', () => {
  it('parses "more flow without losing detail"', () => {
    const bp = extractBipolarPreference('more flow without losing detail');
    expect(bp).not.toBeNull();
    expect(bp!.desired.quality).toBe('flow');
    expect(bp!.preserved?.quality).toBe('detail');
    expect(bp!.avoided).toBeNull();
    expect(bp!.shape).toBe('X_without_losing_Y');
  });

  it('parses "more body without losing speed"', () => {
    const bp = extractBipolarPreference('more body without losing speed');
    expect(bp!.desired.quality).toBe('body');
    expect(bp!.preserved?.quality).toBe('speed');
  });

  it('parses "more warmth without losing articulation"', () => {
    const bp = extractBipolarPreference('more warmth without losing articulation');
    expect(bp).not.toBeNull();
    expect(bp!.desired.quality).toBe('warmth');
    // "articulation" → detail via SUPPLEMENTARY_QUALITY
    expect(bp!.preserved?.quality).toBe('detail');
  });

  it('parses "organic but still resolving"', () => {
    const bp = extractBipolarPreference('organic but still resolving');
    expect(bp).not.toBeNull();
    expect(bp!.shape).toBe('X_but_still_Y');
    // "organic" → flow/musicality alias; "resolving" → detail/clarity.
    expect(bp!.desired.quality).toBeTruthy();
    expect(bp!.preserved?.quality).toBeTruthy();
  });

  it('parses "relaxed but still highly detailed"', () => {
    const bp = extractBipolarPreference('relaxed but still highly detailed');
    expect(bp).not.toBeNull();
    expect(bp!.desired.quality).toBeTruthy();
    expect(bp!.preserved?.quality).toBeTruthy();
  });

  it('parses "less edge without losing transient precision"', () => {
    const bp = extractBipolarPreference('less edge without losing transient precision');
    expect(bp).not.toBeNull();
    expect(bp!.negativeDesired).toBe(true);
    expect(bp!.shape).toBe('less_X_without_losing_Y');
  });
});

describe('extractBipolarPreference — desired+avoided (negative Y)', () => {
  it('parses "more tonal density without becoming soft"', () => {
    const bp = extractBipolarPreference('more tonal density without becoming soft');
    expect(bp).not.toBeNull();
    expect(bp!.shape).toBe('X_without_becoming_Y');
    expect(bp!.preserved).toBeNull();
    expect(bp!.avoided?.quality).toBe('softness');
  });

  it('parses "better imaging without sounding analytical"', () => {
    const bp = extractBipolarPreference('better imaging without sounding analytical');
    expect(bp).not.toBeNull();
    expect(bp!.shape).toBe('X_without_sounding_Y');
    // Existing QUALITY_ALIASES maps "analytical" → "sterility" — that's the
    // canonical token throughout the engine, so the parser inherits it.
    expect(bp!.avoided?.quality).toBe('sterility');
    expect(bp!.preserved).toBeNull();
  });

  // NOTE: "R2R DAC without softness" intentionally not handled by the bipolar
  // parser — "R2R DAC" is a topology constraint, not a quality. Phase 2 of
  // the specialist-reasoning pass handles topology constraints separately.
  // The bipolar parser only matches when BOTH halves resolve to canonical
  // quality tokens.
});

describe('extractBipolarPreference — degenerate / non-matching', () => {
  it('returns null for messages with no bipolar shape', () => {
    expect(extractBipolarPreference('best DAC under $1500')).toBeNull();
    expect(extractBipolarPreference('Leben CS600')).toBeNull();
    expect(extractBipolarPreference('I want a streamer')).toBeNull();
  });

  it('returns null when neither half resolves to a quality', () => {
    expect(extractBipolarPreference('apples without oranges')).toBeNull();
  });

  it('returns null when X equals Y (degenerate balance)', () => {
    // "warmth without losing warmth" is not a meaningful trade-off.
    expect(extractBipolarPreference('warmth without losing warmth')).toBeNull();
  });

  it('returns null for empty or very short text', () => {
    expect(extractBipolarPreference('')).toBeNull();
    expect(extractBipolarPreference('hi')).toBeNull();
  });
});

describe('formatBipolarPreference', () => {
  it('formats preserved correctly', () => {
    const bp = extractBipolarPreference('more flow without losing detail');
    expect(formatBipolarPreference(bp!)).toBe('flow, preserving detail');
  });

  it('formats avoided correctly', () => {
    const bp = extractBipolarPreference('better imaging without sounding analytical');
    // analytical → sterility (existing alias)
    expect(formatBipolarPreference(bp!)).toBe('imaging, avoiding sterility');
  });

  it('formats negativeDesired correctly', () => {
    const bp = extractBipolarPreference('less edge without losing transient precision');
    expect(formatBipolarPreference(bp!).startsWith('less ')).toBe(true);
  });
});

describe('intent integration — bipolar shapes route to shopping, not diagnosis', () => {
  // Use dynamic import to avoid circular issues at module load.
  it('"more flow without losing detail" → intent: shopping with bipolar attached', async () => {
    const { detectIntent } = await import('../intent');
    const r = detectIntent('more flow without losing detail');
    expect(r.intent).toBe('shopping');
    expect(r.bipolar).toBeTruthy();
    expect(r.bipolar!.desired.quality).toBe('flow');
    expect(r.bipolar!.preserved?.quality).toBe('detail');
  });

  it('"better imaging without sounding analytical" → intent: shopping', async () => {
    const { detectIntent } = await import('../intent');
    const r = detectIntent('better imaging without sounding analytical');
    expect(r.intent).toBe('shopping');
    // analytical → sterility (existing engine vocabulary)
    expect(r.bipolar?.avoided?.quality).toBe('sterility');
  });

  it('"organic but still resolving" → intent: shopping', async () => {
    const { detectIntent } = await import('../intent');
    const r = detectIntent('organic but still resolving');
    expect(r.intent).toBe('shopping');
    expect(r.bipolar).toBeTruthy();
  });

  it('bipolar guard does not override active-system tuning path', async () => {
    const { detectIntent } = await import('../intent');
    const r = detectIntent('more flow without losing detail', { hasActiveSavedSystem: true });
    // The bipolar shopping shortcut is gated by !hasActiveSavedSystem.
    // Whatever downstream routing fires, the bipolar shortcut itself
    // must not be the one that produced 'shopping' here — i.e. the
    // bipolar payload should not be attached.
    expect(r.bipolar).toBeUndefined();
  });
});
