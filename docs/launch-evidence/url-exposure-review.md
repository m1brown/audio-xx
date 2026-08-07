# URL data-exposure review (Launch Mission 4C)

**Prompted by:** the LB-2 finding that `/artifact?system=<free text>` puts user text in a URL.
**Date:** 2026-08-07 · Production `babaf0b` / `audio-xx-ca4hpucfg`
**Method:** read-only code + configuration trace. No code changed, no data touched.

**Classification: Launch Specification** — acceptable for the first 10–15 cohort, correct during beta.

---

## A · Exposure map

Only **two** production routes place user-derived text in a URL.

| Route | Source data | Nature | Auth | Persistence |
|---|---|---|---|---|
| `/artifact?system=<text>` | `composeSystemText(fields)` → `"Assess my system: A, B, C"` from System Builder fields; or `system.canonicalText` from a saved system | **Structured component list** | Reachable from authenticated saved-system pages; also direct entry | Transitional, but **designed to be shareable** |
| `/save?system=<text>` | Same text, from the artifact page's Save action | Same | Authenticated action | Transitional |

**Entry points, exhaustively:**

- `systems/[id]/page.tsx:64` — saved system → artifact (authenticated)
- `systems/[id]/assessment/page.tsx:52` — same (authenticated)
- `ArtifactActions.tsx:121` — artifact → `/save?system=`
- `compose-system-text.ts:23` — the helper both use
- `artifact/page.tsx:55` — **not navigation**; this is `generateMetadata` writing `openGraph.url`

### The decisive finding

**The main conversational surface never puts user text in a URL.** The only `/artifact` link in
`page.tsx` is `href="/artifact?case=flawed"` — a fixed demo case. A user's typed prose — their
room, budget, listening habits, preferences, the genuinely personal material — travels to
`/api/memo-overlay` in a **POST body**, never a query string.

That matters twice over: it is the more sensitive content, and the Sentry `beforeSend`
**does** redact `event.request.data`.

So what actually reaches a URL is a comma-joined list of hi-fi components, prefixed
`"Assess my system:"`.

---

## B · Who can receive or retain it

| Surface | Verdict | Basis |
|---|---|---|
| **Browser history** | ✅ Confirmed | Any visited URL |
| **Vercel access / function logs** | ✅ Confirmed | Platform logs request paths including query strings |
| **Sentry `request.url`** | ✅ Confirmed — *on error only* | `instrumentation-client.ts` `beforeSend` redacts `request.data` and `bc.data.message`, never `request.url` or breadcrumb `from`/`to`/`url` |
| **Copied / shared links** | ✅ Confirmed — *by design* | `compose-system-text.ts:19` — "Self-contained, shareable assessment URL" |
| **Saved database records** | ✅ Confirmed — *intended* | `AssessmentSnapshot.systemText`; user-owned, cascade-deletes with the account |
| **OpenAI** | ❌ **Not exposed via URL** | LLM calls send `{systemPrompt, userPrompt}` as a POST body. The system text does reach OpenAI — disclosed — but not through the URL |
| **Outbound `Referer` to commerce/manufacturer** | ❌ **Not exposed** | All outbound product links carry `rel="noopener noreferrer"` (AdvisoryProductCard 529/602/631/660/1278, TrackedAnchor); brand-page images use `referrerPolicy="no-referrer"` |
| **Analytics / event telemetry** | ❌ Not exposed | `trackEvent` sends `{event, props}`; props carry `advisoryId`, product and link fields — never the page URL |
| **Search engine indexing** | ⚠️ **Possible under defaults** | `robots.txt` disallows `/save`, `/systems`, `/account`, `/auth/`, `/api/`, `/profile`, `/onboarding` — **but not `/artifact`**. Not in the sitemap and only linked from disallowed pages, so no crawl path exists today; a publicly shared artifact link could be crawled |

---

## C · Launch significance

**Sensitivity — low.** The parameter carries a list of audio components. Not health, finance,
credentials, location or conversation. A gear list is the kind of thing audiophiles routinely
post publicly on forums. The sensitive material never enters a URL.

**Likelihood — low.** The chat flow never generates these URLs. Producing one takes an
authenticated user navigating from a saved system, or using the builder.

**Persistence — moderate.** Vercel logs and browser history retain it; both age out. Sentry
retains it only if an error occurs on that page.

**User expectation — mostly aligned.** The URL is *designed* to be shareable; a user who copies
it is choosing to. What they would not expect is the copy sitting in server logs — which the
policy now discloses.

**Does invite-only mitigate?** Meaningfully. 10–15 known invitees, no public discovery path, no
sitemap entry.

### Verdict: **Launch Specification**

Not a blocker. Leaving it unchanged for a bounded, known cohort of 10–15 is not irresponsible.

---

## Strongest counterargument to my own classification

*The "it's only component names" defence describes typical use, not what the system permits.*

The builder fields are unconstrained free text. Nothing stops someone typing
`"my wife's system — she doesn't know what I spent"` into a field, and that string becomes a
URL, a Vercel log line, a browser-history entry, and — on error — a Sentry `request.url`. My
sensitivity assessment rests on a behavioural assumption, not an enforced constraint. Add the
`robots.txt` gap on `/artifact`, and a shared link could in principle be indexed. If the
assumption is wrong, the exposure is real and sits in logs the user cannot reach.

**Why it does not change the classification:** the field labels (*Source or DAC*, *Amplifier*,
*Speakers*) tightly constrain what people type; the cohort is 10–15 people the founder knows by
name; nothing is irreversible — logs expire; and the behaviour is now accurately disclosed. It
does justify moving this to the **front** of the Launch Specification queue rather than the back.

---

## D · Smallest repair, for the beta window (not implemented)

**Proposed change:** for saved systems, address the artifact by identifier —
`/artifact?systemId=<id>` — and resolve the text server-side from the authenticated record.
Keep `?system=` working for the builder and demo cases.

**Affected:** `artifact/page.tsx` (param handling + `generateMetadata`), `systems/[id]/page.tsx:64`,
`systems/[id]/assessment/page.tsx:52`, `ArtifactActions.tsx:121`, `compose-system-text.ts`.

**Compatibility:** existing `?system=` links keep working; the change is additive.

**The real tradeoff — and why this needs a product decision, not an engineering one:**
shareability is an *intentional* property ("Self-contained, shareable assessment URL"). An
id-addressed artifact is only resolvable by its owner, so **sharing an assessment would break**
unless a separate share token is introduced. That is a product question about whether shareable
assessments matter, which is exactly the kind of thing the beta should answer.

**Cheaper interim mitigation (one line, if you want it now):** add `Disallow: /artifact` to
`robots.txt`. Closes the indexing gap without touching the route. Not done — product work under
freeze.

**Verification plan if implemented:** round-trip test on `composeSystemText` → URL → decode;
saved-system → artifact renders for owner and 404/redirects for non-owner; existing `?system=`
links still render; release gate; production route sweep.

---

## E · LB-2

Objective status **unchanged at 6/6**. This review found **nothing undisclosed** — the corrected
policy already states that the assessment's web address contains the system description and that
it can therefore appear in an error report. No further wording change is required.
