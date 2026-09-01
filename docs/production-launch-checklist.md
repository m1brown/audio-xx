# Audio XX — Production Launch Checklist (Beta)

Goal: make **version-b** the public `audio-xx.com` experience, launching in **days, not months**.
State at writing: version-b `HEAD 67940a6`, **24 commits ahead** of last-promoted production (`41be23e`). All work is green on version-b (engine gate 3986 pass / 0 regressions). This checklist is assessment-only — **no changes implemented yet.**

Legend: **[MUST]** before launch · **[SOON]** shortly after launch · **[WAIT]** after beta.

---

## 0. The headline fact

Production has **not** moved since `41be23e`. Launching means promoting a **24-commit delta** that includes the new **Assessment Renderer** (shared by chat, snapshots, and `/artifact`), the Canonical Assessment Model, the three-axis Tonal Signature, Dominant Character, the France educational layer, and the Publishers & Reviewers page. This is a **major UX promotion**, not a patch — so the gate is founder sign-off on the *new assessment experience in production*, plus a live smoke test. Everything else below is small by comparison.

---

## 1. Infrastructure

| Item | State | Action | Priority |
|---|---|---|---|
| Deployment process | Vercel; promote by `vercel redeploy <version-b-preview-url> --target production` (exact reviewed build → prod) | Promote the reviewed `67940a6` build | **[MUST]** |
| DNS | `audio-xx.com` already live on prod (prior promotion) | None expected — confirm apex + www resolve post-promote | **[MUST]** verify |
| SSL | Vercel-managed, auto | Confirm valid cert after promote | **[MUST]** verify |
| Redirects | None obviously required | Confirm no stale `/artifact`/legacy redirects needed | **[SOON]** |
| Caching | Next default + Vercel edge; `/artifact` uses `cache()` | Spot-check assessment pages aren't over-cached (date/OG) | **[SOON]** |
| robots.txt | `app/robots.ts` present | Confirm it allows indexing of public pages, disallows `/api`, `/account` | **[MUST]** verify |
| sitemap | `app/sitemap.ts` present | **Add new public routes** (`/publishers-reviewers`; confirm `/about`, `/how-it-works`, `/resources`, `/glossary`, `/privacy`) | **[SOON]** |
| Analytics | wired (`layout.tsx`, `page.tsx`, `analytics-server.ts`; `trackEvent`) | Verify events fire in prod after promote (one live smoke) | **[MUST]** verify |
| Error monitoring | Sentry wired (`global-error.tsx`, `instrumentation-client.ts`) | Confirm prod DSN/env set; trigger one test error post-promote | **[MUST]** verify |

---

## 2. Product

| Item | State | Action | Priority |
|---|---|---|---|
| Outstanding known issues | `POST_LAUNCH.md` backlog: no CSP header (S2), `save_started` attribution race (S2), OG per-assessment images deferred, pretty share links deferred, password reset deferred | None launch-blocking; leave in backlog | **[WAIT]** |
| Pages without navigation | **`/publishers-reviewers` is not linked anywhere** | Founder decision: link it (footer) or keep unlisted for now | **[SOON]** |
| Placeholder content | Educational layer is **France-only** and degrades to absent elsewhere (no placeholder shown); component images are real catalog photos | Spot-check a few non-France systems render cleanly (no empty blocks) | **[MUST]** verify |
| Dead links | External primary-source links (incl. `jobsys.com`, a live shutdown notice — still valid); internal `/about`, `/` links | Quick link-audit on the assessment + static pages | **[SOON]** |
| Mobile QA | Assessment renderer verified **0 horizontal overflow** at 320/360/390/414 (Playwright) | Live mobile smoke on prod-candidate (Safari iOS + Chrome Android) | **[MUST]** |
| Browser QA | Not yet cross-browser tested live | Smoke on Chrome, Safari, Firefox (desktop) + one live assessment each | **[MUST]** |
| Accessibility review | Artifact carries aria labels; not audited | Quick pass: headings order, alt text, focus states, colour contrast (cream/claret), reduced-motion | **[SOON]** |

---

## 3. Editorial

| Item | State | Action | Priority |
|---|---|---|---|
| About | ✅ exists, linked | — | — |
| Publishers & Reviewers | ✅ exists (new), **not linked** | Founder call on surfacing (see Product) | **[SOON]** |
| Privacy | ✅ exists, linked | Confirm current + accurate for beta data use | **[MUST]** verify |
| **Terms** | ❌ **missing** | Add a minimal Terms of Service page — the app has **billing (Stripe)** and accounts, so terms are a launch-safety item; link at signup/checkout + footer | **[MUST]** |
| Contact | mailto `hello@audio-xx.com` works; no `/contact` page | Optional dedicated page; mailto is sufficient for beta | **[WAIT]** |
| Attribution | Assessment educational layer cites primary sources; Publishers page states the citation intent | Confirm footer/product-image attribution + referrer-policy still correct | **[SOON]** |
| Copyright | Verify footer carries `© Audio XX` + year | Add/confirm copyright line site-wide | **[SOON]** |

---

## 4. Launch recommendation

### Must fix before launch
1. **Promote the reviewed `67940a6` build to production** (release op) + founder sign-off on the new assessment experience live.
2. **Verify infra post-promote:** DNS/SSL, robots allow/deny, analytics events firing, Sentry capturing (one live test error).
3. **Minimal Terms of Service page** (billing + accounts make this a safety item) + Privacy accuracy check.
4. **Live QA smoke:** mobile (iOS Safari + Android Chrome) and desktop (Chrome/Safari/Firefox), each with one real assessment; confirm a few **non-France** systems render cleanly (educational layer absent, no empty blocks).

### Should fix soon after launch
5. Add public routes (esp. `/publishers-reviewers`) to **sitemap**; decide whether to **link** the Publishers page (footer).
6. **Dead-link audit** + footer **copyright/attribution** confirmation.
7. **Accessibility pass** (headings, alt text, focus, contrast, reduced-motion).
8. Redirect/caching spot-check.

### Can wait until after beta
9. CSP header, `save_started` attribution race (both S2).
10. Per-assessment OG images, pretty share links, password reset, `/contact` page.

### Verdict: **Yes — Audio XX is ready for a public Beta within days, conditional on the four Must-fix items.**
Nothing architecturally blocks launch. The engine and the new editorial artifact are green and reviewed on version-b; infrastructure (Sentry, analytics, robots, sitemap, SSL, live domain) is already in place. The only genuine gaps are a **Terms page**, the **promotion + live smoke**, and confirming infra fires in production. The Must-fix set is a **day or two of work**, not weeks.

**One caution worth naming:** this promotion changes the *live assessment experience* for every user (shared renderer). It's been reviewed piecemeal on version-b throughout — but a single **founder walk-through of the promoted build in production**, on desktop and mobile, before announcing the beta, is the highest-value final check.

*No changes implemented. Recommend founder approval of the Must-fix scope, then a single bounded launch envelope.*
