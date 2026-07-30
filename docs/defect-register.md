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
| D-002 | Three-axis Tonal Signature graph missing from chat-embedded and saved assessments (required artifact element) | Blocker | Tonal axes travelled only in `raw.findings.systemAxes`; payload-only surfaces produced a CAM with `tonalSignature: undefined` and the renderer's `sig &&` guard silently dropped the block. Public `/artifact` was never affected (verified in production) | 4,020 green tests asserted engine text, none asserted rendered artifact structure per entry mode; no artifact or visual gate existed; one test actively pinned the bug as intended ("payload alone → no tonal signature") | Payload-carried `systemAxes` + CAM fallback (`raw ?? payload`) + Gate C contract test across all 3 entry modes + Playwright visibility checks (desktop+mobile) + 9 pixel baselines | **Closed in repo** (`5e87294`) — production promotion awaiting product approval |
| D-003 | Shopping context silently abbreviates the active system (e.g. Chord Hugo omitted from displayed context); approved requirement said dropped components should fail closed, implemented validator only logs | Major | Phrasing caps `slice(0,2)` / `slice(0,3)` in advisory-response.ts truncate the displayed system; `system-component-dropped` is a soft (log-only) signal in `validateShoppingAnswer` | No assertion anywhere on displayed system-context completeness; the soft-vs-hard divergence from the approved spec was recorded but deferred by product instruction during the routing envelope | **None yet** — proposed invariant on record (never silently drop a required component; renderer must signal elision; promote soft→hard) awaiting product decision | **Open** — accepted risk pending decision |
| D-004 | Cross-clause category contamination: "what streamer … to feed my DAC?" resolves to `dac` (pattern-order picks the modifier class) | Minor | CATEGORY_PATTERNS scan order encodes head-final compounds ("headphone amp" = amplifier); clause structure isn't modeled, so a trailing-clause class can win. Clean fix (leftmost match) regresses the compound case | Not a production escape — surfaced by the Gate B matrix build-out before release | Pinned known-limitation test in `routing-matrix.test.ts` (trips when behavior changes, forcing a doctrine update) + backlog entry in `docs/routing-doctrine.md` §8 | **Open — Backlog** |
| D-005 | Reported "excessive whitespace / poor discoverability" on homepage & builder | — (not a defect) | Static layout measured clean at all 7 required widths (no overflow, no clipped controls, 44px hero→builder gap). The reproducible whitespace is the artifact's deliberate 60vh `.axx-sep` "screen of silence" (artifact.css); earlier contrary readings were measurement artifacts (text-only extraction, line-fragment gaps) | n/a | Gate D width-sweep assertions + 7 homepage baselines now pin the verified-clean layout; 60vh separator + below-fold CTA flagged as design decisions for the product owner | **Closed — works as designed** (design review open) |

## How to use this register

- Add a row for every material defect (Blocker/Major always; Minor when it
  produced rework or user reports). Cosmetic one-offs need not be recorded.
- A row may be marked Closed only when the Protection column names a durable,
  in-repo protection (test, invariant, gate, fail-closed behaviour) — "we fixed
  the instance" does not close a row.
- Review open rows at every release; an open Blocker means NOT READY.

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
