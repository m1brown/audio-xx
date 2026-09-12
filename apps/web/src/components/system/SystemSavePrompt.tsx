'use client';

/**
 * SystemSavePrompt — lightweight card prompting the user to save
 * a system detected from conversation.
 *
 * Phase 5: appears in the advisory output area when a ProposedSystem
 * exists. The user can review+save or dismiss.
 */

import type { ProposedSystem } from '@/lib/system-types';
import { useAudioSession } from '@/lib/audio-session-context';

interface SystemSavePromptProps {
  proposed: ProposedSystem;
  onReviewAndSave: () => void;
  onDismiss: () => void;
}

export default function SystemSavePrompt({ proposed, onReviewAndSave, onDismiss }: SystemSavePromptProps) {
  // Shown only when a saved/active system exists — that is the only case in
  // which "did my saved system leak into this?" is a question worth answering.
  const { state: sessionState } = useAudioSession();
  const hasOtherSystem = sessionState.savedSystems.length > 0 || !!sessionState.activeSystemRef;
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
    <div data-print-hide
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
      {proposed.knownSystemMatch && (
        <div
          style={{
            marginBottom: '0.5rem',
            padding: '0.35rem 0.6rem',
            background: '#f4f1e8',
            borderRadius: 4,
            fontSize: '0.82rem',
            color: '#6b5c3e',
            lineHeight: 1.5,
          }}
        >
          <span style={{ fontWeight: 600 }}>{proposed.knownSystemMatch.label}</span>
          {proposed.knownSystemMatch.coreOverlap < 1.0 && (
            <span style={{ fontStyle: 'italic', marginLeft: '0.4rem', opacity: 0.8 }}>
              (partial match)
            </span>
          )}
        </div>
      )}
      <div style={{ color: '#555', marginBottom: '0.4rem' }}>
        {proposed.knownSystemMatch
          ? <>This matches a known system: <span style={{ fontWeight: 500, color: '#333' }}>{componentSummary}</span></>
          : <>You described a system: <span style={{ fontWeight: 500, color: '#333' }}>{componentSummary}</span>
            {/* One reasoning pass (2026-09-12): a listener with a saved
                system active should never wonder whether it leaked into
                this assessment. It did not — the described system replaces
                the saved one for the turn — and this says so where the
                doubt arises. */}
            {hasOtherSystem && (
              <span style={{ display: 'block', fontSize: '0.86em', color: '#8C877F', marginTop: '0.15rem' }}>
                This assessment reads these components only — not your saved system.
              </span>
            )}</>
        }
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
