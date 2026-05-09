# Audio XX — Next Steps

A practical, time-bounded view of upcoming priorities. Readable by both engineers and non-technical operators. Engineering terms are briefly explained at first mention.

The items below are ordered by dependency, not by interest. Earlier items unblock later items; reordering significantly is possible but introduces avoidable rework.

---

## Immediate priorities

Items that should be addressed before further new feature work. Roughly the next two to three working weeks at a part-time pace.

### Behavioural beta hardening

Three known reasoning gaps in the advisory engine are demo-blockers — meaning a reader walking through five or six varied messages would visibly hit one of them and lose confidence. Resolving them is the primary near-term focus.

| Item | Approximate effort |
|---|---|
| Fix follow-up continuity. When a user adds context after their first question (for example: "I have a tube amp"), the system should refine its previous response, not duplicate it. | 1–2 days |
| Handle unknown products gracefully. When a user asks about a product not in the curated catalog, the response should acknowledge the product by name and state honestly that calibrated data is unavailable, rather than producing a blank wall. | 1–3 days |
| Decline non-advisory questions cleanly. When a user asks something outside the audio domain (for example, a practical request for help in a foreign language), the system should decline politely rather than route the question into advisory framing. | ~1 day |

### Affiliate disclosure alignment

The footer currently includes language that implies affiliate participation, but no affiliate links are actually wired in the code. This is a misalignment between what the page says and what the code does. The fix is a low-effort decision: either soften the footer language until affiliate participation is implemented, or wire affiliate participation per the documented policy. Approximately one hour for the soften path; significantly more for the wire path.

### Onboarding hardening

The documentation layer is in place. A small number of unverified items remain, all of which require dashboard inspection by the project author rather than code changes:

- Vercel preview gating for the active development branch
- Sentry alert routing destinations
- Database backup configuration
- Domain auto-renewal status

Each is approximately ten minutes of dashboard inspection. The findings should be recorded in the relevant documentation, replacing the current "verify" markers with confirmed status.

### Manual canonical question walk

Before sharing the project externally with any new reader, a curated list of canonical questions should be walked end-to-end on the live preview environment. Approximately one hour. Bugs surfaced during the walk go on the issue list and are resolved before sharing.

---

## Medium-term priorities

Items that come after the immediate priorities are settled. Roughly the next four to six working weeks.

### Behavioural regression test suite

The single highest-leverage piece of unbuilt infrastructure. A regression test suite is an automated set of checks that runs whenever code changes; it confirms that recent changes have not broken expected behaviour. The behavioural version, specifically, drives the canonical questions through the reasoning engine and verifies properties of the response (for example: "did the response name a trade-off?", "did the response avoid duplicating the prior turn?", "did the confidence language match the available data?").

Without this suite, every advisory engine change carries unmeasured risk. With it, contributions become significantly safer for any new collaborator.

Approximate effort: three to five working days.

### Confidence semantics lock-in

Every advisory output today carries a confidence value (high, medium, low, or insufficient). The semantics of those values — what each one means in terms of language strength and recommendation behaviour — are documented but not formally enforced. Locking the semantics with a small set of tests would make sure all parts of the codebase interpret confidence consistently.

Approximate effort: one to two days.

### Continuous integration foundation

Continuous integration (commonly abbreviated as CI) refers to automated checks that run on every push to the code repository — type-check, lint (style and correctness rules), test suite, and a basic security audit. Continuous deployment (CD) refers to automatic deployment after CI passes. Both CI and CD are conventional infrastructure for any team-developed codebase.

The first step is a basic CI workflow on GitHub Actions (the platform that runs these checks for repositories hosted on GitHub) that runs the existing checks. The second step is branch protection rules — settings that prevent code from being merged into the main line until CI passes.

