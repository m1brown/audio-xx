# Authenticated journey pass (pre-beta item 4)

## Local full-stack pass — 2026-07-31, evidence-based (dev server, seeded fixture user)

Exercises the same code paths as production. State injection was NOT used;
the fixture user signed in through the real NextAuth credentials flow.

| Journey | Result | Evidence |
|---|---|---|
| Sign-in (post-reset password) | PASS | `/auth/signin` → redirect `/systems`; proves recovery end-to-end |
| Sign-out and return | PASS | Sign out → `/auth/signin`; re-sign-in → `/systems` with data intact |
| Save a system (conversation path) | PASS | "Review & save" → editor prefilled → Save System → listed in My Systems |
| My Systems view | PASS | Email eyebrow, FREE TRIAL · 92 DAYS · ACCOUNT billing line, system listed |
| Reopen saved system | PASS | `/systems/<id>` renders name, components, history section |
| Assessment history | PASS (via artifact save) | `/artifact` Save → system + LATEST ASSESSMENT link; snapshot reopens with tonal graph |
| Edit (rename) affordance | PRESENT | RENAME control on system page (not exercised to destruction) |
| Billing surface | PASS | Trial state renders correctly for new account |
| Recovery | PASS | See docs/auth-model.md verification section |
| Mobile rendering | PASS after fixes | 375/768/1280 — two defects found and FIXED (below) |

### Defects found

1. **FIXED (was Major, mobile):** signed-in nav overflowed 375px by ~49px
   (`.nav-secondary` past the right edge) → horizontal scroll on every
   signed-in page. Fixed in globals.css (item 7 commit).
2. **FIXED (was Minor, mobile):** builder action row wrapped "+ Add
   another component" into three lines colliding with the CTA. Now
   stacks vertically at <480px.
3. **Deferred (Minor, cosmetic):** My Systems list can render
   "Leben Leben CS600X" — brand duplicated when the model name already
   contains it.
4. **Deferred (Minor, UX):** two save paths (conversation "Save System"
   vs artifact "Save") can create two separate system rows for the same
   gear, and only the artifact path writes assessment history. Not
   access-blocking; consolidate post-beta.

## Production pass — FOUNDER ACTION (10 minutes, cannot be done by Claude)

Per standing policy Claude neither creates production accounts nor
injects auth state. On audio-xx.com, signed in as yourself:

1. Sign out, sign back in.
2. Homepage: composer opens EMPTY with your FRANCE system active.
3. Run an assessment; Save from the artifact; confirm it appears in
   My Systems with a LATEST ASSESSMENT link that reopens.
4. Check the billing/account line renders correctly for your account.
5. After Resend activation: run one real password reset on your account.
6. Repeat 2–3 once on your phone.

Report anything broken; everything above passed on identical code locally.
