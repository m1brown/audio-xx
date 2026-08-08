# LB-5 — Password recovery: DISABLED, not certified

**Status:** Public self-service recovery **disabled in production**. Recovery is
founder-managed until certified.
**Decided:** 2026-08-06 (Launch Mission 2)
**Recorded by:** Claude

This is tracked as its own item. It is **not** part of LB-4 (saved-system persistence)
and must not be folded into it.

## Why it was not certified

Certification requires receiving a real email and completing an authenticated reset.
Neither is available to the engineering session:

1. **No external inbox** — the delivered message cannot be received or read, so step 2
   of the required flow (verify actual delivery) cannot be performed.
2. **Steps 3–5 require creating an account and entering passwords to authenticate**,
   which the operating rules prohibit. Running the test against a real existing account
   would mean changing a real user's password — destructive to user data.
3. `RESEND_API_KEY` is stored **Sensitive** in Vercel and cannot be read back, so the
   Resend delivery log cannot be inspected either.

The failure mode being guarded against is specific and terminal: the route is
enumeration-safe and returns the same body regardless of outcome.

```
POST /api/auth/forgot  {"email":"nonexistent-probe-8f3a@example.invalid"}
→ HTTP 200  {"ok":true}
```

A user who cannot receive the email sees success, waits, and is locked out of their
account and saved systems with no signal to anyone. `sendEmail` returns `{ok:false}`
and the route discards it; a no-op is not an error, so Sentry stays silent.

## What the evidence actually says — delivery is *likely* fine

DNS for `audio-xx.com` matches Resend's standard root-domain verification exactly:

| Record | Value |
|---|---|
| `resend._domainkey.audio-xx.com` TXT | RSA public key present (DKIM) |
| `send.audio-xx.com` TXT | `v=spf1 include:amazonses.com ~all` |
| `send.audio-xx.com` MX | `feedback-smtp.eu-west-1.amazonses.com` |
| `_dmarc.audio-xx.com` TXT | `v=DMARC1; p=quarantine; adkim=r; aspf=r` |

`RESEND_API_KEY` and `EMAIL_FROM` are both set in Production. DKIM should align and
DMARC should pass.

**This is necessary but not sufficient.** Correct DNS does not prove the domain is
verified in the Resend dashboard, that the API key is unrestricted, or — the common
trap — that the Resend account is out of test mode, where sends are only permitted to
the account owner's own address. None of that is checkable without the key or an inbox.

So: disabled on the "cannot certify" rule, not because delivery is known to be broken.

## What was changed

| | |
|---|---|
| Variable | `NEXT_PUBLIC_PASSWORD_RESET` (Production) |
| Was | `1` (link visible) |
| Now | `0` (link hidden) |
| Rebuild | `audio-xx-2za4u99sn` — `NEXT_PUBLIC_*` is inlined at build time, so a rebuild was required |
| Verified | `Forgot your password?` occurrences on `/auth/signin`: **1 → 0** |

Nothing else changed. `/auth/forgot` and `/auth/reset` still resolve if reached directly;
only the public entry point is withdrawn. No code was modified — the flag exists for
exactly this purpose.

## Founder-managed recovery path (for invitation / support copy)

Suggested line for the invitation email:

> If you have any trouble signing in, just reply to this email and I'll sort it out.

With a bounded invited cohort the founder knows every user by name and holds direct
Turso access, so manual credential reset fully covers the outcome. This is the
operational model the beta already assumes.

## To re-enable — about 5 minutes

1. Send yourself a reset from `/auth/forgot` on a Preview deployment (where the flag
   is still on), and confirm the email **arrives in an external inbox**.
2. Complete the reset and sign in with the new password.
3. Confirm the old password no longer authenticates.
4. Then:

```bash
npx vercel env rm NEXT_PUBLIC_PASSWORD_RESET production -y && printf '1' | npx vercel env add NEXT_PUBLIC_PASSWORD_RESET production
```

5. Redeploy production to rebuild, and confirm `Forgot your password?` renders again.

