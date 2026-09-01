'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Follow-up lives OUTSIDE the editorial artifact, past a hard boundary (a full
 * screen of silence). It is deliberately un-editorial — plain system type — so
 * the artifact above it stays a clean, screenshot- and print-able document.
 * It is removed entirely from print / PDF (see artifact.css @media print).
 *
 * Submitting a follow-up hands the typed question off to the homepage via
 * sessionStorage (`axx_followup_q`) and routes there. The homepage reads
 * that key on mount, pre-fills the composer, and clears the key, so the
 * user's question survives the navigation. The artifact route itself is
 * a static editorial render — it has no chat surface — so handing back
 * to the real consultation surface is the right destination.
 */
const FOLLOWUP_STORAGE_KEY = 'axx_followup_q';

export default function FollowUp() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const q = value.trim();
    if (!q) {
      taRef.current?.focus();
      return;
    }
    try {
      sessionStorage.setItem(FOLLOWUP_STORAGE_KEY, q);
    } catch {
      /* private mode / quota — fall through to navigation anyway */
    }
    router.push('/');
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter submits. Shift+Enter inserts a newline (default behaviour).
    // Cmd/Ctrl+Enter also submits, for users who reach for the modifier.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <section className="axx-followup" aria-label="Follow-up — not part of the assessment">
      <div className="axx-sep" aria-hidden="true" />
      {!open ? (
        <a
          href="#follow-up"
          onClick={(e) => {
            e.preventDefault();
            setOpen(true);
            // Defer focus until the textarea is in the DOM.
            setTimeout(() => taRef.current?.focus(), 0);
          }}
        >
          Ask a follow-up about this assessment →
        </a>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label
            htmlFor="axx-fu"
            style={{ display: 'block', marginBottom: '.5rem', color: '#6B6862', fontSize: '.9rem' }}
          >
            Your question
          </label>
          <textarea
            ref={taRef}
            id="axx-fu"
            rows={3}
            placeholder="Ask about this system…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginTop: '.65rem',
              gap: '1rem',
            }}
          >
            <span style={{ color: '#6B6862', fontSize: '.78rem' }}>
              Press Enter to send · Shift + Enter for a new line
            </span>
            <button
              type="submit"
              disabled={!value.trim()}
              className="axx-fu-send"
              aria-label="Send follow-up"
            >
              Send
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
