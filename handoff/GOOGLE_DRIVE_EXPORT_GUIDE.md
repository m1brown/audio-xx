# Audio XX — Google Drive Export Guide

A practical guide for exporting selected documentation to Google Drive while keeping the GitHub repository as the canonical source of truth. Written for the project author who will set up the Drive structure, and for any operator who will share or maintain documents in it.

---

## Principle

The repository is the source of truth. Google Drive is a sharing surface — useful for selective external review, comment threads with non-technical advisors, and assembling reading packages for prospective collaborators. It is not a place where the canonical version of a document lives.

When a document is exported to Drive, it becomes a snapshot. Subsequent edits to the repository version are not reflected in the Drive copy automatically. The maintenance discipline below describes how to keep drift manageable.

---

## Suggested Drive folder structure

```
Audio XX/
├── 00_Overview/
├── 01_Product/
├── 02_Technical/
├── 03_Roadmap/
├── 04_Screenshots/
├── 05_Operations/
└── 06_Private_Founder_Notes/
```

Each numbered folder serves a specific purpose. The numbering keeps the folder list ordered alphabetically in Drive's default sort.

### `00_Overview/`

The handoff package itself, intended for an external reader. Suggested contents:

- A copy of `handoff/README.md`
- A copy of `handoff/AUDIO_XX_OVERVIEW.md`
- A copy of `handoff/CURRENT_STATE_SUMMARY.md`

Audience: the prospective reader receiving an initial reading invitation.

### `01_Product/`

Product philosophy and identity material. Suggested contents:

- A copy of `/docs/PRODUCT_PHILOSOPHY.md`
- A copy of `/docs/AudioXX_Advisory_Brain.md`
- A copy of `/docs/AudioXX_Advisory_Style_Guide.md`
- A copy of `/docs/AudioXX_Review_Voice.md`
- A copy of `/CLAUDE.md`

Audience: a reader interested in the editorial and reasoning identity of the project. Useful for product or design advisors.

### `02_Technical/`

Architectural and operational technical material. Suggested contents:

- A copy of `handoff/SYSTEM_ARCHITECTURE_SUMMARY.md`
- A copy of `/docs/ARCHITECTURE.md`
- A copy of `/docs/SETUP.md`
- A copy of `/docs/DEPLOYMENT.md`
- A copy of `/docs/QA.md`
- A copy of `/docs/QA_CHECKLIST.md`

Audience: a technically literate reader evaluating implementation. Useful for a prospective technical collaborator.

### `03_Roadmap/`

Forward-looking material. Suggested contents:

- A copy of `handoff/NEXT_STEPS.md`
- A copy of `/docs/ROADMAP.md`
- A copy of `/ROADMAP-SPEAKS-FOR-ITSELF.md`
- A copy of `/docs/implementation-plan.md`

Audience: anyone evaluating where the project is headed.

### `04_Screenshots/`

Visual material. Suggested contents:

- A small set of curated screenshots covering homepage, advisory interaction, comparison flow, and any specific surfaces a reader has asked to see
- A copy of `handoff/SCREENSHOTS/README.md` describing the screenshot plan and what each capture is intended to show

Audience: a reader who wants to see what the running application looks like without setting up a local environment.

### `05_Operations/`

Operational reference material. Suggested contents:

- A copy of `handoff/COLLABORATION_MODEL.md`
- A copy of `/docs/OPERATING_MODEL.md`
- A copy of `/docs/KNOWN_ISSUES.md`
- A copy of `/docs/AFFILIATE_POLICY.md`
- A copy of `/docs/CLAUDE_WORKFLOW.md` (this document is internally toned and references the AI assistant by name; share only with collaborators familiar with the AI-assisted workflow)

Audience: an active or prospective contributor.

### `06_Private_Founder_Notes/`

The project author's private working space. Not for external sharing under any circumstance.

Typical contents:

- Strategy notes
- Speculative direction documents
- Negotiation drafts
- Unfiltered observations
- Material that has not been edited for external readability

Drive's per-folder sharing controls keep this folder restricted regardless of how the parent folder is shared. The folder structure assumes that `06_Private_Founder_Notes/` is set to private even when `Audio XX/` is shared with a specific collaborator.

---

## Which docs are best exported to Google Docs

Some documents in the repository read well as Google Docs and benefit from the comment / suggestion features. Others do not.

### Good candidates for Google Docs export

These read well in document form and benefit from inline commenting:

- `handoff/AUDIO_XX_OVERVIEW.md`
- `handoff/CURRENT_STATE_SUMMARY.md`
- `handoff/COLLABORATION_MODEL.md`
- `handoff/NEXT_STEPS.md`
- `/docs/PRODUCT_PHILOSOPHY.md`
- `/CLAUDE.md`
- `/ROADMAP-SPEAKS-FOR-ITSELF.md`

### Less suitable for Google Docs export

These rely on code-block formatting or technical structure that Google Docs renders awkwardly:

