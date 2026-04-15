# Pre-Review Chrome QA Report

**Date:** 2026-04-14
**Environment:** localhost:3000 (development server, Next.js App Router)
**Method:** Manual browser testing via Chrome MCP
**Saved system present:** "Livingroom" — Chord Hugo (DAC), Job Integrated (amp), WLM Diva Monitor (speaker)
**Code under test:** Post Task 6b + LAIV uDAC routing fix

---

## Part 1 — Structured & Messy Prompts (10 prompts)

| # | Prompt | Expected | Actual Intent | _DEBUG | Pass |
|---|--------|----------|---------------|--------|------|
| SP1 | Pontus II → Leben CS300 → Harbeth HL5+. Assess my system. | system_assessment | system_assessment | **YES** | ⚠️ |
| SP2 | Bluesound NODE X → PrimaLuna EVO 300 → Harbeth P3ESR. Upgrade? | system_assessment | system_assessment | **YES** | ⚠️ |
| SP3 | Best DAC under $2000 for warm, musical system | shopping | shopping | No | ✅ |
| SP4 | Tell me about the Chord sound | product_assessment | product_assessment | No | ❌ |
| SP5 | Rega + Hegel + KEF, everything sounds thin | diagnosis | diagnosis | No | ✅ |
| SP6 | Naim NAIT 5si + B&W 606 S2 pairing, wondering about power | product_assessment | product_assessment | No | ⚠️ |
| SP7 | Denafrips Ares vs Chord Qutest vs Schiit Bifrost | comparison | comparison | No | ⚠️ |
| SP8 | Jazz/rock flat + Venus II + Pass Labs INT-25 + DeVore Super Nine | diagnosis | diagnosis | No | ❌ |
| SP9 | Just picked up a topping d90se, curious what you think | product_assessment | gear_inquiry | No | ⚠️ |
| SP10 | how's this system: speakers: wlm diva monitors - amp: job integrated - streamer: eversolo dmp-a6 | system_assessment | system_assessment | No | ✅ |

**Pass: 3 | Partial: 4 | Fail: 2 | _DEBUG leak: 2**

### Detailed Issues

- **SP1, SP2:** _DEBUG output leaks into the "Where the system is constrained" section. Raw engine internals visible to user: `_DEBUG dominant: bottleneck · primary kind: component · primary property: ...`
- **SP2:** Brand-fusion parsing — "Primaluna Node X" and "Harbeth Bluesound node x" appear in chain. PrimaLuna EVO 300 lost entirely.
- **SP4:** "the chord isn't in my catalog" — Chord Electronics IS in the catalog (Chord Hugo is in the saved system). Homepage example prompt produces a brand-not-found response. **Severe trust issue for first-time users.**
- **SP6:** Focuses entirely on B&W 606 S2, ignores Naim NAIT 5si. User asked about power pairing; response doesn't address amp-speaker power match.
- **SP7:** 3-way comparison requested (Ares vs Qutest vs Bifrost) but only 2 products compared. Chord Qutest dropped from the comparison.
- **SP8:** User stated their system (Venus II + Pass Labs INT-25 + DeVore Super Nine) but response ignores it and asks "What gear are you working with?" Stated system not picked up.
- **SP9:** "topping d90se" — model number not recognized, falls back to Topping brand. Response says "Are you exploring the brand generally, or considering a specific model?" despite user naming the exact model.
- **SP10:** Original Case B routes correctly ✅. Role-to-component misassignment persists: says "You described the Eversolo Dmp-a6 as an amplifier" but user labeled it as "streamer:".

---

## Part 2 — Homepage Example Prompts (4 prompts)

| # | Example | Route | Pass |
|---|---------|-------|------|
| EX1 | My system: Pontus II → Leben CS300 → Harbeth HL5+. Assess. | system_assessment ✅ | ⚠️ |
| EX2 | My system: Bluesound NODE X → PrimaLuna EVO 300 → Harbeth P3ESR. Upgrade? | system_assessment ✅ | ❌ |
| EX3 | Best DAC under $2000 for warm, musical system | shopping ✅ | ✅ |
| EX4 | Tell me about the Chord sound | product_assessment ✅ | ❌ |

**Pass: 1 | Partial: 1 | Fail: 2**

### Detailed Issues

