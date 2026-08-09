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

---

## Disabled-state integrity check (2026-08-08)

The first disablement was **incomplete**. It hid the sign-in CTA and nothing more.

### Invariant

> When recovery is disabled, no user-accessible UI or execution path may offer or
> initiate password recovery.

### Before — verified against production with the flag off

| Path | Result | |
|---|---|---|
| `/auth/forgot` | **200**, working form | ❌ |
| `/auth/reset` | **200** | ❌ |
| `/auth/reset?token=…` | **200** | ❌ |
| `POST /api/auth/forgot` | **200** — minted a token, called the mail provider | ❌ |

Three flag references existed in the code. **All three were comments.** The forgot
page docstring asserted it "is only linked from the sign-in card when
NEXT_PUBLIC_PASSWORD_RESET is enabled" — the mistaken assumption itself. Linking
is not gating.

### After — verified on production `audio-xx-6bg0c43gm`

| Check | Result |
|---|---|
| `/auth/signin` | 200; Email / Password / Sign in intact |
| Recovery CTA | **0 occurrences** |
| `/auth/forgot` | "Password reset is unavailable"; **no live form** |
| `/auth/reset?token=…` | "Password reset is unavailable"; **no live form** |
| `POST /api/auth/forgot` | 200 `{"ok":true}` — **no token minted, no send attempted** |
| `POST /api/auth/reset` | **404** — a link minted before disablement cannot be spent |
| Route sweep | **28 / 28 → 200** · feedback sink 204 |

`lib/password-reset-flag.ts` is the single source of truth and **fails closed**:
absent or any value other than `'1'` means disabled, because the failure mode of
guessing "enabled" is a user stranded by a flow that cannot deliver.

Enumeration safety is preserved and tested — the disabled response carries the
same status and body as "no such account", so the disabled state is
indistinguishable to the requester. Normal sign-in is unaffected.

Regression: `recovery-disabled-invariant.test.ts` (5 tests), covering direct
access specifically, since the hidden link already "passed" while the invariant
was broken.

---

## PROMOTED TO LAUNCH BLOCKER (2026-08-08)

### The evidence that changed the classification

The founder was **locked out of his own production account** during LB-4 certification.
Two sign-in attempts failed; two reset requests were made; **no email arrived**.

Under the evidence ladder this is **L3 — demonstrated product impact**. Not a theoretical
edge case, not a heuristic that could fail: a real user, a real lockout, no working path out.

### What the lockout actually refuted

Not the severity estimate — that was always understood as terminal for the affected user.
It refuted the **base rate**.

The original deferral reasoned: *"Expected lockouts across ≤100 users over a few weeks is a
handful. Manual substitution fully covers the outcome."*

**The first authenticated production session produced a lockout** — from the person who built
the product and knows the credentials best. An external beta user, signing up once and
returning a fortnight later, is *more* likely to forget, not less.

Two further problems with the original mitigation:

1. **Founder-managed recovery has no fallback when the founder is the one locked out.** The
   mitigation assumed the founder is always available as the recovery mechanism. He was the
   casualty.
2. **The manual path has never been demonstrated for anyone.** It was asserted, not tested.
   An untested fallback is not a mitigation; it is an intention.

Cohort size alone is therefore **not** an adequate mitigation, per governance instruction.

### New pass condition

All four of:

1. reset email **arrives** at an external inbox;
2. the reset link completes;
3. the new password authenticates;
4. the old password no longer authenticates.

**Or** an explicitly founder-approved alternative recovery mechanism demonstrated working
**for an external beta user** — not for the founder, and not as a stated intention.

---

## Controlled diagnostic protocol — no production exposure required

Preview carries its own configuration, verified 2026-08-08:

| Variable | Scope |
|---|---|
| `NEXT_PUBLIC_PASSWORD_RESET` | Preview **and** Production (separate values) |
| `RESEND_API_KEY` | Preview, Production |
| `EMAIL_FROM` | Preview, Production |

