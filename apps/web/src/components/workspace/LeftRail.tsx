/**
 * Audio XX — Left workspace rail.
 *
 * Persistent navigation + context anchor. Sits at ~184px on the left
 * edge of the desktop workspace and collapses below 1024px viewport.
 *
 * Tone (pass 7, 2026-05-09 PM): the rail is workspace/homepage-only
 * for now — it only mounts inside `app/page.tsx` (the `/` route).
 * Because of that scope, "Conversation" is by definition the current
 * workspace item whenever the rail is visible. We removed
 * `usePathname()` (it was dead code in the rail's mount context) and
 * hardcoded Conversation as the current item. Conversation is now a
 * button rather than a link — clicking it calls `onReset` to clear
 * the conversation in place rather than performing a no-op route
 * change to `/`.
 *
 * The other rail items (Systems, Listening profile, How It Works,
 * Glossary, Resources) remain regular `<Link>` anchors. They navigate
 * away from the workspace; their active state is not represented here
 * (the rail isn't on those pages, so there's nothing to highlight).
 *
 * Saffron usage in this file: NONE.
 *
 * Data flow: pure presentational. No client hooks beyond the reset
 * callback the parent passes in.
 *
 * Responsive: parent page hides this rail below 1024px viewport via
 * media query on the workspace grid.
 */

'use client';

import Link from 'next/link';

interface LeftRailProps {
  /** Click handler for both the accent rule and the Conversation
   *  workspace item — resets the conversation in place. */
  onReset: () => void;
}

const RAIL = {
  ink: '#2A2A2A',           // dark charcoal — current workspace item
  inkMuted: '#5A5A5A',      // soft body — idle nav links
  faint: '#9A9A9A',         // section eyebrows
  rule: '#EDEDED',          // low-contrast hairline
  mark: '#C8C8C8',          // cool light gray — kept as a token for hairlines / inactive marks
  accent: '#C83A3A',        // restrained brand red — top accent rule + active left border ONLY
} as const;

/** Soft section eyebrow — uppercase, small scale, faint gray. Marks the
 *  group ("Workspace" / "Reference") without competing with the nav
 *  items below it. */
const SECTION_EYEBROW_STYLE = {
  fontSize: '0.66rem',
  fontWeight: 500,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  color: RAIL.faint,
  marginBottom: '0.55rem',
} as const;

/** Shared visual base for all rail nav items (Conversation button +
 *  the regular Link items). Keeps the button and the anchors visually
 *  identical so they read as a single nav list. */
const NAV_ITEM_BASE: React.CSSProperties = {
  display: 'block',
  padding: '0.3rem 0 0.3rem 0.65rem',
  marginLeft: '-0.65rem',
  borderTop: 'none',
  borderRight: 'none',
  borderBottom: 'none',
  borderLeft: '2px solid transparent',
  fontSize: '0.82rem',
  letterSpacing: 0,
  lineHeight: 1.5,
  textDecoration: 'none',
  fontFamily: 'inherit',
  background: 'transparent',
  textAlign: 'left',
};

/** Idle nav link — muted-gray text, transparent left border (preserves
 *  indent so the row doesn't shift when other items become active). */
function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        ...NAV_ITEM_BASE,
        fontWeight: 400,
        color: RAIL.inkMuted,
      }}
    >
      {label}
    </Link>
  );
}

/** Conversation — the current workspace item. Hardcoded as active
 *  because the rail only renders on `/`. Clicking it calls onReset
 *  rather than performing a no-op `<Link href="/">` navigation. */
function ConversationItem({ onReset }: { onReset: () => void }) {
  return (
    <button
      type="button"
      onClick={onReset}
      aria-current="page"
      style={{
        ...NAV_ITEM_BASE,
        // Pass-8 accent restoration: active left border picks up the
        // restrained brand red. Text stays charcoal — only the small
        // 2px-wide indicator carries color, keeping the row quiet.
        borderLeft: `2px solid ${RAIL.accent}`,
        fontWeight: 500,
        color: RAIL.ink,
        cursor: 'pointer',
      }}
    >
      Conversation
    </button>
  );
}

export default function LeftRail({ onReset }: LeftRailProps) {
  return (
    <aside
      style={{
        position: 'sticky',
        top: '3.25rem',
        alignSelf: 'start',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.4rem',
        // Single faint right-edge hairline. No padding-right inside the
        // rail's items — keeps the navigation feel ambient rather than
        // contained.
        borderRight: `1px solid ${RAIL.rule}`,
        paddingRight: '1.1rem',
        paddingTop: 0,
      }}
    >
      {/* Reset affordance — the small top accent rule. Pass-8 picks
       *  up the restrained brand red so this 24px mark visually rhymes
       *  with the 40px main-column accent rule and the XX span — a
       *  single tiny identity gesture across the workspace. Doubles
       *  as a click target. */}
      <div
        onClick={onReset}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onReset(); }}
        style={{
          borderTop: `2px solid ${RAIL.accent}`,
          width: 24,
          cursor: 'pointer',
        }}
        aria-label="Reset conversation"
      />

      {/* Workspace nav — Conversation is the current item; the others
       *  navigate away. */}
      <nav aria-label="Workspace" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={SECTION_EYEBROW_STYLE}>Workspace</div>
        <ConversationItem onReset={onReset} />
        <NavLink href="/systems" label="Systems" />
        <NavLink href="/profile" label="Listening profile" />
      </nav>

      <div style={{ borderTop: `1px solid ${RAIL.rule}`, width: '100%' }} />

      {/* Reference nav — supporting pages. Casing matches the top nav
       *  ("How It Works") for label consistency between surfaces. */}
      <nav aria-label="Reference" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={SECTION_EYEBROW_STYLE}>Reference</div>
        <NavLink href="/how-it-works" label="How It Works" />
        <NavLink href="/glossary" label="Glossary" />
        <NavLink href="/resources" label="Resources" />
      </nav>
    </aside>
  );
}