- **EX1:** _DEBUG leak in constraints section. Content quality is good otherwise.
- **EX2:** **Catastrophic parsing.** Chain displays "Primaluna Node X → Harbeth Bluesound Node X → Harbeth P3ESR". PrimaLuna EVO 300 vanishes. Identifies "Primaluna Node X" as bottleneck DAC (this is actually the Bluesound Node X). **This is a homepage example prompt — first thing a new user might click.**
- **EX3:** Good shopping response. Saved system referenced in "Why this fits you" sections (personalization feature). Recommendations (Bifrost $699, Qutest $1,295) are well under the $2,000 budget — could offer higher-tier options.
- **EX4:** "the chord isn't in my catalog" — same as SP4. **Homepage example prompt claims the brand is unknown.** Chord Hugo is literally in the saved system.

---

## Part 3 — Homepage Intent Chips (4 chips)

| # | Chip | Initial Response | Follow-up Tested | Pass |
|---|------|-----------------|------------------|------|
| IC1 | Buy something new | "What are you looking for?" + category prompt | "speakers under $3000" → 3 candidates (KEF R3, Klipsch Heresy IV, Totem Model 1 Sig) | ✅ |
| IC2 | Improve my system | "List the main components" | Not tested further | ⚠️ |
| IC3 | Something sounds off | "What does it sound like?" + symptom examples | Not tested further | ✅ |
| IC4 | Compare two options | "Which two components?" | Not tested further | ✅ |

**Pass: 3 | Partial: 1 | Fail: 0**

### Notes

- All 4 chips produce appropriate conversational entry points.
- **IC1 follow-up:** Shopping flow works well. 3 different design philosophies represented. Heresy IV ($3,198) slightly exceeds $3,000 budget. Saved system referenced in personalization.
- **IC2:** Does not auto-reference the saved system when user clicks "Improve my system." Given the user has a saved system, this is a missed personalization opportunity — could say "I see you have [system]. Want me to assess it, or are you working with something different?"

---

## Part 4 — Modern Product Coverage (4 products)

| # | Product | In Catalog? | Intent | Pass |
|---|---------|-------------|--------|------|
| MP1 | LAIV uDAC | No (brand-level) | product_assessment ✅ | ✅ |
| MP2 | Denafrips Ares II | No (but Ares is) | product_assessment ✅ | ⚠️ |
| MP3 | Holo Audio May | **Yes** | product_assessment ✅ | ✅ |
| MP4 | Topping D90SE | No (brand-level) | product_assessment ✅ | ⚠️ |

**Pass: 2 | Partial: 2 | Fail: 0**

### Detailed Issues

- **MP1 (LAIV uDAC):** LAIV fix verified ✅ — routes to `product_assessment`, NOT `consultation_entry` or `system_assessment`. Brand-level assessment with R2R, flow, tonal density. Says "If you can share the specific model" even though user already named it.
- **MP2 (Denafrips Ares II):** "ares ii isn't in my catalog" — but Denafrips Ares IS in the catalog (used successfully in SP7 comparison). The "II" suffix may be causing the match failure. Same "specific model" prompt issue.
- **MP3 (Holo Audio May):** Full catalog entry ✅ — $4,598, Discrete R2R, detailed sonic profile, 6moons source cited. This is the quality bar other products should meet.
- **MP4 (Topping D90SE):** Only 1 subject detected (brand "topping" only). Model number "d90se" not extracted. Very thin brand-level assessment — only "clarity" as house sound.
- **Inconsistency:** "No system context available" on all product assessments, but shopping mode (EX3/IC1) successfully references the saved system. Product assessment path doesn't inject saved system context.

---

## Part 5 — Reviewer System Simulations (3 systems)

| # | System | Expected | Actual Intent | Pass |
|---|--------|----------|---------------|------|
| RS1 | Pontus II feeding Leben CS600 into Harbeth M30.2, "how does it look?" | system_assessment | **gear_inquiry → diagnosis** | ❌ |
| RS2 | Hegel H390 + DeVore O/93 + Bluesound Node, "assess my setup" | system_assessment | system_assessment | ⚠️ |
| RS3 | dCS Bartok → Pass Labs XA25 → Magico A3, "evaluate this system" | system_assessment | system_assessment | ⚠️ |

**Pass: 0 | Partial: 2 | Fail: 1**

