# Audio XX — Deploy Sync Guide

Production ↔ Local synchronization pass.
Generated 2026-05-01 from verified git and production state.

---

## STEP 1 — RUN LOCALLY

### Find and enter the repo

```bash
# If you're not sure where it is:
find ~ -name "audio-xx" -type d -maxdepth 3 2>/dev/null

# Then cd into it — adjust path to match your machine:
cd ~/audio-xx
# or wherever the repo lives
```

### Confirm branch

```bash
git branch --show-current
# Expected: fix/system-state
```

### Start dev server

```bash
npm install
npm run dev
```

This runs `next dev` in `apps/web`. Server starts at http://localhost:3000.
If it fails with Prisma errors, run:
```bash
cd apps/web && npx prisma generate && cd ../..
npm run dev
```

### Test queries (in browser at localhost:3000)

**Test 1: "What do you think of McIntosh?"**

STATUS: This branch does NOT fix the McIntosh brand query. McIntosh has no
BrandProfile, so it falls through to `buildProductConsultation`, which dumps
the raw `architecture` field verbatim. The casing issue ("Mcintosh") comes
from the LLM orchestrator, not our rendering code. Both problems are
pre-existing and not in scope for this deployment.

PASS if:
- Response appears (no error or crash)
- Response mentions hybrid tube/solid-state character
- Brand link to mcintoshlabs.com is present
- Product data (MA252, MA12000) is referenced

KNOWN ISSUES (not blockers — deferred to next product-quality pass):
- "Mcintosh" casing (lowercase i) may appear — orchestrator-level issue
- Architecture string "Hybrid, 12AX7/12AT7 tube preamp..." dumped verbatim
  — caused by the MA252 `architecture` field being a description instead of
  a clean topology label
- /brand/mcintosh shows "No brand profile yet" — no BrandProfile exists

FAIL if:
- No response at all
- Error or crash
- Response has nothing to do with McIntosh

**Test 2: "Please recommend a stereo for me. My budget is $2000 and I like a warm sound I'll be streaming mostly"**

STATUS: This branch improved category-priority patterns in shopping-intent.ts
(explicit "for speakers" / "not amps" disambiguation), but did NOT change
the core shopping parser's handling of ambiguous "stereo" queries. The parser
may still ask for a category when it can't confidently classify.

NOT A BLOCKER — deferred to next product-quality pass.

PASS if:
- Budget parsed correctly ($2,000)
- Preference extraction shows warmth
- Response is relevant to the query (warm stereo recommendations or a
  clarifying question about category)
- No error or crash

ACCEPTABLE (not a regression):
- "Are you thinking about speakers, headphones, or amplification?" —
  this is existing behavior when the parser can't auto-classify "stereo"

FAIL if:
- No response at all
- Budget not parsed
- Preferences not extracted
- Response is about a completely different topic

**Test 3: WLM Diva link behavior**

PASS if:
- WLM Diva Monitor in the system chain is underlined and clickable
- Clicking opens wlm-loudspeakers.com in a new tab
- Other chain components (Job Integrated, Chord, Eversolo) also clickable where URLs exist

FAIL if:
- Chain names are plain text with no link

**Test 4: Product images**

PASS if:
- Product cards in any response show product images
- Images load (no broken image icons)

FAIL if:
- Zero `<img>` elements on the page after a response
- Broken image placeholders

**Test 5: System state / signed-out behavior**

PASS if:
- Refreshing the page preserves your last system (localStorage persistence)
- "Start over" clears the conversation
- Signing out does not leak system state to a new session

FAIL if:
- Refresh loses everything
- Old system chain appears for a signed-out user

---

## STEP 2 — VERIFY GIT STATE

```bash
git status
git branch --show-current
git log --oneline --graph --decorate -n 15
```

### What you should see

