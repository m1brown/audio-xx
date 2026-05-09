# Audio XX — Overview

A short, candid description of the project for a reader encountering it for the first time. Readable without prior technical context.

---

## In one paragraph

Audio XX is a web-based advisor for hi-fi listeners. Instead of producing a ranked list of products, it helps a listener clarify what they value in their listening, evaluates how their existing equipment interacts as a system, and surfaces directional options with explicit trade-offs — including the option of doing nothing. It is built as a calm, restrained tool for thoughtful decisions, not a recommendation engine in the conventional sense.

---

## What Audio XX is

A system-level audio advisor delivered as a web application. A listener can:

- Describe what they hear and what they value
- Save the components of their current system
- Ask for an evaluation, a comparison, or a directional suggestion
- Receive a structured response that names trade-offs and respects their existing system

The reasoning order is fixed: the listener's existing system comes first, then their preferences, then directional options, then optionally illustrative product examples. Products come last in the pipeline. This is unusual among tools in the category and is deliberate.

It is not a recommendation engine. It is not a store. It is not a forum. It is not a benchmarking tool.

---

## What problem it addresses

The hi-fi hobby has more information than orientation. A listener encountering recommendations from forums, magazines, and reviewers is often offered specific products without a framework for evaluating whether those products would suit their existing system, listening priorities, room context, or stage in the hobby.

The frequent result is purchases that compound rather than resolve listening preferences, or upgrades that erase strengths the listener already valued.

Audio XX is built to support orientation:

- Mirroring a listener's stated preferences into a structured trait framework
- Translating preferences into engineering principles (timing, density, control, spatiality)
- Evaluating candidate components against the listener's current system as a chain
- Surfacing trade-offs explicitly, including the trade-offs of doing nothing

The intended outcome is intentional decisions, not more purchases.

---

## What makes it different

A handful of properties distinguish the system from other audio recommendation tools.

**System-aware reasoning.** The listener's existing chain of equipment is a primary input to advisory output. The system asks, in effect, "would this candidate improve the chain you already have, or compound a tendency you already wanted to soften?" Most other tools evaluate products in isolation and leave that comparison to the listener.

**Curated knowledge model.** The catalog is hand-maintained. Each entry carries calibrated trait positions on four sonic axes, descriptions, and source-attributed citations. There is no community voting, no scraped review aggregation, no popularity ranking. The credibility surface is depth and care, not breadth and noise. Today the catalog covers approximately 127 reference components with deeper treatment.

**Trade-off discipline.** Every concrete suggestion names what it costs as well as what it gains. This is enforced by structure — the advisory output schema (the format every response is built into) includes a mandatory trade-off field. The renderer (the part of the application that draws the response on screen) surfaces it visibly.

**Restraint as a first-class outcome.** "Do nothing" is treated as a legitimate path, not a fallback. When the system assesses a listener's setup as near-equilibrium, the response says so. This is documented in the project's behavioural specification and reflected in the actual advisory output.

**Anti-ranking posture.** No numeric scores. No "best" framing. No urgency or limited-time language. Comparisons are between two or three options at a time, with trade-offs between each, rather than a ranked list.

**Calibrated confidence.** Output language strength matches source quality. When the underlying data is thin, the response hedges. When information is genuinely missing, the system surfaces what is missing rather than fabricating a recommendation.

---

## Why these properties matter

### Why system-aware reasoning matters

A component that improves one system can degrade another. A clarity-focused source can sharpen one chain and fatigue another. A warm tube preamplifier can resolve one system's leanness and bloat another's bass. Evaluating components in isolation — the dominant pattern across reviewers and recommendation sites — strips the listener of the context that determines whether a change will help or hurt. Audio XX treats the listener's existing chain as a primary input.

### Why preference-aware reasoning matters

