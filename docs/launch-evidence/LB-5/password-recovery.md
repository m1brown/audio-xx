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
