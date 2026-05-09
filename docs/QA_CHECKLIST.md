# Audio XX — QA Checklist

**Last updated:** 2026-05-09
**Audience:** anyone running QA before a deployment, before sharing the URL externally, or as part of routine release verification.

This document is the operational checklist form. For the broader QA philosophy and workflow, see [`QA.md`](QA.md). For the specific items deferred or known-broken, see [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md).

Use this checklist by walking it top-to-bottom. Mark each item ✅, ⚠️, or ❌. An ❌ on any blocking item should stop the deployment.

---

## 1. Routes

Confirm each renders without error and shows expected content:

- [ ] `/` — home page; 3-column workspace at viewport ≥ 1200px
- [ ] `/how-it-works`
- [ ] `/glossary`
- [ ] `/resources`
- [ ] `/systems` (auth-required — redirects to sign-in if logged out)
- [ ] `/systems/new` (auth-required)
- [ ] `/systems/[id]` (auth-required, with valid id)
- [ ] `/systems/saved`
- [ ] `/systems/saved/[id]`
- [ ] `/profile` (auth-required)
- [ ] `/auth/signin`
- [ ] `/about`
- [ ] `/privacy`
- [ ] `/affiliate-disclosure`
- [ ] `/onboarding`
- [ ] `/diagnose`
- [ ] `/compare`
- [ ] `/evaluate`
- [ ] `/evaluate/candidate`
- [ ] `/brand/[slug]` (sample at least one valid brand slug)
- [ ] `/product/[brand]/[name]` (sample at least one valid product)
- [ ] `/path/upgrade/[flavor]`

---

## 2. Internal links

- [ ] All top-nav items navigate correctly: How It Works, Glossary, Resources, Systems
- [ ] Top-nav active state highlights the current route via `aria-current="page"` and a subtle bottom border
- [ ] Left-rail "Conversation" item resets the conversation when on `/`
- [ ] Left-rail Systems / Listening Profile / How It Works / Glossary / Resources navigate correctly
- [ ] Right-rail "Edit profile →" and "Manage systems →" links navigate correctly
- [ ] Right-rail "Add one" empty-state link navigates to `/systems`
- [ ] Footer links: Privacy Policy, Affiliate Disclosure, About, Report issue (mailto)
- [ ] Audio XX wordmark in main column resets the conversation
- [ ] Small accent rule above main column resets the conversation
- [ ] Small accent rule in left rail resets the conversation
- [ ] Anchor links in glossary scroll to the correct category
- [ ] Brand slug links from product cards resolve to a brand page

---

## 3. External links (sample, not exhaustive)

- [ ] Retailer links open in a new tab (`target="_blank"`)
- [ ] All external links carry `rel="noopener noreferrer"`
- [ ] Source / review citation links open the correct publication
- [ ] HiFi Shark search URLs are well-formed: `https://www.hifishark.com/search?q=<encoded>`
- [ ] eBay search URLs are well-formed: `https://www.ebay.com/sch/i.html?_nkw=<encoded>`
- [ ] Amazon retailer links resolve to live product pages (canonical `amazon.com/dp/<ASIN>` form)
- [ ] No `href="#"` placeholders (in-page anchor `href="#category-id"` patterns are exempt)
- [ ] No empty `href=""` attributes
- [ ] No `localhost` / `example.com` / `staging` URLs in production code

For deeper link audits, see [`QA.md`](QA.md) § Link QA.

---

## 4. Images

- [ ] Product cards render images when available
- [ ] Cards render gracefully without an image surface when no image is available (no broken-image placeholder)
- [ ] Image source attribution caption ("Image: <site>") appears under images that have it
- [ ] No wrong-product image substitutions
- [ ] Diacritic-bearing brand/product names (e.g. Frérot, Raal-Requisite) display correctly and resolve to the right images

---

## 5. Canonical prompts

Walk each prompt and confirm the listed behavioural properties:

### "best DAC under $1500"
- [ ] Routes to shopping
- [ ] Returns a primary recommendation card with a concrete product
- [ ] Trade-off section present and substantive
- [ ] Does not duplicate any prior advisory content
- [ ] Right rail's "Recent" section shows the query

