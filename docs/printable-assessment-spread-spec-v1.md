# Audio XX — The Assessment
## Canonical Printable Spread — Design Specification v1

Status: **Design spec (pre-implementation).** No UI is built from this yet.
Foundation: the deterministic system identity is architecturally immutable (`0cb8323`).
Governing design law: [Design Doctrine v1 — Editorial First]; every screen is another spread in the same publication.

---

### 0. First principles — what we are actually making

We are not designing a web page that can be printed. We are designing **a two-page editorial spread** — the kind a serious listener would print on good stock, keep in a folder with their manuals, and hand to a friend. The web presentation is a faithful *reflow* of that spread, not the other way round.

Four laws govern every decision below:

1. **The identity is the foundation, not a headline.** The immutable deterministic identity (`signature`, `verdict`, `recognition`, `committedAxes`) is the spine the whole spread hangs from. Every zone elaborates it; no zone re-derives or softens it. This is the same invariant now enforced in code — the printed artifact inherits it for free.
2. **One argument, told once.** The spread makes a single case — *this is what your system is, and this is why* — and never repeats itself to fill a column. Length is earned by evidence, never by symmetry.
3. **Two strata, cleanly separated.** There is **primary narrative** (the editorial voice a reader follows start to finish) and a **reference layer** (evidence, designer philosophy, manufacturer facts, measurements, sources, optional retailer links). The reference layer is *addressable from* the narrative but never *interrupts* it. It is a stratum, not page furniture.
4. **Restraint reads as confidence.** White space, a single accent, and one photographic register do the work that borders, panels, and chrome do in lesser products. When the system needs nothing, the page says so and stops.

---

### 1. The physical object

