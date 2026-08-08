import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Disabled-state invariant for password recovery.
 *
 *   When recovery is disabled, no user-accessible UI or execution path may
 *   offer or initiate password recovery.
 *
 * The first attempt at disabling recovery only hid the sign-in CTA. That is
 * navigation, not a gate: `/auth/forgot`, `/auth/reset` and both API routes
 * stayed fully reachable by typing the URL, and `POST /api/auth/forgot` went
 * on minting reset tokens and calling the mail provider. Verified against
 * production at the time — all four returned 200.
 *
 * These tests cover the direct-access half specifically, because the hidden
 * link already "passed" while the invariant was broken.
 */

const createResetToken = vi.fn();
const sendEmail = vi.fn();
const findFirst = vi.fn();

vi.mock('@/lib/password-reset', () => ({
  createResetToken: (...a: unknown[]) => createResetToken(...a),
  verifyResetToken: vi.fn(),
  consumeResetToken: vi.fn(),
}));
vi.mock('@/lib/email', () => ({
  sendEmail: (...a: unknown[]) => sendEmail(...a),
  emailSendingConfigured: () => true,
}));
vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findFirst: (...a: unknown[]) => findFirst(...a) } },
}));

function post(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('recovery disabled — direct access is gated, not merely unlinked', () => {
  beforeEach(() => {
    vi.resetModules();
    createResetToken.mockReset();
    sendEmail.mockReset();
    findFirst.mockReset().mockResolvedValue({ id: 'u1', password: 'hash' });
    process.env.RESEND_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_PASSWORD_RESET;
    delete process.env.RESEND_API_KEY;
  });

  it('POST /api/auth/forgot initiates nothing while disabled', async () => {
    process.env.NEXT_PUBLIC_PASSWORD_RESET = '0';
    const { POST } = await import('../forgot/route');

    const res = await POST(post('http://localhost/api/auth/forgot', { email: 'real@example.com' }));

    expect(await res.json()).toEqual({ ok: true });
    expect(createResetToken, 'no token may be minted while disabled').not.toHaveBeenCalled();
    expect(sendEmail, 'no delivery may be attempted while disabled').not.toHaveBeenCalled();
  });

  it('keeps the disabled response indistinguishable from every other outcome', async () => {
    // Enumeration safety must survive the gate: disabled, unknown account and
    // sent all have to look identical to the requester.
    process.env.NEXT_PUBLIC_PASSWORD_RESET = '0';
    const disabled = await (await import('../forgot/route'))
      .POST(post('http://localhost/api/auth/forgot', { email: 'real@example.com' }));
    const disabledBody = await disabled.json();

    vi.resetModules();
    process.env.NEXT_PUBLIC_PASSWORD_RESET = '1';
    findFirst.mockResolvedValue(null); // no such account
    const unknown = await (await import('../forgot/route'))
      .POST(post('http://localhost/api/auth/forgot', { email: 'nobody@example.com' }));

    expect(disabled.status).toBe(unknown.status);
    expect(disabledBody).toEqual(await unknown.json());
  });

  it('POST /api/auth/reset refuses to redeem a token while disabled', async () => {
    process.env.NEXT_PUBLIC_PASSWORD_RESET = '0';
    const { POST } = await import('../reset/route');

    const res = await POST(post('http://localhost/api/auth/reset', {
      token: 'a-token-minted-before-the-flag-was-turned-off',
      password: 'a-new-password-123',
    }));

    // A link minted before disablement must not remain spendable.
    expect(res.status).toBe(404);
  });

  it('still works when recovery is enabled — the gate is the flag, not a removal', async () => {
    process.env.NEXT_PUBLIC_PASSWORD_RESET = '1';
    createResetToken.mockResolvedValue('raw-token');
    const { POST } = await import('../forgot/route');

    await POST(post('http://localhost/api/auth/forgot', { email: 'real@example.com' }));

    expect(createResetToken).toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalled();
  });

  it('fails closed when the flag is absent entirely', async () => {
    delete process.env.NEXT_PUBLIC_PASSWORD_RESET;
    const { POST } = await import('../forgot/route');

    await POST(post('http://localhost/api/auth/forgot', { email: 'real@example.com' }));

    expect(sendEmail, 'an unset flag must mean disabled, never enabled').not.toHaveBeenCalled();
  });
});