Listener preferences are not interchangeable. A listener who values flow and harmonic density has different needs from one who values transient precision and spatial separation. The four-axis sonic trait framework (Warm↔Bright, Smooth↔Detailed, Elastic↔Controlled, Airy↔Closed) provides structured language for these distinctions. Translating preferences into traits, then traits into engineering principles, gives recommendations grounding in the listener's actual values rather than generic hierarchies.

### Why trade-off discipline matters

A recommendation without a named trade-off is functionally a sales pitch. It signals "this will improve things" without acknowledging what improvement costs. Over time, a listener following such recommendations accumulates components optimised for short-term impressiveness and ends with a system that exhausts rather than engages. Trade-off discipline is the simplest mechanism for keeping recommendation tools honest.

### Why "do nothing" matters

The audio hobby has built-in upgrade pressure. New product cycles, magazine review schedules, and forum culture all incentivise constant change. A tool that recommends action because the user opened the tool — regardless of whether action is warranted — reinforces this pressure. Audio XX is structured to push back gently: when the system is near equilibrium, when symptoms do not point to a specific cause, when a proposed change is preference shift rather than improvement, the response says so.

---

## Current maturity level

The project is in active pre-public-beta development.

- The reasoning core is production-quality and is the source of truth on the advisory path
- The visible product is at a level that does not read as a prototype
- A curated catalog drives advisory output for in-catalog queries
- The project has not yet been shared publicly; the current shareable state is a friends-shareable preview environment

The project is not yet at journalist-readiness or public-launch tier.

---

## Current capabilities

What works well today:

- Substantive advisory responses for queries within the catalog (for example: "best DAC under $1500", system assessments, brand questions)
- Comparison flow between two named products with axis positions and trade-offs
- Saved-system support for authenticated users; draft systems for guest users
- Restraint-aware output that surfaces "do nothing" appropriately
- Source-attributed citations on review-backed claims
- A workspace layout that maintains listener and system context across the conversation

---

## Current limitations

Areas where current capability is incomplete or uneven:

- **Unknown products produce empty responses.** A planned overlay would handle these gracefully; until shipped, queries about non-catalog products hit a blank wall.
- **Follow-up continuity has a known gap.** Context-enriching follow-ups (such as "I have a tube amp" sent after a previous query) can occasionally produce a duplicate of the prior advisory output.
- **Non-advisory intents can force-route into advisory framing.** Practical requests outside the audio domain are not yet declined cleanly.
- **No live language-model call in the production reasoning path.** Scaffolding exists; the runtime call is not wired. The system is fully deterministic today.
- **Conversation messages do not persist across navigation.** Moving away from the home page and returning resets the in-progress conversation.
- **Mobile experience is functional but not formally walked.** Below 1024 pixels of screen width, the workspace's side rails are hidden and the main column reflows; deeper mobile review has not been completed.

---

## Near-term direction

Three concurrent themes shape the near-term work:

1. **Beta hardening.** Resolving the conversation-continuity gap, the unknown-product gap, and the non-advisory force-routing gap. These are the items that would end a demo for an external reviewer.
2. **Quality-assurance automation.** Building tests that confirm the reasoning behaves correctly across a curated set of canonical questions, locking calibrated-confidence semantics, and adding at least one end-to-end automated test path.
3. **Operational readiness.** Documentation alignment with current code state, link and image audits, deployment verification, and the foundation work required before considering a public preview.

A more detailed roadmap is in the project's onboarding package.

---

## What this project is not trying to be

Worth naming explicitly:

- Not a voice assistant or chatbot
- Not a configurator that produces complete-system bills of materials
- Not a price-comparison or deal-discovery tool
- Not a community platform or review aggregator
- Not a benchmarking instrument or measurement-driven evaluator
- Not an artificial-intelligence demonstration

The project is narrowly scoped: a system-level advisor with a curated knowledge model and a deterministic reasoning core, presenting in a restrained editorial tone. The value comes from depth and discipline within that scope, not from breadth across adjacent categories.

---

*Canonical source: GitHub repo, `handoff/` folder.*