| Property | Specification | Rationale |
|---|---|---|
| Format | Two-page spread, **A4 landscape pair** (or US Letter landscape), read left-leaf → right-leaf | Landscape gives the wide reading measure editorial prose wants; the pair reads as one composition. |
| Trim discipline | Full-bleed photography permitted on the left leaf only; text never bleeds | Keeps the argument inside a stable text block; imagery carries the drama. |
| Grid | **12-column** underlying grid per leaf; text sets to a **`--measure`-width** column (~62–70 characters); a persistent **outer margin rail** (`--rail-w`) reserved for the reference layer | One reading column for the eye to follow; the rail is where references live without breaking flow. |
| Type system | `--face-display` (verdict + section openers), `--face-grotesque` (labels, credits, reference keys), `--face-text` (body). Three faces, three jobs, no more. | The existing artifact type system, printed. |
| Colour | `--ink` on `--ground` (warm paper white); a single `--accent` (#B08D57, gold) for the identity marker and reference keys only | One accent, used sparingly, becomes a signature rather than decoration. |
| Rules & seams | One hairline `--seam-w` gutter seam between leaves; `--hairline` dividers only where the narrative genuinely changes register | Dividers mark thought-breaks, not every block. |
| Silence | `--silence-top`, `--silence-verdict`, `--silence-foot` preserved as generous fixed rests | Whitespace is a designed element, not leftover space. |

---

### 2. Narrative flow across the spread

The spread is read as a five-beat editorial arc. The **left leaf is the finished answer**; the **right leaf is the case behind it.** A reader who stops after the left leaf has a complete, honest assessment; a reader who continues gets the reasoning and the evidence.

```
        LEFT LEAF — THE ANSWER                    RIGHT LEAF — THE CASE
  ┌──────────────────────────────┐        ┌──────────────────────────────┐
  │  masthead · edition · date    │        │  ▍ ENGINEERING EXPLANATION    │
  │                               │        │    (why it sounds this way)   │
  │  SYSTEM LINE  (the four names)│        │    2–4 composed paragraphs    │
  │  ── photographic strip ──     │        │                               │
  │                               │        │    ❝ ONE TRUE THING ❞         │
  │  ▍ VERDICT   (display)        │        │      pull-quote, accent       │
  │    standfirst (the identity)  │        │                               │
  │                               │        │    THE TRADE-OFF              │
  │  RECOGNITION  (what it is for)│        │      the deal, stated plainly │
  │                               │        │                               │
  │  RECOMMENDATION + cost        │        │    LISTENING NOTE (optional)  │
  │                               │        │                               │
  │                          ·rail│        │ ·············· references rail│
  └──────────────────────────────┘        └──────────────────────────────┘
         reference rail (outer)                   reference rail (outer)
  ┌───────────────────────────────────────────────────────────────────────┐
  │  REFERENCES — designer philosophy · manufacturer · measurements ·      │
  │  manuals · sources · optional retailer links   (numbered, keyed above) │
  └───────────────────────────────────────────────────────────────────────┘
```

**The five beats, in order:**

1. **Recognition of the object** — the system line + photographic strip: *this is your system, seen clearly.* Establishes trust before a single claim.
2. **The Verdict** — the identity delivered as a finished statement (`verdict` headline + `signature` standfirst). The emotional and intellectual center of gravity.
3. **The Recommendation** — what to do (often: nothing), with its honest cost. Closes the left leaf as a self-contained answer.
4. **The Engineering Explanation** — the case: *why the system became what the verdict says it is.* This is the composed argument, now guaranteed identity-consistent.
5. **The Deal & the Experience** — the One True Thing (the single most important insight), the Trade-off, and an optional Listening Note that grounds the analysis in what a person actually hears.

The arc is deliberately **answer-first, evidence-second** — the same IA law shipped in `696a4d0`, expressed spatially across two leaves.

---

### 3. Editorial hierarchy (what carries meaning)

Five levels, in descending authority. Each maps to an immutable-identity field or a composed section that must elaborate it.

| Level | Element | Source (engine field) | Editorial role |
|---|---|---|---|
| **H1** | Verdict | `verdict` | The single sentence a reader remembers. |
| **H1′** | Standfirst / signature | `signature` (immutable) | The identity, stated once, in full. Governs everything below. |
| **H2** | Recognition | `recognition` (immutable intent read) | What the system is *for* — the builder's apparent intent. |
| **H2** | Recommendation + cost | `recommendation`, `cost` | The advice and its price. |
| **H3** | Engineering Explanation | `caseParagraphs` (A3, identity-gated) | Why the identity holds — the mechanism. |
| **H3′** | One True Thing | `pullQuote` | The most important single idea, lifted out. |
| **H3′** | Trade-off | the "deal" beat within the case | What the system gives up to be itself. |
| **H4** | Listening Note | optional experiential line | Grounds analysis in the heard. Progressive. |
| **H5** | Reference layer | designer / manufacturer / measurement / source / retailer | Supporting evidence. Never primary. |

The rule that makes this a *publication* and not a dashboard: **authority descends monotonically.** Nothing at H5 may visually out-shout anything at H3. A measurement is a footnote, not a hero stat — unless the engine has made a measurement *the* argument (a power-match bottleneck), in which case it is promoted into H3 prose, not left as reference furniture.

---

### 4. Visual hierarchy (how the eye moves)

The eye should land, in order: **photographic strip → Verdict → standfirst → down the left column → across the seam → Engineering Explanation → pull-quote.** Visual weight is engineered to produce exactly that path.

- **Scale contrast, not colour contrast.** The Verdict is set large in `--face-display`; the reference layer is set small in `--face-grotesque`. The jump in type size *is* the hierarchy. Colour stays monochrome except the single gold accent.
- **The photographic strip** is the only full-saturation element and sits top-left — it earns the first fixation, then hands off to the Verdict directly beneath it.
- **The accent (`--accent`) is rationed.** It marks exactly two things: the identity marker (a short rule or ▍ tab beside the Verdict) and the superscript reference keys. Nothing else is gold. Rationing is what makes it read as a mark of authority.
- **One pull-quote per spread, maximum.** The One True Thing is the only element permitted to break the reading column and sit in display size on the right leaf. Two pull-quotes would halve the impact of each.
- **Whitespace as pacing.** `--silence-verdict` above the Verdict is the largest rest on the page — the pause before the statement. The reference block is separated from the narrative by `--silence-foot`, signalling "you may stop here."

---

### 5. Primary narrative vs. supporting reference

This is the central architectural decision of the spec.

**Primary narrative** = the continuous editorial voice: System line → Verdict → Standfirst → Recognition → Recommendation → Engineering Explanation → One True Thing → Trade-off → (Listening Note). A reader can follow it top-to-bottom, left-to-right, and never touch the reference layer. It is complete on its own.

**Supporting reference** = everything that *substantiates* the narrative but is not the narrative:
- **Designer philosophy** (why the maker voices gear this way)
- **Manufacturer information** (model facts, provenance, era)
- **Measurements** (sensitivity, impedance, power figures — only real, engine-held numbers)
- **Manuals / designer interviews** (primary-source pointers)
- **Sources** (where a claim is licensed from — the D-7 evidence trail)
- **Optional retailer links** (commerce, quarantined from editorial)

The two strata never blend. The narrative *references* the second stratum by superscript key (`¹`, `²`…) in `--accent`; the reader may descend to the reference block for depth, or ignore it entirely. This is how a monograph handles footnotes — and it is the opposite of the current failure mode, where evidence and philosophy are stitched inline and dilute the argument.

---

### 6. The reference layer — depth without interruption

Treated as a **reusable stratum**, authored once and rendered wherever an assessment needs it — not page furniture rebuilt per layout.

**Where it lives:**
- **Outer margin rail** (`--rail-w`) — the shortest references (a measurement, a one-line manufacturer fact) sit in the margin beside the paragraph that invokes them. Present but peripheral.
- **Footer reference block** — the fuller references (designer philosophy paragraph, source citations, manuals) collect at the foot of the spread, numbered and keyed to the superscripts above.
- **Never inline.** A designer-philosophy sentence never interrupts the Engineering Explanation; it is keyed and deferred.

**Evidence-class discipline (D-7 inheritance):** each reference carries its licensing class — *manufacturer spec*, *designer intent*, *measurement*, *consensus*, *inference* — as a quiet grotesque tag. The printed artifact must never let a manufacturer claim and an inference wear the same typographic authority. This is the epistemic-fidelity doctrine made visible.

**Retailer links are quarantined.** If present, they appear only in the reference block, visibly separated (a hairline + a "Where to hear/buy" grotesque label), never in the narrative, never styled like editorial. Commerce may support the artifact; it may never wear its voice.

---

### 7. Element catalog — mandatory / optional / progressive

| Element | Status | Condition |
|---|---|---|
| System line (component names, ordered) | **Mandatory** | Always. The object must be named. |
| Photographic strip | **Mandatory** (graceful) | Photos when held; a typographic strip when not — never a broken frame. |
| Verdict | **Mandatory** | Always. Immutable. |
| Standfirst / signature | **Mandatory** | Always. Immutable identity. |
| Recognition | **Mandatory** | Always. |
| Recommendation + cost | **Mandatory** | Always — including "nothing needs changing" + its honest cost. |
| Engineering Explanation | **Mandatory** | Always ≥ 2 paragraphs. Deterministic column if A3 is off/fails. |
| One True Thing (pull-quote) | **Optional** | When a single insight genuinely dominates; omitted rather than manufactured. |
| Trade-off | **Progressive** | Present when the identity has a real deal; a bottleneck promotes it to prominence. |
| Listening Note | **Progressive** | Appears only when experiential grounding adds understanding, not length. |
| Reference — measurement | **Progressive** | Only real engine-held figures; promoted to H3 when it *is* the argument. |
| Reference — designer philosophy | **Optional** | When the maker has an authored profile; absent gracefully otherwise. |
| Reference — manufacturer / provenance | **Optional** | When held. |
| Reference — sources / manuals | **Progressive** | Grows with the depth of the licensing trail. |
| Reference — retailer links | **Optional** | Quarantined; only if commerce is enabled. |

**The mandatory set alone is a complete, publication-quality artifact.** Everything optional/progressive deepens it without ever being required to fill the page. An assessment with no designer profile, no measurements, and no pull-quote is still a finished spread — shorter, and honestly so.

---

### 8. Print → responsive-web mapping

The spread is the master; the web is its reflow. The mapping is **lawful, not ad hoc.**

| Print construct | Wide web (≥1200px) | Tablet | Mobile |
|---|---|---|---|
| Two-leaf spread | Two columns sharing the seam | Single column, left-leaf content first | Single column |
| Left-leaf answer / right-leaf case | Side by side | Stacked: answer, then divider, then case | Same, stacked |
| Outer margin rail references | True margin notes beside the paragraph | Collapse to superscript → tap-to-expand inline aside | Superscript → expandable |
| Footer reference block | Full-width foot of spread | Foot of article | Collapsible "References & sources" section |
| Photographic strip | Full strip | Full strip | Horizontal scroll or 2×2 |
| Pull-quote breaking the column | Breaks the column | Full-width band | Full-width band |
| Whitespace rests (`--silence-*`) | Preserved as-is | Compressed by a fixed ratio | Compressed, never removed |

**Invariants across all widths:**
- Reading order never changes: answer precedes case; narrative precedes reference.
- The reference layer is always *addressable but subordinate* — it may collapse, never promote itself above narrative.
- The identity (Verdict + standfirst) is always the first substantial text after the object is shown.
- Nothing in the narrative is lost on mobile; only the reference layer changes affordance (margin → disclosure).

A print stylesheet (`@media print`) is therefore not a bolt-on: the web is the print spread with responsive *affordances* added, and "Print / Save as PDF" reproduces the canonical two-leaf artifact exactly.

---

### 9. How the immutable identity governs every zone

Because the identity is now fixed in code, the spread can treat it as bedrock:

- The **Verdict** and **standfirst** render the identity verbatim — no zone may paraphrase it into a different net character.
- The **Engineering Explanation** is already gated: it may only explain *why* the committed tonal directions hold; it cannot assert their opposite. The printed artifact inherits this guarantee — there is no path by which page 2 contradicts page 1.
- The **reference layer** may *add* evidence (a measurement, a designer quote) but may never *re-characterize* the system; a warm designer philosophy beside a detail-forward identity is presented as *the maker's intent one level down*, not as a competing verdict.
- **One editorial identity, many elaborations** — the spec's organizing principle and the reason it is safe to build.

---

### 10. What this is NOT (guardrails)

- Not a spec sheet with prose bolted on. Measurements serve the argument or sit as references; they are never the point.
- Not a symmetrical two-pager. If the case is short, the right leaf is short. Balance is not filled to match.
- Not a brand brochure. Designer philosophy is evidence, keyed and subordinate — never a hero panel.
- Not a redesign of the current React components. This spec starts from the printed object; implementation mapping is a *later* envelope.
- Not longer than the system warrants. A "nothing needs changing" verdict yields a shorter, calmer spread — and that restraint is the product.

---

### 11. Open decisions for the founder (before any implementation)

1. **Trim & orientation:** landscape A4 pair (recommended, editorial) vs. portrait single-page-per-leaf. Changes the grid.
2. **Photography standard:** do we commit to a consistent component-photography register (lit, neutral ground), or accept mixed provenance with a typographic fallback?
3. **Reference affordance on web:** margin notes (desktop) collapsing to tap-to-expand — confirm this over a single "References" endnote section.
4. **Retailer links:** in scope for v1 of the artifact, or deferred until commerce is enabled?
5. **The pull-quote source:** is "One True Thing" author-composed (A3, gated) or deterministically lifted from the case? Affects the immutability surface.

---

*Deliverable status: specification complete. No UI implemented. Recommend founder sign-off on §11 before an implementation envelope is scoped.*

---

### 12. Founder resolutions (2026-07-29) — amend the sections above

1. **Format:** two **portrait** leaves forming a landscape spread; each leaf prints independently on A4 **and** US Letter. Screen may show them together; the canonical artifact is not two landscape pages. *(Amends §1.)*
2. **Photography:** **product images kept**, under strict normalization (consistent crop/scale/frame/caption; no visible retailer branding; provenance in the reference layer; typographic fallback only where no suitable image exists). Comprehensive photo acquisition is **not** a prerequisite. *(Amends §7, §11.2.)*
3. **References:** margin references (desktop) · tap-to-expand (narrow) · numbered source notes (print). The reference architecture must remain **complete when printed**. *(Confirms §6, §8.)*
4. **Commerce:** retailer/affiliate links **deferred** from v1; schema still supports manufacturer / manual / interview / technical / measurement / availability / retailer / used-market. Commercial links stay visually + editorially separate. *(Confirms §7, §11.4.)*
5. **One True Thing:** **A3-authored** from the immutable identity + licensed evidence, with contradiction + evidence validation and deterministic fallback — never a free re-interpretation. *(Resolves §11.5.)*
6. **Mandatory architecture:** Left leaf — system line + strip · Verdict · standfirst/signature · Recognition · Recommendation · **The One Cost**. Right leaf — Engineering Explanation · **Listening Session (mandatory**, length adapts to evidence) · One True Thing · Trade-off/operating condition · source & evidence layer. *(Amends §7 — Listening Session is mandatory, not progressive.)*
7. **Evidence boundary (governing):** artifact v1 admits **only** manufacturer fact · designer statement · primary technical source · Audio XX interpretation. **Third-party reviews are out of scope** — never for sonic character, validation, quotation, or gap-filling; a future class requiring separate approval. Primary-source hierarchy: (1) manufacturer/official pages; (2) manuals, specs, white papers, patents, technical notes; (3) attributable designer/principal statements via official channels; (4) Audio XX interpretation. Absent primary evidence → reference left absent, gap recorded; reviewer consensus is never a substitute. *(Amends §6.)*
8. **Palette:** Financial Times core — FT-pink paper, claret, slate/teal/velvet, warm-cream neutral. Site-wide (palette only; Audio XX keeps its own identity — no FT masthead/branding). Site-wide token application is a separate follow-up envelope. *(Amends §1 visual system.)*