So a Preview deployment exercises **the same Resend credentials** as production while leaving
the production surface disabled. Production does not need to be re-enabled to diagnose.

The latest `version-b` Preview also carries the rejection logger (`e54dd73`) and the full gate
(`b545337`), so a failed send there now produces a Sentry issue and an
`[email] send rejected by provider` line with the provider's status and a redacted reason.

### Steps

1. Founder opens the latest `version-b` Preview deployment (Vercel SSO-authenticated).
2. Confirm `Forgot your password?` renders — if it does not, Preview's flag is not `'1'`
   and that is itself the first finding.
3. Request one reset to a **real external inbox**.
4. Report: did the email arrive?
5. Engineering reads `vercel logs <preview-url>` for `[email] send rejected by provider`,
   plus the Sentry issue.

### What each outcome means

| Observation | Conclusion |
|---|---|
| `[email] send rejected by provider — status=…` | Provider rejection. The status and redacted reason name the actual cause — test mode, unverified domain, bad from-address, restricted key. |
| `[auth/forgot] … RESEND_API_KEY is unset` | The key is not readable in that runtime. Every prior "key is present" inference was wrong. |
| Neither line, no email | The send path is not being reached at all. Look upstream of `sendEmail`. |
| Email arrives | Delivery works on Preview; the difference is production-specific configuration. |

**No inference from absence.** Whichever line appears is the first *observed* datum about where
this flow stops. Everything recorded before this point is inference from behaviour.

### Re-enablement gate

Public recovery is re-enabled **only after** all four verification steps pass, with the message
ID and receiving inbox recorded here.

---

## ROOT CAUSE ESTABLISHED — malformed `RESEND_API_KEY` (2026-08-09)

The first **positive** evidence in this investigation. Every prior entry above this line
is inference from behaviour; this one is an observed exception message.

### Provenance

| Requirement | Evidence |
|---|---|
| Deployment | `dpl_3ciT1oHe5fZzFWyro7pAotZUURL6` (`az2mqwh6c`), built from **`50fa533`** — query was deployment-scoped, not host-filtered |
| Route | `λ POST /api/auth/forgot`, level `error` |
| Timestamps | `10:34:30.90` and `10:35:31.36` CEST — two controlled attempts, **identical** message |

Deployment-scoping matters here. An earlier `threw=TypeError` line carried the same
`audio-xx-web-git-version-b` host header but was served by the *previous* deployment; the
host header names the alias, not the build. Only the deployment-scoped query ties the
event to `50fa533`.

### The message

```
[email] send rejected by provider — threw=TypeError: Headers.append: "Bearer [redacted] [key-redacted]" is an invalid header value.
```

### Classification: malformed / invalid Authorization header

`Headers.append` throws while **constructing** the request. No socket is opened; the
request never leaves the Vercel runtime and never reaches Resend. That positively
excludes the other three classes:

| Class | Excluded because |
|---|---|
| network/runtime `fetch failed` | `fetch` never attempted a connection |
| HTTP provider response | no status code — there was no exchange |
| send path not reached | `sendEmail` ran; the key was present; the call was attempted |

### What the redaction shape shows

Two separate scrubber rules fired on one header value:

- `Bearer\s+\S+` → `Bearer [redacted]` — consumed "Bearer", whitespace, and one token
- `re_[A-Za-z0-9_-]+` → `[key-redacted]` — matched a **second, later** token

So the value was not `Bearer <key>` but `Bearer <token> <whitespace> re_<key>`: the
environment variable holds **more than the bare key**. A plain space would not have
thrown — spaces are legal in header values; `Headers.append` rejects **control
characters**. An invalid-value rejection *and* a whitespace split together indicate a
line break or similar control character plus extra content, the ordinary signature of a
paste that carried a newline.

**Limit of this claim:** the shape of the value is observable, its characters are not.
"Contains a control character plus extra content" is what the evidence supports. Which
character, and how it got there, it does not.

