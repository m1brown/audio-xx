/**
 * Reusable section wrapper — two visual modes:
 *
 *   1. Default (uppercase label) — small, subdued, all-caps label.
 *      Used for standard advisory sections.
 *
 *   2. Numbered heading — editorial section number + title in sentence case.
 *      Used for memo-format system assessments.
 *
 * Usage:
 *   <AdvisorySection label="Your system">…</AdvisorySection>
 *   <AdvisorySection number={3} label="Strength of Each Component">…</AdvisorySection>
 */

interface AdvisorySectionProps {
  /** Section number — when provided, renders as a numbered heading. */
  number?: number;
  label: string;
  children: React.ReactNode;
}

export default function AdvisorySection({ number, label, children }: AdvisorySectionProps) {
  if (number != null) {
    // ── Numbered heading (memo format) ──
    // Modeled on ChatGPT system evaluation: large, bold numbered sections
    // with generous vertical breathing room.
    return (
      <div style={{ marginBottom: '2rem' }}>
        <h3
          style={{
            margin: '0 0 0.85rem 0',
            fontSize: '1.3rem',
            fontWeight: 700,
            color: '#2a2a2a',
            lineHeight: 1.35,
            letterSpacing: '-0.015em',
          }}
        >
          <span style={{ color: '#a89870', marginRight: '0.4rem', fontWeight: 600 }}>{number}.</span>
          {label}
        </h3>
        {children}
      </div>
    );
  }

  // ── Default uppercase label ──
  return (
    <div style={{ marginBottom: '1.75rem' }}>
      <div
        style={{
          marginBottom: '0.65rem',
          fontSize: '0.78rem',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase' as const,
          color: '#a89870',
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}
