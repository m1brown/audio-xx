# Phase E-5B Implementation Design — Brand House Voicing

**Status:** Implementation design only. No source-code changes accompany
this document. The brand-data values are not duplicated here; they remain
in the approved Phase E-5A document and will be transferred into the
production TypeScript file during Stage E-5B.1.

**Prerequisite:** Phase E-5A approved (commits `a98c96f`, `3135831`,
`cf6df94`). The §1A Brand Layer Philosophy and §13 Implementation Gate
in E-5A are the governing conditions for this design.

**Out of scope:** No routing changes, no MemoFormat changes, no Brand
Authority changes, no env-var changes, no feature-flag-semantics
changes, no Production promotion. Phase A B3/B4/B5 gating, Phase E-3
chain-banner partitioning, and Phase E-4 destination-speaker model
allowlist are preserved unchanged.

---

## 1. Scope, Constraints, and Implementation Set

### 1.1 Implementation set

- **23 active audiophile-identity entries** drawn from §3 of E-5A:
  Naim (#1), Linn (#2), Pass Labs (#3), Quad ESL (#4), Tannoy (#5),
  McIntosh (#6), Audio Research (#7), dCS (#8), Chord Electronics (#9),
  Klipsch Heritage (#10), JBL Studio Monitor & Synthesis (#11),
  Harbeth (#12), Spendor (#13), Wilson Audio (#14), Magico (#15),
  YG Acoustics (#16), DeVore Fidelity (#17), Leben (#19), Hegel (#21),
  Luxman (#22), Rega (#23), KEF (#24), Focal (#25).
- **6 commercial markers** drawn from §3 of E-5A:
  WiiM (#26), Eversolo (#27), Bluesound (#28), Schiit (#29), iFi (#30),
  Topping (#31).
- **2 explicitly excluded from production:** Audio Note (#18) and
  Shindo Laboratory (#20). These are **not** carried into the production
  data file at any confidence level. See §1.3 below.

### 1.2 Governing constraints (do not violate)

- The §1A Brand Layer Philosophy (Architecture → Behavior → Experience)
  is binding. Any implementation choice that inverts the hierarchy is a
  blocker, not a refinement.
- The §13 hard gates are preconditions for safe surfacing, not
  aspirations. Each gate is implemented as an explicit early-return in
  the gate stack; "soft" handling is not acceptable.
- Composer output is selection-only: the composer chooses one of the
  static strings (`houseVoicing` | `designPhilosophy` |
  `systemBuildingLogic`) verbatim from the data layer. The composer
  never generates novel brand prose.
- Engine output remains authoritative for character (§4) and upgrade
  direction (§10). The brand layer adds context to an already-formed
  explanation; it does not initiate one.

### 1.3 Exclusion handling

Audio Note (#18) and Shindo (#20) are excluded by **structural
absence** from the production data file, not by confidence-level
suppression. The production module must not contain entries with
`matchTokens` of `['audio note']` or `['shindo']`. This is
verifiable by a unit test (see §8.1).

The deferred entries remain in E-5A §3 as research material for
possible future revisions; the E-5B production data file does not
reference them.

---

## 2. Production Data Layer Design

### 2.1 Module location

A single new file:

```
apps/web/src/lib/brand-house-voicing.ts
```

Co-located with the existing advisory engine modules. No barrel
export changes; consumers import the symbols by name.

### 2.2 Module shape

```ts
// Public types — match the schema approved in E-5A §2.
export type BrandConfidence = 'high' | 'medium' | 'low';
export type BrandPriority = 'audiophile-identity' | 'mixed' | 'commercial';
export type RoleFamily = 'source' | 'amplifier' | 'speaker' | 'auxiliary' | 'all';

export interface BrandHouseVoicing {
  brand: string;
  brandFamily?: string;
  matchTokens: readonly string[];
  priority: BrandPriority;
  confidence: BrandConfidence;
  houseVoicing?: string;
  designPhilosophy?: string;
  systemBuildingLogic?: string;
  commonStrengths: readonly string[];
  commonTradeoffs: readonly string[];
  upgradeCautions: readonly string[];
  bestUsedWhen?: string;
  avoidOverclaiming: readonly string[];
  appliesToRoles: readonly RoleFamily[];
  exampleModels: readonly string[];
  notes?: string;
}

// Production set — 23 audiophile-identity + 6 commercial.
// Order: more specific matchTokens first; bare-brand tokens last.
export const BRAND_HOUSE_VOICING: readonly BrandHouseVoicing[] = [ /* ... */ ];

// §12.6 universal cliché-deny vocabulary — applied to every entry
// regardless of priority.
export const UNIVERSAL_AVOID_OVERCLAIMING: readonly string[] = [
  'magic',
  'legendary',
  'unrivalled',
  'unrivaled',
  'giant killer',
  'giant-killer',
  'giant slayer',
  'giant-slayer',
  'world class',
  'world-class',
  'best in class',
  'best-in-class',
  'endgame',
  'end-game',
  'end game',
  'cult',
  'reference killer',
  'reference-killer',
  'musicality',  // when used as an unexplained noun
];
```

### 2.3 Entry data transfer rules (Stage E-5B.1)

The data-extraction step takes §3 of E-5A and applies the following
mechanical transformations. No editorial changes are made.

1. **Drop entries #18 (Audio Note) and #20 (Shindo).** The
   production array is 29 entries (23 + 6), not 31.
2. **Transfer all retained fields verbatim** from E-5A §3 into the
   TypeScript literal. Sentence wording must match exactly.
3. **`matchTokens` narrowings already documented in E-5A** must be
   preserved exactly:
   - Quad: `['quad esl', 'quad ii']`
   - Chord Electronics: `['chord hugo', 'chord dave', 'chord m scaler', 'chord mojo', 'chord qutest']`
   - Klipsch Heritage: `['klipsch heresy', 'klipsch forte', 'klipsch cornwall', 'klipsch la scala', 'klipsch lascala', 'klipschorn', 'klipsch khorn']`
   - JBL Studio Monitor & Synthesis: `['jbl 4329', 'jbl 4349', 'jbl 4367', 'jbl 4429', 'jbl k2', 'jbl m2', 'jbl everest', 'jbl dd67000']`
   - Wilson Audio: `['wilson audio', 'wilson sasha', 'wilson sabrina', 'wilson alexx', 'wilson watt', 'wamm']`
   - YG Acoustics: `['yg acoustics', 'yg carmel', 'yg hailey', 'yg sonja', 'yg vantage']`
   - Tannoy: `['tannoy prestige', 'tannoy legacy', 'canterbury', 'westminster', 'kensington', 'turnberry', 'cheviot', 'arden', 'eaton', 'glenair', 'stirling']` *(this is the narrowing approved in the final-pass revision)*
4. **`matchTokens` tier-enforcement narrowings for KEF and Focal** —
   the E-5A entries for these brands include explicit notes stating
   that identity prose must be restricted to higher tiers (KEF
   R-series and above; Focal Sopra and above). E-5A did not narrow
   the tokens; E-5B enforces the restriction at lookup-time by
   narrowing the matchTokens:
   - KEF: `['kef r3', 'kef r5', 'kef r7', 'kef r11', 'kef reference', 'kef blade', 'kef muon']`
     *(bare `'kef'` and Q-series tokens excluded; LS-series is wireless
     active and treated as commercial-tier for E-5B initial rollout)*
   - Focal: `['focal sopra', 'focal utopia', 'focal stella', 'focal maestro', 'focal grande utopia']`
     *(bare `'focal'`, Chora, and Aria tokens excluded)*

   This is **implementation of approved E-5A guidance**, not an
   editorial revision. The `notes` field text in each entry already
   says identity prose should be tier-restricted; this narrowing is
   the mechanical enforcement.

5. **Array order in `BRAND_HOUSE_VOICING`** — entries with more
   specific tokens appear before entries with more generic tokens to
   ensure correct first-match behavior in the lookup helper. The
   E-5B-recommended order:
   1. All entries with model-name tokens (Klipsch Heritage, JBL,
      Wilson Audio, YG, Quad, Chord Electronics, Tannoy, KEF
      narrowed, Focal narrowed) — alphabetic within group.
   2. All entries with bare-brand tokens (Naim, Linn, Pass Labs,
      McIntosh, Audio Research, dCS, Harbeth, Spendor, Magico,
      DeVore, Leben, Hegel, Luxman, Rega) — alphabetic within group.
   3. Commercial entries (WiiM, Eversolo, Bluesound, Schiit, iFi,
      Topping) — alphabetic within group.

6. **No new fields added** to the BrandHouseVoicing interface. The
   schema approved in E-5A §2 is final.

---

## 3. Lookup Helper Design

### 3.1 Signature

```ts
/**
 * Look up the brand-house-voicing entry that matches a component
 * name. Returns the first matching entry (array order is the
 * specificity order — see §2.3), or null if no entry matches.
 *
 * This is a pure function. It does not consult any other state.
 * Callers must apply the §4 gate stack before surfacing any
 * sentence from the returned entry.
 */
export function findBrandHouseVoicing(
  componentName: string,
): BrandHouseVoicing | null;
```

### 3.2 Behavior

1. Lowercase the input `componentName` once.
2. Iterate `BRAND_HOUSE_VOICING` in array order.
3. For each entry, iterate `matchTokens` in array order. If any token
   appears as a substring of the lowercased component name, return
   that entry.
4. If no entry matches, return `null`.

Performance: O(N · M) with N = 29 and M ≤ 12. Negligible at any
realistic chain size; called per §5 card and once each for §8 / §10.

### 3.3 Edge cases the helper handles

- Empty `componentName` → null
- Component name with mixed casing → matched on lowercase
- Component name with embedded model number and brand → matched on
  brand token substring
- Multiple entries' tokens could match the same component → returns
  the first match in array order. This is why §2.3 specifies the
  array order: specific tokens first.

### 3.4 What the helper does NOT do

- It does not apply any gate from §4. Gates are the caller's
  responsibility.
- It does not normalize component names beyond lowercasing. Punctuation
  and spacing in component names are preserved into the substring
  match.
- It does not check `appliesToRoles`. Role checks are gate-stack
  responsibility.
- It does not deduplicate against existing card prose. Redundancy
  suppression is gate-stack responsibility.

---

## 4. Gate Stack Design

The gate stack is the single authority for deciding whether a brand
sentence may surface and which sentence to choose. Every §5, §8, and
§10 integration point calls the same gate stack with section-specific
inputs.

### 4.1 Function signature (conceptual)

```ts
interface BrandGateInput {
  // Required for every section
  component: ChainComponent;          // §5 card subject; for §8/§10, the relevant component
  roleFamily: RoleFamily;             // derived via existing roleFamily() helper
  hasConflictSignal: boolean;         // Phase A B3/B4 — passed in from caller
  isPrimaryConstraint: boolean;       // Phase A B5 — passed in from caller
  existingCardProse: string;          // already-composed facts sentence for redundancy check
  section: '§5' | '§8' | '§10';       // selects sentence priority order (see §4.3)
}

interface BrandGateResult {
  sentence: string | null;            // null when any hard or soft gate fires
  suppressedBy?:                       // for logging / test assertions
    | 'no-match'
    | 'commercial'
    | 'confidence-low'
    | 'role-not-applicable'
    | 'medium-under-conflict'
    | 'primary-constraint-contradicts'
    | 'redundancy'
    | 'avoid-overclaim-match'
    | 'shape-check-failed';
}

export function selectBrandSentence(
  input: BrandGateInput,
): BrandGateResult;
```

### 4.2 Gate execution order (each gate is an explicit early-return)

| # | Gate | Condition for early-return |
|---|---|---|
| 1 | Brand lookup | `findBrandHouseVoicing(component.name)` returns null → result `{ sentence: null, suppressedBy: 'no-match' }` |
| 2 | Commercial hard-gate | `entry.priority === 'commercial'` → `{ null, 'commercial' }` |
| 3 | Confidence-low hard-gate | `entry.confidence === 'low'` → `{ null, 'confidence-low' }` |
| 4 | Role applicability | `entry.appliesToRoles` does NOT include the input's `roleFamily` AND does not include `'all'` → `{ null, 'role-not-applicable' }` |
| 5 | Medium-under-conflict | `entry.confidence === 'medium'` AND `hasConflictSignal === true` → `{ null, 'medium-under-conflict' }` |
| 6 | Primary-constraint contradiction | `isPrimaryConstraint === true` AND the candidate sentence would contradict the engine's upgrade direction on this component → `{ null, 'primary-constraint-contradicts' }`. Conservative default: when in doubt, suppress. The simplest implementation is "if the engine has flagged this component as the primary constraint AND the entry's role is `speaker`, suppress the brand sentence." (Speaker is the only role where engine upgrade direction commonly contradicts brand voicing in observed fixtures.) Refinement is a Stage E-5B.2 task. |
| 7 | Sentence selection | Choose the first non-empty field from the section-specific priority order (see §4.3). If none set → `{ null, 'no-match' }` *(should be unreachable for active entries — fields are present by E-5A construction; included as a defensive return)*. |
| 8 | Redundancy suppression | Tokenize the candidate sentence; tokenize the `existingCardProse`; if the candidate's key noun-phrase appears as a substring of the existing prose, suppress: `{ null, 'redundancy' }`. The matcher is a substring scan, not semantic. The set of "key noun phrases" is a small per-entry hint derivable from `houseVoicing` / `designPhilosophy` (e.g. dCS → "Ring DAC"; KEF → "Uni-Q"; Tannoy → "Dual-Concentric"). See §4.4. |
| 9 | Anti-overclaim deny-check | For each phrase in `entry.avoidOverclaiming` ∪ `UNIVERSAL_AVOID_OVERCLAIMING`, perform a case-insensitive substring check against the candidate sentence. Any match → `{ null, 'avoid-overclaim-match' }`. Suppression is final; the gate does not retry with an alternative field. |
| 10 | Shape check (§12.6 rule 9) | The candidate sentence must contain at least one design-side noun. The implementation: scan the candidate for any of a small set of architecture vocabulary tokens (`design`, `topology`, `architecture`, `cabinet`, `driver`, `tube`, `Class-A`, `Class-AB`, `transformer`, `panel`, `coaxial`, `dipole`, `sealed`, `horn`, `discrete`, `signal path`, `power supply`, `feedback`, `FPGA`, `Ring DAC`, `Uni-Q`, `Dual-Concentric`, `autoformer`, `unity-coupled`, `inverted dome`, `RADIAL`, `BilletCore`, `X-Material`, `SoundEngine`). If none present → `{ null, 'shape-check-failed' }`. (Architecture verbs of any kind satisfy the gate; the list is editorially-stable and grown only with reviewed additions.) |
| 11 | Per-card / per-section cap | Enforced by the caller, not this function. The selectBrandSentence function is called at most once per card / per section. |

### 4.3 Section-specific sentence priority

| Section | Priority order |
|---|---|
| §5 | `houseVoicing` → `designPhilosophy` → `systemBuildingLogic` |
| §8 | `systemBuildingLogic` → `designPhilosophy` → `houseVoicing` |
| §10 | `upgradeCautions[0]` (when present) → null |

§5 prefers behavior-anchored sentences for the per-component card.
§8 prefers system-building sentences for the chain-level paragraph.
§10 surfaces the first `upgradeCautions` entry only; if the array is
empty, the helper returns null.

### 4.4 Redundancy-suppression key phrases (per-entry hint table)

Implementation detail: a small static map alongside `BRAND_HOUSE_VOICING`
that lists the key noun-phrase tokens to scan for in
`existingCardProse`. This map is derivable from each entry's
`houseVoicing` and `designPhilosophy` and does not extend the public
schema.

| Brand | Key noun-phrase tokens for redundancy scan |
|---|---|
| dCS | `Ring DAC`, `FPGA` |
| Chord Electronics | `FPGA` |
| KEF | `Uni-Q` |
| Tannoy | `Dual-Concentric`, `Dual Concentric` |
| Klipsch Heritage | `horn`, `high efficiency` |
| Harbeth | `RADIAL`, `thin-wall` |
| Wilson Audio | `X-Material`, `time-aligned` |
| Magico | `aluminum-extrusion`, `sealed cabinet` |
| YG Acoustics | `BilletCore`, `sealed cabinet` |
| McIntosh | `autoformer`, `unity-coupled` |
| Hegel | `SoundEngine` |
| Audio Research | `auto-bias`, `Reference series` |
| Pass Labs | `Class-A`, `Nelson Pass` |
| Naim | `discrete signal path`, `power supply` |
| Linn | `source-first`, `Space Optimisation` |
| Rega | `cross-component`, `ecosystem` |
| Focal | `inverted dome`, `beryllium tweeter` |
| Quad ESL | `electrostatic`, `dipole panel` |
| JBL S&S | `compression driver`, `horn` |
| Spendor | `BBC heritage`, `sealed cabinet` |
| DeVore Fidelity | `wide-baffle`, `high efficiency` |
| Luxman | `Class-AB`, `power supply` |
| Leben | `push-pull`, `EL84`, `6L6GC`, `6CA7` |

Commercial entries do not appear in this table (gated out at #2).
The map is private to the implementation and may be revised without
editorial review.

### 4.5 Defensive defaults

- Any gate that cannot conclusively determine its condition returns
  `{ null, ... }` — suppression is the safe default.
- The gate stack does not throw on malformed input. Empty fields, null
  inputs, and unexpected `roleFamily` values all return `null`.
- The gate stack is pure. Given the same input it returns the same
  result; no state, no side effects, no logging.

---

## 5. Composer Integration Points

### 5.1 §5 component card (`composeContributionBody`)

**Where it integrates.** Existing `composeContributionBody` in
`apps/web/src/components/advisory/SystemAssessmentArtifact.tsx`
emits a body of one or more sentences per §5 card depending on
role. The §5 integration adds at most one additional sentence after
the existing facts-phrase sentence, before any auxiliary, headphone,
or active-speaker-specific tail prose. The new sentence is the brand
sentence selected by §4.

**Input to selectBrandSentence:**

| Input | Source |
|---|---|
| `component` | the §5 card's subject component |
| `roleFamily` | result of the existing `roleFamily(component)` helper |
| `hasConflictSignal` | already computed at the parent scope (Phase A B3/B4) — threaded in |
| `isPrimaryConstraint` | derived from the engine's existing primary-constraint flag (Phase A B5) |
| `existingCardProse` | the §5 card body composed up to this insertion point |
| `section` | `'§5'` |

**Output handling:**

- If `result.sentence !== null` → append `' ' + result.sentence` to the
  card body. Sentence terminates with `.` from the data file.
- If `result.sentence === null` → emit nothing. No fallback.

**Role exclusions enforced at integration:**

- `roleFamily === 'auxiliary'` → integration is skipped. (Aux cards
  never receive brand sentences; this matches Phase E-2 / E-2B /
  E-3 discipline.)
- `isHeadphoneSystem(chain)` → integration is skipped for E-5B initial
  rollout. (Headphone brand entries are not in the 23-entry production
  set; deferring headphone identity to a later phase keeps E-5B
  scoped to chains the existing entries cover.)

**Sentence boundaries.** The brand sentence is appended as a free-
standing sentence with leading space and trailing period. It is not
joined with a connective. The §5 card therefore reads as a sequence
of factual sentences, the last of which is brand context.

### 5.2 §8 Why This System Works (`composeWhyThisSystemWorks` /
`composeCoherenceFallback`)

**Where it integrates.** §8's existing keep-recs paragraph (and the
coherence fallback when keep-recs is empty) describes how the
chain's components work together. The §8 integration adds at most one
brand-ecosystem sentence at the end of the existing paragraph, when
and only when:

1. Two or more chain components share the same brand entry (matched
   by `brand` or `brandFamily`), AND
2. The shared entry's gate stack returns a non-null sentence under
   `section: '§8'`, AND
3. The engine has not already triggered the conflict-signal
   suppression that Phase A B3 enforces.

**Brand-selection priority.** When more than one shared-brand cluster
exists (e.g. Naim + Naim in source/amp AND Wilson + Wilson in
speakers — rare), the integration prefers the destination-speaker
brand, then the amplifier brand, then the source brand. This places
the brand-ecosystem sentence on the most user-noticed component
cluster.

**Conflict-signal handling.** The existing Phase A B3 gate already
suppresses §8 keep-recs prose under conflict signal. The brand
integration sits inside that gate — when §8 is suppressed, the brand
integration does not fire. The brand integration does NOT have a
parallel bypass path.

**Sentence boundaries.** Same as §5 — free-standing sentence with
leading space and trailing period.

**Input to selectBrandSentence:**

| Input | Source |
|---|---|
| `component` | the representative component for the shared-brand cluster (typically the destination speaker or the higher-priority component) |
| `roleFamily` | derived from the representative component |
| `hasConflictSignal` | passed in (must be `false` to reach this code path) |
| `isPrimaryConstraint` | typically `false` here; §8 is not the constraint surface |
| `existingCardProse` | the §8 paragraph composed up to this insertion point |
| `section` | `'§8'` |

### 5.3 §10 hierarchy paragraph (`composeUpgradeHierarchy`)

**Where it integrates.** §10's existing hierarchy paragraph identifies
the destination-class speaker and frames the engine's upgrade
direction. The §10 integration adds at most one upgrade-caution
sentence after the existing "treat as a fixed point" sentence, when
and only when:

1. The destination-class speaker matches a brand entry, AND
2. The entry's `upgradeCautions` array is non-empty, AND
3. The gate stack returns a non-null sentence under `section: '§10'`.

**Why the destination speaker.** Per Phase E-4, the destination-class
speaker is the §10 anchor. Brand upgrade cautions on the source or
amplifier are not currently surfaced in §10; they may appear in §5
cards via the §5 integration.

**Conflict-signal handling.** §10 hierarchy is engine-authoritative
voice. The brand caution must not contradict the engine. Under
conflict signal, the gate stack already suppresses (`section: '§10'`
inherits the same Phase A B3 gating used elsewhere).

**Primary-constraint handling.** When the destination speaker is also
the engine's primary constraint, the brand caution may surface only
if it does not contradict the upgrade direction. Implementation: pass
`isPrimaryConstraint: true` to the gate stack; gate #6 will suppress
if applicable.

**Sentence boundaries.** Same as §5 / §8 — free-standing sentence
with leading space and trailing period.

---

## 6. Hard-Gate Mapping (§13.2 ↔ Implementation)

| §13.2 precondition | Implementation locus |
|---|---|
| Commercial hard-gate | Gate #2 (`priority === 'commercial'`) |
| Per-card-one-sentence cap | Caller responsibility — selectBrandSentence is invoked at most once per card; §5/§8/§10 integration code returns immediately after appending |
| No conflict-signal bypass | Gate #5 (medium-under-conflict) + §8/§10 integration sites sit inside the existing Phase A B3 suppression |
| No primary-constraint bypass | Gate #6 (primary-constraint contradiction) |
| Anti-overclaim deny-check | Gate #9 (per-entry + UNIVERSAL_AVOID_OVERCLAIMING) |
| Redundancy suppression | Gate #8 (substring scan against existingCardProse, key-phrase hint table at §4.4) |
| Confidence gating | Gate #3 (low) + Gate #5 (medium under conflict). High surfaces unless other gates fire. |
| No manufacturer-copy passthrough | Architectural — selectBrandSentence chooses from data-file static strings; no string generation |
| Split-tier respect | Enforced at the data layer (matchTokens narrowing per §2.3) — gate stack inherits |
| "System" not "chain" | Editorial discipline already applied in E-5A entry data; no runtime gate needed beyond gate #9 (avoid-overclaim contains brand-name-as-self-evident-referent tokens; "chain" inserted into the UNIVERSAL set would be over-restrictive since chains may use "chain" in signal-path context). E-5B implementation will NOT add "chain" to the universal deny-list; data-file discipline is the answer. |
| Affiliate isolation | Architectural — brand-house-voicing.ts has no dependency on the commerce catalog; the data layer literally cannot read affiliate data |
| Architecture-produces-behavior | Gate #10 (shape check) |

---

## 7. Edge Cases (Enumerated)

### 7.1 Two same-brand components in chain

**Example:** Naim NDX 2 + Naim Supernait 3 + Falcon LS3/5a.

**Expected behavior:**
- §5: Each Naim card may independently receive a brand sentence
  (per-card cap is independent across cards). Subject to redundancy
  suppression on the second card if both candidates share key noun
  phrases.
- §8: One brand-ecosystem sentence appears (chosen from
  `systemBuildingLogic` of the Naim entry). Per-section cap holds.
- §10: Only fires if the destination speaker (Falcon) matches a brand
  entry with non-empty `upgradeCautions`. Falcon is not in the 23 active
  entries; §10 brand caution does not fire in this example.

### 7.2 Split-tier (Klipsch Heritage vs Klipsch RP-600M)

**Expected behavior:**
- Klipsch Heresy IV chain → lookup matches the Klipsch Heritage entry
  (token `'klipsch heresy'`); brand sentence surfaces subject to gate
  stack.
- Klipsch RP-600M chain → lookup returns null (no token matches);
  zero brand prose. Phase E-4 destination protection logic is
  independent and unaffected.

### 7.3 dCS Bartók + Ring DAC already in facts phrase

**Expected behavior:**
- §5 facts-phrase composer outputs "Its Ring DAC architecture
  prioritizes timing precision and quietness..." (existing Phase C
  source-card-depth output).
- Gate stack composes candidate brand sentence; key-phrase scan
  (§4.4) finds "Ring DAC" in `existingCardProse`; gate #8 suppresses.
- Result: no brand sentence on the dCS card. Card reads exactly as
  pre-E-5B.

### 7.4 Conflict-signal chain

**Example:** chain with primary-constraint at speaker + conflict-signal
at amplifier.

**Expected behavior:**
- §5 cards: high-confidence entries still surface (gate #5 only
  suppresses medium); medium entries suppressed.
- §8: existing Phase A B3 already suppresses keep-recs; brand
  integration sits inside that suppression and does not fire.
- §10: hierarchy paragraph still composes; brand upgrade-caution
  surfaces if the destination speaker's entry has non-empty
  `upgradeCautions` AND gate #6 (primary-constraint contradiction)
  does not fire.

### 7.5 Primary-constraint component

**Example:** §10 flags Klipsch Heresy IV as primary constraint
(low SPL ceiling for a large room).

**Expected behavior:**
- Gate #6 evaluates: does the candidate brand sentence contradict
  the engine's upgrade direction (increase SPL / scale)?
- Klipsch Heritage `upgradeCautions[0]`: "Heritage line is distinct
  from Klipsch mass-market…" — this does not contradict an "upgrade
  to a larger speaker" direction; it adds context.
- §10 brand caution surfaces. §5 brand sentence on the Klipsch card
  surfaces unless gate #8 (redundancy with existing horn / high-
  efficiency facts phrase) suppresses it.

### 7.6 Auxiliaries (PSU, clock, network accessory)

**Expected behavior:** §5 integration is skipped entirely for
auxiliary roles (gate at the integration site, not the data layer).
Auxiliaries do not have brand-house-voicing entries in the production
set; even if a future entry had `appliesToRoles: ['auxiliary']`, the
integration site would not call selectBrandSentence on aux cards.

### 7.7 Headphone systems

**Expected behavior:** §5 / §8 / §10 brand integration is skipped for
chains where `isHeadphoneSystem(chain) === true`. No headphone brands
are in the E-5B initial set. A later phase may add headphone identity;
that phase will revise this rule.

### 7.8 KEF Q-series / Focal Chora chain

**Expected behavior:** Per §2.3, KEF and Focal matchTokens are
narrowed to higher tiers. A KEF Q350 chain → lookup returns null; zero
brand prose. A Focal Chora chain → lookup returns null; zero brand
prose. A KEF Blade chain → lookup matches; gate stack runs normally.

### 7.9 Multiple entries' tokens could match

**Expected behavior:** Array order in §2.3 places more-specific tokens
first. Klipsch Heritage's `'klipschorn'` will match before any
hypothetical bare `'klipsch'` entry. The E-5B production set does not
contain overlapping token coverage by construction; a unit test (§8.1)
verifies token uniqueness.

### 7.10 Empty chain / single component chain

**Expected behavior:**
- Empty chain → §5/§8/§10 do not run at all; brand integration is
  trivially skipped.
- Single component chain → §5 may emit a brand sentence on that single
  card; §8 requires ≥2 shared-brand components and so does not fire;
  §10 fires only when a destination speaker is present.

### 7.11 Component name with no brand recognition

**Expected behavior:** lookup returns null; integration emits no
brand sentence. The card reads as pre-E-5B.

### 7.12 Component name that matches multiple commercial entries

**Expected behavior:** array order resolves; gate #2 immediately
suppresses any commercial match. No brand sentence.

### 7.13 Audio Research chain (downgraded to medium) with
non-conflict-signal context

**Expected behavior:**
- Gate #3 (low) does not fire (confidence is medium).
- Gate #5 (medium-under-conflict) does not fire because
  `hasConflictSignal === false`.
- Brand sentence surfaces.

### 7.14 Audio Research chain with conflict signal

**Expected behavior:**
- Gate #5 fires; brand sentence suppressed.
- §10 hierarchy paragraph fires its own caution path; brand
  upgrade-caution is not present (gate #5 applies to §10 too).

### 7.15 Tannoy Definition (non-Prestige modern Tannoy) chain

**Expected behavior:** Per §2.3, Tannoy matchTokens are narrowed to
Prestige + Legacy model names. Tannoy Definition does not match any
of the narrowed tokens. Lookup returns null; zero brand prose.

### 7.16 Composer called with malformed component data

**Expected behavior:** selectBrandSentence returns `null` defensively
(see §4.5). No exception, no log noise at integration sites. The §5
card composes without a brand sentence.

---

## 8. Test Plan (before any source-code change is committed)

The test plan is staged by implementation phase (§9). Each stage's
tests must be authored before that stage's code lands. The Phase
E-5B work is gated on green tests at each stage.

### 8.1 Stage E-5B.1 — Unit tests on the data layer

Co-located with the data layer:
`apps/web/src/lib/__tests__/brand-house-voicing.test.ts`

| # | Test |
|---|---|
| U-1 | `BRAND_HOUSE_VOICING.length === 29` (23 + 6) |
| U-2 | No entry has `matchTokens === ['audio note']` or `'shindo'` (Audio Note + Shindo absence) |
| U-3 | Every entry has `brand`, `matchTokens` (non-empty), `priority`, `confidence`, `commonStrengths` (non-empty), `commonTradeoffs`, `upgradeCautions`, `avoidOverclaiming` (non-empty), `appliesToRoles` (non-empty), `exampleModels` |
| U-4 | Every audiophile-identity entry has `appliesToRoles` length ≥ 1 |
| U-5 | Every commercial entry has `priority === 'commercial'` AND `confidence === 'low'` AND `houseVoicing === undefined` AND `designPhilosophy === undefined` AND `systemBuildingLogic === undefined` |
| U-6 | Token uniqueness — no two entries share the same lowercase matchToken substring at array position 0 |
| U-7 | Confidence calibration — every `high` audiophile-identity entry has at least one of `houseVoicing` / `designPhilosophy` / `systemBuildingLogic` set; every `medium` audiophile-identity entry has at least one set |
| U-8 | `avoidOverclaiming` for every audiophile-identity entry includes at least one phrase containing "endgame", "world class", or "magic" (universal cliché-deny coverage) |
| U-9 | `findBrandHouseVoicing('Naim NDX 2')` returns the Naim entry |
| U-10 | `findBrandHouseVoicing('Klipsch RP-600M')` returns null (token narrowing) |
| U-11 | `findBrandHouseVoicing('KEF Q350')` returns null (KEF tier narrowing) |
| U-12 | `findBrandHouseVoicing('KEF Blade Two Meta')` returns the KEF entry |
| U-13 | `findBrandHouseVoicing('Focal Chora 826')` returns null (Focal tier narrowing) |
| U-14 | `findBrandHouseVoicing('Focal Sopra No. 2')` returns the Focal entry |
| U-15 | `findBrandHouseVoicing('Tannoy Definition DC10')` returns null (Tannoy Prestige/Legacy narrowing) |
| U-16 | `findBrandHouseVoicing('Tannoy Canterbury GR')` returns the Tannoy entry |
| U-17 | `findBrandHouseVoicing('Klipschorn AK6')` returns the Klipsch Heritage entry |
| U-18 | Performance smoke — 1000 lookups complete in < 50ms |

### 8.2 Stage E-5B.2 — §5 integration tests

Co-located with the existing System Assessment Artifact tests:
`apps/web/src/components/advisory/__tests__/system-assessment-artifact-render.test.ts`
(new `describe` blocks; no edits to existing assertions).

| # | Test |
|---|---|
| I5-1 | Naim NDX 2 + Naim Supernait 3 + Falcon LS3/5a → §5 NDX 2 card contains the Naim `houseVoicing` sentence verbatim |
| I5-2 | Same chain → §5 Supernait 3 card also contains the Naim `houseVoicing` sentence (per-card cap is per-card, not per-chain) |
| I5-3 | dCS Bartók + Pass Labs XA25 + Harbeth 30.2 XD → §5 dCS card does NOT contain the dCS `houseVoicing` (Ring DAC redundancy suppression) |
| I5-4 | Same chain → §5 Pass Labs card contains the Pass Labs sentence |
| I5-5 | Klipsch Heresy IV → §5 Heresy card contains the Klipsch Heritage sentence |
| I5-6 | Klipsch RP-600M → §5 RP-600M card contains NO brand sentence (token narrowing) |
| I5-7 | KEF Q350 → §5 card contains NO brand sentence (tier narrowing) |
| I5-8 | KEF Blade → §5 card contains the KEF sentence |
| I5-9 | Audio Research Ref 6SE in a chain with conflict signal → §5 ARC card contains NO brand sentence (medium-under-conflict) |
| I5-10 | Audio Research Ref 6SE in a chain without conflict signal → §5 ARC card contains the ARC sentence |
| I5-11 | Tannoy Canterbury GR → §5 card contains the Tannoy sentence; Tannoy Definition → NO brand sentence |
| I5-12 | WiiM Pro chain → §5 card contains NO brand sentence (commercial hard-gate) |
| I5-13 | Topping D90 + Topping A90 + Magico A3 chain → §5 Topping cards have NO brand sentence; Magico card has its brand sentence |
| I5-14 | Auxiliary card (PSU, clock, network) → NO brand sentence regardless of upstream brand |
| I5-15 | Headphone chain (Focal Utopia headphones + Focal headphone amp) → NO brand sentence on either card (E-5B initial-rollout headphone skip) |
| I5-16 | Adversarial sentence test — patch a brand entry's `houseVoicing` to contain "endgame"; gate #9 suppresses the sentence; card composes without it. (Vitest mock-and-restore pattern.) |
| I5-17 | Empty / single-component chain → no exceptions; cards compose as pre-E-5B |

### 8.3 Stage E-5B.3 — §8 integration tests

| # | Test |
|---|---|
| I8-1 | Naim NDX 2 + Naim Supernait 3 + Falcon LS3/5a → §8 paragraph contains one Naim `systemBuildingLogic` sentence at the end |
| I8-2 | Mixed-brand chain (no two components share a brand) → §8 paragraph contains NO brand-ecosystem sentence |
| I8-3 | Naim source + Naim amp + Naim speaker → §8 paragraph contains exactly one Naim sentence (not three) |
| I8-4 | Conflict-signal chain with Naim source + Naim amp → §8 paragraph is suppressed by Phase A B3; brand-ecosystem sentence does not fire |
| I8-5 | Linn ecosystem chain (LP12 + Klimax DSM + Akubarik) → §8 paragraph contains Linn `systemBuildingLogic` |
| I8-6 | Rega ecosystem chain (Planar 10 + Aethos + RX5) → §8 paragraph contains Rega `systemBuildingLogic` |
| I8-7 | Commercial-only shared brand (Topping D90 + Topping A90 + Wilson Sabrina X) → §8 paragraph contains NO brand-ecosystem sentence (commercial hard-gate on the shared brand) |

### 8.4 Stage E-5B.4 — §10 integration tests

| # | Test |
|---|---|
| I10-1 | Chain with Klipsch Heresy IV as destination → §10 hierarchy paragraph contains the Klipsch Heritage `upgradeCautions[0]` sentence |
| I10-2 | Chain with Wilson Sasha DAW as destination → §10 paragraph contains Wilson upgrade-caution |
| I10-3 | Chain with non-recognized destination speaker → §10 paragraph contains NO brand caution |
| I10-4 | Conflict-signal chain → §10 brand caution suppressed |
| I10-5 | Klipsch Heresy as primary constraint in a chain that wants more SPL → gate #6 evaluation: the Klipsch caution does NOT contradict an "upgrade for SPL" direction; the caution surfaces |
| I10-6 | Hypothetical: brand caution that contradicts upgrade direction → gate #6 suppresses. (This test requires a constructed fixture where the engine flags the destination speaker as primary constraint AND the brand `upgradeCautions[0]` would imply "stay with the current speaker." For E-5B Stage 4 we author the negative case as a guard test even if no current entry triggers it organically.) |

### 8.5 Stage E-5B.5 — Per-fixture acceptance

| # | Test |
|---|---|
| A-1 | Phase K reference chain (Pontus II / Leben / DeVore) → rendered output is byte-equivalent for the low-confidence path. The Leben entry is medium, so a single Leben brand sentence appears on the Leben card; the rest of the artifact is unchanged. |
| A-2 | 36-fixture pool → bulk-rerender with E-5B flag on; per-fixture audit confirms (a) no commercial-entry chain receives a brand sentence; (b) no chain has more than one brand sentence per card; (c) no chain has competing brand sentences in §8; (d) no §5 card contains the `existingCardProse` redundancy keys back-to-back |
| A-3 | 28-fixture real-world pool → bulk-rerender with E-5B flag on; per-fixture audit confirms credibility under expert-owner reading |
| A-4 | 4 headphone fixtures → bulk-rerender; no brand sentence on any headphone or headphone-amp card |
| A-5 | Diff audit — for every fixture where E-5B output differs from pre-E-5B output, the diff is exactly one or more single-sentence additions; no existing sentence is modified |

### 8.6 Regression suite

The existing 383 focused tests must remain green at every stage.
Any modification to existing assertions during E-5B is a stop-and-
report event; the work is additive only.

---

## 9. Phased Rollout

Each stage is a separate commit with its own focused-test bundle.
Each stage's bundle must be green before the next stage begins. No
stage promotes to Production.

### Stage E-5B.1 — Data layer + lookup helper + unit tests

- Create `apps/web/src/lib/brand-house-voicing.ts` with the production
  data (transfer from E-5A §3 per §2.3) plus the `findBrandHouseVoicing`
  helper and the `UNIVERSAL_AVOID_OVERCLAIMING` constant.
- Create `apps/web/src/lib/__tests__/brand-house-voicing.test.ts`
  containing the §8.1 unit tests.
- No composer wiring. The data layer is unused by any other module
  at this stage.
- Existing 383 tests remain green.
- Commit message: `feat(advisory): hardening E-5B.1 — brand-house-voicing data layer + lookup helper (no composer wiring)`.

### Stage E-5B.2 — §5 integration

- Add the `selectBrandSentence` gate-stack function. Hosted alongside
  the data layer or in a sibling module — implementation detail.
- Wire §5 integration into `composeContributionBody`. The integration
  is behind a feature flag (see §11). Flag OFF → byte-equivalent
  rendering to pre-E-5B. Flag ON → brand sentence appended per §5.1.
- Add the §8.2 integration tests.
- Existing 383 tests remain green (flag-OFF path is the default in test
  configuration).
- Commit message: `feat(advisory): hardening E-5B.2 — §5 brand house voicing integration (flag-gated)`.

### Stage E-5B.3 — §8 integration

- Wire §8 integration into `composeWhyThisSystemWorks` and
  `composeCoherenceFallback` per §5.2. Behind the same feature flag.
- Add the §8.3 integration tests.
- Existing 383 tests + Stage 2 tests remain green.
- Commit message: `feat(advisory): hardening E-5B.3 — §8 brand ecosystem integration`.

### Stage E-5B.4 — §10 integration

- Wire §10 integration into `composeUpgradeHierarchy` per §5.3.
- Add the §10 integration tests.
- All prior tests remain green.
- Commit message: `feat(advisory): hardening E-5B.4 — §10 brand upgrade-caution integration`.

### Stage E-5B.5 — Full fixture validation + Preview verification

- Run the §8.5 per-fixture acceptance tests against all three fixture
  pools.
- Run the Preview-deploy verification: feature flag on for Preview /
  version-b only.
- Author the post-E-5B real-world re-render report.
- Commit message: `chore(advisory): hardening E-5B.5 — full-fixture validation + preview verification`.

No Stage advances to the next until its tests are green AND the
prior 383+new tests are green.

---

## 10. Acceptance Criteria for Each Stage

| Stage | Acceptance |
|---|---|
| E-5B.1 | (a) data layer compiles; (b) §8.1 unit tests pass (18 tests); (c) existing 383 tests pass; (d) data layer is not imported anywhere outside its own tests |
| E-5B.2 | (a) §8.2 tests pass (17 tests); (b) flag-OFF rendering is byte-equivalent to pre-E-5B for Phase K, 36-fixture, 28-fixture pools (regression diff = 0); (c) existing 383 tests pass |
| E-5B.3 | (a) §8.3 tests pass (7 tests); (b) flag-OFF byte-equivalent maintained; (c) Stage 2 tests pass; (d) existing 383 tests pass |
| E-5B.4 | (a) §8.4 tests pass (6 tests); (b) flag-OFF byte-equivalent maintained; (c) Stages 2-3 tests pass; (d) existing 383 tests pass |
| E-5B.5 | (a) §8.5 acceptance tests pass; (b) 28-fixture real-world audit reads credibly under expert-owner review; (c) Preview deploy renders correctly with flag on; (d) editorial sign-off on the 23 entry surfacing in real chains |

---

## 11. Feature Flag and Promotion Discipline

- New flag: `NEXT_PUBLIC_BRAND_HOUSE_VOICING`. Scope: Preview only,
  version-b only. Defaults to OFF.
- The flag gates all three integration sites (§5, §8, §10). When OFF,
  the integration sites short-circuit before calling the gate stack;
  rendering is byte-equivalent to pre-E-5B.
- The flag does NOT gate the data layer or the lookup helper. Those
  remain importable and testable regardless of flag state.
- No Production promotion until §10 acceptance is met AND editorial
  sign-off is recorded AND the §13.4 preconditions are checked.
- Promotion to Production is a separate commit, not part of E-5B.5.

---

## 12. Open Questions / Decisions to Resolve Before Stage E-5B.1

The following items are not blockers but should be answered before
Stage E-5B.1 begins so implementation does not need to revisit them
mid-flight:

1. **Gate #6 (primary-constraint contradiction) implementation
   detail.** The conservative default proposed in §4.2 (suppress
   when speaker role + isPrimaryConstraint) is safe but may
   over-suppress. Alternative: introduce a per-entry
   `contradictionPatterns: readonly string[]` field listing
   upgrade-direction phrases that the caution must not contradict.
   Resolution: defer to Stage E-5B.4 once §10 integration is wired
   and observed against fixtures.
2. **Gate #10 (shape check) vocabulary list.** The list proposed in
   §4.2 is editorially-stable and covers every active entry's
   houseVoicing / designPhilosophy. Growing the list requires
   re-review of any new vocabulary. Resolution: lock the proposed
   list at Stage E-5B.1; future additions are stop-and-report.
3. **§4.4 redundancy key-phrase hint table.** Implementation detail,
   private to the module. Resolution: lock the proposed table at
   Stage E-5B.1; updates are routine maintenance, not editorial
   review.
4. **Headphone-system skip.** Per §5.1 and §7.7, the E-5B initial
   rollout skips headphone chains entirely. A future headphone-brand
   addition (Focal Utopia headphones, Sennheiser HD-series, ZMF
   Auteur, etc.) is out of scope for E-5B and will be a separate
   phase. Resolution: documented as a known scope boundary; not a
   blocker.
5. **Tannoy matchToken narrowing depth.** §2.3 proposes
   `['tannoy prestige', 'tannoy legacy', 'canterbury',
   'westminster', 'kensington', 'turnberry', 'cheviot', 'arden',
   'eaton', 'glenair', 'stirling']`. The narrowing relies on
   model-name distinctiveness; "Stirling" and "Eaton" are also
   common surnames and could theoretically collide with a hypothetical
   non-Tannoy component named "Stirling Audio Eaton." No current
   catalog component exposes this collision. Resolution: accept the
   token list; add a unit test verifying no production component
   name produces an unintended match.
6. **§8 brand-cluster selection priority.** §5.2 proposes destination
   speaker → amplifier → source. Alternative: surface the entry whose
   `confidence` is highest among the shared-brand cluster. Resolution:
   use the role-priority approach for E-5B initial; revisit if
   real-world fixtures show consistent mis-selection.

---

## 13. Risk Matrix

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Data-extraction transcription error from E-5A §3 into TypeScript | Medium | Medium | §8.1 unit tests assert field presence and content invariants; manual diff against E-5A §3 during Stage E-5B.1 PR review |
| Token-narrowing miss (KEF / Focal / Tannoy) lets identity prose surface on excluded tier | Medium | High | §8.1 unit tests U-10 through U-17 explicitly assert tier-narrowing behavior; §8.2 tests I5-6, I5-7, I5-13 cover render-time |
| Gate stack order regression — a future refactor reorders early-returns and breaks suppression | Low | High | Each gate's suppression has a dedicated integration test that constructs the precondition; reordering breaks the test |
| Redundancy key-phrase hint table goes stale as E-5A entries are edited | Medium | Low | Hint table is private; future editorial revisions to E-5A trigger a hint-table review checklist item |
| Universal cliché-deny vocabulary collision with legitimate component name | Low | Low | "cult," "magic," "endgame" are not component-name vocabulary in any current catalog; integration tests verify no false positive |
| Phase A B3/B4/B5 gates regress and brand layer fires under conflict signal | Low | High | Existing 383 tests cover B3/B4/B5; if they regress, brand integration tests also fail; defense-in-depth via gate #5 + integration-site gating |
| Feature flag accidentally promoted to Production | Low | Medium | Promotion to Production is a separate explicit commit, not part of E-5B.5; Vercel env-var scoping is verified at deploy |
| Composer surfaces brand sentence on auxiliary card despite role-skip | Low | High | Integration-site role guard (§5.1) + selectBrandSentence gate #4; both must fail for the bug to land. §8.2 test I5-14 covers |
| Headphone-chain brand surfacing leaks before headphone phase | Low | Medium | Integration-site `isHeadphoneSystem` guard (§5.1) + no headphone brand in production set; §8.2 test I5-15 covers |
| Tannoy matchToken "Stirling" / "Eaton" collides with a future non-Tannoy component | Low | Low | §12 open question 5; unit test guards against current catalog; flagged for re-check on catalog additions |
| §10 brand caution surfaces against engine upgrade direction on a constructed edge case | Low | High | §8.4 test I10-6 is the explicit guard; conservative default in gate #6 |
| Performance regression at scale | Very Low | Low | §8.1 test U-18 verifies <50ms / 1000 lookups; gate stack is pure and short |

---

## 14. Dependencies (Code Surfaces Touched by E-5B Implementation)

### 14.1 Read-only dependencies (E-5B reads from these; does not modify)

- `apps/web/src/components/advisory/SystemAssessmentArtifact.tsx` —
  the composer file. E-5B inserts new call sites in
  `composeContributionBody`, `composeWhyThisSystemWorks`,
  `composeCoherenceFallback`, `composeUpgradeHierarchy`. Existing
  helpers (`roleFamily`, `isAuxiliary`, `isHeadphoneSystem`,
  `isDestinationSpeaker`, `getSignalPathNeighbours`, `splitSentences`,
  `hasConflictSignal`) are consumed unchanged.
- The Phase A B3/B4/B5 conflict-signal and primary-constraint flags as
  threaded into the composer. E-5B threads them into selectBrandSentence
  without altering their derivation.
- The Phase E-4 destination-speaker model allowlist. E-5B reads it via
  `isDestinationSpeaker` for §10 integration.

### 14.2 New surfaces created by E-5B

- `apps/web/src/lib/brand-house-voicing.ts` — production data + lookup
  helper + UNIVERSAL_AVOID_OVERCLAIMING.
- `apps/web/src/lib/brand-house-voicing-gates.ts` (recommended; may be
  inlined with the data file) — the `selectBrandSentence` gate stack.
  Implementation detail.
- `apps/web/src/lib/__tests__/brand-house-voicing.test.ts` — unit tests.
- Feature flag constant in the existing flag module (additive; does not
  modify other flags' semantics).

### 14.3 Surfaces NOT touched

- The Brand Authority layer (`apps/web/src/lib/brand-authority/*`,
  brand profiles, BrandAuthorityPreview component). Brand house voicing
  is a separate concern.
- The MemoFormat layer.
- The advisory routing (`apps/web/src/lib/consultation.ts` advisory
  builder paths).
- The signals dictionary or rules engine in `packages/signals/` and
  `packages/rules/`.
- The catalog data in `packages/data/components.yaml` and
  `reference-systems.yaml`.

---

## 15. Editorial Discipline Carried Into Implementation

Three discipline items from E-5A do not require code but must be
respected during implementation:

1. **Selection-only, not generation.** When implementing
   `selectBrandSentence`, the implementer must never insert connective
   words, modifiers, or any text that is not present in the source data
   string. The function returns the chosen field verbatim. This is the
   architectural answer to the "no manufacturer-copy passthrough" gate.

2. **Suppression is final.** When any gate fires, the function returns
   null. It does not retry with an alternative field. The §13.2 rule is
   "anti-overclaim deny-check … any match causes the sentence to be
   suppressed (not retried — suppression is the safe default)." This is
   binding on Gate #6, #8, #9, and #10.

3. **The composer is not allowed to apologize.** When brand surfacing
   is suppressed, the §5 / §8 / §10 sections compose as if the brand
   layer were not present. The composer must not emit "no brand
   guidance available" or any equivalent. Silence is the correct UX.

---

## 16. Recommendation

Proceed to Stage E-5B.1 (data layer + lookup helper + unit tests).

The design above is fully scoped, every hard gate has an implementation
locus, every edge case has an expected behavior, and the test plan is
authored ahead of code per the §13 precondition. The phased rollout
isolates risk per stage; the feature flag isolates Production from
work-in-progress.

Stage E-5B.1 is small (single new file + tests; no composer changes;
383 baseline tests unaffected). It is the correct first commit and
should be the next concrete unit of work.

The §13 editorial-review precondition (project-owner sign-off on the
23 active entries) is the only non-implementation item that should be
checked in parallel with Stage E-5B.1. The §13 implementation-gate
preconditions are otherwise satisfied by this design.

---

*End of Phase E-5B implementation design. No code is written. This
file is documentation-only. Stage E-5B.1 may begin once §12 open
questions 1–6 are resolved (most by default per their proposed
resolutions) and the §13.4 editorial-review sign-off is recorded.*
