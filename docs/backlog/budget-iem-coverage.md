# Budget IEM coverage — a founder decision, not an engineering task

**Opened:** 2026-08-13
**Status:** RESOLVED 2026-08-13 — Option A taken. Seven entry-tier IEMs added.
**Class:** catalog coverage

## The observation

The IEM pool holds 9 products. Prices:

| Product | Price |
|---|---|
| Moondrop Aria 2 | $80 |
| Etymotic ER2XR | $100 |
| Shure AONIC 3 | $179 |
| Campfire Honeydew | $249 |
| Apple AirPods Pro 2 | $250 |
| Moondrop Blessing 3 | $320 |
| Sony IER-M7 | $500 |
| Campfire Andromeda | $1,099 |
| Campfire Solaris | $1,799 |

Nothing under $80. The sub-$50 band — 7Hz Salnotes Zero, Truthear Hola,
Moondrop Chu II, KZ and similar — is entirely absent. That band is where a
large share of IEM conversation actually happens.

As of 2026-08-13 a request below coverage now explains itself rather than
returning silence (coverage-gap note, commit 994b781), so the current state is
honest. But honest-and-empty is still empty.

## Why this is a decision, not a task

Standing policy is **demand-driven coverage** — recognition-only expansion was
falsified and bulk-adding is explicitly against it. Speculatively adding budget
IEMs would violate that.

The complication: the recruitment plan targets **r/iems**, where the budget
band is the conversation. So the demand is not hypothetical — we would be
deliberately going to create it.

## The choice, framed

**Either carry the band, or drop r/iems from the recruitment sequence.**

Recruiting an audience whose most common question the product cannot answer is
worse than not recruiting them: the first tester asks for a $50 IEM, gets a
coverage note, and that is their entire impression.

- **Option A — carry it.** ~6 canonical sub-$80 sets with real trait profiles.
  Then r/iems is a fair target. Cost: catalog authoring plus permanent
  maintenance, against standing policy but for a specific, named reason.
- **Option B — hold the policy.** Leave the catalog alone, move r/iems below
  r/BudgetAudiophile and r/hifiaudio in the recruitment sequence, and let real
  requests decide what gets added. Slower, but the policy exists because
  speculative coverage already failed once.

No recommendation is implemented either way until the founder chooses.

## Related

- `project-coverage-demand-driven` (memory) — the falsified experiment.
- `project-reddit-beta-recruitment` (memory) — the r/iems targeting.


---

## RESOLVED 2026-08-13 — Option A: carry the band

Founder chose to carry it, so r/iems becomes a fair recruitment target.

Added (entry tier, `products/headphones.ts`): Moondrop Chu II $19, 7Hz Salnotes
Zero $20, Truthear Hola $20, Tangzu Wan'er S.G. $20, Kiwi Ears Cadenza $35,
Truthear Zero: Red $55, Simgot EA500LM $79. Catalogue floor moves $80 → $19.

Evidence class is `listener_consensus` at `confidence: 'medium'` for all seven —
these are mass-market sets with large stable consensus but no manufacturer
tuning documentation held by Audio XX. Descriptions stay behavioural and name
the trade each set makes rather than asserting design intent.

### Two couplings this exposed, both caught by gates

1. **A stale assumption in budget parsing.** `parseBudgetAmount` carried a
   $50 minimum-plausibility floor, commented "No hi-fi budget is under $50" —
   true when the catalogue started at $80. With the band added, "IEMs under
   $25" parsed to *no budget at all* and returned the $1,799 Solaris. Floor
   lowered to $10 (`MIN_PLAUSIBLE_BUDGET`), which still rejects the junk the
   guard was written for ($0 from "0k", $1 from "$1e9"). Anything real below
   coverage is now answered by the coverage-gap note rather than ignored.

2. **Catalog index drift.** `catalog-index.json` (the intake typeahead source)
   is generated, and the drift test failed until regenerated with
   `npx tsx scripts/generate-catalog-index.ts` — now 189 entries.

### Coverage now

| Budget | Result |
|---|---|
| under $100 | EA500LM $79 · Aria 2 $80 · ER2XR $100 |
| under $75 | Zero: Red $55 · Cadenza $35 · Salnotes Zero $20 |
| under $50 | Cadenza $35 · Salnotes Zero $20 · Hola $20 |
| under $25 | Salnotes Zero $20 · Hola $20 · Chu II $19 |
| under $15 | coverage note — genuinely below the floor |

### What this does NOT change

Standing policy remains demand-driven coverage. This was a deliberate,
reasoned exception for a named audience we are choosing to recruit — not a
precedent for bulk expansion. Post-beta, coverage should still follow observed
requests.
