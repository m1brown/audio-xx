'use client';

/**
 * SystemPanel — dropdown for switching and managing systems.
 *
 * Shows all saved systems and draft system with 1-click selection.
 * Active system is highlighted with "Active system" label and left border.
 * Component names shown inline as faded text for quick identification.
 * Calls onSwitch(name) after selecting a system so the parent can show a toast.
 */

import Link from 'next/link';
import { useAudioSession } from '@/lib/audio-session-context';

interface SystemPanelProps {
  onClose: () => void;
  onCreateNew: () => void;
  onEditDraft: () => void;
  /** Called after a system is selected with the system name — for toast feedback. */
  onSwitch?: (systemName: string) => void;
}

/** Summarize component names into a short preview string. */
function componentPreview(components: Array<{ name: string; brand: string }>): string {
  if (components.length === 0) return '';
  const names = components
    .slice(0, 4)
    .map((c) => {
      const b = (c.brand || '').trim();
      const n = (c.name || '').trim();
      if (!b) return n || 'Unknown';
      if (n.toLowerCase().startsWith(b.toLowerCase())) return n;
      return `${b} ${n}`;
    });
  const suffix = components.length > 4 ? ` +${components.length - 4}` : '';
  return names.join(' · ') + suffix;
}

export default function SystemPanel({ onClose, onCreateNew, onEditDraft, onSwitch }: SystemPanelProps) {
  const { state, dispatch, helpers } = useAudioSession();
  const { activeSystemRef, savedSystems, draftSystem } = state;

  const isActiveRef = (kind: 'saved' | 'draft', id?: string): boolean => {
    if (!activeSystemRef) {
      // Auto-activated: single saved system
      if (kind === 'saved' && savedSystems.length === 1 && savedSystems[0].id === id) return true;
      return false;
    }
    if (kind === 'draft') return activeSystemRef.kind === 'draft';
    return activeSystemRef.kind === 'saved' && activeSystemRef.id === id;
  };

  const handleSelectSaved = async (id: string, name: string) => {
    await helpers.setActiveSavedSystem(id);
    onSwitch?.(name);
    onClose();
  };

  const handleSelectDraft = () => {
    dispatch({ type: 'SET_ACTIVE_SYSTEM', ref: { kind: 'draft' } });
    onSwitch?.(draftSystem?.name || 'Draft System');
    onClose();
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
        minWidth: 300,
        maxWidth: 380,
        border: '1px solid #D8D2C5',
        borderRadius: 8,
        background: '#FFFEFA',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        zIndex: 100,
        fontSize: '0.9rem',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '0.6rem 0.85rem',
          borderBottom: '1px solid #E8E3D7',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#1F1D1B', letterSpacing: '0.02em' }}>
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
            color: '#8C877F',
            padding: '0 0.2rem',
            fontFamily: 'inherit',
          }}
        >
          &times;
        </button>
      </div>

      {/* Draft system (if exists) */}
      {draftSystem && (() => {
        const isActive = isActiveRef('draft');
        return (
          <button
            type="button"
            onClick={handleSelectDraft}
            style={{
              display: 'block',
              width: '100%',
              padding: '0.55rem 0.85rem',
              background: isActive ? 'rgba(176,141,87,0.06)' : 'transparent',
              border: 'none',
              borderLeft: isActive ? '3px solid #B08D57' : '3px solid transparent',
              borderBottom: '1px solid #E8E3D7',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              transition: 'background 0.1s ease, border-color 0.15s ease',
              position: 'relative',
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#F7F3EB'; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = isActive ? 'rgba(176,141,87,0.06)' : 'transparent'; }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{
                  fontSize: '0.88rem',
                  color: '#1F1D1B',
                  fontWeight: isActive ? 600 : 400,
                }}>
                  {draftSystem.name || 'Draft System'}
                </span>
                <span style={{ fontSize: '0.68rem', color: '#b08a00', fontWeight: 500, background: 'rgba(176,138,0,0.08)', padding: '0.05rem 0.3rem', borderRadius: 3 }}>
                  draft
                </span>
                {isActive && (
                  <span style={{ fontSize: '0.65rem', color: '#B08D57', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', background: 'rgba(176,141,87,0.08)', padding: '0.08rem 0.3rem', borderRadius: 3 }}>
                    Active system
                  </span>
                )}
              </div>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onEditDraft(); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onEditDraft(); } }}
                style={{
                  fontSize: '0.72rem',
                  color: '#8C877F',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                edit
              </span>
            </div>
            {draftSystem.components.length > 0 && (
              <div style={{ fontSize: '0.74rem', color: '#8C877F', marginTop: '0.2rem', lineHeight: 1.3 }}>
                {componentPreview(draftSystem.components)}
              </div>
            )}
            {!isActive && (
              <span className="panel-switch-hint" style={{
                position: 'absolute',
                right: '0.85rem',
                bottom: '0.35rem',
                fontSize: '0.68rem',
                color: '#8C877F',
                opacity: 0,
                transition: 'opacity 0.15s ease',
              }}>
                Click to switch
              </span>
            )}
          </button>
        );
      })()}

      {/* Saved systems */}
      {savedSystems.length > 0 && (
        <div>
          {savedSystems.map((sys) => {
            const isActive = isActiveRef('saved', sys.id);
            return (
              <button
                key={sys.id}
                type="button"
                onClick={() => handleSelectSaved(sys.id, sys.name)}
                className="panel-system-row"
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '0.55rem 0.85rem',
                  background: isActive ? 'rgba(176,141,87,0.06)' : 'transparent',
                  border: 'none',
                  borderLeft: isActive ? '3px solid #B08D57' : '3px solid transparent',
                  borderBottom: '1px solid #E8E3D7',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  transition: 'background 0.1s ease, border-color 0.15s ease',
                  position: 'relative',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#F7F3EB'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = isActive ? 'rgba(176,141,87,0.06)' : 'transparent'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{
                      fontSize: '0.88rem',
                      color: '#1F1D1B',
                      fontWeight: isActive ? 600 : 400,
                    }}>
                      {sys.name}
                    </span>
                    {isActive && (
                      <span style={{ fontSize: '0.65rem', color: '#B08D57', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', background: 'rgba(176,141,87,0.08)', padding: '0.08rem 0.3rem', borderRadius: 3 }}>
                        Active system
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#8C877F' }}>
                    {sys.components.length} {sys.components.length === 1 ? 'component' : 'components'}
                  </span>
                </div>
                {sys.components.length > 0 && (
                  <div style={{ fontSize: '0.74rem', color: '#8C877F', marginTop: '0.2rem', lineHeight: 1.3 }}>
                    {componentPreview(sys.components)}
                  </div>
                )}
                {!isActive && (
                  <span className="panel-switch-hint" style={{
                    position: 'absolute',
                    right: '0.85rem',
                    bottom: '0.35rem',
                    fontSize: '0.68rem',
                    color: '#8C877F',
                    opacity: 0,
                    transition: 'opacity 0.15s ease',
                  }}>
                    Click to switch
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {savedSystems.length === 0 && !draftSystem && (
        <div style={{ padding: '1rem 0.85rem', color: '#8C877F', fontSize: '0.85rem', textAlign: 'center' }}>
          No systems configured yet.
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          padding: '0.5rem 0.85rem',
          borderTop: '1px solid #E8E3D7',
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
            border: '1px solid #D8D2C5',
            borderRadius: 5,
            padding: '0.3rem 0.6rem',
            cursor: 'pointer',
            fontSize: '0.78rem',
            color: '#5C5852',
            fontFamily: 'inherit',
            transition: 'border-color 0.15s ease',
          }}
        >
          + Add / edit system
        </button>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {activeSystemRef && (
            <button
              type="button"
              onClick={handleClearActive}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.72rem',
                color: '#8C877F',
                fontFamily: 'inherit',
                textDecoration: 'underline',
                textDecorationColor: '#D8D2C5',
                textUnderlineOffset: '2px',
                padding: 0,
              }}
            >
              clear active
            </button>
          )}
          <Link
            href="/systems"
            onClick={onClose}
            style={{
              fontSize: '0.72rem',
              color: '#8C877F',
              textDecoration: 'none',
              fontFamily: 'inherit',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#5C5852'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#8C877F'; }}
          >
            Manage systems &rarr;
          </Link>
        </div>
      </div>

      {/* Hover styles for switch hint */}
      <style>{`
        .panel-system-row:hover .panel-switch-hint,
        button:hover > .panel-switch-hint { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
