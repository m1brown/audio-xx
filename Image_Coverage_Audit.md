# Image Coverage Audit

**Date:** 2026-04-16
**Scope:** Product cards (catalog) and brand-level views
**Status:** Audit only — no code changes this turn
**Constraint honored:** No speculative or pattern-inferred URLs added

---

## 1. Current state (baseline facts)

- **Catalog products with inline `imageUrl`:** 0 of 183
  - DACs: 0/56 populated, 6 TODO comments
  - Amplifiers: 0/58 populated, 7 TODO comments
  - Speakers: 0/38 populated, 5 TODO comments
  - Headphones: 0/25 populated
  - Turntables: 0/6 populated
- **Curated overlay (`apps/web/src/lib/product-images.ts`):** 29 hand-verified manufacturer/CDN URLs, substring-keyed by `(brand + name)`. This is the only source of product images today.
- **Render contract:** `p.imageUrl ?? getProductImage(brand, name)`. Unknown product → image block omitted cleanly. Broken URL → `onError` hides the wrapper. No placeholders, no initials tile.
- **Brand-level imagery:** No structural support. `BrandProfile` (`consultation.ts:235-262`) has no `logoUrl`, `representativeImageUrl`, or equivalent field. The brand-only path in `consultation.ts:1575-1576` reuses `getProductImage(brand, undefined)` which returns nothing useful for substring-keyed entries.

---

## 2. Priority missing products by brand

Listed in the order I'd attack them. "Covered" means the curated overlay returns a real URL today; "Missing" means the card renders without an image.

### Tier 1 — major brands the demo flow already references

| Brand | Product | Status | Notes |
|---|---|---|---|
| Rega | Planar 3 | **Missing** | Highest-visibility turntable miss; brand has 3 amp entries already, no source/turntable |
| Naim | SuperNait 3 | **Missing** | Reference flagship integrated; only Nait XS 3 + Nait 5si covered |
| Denafrips | Venus II | **Missing** | Mid-tier flagship between Pontus and Terminator; commonly recommended |
| DeVore | O/Baby | **Missing** | Entry-tier monitor often paired in low-power demos |
| DeVore | Gibbon 3XL | **Missing** | Conventional cone alternative to the Orangutan line |
| DeVore | Super 9 | **Missing** | Recently launched; appears in newer recommendation contexts |
| Harbeth | Compact 7ES-3 / C7ES-3 XD | **Missing** | Iconic mid-line model between P3ESR and SHL5+ |
| Klipsch | La Scala AL5 | **Missing** | Heritage flagship; Heresy/Cornwall/Forte already covered |
| Schiit | Yggdrasil | **Missing** | Reference DAC; only Bifrost/Modi/Modius covered |
| Schiit | Tyr / Mjolnir | **Missing** | Flagship monoblocks/integrated; only Vidar/Aegir/Saga covered |
| KEF | Reference 1 Meta | **Missing** | Step-up from R3 / LS50 already covered |
| Focal | Aria 936 / Sopra | **Missing** | Floorstander tier; only Aria 906 covered |
| Bowers & Wilkins | 805 D4 | **Missing** | Reference standmount; only 705 S3 covered |

### Tier 2 — secondary brands appearing in the catalog

| Brand | Examples missing |
|---|---|
| ATC | SCM11, SCM19, SCM40 |
| ProAc | Tablette 10, Response D2R |
| Dynaudio | Special 40, Confidence 20 (Heritage covered) |
| Spendor | Classic 1/2, A4 (D7.2 covered) |
| LS3/5a clones | Falcon Acoustics, Stirling Broadcast |
| Sonus faber | Lumina, Olympica Nova |
| Vandersteen | 1Ci, Treo CT |
| Magnepan | LRS+, .7, 1.7i |
| Hegel | H120, H190, H390 |
| Luxman | L-505uXII, L-509X |
| McIntosh | MA252, MA5300 |
| Cambridge Audio | CXA61, CXA81, Edge A |
| NAD | C3050, M33 |
| Marantz | Model 30, PM-10 |
| Rotel | A14MKII, Michi X3 |
| Holo Audio | Spring 3, May |
| Mola Mola | Tambaqui |
| MSB | Discrete |
| dCS | Lina, Bartók |
| Topping | E70, D90SE |
| SMSL | DO200, M500 |

### Tier 3 — turntables and headphones (entire categories at 0% coverage)

