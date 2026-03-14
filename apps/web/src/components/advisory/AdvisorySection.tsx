/**
 * Reusable section wrapper — two visual modes:
 *
 *   1. Default (uppercase label) — small, subdued, all-caps label.
 *      Used for standard advisory sections.
 *
 *   2. Numbered heading — bold section number + title in sentence case.
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
      <div style={{ marginBottom: '1.4rem' }}>
        <h3
          style={{
            margin: '0 0 0.55rem 0',
            fontSize: '1.05rem',
            fontWeight: 700,
            color: '#222',
            lineHeight: 1.4,
          }}
        >
          {number}. {label}
        </h3>
        {children}
      </div>
    );
  }

  // ── Default uppercase label ──
  return (
    <div style={{ marginBottom: '1.4rem' }}>
      <div
        style={{
          marginBottom: '0.5rem',
          fontSize: '0.78rem',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase' as const,
          color: '#888',
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}
