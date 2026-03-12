'use client';

/**
 * SystemSavePrompt — lightweight card prompting the user to save
 * a system detected from conversation.
 *
 * Phase 5: appears in the advisory output area when a ProposedSystem
 * exists. The user can review+save or dismiss.
 */

import type { ProposedSystem } from '@/lib/system-types';

interface SystemSavePromptProps {
  proposed: ProposedSystem;
  onReviewAndSave: () => void;
  onDismiss: () => void;
}

export default function SystemSavePrompt({ proposed, onReviewAndSave, onDismiss }: SystemSavePromptProps) {
  const componentSummary = proposed.components
    .filter((c) => c.brand || c.name)
    .map((c) => {
      const b = (c.brand || '').trim();
      const n = (c.name || '').trim();
      if (!b) return n;
      if (!n) return b;
      // Avoid "JOB JOB 225" — if name already starts with the brand, skip prefix
      if (n.toLowerCase().startsWith(b.toLowerCase())) return n;
      return `${b} ${n}`;
    })
    .join(', ');

  return (
    <div
      style={{
        margin: '0.75rem 0 1rem',
        padding: '0.75rem 1rem',
        border: '1px solid #d5d5d0',
        borderLeft: '3px solid #b8a040',
        borderRadius: '0 6px 6px 0',
        background: '#fdfcf8',
        fontSize: '0.9rem',
        lineHeight: 1.55,
      }}
    >
      <div style={{ color: '#555', marginBottom: '0.4rem' }}>
        You described a system: <span style={{ fontWeight: 500, color: '#333' }}>{componentSummary}</span>
      </div>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
        <button
          type="button"
          onClick={onReviewAndSave}
          style={{
            padding: '0.3rem 0.7rem',
            border: '1px solid #333',
            borderRadius: 5,
            background: '#333',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontFamily: 'inherit',
          }}
        >
          Review & save
        </button>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            padding: '0.3rem 0.7rem',
            border: '1px solid #d5d5d0',
            borderRadius: 5,
            background: '#fff',
            color: '#888',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontFamily: 'inherit',
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
