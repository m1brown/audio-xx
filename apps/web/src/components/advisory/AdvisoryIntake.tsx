/**
 * Guided intake questionnaire — interactive version.
 *
 * Renders structured intake questions with clickable options:
 *   - Single-select questions: radio-style (click one, it highlights)
 *   - Multi-select questions: checkbox-style (click many, they highlight)
 *
 * Selections are tracked in local state. On submit, they're composed
 * into a natural-language string and sent through handleSubmit(text).
 * The user can also type freely in the main text input alongside
 * their checkbox picks.
 */

'use client';

import { useState, useCallback } from 'react';
import type { AdvisoryResponse } from '../../lib/advisory-response';
import type { IntakeQuestion } from '../../lib/intake';
import { renderText } from './render-text';

interface AdvisoryIntakeProps {
  advisory: AdvisoryResponse;
  /** Callback to submit composed intake text. */
  onSubmit?: (text: string) => void;
}

// ── Design tokens (matching AdvisoryMessage) ──────────

const COLORS = {
  text: '#2a2a2a',
  textSecondary: '#5a5a5a',
  textMuted: '#8a8a8a',
  accent: '#a89870',
  accentBg: '#faf8f3',
  accentBgHover: '#f5f1e8',
  border: '#eeece8',
  borderLight: '#f4f2ee',
  selectedBorder: '#a89870',
  selectedBg: '#faf8f3',
  white: '#fff',
};

const FONTS = {
  bodySize: '0.98rem',
  smallSize: '0.9rem',
  lineHeight: 1.75,
};

// ── Selection state type ─────────────────────────────

type Selections = Record<string, Set<number>>;

// ── Option chip ──────────────────────────────────────

function OptionChip({
  text,
  selected,
  multiSelect,
  onClick,
}: {
  text: string;
  selected: boolean;
  multiSelect: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.5rem',
        width: '100%',
        padding: '0.5rem 0.75rem',
        marginBottom: '0.35rem',
        fontSize: FONTS.bodySize,
        lineHeight: 1.55,
        color: selected ? COLORS.text : COLORS.textSecondary,
        background: selected ? COLORS.selectedBg : COLORS.white,
        border: `1.5px solid ${selected ? COLORS.selectedBorder : COLORS.border}`,
        borderRadius: '6px',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'all 0.15s ease',
      }}
    >
      {/* Indicator */}
      <span
        style={{
          flexShrink: 0,
          width: '1.1rem',
          height: '1.1rem',
          marginTop: '0.15rem',
          borderRadius: multiSelect ? '3px' : '50%',
          border: `1.5px solid ${selected ? COLORS.accent : '#ccc'}`,
          background: selected ? COLORS.accent : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
        }}
      >
        {selected && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d={multiSelect
                ? 'M2.5 5L4.5 7L7.5 3'  // checkmark
                : 'M5 3a2 2 0 110 4 2 2 0 010-4z'  // dot
              }
              stroke={multiSelect ? '#fff' : 'none'}
              fill={multiSelect ? 'none' : '#fff'}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span>{text}</span>
    </button>
  );
}

// ── Question block ───────────────────────────────────