Record the delivered message ID and the inbox it landed in here, and this item closes
as **certified** rather than **disabled**.

## Verdict

**Not a launch blocker in its current state** — no visible flow can now mislead a user.
It is a **withheld capability** pending a founder-run certification.

---

## Delivery FAILED under test — recovery-safety repair (2026-08-08)

The capability was briefly re-enabled at founder request, tested, and **failed**.
Production `babaf0b` / `audio-xx-pzdwhcn6e`.

### What was established

| Fact | Evidence |
|---|---|
| **Consistent with a configured key** — *not proof* | `/api/auth/forgot` was hit twice (09:32:46, 09:53:10 UTC). The Mission-4A alarm, which fires only when `RESEND_API_KEY` is unset, was not seen in the log output. **That is an absence of signal, not evidence.** The log view returned routing lines only, so application `console` output may simply not have been in scope. The behaviour is *consistent with* a configured key; it does not establish one. |
| **No email arrived** | Neither attempt reached the founder's inbox. Where the flow stopped — key unset, provider rejection, or silent drop — **is not yet established by positive evidence.** |
| **The failure was invisible** | `sendEmail` returned `{ok:false}` and `/api/auth/forgot` discarded it. No log, no Sentry event, no signal. The attempts were only discoverable by hand-trawling the request log. |
| **Public recovery UI disabled** | `NEXT_PUBLIC_PASSWORD_RESET=0`, rebuilt. `"Forgot your password?"` occurrences on `/auth/signin`: **1 → 0**. Sign-in returns 200 with Email / Password / Sign in intact; no other auth behaviour changed. |
| **Rejection now observable** | `sendEmail` reports through `console.error` **and** `Sentry.captureMessage` for both a non-ok response and a thrown fetch. |
| **Root cause UNRESOLVED** | Requires the Resend dashboard, which the engineering session cannot access. |

> **Standing rule, restated because this record briefly broke it:** absence of a
> signal is not evidence of correctness. An alarm that was not observed does not
> establish that the condition it watches for was absent — it may equally mean the
> alarm never ran, never logged, or was not in the window examined.
>
> **Positive evidence will exist only when** a controlled send attempt is captured
> by the new rejection logger / Sentry path. Until such a capture exists, the
> provider-rejection hypothesis remains a hypothesis.

### Observability change

Reported: provider status plus a truncated, **email-redacted** reason.
Never reported: recipient, subject, body, reset token, API key.

Resend's real test-mode error quotes the recipient address back, so
`redactEmails()` scrubs anything address-shaped before it leaves the process.
`reportSendFailure` cannot throw — observability must not break a request path.

`/api/auth/forgot` public behaviour is **unchanged**: the same uniform 200
regardless of outcome, so delivery success or failure is still never exposed to
the requester and enumeration safety is preserved.

Regression test `email-send-failure-observable.test.ts` pins: rejection is
reported · thrown fetch is reported · recipient/token/URL/key never appear in
anything emitted · the unset-key case stays quiet so the route's existing alarm
is not double-counted.

### Still open — founder / provider investigation

The engineering session cannot read the Resend dashboard or the API key.
Likeliest causes, in order:

1. **Resend account still in test mode** — delivers only to the account owner's
   own verified address. By far the most common cause of this exact symptom.
2. Domain not actually verified in the Resend dashboard, despite DNS being
   correct (DKIM + `send.` SPF/MX were confirmed present).
3. `EMAIL_FROM` set to an address on a domain Resend will not send for.
4. API key restricted or revoked.

**Next attempt will produce the first positive evidence.** Re-enable the flag,
trigger one controlled reset, then read the Sentry issue or the
`[email] send rejected by provider` log line. Whichever appears — a rejection
with a provider status, the unset-key alarm, or nothing at all — is the first
*observed* datum about where this flow stops. Everything recorded above is
inference from behaviour.

### Verdict

**LB-5 remains a disabled capability, not a blocker.** No visible flow can now
mislead a user. Recovery is founder-managed for the invited cohort. Delivery
must be certified before this is re-enabled.
