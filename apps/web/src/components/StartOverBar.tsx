'use client';

import { useRouter } from 'next/navigation';
import { useAudioSession } from '@/lib/audio-session-context';

export default function StartOverBar() {
  const router = useRouter();
  const { dispatch } = useAudioSession();

  function handleStartOver() {
    // Clear persistent system state
    dispatch({ type: 'CLEAR_SYSTEM_STATE' });

    // Clear storage keys used by audio-session-context
    try {
      sessionStorage.removeItem('audioxx:draft-system');
      localStorage.removeItem('audioxx.systems.v1');
      localStorage.removeItem('audioxx.active-system.v1');
    } catch {
      // Storage may be unavailable — safe to ignore
    }

    // Navigate home (page remount resets conversation state)
    router.push('/');
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '1.25rem 1.5rem 0',
        marginTop: '3rem',
      }}
    >
      <button
        onClick={handleStartOver}
        style={{
          padding: '0.75rem 1.25rem',
          fontSize: '0.85rem',
          fontWeight: 500,
          color: '#888',
          background: '#fafaf8',
          border: '1px solid #e0ddd8',
          borderRadius: '7px',
          cursor: 'pointer',
          letterSpacing: '0.01em',
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#f0ede6';
          e.currentTarget.style.color = '#666';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#fafaf8';
          e.currentTarget.style.color = '#888';
        }}
      >
        Start Over
      </button>
    </div>
  );
}
