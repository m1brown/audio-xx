# Production baseline evidence (audio-xx.com) — 2026-07-25

Founder-supplied screenshot of the LIVE site `https://audio-xx.com`, recorded
as the pre-activation production baseline. Production = commit `de13f5a`
(M4, 22 Jul); the certified release candidate `620ee7b` (version-b) is NOT yet
deployed.

## What the screenshot shows (live production)
- Verdict: **"Nothing here needs changing."** with standfirst "Tonally balanced,
  detail-forward, elastically flowing, spatially open system emphasizing
  transient clarity."
- Credit line (small caps): **"EVERSOLO DMP-A6 · CHORD HUGO · JOB INTEGRATED ·
  WLM DIVA MONITOR"** — correctly cased.
- Component photo rail renders (Eversolo, Chord Hugo, Job, WLM Diva) — images OK.
- Body trade sentence: **"The trade — wLM Diva monitor has moderate placement
  sensitivity …"** — the mis-cased **"wLM"** appears here.
- SYSTEM panel: saved system "FRANCE" — "Job integrated → WLM Diva monitor →
  Eversolo DMP-A6". Short, phenomenological assessment body.

## Why this corroborates the deployment diagnosis
The mangle appears ONLY in the mid-sentence trade line, while the caps credit
line is correct. That is the exact signature of production's old `lowerFirst`
in `synthesizeArtifact.ts` at `de13f5a` (`s[0].toLowerCase() + s.slice(1)`),
which mangles a decapitalized mid-sentence use ("WLM"→"wLM") but never the
credit line. The certified RC fixed `lowerFirst` (proper-name-safe) at Gate 5
(`d42c24a`) — verified to render "WLM Diva Monitor" through the same
`runArtifactPipeline` path. Production simply predates that commit by 19
commits. This is a deployment state, not a certification failure, and the
shallow assessment depth is the intentionally-unchanged editorial baseline
(the causal-explanation initiative remains the first post-launch work).

## Note
The binary image was provided in-conversation; this file is the textual
record of its content for the certification evidence trail.
