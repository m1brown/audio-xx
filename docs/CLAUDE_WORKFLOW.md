# Audio XX — Claude Workflow

**Last updated:** 2026-05-09
**Audience:** anyone joining the project who needs to use Claude (or any other AI assistant) productively against this codebase. Documents the conventions developed over six months of working with the engine.

---

## 1. Role split: ChatGPT vs Claude

Strategic and tactical work are split between two assistants.

- **ChatGPT** — strategic direction, product framing, document-shaping, philosophy questions, roadmap decisions, copy review, voice & tone calibration. Operates outside the codebase. Outputs that feed back into Claude as constraints (e.g., `CLAUDE.md`, `ROADMAP-SPEAKS-FOR-ITSELF.md`, the design briefs that come in as user messages here).
- **Claude (this assistant)** — tactical implementation. Operates inside the codebase. Reads files, edits files, runs shell commands, runs typecheck, traces routing logic, drafts isolated commits. Does not invent product direction; executes against direction provided.

The handoff pattern: ChatGPT generates a spec or directive → user pastes it as a Claude prompt → Claude implements with surgical edits and reports back. Claude does not redesign the spec.

---

## 2. Coding discipline

Drawn directly from `CLAUDE.md` (the project's locked behaviour spec). The eight working rules:

1. **Diagnose before coding.** Trace input → detected intent → routing → handler → output. Identify the exact failure point before writing any code.
2. **Smallest safe fix.** Modify only the function or file responsible. Do not expand scope. Do not refactor unrelated logic.
3. **No silent side effects.** List every file changed. Justify each change.
4. **Verify with real inputs.** Test with the exact user-reported inputs. Show detected intent, routing path, and final behaviour. Include at least one control case that must not break.
5. **Encode the rule.** After fixing, state the rule that was missing — express it as a system behaviour rule.
6. **Protect core invariants.** Explicit category overrides, budget persistence, comparison must not degrade in shopping mode, etc. (Full list in `CLAUDE.md`.)
7. **Stop and re-plan if scope expands.** If more than one logical area needs changes, stop and re-evaluate.
8. **Engine vs domain boundary.** Core reasoning modules must remain domain-agnostic. Audio-specific logic belongs in adapter / mapping layers. Apply the "Climate Screen test" — could this logic run unchanged in a different domain?

Violations of these rules are the most common source of regressions. The rules are not aspirational — they are enforcement.

---

## 3. Small-fix workflow

A typical surgical fix in this codebase:

1. **User describes the bug** — ideally with the exact input and the broken output.
2. **Claude traces the path** — `grep` for the symptom, read the routing layer, identify the responsible function. No speculative refactor.
3. **Claude proposes the smallest patch** — one file, one function ideally. Often a 5–20 line edit.
4. **Claude shows the diff intent** before writing — naming the before/after values and the rule being encoded.
5. **Claude writes the patch** and runs `tsc --noEmit` to confirm zero new type errors.
6. **Claude reports back** — files changed, lines, before/after, what's left untouched.
7. **User decides commit timing.** Claude does not commit autonomously.

Anti-pattern: "while I'm in here, let me also fix this nearby thing." Don't. Each adjacent fix is a separate session or a separate commit.

---

## 4. Commit discipline

Observed conventions from recent history:

- **Isolated commits.** Each logical change ships as its own commit. The link-QA pass shipped as four separate commits (Gustard batch, Line Magnetic, Hornshoppe, etc.) rather than one consolidated commit.
- **Descriptive messages.** Imperative mood, brief, focused on the *what* and *why*. Examples from recent history: `Fix broken Gustard product links` / `Restore subtle Audio XX accent color` / `Upgrade Hornshoppe manufacturer URL to HTTPS`.
- **No batching unless requested.** Claude does not bundle multiple unrelated changes into one commit even when working tree contains them.
- **No automatic commits.** The user always issues the commit command. Claude does not run `git commit` on its own initiative.
- **No `--amend` after a hook fails.** Per the bash safety protocol — fix the issue, re-stage, create a new commit. Amending after a pre-commit hook failure can lose work.
- **No force-push to `main`.** Always warn first if the user requests one.
- **No skipped hooks** (`--no-verify`, `--no-gpg-sign`) unless the user explicitly asks.

---

## 5. Testing expectations

Test framework: **Vitest 2** (configured at the root). Test files live primarily in `apps/web/src/lib/__tests__/` (~134 files).

Run commands (from repo root):

```bash
npm test                # vitest run — full suite
npm run test:watch      # vitest in watch mode
npm run typecheck       # apps/web tsc --noEmit + packages/rules typecheck
npm run lint            # eslint across .ts/.tsx
```

There are 98 pre-existing TypeScript errors at the time of writing. They live mostly in `qa-tests.ts` (top-level — needs `allowImportingTsExtensions` or import-path fixes) and in `apps/web/src/app/page.tsx` (multiple shape mismatches). Fixing the TS baseline is tracked in `docs/implementation-plan.md` as Workstream A1 (deferred).

The convention when introducing a fix:

1. **Write a failing test first** that exercises the bug.
2. **Apply the fix.**
3. **Confirm the test passes** without weakening other tests.
4. **Confirm `tsc --noEmit` count is unchanged** (98 baseline; never regress).

The behavioural-regression harness (Workstream A8 — `apps/web/src/lib/__tests__/behavioral-regression.test.ts`) is not yet built. The plan calls for canonical-prompt-driven assertions on routing, confidence calibration, trade-off presence, continuity, and restraint. Until A8 lands, regression detection is largely manual.

---

## 6. "Diagnose before coding"

This phrase appears verbatim in `CLAUDE.md` and is the most-cited rule. Concretely it means:

When a bug is reported, before writing any code, produce a one-paragraph trace that names:

- the **input** (verbatim user message)
- the **intent** the classifier detected
- the **routing** path (which handler ran)
- the **output** that resulted
- the **expected output** and what step diverged

Only then is the fix scoped. A fix that doesn't name the diverging step is almost always wrong-layer (e.g., patching the renderer when the bug is in intent classification).

Recent example from this session: the active-system tuning bug ("more warmth" force-routed to shopping when an active system existed) needed three layers fixed — intent.ts (REFINEMENT_ESCAPE gate), consultation.ts (extractComplaint regex extension), page.tsx (diagnosis short-circuit). Without the trace, only one layer would have been touched and the bug would have re-surfaced.

---

## 7. Smallest-safe fix

Defined in `docs/implementation-plan.md` and reinforced in CLAUDE.md. A "smallest-safe fix" has these properties:

- Touches **one file** when possible, two only when the bug genuinely spans layers.
- Adds **no new dependencies** without flagging the choice.
- Preserves all existing public types unless the user explicitly asks for a type change.
- Includes **a test** (or at least a behavioural assertion) that would have caught the bug.
- Can be reverted in one commit with no follow-on cleanup.

Counter-example: replacing `COLOR.accent` everywhere with a new token because one place uses the wrong value. The fix is to change one usage; the broader cleanup is a separate scope decision.

---

## 8. Prompt structure conventions

Observed conventions when the user prompts Claude in this project:

- **Constraint preamble.** "Do NOT modify advisory logic / routing / engine / data models." This is recurring guard-rail text. Respect it literally.
- **Explicit deferred lists.** "Do not address yet: A, B, C." Items on this list stay deferred even if they look obvious to fix.
- **Explicit acceptance criteria.** Most prompts list exactly what the response should contain ("Return: A, B, C, D"). Match the structure.
- **Pre-staging via screenshots.** Screenshots are often the diagnostic input. Read them carefully — colour cues, active-state highlights, broken-image placeholders all carry signal.
- **Numbered tasks.** Multi-task prompts are numbered. Address each in order; report back per-task.

When in doubt, mirror the structure of the user's prompt in the response. The user has invested in writing the prompt cleanly; matching it in the report keeps the conversation auditable.

---

## 9. Branch workflow

Current state: all active development happens on `friends`. See `ARCHITECTURE.md` § 12 for branch inventory.

The Claude default behaviour:

- Stay on `friends` unless told otherwise.
- Never switch branches without an explicit user instruction.
- Never push to `main` without an explicit user instruction.
- When the user says "commit and push," push to `origin/<current-branch>` — typically `origin/friends`.
- After a commit, run `git status` to confirm the working tree state. If anything unexpected remains, surface it.

The `cd` issue worth knowing: the project lives at `/Users/mikebrown/audio-xx/audio-xx/` (nested under an outer wrapper). If a Bash command's CWD drifts to the outer `/Users/mikebrown/audio-xx/`, relative paths break. The recovery pattern is `cd /Users/mikebrown/audio-xx/audio-xx && <command>`.

---

## 10. AI assistant constraints (canonical list)

From `docs/implementation-plan.md` lines 294–302:

- Surgical edits — touch only the file in scope
- Exact diffs with file paths and line ranges
- State acceptance criteria upfront before writing code
- Do not refactor unrelated logic
- Do not introduce new dependencies without flagging the choice and alternatives
- Match existing code style and naming conventions
- Flag scope expansion before acting on it

These are the canonical guardrails. Every tactical session should be readable against this list.

---

## 11. What Claude is good at, and what it is not

**Good at:**

- Tracing call graphs across the codebase (especially the lib/ engine)
- Pattern-based audits (link QA, retailer URLs, type errors)
- Surgical edits to isolated functions or style blocks
- Drafting commits with clear messages
- Reading screenshots and mapping visual state to code state
- Live-checking URLs via curl probes
- Producing structured reports (this document is itself an example)

**Not good at, or actively avoided:**

- Designing the advisory voice (that's `CLAUDE.md` + ChatGPT territory)
- Picking product direction (roadmap territory)
- Deciding what to commit when (always defer to the user)
- Inventing trait calibrations (these come from the trait framework + curated ChatGPT analysis)
- Editing `CLAUDE.md` itself unless asked
- Auto-fixing the 98 pre-existing TS errors (Workstream A1 is deferred for a reason)

---

## 12. Onboarding a new contributor (or assistant)

If you (or a new assistant) are picking this project up cold, the recommended reading order is:

1. `README.md` — project framing
2. `CLAUDE.md` — locked behavioural spec
3. `ROADMAP-SPEAKS-FOR-ITSELF.md` — milestones and demo target
4. `docs/AudioXX_Advisory_Brain.md` — 5-step pipeline
5. `docs/audio_xx_sonic_trait_framework_v1.md` — 4-axis trait system (locked v1)
6. `docs/audio_xx_knowledge_model.md` — hybrid knowledge model (locked v1)
7. `docs/implementation-plan.md` — sprint-shaped task list
8. `docs/strategic-briefing.md` — broader product strategy
9. `docs/ARCHITECTURE.md` (this directory) — current code structure
10. `docs/QA.md` (this directory) — QA workflow
11. `docs/PRODUCT_PHILOSOPHY.md` (this directory) — what differentiates Audio XX
12. `MEMORY.md` (in the user's `.claude/` memory) — known misalignments + working preferences

Once read in this order, a new contributor or assistant should be able to take a tactical prompt and execute against it without further onboarding.
