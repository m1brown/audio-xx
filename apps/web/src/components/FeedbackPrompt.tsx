'use client';

/**
 * FeedbackPrompt — minimal validation feedback capture (Workstream 25B).
 *
 * Rendered once beneath an advisory/assessment output. Captures the three
 * signals the 50-user validation program requires, plus an optional
 * comment, and emits a single consolidated `feedback_submitted` event.
 *
 * Deliberately small and calm (editorial palette, no SaaS styling). Dedup
 * is per-advisory via localStorage so a given answer is asked once.
 * This is throwaway validation scaffolding, not a permanent feature.
 */

import { useState } from 'react';
import { COLOR } from '@/lib/editorial-tokens';
import { trackEvent } from '@/lib/track-event';

type Help = 'yes' | 'no';
type Accurate = 'yes' | 'not_quite';
type Return = 'yes' | 'no';

const SUBMITTED_PREFIX = 'axx_fb_';

function alreadySubmitted(id: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !!window.localStorage.getItem(SUBMITTED_PREFIX + id);
  } catch {
    return false;
  }
}

function markSubmitted(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SUBMITTED_PREFIX + id, '1');
  } catch {
    /* ignore */
  }
}

const QUESTION_LABEL: React.CSSProperties = {
  fontSize: '0.9375rem',
  color: COLOR.textSecondary,
  margin: 0,
};

function Choice({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '0.34rem 0.75rem',
        fontSize: '0.875rem',
        fontFamily: 'inherit',
        cursor: 'pointer',
        borderRadius: 4,
        border: `1px solid ${active ? COLOR.textPrimary : COLOR.border}`,
        background: active ? COLOR.textPrimary : 'transparent',
        color: active ? '#fff' : COLOR.textSecondary,
        transition: 'all 0.12s ease',
      }}
    >
      {label}
    </button>
  );
}

export default function FeedbackPrompt({ advisoryId }: { advisoryId: string }) {
  const [done, setDone] = useState(() => alreadySubmitted(advisoryId));
  const [help, setHelp] = useState<Help | null>(null);
  const [accurate, setAccurate] = useState<Accurate | null>(null);
  const [ret, setRet] = useState<Return | null>(null);
  const [comment, setComment] = useState('');

  if (done) {
    return (
      <p style={{ fontSize: '0.9375rem', color: COLOR.textMuted, marginTop: '1rem' }}>
        Thanks — your feedback helps us improve.
      </p>
    );
  }

  const canSubmit = help !== null || accurate !== null || ret !== null || comment.trim().length > 0;

  const submit = () => {
    trackEvent('feedback_submitted', {
      advisoryId,
      helped: help,
      accurate,
      wouldReturn: ret,
      hasComment: comment.trim().length > 0,
      comment: comment.trim().slice(0, 1000) || null,
    });
    markSubmitted(advisoryId);
    setDone(true);
  };

  return (
    <div
      style={{
        marginTop: '1.25rem',
        paddingTop: '1rem',
        borderTop: `1px solid ${COLOR.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.7rem',
        maxWidth: 560,
      }}
      aria-label="Feedback"
    >
      <p style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: COLOR.textMuted, margin: 0 }}>
        Help us improve
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 0.85rem' }}>
        <p style={QUESTION_LABEL}>Did this help with your decision?</p>
        <Choice label="Yes" active={help === 'yes'} onClick={() => setHelp('yes')} />
        <Choice label="No" active={help === 'no'} onClick={() => setHelp('no')} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 0.85rem' }}>
        <p style={QUESTION_LABEL}>Did this describe your situation accurately?</p>
        <Choice label="Yes" active={accurate === 'yes'} onClick={() => setAccurate('yes')} />
        <Choice label="Not quite" active={accurate === 'not_quite'} onClick={() => setAccurate('not_quite')} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 0.85rem' }}>
        <p style={QUESTION_LABEL}>Would you return for your next audio decision?</p>
        <Choice label="Yes" active={ret === 'yes'} onClick={() => setRet('yes')} />
        <Choice label="No" active={ret === 'no'} onClick={() => setRet('no')} />
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Anything else? (optional)"
        rows={2}
        style={{
          fontFamily: 'inherit',
          fontSize: '0.9375rem',
          padding: '0.5rem 0.65rem',
          border: `1px solid ${COLOR.border}`,
          borderRadius: 6,
          resize: 'vertical',
          color: COLOR.textPrimary,
          background: '#fff',
        }}
      />

      <div>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          style={{
            padding: '0.5rem 1.15rem',
            fontSize: '0.9rem',
            fontWeight: 500,
            fontFamily: 'inherit',
            borderRadius: 4,
            border: 'none',
            cursor: canSubmit ? 'pointer' : 'default',
            background: canSubmit ? COLOR.textPrimary : '#E5E5E5',
            color: canSubmit ? '#fff' : COLOR.textMuted,
          }}
        >
          Send feedback
        </button>
      </div>
    </div>
  );
}
