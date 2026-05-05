Never assume behavior is correct. Always verify with actual code paths.

# Climate Screen — Project Spec

-------------------------------------

## SYSTEM WORKING RULES

1. Diagnose before coding
- For any bug or change, first trace:
  input → detected data → assessment → rendering → output
- Identify the exact failure point
- Identify the correct layer for the fix:
  (data, assessment engine, rendering, or export)

2. Smallest safe fix
- Modify only the function/file responsible
- Do not expand scope
- Do not refactor unrelated logic

3. No silent side effects
- List all files changed
- Justify each change
- Do not modify unrelated files

4. Verify with real inputs
- Always test with exact user inputs
- Show:
  A. input data (bond/project)
  B. assessment path
  C. final rendered output
- Include at least one control case that must not break

5. Encode the rule
- After fixing, state the rule that was missing
- Express it as a system behavior rule

6. Protect core invariants
Always preserve:
- confidence calibration must match data quality (never inflate)
- residual risk must always be surfaced (never suppress)
- framework alignment must cite specific criteria (never generic)
- resilience value estimates must carry methodology labels (never unlabeled)
- per-project assessments must not contradict bond-level aggregate

7. Stop and re-plan if scope expands
- If more than one logical area needs changes, stop and re-evaluate before continuing

8. Engine vs Domain Boundary (Mandatory Check)

Core engine logic must be domain-agnostic.
Climate-specific logic must be isolated in adapter/mapping layers.

Prohibited in core reasoning modules (risk-assessment, confidence-calibration, trade-off framing, and future engine modules):
- Climate vocabulary (flood, seismic, heat, emission, carbon, resilience, etc.)
- Climate-specific type references (HazardType, PhysicalRiskScore, GreenBondCriteria, etc.)
- Assumptions about infrastructure, bond structures, or climate science

Domain-specific vocabulary belongs in:
- Hazard catalogs and risk factor data
- Keyword mapping tables consumed as configuration
- Adapter functions that translate between domain types and engine types
- Dashboard wiring code

Test: "Could this logic run unchanged in Audio XX?"
If no → it belongs in the adapter layer, not the engine.

-------------------------------------

## Feature Template

Use this template when planning any new feature:

```
Feature X — [Name]

Type: Engine / Adapter / Hybrid

Boundary decision:
- What part is reusable across domains?
- What part is climate-specific?
- Where does domain vocabulary enter and exit?
```

-------------------------------------

## Implementation Checkpoint

Before writing code, always answer:

1. Is this engine logic or domain-specific?
2. Where should it live? (engine module / adapter / dashboard wiring)
3. Does it violate portability? Apply the Audio XX test.

If any answer is unclear, stop and resolve before proceeding.

-------------------------------------

## What This Application Is

Climate Screen is a climate disclosure and transparency platform for municipal bond issuers.

It is a "translation layer" that converts infrastructure climate information into decision-useful outputs for external market participants: investors, rating agencies, and insurers.

Its purpose is to:
1. Present structured climate risk profiles for bond-financed infrastructure projects
2. Evaluate alignment with green bond criteria and disclosure frameworks
3. Quantify resilience value — translating physical hardening into financial relevance
4. Surface residual risk and data gaps with calibrated confidence
5. Enable portfolio-level (bond-level) aggregation across multiple projects

This is NOT a marketing site.
This is NOT a generic ESG dashboard.
This is NOT an internal planning tool for city staff.

This is an externally-facing capital markets tool.

-------------------------------------

## Why This Exists

Municipal infrastructure faces accelerating physical climate risk — flooding, seismic events, extreme heat, sea-level rise, wildfire. Cities are increasingly financing resilience through bond issuances, but the climate risk information embedded in those bonds is difficult for market participants to access, evaluate, and compare.

The problem is not lack of data. Physical risk data exists (WRI Aqueduct, GRI Risk Viewer, FEMA flood maps, USGS seismic hazard models). Green bond frameworks exist (ICMA Green Bond Principles, Climate Bonds Standard). Disclosure frameworks exist (TCFD, ISSB S2).

The problem is translation. No tool currently bridges:
- geospatial hazard data (what risks exist at this location)
- infrastructure vulnerability (what fails and why it matters)
- issuer response (what the city has done about it)
- framework alignment (does this meet green bond criteria)
- financial relevance (what this means for the investment)

Climate Screen fills that gap.

