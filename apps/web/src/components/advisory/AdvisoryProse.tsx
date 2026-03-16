/**
 * Audio XX — Advisory Presentation Layer
 *
 * Core advisory prose body — philosophy + tendencies + system fit.
 * Rendered as flowing paragraphs with no section labels.
 * This is the heart of the advisory response.
 *
 * Comparison responses use \n\n-delimited strings to group per-brand
 * descriptions. Each \n\n segment is rendered as a separate paragraph
 * for visual clarity.
 */

import { renderText } from './render-text';

interface AdvisoryProseProps {
  philosophy?: string;
  tendencies?: string;
  systemFit?: string;
}

/**
 * Split a prose string on double-newlines into separate paragraphs.
 * Single strings without \n\n render as one paragraph (no change).
 */
function renderParagraphs(text: string, isLast: boolean) {
  const segments = text.split(/\n\n/).filter((s) => s.trim().length > 0);
  return segments.map((segment, i) => (
    <p
      key={i}
      style={{
        margin: isLast && i === segments.length - 1 ? 0 : '0 0 0.7rem 0',
      }}
    >
      {renderText(segment.trim())}
    </p>
  ));
}

export default function AdvisoryProse({ philosophy, tendencies, systemFit }: AdvisoryProseProps) {
  if (!philosophy && !tendencies && !systemFit) return null;

  // Determine which is the last populated field for margin control
  const lastField = systemFit ? 'systemFit' : tendencies ? 'tendencies' : 'philosophy';

  return (
    <div
      style={{
        margin: '0 0 1.1rem 0',
        color: '#333',
        fontSize: '0.98rem',
        lineHeight: 1.7,
      }}
    >
      {philosophy && renderParagraphs(philosophy, lastField === 'philosophy')}
      {tendencies && renderParagraphs(tendencies, lastField === 'tendencies')}
      {systemFit && renderParagraphs(systemFit, lastField === 'systemFit')}
    </div>
  );
}
