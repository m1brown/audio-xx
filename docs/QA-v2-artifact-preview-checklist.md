# v2 Assessment Artifact — Preview QA Checklist

**Preview URL:** https://audio-xx-jmczfaoj4-m1browns-projects.vercel.app
**Built from:** commit `9a6c0e4` (HEAD of `version-b`), 2h old
**Flag:** `NEXT_PUBLIC_ASSESSMENT_ARTIFACT_V2=on` (Preview-only)
**Production:** flag NOT set — `audio-xx.com` continues to render the
legacy MemoFormat to all visitors. Zero production risk while you run this.

**Time budget:** ~30 minutes. Smaller if nothing surprises you.

---

## Why we're doing this

The v2 artifact is the single largest change to a first-time visitor's
impression of Audio XX. The implementation is in. The remaining work
between "built" and "in front of real users" is one human's eyes on
the live preview, followed by a one-line env-var change to flip it
on in production.

You are looking for: is this what you want first-time visitors to see?

---

## Test 1 — Desktop, flawed system

Open the preview URL on your desktop browser, signed in.

Submit (paste verbatim):

```
Assess my system: Holo May (KTE), Decware SE84UFO, Magnepan LRS+
```

**Expect to see:**

- A typeset article inside the chat message — masthead suppressed
  (Audio XX wordmark + date appear once, in the chat header, not twice).
- **Verdict** in large display type: *"The amplifier can't drive these
  speakers."*
- **Standfirst:** *"The match is the problem — not the taste."*
- Component credit line under the standfirst.
- **Evidence rail on the left** with `≈ 89 dB` as the hero datum and
  a short italic pull quote.
- **Judgment column on the right** with three beats:
    1. A "this system is built for…" recognition sentence
    2. The mechanism sentence (Decware power vs LRS+ sensitivity)
    3. The "you hear it as…" heard-consequence line
- A pause, then **"I'd resolve the power mismatch first…"** as the
  recommendation.
- **Cost line** under it.

**Pay attention to:**

- Does the article feel like something you'd save?
- Is the first screen above the fold what you want a first-time visitor
  to encounter?
- Does the chat envelope diminish the article's editorial feel?
- Any console errors? (Open DevTools.)

---

## Test 2 — Desktop, balanced (restraint) system

In the same session, submit:

```
Assess my system: Chord Qutest, Naim SuperNait 3, Harbeth Super HL5 Plus
```

**Expect to see:**

- **Verdict:** *"Nothing here needs changing."*
- **Standfirst:** the tonal-signature line.
- The restraint case — three beats demonstrating equilibrium, never
  announcing it.
- **Recommendation:** *"Leave it alone."*
- A cost line about the honest tax of any future change.

**Pay attention to:**

- Does the restraint version feel as satisfying as the bottleneck one?
- Or does "Nothing here needs changing." feel disappointing — like the
  system gave up?
- The R8 rule prevents "It is balanced" / "no weak link" /
  "nothing needs fixing" from appearing — confirm you don't see those.

---

## Test 3 — Mobile, both systems

On your phone (real device, not emulated), repeat tests 1 and 2.

**Expect:**

- Verdict in the first screen, above the fold.
- Doors collapse to a single column.
- No horizontal scroll.
- Recommendation reachable in ≤ 2 thumb-scrolls.

**Pay attention to:**

- Above-the-fold impression on a real phone.
- Tap targets if the chat composer is reachable.
- Any text clipping or layout breakage.

---

## Test 4 — Standalone artifact route (unchanged baseline)

Open these directly:

- `https://audio-xx-jmczfaoj4-m1browns-projects.vercel.app/artifact?case=flawed`
- `https://audio-xx-jmczfaoj4-m1browns-projects.vercel.app/artifact?case=balanced`

**Expect:** the standalone editorial page — masthead with AUDIO XX +
date, full article body, follow-up section at the bottom. This is what
a shared / printed artifact will look like.

**Pay attention to:**

- Print mode quality (DevTools → Rendering → Emulate CSS print media).
- The standalone page is what we'd want users to share or save as PDF.

---

## Test 5 — Existing chat behaviours not broken

In a fresh session, try:

- A consultation: `What's the trade-off between Bifrost 2/64 and Qutest?`
  → expect StandardFormat / comparison-shaped response (unchanged).
- A diagnostic: `my system sounds bright`
  → expect the diagnostic clarification flow (unchanged).
- A brand inquiry: `tell me about Naim`
  → expect brand-authority preview (unchanged).

**Pay attention to:**

- Any of these should look exactly as on `audio-xx.com` today. The v2
  flag only changes the system-assessment surface.

---

## Decision tree

After running the tests:

### If the v2 artifact looks better than legacy MemoFormat and nothing is broken

→ Authorize production deploy. The work to flip is small: one
production env var + one production deploy. The artifact reaches
real users on `audio-xx.com` and we start learning.

### If something is broken but small

→ Identify the broken thing. Decide whether to fix-then-deploy or
deploy-with-known-issue. Smallest correct fix wins.

### If the v2 artifact looks worse than expected

→ Tell me what's worse. We iterate on Preview before touching prod.
No production change yet.

### If the v2 artifact looks great but you'd rather hold

→ Hold is fine. The preview env var is independent of production.

---

## What's already proven without your eyes

These are already green and don't need your validation:

- tsc baseline (94 errors, unchanged)
- 501/501 tests in the launch-relevant bundle (catalog boundary,
  copy discipline, routing fix, v2 dispatch, 383 system-assessment
  renders)
- v2 dispatch + `embedded` mode tested
- Mobile no-overflow verified on the standalone route at 390 × 844
- The synthesizer's R1–R8 rule contract holds on 8 representative
  systems across 4 reachable engine categories

What only you can validate is the *qualitative* impression a first-time
visitor will have. That's this checklist.

---

## After QA

Report what you saw. I'll either request authorization to add
`NEXT_PUBLIC_ASSESSMENT_ARTIFACT_V2=on` to Production scope and trigger
the production deploy, or iterate on whatever you flagged.
