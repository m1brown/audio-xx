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

import * as Sentry from '@sentry/nextjs';

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
    if (!res.ok) {
      // A rejected send used to be completely silent: this function
      // returned { ok: false } and every caller discarded it, so a
      // password-reset that never arrived produced no log, no Sentry
      // event, and no signal of any kind. That is how a broken recovery
      // flow went unnoticed in production.
      //
      // The provider's reason is the actionable part — Resend says
      // outright when an account is in test mode or a domain is
      // unverified — but that text can quote the recipient address, so
      // it is redacted before it leaves this process. Status plus a
      // scrubbed reason is enough to diagnose without carrying PII.
      const reason = redactEmails((await res.text().catch(() => '')).slice(0, 300));
      reportSendFailure(`status=${res.status} reason=${reason || '(empty)'}`);
    }
    return { ok: res.ok };
  } catch (err) {
    // Email-provider failure must never crash a request path.
    // The name alone ("TypeError") does not distinguish a network failure
    // from a malformed request, and that distinction is the whole diagnosis.
    // The message names it — but a header-construction error quotes the
    // offending header back, which would put the API key in the log, so the
    // message is scrubbed of credentials before it is reported.
    const detail = err instanceof Error ? `${err.name}: ${redactSecrets(err.message)}` : 'unknown';
    reportSendFailure(`threw=${detail}`);
    return { ok: false };
  }
}

/** Replace anything shaped like an email address. Never log a recipient. */
function redactEmails(s: string): string {
  return s.replace(/[^\s"'<>@]+@[^\s"'<>@]+\.[A-Za-z]{2,}/g, '[email-redacted]');
}

/**
 * Scrub credentials from an error message before it is logged.
 *
 * A header-construction failure quotes the offending header back verbatim —
 * `Headers.append: "Bearer re_…" is an invalid header value` — which would
 * write the API key straight into the log and Sentry. Strip the bearer value
 * and anything matching a Resend key, then apply the email redaction too.
 */
function redactSecrets(s: string): string {
  return redactEmails(
    s
      .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
      .replace(/re_[A-Za-z0-9_-]+/g, '[key-redacted]'),
  );
}

/**
 * Surface a rejected send to the operator. Never throws, never includes
 * the recipient, subject, body, reset token or API key — only the
 * provider status and a redacted reason.
 */
function reportSendFailure(detail: string): void {
  // eslint-disable-next-line no-console
  console.error(`[email] send rejected by provider — ${detail}`);
  try {
    Sentry.captureMessage(`Email send rejected: ${detail}`, 'error');
  } catch {
    /* observability must never break the request path */
  }
}
