# Audio XX — QA

**Last updated:** 2026-05-09
**Audience:** anyone running QA against Audio XX, whether before a friends-shareable push, before journalist outreach, or as part of routine regression catching.

---

## 1. Screenshot QA workflow

The single most-used QA tool in this project is **the user pasting a screenshot of localhost into the conversation**. Claude reads the screenshot visually and cross-references against expected behaviour and recent code changes.

What screenshots typically catch:

- Visual regressions (warm colour leakage, broken hierarchy, accidental spacing changes)
- Wrong-product images (catalog overlay map mis-keyed)
- Active-state issues (nav not highlighting current route)
- Doubled labels ("JOB JOB Integrated"), orphaned text, raw markdown
- Wordmark / accent rule positioning
- User-message bubble styling

Workflow:

1. User runs `npm run dev` (port 3000) or visits the Vercel preview.
2. User exercises a path (types a query, scrolls to a region of interest).
3. User pastes the screenshot.
4. Claude inspects what's rendered, checks against the most recent code state, identifies inconsistencies.
5. Claude proposes the smallest fix; user decides whether to apply.

Screenshots are the de-facto test harness for visual surfaces. The behavioural-regression harness (Workstream A8) is not yet built, so behavioural surfaces also rely partly on screenshot inspection plus manual prompt walks.

---

## 2. Canonical prompts

The canonical prompt list is documented in `docs/implementation-plan.md` (Workstream A8). These are the prompts a journalist or a friend is most likely to type. Each one anchors a specific behavioural property.

```
1. "best DAC under $1500"
   → Routes to shopping. Asserts: trade-off named, no duplicate prior response.

2. "I want more flow"
   → Routes to refinement (REFINEMENT_ESCAPE) when active system exists.
     Else routes to general advisory. Asserts: system-relative reasoning.

3. "my system sounds harsh"
   → Routes to diagnosis. Asserts: references active system components by name,
     names a likely upstream cause, offers do-nothing as valid path.

4. "compare Qutest vs Pontus"
   → Routes to comparison. Asserts: both products resolved, comparison
     artifact rendered with axis positions and trade-offs.

5. "tell me about Zu Audio"  (or any unknown / partial-knowledge brand)
   → Routes to brand authority page or graceful unknown-product handler.
     Asserts: no empty wall, confidence calibrated to source quality.

6. "should I do nothing?"
   → Asserts: do-nothing is named as a valid path, not a fallback.

7. "PA system for a venue"
   → Routes to adjacent / out-of-scope handler. Asserts: doesn't force-route
     into hi-fi advisory framing.

8. "line array for a concert tour"
   → Routes to out_of_scope. Asserts: declines clearly, no fabrication.
```

Status today: prompt 1 is well-walked (regularly tested via screenshots). Prompts 2–8 have been walked occasionally but are not part of any automated harness. Pre-demo, all eight should be walked end-to-end.

---

## 3. Regression philosophy

From `CLAUDE.md` and `docs/implementation-plan.md`:

- **No fix without a test that would have caught the bug.** This rule is invoked when burning down the 8 known misalignments tracked in `MEMORY.md`. The behavioural-regression harness (A8) is the long-term home for these tests.
- **Behavioural assertions over text-matching.** Tests should assert *properties* of the output (routing path, confidence level, trade-off presence, continuity with prior turn) rather than exact wording. The advisory voice can shift; behavioural contracts should not.
- **Pre-existing 98-error TypeScript baseline must not regress.** Every change must preserve `tsc --noEmit` exit count of 98. New errors are not allowed without an explicit deferral note.
- **One commit per logical change.** Bundling regressions into compound commits makes blame harder when something breaks weeks later.

The eight known misalignments (from `MEMORY.md`):

1. Advisory builders perform product lookup before system reasoning (should be deferred)
2. Discovery flags are binary keyword matches, not evidence-based
3. Turn cap (3) is primary brake instead of evidence-based phase transitions
4. Follow-up continuity broken (QA C1) — duplicates prior response
5. Unknown products return empty responses (QA C4)
6. Non-advisory intents force-routed into advisory framing (QA C3)
7. StructuredMemoInputs deprecated path still active in `consultation.ts`
8. Component descriptions duplicate when axis positions are similar

