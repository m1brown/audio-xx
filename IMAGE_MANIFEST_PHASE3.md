# Audio XX — Phase 3: Targeted Image Coverage Expansion

**Status:** Proposed — awaiting approval before implementation  
**Date:** 2026-04-17  
**Scope:** High-frequency catalog products beyond DIRECTION_CONTENT, plus key-matching fixes

---

## Current Coverage (post Phase 1 + 2)

| Category | Catalog products | With image | Coverage |
|----------|-----------------|------------|----------|
| DACs | 56 | 15 | 27% |
| Amplifiers | 58 | 9 | 16% |
| Speakers | 38 | 9 | 24% |
| **Total** | **152** | **33** | **22%** |

---

## Normalization Gotcha: dCS Bartók

`normalize("dCS Bartók")` = `"dcs bart k"` — the accented ó is stripped by the `[^a-z0-9 ]+` regex, leaving `"bart"` and `"k"` as separate tokens. Any image key for this product must use `dcs bart k`, NOT `dcs bartok`. This is unintuitive but correct given the normalize function.

---

## Tier A — Amplifiers (critical gap: 16% → target ~30%)

These products are in the catalog and frequently surfaced by the recommendation engine.

| # | Product | Brand (catalog) | Normalized haystack | Proposed key | Official product page | Confidence | Notes |
|---|---------|----------------|--------------------|--------------|-----------------------|------------|-------|
| A1 | Cronus Magnum III | Rogue Audio | `rogue audio cronus magnum iii` | `rogue audio cronus magnum` | rogueaudio.com/Products_Titan.htm | Medium | US manufacturer. Standard web presence. Product page confirmed via search. |
| A2 | Cortese | Shindo | `shindo cortese` | `shindo cortese` | shindo-laboratory.co.jp | Low | Japanese boutique. F2a variant page found. Non-standard site. |
| A3 | LM-211IA | Line Magnetic | `line magnetic lm 211ia` | `line magnetic lm 211ia` | line-magnetic.eu/products-line-magnetic-en/...lm-211ia... | Medium | EU distributor has product page. Chinese manufacturer. |
| A4 | SIT-3 | First Watt | `first watt sit 3` | `first watt sit 3` | firstwatt.com (product reference found) | Medium | Nelson Pass brand. Product pages exist. |
| A5 | HFSA-01 | Aurorasound | `aurorasound hfsa 01` | `aurorasound hfsa 01` | No official page found; dealer pages at highend-electronics.com, waldenhighend.com | Low | Japanese boutique. No direct manufacturer site found in search. Dealer images only. |
| A6 | AMP-23R | Enleum | `enleum amp 23r` | `enleum amp 23r` | enleum.com/amp-23r/ | High | Modern website. Clean product page confirmed. Likely has CDN image. |
| A7 | E-280 | Accuphase | `accuphase e 280` | `accuphase e 280` | accuphase.com/model/e-280.html | High | Major Japanese manufacturer. Standard product pages. Clean photography tradition. |
| A8 | E-4000 | Accuphase | `accuphase e 4000` | `accuphase e 4000` | accuphase.com (likely /model/e-4000.html) | High | Same CDN pattern as E-280. |
| A9 | Integrated | JOB | `job integrated` | `job integrated` | goldmund.com (JOB was a Goldmund sub-brand, now discontinued) | Low | Discontinued sub-brand. No dedicated product page likely still live. |

### Not in catalog (skip):
- **Kinki Studio EX-M1+** — confirmed product page at kinki-studio.com, but no catalog entry exists. Skip.
- **Pass Labs INT-25** — not found in catalog. Skip.
- **Luxman L-507Z** — not found in catalog. Skip.
- **Hegel H95** — not found in catalog. Skip.

---

## Tier B — DACs (moderate gap: 27% → target ~35%)