### Detailed Issues

- **RS1:** "how does it look?" not recognized as assessment language. "feeding...into" not recognized as chain separator. Response ignores the 3 named components and asks "What matters most to you in the sound?" — generic diagnosis entry instead of system review.
- **RS2:** Correct routing but severe parsing failures:
  - "Devore Bluesound node" — brand fusion (DeVore + Bluesound merged into one entity)
  - "DeVore Orangutan O/96" — user said O/93, system shows O/96 (wrong model)
  - "H390" extracted as separate duplicate entity
  - Bluesound Node misidentified as speaker
  - Response asks if "Devore Bluesound node" and "DeVore Orangutan" are both speakers
- **RS3:** Correct routing. **Pass Labs XA25 renamed to "First Watt"** — different brand (same designer, Nelson Pass, but First Watt and Pass Labs are distinct product lines). _DEBUG leak in constraints. Identifies dCS Bartok (~$15K reference DAC) as the "weakest link" — questionable assessment for a flagship component.

---

## Part 6 — UX & Trust Observations

### Critical Trust Issues

1. **Homepage example claims Chord not in catalog.** A new user clicks "Tell me about the Chord sound" and sees "the chord isn't in my catalog." This is the #1 first-impression risk. Chord Hugo is in the saved system.

2. **Homepage example has catastrophic parsing.** Example 2 (Bluesound/PrimaLuna/Harbeth) produces brand-fusion entities and loses the amplifier entirely. This is a homepage showcase prompt.

3. **_DEBUG output visible to users.** System review responses expose raw engine internals: `_DEBUG dominant: bottleneck · primary kind: component...`. Appears in SP1, SP2, EX1, RS3. This is the most consistently reproducible bug.

4. **"Specific model" prompt when model was given.** When users name a specific model (LAIV uDAC, Denafrips Ares II, Topping D90SE), the response asks "If you can share the specific model, I may be able to offer a more detailed assessment." The model was in the query.

### Parsing & Entity Extraction Issues

5. **Brand-fusion across products.** When multiple brands appear in natural text (not arrow-separated), the extractor merges adjacent brand-product pairs: "Primaluna Node X", "Harbeth Bluesound node x", "Devore Bluesound node". This is the most impactful parsing bug — it corrupts the entire system review.

6. **Model number/suffix recognition.** "Ares II" not matched to "Ares" in catalog. "d90se" not extracted as entity. "O/93" becomes "O/96". Suffixes and model numbers are fragile.

7. **Role-to-component misassignment.** Labeled roles (speaker:, amp:, streamer:) are parsed positionally rather than by label-value pairs. "streamer: eversolo" gets assigned as "amplifier".

8. **Duplicate entity extraction.** "H390" extracted separately from "Hegel H390". "DeVore Orangutan" and "DeVore O/96" as separate entities.

9. **3-way comparison drops to 2-way.** SP7 requested Ares vs Qutest vs Bifrost; Qutest was dropped.

### Routing Issues

10. **"how does it look?" not assessment language.** RS1 with 3 named components + "how does it look?" routes to diagnosis instead of system_assessment. Natural phrasing gap.

11. **"feeding...into" not a chain separator.** "Pontus II feeding a Leben CS600 into Harbeth M30.2" — natural language chain not recognized.

12. **Comma-separated systems without labels.** SP5 style ("rega planar 3 and a hegel h95 and kef ls50 meta") routes correctly to diagnosis (because of "sounds thin"), but the general case of comma/and-separated systems without assessment language or chain separators may not route to system_assessment.

### Personalization Inconsistency

13. **Saved system referenced in shopping but not product assessment.** Shopping responses include "Why this fits you" with saved system details. Product assessment responses say "No system context available." Inconsistent personalization.

14. **Intent chips don't reference saved system.** "Improve my system" chip asks user to list components despite having a saved system available. Could acknowledge the saved system proactively.

### Content Quality Issues

15. **dCS Bartok identified as bottleneck.** A ~$15K reference DAC called the "weakest link" is a surprising assessment that may erode trust with knowledgeable users. The engine may be over-indexing on R2R preference or tonal density bias.

16. **Pass Labs XA25 → "First Watt" misidentification.** Different brands by the same designer. Pass Labs INT-25 and XA25 are Pass Labs products, not First Watt.