### "I want more flow"
- [ ] When an active saved system exists: routes to refinement, returns system-relative reasoning
- [ ] When no active system exists: routes to general advisory framing
- [ ] Does not force-route to shopping when an active system exists

### "my system sounds harsh"
- [ ] Routes to diagnosis
- [ ] References active system components by name (when an active system exists)
- [ ] Names a likely upstream cause
- [ ] Includes "do nothing" or restraint framing

### "compare Qutest vs Pontus"
- [ ] Routes to comparison
- [ ] Both products resolve to catalog entries
- [ ] Comparison artifact renders with axis positions
- [ ] Trade-offs between the two are surfaced

### "tell me about Denafrips" (or any catalog brand)
- [ ] Routes to brand authority page
- [ ] Returns substantive design philosophy / sonic tendency content
- [ ] Confidence calibrated to source quality

### "tell me about Zu Audio" (or any non-catalog brand)
- [ ] Does not return an empty wall ⚠️ *currently a known gap — see `KNOWN_ISSUES.md` § 1 #5*
- [ ] Acknowledges the brand by name
- [ ] States that calibrated data is not available
- [ ] Offers what is publicly known (when LLM overlay is wired)

### "should I do nothing?"
- [ ] Asserts "do nothing" as a valid path
- [ ] Does not framing it as a fallback or weak option

### "PA system for a venue"
- [ ] Routes to adjacent / out-of-scope handler
- [ ] Does not force-route into hi-fi advisory framing ⚠️ *currently a known gap — see `KNOWN_ISSUES.md` § 1 #6*

### "line array for a concert tour"
- [ ] Routes to out_of_scope
- [ ] Declines clearly
- [ ] Does not fabricate a recommendation

### Follow-up continuity test
After "best DAC under $1500", send: "I have a tube amp."
- [ ] System updates context with the tube-amp signal
- [ ] Returns a refined response, not a duplicate of the previous one ⚠️ *currently a known gap — see `KNOWN_ISSUES.md` § 1 #4*

---

## 6. Mobile behaviour

Test at viewport widths 375px (phone), 768px (tablet), and 1100px (small laptop):

- [ ] At ≥ 1200px: full 3-column workspace (left rail + main + right rail)
- [ ] At 1024–1199px: left rail + main; right rail hidden
- [ ] At < 1024px: single-column main; both rails hidden
- [ ] Top nav remains visible and usable at all widths
- [ ] Send button remains tappable (≥ 44px touch target) on phone
- [ ] Hero typography remains readable; no horizontal overflow
- [ ] Advisory cards do not overflow horizontally
- [ ] Long product names wrap or truncate gracefully

---

## 7. Vercel deployment

- [ ] Latest push to current branch is the active deployment
- [ ] Build completed without warnings (or warnings are expected and documented)
- [ ] Preview URL is accessible (or gated as intended)
- [ ] Production environment variables are set (see [`DEPLOYMENT.md`](DEPLOYMENT.md) § 3)
- [ ] First-paint loads within 3 seconds on a cold cache
- [ ] No hydration warnings in the browser console

---

## 8. Sentry

- [ ] `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` are set in the deployed environment
- [ ] A deliberate error reaches the Sentry dashboard within 1 minute
- [ ] Stack traces are unminified (source maps uploaded during build)
- [ ] No high-severity uncaught errors in the recent Sentry feed
- [ ] Alert routing is configured *(TODO: verify alert destinations)*

---

## 9. Authentication

- [ ] Sign-in flow completes for a new account
- [ ] Sign-in flow completes for an existing account
- [ ] Session persists across page reloads
- [ ] Sign-out clears session correctly
- [ ] Auth-required routes redirect to `/auth/signin` when logged out
- [ ] `NEXTAUTH_SECRET` is set in the deployed environment
- [ ] `NEXTAUTH_URL` matches the canonical production URL

---

## 10. Advisory quality

For at least three substantive advisory responses generated during the QA pass, confirm each of the following holds:

