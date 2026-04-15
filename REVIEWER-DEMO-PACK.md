# Audio XX — Reviewer Demo Pack

Internal document for trusted external review.
Not marketing copy.

---

## Recommended demo order

Run these 5 prompts in sequence. The order is deliberate: start with the most impressive first impression, move to the strongest engine showcase, then surface nuance and edge cases.

---

### 1. Warm coherent system — assessment + restraint

**Prompt:**

> My system: Denafrips Pontus II → Leben CS300 → Harbeth Super HL5 Plus. Assess my system.

**Why this is a good demo:**
This is the strongest first impression. All three components are well-known, philosophically aligned, and catalogued with rich characterization data. The engine produces a warm/smooth/open signature, detects harmonic density stacking, identifies the build as intentional, and recommends keeping everything. The reviewer sees the full assessment structure — system signature, per-component analysis, stacked trait detection, synergy note — without the complexity of upgrade paths.

**What to notice:**
The system signature ("Tonally warm, smooth, spatially open system emphasizing musical engagement") should feel accurate to anyone familiar with these products. The stacked trait detection calls out smoothness emphasis as a system character feature, not a flaw. The synergy note recognizes this as a deliberately assembled system. All three components are kept — the engine recommends no changes.

**Caveat:**
Because the system is so well-matched, no upgrade paths appear. Features 7–9 (strategy framing, output tightening, explanation layer) are not exercised. This prompt demonstrates assessment quality and restraint, not the upgrade engine.

---

### 2. Bottleneck detection — upgrade paths with strategy labels

**Prompt:**

> My system: Bluesound NODE X → PrimaLuna EVO 300 Integrated → Harbeth P3ESR. What should I upgrade?

**Why this is a good demo:**
This is the strongest engine showcase. The Bluesound NODE X is correctly identified as the chain's limiting factor — a streaming DAC paired with a quality tube amp and respected speakers. The engine produces 3 upgrade paths with differentiated strategy labels, ranked by impact. The reviewer sees bottleneck detection, trade-off-aware rationale, and tiered recommendations.

**What to notice:**
Path 1 (DAC Upgrade, Highest Impact) names the bottleneck and explains what a replacement should bring. Path 2 (Speakers, Moderate) identifies secondary weaknesses without overstating urgency. Path 3 (Amplifier, Refinement) frames the smallest move clearly. Each path has distinct language — they don't read as copies of each other. The rationale text should feel like it came from a human who understood the chain interaction, not a database lookup.

**Caveat:**
The bottleneck constraint text ("reinforcing the system's lean toward high damping / analytical control") uses axis-level language that may be less intuitive to non-technical reviewers. The rationale is accurate but somewhat abstract. When the LLM overlay is active, it rewrites this into more conversational prose.

---

### 3. Balanced restraint — different system, same principle

**Prompt:**

> My system: Chord Qutest → Hegel H190 → DeVore O/96. Should I upgrade anything?

**Why this is a good demo:**
This tests whether the engine can restrain itself on a different system topology. The Qutest/Hegel/DeVore combination is philosophically coherent (detail-forward source, neutral-warm amplification, warm/elastic speakers). The engine keeps all three components and produces zero upgrade paths — a second "no change needed" verdict, but from a tonally different system than Prompt 1.

**What to notice:**
The system signature ("Tonally warm, elastically flowing, spatially open system emphasizing transient clarity") should feel meaningfully different from Prompt 1's signature. The engine isn't producing a single template — it's characterizing each system on its own terms. All three components are kept. Ask the reviewer: does this verdict feel right for this system?

**Caveat:**
The component name shows "DeVore Orangutan O/96" (full catalog name) even though the user typed "DeVore O/96." This is correct behavior (suffix matching resolves the full product), but it may look unfamiliar if the reviewer expected the shorter name.

---

### 4. Shopping recommendation — preference-aware gear selection

**Prompt:**

> Best DAC under $2000 for a warm, musical system

**Why this is a good demo:**
This exercises a completely different engine path — shopping rather than assessment. The engine detects category (DAC), budget ($2000), and preference direction (warm, musical), then produces a curated shortlist from the 158-product catalog. The reviewer sees how Audio XX narrows a large catalog to aligned recommendations.

**What to notice:**
The recommendations should lean toward R2R/multibit and warm-voiced DACs — not analytical/measuring designs. The engine should explain why each product fits the stated preference, not just list specs. Products outside the budget should not appear. Look for whether the recommendation set feels like it came from someone who understood what "warm and musical" means in DAC design, or whether it feels like keyword matching.

**Caveat:**
This prompt triggers the LLM-assisted shopping flow, which combines deterministic product selection with an LLM rewrite layer. If the LLM layer is unavailable (e.g., API key not configured), the output will be a structured but less conversational product list. The underlying product selection is fully deterministic — only the prose wrapper uses the LLM.

---

### 5. Stacked warmth detection — system character vs. imbalance

**Prompt:**

> My system: Denafrips Pontus II → PrimaLuna EVO 300 Integrated → Harbeth P3ESR. How does my system balance look?

**Why this is a good demo:**
This surfaces one of the engine's most nuanced capabilities: distinguishing between system character (a shared direction that defines the system's identity) and system imbalance (stacking that narrows range). With Pontus II + PrimaLuna + Harbeth P3ESR, all three components lean warm. The engine detects harmonic density stacking and smoothness emphasis stacking, classifying the first as imbalance and the second as character.

**What to notice:**
The system axes should read warm/smooth/controlled. Stacked traits should identify which components contribute to each tendency. The engine should acknowledge the warmth without calling it a defect — the distinction between "these components share a warm character" and "these components compound warmth beyond typical balance" is where the engine demonstrates judgment. Despite heavy warmth stacking, the engine still recommends keeping all three components (restraint over change).

**Caveat:**
The stacked trait classification (system_imbalance vs. system_character) relies on thresholds that may feel arbitrary at the boundary. Both harmonic density and smoothness emphasis are flagged, but the system works well musically — a human advisor might not flag either. This is the correct behavior (the engine reports what it detects, not what needs fixing), but reviewers may question whether the "imbalance" label is too strong for a system that sounds good.

---

## Reviewer feedback checklist

After running all 5 prompts, ask the reviewer:

1. **Accuracy** — Did the system signatures feel right for each combination? Were any characterizations clearly wrong?

2. **Restraint** — When the engine recommended no changes (Prompts 1, 3, 5), did that feel like earned judgment or like the system had nothing to say?

3. **Upgrade logic** — When the engine identified a bottleneck (Prompt 2), did the ranking and rationale make sense? Would you have prioritized differently?

4. **Tone** — Does the language feel like a knowledgeable advisor or like a diagnostic tool? Where did it feel most human? Where did it feel most mechanical?

5. **Trust** — After seeing all 5 outputs, would you trust this system to give a friend good advice? What would make you trust it more?

6. **Differentiation** — Does this feel different from reading forum recommendations or review aggregators? What specifically sets it apart, or doesn't?

7. **Stacked traits** — When the engine flagged warmth compounding (Prompt 5), was that observation useful? Was the character vs. imbalance distinction clear, or confusing?

8. **Missing** — What did you expect to see that wasn't there? What question would you want to ask next after each output?
