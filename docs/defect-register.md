# Audio XX — Defect Register

Living register (Continuous QA Improvement doctrine, 2026-07-30). Every
material defect is recorded with its full cycle: root cause → escape analysis
→ permanent protection. **The important outcome is not the defect; it is the
permanent protection that now exists.** An incident is not closed until the
protection column is filled.

Severity per the Operating Doctrine: Blocker / Major / Minor / Backlog.

| ID | Description | Severity | Root Cause | Escape Reason | Protection Added | Status |
|---|---|---|---|---|---|---|
| D-001 | "what other streamers would you recommend?" returned DAC education + DAC recommendations (wrong licensed category) | Blocker | Carried-forward category lock (page.tsx) force-overwrote an explicitly named class: noun-first requests weren't recognized as switches, and the detector's current-utterance scan is suppressed when a fallback is present (shopping-intent.ts) | No routing gate existed; engine tests never modeled the two-layer detector+lock resolution, so the lock's override path was untested | `requestedCategory` typed immutable constraint + fail-closed `validateShoppingAnswer` + Gate B routing matrix (24 cases, lock-faithful) + `docs/routing-doctrine.md` | **Closed** — fix in production (`b3e261b`) |
| D-002 | Three-axis Tonal Signature graph missing from chat-embedded and saved assessments (required artifact element) | Blocker | Tonal axes travelled only in `raw.findings.systemAxes`; payload-only surfaces produced a CAM with `tonalSignature: undefined` and the renderer's `sig &&` guard silently dropped the block. Public `/artifact` was never affected (verified in production) | 4,020 green tests asserted engine text, none asserted rendered artifact structure per entry mode; no artifact or visual gate existed; one test actively pinned the bug as intended ("payload alone → no tonal signature") | Payload-carried `systemAxes` + CAM fallback (`raw ?? payload`) + Gate C contract test across all 3 entry modes + Playwright visibility checks (desktop+mobile) + 9 pixel baselines | **Closed** — fix in production (`bed1ff1` app tree, promoted 2026-07-30 with product approval) |
| D-003 | Shopping context silently abbreviates the active system (e.g. Chord Hugo omitted from displayed context); approved requirement said dropped components should fail closed, implemented validator only logs | Major | Phrasing caps `slice(0,2)` / `slice(0,3)` in advisory-response.ts truncate the displayed system; `system-component-dropped` is a soft (log-only) signal in `validateShoppingAnswer` | No assertion anywhere on displayed system-context completeness; the soft-vs-hard divergence from the approved spec was recorded but deferred by product instruction during the routing envelope | Partial (Phase 2): `nameSystem()` transparent elision replaced the silent `slice(0,2/3)` truncations in advisory prose ("…and N more components"). The soft→hard validator promotion still awaits product decision | **Open (narrowed)** — display half closed; validator half pending decision |
| D-004 | Cross-clause category contamination: "what streamer … to feed my DAC?" resolves to `dac` (pattern-order picks the modifier class) | Minor | CATEGORY_PATTERNS scan order encodes head-final compounds ("headphone amp" = amplifier); clause structure isn't modeled, so a trailing-clause class can win. Clean fix (leftmost match) regresses the compound case | Not a production escape — surfaced by the Gate B matrix build-out before release | Pinned known-limitation test in `routing-matrix.test.ts` (trips when behavior changes, forcing a doctrine update) + backlog entry in `docs/routing-doctrine.md` §8 | **Open — Backlog** |
| D-005 | Reported "excessive whitespace / poor discoverability" on homepage & builder | — (not a defect) | Static layout measured clean at all 7 required widths (no overflow, no clipped controls, 44px hero→builder gap). The reproducible whitespace is the artifact's deliberate 60vh `.axx-sep` "screen of silence" (artifact.css); earlier contrary readings were measurement artifacts (text-only extraction, line-fragment gaps) | n/a | Gate D width-sweep assertions + 7 homepage baselines now pin the verified-clean layout; 60vh separator + below-fold CTA flagged as design decisions for the product owner | **Closed — works as designed** (design review open) |
| D-006 | Recommendation ignored the user's stated preference: "warm, full-bodied" asked → neutral pick, fabricated opposite taste claim, "missing: sonic preferences" caveat, and the already-answered taste question re-asked | Blocker | Two disconnected extractors (server `processText` vs client `extractDesires`); no typed current-turn preference anywhere in ranking; counterbalance scorer (−0.5/+0.5) silently opposing the request; `getTopTraits` threshold-less on an all-zero profile unlocked at 0.15 confidence by the preference sentence itself | No test asserted the pick/prose against a stated preference; taste sufficiency consulted only the fetch-dependent extractor | `ShoppingContext.statedPreferences` (typed, current-turn, fetch-free) consumed at five choke points: gap suppression, taste question, directed mode, ranking-traits fold, counterbalance suspension; expert-disagreement sentence on conflict; 0.15 floor on pairing-intro traits. Tests: `recommendation-quality.test.ts` listen-first block | **Closed** — fix in production (ae3b9fc tree, promoted 2026-07-30 with product approval; live-verified) |
| D-007 | Class AB amplifier card claimed "Pure Class A bias" while its spec line said Class AB (Rotel A11 Tribute, production) | Blocker | `topo.includes('class-a')` substring-matches `'class-ab'`; no Class AB branch, so AB amps fell into the Class A sentence | No fact-consistency check existed between card prose and catalog spec | Class AB exclusion guard + `cardFactViolations()` validator (claims vs topology/architecture; contradictions dropped — omission over confident error) wired into the sound-profile builder; catalog-wide + multi-budget rendered-card tests | **Closed** — fix in production (ae3b9fc tree, promoted 2026-07-30 with product approval; live-verified) |
| D-008 | All shortlist cards carried the identical "Pairs with a warm-leaning chain…" sentence and repeated "deficit…untouched" engine-speak | Major | Posture sentence depended only on system label, not the product; single-form deficit template; no cross-card de-dup | No test compared prose across cards | Product-led posture sentences (philosophy voice), rotated editorial deficit forms, shortlist-level de-dup (omit rather than repeat), "chain"→"system"; uniqueness + vocabulary tests | **Closed** — fix in production (ae3b9fc tree, promoted 2026-07-30 with product approval; live-verified) |
| D-009 | 38% of catalog retailer_links dead (70/185: NXDOMAIN, fabricated domains, parked, dead paths) and 8/8 hardcoded Amazon ASIN links bad — 7 dead listings, 1 ASIN reused by an unrelated product (browser click-tested). Revenue-critical: affiliate fees are the planned primary income stream | Blocker | Links were authored once with no verification and never re-checked; several domains were guessed (vinnierossiautomotive.com, dfridelity.com); ASINs rot as listings churn | No link-integrity check of any kind existed; curl-based checks were assumed impossible for bot-blocked hosts, so nothing was probed | 46 fixed to curl-verified domains, 38 deleted (unverifiable), Amazon ASIN links banned in favour of generated search URLs; `scripts/qa/link-integrity.mjs` (DNS+HTTP sweep, on-demand) + `retailer-link-hygiene.test.ts` (https-only, dead-domain denylist, no review sites, no bare marketplace homepages, no /dp/ ASINs) in the gate | **Closed** — commits 5caae97 (awaiting product approval for promotion) |
| D-010 | Affiliate links could not actually monetize: identifiers were read via a dynamic `process.env[name]` lookup of server-only vars inside client components — always undefined in the browser AND invisible to Next's `NEXT_PUBLIC_*` build-time inlining (which requires literal references) | Major (business) | Env-var access pattern assumed server rendering; link builders run client-side; dynamic lookup defeated inlining | Never exercised: no affiliate program is enrolled yet, so the gap was invisible | Build-time public configuration chosen over server-side generation (tags are public identifiers — no secret to protect; simpler cache/ops). `affiliate-config.ts` now reads literal `NEXT_PUBLIC_*` refs with server-var fallback; `affiliate-activation.test.ts` pins both states (unconfigured → plain links + inactive disclosure; test-scoped ID → `tag=`/`campid=` demonstrably in generated URLs). Disclosure derives from the same getters. Activation = founder enrolls in the programs and sets 2 Vercel vars; no fake IDs in source | **Closed (activation-ready)** — commit pending in pre-beta ops envelope; enrollment remains a founder action |

