'use client';

/**
 * SystemBadge — compact indicator of the active system with dropdown chevron.
 *
 * Format: "System: <name> ▼"
 * Always visible when systems exist. Chevron only when multiple systems exist.
 * When no system is active but saved systems exist, shows "Select system ▼".
 */

import { useAudioSession } from '@/lib/audio-session-context';

interface SystemBadgeProps {
  onClick: () => void;
}

export default function SystemBadge({ onClick }: SystemBadgeProps) {
  const { state } = useAudioSession();
  const { activeSystemRef, savedSystems, draftSystem } = state;

  let label: string;
  let isDraft = false;
  const hasMultiple = savedSystems.length > 1 || (savedSystems.length >= 1 && !!draftSystem);

  if (activeSystemRef) {
    if (activeSystemRef.kind === 'draft') {
      if (!draftSystem) return null;
      label = draftSystem.name || 'Draft System';
      isDraft = true;
    } else {
      const saved = savedSystems.find((s) => s.id === activeSystemRef.id);
      if (!saved) return null;
      label = saved.name;
    }
  } else if (savedSystems.length === 1) {
    label = savedSystems[0].name;
  } else if (savedSystems.length > 1) {
    // Multiple systems, none active — show prompt
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.3rem 0.65rem',
          border: '1px dashed #D8D2C5',
          borderRadius: 6,
          background: 'transparent',
          cursor: 'pointer',
          fontSize: '0.82rem',
          color: '#8C877F',
          fontFamily: 'inherit',
          letterSpacing: '0.01em',
          lineHeight: 1.4,
          transition: 'border-color 0.15s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#999'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#D8D2C5'; }}
      >
        <span style={{ fontSize: '0.72rem', color: '#8C877F', fontWeight: 400 }}>System:</span>
        <span>Select system</span>
        <span style={{ fontSize: '0.6rem', marginLeft: '0.1rem', opacity: 0.6 }}>&#9660;</span>
      </button>
    );
  } else {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
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
      <span style={{ fontSize: '0.72rem', color: '#8C877F', fontWeight: 400 }}>System:</span>
      <span style={{ fontWeight: 500, color: '#1F1D1B' }}>{label}</span>
      {isDraft && (
        <span style={{ fontSize: '0.68rem', color: '#b08a00', fontWeight: 500 }}>draft</span>
      )}
      {hasMultiple && (
        <span style={{ fontSize: '0.6rem', marginLeft: '0.1rem', opacity: 0.5 }}>&#9660;</span>
      )}
    </button>
  );
}
