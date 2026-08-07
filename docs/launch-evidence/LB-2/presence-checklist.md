# LB-2 — Legal / privacy presence checklist

**Blocker:** LB-2 — Legal / privacy review
**Objective presence check:** ✅ **PASS — 6 of 6**, re-run against production 2026-08-07T11:33Z
**Adequacy sign-off:** ⬜ **OPEN — founder's. Not signed on his behalf.**

| | |
|---|---|
| Production deployment | `audio-xx-24otyn5v9` |
| Commit | `e3b786b` |
| Promotion (UTC) | 2026-08-07T11:29:37Z → 11:32:21Z |

## History

First run (2026-08-07, deployment `audio-xx-pkcq95k3x`): **FAIL — 5 of 6.** Item 3 failed;
the policy named NextAuth.js and Amazon Associates but disclosed no actual data processor.
Repaired in `e3b786b`. This file records the passing re-run.

---

## Verified active processor inventory

Derived from code and production configuration, not assumption.

| Service | Active? | Data it receives | Evidence |
|---|---|---|---|
| **Vercel** | ✅ Yes | Every request; server logs holding `[AXX-EVENT]` usage events and free-text feedback comments | Hosting platform; `/api/events` writes via `console.log` |
| **Turso** | ✅ Yes | Accounts, saved systems, listening preferences | `prisma.ts:40-48` — `PrismaLibSQL` with `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`, both set in Production |
| **OpenAI** | ✅ Yes | **User-typed system descriptions and questions** | `audio-lanes.ts:108,184` POST `{systemPrompt, userPrompt}` → `/api/memo-overlay`; `memo-overlay/route.ts:26` resolves `MEMO_LLM_PROVIDER ?? 'openai'` (override unset in Production); `listing-eval/route.ts:138` calls `api.openai.com` directly |
| **Sentry** | ✅ Yes | Technical error diagnostics | `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` set in Production; `instrumentation.ts:42-47` sets `sendDefaultPii: false`, `tracesSampleRate: 0`, `beforeSend: scrub` (redacts request bodies + cookies) |
| **Amazon Associates** | ✅ Yes | Referral tag on outbound shopping links | `tag=audioxx20-20` verified live |
| **Resend** | ❌ **Integrated, not in use** | None currently | Sole caller is `/api/auth/forgot`; `NEXT_PUBLIC_PASSWORD_RESET=0` in Production, so no mail flow is reachable |
| **NextAuth.js** | n/a — **not a processor** | — | A library running inside Audio XX; not a separate company receiving data |

### Anthropic — explicitly ruled out

Code contains an Anthropic branch (`memo-overlay/route.ts:76`, `callShoppingLLM.ts:171`), but
**`ANTHROPIC_API_KEY` is absent from every Vercel environment**, and neither
`MEMO_LLM_PROVIDER` nor `ORCHESTRATOR_LLM_PROVIDER` is set in Production, so both paths
resolve to `'openai'`. The Anthropic branch cannot execute in production. The provider was
identified from configuration, not guessed.

> Noted, not acted on (engineering frozen): `orchestrator/route.ts:15`'s docstring claims the
> default is `'anthropic'`, contradicting `callShoppingLLM.ts:34`. A stale comment, no runtime
> effect.

---

## The six checks, against production

| # | Item | Result | Published line |
|---|---|---|---|
| — | URLs return 200 | ✅ | `/privacy` 200 · `/terms` 200 |
| 1 | Categories of data collected | ✅ | *"What we collect — If you create an account, we store your email address, listening preferences, and any system or component information you choose to enter."* |
| 2 | Account + saved-system storage | ✅ | *"Turso — database. Stores accounts, saved systems and listening preferences."* |
| 3 | Third-party processors **named** | ✅ | Vercel 2 · Turso 2 · OpenAI 4 · Sentry 2 · Amazon Associates 2 · Resend 2 · NextAuth 2 occurrences |
| 3b | LLM transmission stated | ✅ | *"OpenAI — language model. When you describe a system or ask a question, that text is sent to OpenAI to help generate the response you read."* |
| 4 | Feedback tied to advisory identifier | ✅ | *"If you answer one of the short feedback prompts beneath an assessment, your answers and any comment you write are recorded together with an identifier for the assessment they refer to…"* |
| 5 | Contact route for access / deletion | ✅ | *"You may delete your account and all associated data at any time by contacting us."* + `hello@audio-xx.com` |
| 6 | Effective date | ✅ | Privacy: *"last updated on August 7, 2026"* · Terms: *"Last updated 29 July 2026 · Beta"* |

Supporting published lines:

- **Vercel** — *"hosting. Serves every page and request, and stores the server logs, which include the anonymous usage events described above and any comment you type into a feedback prompt."*
- **Sentry** — *"error monitoring. Receives technical diagnostics when something breaks. It is configured not to collect personal information, and request bodies and cookies are removed before an error report is sent."*
- **Resend (inactive)** — *"An email service (Resend) is integrated but is not currently in use: password-reset email is switched off, and no other feature sends mail."*
- **NextAuth (not a processor)** — *"Sign-in is handled in Audio XX itself using the NextAuth.js library. It is not a separate company and your credentials are not sent to a third party for authentication."*

---

## Two further corrections the repair exposed

1. **Missing usage-event and feedback disclosure.** The policy never mentioned the analytics
   events or the feedback prompt at all. Without adding them, the new Vercel entry would have
   referred to events the document did not describe. Both are now disclosed.
2. **A contradiction in the existing text.** *"We do not sell, rent, or share your personal
   information with third parties"* was directly contradicted by the processor list — sending
   your typed text to OpenAI is sharing under any plain reading. Narrowed to: we do not sell or
   rent, do not pass data to anyone for their own advertising or marketing, and the listed
   providers handle data only to run Audio XX.

No retention periods, international-transfer representations, GDPR rights or processor
obligations were invented. Only what the evidence supports.

---

## Remaining to close LB-2

The objective half passes at 6/6. The blocker stays **open** until the founder adds:

```
Reviewed by <name> on <date>.
```

That is a legal-adequacy judgment and is not Claude's to make.