---

## Summary Scorecard

| Section | Tested | Pass | Partial | Fail |
|---------|--------|------|---------|------|
| Part 1: Structured/Messy Prompts | 10 | 3 | 4 | 2 (+1 _DEBUG) |
| Part 2: Homepage Examples | 4 | 1 | 1 | 2 |
| Part 3: Intent Chips | 4 | 3 | 1 | 0 |
| Part 4: Modern Products | 4 | 2 | 2 | 0 |
| Part 5: Reviewer Systems | 3 | 0 | 2 | 1 |
| **Total** | **25** | **9** | **10** | **5** (+1 _DEBUG) |

---

## Issue Classification

### NEW Issues (found in this QA)

| # | Issue | Severity | Prompts |
|---|-------|----------|---------|
| N1 | _DEBUG output leaking in system review constraints section | **HIGH** | SP1, SP2, EX1, RS3 |
| N2 | Brand-fusion parsing (adjacent brands merged into single entity) | **HIGH** | SP2, EX2, RS2 |
| N3 | "Chord not in catalog" on homepage example prompt | **HIGH** | SP4, EX4 |
| N4 | Pass Labs XA25 misidentified as First Watt | **MEDIUM** | RS3 |
| N5 | "how does it look?" not recognized as assessment language | **MEDIUM** | RS1 |
| N6 | "feeding...into" not recognized as chain separator | **MEDIUM** | RS1 |
| N7 | Model suffixes not matched (Ares II → Ares, d90se, O/93 → O/96) | **MEDIUM** | MP2, MP4, RS2 |
| N8 | "Specific model" prompt when model was already provided | **LOW** | MP1, MP2, MP4 |
| N9 | dCS Bartok identified as system bottleneck (questionable) | **LOW** | RS3 |
| N10 | Saved system in product assessment inconsistent with shopping | **LOW** | MP1-4 vs EX3/IC1 |

### Regressions (changes from known-good behavior)

None identified. All previously passing tests continue to pass.

### Pre-Existing Issues (known before this QA)

| # | Issue | Severity | Notes |
|---|-------|----------|-------|
| P1 | 3-way comparison drops to 2-way | MEDIUM | SP7 — Qutest dropped |
| P2 | Role-to-component misassignment in labeled systems | MEDIUM | SP10 — positional parsing |
| P3 | Role labels extracted as subject entities | LOW | SP10 — "streamer" as entity |
| P4 | Component dropping in comparison fallback | MEDIUM | Known pre-existing |

---

## Final Verdict

**NOT ready for external review in current state.**

Three blocking issues must be addressed before external review:

1. **_DEBUG output leaking** (N1) — Raw engine internals visible in every system review. This is the highest-priority fix because it appears in 4 of 25 prompts including homepage examples, and immediately erodes professional credibility.

2. **Brand-fusion parsing** (N2) — Multiple brands in natural text merge into nonsensical entities ("Primaluna Node X", "Devore Bluesound node"). This corrupts system reviews including homepage Example 2. Foundational parsing issue.

3. **Chord "not in catalog"** (N3) — A homepage example prompt claims the brand isn't recognized. Chord Hugo is in the saved system. First-click trust failure for new users.

### After Blocking Fixes

The following should be addressed for quality but are not launch-blocking:

- **N5/N6:** "how does it look?" and "feeding...into" as assessment/chain patterns (medium routing improvement)
- **N7:** Model suffix fuzzy matching (Ares II, d90se, O/93)
- **N4:** Pass Labs vs First Watt brand disambiguation
- **N10:** Consistent saved-system personalization across all intents

### What's Working Well

- **Routing engine:** Core intent detection is solid. system_assessment, shopping, comparison, diagnosis, and product_assessment all route correctly for canonical inputs.
- **Task 6/6b fixes:** Labeled-role chains with assessment language route correctly. Ownership + chain gate works for "here's my system:" patterns.
- **LAIV uDAC fix:** Verified — product queries no longer escalate to system review via meta patterns.
- **Shopping flow:** Multi-turn shopping (chip → follow-up) works smoothly with good recommendations and trade-off framing.
- **Intent chips:** All 4 produce appropriate conversational entries.
- **Advisory tone:** Responses that work correctly follow the Playbook well — calm, trade-off-aware, restraint-respecting.
