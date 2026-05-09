# Audio XX — Onboarding & Handoff Package

A curated entry layer for someone joining the project as a technical collaborator, steward, advisor, or engineering lead. The package is intended to be readable cold, without prior conversation history, and is suitable for selective sharing through GitHub or Google Drive.

---

## Intended audience

- A prospective technical collaborator considering contribution
- A technical steward taking on operational responsibility
- A programmer friend reviewing the project as a favour
- A future engineering lead evaluating fit
- A trusted advisor offering perspective
- A non-technical operator or stakeholder who needs shared understanding with the engineers above

The package is calibrated for two audiences at once: technically credible for engineers, and conceptually clear for a highly engaged operator who is not a full-time software engineer. Where a technical term first appears it is briefly explained; where a section dives into implementation detail it is preceded by a plain-language framing that names what the section is *for*.

If you are an engineer, you can skim the framings and focus on the specifics. If you are an operator, the framings carry most of what you need; the specifics are reference material you do not need to memorise.

---

## What this package is

- A concise, externally shareable orientation layer
- A curated set of pointers into the deeper repository documentation
- An honest snapshot of current state, strengths, and limitations
- A practical list of next steps and collaboration expectations

## What this package is not

- Not investor or fundraising material
- Not marketing copy or a product pitch
- Not a comprehensive technical manual (that lives in [`/docs`](../docs/))
- Not internal operational documentation
- Not a substitute for reading the source code, for an engineer who plans to contribute

For deeper material, follow the cross-references in each document into the main `/docs` directory.

---

## Recommended reading order

| Order | Document | Approximate reading time | Best for |
|---|---|---|---|
| 1 | [`AUDIO_XX_OVERVIEW.md`](AUDIO_XX_OVERVIEW.md) | 10 min | Both audiences |
| 2 | [`CURRENT_STATE_SUMMARY.md`](CURRENT_STATE_SUMMARY.md) | 10 min | Both audiences |
| 3 | [`SYSTEM_ARCHITECTURE_SUMMARY.md`](SYSTEM_ARCHITECTURE_SUMMARY.md) | 15 min | Engineers in detail; operators for the conceptual framings |
| 4 | [`COLLABORATION_MODEL.md`](COLLABORATION_MODEL.md) | 10 min | Both audiences |
| 5 | [`NEXT_STEPS.md`](NEXT_STEPS.md) | 10 min | Both audiences |
| 6 | [`GOOGLE_DRIVE_EXPORT_GUIDE.md`](GOOGLE_DRIVE_EXPORT_GUIDE.md) | 5 min | Project author and operator |
| 7 | [`SCREENSHOTS/README.md`](SCREENSHOTS/README.md) | 5 min | Anyone preparing visual material |

**Total reading time: approximately one hour.**

After this hour, a reader should have a sufficient mental model to ask informed questions, evaluate fit, and decide whether deeper engagement is appropriate.

---

## Where to go next

After reading this package, the natural next steps depend on the reader's intent and role:

- **To run the project locally** (engineer): [`/docs/SETUP.md`](../docs/SETUP.md)
- **To understand the architecture in depth** (engineer): [`/docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)
- **To understand the product philosophy** (anyone): [`/docs/PRODUCT_PHILOSOPHY.md`](../docs/PRODUCT_PHILOSOPHY.md)
- **To understand the deployment model** (engineer): [`/docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md)
- **To understand how quality is verified** (anyone): [`/docs/QA.md`](../docs/QA.md)
- **To see the canonical behavioural specification** (anyone): [`/CLAUDE.md`](../CLAUDE.md)

The package above is the *entry layer*. The `/docs` directory is the *operational layer*. The `/CLAUDE.md` file is the *specification layer*.

---

## A note on tone

This package is written in a calm, restrained, technically credible register. It avoids hype, marketing language, and exaggerated claims. It documents current reality honestly, including limitations and unresolved questions.

If a reader is looking for an enthusiastic startup pitch, this is the wrong document. If a reader is looking for a sober technical orientation that is comprehensible to both engineers and engaged operators, the documents that follow are intended to provide exactly that.