Investors should not need to cross-reference FEMA flood maps, bond offering documents, and ICMA criteria manually. Climate Screen does that work and presents the result in a structured, comparable, downloadable format.

-------------------------------------

## Product Identity

Climate Screen operates in the stance of a Structured Disclosure Platform.

This means:
- Factual, precise, decision-oriented tone
- No advocacy or greenwashing
- No marketing language or promotional framing
- No overclaiming on resilience benefits
- No suppressing residual risk or data gaps

The system presents structured assessments, not opinions.

It separates:
- Physical hazard data from vulnerability interpretation
- Issuer claims from independent assessment
- Measured resilience from estimated financial value
- High-confidence findings from indicative estimates

Honest uncertainty is a feature, not a weakness. Investors trust disclosure that acknowledges what it doesn't know.

-------------------------------------

## Target Audience

Primary users are external market participants evaluating municipal bonds:

**Investors** — portfolio managers, credit analysts, ESG analysts at asset managers and institutional investors. They want to know: what climate risk am I buying, and is it priced appropriately?

**Rating agencies** — analysts at S&P, Moody's, Fitch incorporating climate risk into municipal credit ratings. They want structured, comparable data across issuers.

**Insurers** — underwriters assessing municipal risk pools. They want to understand physical exposure and mitigation effectiveness.

**Green bond verifiers** — second-party opinion providers evaluating framework alignment. They want clear use-of-proceeds mapping to taxonomy categories.

The tone should feel like a Bloomberg terminal or a Moody's research note — serious, structured, information-dense but navigable. Not a consumer product. Not a marketing page.

-------------------------------------

## Core User Flows

### Flow 1 — Bond Lookup

User searches by CUSIP, ISIN, issuer name, or project name.
System returns the bond-level climate profile.

### Flow 2 — Bond Dashboard (System Assessment)

Aggregate climate profile across all projects in the bond:
- Overall climate risk posture
- Portfolio coherence (do the projects tell a consistent climate story?)
- Framework alignment summary (ICMA, Climate Bonds Standard)
- Resilience value aggregate
- Data quality and confidence overview
- Downloadable summary

This is the equivalent of Audio XX's system assessment.

### Flow 3 — Project Drill-Down (Component Assessment)

Individual project assessment:
- Physical risk exposure by hazard type (with spatial data)
- Vulnerability and sensitivity analysis
- Mitigation / adaptation measures
- Resilience value signals (operational, financial, framework)
- Residual risk
- Per-project confidence calibration
- Links to source data (GRI, FEMA, issuer documents)

This is the equivalent of Audio XX's component cards.

### Flow 4 — Framework Alignment Matrix

Cross-reference view:
- Rows: projects
- Columns: framework criteria (ICMA categories, Climate Bonds taxonomy)
- Cells: alignment status (aligned / partially aligned / gap / not applicable)

### Flow 5 — Download / Export

Investor downloads a structured report:
- PDF or structured data export
- Per-project and bond-level summaries
- "Impact bought" quantification
- Framework alignment evidence
- Suitable for attachment to investment memos or credit files

-------------------------------------

## Domain Model

### Primary Assessment Axes

Climate Screen evaluates each project along these dimensions:

**Physical Risk Exposure** (high → low)
What hazards affect this location and at what severity?
Sources: WRI Aqueduct, GRI Risk Viewer, FEMA, USGS, Cal-Adapt

**Vulnerability** (critical → resilient)
Given the exposure, how sensitive is this asset's function?
What fails, and what are the operational consequences?

**Adaptation Readiness** (mature → emerging → none)
What has the issuer done to address the identified risks?
Are measures engineered, planned, or absent?

**Framework Alignment** (strong → partial → gap)
Does this project meet green bond criteria?
Which specific ICMA use-of-proceeds categories apply?
Which Climate Bonds Standard taxonomy sectors?

**Resilience Value** (quantified → directional → not assessed)
Can the resilience investment be translated into financial terms?
Avoided damage costs, lifecycle extension, financing eligibility, insurance relevance.

**Data Confidence** (high → medium → low → insufficient)
What is the quality and completeness of underlying data?
Site-specific analysis vs. regional proxy vs. estimate?

### Hazard Taxonomy (SF-relevant, extensible)