## How to use this register

- Add a row for every material defect (Blocker/Major always; Minor when it
  produced rework or user reports). Cosmetic one-offs need not be recorded.
- A row may be marked Closed only when the Protection column names a durable,
  in-repo protection (test, invariant, gate, fail-closed behaviour) — "we fixed
  the instance" does not close a row.
- Review open rows at every release; an open Blocker means NOT READY.

## Carried forward — product-approved deferrals (2026-07-30)

Accepted by the product owner under the Editorial Restraint Pass approval
(`fd6f2ab`, READY WITH KNOWN LIMITATIONS). **Assigned to a future responsive &
entry-experience envelope — do not fix piecemeal, do not inflate to blockers:**

1. Awkward mobile wrapping of the action row.
2. Excessive vertical space in the lower desktop entry page.
3. Unresolved hierarchy between structured component entry and free-text entry.
4. Signed-in surfaces not yet visually verified (also gap watch #1).

Palette refinement is explicitly closed for this phase — preserve `fd6f2ab`.

## Standing gap watch (defect classes that could still escape)

Reviewed at every release — propose the smallest closure before the defect occurs:

1. **Authenticated-surface behaviour** — no gate exercises the signed-in
   conversational surface; both D-001 and D-002 partly lived there. Smallest
   closure: one authenticated Playwright smoke using a seeded test account
   (needs product-owner decision on test-account provisioning; state injection
   is prohibited).
2. **Preview/Production flag drift** — build-time `NEXT_PUBLIC_*` flags can
   differ between environments; D-002's production verification was limited by
   an unconfirmable flag value. Smallest closure: expose non-secret flag states
   (e.g. a `data-flags` attribute in the root layout) so the post-promotion
   verification pass can read them. Needs product approval (new surface).
3. **Skipped visual tier** — `release-gate.mjs` marks the Playwright tier
   DEFERRED when no server is available. Closure (implemented): the runner now
   fails unless the visual tier ran or `--accept-deferred` is passed explicitly,
   so skipping is a conscious, logged act.
4. **Stored-data schema drift** — saved `payloadJson` snapshots are rendered by
   ever-newer code (D-002's saved-surface variant). Smallest closure: a
   snapshot-compatibility test rendering a frozen v1 payload fixture through
   the current renderer (candidate for the next envelope).
