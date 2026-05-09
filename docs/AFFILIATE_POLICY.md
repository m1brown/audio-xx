# Audio XX — Affiliate and Outbound-Link Policy

**Last updated:** 2026-05-09
**Audience:** anyone considering wiring affiliate participation, anyone reviewing the project's monetisation posture, and anyone updating outbound-link disclosure copy.

This policy governs how Audio XX may interact with affiliate programmes, retailer partnerships, and outbound monetisation. The principles here precede the implementation. The current implementation status is summarised in § 7 below.

---

## 1. Advisory integrity is the primary constraint

The single non-negotiable principle: **affiliate participation must not influence advisory output.**

The system reasons about listener preferences and component interactions deterministically. It cites products as examples of design philosophies and trade-offs, not as the object of recommendation. Whether or not a given retailer pays a referral commission has no place in the reasoning chain.

Consequences for implementation:

- Recommendation order must be identical whether or not affiliate tags are present.
- The choice of which retailer to surface for a given product must be driven by user preference (manufacturer link first, used-market link if asked) rather than by commission rate.
- A/B testing of affiliate variants on recommendation order is prohibited.
- Affiliate participation must be clearly disclosed.

This principle is documented in [`CLAUDE.md`](../CLAUDE.md) under "Advisory Identity" and is reflected in the existing footer disclosure language: *"This does not affect our recommendations."*

---

## 2. Outbound-link role taxonomy

Outbound links serve different purposes and warrant different treatment:

| Role | Purpose | Affiliate eligibility |
|---|---|---|
| Manufacturer link | Authority — confirms the product exists, surfaces design context | **Never affiliate.** Manufacturer relationships are direct; affiliate tagging would be inappropriate. |
| Authorised retailer link | Convenience — lets the user purchase with confidence | **Eligible.** Major dealers (Apos Audio, Crutchfield, Music Direct, Schiit direct, etc.) are typical candidates. |
| Used-market link | Discovery — surfaces availability for legacy or out-of-production gear | **Conditionally eligible.** HiFi Shark and similar aggregators may have affiliate programmes; eBay search URLs do not naturally accept affiliate parameters in the existing path. |
| Review / source link | Citation — supports a claim made in the advisory | **Never affiliate.** A citation that pays the citer is no longer a citation. |
| Brand authority page | Internal — Audio XX's own brand page | N/A (internal route) |

The existing catalog (`apps/web/src/lib/products/*.ts`) carries `retailer_links` arrays where each entry is `{ label, url }`. The label distinguishes role today (e.g. "Chord Electronics" = manufacturer; "Apos Audio" = retailer; "HiFi Shark (used)" = used-market). When affiliate participation is wired, the implementation must respect this role distinction.

---

## 3. Disclosure principles

When affiliate participation is wired, disclosure must:

- **Be visible.** Footer-level disclosure is the minimum; per-product or per-link disclosure is preferable.
- **Be specific.** Name the programme (e.g. "Amazon Associates") and the relationship.
- **Be honest about effect.** State explicitly that recommendations are not affected. This statement must be supported by the implementation — see § 4.
- **Be aligned with code state.** If no affiliate participation is wired, the disclosure must not claim it. Forward-looking language ("Audio XX may earn commissions...") is acceptable only when the implementation is imminent and credible.

The current Footer disclosure (see [`apps/web/src/components/Footer.tsx`](../apps/web/src/components/Footer.tsx)) reads:

> Audio XX may earn commissions from qualifying purchases as an Amazon Associate. This does not affect our recommendations.

This is forward-looking. As of this writing, no affiliate tags exist in any retailer URL. The disclosure should be aligned to current state — see [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) § 6.

---

## 4. Implementation constraints

When affiliate participation is wired, the implementation must satisfy:

### 4.1. Tag injection at render time

Affiliate tags are injected in the rendering layer, never in the advisory engine or catalog data. The catalog stores canonical URLs; the renderer adds tags per partner agreement. This separation:

- Keeps the advisory engine deterministic and auditable.
- Allows tags to be added or removed without catalog modifications.
- Makes the integrity test (§ 4.3) tractable.

### 4.2. Per-partner allowlist

Tag injection runs against a small, hand-maintained allowlist of partners. New partners are added by deliberate code change, not by configuration string. The allowlist captures:

- Partner name
- URL pattern (host or host+path) that the tag applies to
- The exact tag parameter format (e.g. `tag=audioxx-20`)
- Effective date and any contractual terms relevant to compliance

### 4.3. Ranking-integrity test

A behavioural regression test must assert: for any given query, the order and content of advisory recommendations is identical with affiliate tags enabled and disabled. This test is a precondition for shipping affiliate participation. Suggested location: `apps/web/src/lib/__tests__/affiliate-integrity.test.ts`.

If this test cannot be made to pass, the affiliate implementation is wrong. Do not ship until it passes.

### 4.4. Exact-match URL requirement

Tags are appended only to URLs that exactly match an allowlist entry. URL drift (a manufacturer URL incidentally containing a retailer hostname, a redirect chain that lands on an unexpected domain) must not result in unintended tag injection. The renderer should fail closed: if the URL does not match a known allowlist pattern, no tag is added.

### 4.5. No tag injection into citations or manufacturer links