- Coastal flooding (sea-level rise, storm surge)
- River/pluvial flooding (rainfall-driven)
- Seismic (ground shaking, liquefaction, fault proximity)
- Extreme heat (urban heat island, operational thermal limits)
- Wildfire (WUI proximity, smoke/air quality)
- Drought (water supply, operational water dependency)
- Landslide (slope instability, rain-triggered)

Each hazard carries: severity tier, return period context, epoch (present / 2050 / 2080), RCP scenario, data source, and confidence level.

### Framework References

- ICMA Green Bond Principles (2021) — use-of-proceeds categories
- Climate Bonds Standard v4.0 — taxonomy sectors and criteria
- TCFD Recommendations — governance, strategy, risk management, metrics/targets
- ISSB S2 (IFRS S2) — climate-related disclosure standard
- SEC Climate Disclosure Rule (where applicable)

-------------------------------------

## Resilience Value Model

This is a critical differentiator. Climate Screen does not just describe risk — it translates resilience investment into financial relevance.

### Three-layer value translation:

**Operational layer** (engineering estimates)
- Avoided downtime (days/year, with confidence band)
- Extended useful life (years, relative to unmitigated baseline)
- Reduced probability of force majeure event
- Methodology: based on asset type, hazard exposure, and mitigation measure

**Financial translation layer** (indicative quantification)
- Avoided damage cost ranges (based on replacement value x exposure probability)
- Lifecycle cost impact (NPV of avoided repairs/rebuilds over bond tenor)
- Insurance-relevant loss reduction estimates
- All estimates labeled as "indicative" or "order-of-magnitude"

**Market signaling layer** (framework and pricing relevance)
- Green bond framework eligibility (which criteria satisfied)
- Rating agency relevance (which ESG/climate factors addressed)
- Financing cost implications (market research on green bond pricing, not asset-specific spread claims)
- "Impact bought" metric for investor portfolios

### Resilience Value Rules:
- Never present single-point estimates — always ranges
- Always label methodology and confidence level
- Never claim precise financial outcomes (basis points, exact savings)
- Directional statements grounded in market research are acceptable
- Distinguish between measured outcomes and modeled projections
- "Not assessed" is a valid and honest output

-------------------------------------

## Quality Standards

These principles define the quality bar for the Climate Screen assessment engine. They are ported from the Audio XX Playbook and adapted for climate disclosure.

### 1. Data → Assessment → Disclosure
All reasoning should follow this chain:
- hazard data → vulnerability assessment → financial/framework relevance
No direct shortcuts from raw data to financial claims.

### 2. Residual risk discipline
Every assessment must explicitly identify:
- what risks are mitigated
- what risks remain
- what is unknown or unassessable
Assessments should never present resilience as complete protection.

### 3. Confidence calibration
Language strength must match data quality. Per-field confidence, not just aggregate.
- "High" — site-specific engineering assessment or measured data
- "Medium" — regional data applied to specific site, or modeled estimates
- "Low" — proxy data, analogous assets, or expert judgment
- "Insufficient" — data not available; finding suppressed or flagged

### 4. Framework alignment specificity
Never say "aligned with green bond criteria" generically.
Always cite: which framework, which specific criterion or category, and with what evidence.

### 5. Source attribution
Every hazard score, vulnerability assessment, and resilience estimate must trace to a named data source with methodology and vintage.

### 6. Comparability
Assessments should use consistent methodology across projects and bonds so market participants can compare.

### 7. No advocacy
Climate Screen presents structured findings. It does not argue for or against investment. It does not promote green bonds. It surfaces information and lets the user decide.

### 8. Partial knowledge handling
When information is missing, degrade confidence and surface the gap explicitly. Never invent data. "Data not available" is a valid disclosure.

### 9. Audience-appropriate rendering
Same structured findings, different emphasis for different readers.
Investors see financial relevance first. Rating agencies see risk factors first. Verifiers see framework alignment first. The underlying data is identical.

### 10. Restraint
Not every project has meaningful climate risk. Not every resilience measure creates financial value. The system should not manufacture significance where none exists.

-------------------------------------

## Architecture

### Three-layer separation (same pattern as Audio XX):

**Data Layer** (`/lib/data/`)
- Bond catalog (CUSIP/ISIN → issuer, projects, metadata)
- Project catalog (location, type, specifications, mitigation measures)
- Hazard data (GRI, FEMA, USGS — initially static, later API-connected)
- Framework criteria catalog (ICMA categories, CBI taxonomy)
- For prototype: static JSON/TS files. For production: database + API integrations.