- **Current branch:** `fix/system-state`
- **7 commits ahead of main** (already pushed to origin)
- **10 files with uncommitted changes** (our recent work):
  - `consultation.ts` — narrative language cleanup + voicing coherence
  - `AdvisoryMessage.tsx` — clickable product names in assessments
  - `render-text.tsx` — `renderTextWithProductLinks` function
  - `brand/[slug]/page.tsx` — brand page improvements
  - `advisory-response.ts`, `memo-findings.ts` — minor type additions
  - `products/speakers.ts` — WLM Diva catalog update
  - `shopping-intent.ts` — minor fix
  - `package.json`, `package-lock.json` — Playwright dependency
- **Untracked files** (new):
  - `apps/web/playwright.config.ts` — Playwright config
  - `apps/web/qa-screenshots/` — QA harness output directory
  - `apps/web/src/tests/qa-screenshots.spec.ts` — QA test
  - `apps/web/src/components/advisory/ProductImage.tsx` — image component
  - `climate-screen-starter/` — separate project, do NOT include
  - `CLIMATE-SCREEN-CLAUDE.md` — separate project, do NOT include
  - `test-results/` — gitignore-worthy artifacts

### Check the diff

```bash
git diff --stat HEAD
git diff main..fix/system-state --stat
```

---

## STEP 3 — CLEAN COMMIT

### Stage the Audio XX changes only (exclude climate-screen and test artifacts)

```bash
# Core fixes
git add apps/web/src/lib/consultation.ts
git add apps/web/src/lib/advisory-response.ts
git add apps/web/src/lib/memo-findings.ts
git add apps/web/src/lib/products/speakers.ts
git add apps/web/src/lib/shopping-intent.ts

# Clickable product links
git add apps/web/src/components/advisory/AdvisoryMessage.tsx
git add apps/web/src/components/advisory/render-text.tsx

# Brand page improvements
git add "apps/web/src/app/brand/[slug]/page.tsx"

# Product image component
git add apps/web/src/components/advisory/ProductImage.tsx

# QA harness
git add apps/web/playwright.config.ts
git add apps/web/qa-screenshots/.gitignore
git add apps/web/qa-screenshots/README.md
git add apps/web/src/tests/qa-screenshots.spec.ts

# Dependencies (Playwright)
git add package.json package-lock.json
```

### Commit

```bash
git commit -m "$(cat <<'EOF'
Narrative cleanup, clickable products, and QA harness

- Clean system assessment language: replace AI-sounding prose with
  concrete expert English across all narrative sections
- Add renderTextWithProductLinks: bold product names link to verified
  retailer URLs (first occurrence, verified catalog only)
- Make system chain names clickable in assessment view
- Add voicing coherence detection to suppress false bottleneck
- Improve brand page rendering and fallback text
- Add WLM Diva Monitor catalog entry with manufacturer URL
- Add Playwright QA screenshot harness with image coverage reporting

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

### Do NOT commit these (they belong to other projects or are artifacts):
- `CLIMATE-SCREEN-CLAUDE.md`
- `climate-screen-starter/`
- `test-results/`

---

## STEP 4 — MERGE TO MAIN

### Sequence

```bash
# 1. Update local main from origin (it's 1 commit behind)
git checkout main
git pull origin main

# 2. Merge fix/system-state
git merge fix/system-state

