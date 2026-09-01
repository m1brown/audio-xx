# Milestone 4 — Launch Readiness Review

**Date:** 2026-07-22 · Reviewed as a first-time user across landing, builder, assessment, My Systems, history, mobile, accessibility, sharing, and printing.

## Strengths (leave alone)

- **The editorial identity is real and consistent** — the landing cover, the artifact, My Systems, and the history pages read as one publication. Typography and whitespace do the work; there is no app chrome to apologise for.
- **The core loop is genuinely frictionless**: 15 seconds from landing to a server-rendered assessment, no account anywhere on the free path, and the URL is the share.
- **The assessment itself is demo-quality** — verdict-first hierarchy, evidence rail, print stylesheet already tuned, graceful failure path.
- **My Systems reads as a collection**, and assessment history (latest vs earlier, provenance lines, immutability language) is the strongest "this is a real product" signal in the app.
- Failure paths are editorial, not technical, throughout.

## Weaknesses → highest-priority improvements (implemented this milestone)

| # | Finding | Why it matters to a first user | Fix |
|---|---|---|---|
| 1 | **No sharing metadata anywhere.** Site title is a bare "Audio XX"; no Open Graph/Twitter tags; a shared assessment URL — the product's whole acquisition loop — unfurls as a blank link. | The first thing a delighted user does is paste the link in a group chat; today that paste looks broken. | Site-wide metadata + OG defaults; per-assessment `generateMetadata` (verdict as title, standfirst/recognition as description); page titles for every product surface; `noindex` on private pages (`/systems`, `/save`). |
| 2 | **Broken product images render as empty white frames** in the artifact photo strip (live example: Schiit Bifrost on production). | An empty frame in the flagship artifact reads as a bug and undercuts the publication feel. | Photo-strip images become a tiny client component that removes its own cell when the image fails to load — the strip degrades to named-only, exactly as if no photo existed. |
| 3 | **Builder keyboard & touch gaps**: no arrow-key movement through suggestions; 35 px input targets on mobile; and after "Read my assessment" the page sits still for the 1–3 s server render with zero feedback. | The builder is the first interaction; hesitation or a dead-feeling click is the worst possible first impression. | Arrow-key navigation (↑/↓ + Enter, Escape closes) with `aria-activedescendant`; inputs padded to ≥44 px touch height; the CTA switches to "Preparing your assessment…" via `useTransition` while navigating. |
| 4 | **The sign-in page is off-brand** — legacy form styling and copy ("New accounts are created automatically."), nothing like the `/save` card. It is reachable from the header on every page. | It breaks the editorial spell at exactly the moment someone decides to trust you with an email address. | Restyled to the editorial card language of `/save`: serif headline, hairline inputs, the collection promise, same auto-account behaviour. |
| 5 | **Keyboard focus is inconsistent** — links and buttons ride browser defaults; inputs replace the outline with a faint shadow. | Keyboard users (and accessibility reviewers) see an unfinished product. | Global `:focus-visible` outline in the editorial accent for links and buttons, offset so it reads as intentional. |
| 6 | **Terminology drift**: the signed-in nav says "Systems"; the product is "My Systems" everywhere else. | Naming is the product; the collection has one name. | Nav label unified to "My Systems". |

## Reviewed and found acceptable (no change)

Empty/one/many states in My Systems; assessment loading (server-rendered, fast); print output; malformed-input path; mobile overflow (none found on any major page); contrast (ink #1B1A18 on paper #FCF8EE ≈ 15:1; muted #6B6862 ≈ 5.5:1 — both pass AA); perceived performance (no unnecessary client fetching on the artifact path; My Systems makes one list call).

## Intentionally deferred (documented, not implemented)

- **Generated per-assessment OG images** (verdict typeset as a card) — real design+rendering work; text-only OG ships now and covers the unfurl.
- **Pretty share links** (`/a/<id>`) — the canonical-URL architecture stands; cosmetic.
- **Reading-to-reading diff view** in history (M3 note, restated).
- **Password reset** — needs an email service; accounts are young.
- **Node 24 build-engines bump** (Vercel deprecation 2026-10-01) — operations task with its own verification, not first-user polish. Must land before October.
- **External-image data repair** (fixing dead URLs in product data) — #2's client-side degradation makes this housekeeping rather than launch-blocking.
- Builder suggestion previews with product photos; richer keyboard shortcuts; skip-links. All nice; none load-bearing for 50 first users.
