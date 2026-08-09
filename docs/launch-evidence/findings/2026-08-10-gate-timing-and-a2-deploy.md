# 2026-08-10 — Release-gate timing evidence, A2 deploy, and two routing repairs

## 1. Release-gate timing (closes the "nondeterministic gate" question)

`node scripts/release-gate.mjs --accept-deferred` run ONCE on the clean
`f7db5ac` tree, in a background shell with no harness timeout:

- **Wall-clock: 120 seconds. Exit 0. PASS** (Gates A, B, C-structural, E;
  C-visual + D deferred, explicitly accepted).

The prior "release gate is nondeterministic" finding stays withdrawn. This
run does not even approach the 10-minute invoking-command timeout, which
supports the harness-timeout explanation for the earlier FAILs; no gate
defect was observed.

## 2. A2 deploy certified live

`f7db5ac` deployed to production: deployment **`audio-xx-hqrxlnrmf`**
(`dpl_Dk7A7bYsoXHFFwvpyn9qjYnCrL4d`), aliased to audio-xx.com, target
production, status Ready. (First `vercel deploy --prod` attempt failed with
a transient network `fetch failed` during upload; the retry succeeded —
no code or config implication.)

Live verification after hard reload, each prompt on a fresh turn-1
conversation:

| Prompt | Result |
|---|---|
| "is my system balanced" | ✅ asks "What components are in your system? …" |
| "weakest link in my setup?" | ✅ same component ask |
| "does anything need changing in my setup" | ✅ same component ask |
| "my system sounds bright" (control) | ✅ keeps full diagnostic treatment + "What is your current source …" question |
| "my system is fine but i have upgrade itch" (control) | ✅ unchanged churn question ("What specifically prompted this consideration? …") |

## 3. Churn gating repair — "should i upgrade my dac" (commit `0cce503`)

**Measured root cause** (not the one hypothesized): the churn early-return
lives in the *diagnosis* branch (page.tsx ~4657). The control's "my
system…" phrasing makes `routeConversation` return `diagnosis`, so the
diagnosis-continuity override folds it into that branch and the gate fires.
"should i upgrade my dac" routes as `inquiry`, keeps intent
`audio_knowledge`, and was consumed by the knowledge lane (Lane 2,
page.tsx ~3213) before any churn check — the knowledge LLM then invented
"the issue" the user never reported. `newTurnCount` was not involved.

**Repair**: Lane 2's entry now runs the same turn-1 `detectChurnSignal`
gate before consuming the turn. The pinned separation
(`churn-control-pin.test.ts`, 6/6 green) is unchanged: the three A2
prompts remain churn-negative, both controls keep their paths.

**Rule that was missing**: a first-turn churn gate must apply wherever a
vague-upgrade turn can land, not only on the diagnosis path — otherwise
intent routing silently decides whether churn avoidance exists.

## 4. Shopping routing repair — "speakers for 2000 dollars" (commit `a3c0498`)

**Measurement before classification**: on `f7db5ac` production this prompt
does **not** ask "What's your budget?" (that behavior belonged to an
earlier build). It routes to the knowledge lane and answers with a generic
essay — no recommendations, budget unused.

**Root cause**: the shopping pattern
`/\b(?:dac|amp|…|speaker|…)\s+(?:for|that)\b/` lists only singular nouns —
"speaker for 2000 dollars" matched, "speaker**s** for" did not — and the
budget-signal regexes elsewhere require `$`, "under", or the word
"budget". So the prompt fell past every shopping gate to the
`audio_knowledge` default. The parser was never at fault:
`parseBudgetAmount` and `detectShoppingIntent` both return 2000, and
`getShoppingClarification` asks nothing once the prompt reaches shopping.

**Repair**: pluralize the alternation
(`dacs?|amps?|amplifiers?|integrated|speakers?|headphones?|streamers?`).
Diagnosis is unaffected — gate 1 fires before the shopping gate, so
"my speakers for some reason sound harsh" still routes to `diagnosis`.

**Rule that was missing**: category-word alternations in intent gates must
cover the plural forms the shopping vocabulary already recognizes.

## 5. Test evidence at `a3c0498`

- Full vitest suite: **4196 passing / 20 failed — identical 20-test
  baseline, 0 new failures** (the 2 public-beta-copy failures reproduce on
  clean `f7db5ac`).
- `churn-control-pin.test.ts` 6/6.
- Focused 8-file pre-commit bundle: 180/182 with only the 2 pre-existing
  baseline failures.
- Release gate re-run on `a3c0498`: see §6.

## 6. Deploy of `a3c0498`

- Release gate on `a3c0498`: **PASS, wall-clock 47 seconds, exit 0**
  (same gate profile as §1).
- `npx vercel deploy --prod` was **blocked by the session's permission
  classifier** (twice; the same command was permitted for the `f7db5ac`
  deploy earlier in the session). Not retried further.
- **Status: `a3c0498` is gated-green and NOT deployed.** Production
  remains `audio-xx-hqrxlnrmf` = `f7db5ac`. Live verification of §3/§4
  ("should i upgrade my dac" → reflective question; "speakers for 2000
  dollars" → shopping recommendations with budget 2000, no budget ask)
  is pending the next deploy.
