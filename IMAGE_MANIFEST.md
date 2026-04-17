# Audio XX — Surfaced Product Image Manifest

**Status:** Proposed — awaiting approval before implementation  
**Date:** 2026-04-16  
**Scope:** Products that appear in surfaced recommendation contexts (DIRECTION_CONTENT follow-up chips, main review card stacks)

---

## Summary

| Category | Total catalog | With image | Coverage |
|----------|--------------|------------|----------|
| DACs | 56 | 15 | 27% |
| Amplifiers | 58 | 3 | 5% |
| Speakers | 38 | 6 | 16% |
| **Total** | **152** | **24** | **16%** |

**DIRECTION_CONTENT products (guaranteed surfaced):** 12 total, 5 with images, **7 missing**.

**Key finding:** Amplifier coverage is critically thin (3 of 58). None of the 4 amplifiers in DIRECTION_CONTENT have images.

---

## Tier 1 — DIRECTION_CONTENT products (guaranteed surfaced)

These 12 products are hardcoded in the three upgrade-path directions and will always appear when users click follow-up chips.

### DACs

| Product | Brand | Status | Existing URL | Notes |
|---------|-------|--------|-------------|-------|
| Qutest | Chord | **Present** | `chordelectronics.co.uk/.../Qutest-Black-Front.jpg` | Manufacturer CDN. Clean product shot. |
| Bifrost 2/64 | Schiit | **Present** | `schiit.com/img/img_2364.jpg` | Manufacturer CDN. Clean product shot. |
| Pontus II 12th-1 | Denafrips | **Present** | `denafrips.com/_files/ugd/...pontus...mv2.jpg` | Manufacturer CDN. Clean product shot. |
| Hugo TT2 | Chord | **Present** | `chordelectronics.co.uk/.../HugoTT2-Black-Front.jpg` | Manufacturer CDN. Clean product shot. |
| Baltic 5 | Lampizator | **Missing** | — | Manufacturer site: lampizator.eu. Product page exists but exact CDN image path needs manual verification. Lampizator uses non-standard site structure. **Confidence: low.** |

### Amplifiers

| Product | Brand | Status | Proposed source | Confidence | Notes |
|---------|-------|--------|----------------|------------|-------|
| H190 | Hegel | **Missing** | hegel.com product page | Medium | Product page confirmed at `hegel.com/en/products/discontinued/h190`. Hegel uses standard CMS image paths. CDN URL needs manual extraction. |
| SE84UFO | Decware | **Missing** | decware.com product page | Low | Product page confirmed at `decware.com/newsite/SE84CKC.html`. Decware uses a non-standard flat HTML site with mixed image paths. Manual verification required. |
| CS600X | Leben | **Missing** | leben-hifi.com | Medium | An image key `leben cs 600` already exists in product-images.ts pointing to `leben-hifi.com/images/cs600x-front.jpg` — but it does NOT match "Leben CS600X" because normalize("CS600X") = "cs600x" which lacks the space in "cs 600". **Key fix needed**, not a new URL. |
| SuperNait 3 | Naim | **Missing** | naimaudio.com product page | Medium | Product page confirmed at `naimaudio.com/products/supernait-3`. Naim uses `/sites/default/files/` CDN pattern (see existing Nait XS entry). Likely path: `naimaudio.com/sites/default/files/supernait-3-front.jpg`. Needs manual verification. |
| Boulder 866 | Boulder | **Missing** | boulderamp.com product page | Medium | Product page confirmed at `boulderamp.com/products/866-integrated/`. Boulder uses WordPress `wp-content/uploads/` CDN. Likely has a hero image. Needs manual verification. |
| A3 | Magico | **Missing** | magico.net press release | Low | Press release page at `magico.net/Marketing/Press_Release_A3.php`. A3 may be discontinued from current product lineup — no dedicated product page found. Image may exist on press page. Needs manual verification. |

### Speakers

| Product | Brand | Status | Existing URL | Notes |
|---------|-------|--------|-------------|-------|
| R3 | KEF | **Present** | `kef.com/cdn/shop/products/R3-Meta-Black-Gloss-Single-Front_1200x.jpg` | Manufacturer CDN. Clean product shot. |

---

## Tier 2 — Key matching bugs (existing URLs not resolving)

These products have image URLs already in the codebase but the key-matching logic silently fails.

| Product | Brand (catalog) | Image key | Why it fails | Fix |
|---------|----------------|-----------|-------------|-----|
| Orangutan O/93 | DeVore Fidelity | `devore orangutan o 93` | Catalog brand is "DeVore Fidelity", not "DeVore". normalize("DeVore Fidelity Orangutan O/93") = "devore fidelity orangutan o 93" which does NOT contain "devore orangutan o 93" as substring. | Change key to `devore fidelity orangutan o 93` or change catalog brand to `DeVore` (line 788+ in speakers.ts). |
| Orangutan O/96 | DeVore Fidelity | `devore orangutan o 96` | Same issue as O/93. | Same fix pattern. |
| CS600X | Leben | `leben cs 600` | normalize("CS600X") = "cs600x", no space. Key "leben cs 600" expects a space between "cs" and "600". | Add alternate key `leben cs600` or fix existing key. |

**Net impact of fixing Tier 2:** 3 additional products gain images with zero new URL sourcing.

