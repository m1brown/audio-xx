'use client';

/**
 * System Builder (MVP M1 — "Build Your System").
 *
 * The landing cover's primary interaction: three labeled component
 * fields with instant catalog typeahead, free text accepted as typed,
 * one CTA that navigates to the self-contained assessment URL.
 * No account, no API calls — suggestions come from the bundled
 * static index.
 */
import React, { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { EDITORIAL } from '@/lib/editorial-tokens';
import { searchCatalog, displayName, categoryLabel } from './catalog-search';
import { artifactUrlFor } from './compose-system-text';
import { track } from './analytics';

interface FieldSpec { label: string; placeholder: string }

const INITIAL_FIELDS: FieldSpec[] = [
  { label: 'Source or DAC', placeholder: 'e.g. Denafrips Pontus II' },
  { label: 'Amplifier', placeholder: 'e.g. Leben CS600X' },
  { label: 'Speakers or headphones', placeholder: 'e.g. KEF R3' },
];

const EXTRA_FIELD: FieldSpec = { label: 'Another component', placeholder: 'e.g. Bluesound Node' };
const MAX_FIELDS = 6;

const grotesqueCaps: React.CSSProperties = {
  fontFamily: 'var(--face-grotesque)',
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: EDITORIAL.inkMuted,
};

export default function SystemBuilder() {
  const router = useRouter();
  const [fields, setFields] = useState<FieldSpec[]>(INITIAL_FIELDS);
  const [values, setValues] = useState<string[]>(INITIAL_FIELDS.map(() => ''));
  // Index of the field whose suggestions are open (−1 = none).
  const [openIdx, setOpenIdx] = useState(-1);
  // Keyboard highlight within the open suggestion list (−1 = none).
  const [activeSug, setActiveSug] = useState(-1);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The server render takes a moment — the CTA must not feel dead (M4).
  const [pending, startTransition] = useTransition();

  const url = artifactUrlFor(values);
  const suggestions = useMemo(
    () => (openIdx >= 0 ? searchCatalog(values[openIdx] ?? '') : []),
    [openIdx, values],
  );

  const setValue = (i: number, v: string) => {
    track('builder_started'); // once per page load (deduped in analytics)
    setValues((prev) => prev.map((p, j) => (j === i ? v : p)));
  };

  const pick = (i: number, text: string) => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setValue(i, text);
    setOpenIdx(-1);
    setActiveSug(-1);
  };

  const submit = () => {
    if (url && !pending) {
      // Entry-source handoff for the assessment_rendered funnel event.
      try { sessionStorage.setItem('axx-entry', 'builder'); } catch { /* fine */ }
      startTransition(() => router.push(url));
    }
  };

  return (
    <div
      data-testid="system-builder"
      style={{ maxWidth: '30rem', margin: '0 auto', textAlign: 'left' }}
    >
      {fields.map((f, i) => (
        <div key={i} style={{ position: 'relative', marginBottom: '1.4rem' }}>
          <label style={{ ...grotesqueCaps, display: 'block', marginBottom: '0.3rem' }}>
            {f.label}
          </label>
          <input
            type="text"
            value={values[i]}
            placeholder={f.placeholder}
            aria-label={f.label}
            onChange={(e) => { setValue(i, e.target.value); setOpenIdx(i); setActiveSug(-1); }}
            onFocus={() => setOpenIdx(i)}
            onBlur={() => {
              // Delay closing so a click on a suggestion lands first.
              blurTimer.current = setTimeout(() => setOpenIdx((cur) => (cur === i ? -1 : cur)), 150);
            }}
            role="combobox"
            aria-expanded={openIdx === i && suggestions.length > 0}
            aria-controls={`builder-listbox-${i}`}
            aria-activedescendant={
              openIdx === i && activeSug >= 0 ? `builder-option-${i}-${activeSug}` : undefined
            }
            onKeyDown={(e) => {
              const open = openIdx === i && suggestions.length > 0;
              if (e.key === 'ArrowDown' && open) {
                e.preventDefault();
                setActiveSug((cur) => (cur + 1) % suggestions.length);
              } else if (e.key === 'ArrowUp' && open) {
                e.preventDefault();
                setActiveSug((cur) => (cur <= 0 ? suggestions.length - 1 : cur - 1));
              } else if (e.key === 'Enter') {
                if (open) {
                  pick(i, displayName(suggestions[Math.max(activeSug, 0)]));
                } else {
                  submit();
                }
              } else if (e.key === 'Escape') {
                setOpenIdx(-1);
                setActiveSug(-1);
              }
            }}
            style={{
              width: '100%',
              fontFamily: 'var(--face-text)',
              fontSize: '1.05rem',
              color: EDITORIAL.ink,
              background: 'transparent',
              border: 'none',
              borderBottom: `1px solid ${EDITORIAL.hairline}`,
              // ≥44px touch height (M4 mobile polish).
              padding: '0.6rem 0.1rem',
              minHeight: '44px',
              outline: 'none',
            }}
          />
          {openIdx === i && suggestions.length > 0 && (
            <ul
              role="listbox"
              id={`builder-listbox-${i}`}
              style={{
                position: 'absolute',
                zIndex: 30,
                left: 0,
                right: 0,
                top: '100%',
                margin: 0,
                padding: '0.25rem 0',
                listStyle: 'none',
                background: '#FFFFFF',
                border: `1px solid ${EDITORIAL.hairline}`,
                boxShadow: '0 10px 24px rgba(27, 26, 24, 0.08)',
              }}
            >
              {suggestions.map((s, si) => (
                <li key={s.id}>
                  <button
                    type="button"
                    role="option"
                    id={`builder-option-${i}-${si}`}
                    aria-selected={si === activeSug}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActiveSug(si)}
                    onClick={() => pick(i, displayName(s))}
                    style={{
                      display: 'flex',
                      width: '100%',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: '1rem',
                      padding: '0.6rem 0.8rem',
                      minHeight: '44px',
                      background: si === activeSug ? 'rgba(27, 26, 24, 0.05)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'var(--face-text)',
                      fontSize: '0.95rem',
                      color: EDITORIAL.ink,
                    }}
                  >
                    <span>{displayName(s)}</span>
                    <span style={{ ...grotesqueCaps, fontSize: '0.6rem', color: EDITORIAL.faint }}>
                      {categoryLabel(s.category)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.6rem' }}>
        {fields.length < MAX_FIELDS ? (
          <button
            type="button"
            onClick={() => {
              setFields((prev) => [...prev, EXTRA_FIELD]);
              setValues((prev) => [...prev, '']);
            }}
            style={{
              ...grotesqueCaps,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              borderBottom: `1px solid ${EDITORIAL.hairline}`,
              paddingBottom: '1px',
            }}
          >
            ＋ Add another component
          </button>
        ) : <span />}

        <button
          type="button"
          onClick={submit}
          disabled={!url || pending}
          data-testid="read-assessment"
          aria-busy={pending}
          style={{
            fontFamily: 'var(--face-grotesque)',
            fontSize: '0.8rem',
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: url ? EDITORIAL.paper : EDITORIAL.faint,
            background: url ? EDITORIAL.ink : 'transparent',
            border: url ? `1px solid ${EDITORIAL.ink}` : `1px solid ${EDITORIAL.hairline}`,
            padding: '0.7rem 1.4rem',
            minHeight: '44px',
            cursor: url && !pending ? 'pointer' : 'default',
            opacity: pending ? 0.75 : 1,
          }}
        >
          {pending ? 'Preparing your assessment…' : 'Read my assessment'}
        </button>
      </div>
    </div>
  );
}
