/**
 * Guided intake questionnaire — rendered for new/vague entry queries.
 *
 * Displays structured intake questions with numbered options,
 * matching the advisory visual language (tan accents, clean typography).
 * Questions are read-only prompts — the user responds in their own words
 * in the text input, and the system extracts signals from their response.
 */

import type { AdvisoryResponse } from '../../lib/advisory-response';
import type { IntakeQuestion } from '../../lib/intake';
import { renderText } from './render-text';

interface AdvisoryIntakeProps {
  advisory: AdvisoryResponse;
}

// ── Design tokens (matching AdvisoryMessage) ──────────

const COLORS = {
  text: '#2a2a2a',
  textSecondary: '#5a5a5a',
  textMuted: '#8a8a8a',
  accent: '#a89870',
  accentBg: '#faf8f3',
  border: '#eeece8',
  borderLight: '#f4f2ee',
};

const FONTS = {
  bodySize: '0.98rem',
  smallSize: '0.9rem',
  lineHeight: 1.75,
};

// ── Question block renderer ──────────────────────────

function IntakeQuestionBlock({ question, index }: { question: IntakeQuestion; index: number }) {
  return (
    <div
      style={{
        marginBottom: '1.75rem',
      }}
    >
      {/* Section label */}
      <div
        style={{
          marginBottom: '0.5rem',
          fontSize: '0.78rem',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase' as const,
          color: COLORS.accent,
        }}
      >
        {question.label}
      </div>

      {/* Question text */}
      <p
        style={{
          margin: '0 0 0.75rem 0',
          fontSize: FONTS.bodySize,
          lineHeight: FONTS.lineHeight,
          color: COLORS.text,
          fontWeight: 500,
        }}
      >
        {renderText(question.question)}
      </p>

      {/* Options list */}
      {question.options && question.options.length > 0 && (
        <div
          style={{
            paddingLeft: '0.25rem',
          }}
        >
          {question.options.map((option, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                marginBottom: '0.4rem',
                fontSize: FONTS.bodySize,
                lineHeight: 1.65,
                color: COLORS.textSecondary,
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: '1.6rem',
                  fontWeight: 600,
                  color: COLORS.accent,
                  fontSize: '0.9rem',
                }}
              >
                {i + 1}.
              </span>
              <span>{option}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────

export default function AdvisoryIntake({ advisory }: AdvisoryIntakeProps) {
  const questions = advisory.intakeQuestions;
  if (!questions || questions.length === 0) return null;

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
          margin: '0 0 1.75rem 0',
          borderTop: `1px solid ${COLORS.border}`,
        }}
      />

      {/* Questions */}
      {questions.map((q, i) => (
        <IntakeQuestionBlock key={i} question={q} index={i} />
      ))}

      {/* Follow-up note */}
      {advisory.followUp && (
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
