# ChatGPT Baselines — Reviewer Benchmark · Phase C

This directory holds **manually curated ChatGPT response captures** that serve as
qualitative comparison anchors for the reviewer benchmark cases.

Audio XX's deterministic narrative composer is the system under evaluation.
Strong ChatGPT output (GPT-4 / GPT-4o / GPT-5 family, used directly via the
ChatGPT web interface or API) is the calibration target on interpretive,
experiential, and human-readable axes.

These files are **not** parsed for any production code path. They are
adapter-layer fixtures consumed only by `apps/web/scripts/generate-parity.ts`
to produce side-by-side `parity.md` artifacts in
`apps/web/reviewer-benchmark/<case-id>/`.

## File format

Each baseline is a Markdown file at:

```
apps/web/src/tests/fixtures/chatgpt-baselines/<case-id>.md
```

Filename = the BenchmarkCase `id`. The file MUST have two parts: a YAML-ish
front-matter metadata block (between `---` markers) and the verbatim ChatGPT
response body.

```md
---
case_id: my-system
captured_at: 2026-05-14
chatgpt_version: GPT-4o (web, custom instructions: none)
prompt_used: "Assess my system: Eversolo DMP-A6, Chord Hugo, JOB Integrated, WLM Diva Monitor"
curator: <name or initials>
notes: |
  Any context worth pinning — e.g. whether the prompt was followed by a "be
  concise" instruction, whether system prompts were used, etc.
status: placeholder | curated
---

<verbatim ChatGPT response prose here — copy-paste from the ChatGPT chat
window. Preserve paragraph breaks. Do not edit for grammar or trim. Do not
prepend or append commentary; the curator-facing observations live in the
generated parity.md, not here.>
```

## Curation discipline

- **Verbatim only.** Paste exactly what the model produced. Do not paraphrase.
- **Single-shot.** Use the response to the first prompt for each case; do
  not condense across multiple ChatGPT turns. Multi-turn parity is a later
  phase if needed.
- **Pin the metadata.** Record the model version and the exact prompt used.
  Drift between Audio XX and the baseline is informative; drift inside the
  baseline (different prompts, different models, different system prompts)
  is noise.
- **Status field.** Set to `placeholder` if the file is a stub the generator
  uses to exercise its pipeline before real curation has happened; set to
  `curated` once a real capture has been pasted in.
- **No attribution invented.** Do not present the placeholder content as a
  real reviewer-grade ChatGPT output. The generator surfaces the status
  field in the rendered parity.md so reviewers don't conflate placeholder
  prose with real comparison material.

## When to refresh

- After a notable Audio XX narrative change (a calibration commit), regenerate
  `parity.md` by re-running the generator — Audio XX's side updates from the
  most recent Playwright transcript automatically.
- Refresh the ChatGPT baseline ONLY when:
  - A new ChatGPT model family is released that you want to calibrate against.
  - The prompt changes (the manifest `prompts.primary` is edited).
  - You realize the original capture was anomalous and should be replaced.
- Otherwise the baseline stays pinned. Drift is what makes the comparison
  useful.

## Anti-goals (deliberately not implemented in Phase C)

- Numerical scoring (BLEU, ROUGE, embedding cosine, etc.).
- Automated "winner" selection.
- LLM-judged side-by-side rating.
- Cross-case averaging or dashboards.

The point of Phase C is **interpretive readability + calibration usefulness**.
The reviewer's eye is the judge. The generator's only job is to put the two
narratives next to each other and give the curator structured slots for
qualitative observations.