Each of these is a regression-source. None are demo-blockers if the canonical prompt list works, but each is a "second-message ends the demo" risk depending on context.

---

## 4. Link QA

Documented procedure (executed once in this session — see commits `dfce75b`, `8935761`, `3b654fb`):

1. **Inventory.** `grep -n` for `<Link>` and `<a href=` patterns across `apps/web/src/components/` and `apps/web/src/app/`.
2. **Internal route reachability.** Extract every distinct internal `href`. Map each to a `page.tsx` file. Confirm no broken routes.
3. **External hygiene.** Confirm every external `<a href="https...">` carries `target="_blank"` and `rel="noopener noreferrer"`.
4. **Placeholder detection.** `grep` for `href=""`, `href="#"`, `localhost`, `example.com`, `todo`, `placeholder`, `staging`. None of these should appear in production code (in-page anchor `href="#category-id"` patterns are an exception — verify they're scroll-targets, not placeholders).
5. **Retailer URL distribution.** Count unique hosts across `apps/web/src/lib/products/*.ts`. Spot-check known-broken patterns.
6. **Live-probe ambiguous URLs.** When a domain is suspected dead, run `curl -I -L --max-time 12 -o /dev/null -w "%{http_code}\n%{url_effective}\n"`. Inspect status, redirect target, body preview. Confirm the destination is the actual manufacturer, not a parked / for-sale lander.
7. **HTTP → HTTPS upgrade rule.** Don't auto-upgrade. Probe each candidate. Upgrade only when HTTPS returns clean 200 with valid TLS and matching content. Recent confirmed cases: Hornshoppe (upgraded), Line Magnetic (HTTP and HTTPS both pointed to a parking page — domain replaced with `.eu` instead), WLM (HTTPS port 443 refused — left on HTTP).

Catalog liveness will rot over time. Periodic link sweeps (quarterly is reasonable) catch silent breakage before a journalist does.

---

## 5. Image QA

The image system is described in `ARCHITECTURE.md` § 10. QA points:

- **`resolveProductImageStrict` returns `undefined` on miss.** No broken-image placeholder. If a card renders without an image surface, that is intentional — verify the entry has no overlay match before assuming a bug.
- **Wrong-product image risk.** The overlay map keys on `${normalize(brand)} ${normalize(name)}`. Diacritic stripping (`Frérot` → `fr rot`) and hyphen/space normalisation (`Raal-Requisite` → `raal requisite`) have caused stealth misses historically. When adding a new entry, verify both the original spelling and the normalised form match.
- **Source attribution must be present.** Every overlay entry should include `{ tier, site, credit, captured }`. If `source` is missing, the card hides the "Image: ..." caption — acceptable but flagged.
- **Coverage drift.** As of recent push, ~94% of the catalog has image coverage. Drift down means new entries are being added without overlays — log a follow-up.

---

## 6. Deployment checks

Before sending a friends-shareable URL or a journalist link:

- **Vercel preview is live.** Branch `friends` (or whichever is active) deploys cleanly. No build errors.
- **Sentry DSN is set in Vercel env vars.** `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` populated. Verify by checking that intentional errors land in the Sentry dashboard.
- **Auth flow works end-to-end.** Sign in / sign out path completes without hanging.
- **Database connection is healthy.** A logged-in user can save a system; the system persists across page reloads.
- **First-paint loads under 3s on a cold cache.** Slower than that and a journalist will close the tab.
- **The four canonical paths from Workstream A0 walk cleanly:** "best DAC under $1500", system assessment, brand question, hypothetical. Each ends without hitting an empty wall, a duplicated reply, or a force-routed shopping response.

The `friends` branch is the current shareable target. `main` is reserved for the journalist-readiness tier (post-A6 burndown).

---

## 7. Advisory-quality checks

For each substantive advisory response, the reviewer should be able to answer "yes" to all of these:

- **System-aware?** Did the response reference the user's active system (if one exists), or did it evaluate the candidate in isolation?
- **Trade-off named?** Did the response name what each suggestion costs as well as what it gains?
- **Confidence calibrated?** If the underlying data is thin, did the response hedge ("based on limited public information") or refuse?
- **Do-nothing surfaced?** Was "no change" presented as a legitimate option, especially when the system is near equilibrium?
- **No scoring or "best" framing?** No numeric ranks, no marketing superlatives, no urgency.
- **Reasonable example count?** 1–2 gear examples per direction, 3 only if the user explicitly asked.
- **Trade-off discipline preserved across turns?** Follow-ups did not regress to one-sided cheerleading.

A response that fails any of these is a regression. Severity depends on which: failing "system-aware" is a demo-blocker; failing "trade-off named" is a polish issue; failing "do-nothing surfaced" undermines the entire identity.

---

## 8. Things that commonly regress

Catalogued from the last six months of work:

1. **Warm colour leakage.** UI passes have repeatedly reintroduced beige / saffron / gold accents after explicit monochrome cleanups. Audit `#e3dcc8`, `#a89870`, `#FBE7DA`, `#F5D0B8`, `#D85A1F` after any palette change. As of 2026-05-09 the workspace is clean except for three pre-existing styles in `globals.css` (`#a89870` input focus, `#c0bdb5` btn-primary borders, `#f5f3ef` tag-active) that predate the workspace pass.
2. **Wordmark duplication.** Three wordmarks (top nav, main column, advisory turn marker) drifted into the design at peak. Today there are two visible (top nav + main column hero); the rest are removed. Watch for re-introduction.
3. **Active-state plumbing on workspace-only rails.** The LeftRail mounts only on `/`, so `usePathname()` inside it is dead code. Don't re-add it without first deciding whether the rails should mount on every route.
4. **Follow-up duplication.** When a user sends a context-enriching follow-up ("I have a tube amp"), the engine has historically replayed the prior advisory verbatim. Continuity is a known M1 misalignment (#4) and should be regression-tested aggressively.
5. **Unknown product blank wall.** Catalog misses produce empty responses today. The LLM overlay is meant to handle this; until then, watch for any non-catalog product reference.
6. **Force-routed non-advisory intents.** "Write me a message in French" has historically been pushed into the advisory pipeline. Intent classifier should yield a graceful decline.
7. **Doubled product names.** "JOB JOB Integrated" — the brand-prefix logic in system-chain rendering can double-prepend. Sample any system chain that includes a saved system.
8. **Markdown rendering artifacts.** Raw markdown leaking into the rendered output is a recurring cosmetic regression. The advisory rendering pipeline strips most of this; a misconfigured renderer can re-leak.
9. **Slate-blue vs cool-neutral confusion.** The advisory cards retain a slate-blue working palette (`COLOR.accent` `#1F3A5F`) for borders and accent strokes. The workspace rails are cool-neutral. Don't confuse the two surfaces — slate-blue lives only in advisory rendering.
10. **Recent activity reset on navigation.** RightRail "Recent" appears empty after any navigation away from `/`. This is a known gap — `messages` state is not persisted. Listed in the navigation QA's deferred items.

---

## 9. Pre-demo gating questions

When deciding whether to send a URL to a journalist:

- Can a stranger have a 5-message conversation without hitting a dead end? (M1)
- Will every response feel considered, not templated? (M2)
- Is the visible polish above prototype-tier? No doubled names, no markdown leaks, no broken images, no warm-colour glitches, no inactive nav. (M3 + workspace passes)
- Is the landing experience under 10 seconds to comprehension? (M4)
- Are credibility signals in place — reference attribution, transparency about coverage limits, basic SSL? (M5)

These map directly to the five milestones in `ROADMAP-SPEAKS-FOR-ITSELF.md`. The M1 questions are the demo-killers. The M3+ questions are the prototype-tells.
