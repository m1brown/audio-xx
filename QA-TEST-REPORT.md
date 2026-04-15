# Audio XX — End-to-End UI QA Test Report

**Date:** 2026-04-13  
**Environment:** localhost:3000 (development server, Next.js App Router)  
**Method:** Manual browser testing via Chrome, 10 prompts (5 structured, 5 messy)

---

## Section A: First-Run Experience

On first load, the app presents a clean chat interface with no onboarding, no tutorial, and no placeholder text suggesting what to ask. The input field is ready immediately. There is no visible indication of what the app does, what kind of questions it handles, or what a "system" is. A new user arriving without context would have no orientation.

A saved system called "My System" (WLM Diva Monitor → Job Integrated → Chord Hugo) was already present in the database from prior testing. This system silently loaded as context for every non-system-review query throughout the entire test session. There was no visible indicator that a saved system was active, no banner, no label, and no way to tell from the chat UI that the engine was injecting phantom components into the user's stated chain.

The Systems page at `/systems` is the only place where saved systems are visible. Nothing in the main chat flow references or warns about active system context.

**Verdict:** The first-run experience is neutral for a returning user who understands the app, but disorienting for a new user. The silent saved-system injection is a critical UX failure that caused the majority of test failures documented below.

---

## Section B: Structured Prompts

### SP1 — "Denafrips Pontus II, Leben CS300, Harbeth Super HL5+"

**Route:** System review (deterministic path)  
**Components resolved:** All 3 correct  
**Output:** Full system assessment rendered. Strengths, constraints, identity, upgrade paths all present. Strategy labels visible in path headers (confirming Task B implementation). Product options rendered with pros/cons/systemDelta.  
**Issues:**
- `_DEBUG` diagnostic line visible in rendered output: `"_DEBUG dominant: bottleneck · primary kind: component · primary property: Denafrips Pontus II 12th-1 / it is the weakest link..."`. This is development instrumentation leaking into user-facing content.
- Toast/banner: "Leben cs300, Denafrips Pontus ii, Harbeth Super hl5" — acceptable, minor casing inconsistency.

**Result:** Functional, but `_DEBUG` line is a blocker for any external review.

---

### SP2 — "Bluesound NODE X, PrimaLuna EVO 300 Integrated, Harbeth P3ESR"