| Category | Examples |
|---|---|
| Turntables | Rega Planar 1/3/6/8, Pro-Ject Debut Carbon Evo, Technics SL-1500C, VPI Cliffwood, Music Hall Classic, Clearaudio Concept |
| Headphones | Sennheiser HD 600/650/660S2/800S, Focal Clear MG/Utopia, ZMF Aeolus/Auteur/Caldera, Audeze LCD-X/MM-500, HiFiMan Arya/HE1000, Meze 109 Pro/Empyrean, Beyerdynamic DT 1990/T1, Grado RS1x, Drop + HiFiMan/Sennheiser collabs |

---

## 3. Priority missing brand/manufacturer imagery

Brand-level views currently have **no rendering path** for a logo or representative image, regardless of priority. These brands surface most often in advisory output and would benefit first when the schema is added:

DeVore Fidelity, Harbeth, Rega, Naim, Chord Electronics, Denafrips, Schiit, KEF, Klipsch, ATC, Spendor, Dynaudio, ProAc, Sonus faber, Magnepan, Luxman, McIntosh, PrimaLuna, Leben, Bluesound, WiiM, RME, iFi, Holo Audio, Mola Mola, dCS, Bowers & Wilkins, Focal, Cambridge Audio, NAD, Marantz, Hegel.

For each, the preferred asset (in order):
1. A representative product hero shot (e.g., Harbeth → P3ESR XD; Rega → Planar 3; Denafrips → Pontus II).
2. The brand wordmark/logo — only when no clean product photo is available or when the brand has no single defining product.

---

## 4. Exact schema / file changes needed later

When verified assets are available, these are the only edits required. They are additive and non-breaking.

### 4a. Extend `BrandProfile` with brand imagery

**File:** `apps/web/src/lib/consultation.ts:235-262`

Add two optional fields:

```ts
interface BrandProfile {
  // ...existing fields...

  /** Representative product hero image — preferred over logo. Manufacturer or licensed source. */
  representativeImageUrl?: string;
  /** Brand wordmark/logo. Used only when no representative product image is available. */
  logoUrl?: string;
}
```

Both fields are optional. No existing entry breaks; no migration needed.

### 4b. Resolve brand image at the brand-only render path

**File:** `apps/web/src/lib/consultation.ts:1575-1576`

Replace the current substring lookup:

```ts
// Before
const brandOnlyImage = getProductImage(sideLabel, undefined);
return { brand: sideLabel, name: '', imageUrl: brandOnlyImage };
```

with a precedence chain that prefers the structured profile data:

```ts
const profile = findBrandProfile(sideLabel);
const brandImage =
  profile?.representativeImageUrl
  ?? profile?.logoUrl
  ?? getProductImage(sideLabel, undefined);
return { brand: sideLabel, name: '', imageUrl: brandImage };
```

`findBrandProfile` already exists in the same file — no new helper needed.

### 4c. Populate `imageUrl` on individual catalog entries (preferred over overlay)

**Files:** `apps/web/src/lib/products/{dacs,amplifiers,speakers,headphones,turntables}.ts`

The `Product.imageUrl?: string` field is already present (`dacs.ts:134` and equivalent in each catalog). Populating it on the entry is preferable to adding to `PRODUCT_IMAGE_URLS` because:

- Inline data co-locates with the product, easier to maintain
- No substring-collision risk (`"chord hugo"` matching both Hugo and Hugo TT 2)
- Render layer already prefers it: `p.imageUrl ?? getProductImage(...)`

The overlay (`product-images.ts`) stays as a safety net for products defined elsewhere or for legacy entries.

### 4d. (Optional, deferred) Promote the overlay to per-brand maps

If/when overlay grows past ~80 entries, split `PRODUCT_IMAGE_URLS` into per-brand arrays for readability. Not needed yet.

---

## 5. Recommended acquisition workflow

The audit-blocking constraint is asset acquisition, not code. Workflow below produces images Audio XX can host and reference with confidence.

### Source

In priority order:
1. **Manufacturer press kit / dealer portal.** Most brands publish hi-res product shots specifically for retail and editorial use. Examples: Rega dealer portal, Naim press resources, KEF media library, Chord dealer assets. Usage rights are usually permissive for editorial product reference.
2. **Manufacturer website CDN, downloaded — not hotlinked.** If no press kit, save the canonical product page hero image. Examples already in the overlay: `chordelectronics.co.uk/wp-content/uploads/...`, `klipsch.com/medias/...`.
3. **Wikimedia Commons** for vintage / discontinued products where the manufacturer no longer hosts assets (LS3/5a, classic Klipsch, vintage Naim).
4. **Manufacturer-supplied assets via direct request** for boutique brands without a public press resource (DeVore, Leben, Holo Audio, ZMF). A short "we're a non-commercial advisory tool, may we use your hero shots with credit?" email usually gets approval.

