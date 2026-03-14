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
    return (
      <div style={{ marginBottom: '1.5rem' }}>
        <h3
          style={{
            margin: '0 0 0.65rem 0',
            fontSize: '1.08rem',
            fontWeight: 600,
            color: '#111',
            lineHeight: 1.4,
            letterSpacing: '-0.01em',
          }}
        >
          <span style={{ color: '#c8c0a8', marginRight: '0.35rem', fontWeight: 500 }}>{number}.</span>
          {label}
        </h3>
        {children}
      </div>
    );
  }

  // ── Default uppercase label ──
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div
        style={{
          marginBottom: '0.55rem',
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase' as const,
          color: '#999',
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}