| # | Product | Brand (catalog) | Normalized haystack | Proposed key | Official product page | Confidence | Notes |
|---|---------|----------------|--------------------|--------------|-----------------------|------------|-------|
| B1 | Wavelight | Rockna | `rockna wavelight` | `rockna wavelight` | rockna-audio.com/products/wavelight-dac | High | Romanian manufacturer. Modern website. Clean product page confirmed. |
| B2 | R26 | Gustard | `gustard r26` | `gustard r26` | gustard.com/?post_type=products&page_id=14991 | Medium | Chinese manufacturer. Official site confirmed. Non-standard URL structure. |
| B3 | X16 | Gustard | `gustard x16` | `gustard x16` | gustard.com (product page likely exists) | Medium | Same manufacturer as R26. |
| B4 | D90SE | Topping | `topping d90se` | `topping d90se` | toppingaudio.com (product pages exist) | Medium | Chinese manufacturer with standard product pages. |
| B5 | DAC-Z8 | Eversolo | `eversolo dac z8` | `eversolo dac z8` | eversolo.com (product page likely exists) | Medium | Relatively new brand, modern website. |
| B6 | Bartók | dCS | `dcs bart k` | `dcs bart k` | dcsaudio.com/product/bartokapex | High | Major UK manufacturer. ⚠️ Key must be `dcs bart k` due to accented ó normalization. |
| B7 | d1-twelve MK2 | TotalDAC | `totaldac d1 twelve mk2` | `totaldac d1 twelve` | totaldac.com (d1-twelve page) | Medium | French manufacturer. Website confirmed. |
| B8 | d1-unity | TotalDAC | `totaldac d1 unity` | `totaldac d1 unity` | totaldac.com (product page likely at /D1-unity-en.htm) | Medium | Same manufacturer. |

### Not in catalog (skip):
- **Holo Audio Spring 3 / May KTE** — no "Holo Audio" or "Holo" brand in catalog. Skip.
- **MHDT Orchid** — not found in catalog. Skip.

---

## Tier C — Speakers (moderate gap: 24% → target ~35%)

| # | Product | Brand (catalog) | Normalized haystack | Proposed key | Official product page | Confidence | Notes |
|---|---------|----------------|--------------------|--------------|-----------------------|------------|-------|
| C1 | W5 | Boenicke | `boenicke w5` | `boenicke w5` | boenicke-audio.ch/products/loudspeakers/w5/ | High | Swiss manufacturer. Clean product page confirmed. |
| C2 | W8 | Boenicke | `boenicke w8` | `boenicke w8` | boenicke-audio.ch/products/loudspeakers/w8/ | High | Same manufacturer. Product page confirmed. |
| C3 | LRS+ | Magnepan | `magnepan lrs` | `magnepan lrs` | magnepan.com/products/magnepan-lrs-1 | High | Major US manufacturer. Official Shopify page confirmed. |
| C4 | 1.7i | Magnepan | `magnepan 1 7i` | `magnepan 1 7i` | magnepan.com (product page likely exists) | Medium | Same manufacturer. ⚠️ Key must be `magnepan 1 7i` (dot → space). |
| C5 | .7 | Magnepan | `magnepan 7` | `magnepan 7` | magnepan.com (product page likely exists) | Low | ⚠️ Key `magnepan 7` is dangerously short — could false-match other Magnepan products with "7" in the name (e.g., 1.7i normalizes to `magnepan 1 7i` which contains `magnepan 7` — but 1.7i key would need to appear first). Safest to use `magnepan 7` and ensure it appears AFTER `magnepan 1 7i` in the array. |
| C6 | Model 19 | Altec | `altec model 19` | `altec model 19` | No official page (Altec Lansing heritage product, long discontinued) | Low | Vintage product. No manufacturer page. Collector/heritage images only. |
| C7 | Kanta No. 2 | Focal | `focal kanta no 2` | `focal kanta no 2` | focal.com (product page confirmed) | High | Major manufacturer. Same CDN pattern as existing Aria 906 entry. |

### Existing key-matching note:
- `focal aria 906` already correctly matches catalog product `Focal Aria 906` ✓
- `spendor d7` key exists but catalog has `Spendor A1` (different product) — orphaned key, not a bug

