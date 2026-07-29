# Routing Doctrine — Licensed Category Invariant

Status: **active** · Established: 2026-07-29 · Owner: engine
Origin: production category-routing failure — `"what other streamers would you
recommend?"` returned DAC education + DAC recommendations.

This document is the governing reference for how Audio XX resolves *which
product class* a shopping/recommendation turn is about. It exists so the system
answers **the question the user actually asked**.

---

## 1. Governing invariant

> **When the user explicitly names a product class, that class is a typed,
> immutable constraint on the entire turn.** Every educational block and every
> recommended product must conform to it, unless the user explicitly licenses a
> broader class or the system asks a clarification.

The class the user is entitled to is the **licensed category**. Nothing
downstream — retrieval, ranking, education selection, rendering — may widen,
narrow, or override it silently.

## 2. The two-layer resolution model

Category is resolved in two cooperating layers. Confusing their
responsibilities is what caused the production failure.

| Layer | Where | Responsibility |
|---|---|---|
| **Detector** | `detectShoppingIntent` (shopping-intent.ts) | Detect the class named in the *current* message. Emits `category` (resolved) and `requestedCategory` (the explicit class this turn, if any). |
| **Lock** | category-lock block (page.tsx) | Conversational memory. Carries the prior turn's class forward on refinements so `"what about under $2000?"` stays in-class. |

Key distinction: the detector's `fallback` parameter is a **default when nothing
is detected**, *not* a lock that resists an incidental keyword. The lock
semantics live in page.tsx. Any new caller of `detectShoppingIntent` that needs
conversational continuity must replicate the lock decision (see
`resolveWithLock` in `routing-matrix.test.ts`).

## 3. Precedence rules (highest wins)

1. **Explicit request this turn** (`requestedCategory`) — always wins, over any
   carried lock. This is the typed immutable constraint.
2. **Explicit switch** (`detectExplicitCategorySwitch`) — verb-first switches
   ("recommend a turntable instead").
3. **Carried lock** (`activeShoppingCategoryRef`) — holds when the turn names no
   new class and is not an explicit switch.
4. **Fresh detection** — when there is no lock, the detector's own scan.

`requestedCategory` is captured **only** from the current message and **only**
from request-shaped phrasing (`recommend / suggest / looking for / other /
another / more / which / what / any / options / alternatives`). An incidental
mention ("does it pair with my turntable?") is deliberately *not* a request and
must not switch the lock.

## 4. Fail-closed final validator

`validateShoppingAnswer(ctx, answer, activeSystemComponents)` is the last line
of defense, run after the answer is composed and before it is rendered. It is
pure and deterministic.

**Hard violations → withhold the answer** (route to the knowledge lane rather
than render a mis-directed one):
- **category-mismatch** — resolved category ≠ explicitly licensed category.
- **preamble-mismatch** — the educational preamble's label ≠ resolved category.
- **product-out-of-class** — a recommended product's catalog class ≠ licensed
  class. If a conforming subset survives *and* the only violations are
  product-level, the cleaned subset renders; otherwise the whole answer is
  withheld.

**Soft signal → logged, never withholds:**
- **system-component-dropped** — an explicit multi-component active system is
  entirely unacknowledged in the answer prose (advisory-quality, not a class
  violation).

## 5. Category vocabulary

The engine resolves to **six** top-level shopping classes: `dac`, `amplifier`,
`speaker`, `headphone`, `streamer`, `turntable` (plus `general` = none named).
Finer real-world types collapse into these:
- integrated / pre / power / receiver → **amplifier**
- passive / active / bookshelf / floorstanding → **speaker**
- streaming transport / network player / renderer → **streamer**
- headphone-amp / IEM → **headphone**
- cartridge / phono → **turntable**
- standalone / portable / dac-amp / dac-preamp → **dac**

This collapse is intentional (it matches how the catalog and education are
organized), but it means sub-class nuance (e.g. active vs passive speaker) is
carried in `subcategory`, not the top-level class. Head-final compounds resolve
by CATEGORY_PATTERNS order: **"headphone amp" is an amplifier**, not headphones.

## 6. Audit matrix (Phase 2)

Deterministic golden gate: `apps/web/src/lib/__tests__/routing-matrix.test.ts`
(24 cases, two-layer faithful). Axes covered:

| Axis | Cases | Guarantee |
|---|---|---|
| Standalone naming | S1–S7 | An explicitly named class resolves to that class. |
| Follow-up / lock hold | F1–F4 | A refinement with no new class stays in the locked class. |
| Noun-first switch | N1–N5 | "what other **streamers**…" overrides a stale lock. **(the production bug)** |
| Verb-first switch | V1–V2 | "recommend a **turntable** instead" switches. |
| Incidental mention | I1–I3 | A class named incidentally does **not** switch the lock. |
| Cross-domain | X1, X3 | The request head noun wins over a modifier class. |

## 7. Findings & severity

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| **P-G1** | G1 (trust blocker) | Stale category lock overrode an explicitly-named class on noun-first requests → streamer request served DAC answer. | **FIXED** — `requestedCategory` typed constraint + lock-respect + fail-closed validator. |
| **X2** | G2/G3 | A class named in a *separate trailing clause* ("…to feed my DAC") is not distinguished from the request head noun; pattern-order resolves it to the modifier class. | **DOCUMENTED, not fixed** — different root defect from P-G1; the clean fix (leftmost-match) regresses "headphone amp"→amplifier. Pinned as a known-limitation test. |

No other G1 surfaced across the matrix. All incidental-mention and lock-hold
cases pass under the two-layer model.

## 8. Backlog

- **X2 cross-clause head-noun resolution.** Distinguish "the class I want" from
  "the class it connects to" when they sit in different clauses, without
  regressing head-final compounds. Candidate: dependency-light clause splitting
  on connective phrases ("to feed", "for my", "to drive") + head-noun of the
  leading clause. Bounded, low-frequency; ship only with a compound-safety test.
- **Lock semantics in the detector.** Consider moving the lock decision into a
  single resolver so no future caller can bypass it (today it is replicated in
  page.tsx and in the test harness).

## 9. Invariants for future changes

- Never let a downstream stage widen the licensed category.
- Any new `detectShoppingIntent` caller needing continuity must apply the lock.
- Any new category keyword must be added to CATEGORY_PATTERNS *and* considered
  for head-final compound ordering.
- The fail-closed validator must stay pure and must never *invent* a conforming
  answer — it withholds instead.
