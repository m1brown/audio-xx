'use client';

/**
 * SystemEditor — form for creating and editing audio systems.
 *
 * Supports both guest (draft) and authenticated (saved) workflows:
 *   - Guest: dispatches SET_DRAFT_SYSTEM to context, persisted via sessionStorage.
 *   - Authenticated: POSTs to /api/systems, then refreshes saved systems.
 *
 * Phase 4: minimal functional UI, no polish.
 */

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useAudioSession } from '@/lib/audio-session-context';
import { inferTendenciesFromComponents } from '@/lib/system-bridge';
import type { ProductCategory } from '@/lib/catalog-taxonomy';
import type {
  DraftSystemComponent, DraftSystem, SystemComponentRole,
} from '@/lib/system-types';

// ── Category options for the dropdown ─────────────────

/*
 * The amplifier family is THREE choices, not one.
 *
 * A single "Amplifier" option could not express a separate preamplifier and
 * power amplifier, so a chain like ARC Reference 5 → Butler Monads arrived
 * with both boxes carrying the same role. The interface layer takes the first
 * match as the amplification stage, so Audio XX reasoned about the
 * PREAMPLIFIER driving the loudspeakers and ignored the amplifier that
 * actually does — losing the strongest relationship it holds.
 *
 * `SystemComponentRole` already carried `preamp` and `power_amp`; only the
 * dropdown never set it. The option value encodes both fields, so the
 * distinction reaches the reasoning layer instead of stopping at the form.
 *
 * Plain "Amplifier" is kept, and deliberately: it means "amplification stage,
 * unspecified", which is the honest reading of every row saved before this and
 * of a listener who does not think of their integrated-or-power amp as either.
 */
const CATEGORY_OPTIONS: {
  value: string; label: string; category: ProductCategory; role: SystemComponentRole;
}[] = [
  { value: 'speaker', label: 'Speaker', category: 'speaker', role: null },
  { value: 'preamp', label: 'Pre-amplifier', category: 'amplifier', role: 'preamp' },
  { value: 'power_amp', label: 'Power amplifier', category: 'amplifier', role: 'power_amp' },
  { value: 'amplifier', label: 'Amplifier', category: 'amplifier', role: null },
  { value: 'integrated', label: 'Integrated amp', category: 'integrated', role: null },
  { value: 'dac', label: 'DAC', category: 'dac', role: null },
  { value: 'streamer', label: 'Streamer', category: 'streamer', role: null },
  { value: 'turntable', label: 'Turntable', category: 'turntable', role: null },
  { value: 'cartridge', label: 'Cartridge', category: 'cartridge', role: null },
  { value: 'phono', label: 'Phono stage', category: 'phono', role: null },
  { value: 'headphone', label: 'Headphone', category: 'headphone', role: null },
  { value: 'iem', label: 'IEM', category: 'iem', role: null },
  { value: 'cable', label: 'Cable', category: 'cable', role: null },
  { value: 'other', label: 'Other', category: 'other', role: null },
];

// ── Empty component template ──────────────────────────

function emptyComponent(): DraftSystemComponent {
  return { brand: '', name: '', category: 'speaker', role: null };
}

// ── Props ─────────────────────────────────────────────

interface SystemEditorProps {
  /** Initial values when editing an existing draft. */
  initial?: DraftSystem | null;
  onClose: () => void;
  /** Called after successful save (both draft and backend). */
  onSaved?: () => void;
}

// ── Component ─────────────────────────────────────────