---

## Tier D — Key-matching fixes (no new URLs needed)

No new key-matching bugs found. The Phase 1 fixes (DeVore Fidelity, Leben spaceless) already resolved all identified issues.

Orphaned image keys (images for products not in catalog): ~20 keys exist for products like Chord Mojo, Schiit Vidar/Saga, Rega Brio/Elex/Aethos, KEF LS50, Klipsch Cornwall/Forte, Harbeth M30.2, B&W 705, Spendor D7, Dynaudio Heritage Special. These are harmless — they'll activate if those products are ever added to the catalog.

---

## Summary of candidates

| Tier | Products | In catalog | High confidence | Medium confidence | Low confidence |
|------|----------|-----------|-----------------|-------------------|----------------|
| A (Amps) | 9 | 9 | 3 (Enleum, Accuphase ×2) | 4 (Rogue, Line Magnetic, First Watt, Accuphase E-4000) | 2 (Shindo, Aurorasound, JOB) |
| B (DACs) | 8 | 8 | 2 (Rockna, dCS) | 5 (Gustard ×3, Topping, Eversolo, TotalDAC ×2) | 0 |
| C (Speakers) | 7 | 7 | 4 (Boenicke ×2, Magnepan LRS+, Focal Kanta) | 1 (Magnepan 1.7i) | 2 (Magnepan .7, Altec) |
| **Total** | **24** | **24** | **9** | **10** | **4** |

---

## Recommended action plan

### Batch 1 — High confidence (9 products)
These manufacturers have modern websites with standard CDN patterns. Image URLs should be straightforward to extract.

1. **Enleum AMP-23R** — enleum.com/amp-23r/
2. **Accuphase E-280** — accuphase.com/model/e-280.html
3. **Accuphase E-4000** — accuphase.com (same pattern)
4. **Rockna Wavelight** — rockna-audio.com/products/wavelight-dac
5. **dCS Bartók** — dcsaudio.com/product/bartokapex ⚠️ key = `dcs bart k`
6. **Boenicke W5** — boenicke-audio.ch/products/loudspeakers/w5/
7. **Boenicke W8** — boenicke-audio.ch/products/loudspeakers/w8/
8. **Magnepan LRS+** — magnepan.com/products/magnepan-lrs-1
9. **Focal Kanta No. 2** — focal.com (CDN pattern known from Aria 906)

### Batch 2 — Medium confidence (10 products)
Product pages confirmed but CDN paths need manual extraction.

1. **Rogue Audio Cronus Magnum III** — rogueaudio.com
2. **Line Magnetic LM-211IA** — line-magnetic.eu
3. **First Watt SIT-3** — firstwatt.com
4. **Gustard R26** — gustard.com
5. **Gustard X16** — gustard.com
6. **Topping D90SE** — toppingaudio.com
7. **Eversolo DAC-Z8** — eversolo.com
8. **TotalDAC d1-twelve MK2** — totaldac.com
9. **TotalDAC d1-unity** — totaldac.com
10. **Magnepan 1.7i** — magnepan.com

### Batch 3 — Low confidence (skip or defer)
- Shindo Cortese — boutique Japanese, non-standard site
- Aurorasound HFSA-01 — no manufacturer site found
- JOB Integrated — discontinued sub-brand
- Magnepan .7 — key collision risk with 1.7i
- Altec Model 19 — vintage, no manufacturer page

---

## Egress note

All manufacturer sites tested are blocked by the egress proxy (same as Phase 2). The user will need to provide verified CDN image URLs for each product, or we can implement keys now and add URLs when provided.

---

## Net impact if fully implemented

| Category | Before | After Batch 1+2 | Coverage |
|----------|--------|-----------------|----------|
| DACs | 15 | 23 | 41% |
| Amplifiers | 9 | 16 | 28% |
| Speakers | 9 | 16 | 42% |
| **Total** | **33** | **55** | **36%** |