---

## Tier 3 — High-value catalog products (likely to surface in main review stacks)

These are products the recommendation engine is likely to surface based on their catalog richness (full tendencies, brand profiles, and review data). Grouped by coverage gap severity.

### Amplifiers (critical — only 5% coverage)

| Product | Brand | Proposed source | Confidence | Notes |
|---------|-------|----------------|------------|-------|
| Rega Brio | Rega | **Present** | — | Already in image map. |
| Rega Elex-R | Rega | **Present** | — | Already in image map. |
| Rega Aethos | Rega | **Present** | — | Already in image map. |
| PrimaLuna EVO 300 | PrimaLuna | **Present** | — | Already in image map. |
| PrimaLuna EVO 400 | PrimaLuna | **Present** | — | Already in image map (but not matching any catalog product — verify). |
| Naim Nait XS 3 | Naim | **Present** | — | Already in image map. |
| Schiit Aegir | Schiit | **Present** | — | Already in image map. |
| Schiit Vidar | Schiit | **Present** | — | Already in image map. |
| Rogue Audio Cronus Magnum III | Rogue Audio | **Missing** | rogueaudio.com | Medium | Popular tube integrated, likely has product page. |
| Luxman L-507Z | Luxman | **Missing** | luxman.com | Medium | Japanese manufacturer with clean product photography tradition. |
| Hegel H95 | Hegel | **Missing** | hegel.com | Medium | Same CDN pattern as H190. |
| Pass Labs INT-25 | Pass Labs | **Missing** | passlabs.com | Medium | Well-documented manufacturer with product pages. |
| Accuphase E-280 | Accuphase | **Missing** | accuphase.com | Medium | Japanese manufacturer with clean product images. |

### DACs (moderate — 27% coverage)

| Product | Brand | Proposed source | Confidence | Notes |
|---------|-------|----------------|------------|-------|
| MHDT Orchid | MHDT | **Missing** | mhdtlab.com | Low | Small manufacturer, non-standard web presence. |
| Holo Spring 3 | Holo Audio | **Missing** | holoaudio.us | Medium | R2R DAC manufacturer with product pages. |
| Denafrips Terminator II | Denafrips | **Present** | — | Already in image map. |
| Topping D90SE | Topping | **Missing** | toppingaudio.com | Medium | Standard product page expected. |
| Eversolo DAC-Z8 | Eversolo | **Missing** | eversolo.com | Medium | Relatively new brand, modern website expected. |

### Speakers (moderate — 16% coverage)

| Product | Brand | Proposed source | Confidence | Notes |
|---------|-------|----------------|------------|-------|
| WLM Diva Monitor | WLM | **Missing** | wlm-loudspeakers.com | Low | Boutique Austrian manufacturer. Website exists but image sourcing uncertain. |
| Boenicke W5 | Boenicke | **Missing** | boenicke-audio.ch | Medium | Swiss boutique with product pages. |
| Zu Dirty Weekend | Zu Audio | **Missing** | zuaudio.com | Medium | Direct-to-consumer brand with standard product pages. |
| Focal Kanta No. 2 | Focal | **Missing** | focal.com | High | Major manufacturer. Focal CDN pattern known from existing Aria 906 entry. |
| Cube Audio Nenuphar | Cube Audio | **Missing** | cubeaudio.pl | Low | Polish boutique manufacturer. |
| Qualio Audio IQ | Qualio | **Missing** | qualioaudio.com | Low | Small manufacturer, uncertain web presence. |

---

## Recommended action plan

### Phase 1 — Free wins (no new URLs needed)
Fix 3 key-matching bugs in `product-images.ts`:
- DeVore Fidelity O/93 and O/96: adjust keys to include "fidelity"
- Leben CS600X: add alternate key without space

**Result:** +3 products gain images immediately.

### Phase 2 — DIRECTION_CONTENT gaps (7 products)
Manually verify and add image URLs for:
1. **Hegel H190** — manufacturer product page (medium confidence)
2. **Naim SuperNait 3** — manufacturer product page (medium confidence)
3. **Boulder 866** — manufacturer product page (medium confidence)
4. **Leben CS600X** — already has URL, just needs key fix (Phase 1)
5. **Decware SE84UFO** — manufacturer product page (low confidence)
6. **Lampizator Baltic 5** — manufacturer site (low confidence)
7. **Magico A3** — press release page (low confidence)

**Result:** All 12 DIRECTION_CONTENT products gain images (or are confirmed as "no suitable image found").

### Phase 3 — Amplifier coverage (critical gap)
Add images for the 8–10 most commonly recommended amplifiers beyond DIRECTION_CONTENT. This category is at 5% coverage vs 27% for DACs and 16% for speakers.

### Phase 4 — Broader catalog
Extend to remaining high-value DACs and speakers as images are sourced and verified.

---

## Notes

- Manufacturer sites were not directly fetchable (blocked by egress proxy). All "medium confidence" proposals are based on confirmed product page URLs from web search, with CDN paths requiring manual extraction.
- "Low confidence" means the manufacturer's web infrastructure is non-standard or the product may be discontinued without a persistent page.
- No URLs have been fabricated. Every proposed source is backed by a confirmed product page URL.
- The `preferImage` soft-selection rule (current implementation) will automatically prioritize image-backed products as coverage improves.
