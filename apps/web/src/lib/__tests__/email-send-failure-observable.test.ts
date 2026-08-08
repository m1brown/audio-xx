import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * A rejected email send must never be silent.
 *
 * `sendEmail` returned `{ ok: false }` and every caller discarded it, so a
 * password reset that never arrived produced no log, no Sentry event and no
 * signal anywhere. The founder requested a reset twice in production; both
 * were accepted by the route, rejected by the provider, and left no trace.
 * Only a manual log trawl showed the sends had even been attempted.
 *
 * These tests pin the two properties that failure mode needs:
 *   1. a rejected send is reported;
 *   2. the report carries no recipient, subject, body or token.
 */

const captureMessage = vi.fn();
vi.mock('@sentry/nextjs', () => ({
  captureMessage: (...args: unknown[]) => captureMessage(...args),
}));

const RECIPIENT = 'someone@example.com';
const RESET_TEXT = 'Reset your password: https://audio-xx.com/auth/reset?token=SUPERSECRETTOKEN';

async function callSendEmail() {
  const { sendEmail } = await import('../email');
  return sendEmail({ to: RECIPIENT, subject: 'Reset your Audio XX password', text: RESET_TEXT });
}

describe('sendEmail — rejected sends are observable', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    captureMessage.mockClear();
    process.env.RESEND_API_KEY = 'test-key-not-a-real-secret';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    delete process.env.RESEND_API_KEY;
    vi.unstubAllGlobals();
  });

  it('reports a provider rejection instead of failing silently', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"message":"testing mode"}', { status: 403 })));

    const result = await callSendEmail();

    expect(result.ok).toBe(false);
    expect(errorSpy, 'a rejected send must be logged').toHaveBeenCalled();
    expect(captureMessage, 'a rejected send must reach Sentry').toHaveBeenCalled();
    // The provider status is the operator's first diagnostic.
    expect(String(errorSpy.mock.calls[0]?.[0] ?? '')).toContain('403');
  });

  it('reports a thrown network error instead of failing silently', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network down'); }));

    const result = await callSendEmail();

    expect(result.ok).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    expect(captureMessage).toHaveBeenCalled();
  });

  it('never leaks the recipient, subject, body or reset token', async () => {
    // Resend's real test-mode error quotes the address back at you — the
    // exact shape that would put a user's email into logs and Sentry.
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      `{"message":"You can only send testing emails to your own address (${RECIPIENT})"}`,
      { status: 403 },
    )));

    await callSendEmail();

    const emitted = [
      ...errorSpy.mock.calls.flat(),
      ...captureMessage.mock.calls.flat(),
    ].map(String).join(' | ');

    expect(emitted, 'recipient address must be redacted').not.toContain(RECIPIENT);
    expect(emitted, 'reset token must never be logged').not.toContain('SUPERSECRETTOKEN');
    expect(emitted, 'reset URL must never be logged').not.toContain('auth/reset');
    expect(emitted, 'API key must never be logged').not.toContain('test-key-not-a-real-secret');
    // But the actionable reason survives, minus the address.
    expect(emitted).toContain('[email-redacted]');
    expect(emitted).toContain('testing emails');
  });

  it('stays silent when no API key is configured (already alarmed at the route)', async () => {
    delete process.env.RESEND_API_KEY;
    const result = await callSendEmail();

    expect(result.ok).toBe(false);
    // /api/auth/forgot raises its own alarm for the unset-key case; a second
    // report here would double-count the same condition.
    expect(captureMessage).not.toHaveBeenCalled();
  });
});

describe('sendEmail — thrown-error detail is useful but credential-safe', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    captureMessage.mockClear();
    process.env.RESEND_API_KEY = 're_liveKeyShapedValue123';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    delete process.env.RESEND_API_KEY;
    vi.unstubAllGlobals();
  });

  it('reports the message so a network failure is distinguishable from a bad request', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    await callSendEmail();

    const emitted = [...errorSpy.mock.calls.flat(), ...captureMessage.mock.calls.flat()].map(String).join(' | ');
    // "TypeError" alone cannot tell these apart, and that distinction is the diagnosis.
    expect(emitted).toContain('fetch failed');
  });

  it('never logs the API key, even when the error quotes the header back', async () => {
    // Exactly the shape a header-construction failure produces.
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Headers.append: "Bearer re_liveKeyShapedValue123" is an invalid header value');
    }));
    await callSendEmail();

    const emitted = [...errorSpy.mock.calls.flat(), ...captureMessage.mock.calls.flat()].map(String).join(' | ');
    expect(emitted, 'the API key must never reach a log or Sentry').not.toContain('re_liveKeyShapedValue123');
    expect(emitted).toContain('invalid header value'); // the actionable part survives
  });
});
