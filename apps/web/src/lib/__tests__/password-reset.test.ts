/**
 * Password-recovery invariants (pre-beta item 3).
 *
 * DB-touching behaviour (cooldown, single-use consumption, cross-token
 * invalidation) was verified end-to-end against the dev database on
 * 2026-07-31 (see docs/auth-model.md). These unit tests pin the pure
 * invariants that guard that behaviour.
 */
import { describe, it, expect } from 'vitest';
import { hashToken, RESET_TOKEN_TTL_MS, RESET_REQUEST_COOLDOWN_MS } from '../password-reset';

describe('password-reset token hashing', () => {
  it('is deterministic and hex-shaped (sha-256)', () => {
    const h1 = hashToken('some-raw-token');
    const h2 = hashToken('some-raw-token');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('different tokens produce different hashes', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
  });

  it('the raw token is not recoverable from the stored value', () => {
    // The stored value must never contain the raw token itself.
    const raw = 'raw-token-value-abcdef';
    expect(hashToken(raw)).not.toContain(raw);
  });
});

describe('password-reset policy constants', () => {
  it('tokens are short-lived (≤ 60 minutes)', () => {
    expect(RESET_TOKEN_TTL_MS).toBeLessThanOrEqual(60 * 60 * 1000);
  });
  it('request cooldown exists (≥ 1 minute)', () => {
    expect(RESET_REQUEST_COOLDOWN_MS).toBeGreaterThanOrEqual(60 * 1000);
  });
});
