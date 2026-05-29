'use client';

// React imported explicitly for vitest node-env JSX classic transform.
import React from 'react';

import { COLOR } from '@/lib/editorial-tokens';

/**
 * Audio XX — System Profile card.
 *
 * The §2 *Profile* surface of the System Assessment Artifact. Mirrors
 * the Brand Authority Quick Identity card pattern:
 *   - borderLeft 3px accent + 1px borderLight everywhere else
 *   - cardBg fill
 *   - 4px corner radius
 *   - 1.1rem 1.3rem padding
 *   - 3 rows: what the system IS, what it leans toward, what it trades
 *
 * Each row is labeled with a bold textPrimary inline label followed by
 * descriptive prose. Rows are independently optional — the card renders
 * any subset of the three lines, and renders nothing when all three
 * are missing.
 *
 * Pure presentational component. The orchestrator derives the three
 * lines from the underlying `AdvisoryResponse` shape and passes them in.
 */

interface SystemProfileCardProps {
  /** What the system IS in one short line (topology / character claim). */
  whatItIs?: string;
  /** What the system LEANS TOWARD (sonic signature). */
  whatItLeansToward?: string;
  /** What the system TRADES (primary constraint named without alarm). */
  whatItTrades?: string;
}

interface Row {
  label: string;
  value: string;
}

export default function SystemProfileCard({
  whatItIs,
  whatItLeansToward,
  whatItTrades,
}: SystemProfileCardProps) {
  const rows: Row[] = [];
  if (whatItIs) rows.push({ label: 'What it is', value: whatItIs });
  if (whatItLeansToward) rows.push({ label: 'What it leans toward', value: whatItLeansToward });
  if (whatItTrades) rows.push({ label: 'What it trades', value: whatItTrades });

  if (rows.length === 0) return null;

  return (
    <section
      aria-label="System Profile"
      style={{
        padding: '1.1rem 1.3rem',
        background: COLOR.cardBg,
        border: `1px solid ${COLOR.borderLight}`,
        borderLeft: `3px solid ${COLOR.accent}`,
        borderRadius: '4px',
      }}
    >
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          color: COLOR.textSecondary,
          fontSize: '0.94rem',
          lineHeight: 1.7,
        }}
      >
        {rows.map((row, i) => (
          <li key={row.label} style={{ marginBottom: i === rows.length - 1 ? 0 : '0.25rem' }}>
            <span style={{ fontWeight: 600, color: COLOR.textPrimary }}>{row.label}:</span>{' '}
            {row.value}
          </li>
        ))}
      </ul>
    </section>
  );
}