- `handoff/SYSTEM_ARCHITECTURE_SUMMARY.md` (the diagrams render poorly in Docs)
- `/docs/ARCHITECTURE.md` (heavy structural detail)
- `/docs/SETUP.md` (command-line snippets)
- `/docs/DEPLOYMENT.md` (configuration tables and commands)
- `/docs/QA_CHECKLIST.md` (best as a checklist, not a Doc)
- The trait framework specification

Keep these as Markdown files (the format the repository uses for documentation) in the repository or share them as `.md` attachments. If a Google Docs version is needed for review, export it as PDF rather than as a native Doc to preserve formatting.

### Export workflow

Markdown to Google Docs conversion is imperfect. The recommended approach:

1. Open the Markdown file in any rendered Markdown viewer (GitHub displays Markdown automatically; many code editors have a preview mode)
2. Copy the rendered content
3. Paste into a new Google Doc
4. Manually adjust headings, code blocks, and tables as needed
5. Tag the document with a footer noting the source path and a date stamp: *"Sourced from `handoff/AUDIO_XX_OVERVIEW.md` on YYYY-MM-DD. Refer to GitHub for current version."*

The footer is the discipline that keeps drift manageable. Anyone reading the Doc knows it is a snapshot.

---

## What should remain private

Material that should not be shared externally under any circumstance, regardless of audience:

- Environment variable values (production credentials, API keys, database connection strings)
- The contents of `apps/web/.env.local` (the local environment file that holds secrets)
- Vercel project configuration screenshots
- Sentry project URLs and DSN values (the Data Source Name is the credential that lets the application report errors to Sentry)
- Commercial agreements, partnership drafts, or affiliate negotiations
- Strategic notes about specific potential collaborators or partners
- Anything in `06_Private_Founder_Notes/`

Material that should be shared selectively, with the audience considered:

- Documentation that mentions specific tools or assistants by name (`/docs/CLAUDE_WORKFLOW.md`)
- Documents that describe ongoing limitations in candid detail
- Roadmap documents that include effort estimates

Material that is appropriate for broad external sharing:

- The handoff package (`handoff/`) in full
- The product philosophy (`/docs/PRODUCT_PHILOSOPHY.md`)
- The behavioural specification (`/CLAUDE.md`)
- The project README (`/README.md`)

When in doubt, default to less sharing rather than more.

---

## Maintaining GitHub as canonical source of truth

The discipline that keeps drift manageable:

1. **Edits to canonical content happen in the repository, not in Drive.** A reader leaving comments in a Drive copy is providing input; the project author or a contributor reflects substantive changes back into the repository version. The Drive copy is then either updated from the new repository version or marked stale.

2. **Each Drive document carries a footer naming its source.** Format: *"Sourced from `<path>` on YYYY-MM-DD. Refer to GitHub for current version."* This makes drift visible to any reader.

3. **A documentation-update commit refreshes Drive copies of the affected documents.** When a substantive change ships to a document in `handoff/` or `/docs/`, the Drive equivalent is either re-exported or noted as stale.

4. **Public Drive folders are reviewed periodically.** A quarterly review confirms that shared documents are still appropriate for the audiences they were shared with, and that any private content has not crept into public folders.

5. **Sharing settings are deliberate.** Drive's default share settings often favour broader access than is appropriate. Each document or folder should have its sharing setting reviewed at the time of sharing rather than relied on to remain restrictive by default.

---

## How to avoid doc drift between repo and Drive

The most reliable mechanism: **make Drive copies obvious snapshots, not active documents**.

Concretely:

- Document path footers (described above) name the source
- Document titles in Drive optionally include a date suffix: "Audio XX — Overview (2026-05-09)"
- For high-traffic documents, consider linking back to the repository version rather than maintaining a Drive copy at all

Avoid:

- Maintaining parallel copies that both receive edits
- Long-running Drive documents that have diverged from their repository origin
- Sharing Drive documents without the source footer
- Treating a Drive document as canonical when a repository version exists

When a Drive document begins receiving substantive edits that have not been reflected back to the repository, the canonical content is at risk of drifting. The recovery is straightforward — reflect the edits back, then either re-export or remove the Drive copy — but it requires explicit attention.

---

## Recommended initial Drive setup

For a project author setting up the Drive structure for the first time:

1. Create the `Audio XX/` parent folder
2. Create the seven subfolders with their numbered prefixes
3. Set sharing on `06_Private_Founder_Notes/` to private (overriding any inherited sharing on the parent)
4. Populate `00_Overview/`, `01_Product/`, `02_Technical/`, `03_Roadmap/`, `05_Operations/` with the relevant exports
5. Add the source footer to each exported document
6. Review sharing settings on every document before the first external share

Subsequent maintenance is event-driven: when a substantive change lands in the repository, refresh the corresponding Drive copy or mark it stale.

This setup takes approximately one to two hours of focused effort and pays back across every subsequent external share.