Source citations (`{ source, url }` in product `tendencies` data) and manufacturer-direct links never receive tags. The role taxonomy in § 2 governs eligibility; the renderer must enforce it.

### 4.6. No automated discovery of affiliate opportunities

The system must not crawl retailer pages, parse them for affiliate compatibility, or auto-detect tag-eligible URLs. Each affiliate relationship is a deliberate, manually-approved partnership. Automation here is the most plausible path to ranking distortion and is prohibited.

---

## 5. What must never be automated

A non-exhaustive list of automation patterns that must not be introduced:

- **Auto-selecting a retailer based on commission rate.** Recommendations must be neutral on retailer choice; the user's region, preference, and account choices govern.
- **Auto-rewriting URLs to point at higher-commission alternatives.** A `denafrips.com` link must not be rewritten to a higher-commission distributor.
- **Auto-injecting tags into source / citation URLs.** Citations are evidence; commissioning them is a category error.
- **Dynamic URL parameter injection based on user behaviour.** Every tag should be statically derivable from the catalog entry plus the partner allowlist.
- **A/B testing recommendation order with affiliate variants.** This is the most direct path to integrity violation and the test (§ 4.3) is designed to catch it.
- **Hidden affiliate participation.** Every affiliate link must be discoverable from the partner allowlist; no off-the-books arrangements.

These prohibitions are not currently enforced in code (because no affiliate participation exists). They become enforcement requirements at the moment affiliate code is introduced.

---

## 6. Future integration guidance

When the project is ready to wire affiliate participation, the recommended sequence:

### Step 1 — Decide the partner set

Pick 1–3 partners deliberately. Common starting partners for hi-fi equipment:

- **Amazon Associates** (broad availability, well-known programme)
- **Crutchfield** (US-focused, strong audiophile credibility)
- **Apos Audio** (specialty audio retailer, multiple catalog products linked)
- **Music Direct** (specialty audio, vinyl-heavy)

Each requires a separate sign-up and approval; each comes with specific compliance terms (disclosure language, prohibited content categories, etc.). Document the chosen partners in a successor to this file or in a new `docs/AFFILIATE_PARTNERS.md`.

### Step 2 — Implement the renderer-layer tag injection

A small module (e.g. `apps/web/src/lib/affiliate-injection.ts`) that takes a `RetailerLink` and the partner allowlist, returns the URL with tags appended (or unchanged if no match). Used by `AdvisoryProductCard` and `AdvisoryUpgradePaths` at render time.

### Step 3 — Write the integrity test

Per § 4.3. Should run on every push.

### Step 4 — Update disclosure copy

Footer disclosure aligned to current code state. Per-link disclosure where mandated by partner terms (Amazon Associates currently requires a disclosure on or near every affiliate link, *TODO: verify current Amazon terms at time of integration*).

### Step 5 — Manual review of every affiliate URL after integration

Walk every catalog entry. Confirm tags are injected only on intended URLs and not on citations or manufacturer links.

### Step 6 — Ongoing monitoring

A quarterly review that confirms:

- The allowlist matches active partner agreements.
- The integrity test still passes.
- No new partners have been added without going through this process.
- Disclosure copy still aligns with implementation.

---

## 7. Current implementation status

As of this writing (2026-05-09):

- **No affiliate tags wired.** All retailer URLs are direct (canonical `amazon.com/dp/<ASIN>` form for Amazon entries; direct manufacturer or distributor URLs elsewhere).
- **No affiliate partner agreements** are in place.
- **Footer disclosure copy is forward-looking,** which is misaligned with the empty implementation. Resolution paths:
  1. Soften the disclosure to "may earn in the future..." or remove it entirely until participation is wired.
  2. Wire affiliate participation per § 6 and align the disclosure to descriptive language.
- **No integrity test.** When affiliate participation is wired, this test is required before ship.

The recommendation is to either soften the disclosure copy (low effort, low risk) or proceed with full wiring per § 6 (higher effort, requires partner agreements). The current "in-between" state is the least-defensible position.

---

## 8. Anti-patterns observed in similar tools

For context — these are patterns common in other audio recommendation tools that this project explicitly rejects:

- **Recommendations sorted by commission rate.** Visible in many "best DAC under $X" listicles.
- **"Editor's picks" that map cleanly to highest-margin partner products.** The editorial framing obscures the commercial logic.
- **Dynamically-injected affiliate tags via JavaScript that the user cannot inspect by reading the source URL.**
- **Affiliate disclosures hidden in long terms-of-service paragraphs rather than near the affected links.**
- **Comparison tools that include products only from partners and quietly omit non-partner alternatives.**

The tools that do these things are easy to find. Audio XX's intended differentiation is, in part, *not being one of them*. The policy in this document exists to make that differentiation real and verifiable.

---

## 9. Cross-references

- Disclosure copy: `apps/web/src/components/Footer.tsx`
- Forward-looking policy text in [`README.md`](../README.md)
- Catalog retailer link entries: `apps/web/src/lib/products/*.ts` (`retailer_links` arrays)
- Brand authority page rendering: `apps/web/src/app/brand/[slug]/page.tsx`
- Renderer-layer link rendering: `apps/web/src/components/advisory/AdvisoryProductCard.tsx`, `AdvisoryUpgradePaths.tsx`

When the affiliate-integration work happens, expect to touch the renderer layer (per § 4.1) but not the catalog or the engine.
