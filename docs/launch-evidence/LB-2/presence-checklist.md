# LB-2 — Legal / privacy presence checklist

**Blocker:** LB-2 — Legal / privacy review
**Objective presence check performed:** 2026-08-07 by Claude (both documents are public)
**Adequacy sign-off:** ⬜ **not yet given** — founder's, and separate from the check below

## Pass condition

> Both URLs return 200 **and** all six checklist items are marked found with a quoted line
> **and** a dated sign-off line exists. **Six of six, or the blocker stays open.**

**Result: FAIL — five of six.** Item 3 is not satisfied.

## URLs

| URL | Status |
|---|---|
| https://audio-xx.com/privacy | 200 ✅ |
| https://audio-xx.com/terms | 200 ✅ |

## Checklist

| # | Required disclosure | Found | Quoted line |
|---|---|---|---|
| 1 | Categories of data collected | ✅ | *"What we collect — If you create an account, we store your email address, listening preferences, and any system or component…"* |
| 2 | Account + saved-system storage | ✅ | *"Database hosting for account and preference storage"* |
| 3 | Third-party processors **named** | ❌ | **See below** |
| 4 | Affiliate-link disclosure | ✅ | *"…influence which products are recommended or how they are ranked. For more details, see our Affiliate Disclosure."* |
| 5 | Contact route for data access / deletion | ✅ | *"You may delete your account and all associated data at any time by contacting us."* + `hello@audio-xx.com` |
| 6 | Effective date | ✅ | Privacy: *"This policy was last updated on March 26, 2026."* Terms: *"Last updated 29 July 2026 · Beta"* |

## Item 3 — the failure, precisely

The privacy policy's **Third-party services** section reads in full:

> Audio XX uses the following third-party services:
> - Authentication provider (NextAuth.js) for secure sign-in
> - Database hosting for account and preference storage
> - Amazon Associates Program for affiliate links

Two services are named (NextAuth.js, Amazon Associates). **The actual data processors are not.**
A search of both documents returns **zero** occurrences of:

| Processor | Role | What it handles |
|---|---|---|
| **Vercel** | Hosting / infrastructure | Every request; also the `[AXX-EVENT]` log stream, which now carries **free-text feedback comments** and user-agent strings |
| **Turso** | Database | Named only as "Database hosting" — accounts, saved systems, preferences |
| **Sentry** | Error monitoring | Error context, request metadata, IP addresses |
| **Resend** | Transactional email | Email addresses (integration present; recovery UI currently disabled) |
| **LLM provider** (OpenAI / Anthropic) | Advisory generation | **User-typed system descriptions and questions** |

The last is the most material. Users type descriptions of their systems and their questions, and
that text is sent to a third-party model provider. Nothing in either document discloses it.

**The policy is also stale relative to current processing.** It was last updated
**26 March 2026**. Sentry, Resend, and the feedback-event pipeline were all added after that
date — Sentry and Resend within the last week.

## What is required to close

A founder decision on wording, then a content edit naming the processors actually in use and
what each handles. This is legal-document content, not engineering: **I have not drafted or
edited it**, and would only do so on your instruction with wording you approve.

Once the text is published, re-run this checklist and add:

```
Reviewed by <name> on <date>.
```

Both halves are required — the presence check (objective) and the adequacy sign-off (yours).

## Verdict

**LB-2 REMAINS OPEN.** Five of six. The pass condition was not weakened to obtain a green state.