- [ ] **System-aware** — references the user's active system if one exists; does not evaluate candidates in isolation
- [ ] **Trade-off named** — every concrete suggestion names what it costs as well as what it gains
- [ ] **Confidence calibrated** — low-confidence outputs are hedged or refused; the response surfaces missing information rather than fabricating
- [ ] **Do-nothing surfaced** — restraint is presented as a valid option where appropriate
- [ ] **No scoring** — no numeric ranks; no "best of" framing
- [ ] **No urgency** — no time-limited or pressure language
- [ ] **Reasonable example count** — 1–2 gear examples per direction; up to 3 only on explicit request
- [ ] **Restraint preserved across turns** — follow-ups do not regress to one-sided recommendations

---

## 11. Visual regressions

Compare the current state against a recent reference screenshot or the design intent:

- [ ] Top nav: AUDIO XX wordmark with "XX" in restrained brand red (`#C83A3A`)
- [ ] Top nav: How It Works / Glossary / Resources / Systems sit immediately to the right of the wordmark
- [ ] Top nav: active route shows charcoal text with subtle 1px bottom border
- [ ] Top nav: auth controls (radar / Sign out / Sign in) anchored to the far right
- [ ] Left rail: 24px red top accent rule
- [ ] Left rail: WORKSPACE / REFERENCE eyebrows in muted gray uppercase
- [ ] Left rail: "Conversation" highlighted with charcoal text + 2px red left border
- [ ] Left rail: other items in muted gray
- [ ] Main column: 40px red top accent rule
- [ ] Main column: "Audio XX" wordmark with charcoal "Audio" + red "XX"
- [ ] Main column: hero statement in charcoal, restrained typography
- [ ] Right rail: LISTENER / SYSTEM / RECENT eyebrows in muted gray uppercase
- [ ] Right rail: action links ("Edit profile →", "Manage systems →") with red `→` glyph
- [ ] User-message bubbles: light grey background, charcoal text
- [ ] Send button: charcoal background, white text
- [ ] No warm tint anywhere in workspace surfaces (no beige, gold, coral, saffron)
- [ ] Slate-blue advisory card framing remains intact (this is the working palette for advisory rendering — preserved intentionally)
- [ ] No marketing energy, gradients, or shadows beyond the existing system

---

## 12. Deployment verification (post-push)

After a deployment lands:

- [ ] Vercel deployment status: ✅ Ready
- [ ] Cold load of the deployed URL renders the home page in < 3 seconds
- [ ] Sign-in works on the deployed URL
- [ ] One canonical prompt walks cleanly on the deployed URL
- [ ] Right rail context (LISTENER, SYSTEM, RECENT) populates correctly
- [ ] Reset paths (wordmark click, accent rule click, "Start over" button) all work
- [ ] No new high-severity Sentry errors within the first 10 minutes

If any of the above fails, consider rolling back per [`DEPLOYMENT.md`](DEPLOYMENT.md) § 9.

---

## 13. Pre-external-share gating

Before sharing the URL with an external user (friend, journalist, prospective collaborator):

- [ ] All canonical prompts walk cleanly
- [ ] No demo-blocker known issues are visibly broken on the live URL
- [ ] Sentry is receiving and routing errors correctly
- [ ] First-paint and interaction latency are acceptable
- [ ] Affiliate disclosure copy is aligned with current code state (see [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) § 6)
- [ ] The recipient knows the appropriate framing ("active development", "feedback welcome", scope of bugs)

---

## 14. Common things to check that have regressed in the past

(See [`QA.md`](QA.md) § 8 for the full historical regression catalogue.)

- [ ] No warm-colour leakage (`#e3dcc8`, `#a89870`, `#FBE7DA`, `#F5D0B8`, `#D85A1F`-as-warm — note `#C83A3A` brand red is intentional)
- [ ] No wordmark duplication beyond the two intentional instances (top nav + main column)
- [ ] No follow-up message duplication
- [ ] No empty advisory walls on unknown products (until LLM overlay ships, this is a known gap)
- [ ] No force-routed non-advisory intents
- [ ] No doubled product names ("JOB JOB Integrated")
- [ ] No raw markdown leaks in rendered output
- [ ] No `usePathname()` reintroduced into LeftRail (it would be dead code)
- [ ] Right rail "Recent" populates from current session messages (resets on navigation — known gap)
