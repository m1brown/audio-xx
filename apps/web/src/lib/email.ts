/**
 * Minimal transactional email sender (pre-beta item 3).
 *
 * Provider: Resend (single API key, plain fetch — no SDK dependency).
 * Fail-dark by design: without RESEND_API_KEY the send is a no-op and
 * the caller cannot tell the difference (enumeration safety). The
 * password-reset UI is separately feature-gated so users are never
 * shown a recovery flow that cannot deliver email.
 *
 * In non-production environments with no key, the reset URL is echoed
 * to the server console so the flow can be verified end-to-end locally.
 * This never happens in production builds.
 */

const FROM = process.env.EMAIL_FROM || 'Audio XX <no-reply@audio-xx.com>';

export function emailSendingConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: boolean }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== 'production') {
      // Dev-only echo — lets local verification read the reset link.
      console.log(`[email:dev-echo] to=${opts.to} subject="${opts.subject}"\n${opts.text}`);
    }
    return { ok: false };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
      }),
    });
    return { ok: res.ok };
  } catch {
    // Email-provider failure must never crash a request path.
    return { ok: false };
  }
}
