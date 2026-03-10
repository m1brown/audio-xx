/**
 * Core advisory prose body — philosophy + tendencies + system fit.
 * Rendered as flowing paragraphs with no section labels.
 * This is the heart of the advisory response.
 */

interface AdvisoryProseProps {
  philosophy?: string;
  tendencies?: string;
  systemFit?: string;
}

export default function AdvisoryProse({ philosophy, tendencies, systemFit }: AdvisoryProseProps) {
  if (!philosophy && !tendencies && !systemFit) return null;

  return (
    <div
      style={{
        margin: '0 0 1.1rem 0',
        color: '#333',
        fontSize: '0.98rem',
        lineHeight: 1.7,
      }}
    >
      {philosophy && <p style={{ margin: '0 0 0.7rem 0' }}>{philosophy}</p>}
      {tendencies && <p style={{ margin: '0 0 0.7rem 0' }}>{tendencies}</p>}
      {systemFit && <p style={{ margin: 0 }}>{systemFit}</p>}
    </div>
  );
}