function IntakeQuestionBlock({
  question,
  selections,
  onToggle,
}: {
  question: IntakeQuestion;
  selections: Set<number>;
  onToggle: (optionIndex: number) => void;
}) {
  const isMulti = question.multiSelect === true;

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {/* Section label */}
      <div
        style={{
          marginBottom: '0.4rem',
          fontSize: '0.78rem',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase' as const,
          color: COLORS.accent,
        }}
      >
        {question.label}
        {isMulti && (
          <span style={{ fontWeight: 400, letterSpacing: '0.02em', marginLeft: '0.5rem', color: COLORS.textMuted, textTransform: 'none' as const }}>
            select all that apply
          </span>
        )}
      </div>

      {/* Question text */}
      <p
        style={{
          margin: '0 0 0.6rem 0',
          fontSize: FONTS.bodySize,
          lineHeight: FONTS.lineHeight,
          color: COLORS.text,
          fontWeight: 500,
        }}
      >
        {renderText(question.question)}
      </p>

      {/* Clickable options */}
      {question.options && question.options.length > 0 && (
        <div>
          {question.options.map((option, i) => (
            <OptionChip
              key={i}
              text={option}
              selected={selections.has(i)}
              multiSelect={isMulti}
              onClick={() => onToggle(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Compose selections into natural language ─────────

function composeIntakeText(
  questions: IntakeQuestion[],
  selections: Selections,
): string {
  const parts: string[] = [];

  for (const q of questions) {
    const sel = selections[q.label];
    if (!sel || sel.size === 0 || !q.options) continue;

    const chosen = Array.from(sel)
      .sort((a, b) => a - b)
      .map((i) => q.options![i])
      .filter(Boolean);

    if (chosen.length === 0) continue;

    // Strip the parenthetical descriptions for cleaner text
    const cleaned = chosen.map((c) => {
      // "Jazz, acoustic, vocal — intimate recordings" → "Jazz, acoustic, vocal"
      const dash = c.indexOf(' — ');
      return dash > 0 ? c.substring(0, dash) : c;
    });

    parts.push(cleaned.join('; '));
  }

  return parts.join('. ') + (parts.length > 0 ? '.' : '');
}

// ── Main component ───────────────────────────────────

export default function AdvisoryIntake({ advisory, onSubmit }: AdvisoryIntakeProps) {
  const questions = advisory.intakeQuestions;
  if (!questions || questions.length === 0) return null;

  // Selection state: { [questionLabel]: Set<optionIndex> }
  const [selections, setSelections] = useState<Selections>(() => {
    const init: Selections = {};
    for (const q of questions) {
      init[q.label] = new Set<number>();
    }
    return init;
  });

  const handleToggle = useCallback((label: string, multiSelect: boolean, optionIndex: number) => {
    setSelections((prev) => {
      const current = new Set(prev[label]);
      if (multiSelect) {
        // Toggle
        if (current.has(optionIndex)) {
          current.delete(optionIndex);
        } else {
          current.add(optionIndex);
        }
      } else {
        // Radio — clear others, toggle this one
        if (current.has(optionIndex)) {
          current.clear();
        } else {
          current.clear();
          current.add(optionIndex);
        }
      }
      return { ...prev, [label]: current };
    });
  }, []);

  const totalSelections = Object.values(selections).reduce((sum, s) => sum + s.size, 0);

  const handleSubmitClick = useCallback(() => {
    if (!onSubmit || totalSelections === 0) return;
    const text = composeIntakeText(questions, selections);
    if (text.trim()) {
      onSubmit(text);
    }
  }, [onSubmit, questions, selections, totalSelections]);

  return (
    <div
      style={{
        fontSize: FONTS.bodySize,
        lineHeight: FONTS.lineHeight,
        color: COLORS.text,
      }}
    >
      {/* Greeting */}
      {advisory.philosophy && (
        <p
          style={{
            margin: '0 0 1.5rem 0',
            fontSize: '1.02rem',
            lineHeight: 1.75,
            color: COLORS.text,
          }}
        >
          {renderText(advisory.philosophy)}
        </p>
      )}

      {/* Divider */}
      <div
        style={{
          margin: '0 0 1.5rem 0',
          borderTop: `1px solid ${COLORS.border}`,
        }}
      />

      {/* Interactive questions */}
      {questions.map((q, i) => (
        <IntakeQuestionBlock
          key={i}
          question={q}
          selections={selections[q.label] || new Set()}
          onToggle={(optIdx) => handleToggle(q.label, q.multiSelect === true, optIdx)}
        />
      ))}

      {/* Submit button */}
      {onSubmit && (
        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            type="button"
            onClick={handleSubmitClick}
            disabled={totalSelections === 0}
            style={{
              padding: '0.6rem 1.5rem',
              fontSize: '0.92rem',
              fontWeight: 600,
              fontFamily: 'inherit',
              color: totalSelections > 0 ? COLORS.white : COLORS.textMuted,
              background: totalSelections > 0 ? COLORS.accent : COLORS.borderLight,
              border: 'none',
              borderRadius: '6px',
              cursor: totalSelections > 0 ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              opacity: totalSelections > 0 ? 1 : 0.6,
            }}
          >
            Submit
          </button>
          <span style={{ fontSize: FONTS.smallSize, color: COLORS.textMuted }}>
            {totalSelections > 0
              ? `${totalSelections} selected — or type your own answer below`
              : 'Select options above, or type your own answer below'}
          </span>
        </div>
      )}

      {/* Follow-up note (only when no onSubmit, i.e. fallback non-interactive mode) */}
      {!onSubmit && advisory.followUp && (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.85rem 1rem',
            borderLeft: `3px solid ${COLORS.accent}`,
            background: COLORS.accentBg,
            fontSize: FONTS.smallSize,
            lineHeight: 1.7,
            color: COLORS.textSecondary,
            borderRadius: '0 4px 4px 0',
          }}
        >
          {renderText(advisory.followUp)}
        </div>
      )}
    </div>
  );
}
