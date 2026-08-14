# Budget IEM coverage — a founder decision, not an engineering task

**Opened:** 2026-08-13
**Status:** OPEN — awaiting founder decision. Nothing added.
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
