/**
 * /systems/saved/[id] — minimal per-system detail page.
 *
 * Read-only. Shows label, role, and components grouped by slot.
 * No editing, no advisory integration.
 */

'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  useSavedSystems,
  addComponent,
  removeComponent,
  setActiveSavedSystemId,
  type SavedSystemSlot,
} from '@/lib/saved-system';

const SLOT_ORDER: SavedSystemSlot[] = [
  'source',
  'dac',
  'pre',
  'power',
  'integrated',
  'speaker',
  'headphone',
  'cartridge',
  'cable',
];

export default function SavedSystemDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { systems, ready, save } = useSavedSystems();

  // Mark this system as the active saved system while the detail page
  // is mounted. Step 1 of the advisory bridge — not yet consumed anywhere.
  useEffect(() => {
    if (!id) return;
    setActiveSavedSystemId(id);
  }, [id]);

  const [slot, setSlot] = useState<SavedSystemSlot>('source');
  const [freeText, setFreeText] = useState('');

  const handleAdd = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const trimmed = freeText.trim();
      if (trimmed.length === 0) return;
      const current = systems.find((s) => s.id === id);
      if (!current) return;
      const next = addComponent(current, { slot, freeText: trimmed });
      save(next);
      setFreeText('');
      // slot selection intentionally preserved across adds
    },
    [systems, id, slot, freeText, save],
  );

  const handleRemoveComponent = useCallback(
    (componentId: string) => {
      const current = systems.find((s) => s.id === id);
      if (!current) return;
      const next = removeComponent(current, componentId);
      save(next);
    },
    [systems, id, save],
  );

  if (!ready) {
    return <div style={{ padding: '1.5rem' }}><p className="muted">Loading…</p></div>;
  }

  const system = systems.find((s) => s.id === id);

  if (!system) {
    return (
      <div style={{ padding: '1.5rem' }}>
        <p className="muted">System not found.</p>
        <p><Link href="/systems/saved">← Back to saved systems</Link></p>
      </div>
    );
  }

  const bySlot = SLOT_ORDER
    .map((slot) => ({
      slot,
      rows: system.components.filter((c) => c.slot === slot),
    }))
    .filter((g) => g.rows.length > 0);

  return (
    <div style={{ padding: '1.5rem', maxWidth: 640 }}>
      <p style={{ marginBottom: '0.75rem' }}>
        <Link href="/systems/saved">← Back to saved systems</Link>
      </p>

      <header style={{ marginBottom: '1rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>{system.label}</h1>
        <p className="muted" style={{ margin: '0.25rem 0 0' }}>
          Role: {system.role}
        </p>
      </header>

      <form
        onSubmit={handleAdd}
        aria-label="Add component"
        style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          marginBottom: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <select
          value={slot}
          onChange={(e) => setSlot(e.target.value as SavedSystemSlot)}
          aria-label="Slot"
        >
          {SLOT_ORDER.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="text"
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="Component name"
          aria-label="Component name"
          style={{ flex: 1, minWidth: 200 }}
        />
        <button
          type="submit"
          className="btn btn-sm"
          disabled={freeText.trim().length === 0}
        >
          Add
        </button>
      </form>

      <section aria-label="Components">
        <h2 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Components</h2>
        {system.components.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No components yet.</p>
        ) : (
          bySlot.map(({ slot, rows }) => (
            <div key={slot} style={{ marginBottom: '0.75rem' }}>
              <h3
                style={{
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  margin: '0 0 0.25rem',
                  opacity: 0.7,
                }}
              >
                {slot}
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {rows.map((row) => (
                  <li
                    key={row.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '0.25rem 0',
                      borderTop: '1px solid var(--border-subtle, #eee)',
                    }}
                  >
                    <span>{row.productId ?? row.freeText ?? '(unspecified)'}</span>
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '0.75rem',
                      }}
                    >
                      <span className="muted" style={{ fontSize: '0.85rem' }}>
                        {row.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveComponent(row.id)}
                        aria-label={`Remove ${row.freeText ?? row.productId ?? 'component'}`}
                        className="btn btn-sm"
                        style={{ fontSize: '0.75rem' }}
                      >
                        Remove
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