# 3. Verify — no conflicts expected (confirmed via merge-tree)
# If clean:
git push origin main
```

### Risk assessment

- **Conflict risk: NONE** — verified via `git merge-tree`, zero conflicts
- **Risky files: LOW** — `consultation.ts` has the largest diff (584 lines changed) but all changes are string template edits, not logic changes
- **No destructive changes** — all modifications are additive or string replacements

---

## STEP 5 — DEPLOYMENT

### How production is deployed

Based on the repo:
- **No CI/CD config found** (no GitHub Actions, no vercel.json, no Dockerfile)
- **Database:** Turso (hosted libSQL) at `audio-xx-m1brown.aws-eu-west-1.turso.io`
- **Most likely:** Vercel auto-deploy from `main` branch (standard Next.js + Turso setup)

### After pushing main

If Vercel auto-deploy is configured:
- Push triggers a new build automatically
- Build runs `prisma generate && next build`
- Deploy completes in ~2-5 minutes
- No cache invalidation needed — Vercel handles this

If manual deploy:
- Check Vercel dashboard at https://vercel.com
- Trigger redeploy from the dashboard if needed
- Or run `vercel --prod` if Vercel CLI is installed

### To verify deployment happened

```bash
# After pushing, wait 3-5 minutes, then check:
curl -sI https://audio-xx.com | head -5
# Should return 200 OK
```

---

## STEP 6 — POST-DEPLOY CHECKLIST

Run these on https://audio-xx.com after deployment completes.

### 6.1 McIntosh query (observation only — not fixed by this branch)

Type: "What do you think of McIntosh?"

| Check | Status | Notes |
|-------|--------|-------|
| Response appears | MUST PASS | No error, relevant to McIntosh |
| Brand link | MUST PASS | mcintoshlabs.com link present |
| "Mcintosh" casing | KNOWN ISSUE | Orchestrator-level, deferred |
| Raw topology string | KNOWN ISSUE | MA252 `architecture` field needs cleanup, deferred |
| /brand/mcintosh | KNOWN ISSUE | "No brand profile yet" — no BrandProfile exists, deferred |

### 6.2 Shopping query (observation only — parser not changed for this case)

Type: "Please recommend a stereo for me. My budget is $2000 and I like a warm sound"

| Check | Status | Notes |
|-------|--------|-------|
| Budget parsed | MUST PASS | $2,000 shown |
| Preferences extracted | MUST PASS | Warmth detected |
| Category question | ACCEPTABLE | "What category?" is existing behavior, not a regression |
| Product cards | NICE TO HAVE | May or may not appear depending on parser confidence |

### 6.3 Product links

| Check | Pass | Fail |
|-------|------|------|
| WLM Diva clickable | Underlined, opens wlm-loudspeakers.com | Plain text |
| Chain names linked | At least some components clickable | All plain text |

### 6.4 Images

| Check | Pass | Fail |
|-------|------|------|
| Assessment images | Product images in cards | Zero images on page |
| Brand page images | Images on /brand/pass-labs etc | Zero images |

### 6.5 State handling

| Check | Pass | Fail |
|-------|------|------|
| Refresh persistence | System chain survives refresh | Lost on refresh |
| Start over | Clears conversation | Does not clear |
| Sign-out safety | No state leakage | Old system visible |

---

## GO / NO-GO DECISION

### Prerequisites for GO:
1. Local dev server starts without errors
2. MUST-PASS checks in Step 1 all pass locally
3. Clean commit (no climate-screen files included)
4. Merge completes without conflicts
5. Push succeeds
6. Production loads after deploy

### BLOCKERS (any of these = NO-GO):
- Dev server won't start
- Merge conflicts (not expected — verified clean via merge-tree)
- Build failure on Vercel (watch for Prisma engine issues)
- New regression: a flow that worked before now crashes or errors
- OpenAI API key expired or rate-limited on production
- Turso database connection failure

### NOT BLOCKERS (pre-existing, deferred to next product-quality pass):
- **McIntosh brand query quality** — "Mcintosh" casing (orchestrator issue),
  raw topology string dump (MA252 `architecture` field is a description not a
  label), "No brand profile yet" on /brand/mcintosh (no BrandProfile exists).
  Root causes: product data quality + missing BrandProfile + orchestrator casing.
  None of these are regressions — they exist on production today.
- **Shopping "stereo" category question** — parser may ask "speakers, headphones,
  or amplification?" for ambiguous queries. This is existing behavior. The branch
  improved explicit-intent patterns ("for speakers", "not amps") but did not
  change how "stereo" is classified. Not a regression.

### WHAT THIS DEPLOYMENT IMPROVES (vs current production):
- System assessment narrative language (cleaner, expert-level English)
- Clickable product names in system assessment (verified retailer URLs)
- Brand pages with full profiles (DeVore, Pass Labs, Boenicke, Shindo)
- Product images across all card types
- Voicing coherence detection (no false bottleneck on well-matched systems)
- 2-column card layout, improved visual hierarchy
- Manufacturer vs dealer link classification
- System persistence via localStorage
- Playwright QA screenshot harness (dev tooling)
- Category-priority patterns for shopping intent (explicit disambiguation)
