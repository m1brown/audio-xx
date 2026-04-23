'use client';

/**
 * Systems listing page — shows all saved systems with 1-click activation.
 *
 * Clicking a system row sets it as the active system and navigates home.
 * The active system is visually highlighted with an "Active system" label.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useAudioSession } from '@/lib/audio-session-context';

interface System {
  id: string;
  name: string;
  notes: string | null;
  updatedAt: string;
  components: Array<{ name: string; brand: string; category: string }>;
}

export default function SystemsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [systems, setSystems] = useState<System[]>([]);
  const { state: audioState, helpers } = useAudioSession();

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
    if (status === 'authenticated') {
      fetch('/api/systems').then((r) => r.json()).then(setSystems);
    }
  }, [status, router]);

  if (status !== 'authenticated') return null;

  const activeId = audioState.activeSystemRef?.kind === 'saved'
    ? audioState.activeSystemRef.id
    : audioState.savedSystems.length === 1
      ? audioState.savedSystems[0]?.id
      : null;

  const handleSelectSystem = async (id: string) => {
    await helpers.setActiveSavedSystem(id);
    router.push('/');
  };

  return (
    <div>
      <div className="flex-between mb-2">
        <h1>Systems</h1>
        <Link href="/systems/new" className="btn btn-primary btn-sm">New system</Link>
      </div>

      {systems.length === 0 ? (
        <p className="muted">No systems yet. Create one to get started.</p>
      ) : (
        systems.map((sys) => {
          const isActive = sys.id === activeId;
          return (
            <div
              key={sys.id}
              role="button"
              tabIndex={0}
              onClick={() => handleSelectSystem(sys.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectSystem(sys.id); }}
              className="item-row"
              style={{
                cursor: 'pointer',
                background: isActive ? 'rgba(176,141,87,0.06)' : undefined,
                borderLeft: isActive ? '3px solid #B08D57' : '3px solid transparent',
                transition: 'background 0.15s ease, border-color 0.15s ease',
                position: 'relative',
              }}
            >
              <div className="flex-between">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    onClick={(e) => { e.stopPropagation(); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.stopPropagation(); }}
                    role="presentation"
                  >
                    <Link
                      href={`/systems/${sys.id}`}
                      style={{ fontWeight: isActive ? 600 : undefined }}
                    >
                      {sys.name}
                    </Link>
                  </span>
                  {isActive && (
                    <span style={{
                      fontSize: '0.68rem',
                      color: '#B08D57',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      background: 'rgba(176,141,87,0.08)',
                      padding: '0.1rem 0.35rem',
                      borderRadius: 3,
                    }}>
                      Active system
                    </span>
                  )}
                </div>
                <span className="small muted">{new Date(sys.updatedAt).toLocaleDateString()}</span>
              </div>
              {sys.notes && <p className="small muted">{sys.notes}</p>}
              {sys.components.length > 0 && (
                <p className="small muted mt-1">
                  {sys.components.filter((sc) => sc.brand && sc.name).map((sc) => `${sc.brand} ${sc.name}`).join(' · ')}
                </p>
              )}
              {!isActive && (
                <span style={{
                  position: 'absolute',
                  right: '0.85rem',
                  bottom: '0.5rem',
                  fontSize: '0.72rem',
                  color: '#8C877F',
                  opacity: 0,
                  transition: 'opacity 0.15s ease',
                }} className="select-hint">
                  Click to activate
                </span>
              )}
            </div>
          );
        })
      )}

      <style>{`
        .item-row:hover .select-hint { opacity: 1 !important; }
        .item-row:hover { background: rgba(176,141,87,0.04) !important; }
      `}</style>
    </div>
  );
}