Avoid:
- Reviewer site galleries (Stereophile, Darko, 6Moons) — those are licensed to the publisher, not redistributable.
- Retailer galleries (Crutchfield, Music Direct) — same issue, plus watermarks.
- Generic image search results — copyright provenance unknown.

### Verification (before adding any URL)

For each candidate asset:

1. **License check.** Confirm one of: manufacturer press-kit terms allow editorial use; explicit permission email on file; Wikimedia Commons license compatible (CC BY / CC BY-SA / public domain).
2. **Provenance.** Record the source URL and download date in a tracking sheet (e.g., `Image_Asset_Manifest.xlsx`).
3. **Visual fidelity.** Clean product-only shot, neutral background, no watermarks, no marketing banners, no lifestyle context. Follows the existing `product-images.ts` rules verbatim.
4. **Aspect.** Card renders at 4:3 with `objectFit: contain`. Anything reasonable works; portrait-oriented hero shots (typical for floorstanders) just letterbox.
5. **File hygiene.** Re-encode to ≤300KB JPG/PNG/WebP at long-edge 1200px. Strip EXIF.

### Hosting

Two options, in order of preference:

**A. Host on Audio XX's own CDN.** Recommended. Path convention:
```
https://cdn.audio-xx.com/products/<brand-slug>/<product-slug>.webp
https://cdn.audio-xx.com/brands/<brand-slug>/representative.webp
https://cdn.audio-xx.com/brands/<brand-slug>/logo.svg
```
Eliminates hotlink fragility (the existing overlay has several entries that depend on manufacturer URL stability — fine in practice, brittle in principle).

**B. Hotlink stable manufacturer CDN URLs.** Acceptable for the existing 29-entry pattern. Worth keeping for brands with very stable URL conventions (Chord, Schiit, Klipsch). Not appropriate for boutique sites with frequent redesigns.

### Integration

Per asset, the integration is a one-line append to one of three places, depending on what kind of asset it is:

| Asset type | File | Edit |
|---|---|---|
| Single product, in catalog | `apps/web/src/lib/products/<category>.ts` | Set `imageUrl: 'https://cdn.audio-xx.com/...'` on the existing product entry |
| Single product, not in catalog | `apps/web/src/lib/product-images.ts` | Append `{ key: 'brand product', url: '...' }` to `PRODUCT_IMAGE_URLS` |
| Brand representative image | `apps/web/src/lib/consultation.ts` (`BRAND_PROFILES`) | Set `representativeImageUrl: '...'` on the existing brand entry (after schema change in §4a lands) |
| Brand logo | Same as above | Set `logoUrl: '...'` (after schema change) |

No new tests required for individual additions. The render layer is unchanged. A single regression test should land alongside §4a–§4b confirming the brand-only render path resolves `representativeImageUrl` over `logoUrl` over `getProductImage` fallback.

### Suggested cadence

Phase 1 (one batch): The 13 Tier 1 entries in §2. Each one is recognizable, frequently surfaced, and the brand presence already exists in catalog/profiles.
Phase 2: Tier 2 brands in priority order — start with brands that appear in the existing demo flows (ATC, Spendor, Hegel, Luxman, Cambridge Audio, NAD).
Phase 3: Headphones and turntables as full categories. These benefit from a single coordinated pass since user expectations differ from boxes-of-electronics products (cans need angle/profile, tables need plinth-and-platter top view).
Phase 4: Brand schema migration (§4a-§4b) once at least 10 brands have representative images ready. Doing the schema before assets exist creates an empty-data-shape problem.

---

## 6. Important products and brands still missing — one-line summary

If only one batch of work is feasible, prioritize these eight, which together cover ~80% of the demo flow's recommendation surface area:

1. Rega Planar 3 (highest-visibility turntable in the catalog, currently no image)
2. Naim SuperNait 3 (flagship integrated, frequently recommended)
3. Denafrips Venus II (mid-tier DAC, fills the Pontus → Terminator gap)
4. DeVore O/Baby + Gibbon 3XL (low-power and conventional alternatives to the covered Orangutans)
5. Schiit Yggdrasil (reference DAC, completes the Schiit DAC line)
6. Harbeth C7ES-3 XD (mid-line BBC monitor between covered P3ESR and SHL5+)
7. KEF Reference 1 Meta (step-up from covered R3/LS50)
8. Klipsch La Scala AL5 (heritage flagship, completes the Heritage line)

Brand-level imagery is **gated on schema** (§4a). Until `BrandProfile` carries `representativeImageUrl` / `logoUrl`, no brand-only view can render an image regardless of asset availability.