**Assessment Engine** (`/lib/engine/`)
- Physical risk scoring (per hazard, per project)
- Vulnerability assessment (exposure × sensitivity)
- Mitigation evaluation (what's addressed, what's residual)
- Resilience value estimation (operational → financial → market signal)
- Framework alignment checking (per criterion, per project)
- Confidence calibration (per field, per project)
- Portfolio aggregation (project assessments → bond-level profile)
- Output: `ClimateFindings` structured contract (equivalent to MemoFindings)

**Rendering Layer** (`/components/`)
- Bond dashboard (aggregate view)
- Project cards (drill-down view)
- Framework alignment matrix
- Hazard maps (GRI integration)
- Downloadable report generator
- All rendering consumes `ClimateFindings` — never raw data directly.

### Key Types (to be defined in `climate-findings.ts`):

```
ClimateFindings           — the complete structured contract (≈ MemoFindings)
ProjectAssessment         — per-project climate evaluation (≈ ComponentFindings)
HazardExposure            — per-hazard risk score with source and confidence
VulnerabilityFinding      — what fails, why it matters, operational impact
MitigationMeasure         — what the issuer has done, with effectiveness assessment
ResidualRiskFinding       — what remains unaddressed
ResilienceValueAssessment — operational → financial → market signal translation
FrameworkAlignment        — per-criterion alignment status with evidence
DisclosureConfidence      — per-field confidence with methodology note
BondPortfolioProfile      — aggregate across projects (≈ system-level axes)
```

-------------------------------------

## Data Integration Targets

### Prototype (static data):
- 1 bond (SFPUC or recent SF green bond)
- 3-5 projects within the bond
- Hardcoded hazard data from GRI Risk Viewer screenshots
- Manual framework alignment assessment
- Indicative resilience value estimates

### Production roadmap:
- EMMA/MSRB for bond metadata and offering documents
- WRI Aqueduct API for flood hazard data
- GRI Risk Viewer for multi-hazard infrastructure risk
- FEMA NFHL for flood zone designation
- USGS for seismic hazard
- Cal-Adapt for California-specific climate projections
- Climate Bonds Initiative taxonomy database
- Issuer disclosure documents (parsed from official statements)

-------------------------------------

## Visual Design Principles

- Bloomberg / Moody's aesthetic — serious, information-dense, navigable
- Card-based layout with clear hierarchy
- Professional color palette: grays, muted blues, limited accent for risk levels
- Risk badges: consistent color coding (red/amber/green with accessible alternatives)
- No emojis, no flashy UI, no marketing imagery
- Clean typography, generous whitespace, scannable structure
- Maps where spatial context matters (hazard overlays on project locations)
- Charts only when they communicate better than text
- Mobile-responsive but desktop-primary (this is a workstation tool)

-------------------------------------

## Portability Requirement

Climate Screen is the second domain implementation of the portable reasoning engine first built in Audio XX.

Core engine primitives (portable, shared with Audio XX):
- Structured assessment with per-field confidence
- Trade-off framing (what improves vs. what is compromised)
- Constraint / gap detection (where is the assessment weakest)
- Confidence calibration (data quality → language strength)
- Multi-path option framing (not applicable in v1 but architecturally ready)
- "No finding" enforcement (absence of data is a valid output)
- Coherence detection (do components tell a consistent story)

Climate-layer examples (domain-specific):
- Hazard taxonomy (flood, seismic, heat, wildfire, drought)
- Physical risk scoring models
- Green bond framework criteria
- Resilience value estimation methodology
- CUSIP/ISIN bond identification
- GRI/FEMA/USGS data source integration

When implementing new features, isolate domain vocabulary from core reasoning logic. Both Audio XX and Climate Screen should be able to share the engine module without modification.

-------------------------------------

## Outcome Hierarchy

The primary outcome variable is disclosure quality.

Quality is measured by:
1. Accuracy — findings match available data
2. Completeness — gaps are identified, not hidden
3. Comparability — methodology is consistent across assessments
4. Decision-usefulness — outputs help market participants make informed decisions
5. Credibility — confidence calibration is honest; no overclaiming

A disclosure that honestly says "insufficient data" for three hazard types is better than one that invents medium-confidence scores for all of them.

Investor trust is built by precision about what is known and honesty about what is not.