**Route:** System review (deterministic path)  
**Components resolved:** Partially incorrect  
**Output:** Chain rendered as "Bluesound NODE X → JOB Integrated → PrimaLuna EVO 300 Integrated → Harbeth P3ESR" — a 4-component chain. The phantom "JOB Integrated" was injected from the saved "My System." The NODE X appeared twice in the "keeps" list: "JOB Integrated, Bluesound NODE X, Bluesound NODE X." No upgrade paths were generated.  
**Issues:**
- Phantom component injection (JOB Integrated not in user's prompt)
- Duplicate component in keeps list
- Toast garbled: "Harbeth Bluesound node x, Primaluna Node x, Harbeth P3esr" — brand names bleed across components ("Harbeth Bluesound," "Primaluna Node x")
- Zero upgrade paths despite a clear bottleneck structure

**Result:** Broken. Phantom injection corrupts the entire assessment.

---

### SP3 — "Chord Qutest, Hegel H190, DeVore Orangutan O/96"

**Route:** System review (deterministic path)  
**Components resolved:** Partially incorrect  
**Output:** Chain rendered as "Chord Hugo → Chord Qutest → Hegel H190 → DeVore Orangutan O/96" — a 4-component chain with phantom "Chord Hugo" injected from saved system. The Hugo (not in user's prompt) was identified as the system bottleneck. `_DEBUG` line visible.  
**Issues:**
- Phantom "Chord Hugo" injected, identified as bottleneck
- Two DACs in chain (Hugo + Qutest) — architecturally incoherent
- `_DEBUG` visible
- Toast: "Chord Hegel h190, Chord Qutest, DeVore O/96" — "Chord" brand bleeds onto Hegel

**Result:** Broken. Phantom injection produces an incoherent assessment that misidentifies the bottleneck.

---

### SP4 — "What's the best DAC under $2000 for a warm, musical system?"

**Route:** Non-system-review (LLM-assisted path)  
**Output:** Saved system loaded silently. Response opens with "Your chain: WLM Diva Monitor → Job Integrated → Chord Hugo." A template literal `{}` rendered verbatim: "Your system leans {}." Priority extraction inverted — response emphasizes "energy, impact, and transient speed" rather than the warmth the user explicitly requested. Recommends Chord Qutest and Schiit Bifrost.  
**Issues:**
- Phantom system loaded for a general question (user stated no system)
- Template variable `{}` rendered literally — broken string interpolation
- Priority inversion: warm/musical request → energy/speed recommendation
- Recommendations not unreasonable in isolation, but framed against wrong system

**Result:** Broken. Template literal and phantom system make output unusable.

---

### SP5 — "Tell me about the Chord sound"

**Route:** Brand inquiry  
**Output:** Phantom system loaded. Response treats "Chord" as a specific product rather than a brand. Displays "Chord FPGA" as if analyzing a single product entity. Ends with "If you can share the specific model" — but the user asked about the brand's sonic character, not a specific unit.  
**Issues:**
- Brand-level question treated as product-level
- Phantom system context irrelevant to question
- Follow-up question redundant (asks for model when user wanted brand overview)

**Result:** Misdirected. The routing and response framing don't match the intent.

---

## Section C: Messy Prompts

### MP1 — "i have a rega planar 3 and a hegel h95 and kef ls50 meta and everything sounds thin"

**Route:** LLM-assisted path  
**Output:** Response asks "What source are you using?" — but the user already stated Rega Planar 3 (a turntable, i.e., the source). The system did not recognize the Rega Planar 3 as a source component.  
**Issues:**
- Source component not recognized despite being explicitly named
- Toast: "Kef Planar 3, Hegel, Rega" — brand bleed ("Kef Planar 3" merges KEF with Rega's product name)

**Result:** Partially broken. The redundant question undermines trust, and the toast is garbled.

---

### MP2 — "thinking about getting a naim nait 5si to pair with my b&w 606 s2, wondering about power"

**Route:** Brand inquiry  
**Output:** Phantom system loaded. B&W 606 S2 (the user's actual speaker) ignored entirely. Response asks "Are you exploring the brand generally?" — but the user named a specific product (Nait 5si) and a specific concern (power for B&W 606 S2).  
**Issues:**
- User's speaker (B&W 606 S2) dropped
- Specific product + specific concern misrouted to generic brand inquiry
- Phantom system irrelevant to question

**Result:** Broken. Core entities dropped, wrong routing.

---

### MP3 — "denafrips ares vs chord qutest vs schiit bifrost which one for detail without harshness"

**Route:** Comparison  
**Output:** Three-way comparison reduced to two-way. Chord Qutest entirely dropped from the comparison. Only Denafrips Ares vs Schiit Bifrost evaluated. Phantom system loaded.  
**Issues:**
- Third product (Chord Qutest) silently dropped
- User asked for three-way comparison, got two-way
- Phantom system context irrelevant

**Result:** Broken. A missing competitor in a comparison is a fundamental failure.

---

### MP4 — "i love jazz but also listen to a lot of rock... jazz sounds great but rock sounds flat. venus ii + pass labs int-25 + devore super nines"

**Route:** System review / LLM-assisted hybrid  
**Output:** Phantom system completely overrides user's stated system. Response references "Your system (WLM Diva Monitor, Job Integrated, Chord Hugo)" and renders template literal: "has a {} character." Recommends Naim Nait 5si and Rega Brio (~$500–$1,500) as replacements for the user's Pass Labs INT-25 (~$5,000+) — a massive tier mismatch. Asks "What amplifier are you using?" when the user already stated Pass Labs INT-25.  
**Issues:**
- Phantom system overrides all three user-stated components
- Template `{}` literal rendered again
- Budget/tier mismatch in recommendations ($1,500 amps suggested for $5,000+ system)
- Redundant question about amplifier already named in prompt

**Result:** Broken. The most severe phantom contamination case — user's entire system ignored.

---

### MP5 — "just picked up a topping d90se, curious what you think"

**Route:** Brand inquiry  
**Output:** Phantom system loaded. Response asks "Are you exploring the brand generally?" — but the user said they already bought a specific product and want an opinion on it. Post-purchase context completely missed.  
**Issues:**
- Post-purchase context ignored
- Specific product inquiry misrouted to brand-level
- Phantom system irrelevant

**Result:** Misdirected. Routing does not distinguish purchase-intent from ownership.

---

## Section D: Top Issues (Ranked by Severity)

### 1. BLOCKER — Saved System Phantom Injection

**Affected:** SP2, SP3, SP4, SP5, MP2, MP3, MP4, MP5 (8 of 10 prompts)

A saved system ("My System": WLM Diva Monitor → Job Integrated → Chord Hugo) silently loads as context for every query. For system reviews, phantom components are injected into the user's stated chain, creating incoherent 4-component chains with duplicate roles (two DACs, two amplifiers). For non-system-review queries, the saved system overrides user-stated components entirely or adds irrelevant context to general questions.

**Root cause hypothesis:** The system-loading logic does not distinguish between "user is asking about their saved system" and "user is asking a new question." All non-system-review paths appear to unconditionally load the most recent saved system as context, and the system-review path merges saved components with user-stated components rather than treating the user's input as the complete chain.

**Fix direction:** Add explicit intent detection: if the user states a full system, treat it as the complete chain (ignore saved system). If the user asks a general question with no system context, do not inject saved system. Only reference saved system when the user explicitly invokes it (e.g., "looking at my system" or "upgrade my setup"). Add a visible indicator in the chat UI when a saved system is active.

---

### 2. BLOCKER — `_DEBUG` Diagnostic Line in User-Facing Output

**Affected:** SP1, SP3 (all deterministic system reviews)

The `_DEBUG` line from `composeAssessmentNarrative()` renders in the final output. It reads like internal instrumentation: `"_DEBUG dominant: bottleneck · primary kind: component · primary property: ..."`. This is gated on `NODE_ENV !== 'production'` but is visible on the dev server, which is the environment being reviewed.

**Root cause hypothesis:** The `_DEBUG` line is embedded in the narrative markdown by `composeAssessmentNarrative()` (around line 6035 of `consultation.ts`) and is only suppressed in production builds. Since the dev server runs with `NODE_ENV=development`, the line passes through the renderer and into the React components.

**Fix direction:** Remove the `_DEBUG` line from narrative output entirely. If diagnostic information is needed, route it to `console.log` or a separate debug panel, never into the rendered assessment body.

---

### 3. BLOCKER — Template Variable `{}` Rendered Literally

**Affected:** SP4, MP4

Rendered output contains `"Your system leans {}."` and `"has a {} character."` — raw template placeholders where dynamic values should appear. This indicates a string interpolation failure in the LLM-assisted path or in the narrative composition layer.

**Root cause hypothesis:** A template string in the response generation pipeline uses `{}` as a placeholder (Python-style `.format()` or similar), but the interpolation step either fails silently or is never called. This may be in the LLM prompt template or in a post-processing function that composes the final narrative.

**Fix direction:** Search for `{}` placeholder patterns in LLM prompt templates and narrative composition functions. Ensure all template variables are populated before rendering. Add a post-processing check that flags or strips unresolved `{}` patterns from final output.

---

### 4. HIGH — Toast/Banner Name Garbling (Brand Bleed)

**Affected:** SP2, SP3, MP1

The system toast that confirms detected components garbles names by bleeding brand names across products. Examples: "Chord Hegel h190" (Chord brand applied to Hegel), "Kef Planar 3" (KEF brand applied to Rega product), "Harbeth Bluesound node x" (Harbeth brand applied to Bluesound product).

**Root cause hypothesis:** The toast composition logic concatenates brand and product names from adjacent entries in the component array, likely an off-by-one error or incorrect field mapping when assembling the display string.

**Fix direction:** Audit the toast/banner composition function. Each component's display string should be `brand + " " + model` from the same entry, not assembled across array indices.

---

### 5. HIGH — Entity Dropping and Misrouting

**Affected:** MP1 (source not recognized), MP2 (speaker dropped), MP3 (third product dropped), MP5 (post-purchase context missed)

Multiple prompts lost entities or were misrouted. The Rega Planar 3 was not recognized as a source. The B&W 606 S2 was entirely absent from the response. A three-way comparison dropped the Chord Qutest. A post-purchase "just picked up" framing was treated as a brand inquiry.

**Root cause hypothesis:** Entity extraction and intent classification appear fragile with messy input. The comparison handler may have a two-product maximum. The brand-inquiry route appears to be a catch-all that absorbs too many query types. Source-component recognition may not include turntables.

**Fix direction:** Expand entity extraction to handle turntables and other source types. Increase comparison handler capacity to three products. Refine intent classification to distinguish brand-level questions from product-specific questions, and purchase-intent from post-purchase context. Reduce the catch radius of the brand-inquiry route.

---

## Section E: Launch Readiness Verdict

**Not ready for external review.**

Three blockers must be resolved before any trusted external reviewer sees the application:

1. **Phantom system injection** corrupts 8 of 10 test prompts. This is the single highest-impact bug. It makes the app appear fundamentally broken to anyone who has a saved system — which includes the most engaged users.

2. **`_DEBUG` line** in rendered output signals unfinished development. Any reviewer will flag this immediately.

3. **Template `{}` literals** in rendered output signal broken string interpolation. This is visually obvious and undermines credibility.

After these three blockers are resolved, the app would benefit from addressing the toast garbling and entity-dropping issues (ranked HIGH), but those would not prevent a review — they would appear as known issues on a punch list rather than fundamental failures.

**Recommended sequence:**
1. Fix phantom system injection (largest blast radius, most test failures)
2. Remove `_DEBUG` from narrative output (smallest fix, immediate visual improvement)
3. Fix `{}` template interpolation (small fix, high visibility)
4. Then invite external review with HIGH issues documented as known limitations
