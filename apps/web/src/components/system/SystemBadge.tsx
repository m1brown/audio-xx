'use client';

/**
 * SystemBadge — compact indicator of the active system.
 *
 * Shows the active system name (saved or draft) as a clickable badge.
 * Renders nothing when no system is active.
 *
 * Phase 4: minimal UI, no styling polish.
 */

import { useAudioSession } from '@/lib/audio-session-context';

interface SystemBadgeProps {
  onClick: () => void;
}

export default function SystemBadge({ onClick }: SystemBadgeProps) {
  const { state } = useAudioSession();
  const { activeSystemRef, savedSystems, draftSystem } = state;

  if (!activeSystemRef) return null;

  let label: string;
  let isDraft = false;

  if (activeSystemRef.kind === 'draft') {
    if (!draftSystem) return null;
    label = draftSystem.name || 'Draft System';
    isDraft = true;
  } else {
    const saved = savedSystems.find((s) => s.id === activeSystemRef.id);
    if (!saved) return null;
    label = saved.name;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.3rem 0.65rem',
        border: '1px solid #d5d5d0',
        borderRadius: 6,
        background: isDraft ? '#faf7f0' : '#fff',
        cursor: 'pointer',
        fontSize: '0.82rem',
        color: '#555',
        fontFamily: 'inherit',
        letterSpacing: '0.01em',
        lineHeight: 1.4,
        transition: 'border-color 0.15s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#999'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#d5d5d0'; }}
    >
      <span style={{ fontSize: '0.72rem', opacity: 0.6 }}>●</span>
      {label}
      {isDraft && (
        <span style={{ fontSize: '0.72rem', color: '#b08a00', fontWeight: 500 }}>draft</span>
      )}
    </button>
  );
}
