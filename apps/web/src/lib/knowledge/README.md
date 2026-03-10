# Audio XX Knowledge Layer

## Purpose

Curated brand and product knowledge for Audio XX consultation responses.
This is not a product database — it is a structured knowledge base that
informs how Audio XX answers brand and product questions.

## Workflow

1. **Draft** — AI generates a structured profile (brand or product)
2. **Review** — You review, edit, and validate the entry
3. **Approve** — Move the file from `draft/` to `approved/` and register it in `index.ts`

AI-generated knowledge is never treated as final. All draft entries
remain clearly separated from production data.

## Directory Structure

```
knowledge/
  schema.ts              ← TypeScript interfaces
  types.ts               ← Shared types (curation, sources, links, dealers)
  index.ts               ← Loader — reads approved entries, exports typed API
  README.md              ← This file
  brands/
    draft/               ← AI-drafted brand profiles (JSON)
    approved/            ← Human-validated brand profiles (JSON)
  products/
    draft/               ← AI-drafted product profiles (JSON)
    approved/            ← Human-validated product profiles (JSON)
```

## Approving an Entry

1. Review the draft JSON file in `brands/draft/` or `products/draft/`
2. Edit any fields that need correction
3. Update the `curation` block:
   - Set `status` to `"approved"`
   - Add `reviewedBy`, `reviewedAt`, `approvedAt`
4. Move the file to the corresponding `approved/` directory
5. In `index.ts`, add an import and registration call:

```typescript
import devore from './brands/approved/devore.json';
registerApprovedBrand(devore as BrandKnowledge);
```

6. The approved entry will now be used at runtime, taking priority
   over hardcoded BRAND_PROFILES in consultation.ts.

## Schemas

### Brand Profile

See `schema.ts` → `BrandKnowledge`. Key fields:

- Identity: name, founder, country, founded, location
- Design: philosophy, product families
- Sound: sonic reputation, pairing tendencies
- Links: official website, dealers, review references
- Provenance: source entries, curation metadata

### Product Profile

See `schema.ts` → `ProductKnowledge`. Key fields:

- Classification: category, topology
- Technical: sensitivity, impedance, load notes
- Sound: design intent, sonic character, room behavior
- Pairing: pairing tendencies
- Links: official product page, review references
- Provenance: source entries, curation metadata

## Source Provenance

Every entry tracks its source basis via `sources: SourceEntry[]`.
Trusted sources include:

- 6moons
- Stereophile
- The Absolute Sound
- HiFi+
- HiFi Pig
- Other reviewer/source sets added later

Source entries record: publication, optional reviewer name, URL,
source kind (review, measurement, interview, manufacturer, forum_consensus),
and a free-form note.

## Links

Links are typed:

- `official` — manufacturer website or product page
- `dealer` — authorized dealer or distributor
- `review` — editorial review or reference article
- `reference` — other informational link

Links do not imply endorsement by default.

## International Support

Dealer entries support:

- name, region, country, city, url, role (distributor vs dealer)

No assumption of a single market or retailer ecosystem.
