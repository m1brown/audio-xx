# Assessment as artifact — product requirement

**Status:** recorded 2026-08-17. NOT implemented. Sits after the evidence work.

## The requirement

The System Assessment must be designed as something a listener can print, save
as PDF, and share — not a browser page that happens to support
`window.print()`. The current print output is the evidence: browser
headers/footers, accidental pagination and whitespace, five-page sprawl, and no
intentional opening or close.

**One canonical editorial artifact, three delivery modes:**

| Mode | What it is |
|---|---|
| **Web** | the primary interactive assessment |
| **Share** | a persistent read-only URL showing the assessment without exposing the listener's workspace or conversation |
| **Print / PDF** | a deliberately typeset document derived from the same assessment |

**One assessment architecture, one evidence payload.** There must not be a
separate "PDF assessment" content model. Three renderings of one artifact.

The print expression preserves the Audio XX visual language and carries:
intentional pagination, component recognition and images where licensed,
verdict, analysis, evidence/provenance, resources, date and system identity,
and restrained Audio XX attribution. Browser chrome disappears.

Design target roughly 2–3 well-composed pages for an ordinary assessment —
**not achieved by deleting licensed analysis.** If an assessment earns more
pages, it gets them.

**Shareability is a distribution capability, not a UI control.** A recipient
must be able to understand both the assessment and Audio XX without signing in
and without seeing the owner's private workspace.

## Where it belongs architecturally

This lands naturally on the convergence work already scoped and deferred: one
assessment → one shared structured payload → one renderer → sections appear
according to licensed evidence depth. Share and Print become two more consumers
of that payload rather than two more content models.

Prerequisites, in order:

1. **The shared findings/payload contract** — extracted from what the existing
   renderer already consumes. Not a second model.
2. **Evidence-gated sections** — missing evidence removes a section rather than
   filling it with hedged prose. This is what makes 2–3 pages achievable
   honestly: the page is short because the evidence is thin, not because
   analysis was cut.
3. **Share** needs a persistence and access model — a stable assessment id,
   read-only projection, and an explicit decision about what a recipient sees.
   That is a product and privacy decision, not a rendering one, and it should
   be taken deliberately.
4. **Print** is then a stylesheet and pagination pass over the same payload.

Related and already recorded: `docs/typography-recommendation-2026-08-17.md`
(superseded in scope — see below), the F4 image position (0/4 for the beta
system; corroboration proves a page exists and grants nothing about the
photograph on it), and `docs/manufacturer-fact-spec-v1.md`.
