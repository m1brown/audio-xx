Never assume behavior is correct. Always verify with actual code paths.

# Climate Screen — Phase 1 Brief (Prototype)

-------------------------------------

## What This Prototype Is

Climate Screen is a capital-markets-facing disclosure layer that translates infrastructure climate information into structured, decision-useful outputs for investors, rating agencies, and insurers.

For this prototype:
Build a single-page, investor-facing view of one SFPUC bond with 2-3 project cards.

Goal: Make one stakeholder say: "This makes our projects easier to understand for investors."

-------------------------------------

## Non-Negotiable Quality Rules

These are the credibility anchors. Violating any one of them undermines the entire product.

1. Residual risk must always be shown — never suppress what remains unaddressed
2. Confidence must match data quality — never inflate certainty beyond source quality
3. Resilience value must be labeled and bounded — always ranges, always labeled "indicative"
4. Framework alignment must be specific — cite which framework, which criterion, with what evidence
5. No invented data or false precision — "data not available" is a valid and honest output
6. Per-project assessments must not contradict bond-level aggregate

-------------------------------------

## Core Unit: Project Card

Everything depends on this. The project card is the atomic unit of value.

Each project card must clearly show:

**A. Climate Exposure**
- Hazard type (flood, seismic, heat, wildfire, drought)
- Severity tier (High / Medium / Low)
- Source attribution (e.g., "GRI-derived", "FEMA NFHL", "USGS")
- Confidence level

**B. Vulnerability**
- What fails under this exposure
- Why it matters operationally (service disruption, safety, cost)

**C. Mitigation**
- What the issuer has done (elevation, redundancy, hardening, design)
- How it addresses the identified risk

**D. Residual Risk**
- What remains after mitigation
- Where uncertainty exists
- What cannot be assessed with available data

**E. Resilience Value (Differentiator)**
This is Climate Screen's edge. Must include numbers where possible.

Rules:
- Always ranges, never single-point estimates
- Always labeled "indicative" or "order-of-magnitude"
- Always tied to stated assumptions
- No direct claims like "reduces spreads by X bps"
- Distinguish between measured outcomes and modeled projections

Structure:
1. Operational impact (avoided downtime, extended useful life)
2. Risk reduction (avoided damage cost range)
3. Financial relevance (framework eligibility, market signaling)

**F. Decision Summary**
Short, sharp: what matters for an investor, what risk remains, whether mitigation is credible.

-------------------------------------

## Bond-Level Summary (Lightweight)

At the top of the page:
- Bond name and issuer
- Number of projects financed
- Overall exposure mix (which hazards, at what severity)
- Mitigation strength (aggregate assessment)
- Confidence overview

No complex aggregation logic yet. This is a simple summary, not a computed portfolio model.

-------------------------------------

## Tone and Style

Must feel like: Moody's, Bloomberg, infrastructure disclosure.

NOT: ESG marketing, startup product, narrative-heavy report.

Principles:
- Factual and structured
- Concise — no dense text blocks
- No advocacy or greenwashing
- No overclaiming on resilience benefits
- No emojis, no flashy UI
- Professional color palette: grays, muted blues, limited accent for risk levels
- Card-based layout with clear hierarchy
- Clean typography, generous whitespace, scannable structure

-------------------------------------

## GRI Integration (Prototype Level)

Do NOT integrate APIs yet. Use static data from GRI Risk Viewer.

Climate Screen translates GRI data — it does not replace it.

Example of the translation:
- Raw: "Flood depth = 2.3m (100-year return period)"
- Translated: "Flood depth of ~2m implies ground-level equipment exposure; mitigation elevates critical systems above projected levels."

Show the translation, not just the raw data.

-------------------------------------

## What NOT to Build Yet

Explicitly deferred to Phase 3:
- CUSIP / ISIN search
- EMMA / MSRB integration
- Full domain schema system
- Dynamic data ingestion (GRI API, FEMA API)
- Portfolio aggregation math
- Full framework alignment matrix
- Multi-bond comparison
- User accounts or saved views

-------------------------------------

## Lead Asset: SFPUC Biosolids Digester Facility

This is the anchor project card. It must be strong enough to carry the demo alone.

Location: San Francisco, CA (southeast waterfront)
Asset type: Wastewater treatment infrastructure
Bond context: SFPUC capital program

Key hazards (SF-specific):
- Coastal/pluvial flooding (sea-level rise, storm surge — waterfront location)
- Seismic (proximity to San Andreas and Hayward faults)
- Liquefaction (filled land along waterfront)

Use real data where available:
- GRI Risk Viewer for flood depth at this location
- USGS seismic hazard maps for ground shaking probability
- SFPUC capital plan documents for mitigation measures
- Cal-Adapt for sea-level rise projections

-------------------------------------

## Success Criteria

The prototype succeeds if:
1. The structure is immediately understandable to a non-specialist
2. The project cards feel credible — an engineer would not object to the characterizations
3. The resilience value section is useful but not overclaimed
4. The decision summary feels sharp and investor-relevant
5. An SFPUC stakeholder says: "this is accurate," "this is useful," and "this reflects how we think about the asset"

-------------------------------------

## Full Spec Reference

A comprehensive architecture spec (CLAUDE.md for Phase 3+) exists separately.
It covers: full domain model, assessment engine architecture, data integration targets,
portability requirements, and the complete type system.

Use the full spec as a north star for architectural decisions,
but do not build to it in Phase 1.

-------------------------------------

## Engine vs Domain Boundary (Carry Forward)

Even in Phase 1, maintain awareness of what is portable vs. domain-specific.

Core engine logic (portable — shared with Audio XX):
- Structured assessment with per-field confidence
- Trade-off framing (what improves vs. what is compromised)
- Gap detection (where is the assessment weakest)
- Confidence calibration (data quality -> language strength)
- "No finding" enforcement (absence of data is a valid output)

Climate-layer logic (domain-specific):
- Hazard taxonomy (flood, seismic, heat, wildfire, drought)
- Physical risk scoring
- Green bond framework criteria
- Resilience value estimation
- GRI/FEMA/USGS data interpretation

Test: "Could this logic run unchanged in Audio XX?"
If no -> it belongs in the adapter layer, not the engine.
