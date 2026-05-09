# Audio XX — Screenshot Plan

A curated list of screenshots that would meaningfully support external review or onboarding. The screenshots themselves are not yet captured; this document describes what is needed and how each capture should be prepared. Suitable for an operator who will take the screenshots, or for an engineer setting up a clean test account to support the captures.

When the screenshots are taken, they should live alongside this README in the same directory, named clearly (`homepage-empty-state.png`, `advisory-comparison-flow.png`, etc.).

---

## Capture conventions

Before any capture, confirm:

- **Browser:** a standard desktop browser at default zoom level. Chrome or Safari is conventional. Firefox is acceptable.
- **Viewport:** 1440 pixels wide for desktop screenshots; 375 pixels wide for mobile screenshots; 1100 pixels wide for the rail-collapse intermediate state.
- **Theme:** the application has a single visual theme. No theme toggle is required.
- **Authentication:** authenticated screenshots use a clean test account. Personal email addresses, real listener-profile data, and any other personally-identifying information should not appear.
- **Browser chrome:** browser tabs, bookmarks bar, and personal information in the URL bar should not be visible. Use a clean browser profile (a fresh user account with no extensions or browsing history) or crop the screenshot above the tab strip.
- **Window decoration:** macOS or Windows window decoration is acceptable but should be consistent across the set of captures.
- **Background activity:** disable browser extensions that overlay UI (password managers, ad blockers with visible badges).
- **Cursor:** the cursor should not be visible unless the screenshot is specifically illustrating a hover or focus state.

Image format: PNG (a format that preserves image quality without compression artefacts) for static captures. JPEG only for very large captures where filesize is a concern.

Naming convention: `<surface>-<state>.png`. Examples:

- `homepage-empty-state.png`
- `homepage-with-system-active.png`
- `advisory-shopping-response.png`
- `comparison-qutest-pontus.png`

---

## Recommended captures

The list below is ordered by value to an external reviewer. Capturing the first six or seven is sufficient for most external sharing. Beyond that, additional captures are useful for specific audiences.

### 1. Homepage — empty state

- **Purpose:** show the workspace at first arrival, before any conversation has started
- **State to prepare:** unauthenticated session (or authenticated test account with no system saved); home route at viewport at least 1200 pixels wide; no toast notifications visible
- **What should be visible:** top navigation, three-column workspace, hero typography, system selection prompt, starter chips (the suggested example queries beneath the input box), send button
- **What should not be visible:** any prior conversation, any active modal, any error state, browser personal information

### 2. Homepage — workspace with active system

- **Purpose:** show the workspace once a listener has saved a system; demonstrate context awareness in the right rail
- **State to prepare:** authenticated test account; one saved system active; no conversation yet started
- **What should be visible:** the LISTENER, SYSTEM, RECENT sections of the right rail showing populated context; the "Audio XX" wordmark with the restrained brand-red "XX"; the active "Conversation" indicator on the left rail
- **What should not be visible:** real listener profile data, real system names that are personally identifying

### 3. Advisory interaction — shopping query response

- **Purpose:** demonstrate substantive advisory output for an in-catalog query
- **State to prepare:** submit "best DAC under $1500" or a similar canonical question; allow the advisory response to render fully
- **What should be visible:** the primary recommendation card with product image, the "sounds like / why this one / trade-off" framing, an alternative-direction card, source citations
- **What should not be visible:** loading spinners, half-rendered states, browser console output

### 4. Advisory interaction — system assessment response

- **Purpose:** demonstrate the diagnosis path with system-relative reasoning
- **State to prepare:** active saved system; submit a diagnosis-flavoured question such as "my system sounds harsh on female vocals"
- **What should be visible:** an advisory response that references the user's components by name, names a likely cause, and surfaces "do nothing" or restraint framing
- **What should not be visible:** generic recommendation language that does not engage with the specific system

### 5. Comparison flow

- **Purpose:** demonstrate the comparison artifact for two named products
- **State to prepare:** submit "compare Qutest vs Pontus" or similar; allow the comparison to render
- **What should be visible:** axis-position rendering, trade-offs between the two products, both product cards
- **What should not be visible:** failed-resolution states, missing-product errors

### 6. Listener profile / radar

