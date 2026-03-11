# Audio XX

A listener-driven suggestion engine for thoughtful hi-fi system building.

## Philosophy

Audio XX is built on three core principles:

### Listener-First
User listening impressions and constraints drive the system. Specs, rankings, and popularity never override listener context. The system reasons about what *you* hear, not what a reviewer measured.

### Trait-First Reasoning
The system reasons in terms of listening traits (flow, clarity, composure, dynamics, etc.) and trade-offs. Components are levers that move traits — they are not the object of reasoning.

### Regression-Aware Guidance
The system prioritizes protecting existing strengths. It avoids changes that risk degrading traits the listener already values. "Do nothing" is a valid and sometimes correct outcome. Maximum 1–2 suggestions per evaluation. Always includes trade-offs, risks, and a controlled next step.

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Setup

```bash
npm install
cd apps/web
npx prisma generate
npx prisma db push
npm run db:seed
cd ../..
npm run dev
```

The app runs at `http://localhost:3000`. New accounts are created automatically on first sign-in.

---

## Rule Editing Guide

Rules are stored in `packages/rules/rules.yaml`. Each rule has:

```yaml
- id: unique-rule-id
  label: Human-readable label
  priority: 10          # Lower = higher priority
  conditions:
    symptoms_present:     # All must be present
      - symptom_name
    symptoms_present_any: # At least one must be present
      - symptom_a
      - symptom_b
    symptoms_absent:      # None may be present
      - symptom_c
    traits:               # Trait direction requirements
      fatigue_risk: up
    archetypes_include:   # User must have these archetypes
      - engagement
    has_improvement_signals: true  # Boolean
    archetype_conflict: true      # Boolean
  outputs:
    explanation: >
      Prose explanation of what the system inferred.
    suggestions:
      - Maximum 1-2 suggestions
    risks:
      - Trade-off or risk description
    next_step: >
      A reversible, practical next step.
    verdict: no_purchase_recommended  # Optional
    archetype_note: >                 # Optional
      Note for specific archetypes.
```

To add a new rule, add a YAML entry to the `rules` array. No code changes required. The rule engine loads rules at evaluation time.

---

## Signal Dictionary Guide

The signal dictionary maps listener phrases to trait signals. It is stored in `packages/signals/signals.yaml`.

Each entry maps trigger phrases to trait directions and symptom labels:

```yaml
- phrases:
    - bright
    - harsh
    - sibilant
  signals:
    fatigue_risk: up
    glare_risk: up
  symptom: brightness_harshness
  archetype_hint: composure   # Optional
```

**Uncertainty markers** are also defined in this file. When free text contains markers like "maybe", "not sure", or "I think", the system increases conservatism — narrower suggestions, stronger preference for "do nothing."

To add a new phrase mapping, add an entry to the `signals` array. No code changes required.

---

## Seed Data Guide

Component seed data is in `packages/data/components.yaml`. Each component entry includes:

- `id`: Unique identifier
- `name`, `brand`, `category`: Basic info
- `confidence_level`: high, medium-high, medium, or low
- `role_confidence`: For multi-function components (e.g., `{ dac: high, preamp: low }`)
- `trait_tendencies`: Map of trait → qualitative value (strong, moderate, slight, neutral, slight-risk, moderate-risk)
- `risk_flags`: Array of known risks
- `trusted_references`: Sources of knowledge about this component
- `reviews`: Contextual only — reviews inform explanations, they do not decide outcomes
- `is_reference`: Whether this is a reference component (non-commercial)
- `user_submitted`: Whether this was entered by a user

To add a new seed component, add a YAML entry. Run `npm run db:seed` to load it into the database.

Reference systems are in `packages/data/reference-systems.yaml`. These are non-commercial anchors used to explain listening trade-offs, not to sell products.

---

## Reference System Transparency

Some reference systems use equipment that is no longer made or not sold through commercial partners. These systems are included to explain listening trade-offs, not to sell products.

Reference systems are clearly distinguished from commercial suggestions:
- "Reference system (non-commercial)"
- "Shares some traits with" — never "This is the same as"
- "Moves the system in a similar direction"
- "Captures part of the same behavior"

---

## Affiliate and Outbound Links Policy

Audio XX may include outbound or affiliate links to help users explore availability of suggested components. These links do not influence suggestions or evaluations.

Suggestions are generated independently of retailers, pricing, or affiliate relationships. In many cases, Audio XX may recommend delaying a purchase or making no purchase at all.

Evaluations of used-market listings or user-submitted components are not monetized.

---

## Architecture

```
/apps/web               ← Next.js frontend + API routes
/packages/rules         ← Rule engine logic + rules.yaml
/packages/data          ← Seed components + reference systems YAML
/packages/signals       ← Signal dictionary YAML + phrase-to-trait mapping
```

### Data Flow

1. User enters free text describing listening impressions
2. Signal processor maps phrases → trait signals, symptoms, archetype hints
3. Rule engine evaluates symptoms + traits + archetypes against YAML rules
4. Matching rules produce explanations, suggestions (max 2), risks, and next steps
5. Result is saved as a preference snapshot and displayed with full transparency

### Key Constraints

- Deterministic: no ML, no hidden embeddings
- Maximum 1–2 suggestions per evaluation
- "No purchase recommended" is a first-class output
- Reviews inform explanations; they never decide outcomes
- Archetype conflicts are surfaced, never silently resolved

### Multi-System Support

Each user has one listener profile and can define multiple audio systems.
A system represents a physical setup — a speaker rig in a living room, a
headphone desk, an office system — and consists of named components with
brand, category, and optional role metadata.

**Data model:**

- **One listener profile per user** (stored in the `Profile` table).
  Contains listening preferences, room context, archetype signals, and a
  reference to the currently active system.
- **Multiple systems per user** (stored in the `System` table via
  `User.systems`). Each system carries a name, location, primary use,
  tendencies summary, and a component list via the `SystemComponent`
  junction table.
- **`active_system_id`** on the listener profile selects which system
  the advisory engine operates against. Nullable — having no active
  system is a valid state.

**Advisory flow:**

The active system is resolved once per submit using
`resolveActiveSystemContext()` and optionally converted into a
`SystemProfile` via `activeSystemToProfile()`. Advisory builders and the
reasoning pipeline receive this context as an optional parameter.
When present, the active system seeds component context, informs chain
interaction analysis, and provides a baseline for system diagnosis.
When absent, builders fall back to conversation-derived context.

**Guest support:**

Unauthenticated users work with a single draft system persisted to
`sessionStorage`. It participates in advisory flows identically to a
saved system. On sign-in, saved systems load from the backend; the
draft is preserved until explicitly promoted or cleared.

**Conversation extraction:**

When a user describes owned gear in conversation ("I have a…", "my
system is…"), the engine detects the description and offers to save it
as a new system. Detection is conservative — it requires ownership
language, rejects comparison and shopping patterns, requires at least
two recognized components, and suppresses duplicates of the active
system via fingerprint overlap.

---

## Testing

```bash
npm test
```

Tests cover:
- Low-volume listener warnings and prioritization
- Reference system non-commercial framing
- "No purchase recommended" output
- Archetype conflict explicit trade-off language
- Uncertainty marker conservatism
- Free text affecting inferred traits and rule outcomes
- Rule output constraints (max suggestions, required risks/next steps)
