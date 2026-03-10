/**
 * Reusable section wrapper with uppercase label.
 * Used across all advisory sections for consistent visual rhythm.
 */

interface AdvisorySectionProps {
  label: string;
  children: React.ReactNode;
}

export default function AdvisorySection({ label, children }: AdvisorySectionProps) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div
        style={{
          marginBottom: '0.45rem',
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
