# Finding — unknown email auto-registers on sign-in

**Recorded:** 2026-08-09
**Status:** RECORDED ONLY — not classified, not investigated, nothing changed
**Instruction:** hold until LB-5 is complete

Observed incidentally while querying Preview logs for the LB-5 recovery diagnosis. It
is unrelated to LB-5 and is recorded here so it is not lost.

## Observation

Preview `az2mqwh6c` (`50fa533`), 2026-08-09 10:35:15.82 CEST, `λ POST /api/auth/callback/credentials`:

```
[auth] Attempting login for: hello@audio-xx.com
[auth] No user found, auto-registering: hello@audio-xx.com
[auth] Auto-registered user: cmsljrtu80002jx043owr3unc
[auth] Login successful: cmsljrtu80002jx043owr3unc hello@audio-xx.com
```

The credentials provider **creates an account** when the submitted email is unknown,
rather than rejecting the sign-in.

## Why it was worth recording

Stated as questions to be answered later, not as conclusions:

- A mistyped address yields a working-but-empty account instead of an error. Does the
  user have any way to tell that is what happened?
- It interacts with LB-5 pass condition 4 (*old password must be rejected*): a test that
  signs in with a wrong address would auto-create a fresh account and appear to succeed.
  Any old-password rejection test must confirm it is exercising the **same** user id.
- The founder's production lockout (which promoted LB-5 to a blocker) happened on a
  sign-in path that includes this behaviour. Whether the two are related is **not
  established** and is not asserted here.

## Not established

- Whether this is intentional (a deliberate frictionless-signup choice) or a defect
- Whether production behaves the same as Preview
- What the behaviour is when the email exists but the password is wrong
- Any security or account-takeover consequence

No reproduction has been run, no code has been read, no classification has been made.

## Next step when LB-5 closes

Reproduce deliberately, read the credentials provider, then classify under the standard
defect classes (engineering / editorial / ontology / UX / catalog / data-quality) before
proposing anything.