- **Purpose:** show the trait radar visualisation (a small chart that summarises the listener's preferences across the four sonic axes)
- **State to prepare:** authenticated test account with several listener-profile traits populated using representative dummy data, not real listener profile data
- **What should be visible:** the radar chart with calibrated trait values; the sliders below if expanded; the source citations linked
- **What should not be visible:** real personal preference data; a default-zero radar (which would be uninformative for an external reviewer)

### 7. Systems flow

- **Purpose:** demonstrate the saved-systems experience
- **State to prepare:** authenticated test account with two or three saved systems; navigate to `/systems`
- **What should be visible:** the system list with name, components, and an active-system indicator
- **What should not be visible:** real personally-identifying system names

### 8. Mobile state — single column

- **Purpose:** demonstrate responsive behaviour (how the layout adapts to a small screen)
- **State to prepare:** viewport at 375 pixels wide; home route, mid-conversation
- **What should be visible:** the main column reflowed without rails; top navigation still visible and usable
- **What should not be visible:** horizontal overflow, broken layout, illegible text

### 9. Mobile state — rail-collapse intermediate

- **Purpose:** demonstrate the intermediate breakpoint where the right rail is hidden but the left rail remains
- **State to prepare:** viewport at 1100 pixels wide
- **What should be visible:** left rail and main column; right rail hidden; main column expanded into the right rail's space
- **What should not be visible:** half-collapsed rails, layout glitches at the breakpoint

### 10. Empty states

- **Purpose:** demonstrate graceful empty rendering — what the user sees when a section has no data yet
- **States to prepare:**
  - Right rail with no listener profile populated (LISTENER section shows the empty-state message)
  - Right rail with no active system (SYSTEM section shows the "Add one" empty-state message)
  - Right rail with no recent activity (RECENT section shows its empty-state message)
- **What should be visible:** empty-state messages with their action links
- **What should not be visible:** any populated state mixed with empty-state messages

### 11. Recommendation cards in detail

- **Purpose:** demonstrate the structure and information density of a single advisory card
- **State to prepare:** an advisory response with a primary recommendation card; capture the card alone (cropped) or the card region of a full screenshot
- **What should be visible:** all sections of the card — sounds-like, why-this-one, trade-off, technical-rationale (if present), buy/source links
- **What should not be visible:** truncated text, missing image where one is expected

### 12. Workspace rails — close detail

- **Purpose:** demonstrate the rail design at higher fidelity
- **State to prepare:** crop a screenshot to show just the left rail, or just the right rail, with all sections populated
- **What should be visible:** the small accent rule, eyebrow labels (the small uppercase headings such as WORKSPACE and LISTENER), active-state indicators, the restraint footer ("Doing nothing is also a valid outcome")
- **What should not be visible:** main column content (cropped out)

### 13. Diagnostic flow

- **Purpose:** demonstrate the system-diagnosis advisory path
- **State to prepare:** an active saved system with an articulated symptom; submit a diagnostic prompt that triggers the diagnosis route
- **What should be visible:** the diagnostic advisory output identifying a likely upstream cause, naming components by role, offering "do nothing" framing
- **What should not be visible:** force-routed shopping responses, generic non-diagnostic output

---

## What screenshots should never include

A consolidated list of items that must not appear in any external-shared screenshot:

- Real personal email addresses or names of real users
- Real listener-profile data tied to a real person
- Any session token, cookie, or authentication artefact visible in the URL or developer tools
- Browser bookmarks bar or personal extension badges
- Browser tabs unrelated to the application
- Pre-launch internal commentary or annotations
- Sentry dashboard URLs or error details
- Vercel deployment URLs that include hash suffixes intended to be private
- Any production database content beyond clearly-public catalog data
- Affiliate or tracking parameters in URLs (the catalog does not currently include these)

---

## Storage and sharing

When captured, screenshots should:

- Live in this directory (`handoff/SCREENSHOTS/`) in the repository
- Be committed alongside or shortly after this README
- Be referenced by relative path from documents that need them
- Have consistent naming per the convention above

For Google Drive sharing, the suggested location is `Audio XX/04_Screenshots/` per the structure described in [`../GOOGLE_DRIVE_EXPORT_GUIDE.md`](../GOOGLE_DRIVE_EXPORT_GUIDE.md).

---

## Maintenance

Screenshots have a shorter useful life than text documentation. UI changes can render a screenshot stale within weeks. Discipline:

- Screenshots are dated on capture (in filename or metadata)
- After significant UI changes, the relevant screenshots should be re-captured
- Stale screenshots should be removed rather than kept indefinitely

A reasonable refresh cadence is quarterly, or after any substantive UI pass that changes structure (not merely colour or typography).
