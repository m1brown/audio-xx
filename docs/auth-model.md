# Audio XX — Public-beta authentication model (pre-beta item 3)

Decision 2026-07-31: **email + password credentials remain the principal
beta route.** It is already live, billing entitlement hangs off it, and
every alternative (magic link, social login) would strand the existing
credential users or add an identity dependency this close to beta. No
larger identity architecture is invented.

Quirk retained knowingly: sign-in **auto-registers** unknown emails
(one form creates or signs in). A typo'd email therefore creates a new
empty account rather than failing. Recorded as acceptable for beta;
revisit with real signup UX post-beta.

## Recovery flow (implemented)

- `/auth/forgot` → `POST /api/auth/forgot` — enumeration-safe (uniform
  200 for any input), per-account 5-minute cooldown.
- Emailed link `/auth/reset?token=…` → `POST /api/auth/reset` —
  tokens are 32-byte random, stored **only as SHA-256 hashes**, expire
  in 30 minutes, are single-use, and a successful reset invalidates all
  other outstanding tokens for the account. No token or password is
  ever logged.
- Storage: additive `password_reset_tokens` table (applied to local dev
  and production Turso 2026-07-31; 1 CREATE TABLE + 2 indexes, nothing
  altered).
- Email: `lib/email.ts` (Resend, plain fetch). Fail-dark without
  `RESEND_API_KEY`; dev builds echo the link to the server console for
  local verification (never in production).
- **UI gate:** the "Forgot your password?" link renders only when
  `NEXT_PUBLIC_PASSWORD_RESET=1` — users are never shown a recovery
  flow that cannot deliver mail.

## Verified locally (2026-07-31)

Seeded fixture user → forgot (uniform response for real + unknown
email; link via dev echo) → reset → old password rejected, new password
verifies, token consumed; replay → 400; short password → 400.

## Founder activation actions (once)

1. Create a Resend account (resend.com), verify the `audio-xx.com`
   sending domain, create an API key.
2. Vercel env vars (Production + Preview): `RESEND_API_KEY`,
   `EMAIL_FROM="Audio XX <no-reply@audio-xx.com>"`,
   `NEXT_PUBLIC_PASSWORD_RESET=1`.
3. Redeploy, then run one real end-to-end reset against your own
   account (this is also step 3-recovery of the authenticated
   production journey pass).
