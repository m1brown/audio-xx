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
      <div style={{ marginBottom: '1.25rem' }}>
        <h3
          style={{
            margin: '0 0 0.85rem 0',
            fontSize: '1.35rem',
            fontWeight: 800,
            color: '#1F1D1B',
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
    <div style={{ marginBottom: '1.25rem' }}>
      <div
        style={{
          marginBottom: '0.7rem',
          fontSize: '0.84rem',
          fontWeight: 700,
          letterSpacing: '0.07em',
          textTransform: 'uppercase' as const,
          color: '#96875e',
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}