export default function SystemEditor({ initial, onClose, onSaved }: SystemEditorProps) {
  const { status } = useSession();
  const { dispatch, helpers } = useAudioSession();
  const isAuth = status === 'authenticated';

  // ── Form state ──
  const [name, setName] = useState(initial?.name ?? '');
  const [location, setLocation] = useState('');
  const [primaryUse, setPrimaryUse] = useState('');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [components, setComponents] = useState<DraftSystemComponent[]>(
    initial?.components && initial.components.length > 0
      ? initial.components
      : [emptyComponent()],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Component list management ──

  const updateComponent = useCallback((index: number, patch: Partial<DraftSystemComponent>) => {
    setComponents((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }, []);

  const addComponent = useCallback(() => {
    setComponents((prev) => [...prev, emptyComponent()]);
  }, []);

  const removeComponent = useCallback((index: number) => {
    setComponents((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Save handler ──

  const handleSave = useCallback(async () => {
    // Validate
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('System name is required.');
      return;
    }
    const validComponents = components.filter((c) => c.brand.trim() && c.name.trim());
    if (validComponents.length === 0) {
      setError('At least one component with brand and name is required.');
      return;
    }

    setError(null);
    setSaving(true);

    const tendencies = inferTendenciesFromComponents(validComponents);

    if (isAuth) {
      // ── Authenticated: POST to backend ──
      try {
        const res = await fetch('/api/systems', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: trimmedName,
            location: location.trim() || null,
            primaryUse: primaryUse.trim() || null,
            tendencies: tendencies ? JSON.stringify({ summary: tendencies }) : '{}',
            components: validComponents.map((c) => ({
              name: c.name.trim(),
              brand: c.brand.trim(),
              category: c.category,
              roleOverride: c.role,
            })),
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError(body?.error ?? 'Failed to save system.');
          setSaving(false);
          return;
        }

        // Save succeeded — close editor and refresh in background.
        // Refresh errors should not block the UI or show a false error.
        onSaved?.();
        onClose();
        helpers.refreshSavedSystems().catch(() => {
          // Refresh failure is non-critical — the system was already saved
        });
      } catch {
        setError('Network error — could not save.');
        setSaving(false);
      }
    } else {
      // ── Guest: dispatch to context (sessionStorage) ──
      const draft: DraftSystem = {
        name: trimmedName,
        components: validComponents,
        tendencies,
        notes: notes.trim() || null,
      };
      dispatch({ type: 'SET_DRAFT_SYSTEM', draft });
      onSaved?.();
      onClose();
    }
  }, [name, location, primaryUse, notes, components, isAuth, dispatch, helpers, onSaved, onClose]);

  // ── Shared input style ──
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.4rem 0.55rem',
    border: '1px solid #d5d5d0',
    borderRadius: 5,
    fontSize: '0.88rem',
    fontFamily: 'inherit',
    color: '#333',
    background: '#fff',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.2rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#888',
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '5vh',
        background: 'rgba(0,0,0,0.25)',
        zIndex: 200,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '85vh',
          overflow: 'auto',
          background: '#fff',
          border: '1px solid #d5d5d0',
          borderRadius: 10,
          padding: '1.25rem 1.5rem',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#333' }}>
            {initial ? 'Edit System' : 'New System'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.2rem',
              color: '#999',
              fontFamily: 'inherit',
              padding: '0 0.2rem',
            }}
          >
            ×
          </button>
        </div>

        {/* System name */}
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={labelStyle}>System name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Desktop System, Living Room"
            style={inputStyle}
          />
        </div>

        {/* Location + primary use (side by side) */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Location (optional)</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Living room"
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Primary use (optional)</label>
            <input
              type="text"
              value={primaryUse}
              onChange={(e) => setPrimaryUse(e.target.value)}
              placeholder="e.g. Critical listening"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Components */}
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={labelStyle}>Components</label>
          {components.map((comp, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: '0.4rem',
                alignItems: 'center',
                marginBottom: '0.4rem',
              }}
            >
              <input
                type="text"
                value={comp.brand}
                onChange={(e) => updateComponent(i, { brand: e.target.value })}
                placeholder="Brand"
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                type="text"
                value={comp.name}
                onChange={(e) => updateComponent(i, { name: e.target.value })}
                placeholder="Model"
                style={{ ...inputStyle, flex: 1.5 }}
              />
              <select
                // The selected option is the category/role PAIR, so a row
                // saved as an amplifier with no role still selects "Amplifier"
                // rather than silently reading as one of the specific two.
                value={CATEGORY_OPTIONS.find(
                  (o) => o.category === comp.category && o.role === comp.role,
                )?.value ?? comp.category}
                onChange={(e) => {
                  const opt = CATEGORY_OPTIONS.find((o) => o.value === e.target.value);
                  if (opt) updateComponent(i, { category: opt.category, role: opt.role });
                }}
                style={{ ...inputStyle, flex: 1.2, minWidth: '7.5rem', padding: '0.4rem 0.3rem' }}
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeComponent(i)}
                disabled={components.length <= 1}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: components.length > 1 ? 'pointer' : 'default',
                  fontSize: '1rem',
                  color: components.length > 1 ? '#c44' : '#ddd',
                  fontFamily: 'inherit',
                  padding: '0 0.3rem',
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addComponent}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8rem',
              color: '#888',
              fontFamily: 'inherit',
              padding: '0.2rem 0',
              textDecoration: 'underline',
            }}
          >
            + Add component
          </button>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any context about this system — room treatment, listening preferences, etc."
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: '#c44' }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.45rem 0.9rem',
              border: '1px solid #d5d5d0',
              borderRadius: 6,
              background: '#fff',
              cursor: 'pointer',
              fontSize: '0.85rem',
              color: '#666',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '0.45rem 0.9rem',
              border: '1px solid #333',
              borderRadius: 6,
              background: '#333',
              cursor: saving ? 'wait' : 'pointer',
              fontSize: '0.85rem',
              color: '#fff',
              fontFamily: 'inherit',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : isAuth ? 'Save System' : 'Save Draft'}
          </button>
        </div>

        {/* Auth hint for guests */}
        {!isAuth && (
          <div style={{ marginTop: '0.6rem', fontSize: '0.78rem', color: '#aaa', textAlign: 'right' }}>
            Sign in to save systems permanently.
          </div>
        )}
      </div>
    </div>
  );
}
