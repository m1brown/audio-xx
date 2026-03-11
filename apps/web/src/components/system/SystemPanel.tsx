'use client';

/**
 * SystemPanel — list of saved and draft systems with selection controls.
 *
 * Displayed as an overlay/dropdown when the user clicks the SystemBadge
 * or wants to manage systems. Allows switching the active system,
 * viewing component counts, and creating new systems.
 *
 * Phase 4: minimal functional UI.
 */

import { useAudioSession } from '@/lib/audio-session-context';

interface SystemPanelProps {
  onClose: () => void;
  onCreateNew: () => void;
  onEditDraft: () => void;
}

export default function SystemPanel({ onClose, onCreateNew, onEditDraft }: SystemPanelProps) {
  const { state, dispatch, helpers } = useAudioSession();
  const { activeSystemRef, savedSystems, draftSystem } = state;

  const isActiveRef = (kind: 'saved' | 'draft', id?: string): boolean => {
    if (!activeSystemRef) return false;
    if (kind === 'draft') return activeSystemRef.kind === 'draft';
    return activeSystemRef.kind === 'saved' && activeSystemRef.id === id;
  };

  const handleSelectSaved = async (id: string) => {
    await helpers.setActiveSavedSystem(id);
  };

  const handleSelectDraft = () => {
    dispatch({ type: 'SET_ACTIVE_SYSTEM', ref: { kind: 'draft' } });
  };

  const handleClearActive = async () => {
    await helpers.clearActiveSystem();
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: 4,
        minWidth: 280,
        maxWidth: 360,
        border: '1px solid #d5d5d0',
        borderRadius: 8,
        background: '#fff',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        zIndex: 100,
        fontSize: '0.9rem',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '0.6rem 0.85rem',
          borderBottom: '1px solid #eee',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#333', letterSpacing: '0.02em' }}>
          Systems
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem',
            color: '#999',
            padding: '0 0.2rem',
            fontFamily: 'inherit',
          }}
        >
          ×
        </button>
      </div>

      {/* Draft system (if exists) */}
      {draftSystem && (
        <div
          style={{
            padding: '0.5rem 0.85rem',
            borderBottom: '1px solid #f0f0ee',
            background: isActiveRef('draft') ? '#f5f5f0' : 'transparent',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleSelectDraft}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                textAlign: 'left',
                fontFamily: 'inherit',
                fontSize: '0.88rem',
                color: '#333',
                fontWeight: isActiveRef('draft') ? 600 : 400,
              }}
            >
              {draftSystem.name || 'Draft System'}
              <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', color: '#b08a00', fontWeight: 500 }}>
                draft
              </span>
            </button>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#999' }}>
                {draftSystem.components.length} {draftSystem.components.length === 1 ? 'component' : 'components'}
              </span>
              <button
                type="button"
                onClick={onEditDraft}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  color: '#888',
                  fontFamily: 'inherit',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saved systems */}
      {savedSystems.length > 0 && (
        <div>
          {savedSystems.map((sys) => (
            <div
              key={sys.id}
              style={{
                padding: '0.5rem 0.85rem',
                borderBottom: '1px solid #f0f0ee',
                background: isActiveRef('saved', sys.id) ? '#f5f5f0' : 'transparent',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <button
                type="button"
                onClick={() => handleSelectSaved(sys.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  fontSize: '0.88rem',
                  color: '#333',
                  fontWeight: isActiveRef('saved', sys.id) ? 600 : 400,
                }}
              >
                {sys.name}
              </button>
              <span style={{ fontSize: '0.75rem', color: '#999' }}>
                {sys.components.length} {sys.components.length === 1 ? 'component' : 'components'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {savedSystems.length === 0 && !draftSystem && (
        <div style={{ padding: '1rem 0.85rem', color: '#999', fontSize: '0.85rem', textAlign: 'center' }}>
          No systems configured yet.
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          padding: '0.5rem 0.85rem',
          borderTop: '1px solid #eee',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          onClick={onCreateNew}
          style={{
            background: 'none',
            border: '1px solid #d5d5d0',
            borderRadius: 5,
            padding: '0.3rem 0.6rem',
            cursor: 'pointer',
            fontSize: '0.8rem',
            color: '#555',
            fontFamily: 'inherit',
          }}
        >
          + New system
        </button>
        {activeSystemRef && (
          <button
            type="button"
            onClick={handleClearActive}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.78rem',
              color: '#999',
              fontFamily: 'inherit',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            clear active
          </button>
        )}
      </div>
    </div>
  );
}
