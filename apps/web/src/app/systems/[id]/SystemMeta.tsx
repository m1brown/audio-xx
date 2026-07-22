'use client';

/**
 * Saved-system name + notes (M3) — inline editorial controls.
 * Rename and notes edits PATCH /api/my-systems/[id] and refresh the
 * server-rendered page. Assessment history is never editable here.
 */
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EDITORIAL } from '@/lib/editorial-tokens';

const caps: React.CSSProperties = {
  fontFamily: 'var(--face-grotesque)',
  fontSize: '0.65rem',
  fontWeight: 600,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: EDITORIAL.inkMuted,
};

const quiet: React.CSSProperties = {
  ...caps,
  background: 'transparent',
  border: 'none',
  borderBottom: `1px solid ${EDITORIAL.hairline}`,
  paddingBottom: '1px',
  cursor: 'pointer',
};

export default function SystemMeta({ id, name, notes }: { id: string; name: string; notes: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState<'none' | 'name' | 'notes'>('none');
  const [nameValue, setNameValue] = useState(name);
  const [notesValue, setNotesValue] = useState(notes ?? '');

  const patch = async (data: { name?: string; notes?: string }) => {
    await fetch(`/api/my-systems/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setEditing('none');
    router.refresh();
  };

  return (
    <div>
      {editing === 'name' ? (
        <input
          autoFocus
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onBlur={() => nameValue.trim() ? patch({ name: nameValue }) : setEditing('none')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && nameValue.trim()) patch({ name: nameValue });
            if (e.key === 'Escape') { setNameValue(name); setEditing('none'); }
          }}
          style={{
            fontFamily: 'var(--face-display, var(--face-text))',
            fontSize: '2.4rem',
            lineHeight: 1.1,
            color: EDITORIAL.ink,
            background: 'transparent',
            border: 'none',
            borderBottom: `1px solid ${EDITORIAL.hairline}`,
            outline: 'none',
            width: '100%',
          }}
        />
      ) : (
        <h1
          style={{
            fontFamily: 'var(--face-display, var(--face-text))',
            fontSize: '2.4rem',
            lineHeight: 1.1,
            color: EDITORIAL.ink,
            margin: 0,
            overflowWrap: 'anywhere',
          }}
        >
          {name}
        </h1>
      )}

      {editing === 'notes' ? (
        <textarea
          autoFocus
          value={notesValue}
          onChange={(e) => setNotesValue(e.target.value)}
          onBlur={() => patch({ notes: notesValue })}
          onKeyDown={(e) => { if (e.key === 'Escape') { setNotesValue(notes ?? ''); setEditing('none'); } }}
          rows={3}
          style={{
            display: 'block',
            width: '100%',
            marginTop: '0.9rem',
            fontFamily: 'var(--face-text)',
            fontSize: '0.95rem',
            color: EDITORIAL.inkMuted,
            background: 'transparent',
            border: `1px solid ${EDITORIAL.hairline}`,
            padding: '0.6rem',
            outline: 'none',
            resize: 'vertical',
          }}
        />
      ) : notes ? (
        <p style={{ fontFamily: 'var(--face-text)', fontSize: '0.95rem', color: EDITORIAL.inkMuted, margin: '0.9rem 0 0', overflowWrap: 'anywhere' }}>
          {notes}
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: '1.4rem', marginTop: '0.9rem' }}>
        <button type="button" style={quiet} onClick={() => setEditing('name')}>
          Rename
        </button>
        <button type="button" style={quiet} onClick={() => setEditing('notes')}>
          {notes ? 'Edit notes' : 'Add notes'}
        </button>
      </div>
    </div>
  );
}
