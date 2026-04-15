/**
 * SavedSystemsPanel — minimal read-only surface over useSavedSystems().
 *
 * Intentionally bounded:
 *  - lists saved systems (label, role, component count)
 *  - one action: create a new empty system
 *
 * No editing, no advisory integration, no preference modeling, no routing.
 * Any richer interaction belongs in a follow-up step.
 */

'use client';

import { useCallback, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import {
  useSavedSystems,
  createSystem,
  loadAll,
  type SavedSystemProfile,
  type SavedSystemRole,
} from '@/lib/saved-system';

const DEFAULT_ROLE: SavedSystemRole = 'primary';

function countCurrent(system: SavedSystemProfile): number {
  return system.components.filter((c) => c.status === 'current').length;
}

export function SavedSystemsPanel() {
  const { systems, ready, save, remove, rename } = useSavedSystems();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');

  const beginRename = useCallback((id: string, current: string) => {
    setEditingId(id);
    setDraftLabel(current);
  }, []);

  const cancelRename = useCallback(() => {
    setEditingId(null);
    setDraftLabel('');
  }, []);

  const commitRename = useCallback(() => {
    if (editingId === null) return;
    const trimmed = draftLabel.trim();
    if (trimmed.length === 0) return; // reject empty
    rename(editingId, trimmed);
    setEditingId(null);
    setDraftLabel('');
  }, [editingId, draftLabel, rename]);

  const handleEditKey = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitRename();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelRename();
      }
    },
    [commitRename, cancelRename],
  );

  const handleRemove = useCallback(
    (id: string, label: string) => {
      if (typeof window !== 'undefined') {
        const ok = window.confirm(`Remove "${label}"? This cannot be undone.`);
        if (!ok) return;
      }
      remove(id);
    },
    [remove],
  );

  const handleCreate = useCallback(() => {
    // Read the authoritative snapshot from storage rather than React state.
    // Rapid multi-click was producing duplicate labels because `systems.length`
    // was captured from a stale render — three clicks in one tick all saw
    // length === 0 and all produced "Untitled system 1". `loadAll()` is
    // synchronous and reflects every write `save()` has already made.
    const existing = loadAll();
    const existingLabels = new Set(existing.map((s) => s.label));
    let n = existing.length + 1;
    while (existingLabels.has(`Untitled system ${n}`)) n++;
    const fresh = createSystem({
      label: `Untitled system ${n}`,
      role: DEFAULT_ROLE,
    });
    save(fresh);
  }, [save]);

  return (
    <section
      aria-label="Saved systems"
      style={{
        border: '1px solid var(--border, #ddd)',
        borderRadius: 6,
        padding: '1rem',
        maxWidth: 560,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Saved systems</h2>
        <button type="button" onClick={handleCreate} className="btn btn-sm">
          New empty system
        </button>
      </header>

      {!ready ? (
        <p className="muted" style={{ margin: 0 }}>Loading…</p>
      ) : systems.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          No saved systems yet.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {systems.map((s) => {
            const count = countCurrent(s);
            return (
              <li
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  padding: '0.4rem 0',
                  borderTop: '1px solid var(--border-subtle, #eee)',
                }}
              >
                {editingId === s.id ? (
                  <input
                    type="text"
                    value={draftLabel}
                    autoFocus
                    onChange={(e) => setDraftLabel(e.target.value)}
                    onKeyDown={handleEditKey}
                    aria-label={`Rename ${s.label}`}
                    style={{ flex: 1, marginRight: '0.75rem' }}
                  />
                ) : (
                  <Link
                    href={`/systems/saved/${s.id}`}
                    style={{ fontWeight: 500 }}
                  >
                    {s.label}
                  </Link>
                )}
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '0.75rem',
                  }}
                >
                  <span className="muted" style={{ fontSize: '0.85rem' }}>
                    {s.role} · {count} component{count === 1 ? '' : 's'}
                  </span>
                  {editingId === s.id ? (
                    <>
                      <button
                        type="button"
                        onClick={commitRename}
                        disabled={draftLabel.trim().length === 0}
                        className="btn btn-sm"
                        style={{ fontSize: '0.8rem' }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelRename}
                        className="btn btn-sm"
                        style={{ fontSize: '0.8rem' }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => beginRename(s.id, s.label)}
                        aria-label={`Rename ${s.label}`}
                        className="btn btn-sm"
                        style={{ fontSize: '0.8rem' }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(s.id, s.label)}
                        aria-label={`Remove ${s.label}`}
                        className="btn btn-sm"
                        style={{ fontSize: '0.8rem' }}
                      >
                        Remove
                      </button>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default SavedSystemsPanel;
