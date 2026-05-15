/**
 * Audio XX — Right workspace rail.
 *
 * Persistent context surface. Sits at ~296px on the right edge of the
 * desktop workspace and collapses below 1024px viewport.
 *
 * Purpose: keep the listener identity, active system, and recent
 * activity visible across the conversation so each advisory turn can
 * reference "you" and "your system" without the user re-establishing
 * context every message.
 *
 * Tone (pass 6, 2026-05-09 PM): fully monochrome / cool neutral. No
 * saffron, no warm gold, no coral, no beige. Section labels stay in
 * muted uppercase gray (#9A9A9A) as structural eyebrows. Action links
 * (Edit profile →, Manage systems →, the inline "Add one") use a cool
 * slate (#4A5568, matching the existing COLOR.textSecondary token) so
 * they read as clickable but stay neutral. Body text untouched.
 *
 * Data flow: pure presentational — receives the snapshots it needs as
 * props. No state, no business logic, no engine calls.
 *
 * Responsive: parent page hides this rail below 1024px viewport via
 * media query on the workspace grid.
 */

'use client';

import Link from 'next/link';

interface RightRailProps {
  topTraitLabels: string[];
  activeSystemComponents: string[];
  activeSystemName?: string;
  recentActivity: string[];
}

const RAIL = {
  ink: '#3A3A3A',           // softened from #2A2A2A
  inkMuted: '#5A5A5A',      // softened body
  faint: '#9A9A9A',         // section labels + empty states + restraint footer
  rule: '#EDEDED',          // lower-contrast hairline
  link: '#4A5568',          // cool slate — action link text (matches COLOR.textSecondary)
  accent: '#C83A3A',        // restrained brand red — action-link arrow glyphs ONLY
} as const;

/** Section label — uppercase muted-gray eyebrow. Structural marker
 *  for LISTENER / SYSTEM / RECENT without using accent color. */
const SECTION_LABEL_STYLE = {
  fontSize: '0.66rem',
  fontWeight: 600,
  color: RAIL.faint,
  marginBottom: '0.6rem',
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
} as const;

const EMPTY_STATE_STYLE = {
  fontSize: '0.78rem',
  color: RAIL.faint,
  lineHeight: 1.55,
  margin: 0,
} as const;

/** Action link — cool slate, slightly heavier than body. Used for the
 *  per-section deep links ("Edit profile →", "Manage systems →") plus
 *  the inline "Add one" empty-state link. Reads as clickable without
 *  any warm tint. */
const TINY_LINK_STYLE = {
  display: 'inline-block',
  marginTop: '0.5rem',
  fontSize: '0.74rem',
  fontWeight: 500,
  color: RAIL.link,
  textDecoration: 'none',
} as const;

export default function RightRail({
  topTraitLabels,
  activeSystemComponents,
  activeSystemName,
  recentActivity,
}: RightRailProps) {
  const hasListener = topTraitLabels.length > 0;
  const hasSystem = activeSystemComponents.length > 0;
  const hasRecent = recentActivity.length > 0;

  return (
    <aside
      style={{
        position: 'sticky',
        top: '3.25rem',
        alignSelf: 'start',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.4rem',
        borderLeft: `1px solid ${RAIL.rule}`,
        paddingLeft: '1.25rem',
        paddingTop: 0,
      }}
    >
      {/* Listener */}
      <div>
        <div style={SECTION_LABEL_STYLE}>Listener</div>
        {hasListener ? (
          <div
            style={{
              fontSize: '0.84rem',
              lineHeight: 1.55,
              color: RAIL.inkMuted,
            }}
          >
            <div style={{ color: RAIL.ink, marginBottom: '0.15rem' }}>
              You value
            </div>
            <div>{topTraitLabels.join(' · ')}</div>
            <Link href="/profile" style={TINY_LINK_STYLE}>
              Edit profile <span style={{ color: RAIL.accent }}>→</span>
            </Link>
          </div>
        ) : (
          <p style={EMPTY_STATE_STYLE}>
            Tell me what you value in your listening — preferences accumulate
            here as we talk.
          </p>
        )}
      </div>

      <div style={{ borderTop: `1px solid ${RAIL.rule}`, width: '100%' }} />

      {/* System */}
      <div>
        <div style={SECTION_LABEL_STYLE}>System</div>
        {hasSystem ? (
          <div
            style={{
              fontSize: '0.84rem',
              lineHeight: 1.55,
              color: RAIL.inkMuted,
            }}
          >
            {activeSystemName && (
              <div style={{ color: RAIL.ink, marginBottom: '0.3rem' }}>
                {activeSystemName}
              </div>
            )}
            <div>
              {activeSystemComponents.map((c, i) => (
                <span key={i}>
                  {i > 0 && (
                    <span style={{ color: RAIL.faint, margin: '0 0.35rem' }}>→</span>
                  )}
                  <span>{c}</span>
                </span>
              ))}
            </div>
            <Link href="/systems" style={TINY_LINK_STYLE}>
              Manage systems <span style={{ color: RAIL.accent }}>→</span>
            </Link>
          </div>
        ) : (
          <p style={EMPTY_STATE_STYLE}>
            <Link href="/systems" style={{ color: RAIL.link, fontWeight: 500 }}>Add your system</Link> to get
            system-aware reviews and trade-off-honest upgrade paths. Or just type a question to start.
          </p>
        )}
      </div>

      <div style={{ borderTop: `1px solid ${RAIL.rule}`, width: '100%' }} />

      {/* Recent */}
      <div>
        <div style={SECTION_LABEL_STYLE}>Recent</div>
        {hasRecent ? (
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              fontSize: '0.81rem',
              lineHeight: 1.55,
              color: RAIL.inkMuted,
            }}
          >
            {recentActivity.map((item, i) => (
              <li
                key={i}
                style={{
                  marginBottom: '0.35rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={item}
              >
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p style={EMPTY_STATE_STYLE}>
            Recent searches, comparisons, and assessments will appear here.
          </p>
        )}
      </div>

      {/* Restraint footer — quietly persistent, addressing the
       *  philosophy-visibility gap from the prior recommendation
       *  audit. Same softer scale as the section labels. */}
      <div style={{ borderTop: `1px solid ${RAIL.rule}`, width: '100%' }} />
      <p
        style={{
          margin: 0,
          fontSize: '0.74rem',
          color: RAIL.faint,
          lineHeight: 1.55,
        }}
      >
        Doing nothing is also a valid outcome.
      </p>
    </aside>
  );
}