### Repair — configuration only, no code change

The code is behaving correctly. This diagnosis exists *because* the observability repair
landed; before it, the same failure was completely silent.

1. **Delete** `RESEND_API_KEY` in Preview **and** Production — do not edit in place, since
   the offending character is invisible in the field.
2. Re-add the bare key only: `re_…`, nothing before it, no trailing newline.
3. **Redeploy Preview** — env changes reach new deployments only; a running build holds
   its captured values.
4. Repeat the controlled reset; classify the next result as provider response or delivery.

### Status

Root cause established. See the certification section below for the repair and result.

---

## CERTIFIED ON PREVIEW — all four conditions (2026-08-09)

Configuration repaired: `RESEND_API_KEY` deleted and re-entered as a bare single-line
value for Preview and Production at ~`11:14:34`. **No code changed.** New Preview
`7q3wmggyg` (`dpl_5uCZ3cuRyJVd5Vg9aNygC96QpSSZ`) built from `73f72c8` at `11:16:30`,
after the env change. `git diff 50fa533..73f72c8 -- ':!docs'` is empty — code-identical
to the build that produced the diagnosis.

### The four conditions

| # | Condition | Evidence | |
|---|---|---|---|
| 1 | Email arrives at an external inbox | `POST /api/auth/forgot` `11:25:21`, **no rejection logged**; message received `11:25` from `no-reply@audio-xx.com` in the Gmail **inbox**, not spam | ✅ |
| 2 | Reset link completes | `POST /api/auth/reset` at `11:28:13`, `11:31:04`, `11:37:08` | ✅ |
| 3 | New password authenticates | `11:31:14` and `11:39:59` — `[auth] Login successful: cmmw9qoe80000wvaqu7gn7rv8 brownmike@gmail.com` | ✅ |
| 4 | Old password rejected | `11:37:21` — `[auth] Invalid password for: brownmike@gmail.com` | ✅ |

### Why condition 4 is proven rather than asserted

The log establishes the before *and* the after for the **same** credential:

```
11:31:04  POST /api/auth/reset            → P1 set
11:31:14  [auth] Login successful         → P1 is a working password (on the record)
11:37:08  POST /api/auth/reset            → P2 set, retiring P1
11:37:21  [auth] Invalid password         → P1 refused
11:39:59  [auth] Login successful         → P2 works, same user id
```

No assumption about what was typed is required, because P1's validity is itself a
logged fact. An earlier rejection at `11:32:33` was **not** counted: the password
retired at `11:28:13` had never been observed working, so that pairing showed only
"a password failed", not "the old password was invalidated."

### Two properties confirmed incidentally

- **No auto-registration.** Every successful sign-in resolved to the pre-existing
  `cmmw9qoe80000wvaqu7gn7rv8` with four saved systems loading immediately — not a
  freshly-created empty account. That was the specific way this test could have looked
  green while being meaningless. See [`../findings/auto-registration-on-signin.md`](../findings/auto-registration-on-signin.md).
- **Reset email always links to production.** `NEXTAUTH_URL` is unset on Preview, so
  [`forgot/route.ts`](../../../apps/web/src/app/api/auth/forgot/route.ts) falls back to
  `https://audio-xx.com`. Correct for real users; on Preview the host must be swapped by
  hand. Not a defect.

### Production is NOT yet enabled

Certification covers **Preview only**. Production still runs the build that captured the
old malformed key, and `NEXT_PUBLIC_PASSWORD_RESET` is off there. Re-enabling requires,
in order:

1. Redeploy Production so it captures the corrected `RESEND_API_KEY`.
2. Set `NEXT_PUBLIC_PASSWORD_RESET=1` for Production and **rebuild** — inlined at build
   time, so a redeploy alone will not surface the CTA.
3. Repeat all four verification steps against Production and record them here.

Until then the disabled-state invariant continues to hold: no user-accessible path can
offer or initiate recovery.
