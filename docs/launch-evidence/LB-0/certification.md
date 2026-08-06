# LB-0 — Brand-page repair, production certification

**Blocker:** LB-0 — Promote the brand-page repair
**Captured:** 2026-08-06T19:25:45Z
**Recorded by:** Claude (Launch Mission 2)

## Deployment under test

| Field | Value |
|---|---|
| Production deployment | `audio-xx-97lr0obt2-m1browns-projects.vercel.app` |
| Vercel project ID | `dpl_ApxVkBYBDa3sqPeEi3e2Cgz2vLuJ` |
| Commit | `4cb19df79ee05142265bab4f86bf46b669aabe93` |
| Promoted from | Preview `audio-xx-bc1tlwl3v` |
| Promotion window (UTC) | 2026-08-06T19:21:54Z → 19:24:37Z (3m) |
| Alias | audio-xx.com ✅ |
| Previous production | `audio-xx-q4bg97vfc` (`42da903`) |

## Pass condition

> All five return **200** and none of the bodies contains `__next_error__`. **Five of five.**

**Result: PASS — six of six** (one more than required).

## Per-route evidence

| Route | Status | `__next_error__` | Title | Commerce links | Affiliate params |
|---|---|---|---|---|---|
| `/brand/klipsch` | 200 | 0 ✅ | Klipsch — Audio XX | amazon 2 · ebay 2 · hifishark 2 | `tag=audioxx20-20` `campid=5339152664` |
| `/brand/devore` | 200 | 0 ✅ | Devore — Audio XX | ebay 2 · hifishark 2 | `campid=5339152664` |
| `/brand/harbeth` | 200 | 0 ✅ | Harbeth — Audio XX | amazon 4 · ebay 4 · hifishark 4 | `tag=audioxx20-20` `campid=5339152664` |
| `/brand/kef` | 200 | 0 ✅ | Kef — Audio XX | amazon 8 · ebay 6 · hifishark 6 | `tag=audioxx20-20` `campid=5339152664` |
| `/brand/naim` | 200 | 0 ✅ | Naim — Audio XX | amazon 4 · ebay 4 · hifishark 4 | `tag=audioxx20-20` `campid=5339152664` |
| `/brand/rega` | 200 | 0 ✅ | Rega — Audio XX | amazon 2 · ebay 2 · hifishark 2 | `tag=audioxx20-20` `campid=5339152664` |

Two further brand routes (`/brand/shindo`, `/brand/leben`) also returned 200 with no error
marker in the full sweep — eight of eight brand routes recovered.

## Principal content

`/brand/kef` renders the authored sections — Philosophy, Sonic Character, Strengths,
Trade-offs, Pairing Guidance, Design Families — and real product identities (LS50 Meta,
R3 Meta, Blade). Confirms the page is rendering brand knowledge, not an empty shell.

`/brand/klipsch` has no BrandProfile and correctly degrades to the catalog view
("No brand profile yet for Klipsch. Showing catalog entries.") with the Heresy IV card,
price, and buy links. Graceful degradation working as designed.

## Two apparent anomalies, both correct behaviour

1. **DeVore carries no Amazon link.** By design — `devore` and `devore fidelity` are in
   `AMAZON_EXCLUDED_BRANDS` (`apps/web/src/lib/amazon-links.ts`), alongside Decware, Leben,
   Boenicke, First Watt, Job, Scott, Quad and Linear Tube Audio. Boutique brands are
   deliberately not sent to Amazon. Its eBay campaign ID is present as expected.
2. **No "REPRESENTATIVE MODELS" heading on profiled brands.** That heading belongs to the
   no-profile fallback view. Profiled brands render the full authored section set instead.

## Before / after

Byte counts rose sharply as error pages were replaced by real content:

| Route | Before (`42da903`) | After (`4cb19df`) |
|---|---|---|
| `/brand/klipsch` | 500 · 24,051 B | 200 · 32,708 B |
| `/brand/devore` | 500 · 40,827 B | 200 · 61,533 B |
| `/brand/harbeth` | 500 · 30,685 B | 200 · 44,394 B |
| `/brand/kef` | 500 · 52,564 B | 200 · 80,476 B |
| `/brand/naim` | 500 · 50,169 B | 200 · 77,847 B |
| `/brand/rega` | 500 · 36,218 B | 200 · 54,154 B |
| `/brand/shindo` | 500 · 44,133 B | 200 · 68,162 B |
| `/brand/leben` | 500 · 47,675 B | 200 · 73,956 B |

## Verdict

**LB-0 CLOSED.** Pass condition met with production evidence.