Approximate effort: one to two days for the basic CI; an additional one day for pre-commit hooks (checks that run on the developer's machine before a commit can be created). The cost of *not* doing this rises as the contributor count grows.

### TypeScript baseline cleanup

The project has approximately 98 type-check warnings today (TypeScript is a version of JavaScript that adds type-checking; a "type-check warning" is the language complaining that a value is being used in a way the language is not sure is correct). The cleanup is straightforward but tedious. One pull request per code module. Each warning fixed or explicitly suppressed with a justification comment.

Approximate effort: three to five days. Best done after the regression test suite is in place so changes can be verified safely.

### Image and link verification automation

A scheduled or on-demand job that automatically checks retailer URLs across the catalog for liveness and confirms that image overlay map keys still match catalog entries. The link audit performed manually in May 2026 caught several broken URLs; an automated probe would catch the next set without manual effort.

Approximate effort: one day.

---

## Longer-term opportunities

Items that come after operational maturity is established. Not yet scheduled.

### Language-model overlay (full integration)

Wire the planned language-model overlay into the production reasoning path. The overlay is the part of the system that would call out to a language model (such as the kind of model behind ChatGPT) for cases the deterministic core cannot handle well. Scope:

- Unknown-product handling (graceful acknowledgement plus public-information framing)
- General audiophile knowledge questions outside the catalog
- Non-advisory intent decline (more nuanced than a flat refusal)
- Free-form clarifications and educational content

The deterministic core remains the source of truth on the advisory path; the language model is a fallback overlay for cases the core cannot handle. The boundary between core and overlay needs to be drawn explicitly. This work is the highest-impact item available once the foundational hardening is complete.

Approximate effort: one to two weeks once the integration boundary is decided.

### Engine extraction

Lift the portable reasoning logic into a separate code package within the same repository. The intent is that the reasoning logic — the part that handles preferences, trade-offs, and restraint — could in principle be reused across decision-quality domains beyond audio.

Approximate effort: two to three weeks for the relocation; longer if the receiving consumer requires API stabilisation.

### Public preview readiness

Items required to share the project beyond friends:

- Affiliate participation wired (or explicitly absent and disclosed accordingly)
- Reference attribution surfaced consistently in advisory output
- Coverage transparency message ("Audio XX currently covers approximately 127 components...")
- Curated example conversations (so a reader can review without typing)
- Mobile responsive review pass
- Domain, SSL (the protocol that keeps web traffic encrypted), and HTTPS verified stable

Approximate effort: one to two weeks.

### Catalog expansion

The catalog is hand-curated. Extending coverage to additional brands, additional product tiers, and additional categories is an ongoing effort that scales linearly with curator time. No automation is planned for this; the curated nature is the credibility surface.

### Cross-system advisory reasoning

Today a user can save multiple systems but cross-system reasoning — for example, "how would my desk system change if I moved the tube preamp from the living-room system?" — is partial. A focused pass could expand this.

### Internationalisation

The project is currently English-only. Trait labels, advisory copy, and glossary entries all assume English. Not currently scheduled.

---

## Sequencing summary

```
Immediate (2-3 weeks)     ->  Medium-term (4-6 weeks)     ->  Longer-term
---------------------         -------------------------       ----------------
- Beta hardening              - Regression test suite          - Language-model overlay
- Disclosure alignment        - Confidence lock-in             - Engine extraction
- Onboarding verification     - Continuous integration         - Public preview
- Canonical question walk     - Type baseline cleanup          - Catalog expansion
                              - Link/image automation
```

The immediate items remove the demo-blockers and align documentation with reality. The medium-term items establish the operational floor that makes further work safer and faster. The longer-term items are dependent on the medium-term foundation and should not be attempted before it is in place.

---

## What this list deliberately excludes

To keep the roadmap honest:

- Speculative features unrelated to the current scope
- Marketing campaigns or growth tactics
- Voice or mobile-first re-architectures
- Community platform additions
- Aggressive monetisation experiments
- Anything that would compromise the restraint, trade-off, or anti-ranking principles

The list above is what is achievable, useful, and consistent with the project's identity. Items outside that envelope have been left off deliberately.

---

## Approximate timeline to public-preview readiness

If the project commits to ten to fifteen hours per week of focused work, the immediate and medium-term items are roughly six to eight weeks of effort. Adding buffer time and the longer-term public-preview items, **a cautious estimate is eight to ten weeks from a stable foundation to a public-preview launch**. This estimate assumes no new scope expansion and no significant unforeseen issues.

For external-beta readiness alone (suitable for sharing with a journalist or a sophisticated reviewer), the estimate compresses to **roughly one focused work week** of the immediate items.

---

## Notes for a non-technical reader

If you are evaluating this roadmap from an operator perspective rather than as someone who will write the code:

- The immediate priorities are mostly bug fixes and small alignment work. None of them are major new features. They can be done by a single contributor without dramatic effort.
- The medium-term priorities are infrastructure — tests, automated checks, code-quality cleanup. They make future work safer and faster but produce nothing user-visible. They are still important; skipping them increases risk on every subsequent change.
- The longer-term opportunities are where new user-visible capability lives. The language-model overlay is the most impactful single piece of unbuilt work; it is also the most subtle to integrate well, which is why it is not on the immediate list.
- Effort estimates are rough. They assume one focused contributor working part-time on a project they understand. With less-focused time or with an unfamiliar contributor, multiply by 1.5–2x for a more realistic estimate.
- Nothing here requires fundraising or hiring. The roadmap is achievable with the current team configuration.

---

*Canonical source: GitHub repo, `handoff/` folder.*
