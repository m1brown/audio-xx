'use client';

import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import Link from 'next/link';
import EvaluationOutput from '@/components/EvaluationOutput';
import { getClarificationQuestion } from '@/lib/clarification';
import type { ClarificationResponse } from '@/lib/clarification';
import { detectShoppingIntent, buildShoppingAnswer } from '@/lib/shopping-intent';
import { checkGlossaryQuestion } from '@/lib/glossary';
import { detectIntent } from '@/lib/intent';
import { buildGearResponse } from '@/lib/gear-response';
import { inferSystemDirection } from '@/lib/system-direction';
import type { SystemDirection } from '@/lib/system-direction';
import type { GlossaryResult } from '@/lib/glossary';
import type { ShoppingAnswer } from '@/lib/shopping-intent';
import type { Message, ConversationState, GearResponse } from '@/lib/conversation-types';
import type { ExtractedSignals } from '@/lib/signal-types';
import type { EvaluationResult } from '@/lib/rule-types';

// ── Constants ─────────────────────────────────────────

const CYCLING_PLACEHOLDERS = [
  'Best DAC under $1000 for detail and naturalness',
  'How would a Denafrips Ares sound in my system?',
  'Compare R-2R vs delta-sigma for long listening sessions',
  'I prefer warmth and flow. What DAC direction fits that?',
  'My system sounds thin. What might cause that?',
  'What do you think of the Chord Qutest?',
  'Schiit Bifrost vs Denafrips Pontus',
];

/** Interval in ms between placeholder rotations. */
const PLACEHOLDER_INTERVAL = 4000;

// ── Reducer ───────────────────────────────────────────

type Action =
  | { type: 'SET_INPUT'; value: string }
  | { type: 'ADD_USER_MESSAGE' }
  | { type: 'ADD_ANALYSIS'; signals: ExtractedSignals; result: EvaluationResult; systemDirection?: SystemDirection }
  | { type: 'ADD_SHOPPING_ANSWER'; answer: ShoppingAnswer; signals: ExtractedSignals }
  | { type: 'ADD_QUESTION'; clarification: ClarificationResponse }
  | { type: 'ADD_GLOSSARY'; entry: GlossaryResult }
  | { type: 'ADD_GEAR_RESPONSE'; response: GearResponse }
  | { type: 'SET_LOADING'; value: boolean }
  | { type: 'RESET' };

const initialState: ConversationState = {
  messages: [],
  currentInput: '',
  turnCount: 0,
  isLoading: false,
};

function reducer(state: ConversationState, action: Action): ConversationState {
  switch (action.type) {
    case 'SET_INPUT':
      return { ...state, currentInput: action.value };

    case 'ADD_USER_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, { role: 'user', content: state.currentInput }],
        currentInput: '',
        turnCount: state.turnCount + 1,
      };

    case 'ADD_ANALYSIS':
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            role: 'assistant',
            kind: 'analysis',
            signals: action.signals,
            result: action.result,
            ...(action.systemDirection ? { systemDirection: action.systemDirection } : {}),
          },
        ],
      };

    case 'ADD_SHOPPING_ANSWER':
      return {
        ...state,
        messages: [
          ...state.messages,
          { role: 'assistant', kind: 'shopping-answer', answer: action.answer, signals: action.signals },
        ],
      };

    case 'ADD_QUESTION':
      return {
        ...state,
        messages: [
          ...state.messages,
          { role: 'assistant', kind: 'question', clarification: action.clarification },
        ],
      };

    case 'ADD_GLOSSARY':
      return {
        ...state,
        messages: [
          ...state.messages,
          { role: 'assistant', kind: 'glossary', entry: action.entry },
        ],
      };

    case 'ADD_GEAR_RESPONSE':
      return {
        ...state,
        messages: [
          ...state.messages,
          { role: 'assistant', kind: 'gear-response', response: action.response },
        ],
      };

    case 'SET_LOADING':
      return { ...state, isLoading: action.value };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// ── Component ─────────────────────────────────────────

export default function Home() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { messages, currentInput, turnCount, isLoading } = state;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Cycling placeholder — rotates through example prompts on the landing page
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  useEffect(() => {
    if (messages.length > 0 || currentInput.length > 0) return;
    const timer = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % CYCLING_PLACEHOLDERS.length);
    }, PLACEHOLDER_INTERVAL);
    return () => clearInterval(timer);
  }, [messages.length, currentInput.length]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus textarea after assistant message
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      textareaRef.current?.focus();
    }
  }, [isLoading, messages.length]);

  const handleSubmit = useCallback(async () => {
    if (!currentInput.trim() || isLoading) return;

    const submittedText = currentInput;
    dispatch({ type: 'ADD_USER_MESSAGE' });
    dispatch({ type: 'SET_LOADING', value: true });

    // Check for glossary questions first — no API call needed
    const glossaryResult = checkGlossaryQuestion(submittedText);
    if (glossaryResult) {
      dispatch({ type: 'ADD_GLOSSARY', entry: glossaryResult });
      dispatch({ type: 'SET_LOADING', value: false });
      return;
    }

    // Detect intent BEFORE running the evaluation engine
    const { intent, subjects, desires } = detectIntent(submittedText);

    // Gear inquiries and comparisons — conversational path, skip diagnostic engine
    if (intent === 'gear_inquiry' || intent === 'comparison') {
      const gearResponse = buildGearResponse(intent, subjects, submittedText, desires);
      if (gearResponse) {
        dispatch({ type: 'ADD_GEAR_RESPONSE', response: gearResponse });
        dispatch({ type: 'SET_LOADING', value: false });
        return;
      }
    }

    // Shopping and diagnosis intents go through the evaluation engine
    const allUserText = [...messages.filter((m) => m.role === 'user').map((m) => m.content), submittedText].join('\n');
    const newTurnCount = turnCount + 1;

    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: allUserText }),
      });

      if (res.ok) {
        const data = await res.json();

        // Check if more context is needed before showing results
        const clarification = getClarificationQuestion(
          data.signals,
          data.result,
          newTurnCount,
          allUserText,
          submittedText,
        );

        // Infer system direction for diagnosis-path results
        const diagDirection = inferSystemDirection(submittedText, desires);

        if (clarification) {
          // Inquiry mode — ask the follow-up, suppress analysis
          dispatch({ type: 'ADD_QUESTION', clarification });
        } else if (intent === 'shopping') {
          // Shopping path — recommendation with product examples
          const shoppingCtx = detectShoppingIntent(allUserText, data.signals);
          if (shoppingCtx.detected) {
            const answer = buildShoppingAnswer(shoppingCtx, data.signals);
            dispatch({ type: 'ADD_SHOPPING_ANSWER', answer, signals: data.signals });
          } else {
            // Shopping intent detected by us but not by the shopping module —
            // fall through to analysis
            dispatch({ type: 'ADD_ANALYSIS', signals: data.signals, result: data.result, systemDirection: diagDirection });
          }
        } else {
          // Diagnosis path — full diagnostic output with direction context
          dispatch({ type: 'ADD_ANALYSIS', signals: data.signals, result: data.result, systemDirection: diagDirection });
        }
      }
    } catch {
      // Silently handle — user can retry
    }

    dispatch({ type: 'SET_LOADING', value: false });
  }, [currentInput, isLoading, messages, turnCount]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Enter sends, Shift+Enter for newline
      e.preventDefault();
      handleSubmit();
    }
  }

  const hasMessages = messages.length > 0;
  const lastMessage = messages[messages.length - 1];
  const hasPendingQuestion =
    lastMessage?.role === 'assistant' &&
    (lastMessage.kind === 'question' || lastMessage.kind === 'gear-response');

  return (
    <div
      style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: '3.5rem 1.25rem 3rem',
        color: '#111',
        lineHeight: 1.55,
      }}
    >
      {/* Header — always visible */}
      <div
        style={{
          borderTop: '4px solid #c4122f',
          width: 72,
          marginBottom: '1.25rem',
        }}
      />

      <h1
        style={{
          marginBottom: '0.5rem',
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: '2.25rem',
          fontWeight: 600,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
        }}
      >
        Audio XX
      </h1>

      {/* Intro — only before conversation starts */}
      {!hasMessages && (
        <p
          style={{
            marginTop: 0,
            marginBottom: '2rem',
            maxWidth: 620,
            color: '#444',
            fontSize: '1rem',
          }}
        >
          A listening advisor that interprets what you hear, reflects underlying system traits,
          and suggests the most sensible next step.
        </p>
      )}

      {/* Conversation thread */}
      {hasMessages && (
        <div style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
          {messages
            .filter((msg) => {
              // In inquiry mode (pending question), suppress analysis messages
              if (hasPendingQuestion && msg.role === 'assistant' && 'kind' in msg && msg.kind === 'analysis') {
                return false;
              }
              return true;
            })
            .map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}
          {isLoading && (
            <ThinkingIndicator />
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input area */}
      <div style={{ marginBottom: '1rem' }}>
        {!hasMessages && (
          <label
            htmlFor="audio-input"
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: '#666',
            }}
          >
            Listening note
          </label>
        )}

        <textarea
          ref={textareaRef}
          id="audio-input"
          value={currentInput}
          onChange={(e) => dispatch({ type: 'SET_INPUT', value: e.target.value })}
          onKeyDown={handleKeyDown}
          placeholder={
            hasPendingQuestion
              ? 'Reply here…'
              : hasMessages
                ? 'Continue describing what you hear…'
                : CYCLING_PLACEHOLDERS[placeholderIndex]
          }
          style={{
            width: '100%',
            minHeight: hasMessages ? 80 : 150,
            padding: '1rem',
            border: '1px solid #cfcfcf',
            borderRadius: 0,
            outline: 'none',
            fontSize: '1rem',
            lineHeight: 1.5,
            resize: 'vertical',
            background: '#fff',
            color: '#111',
            boxSizing: 'border-box',
          }}
        />

      </div>

      {/* Start-over link — only during conversation */}
      {hasMessages && (
        <div style={{ marginBottom: '1.5rem' }}>
          <button
            type="button"
            onClick={() => dispatch({ type: 'RESET' })}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              margin: 0,
              cursor: 'pointer',
              color: '#888',
              fontSize: '0.9rem',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
            }}
          >
            Start over
          </button>
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          marginTop: '3rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid #ddd',
        }}
      >
        <Link
          href="/about"
          style={{
            color: '#666',
            fontSize: '0.9rem',
            textDecoration: 'none',
          }}
        >
          How this works
        </Link>
      </div>
    </div>
  );
}

// ── Thinking Indicator ────────────────────────────────

const THINKING_KEYFRAMES = `
@keyframes thinking-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
`;

function ThinkingIndicator() {
  return (
    <>
      <style>{THINKING_KEYFRAMES}</style>
      <div
        style={{
          padding: '0.75rem 0',
          color: '#888',
          fontSize: '0.92rem',
          animation: 'thinking-pulse 2s ease-in-out infinite',
        }}
      >
        Audio XX is thinking…
      </div>
    </>
  );
}

// ── Message Rendering ─────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <div
        style={{
          marginBottom: '1.25rem',
          padding: '0.85rem 1rem',
          background: '#f7f7f7',
          borderLeft: '3px solid #d9d9d9',
          color: '#222',
          fontSize: '1rem',
          lineHeight: 1.55,
        }}
      >
        {message.content}
      </div>
    );
  }

  if (message.kind === 'analysis') {
    return (
      <div style={{ marginBottom: '1.75rem' }}>
        <hr style={{ border: 0, borderTop: '1px solid #d9d9d9', margin: '0 0 1.5rem 0' }} />

        {/* System direction context — tendency and desired direction */}
        {message.systemDirection && (message.systemDirection.tendencySummary || message.systemDirection.directionSummary) && (
          <div
            style={{
              marginBottom: '1.25rem',
              padding: '0.85rem 1rem',
              borderLeft: '3px solid #7a6a4a',
              background: '#faf9f6',
              color: '#333',
              fontSize: '0.98rem',
              lineHeight: 1.6,
            }}
          >
            {message.systemDirection.tendencySummary && (
              <p style={{ margin: '0 0 0.3rem 0' }}>
                {message.systemDirection.tendencySummary}
              </p>
            )}
            {message.systemDirection.directionSummary && (
              <p style={{ margin: 0 }}>
                {message.systemDirection.directionSummary}
              </p>
            )}
          </div>
        )}

        <EvaluationOutput signals={message.signals} result={message.result} />
      </div>
    );
  }

  if (message.kind === 'shopping-answer') {
    return (
      <div style={{ marginBottom: '1.75rem' }}>
        <hr style={{ border: 0, borderTop: '1px solid #d9d9d9', margin: '0 0 1.5rem 0' }} />
        <ShoppingRecommendation answer={message.answer} signals={message.signals} />
      </div>
    );
  }

  if (message.kind === 'glossary') {
    return (
      <div
        style={{
          marginTop: '1.5rem',
          marginBottom: '1.25rem',
          padding: '1rem 1.1rem',
          borderLeft: '3px solid #2a7a4b',
          background: '#f6faf7',
        }}
      >
        <div
          style={{
            marginBottom: '0.4rem',
            fontSize: '0.78rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: '#2a7a4b',
          }}
        >
          Audio term
        </div>
        <div
          style={{
            marginBottom: '0.35rem',
            fontSize: '1.1rem',
            fontWeight: 600,
            color: '#111',
            fontFamily: 'Georgia, "Times New Roman", serif',
          }}
        >
          {message.entry.term}
        </div>
        <p style={{ margin: '0 0 0.3rem 0', color: '#222', fontSize: '1rem', lineHeight: 1.6 }}>
          {message.entry.explanation}
        </p>
        {message.entry.example && (
          <p style={{ margin: 0, color: '#666', fontSize: '0.92rem', lineHeight: 1.55, fontStyle: 'italic' }}>
            {message.entry.example}
          </p>
        )}
      </div>
    );
  }

  if (message.kind === 'gear-response') {
    const { response } = message;
    return (
      <div
        style={{
          marginTop: '1.5rem',
          marginBottom: '1.25rem',
        }}
      >
        {/* Advisory body — flows as natural prose */}
        <div
          style={{
            margin: '0 0 1.1rem 0',
            color: '#222',
            fontSize: '1.02rem',
            lineHeight: 1.7,
          }}
        >
          <p style={{ margin: '0 0 0.7rem 0' }}>
            {response.anchor}
          </p>
          <p style={{ margin: '0 0 0.7rem 0' }}>
            {response.character}
          </p>
          {response.interpretation && (
            <p style={{ margin: '0 0 0.7rem 0' }}>
              {response.interpretation}
            </p>
          )}
          <p style={{ margin: 0 }}>
            {response.direction}
          </p>
        </div>

        {/* Clarification question */}
        <div
          style={{
            padding: '0.85rem 1rem',
            borderLeft: '3px solid #4a7a8a',
            background: '#f7fafb',
          }}
        >
          <div
            style={{
              color: '#222',
              fontSize: '1.02rem',
              lineHeight: 1.6,
            }}
          >
            {response.clarification}
          </div>
        </div>
      </div>
    );
  }

  if (message.kind === 'question') {
    const { clarification } = message;
    return (
      <div
        style={{
          marginTop: '1.5rem',
          marginBottom: '1.25rem',
        }}
      >
        {/* Acknowledge + Context — conversational lead-in */}
        <div
          style={{
            marginBottom: '0.75rem',
            color: '#333',
            fontSize: '1rem',
            lineHeight: 1.6,
          }}
        >
          <span>{clarification.acknowledge}</span>
          {clarification.context && (
            <span> {clarification.context}</span>
          )}
        </div>

        {/* Question — visually distinct */}
        <div
          style={{
            padding: '0.85rem 1rem',
            borderLeft: '3px solid #c4122f',
            background: '#faf7f7',
          }}
        >
          <div
            style={{
              color: '#222',
              fontSize: '1.05rem',
              lineHeight: 1.6,
              whiteSpace: 'pre-line',
            }}
          >
            {clarification.question}
          </div>
        </div>
      </div>
    );
  }

  // kind === 'note'
  return (
    <div
      style={{
        marginBottom: '1.25rem',
        color: '#555',
        fontSize: '0.98rem',
        lineHeight: 1.55,
      }}
    >
      {message.content}
    </div>
  );
}

// ── Shopping Recommendation (advisor-first) ──────────

function ShoppingRecommendation({
  answer,
  signals,
}: {
  answer: ShoppingAnswer;
  signals: ExtractedSignals;
}) {
  return (
    <div style={{ color: '#111' }}>
      {/* Preference summary */}
      <p
        style={{
          margin: '0 0 1.25rem 0',
          fontSize: '1.08rem',
          lineHeight: 1.65,
          color: '#444',
        }}
      >
        {answer.preferenceSummary}
      </p>

      {/* Best-fit direction */}
      <div style={{ marginBottom: '1.25rem' }}>
        <SectionLabel>Best-fit direction</SectionLabel>
        <p style={{ margin: 0, color: '#222', lineHeight: 1.6 }}>
          {answer.bestFitDirection}
        </p>
      </div>

      {/* Why this fits */}
      {answer.whyThisFits.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <SectionLabel>Why this fits</SectionLabel>
          <ul style={{ margin: 0, paddingLeft: '1.15rem', color: '#222' }}>
            {answer.whyThisFits.map((reason, i) => (
              <li key={i} style={{ marginBottom: '0.35rem', lineHeight: 1.55 }}>
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Possible product examples */}
      {answer.productExamples.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <SectionLabel>Possible product examples</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {answer.productExamples.map((product, i) => (
              <div
                key={i}
                style={{
                  padding: '0.85rem 1rem',
                  borderLeft: '3px solid #d9d9d9',
                  background: '#fafafa',
                }}
              >
                <div style={{ marginBottom: '0.3rem' }}>
                  <strong style={{ color: '#111' }}>
                    {product.brand} {product.name}
                  </strong>
                  {product.price > 0 && (
                    <span style={{ color: '#666', marginLeft: '0.5rem', fontSize: '0.92rem' }}>
                      ${product.price.toLocaleString()}
                    </span>
                  )}
                </div>
                <p style={{ margin: '0 0 0.3rem 0', color: '#333', lineHeight: 1.55, fontSize: '0.95rem' }}>
                  {product.fitNote}
                </p>
                {product.caution && (
                  <p style={{ margin: '0 0 0.3rem 0', color: '#888', fontSize: '0.88rem', lineHeight: 1.5 }}>
                    {product.caution}
                  </p>
                )}
                {product.links && product.links.length > 0 && (
                  <div style={{ fontSize: '0.88rem', color: '#666', marginTop: '0.25rem' }}>
                    {product.links.map((link, li) => (
                      <span key={li}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#555', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                        >
                          {link.label}
                        </a>
                        {li < (product.links?.length ?? 0) - 1 && (
                          <span style={{ margin: '0 0.4rem', color: '#ccc' }}>&middot;</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What to watch for */}
      {answer.watchFor.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <SectionLabel>What to watch for</SectionLabel>
          <ul style={{ margin: 0, paddingLeft: '1.15rem', color: '#222' }}>
            {answer.watchFor.map((item, i) => (
              <li key={i} style={{ marginBottom: '0.35rem', lineHeight: 1.55 }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* System note */}
      {answer.systemNote && (
        <p
          style={{
            margin: '0 0 1rem 0',
            color: '#666',
            fontStyle: 'italic',
            lineHeight: 1.55,
          }}
        >
          {answer.systemNote}
        </p>
      )}

      {/* Collapsible signal diagnostics */}
      {(signals.matched_phrases.length > 0 ||
        signals.symptoms.length > 0 ||
        Object.keys(signals.traits).length > 0) && (
        <details style={{ marginTop: '1.5rem', color: '#666', fontSize: '0.92rem' }}>
          <summary style={{ cursor: 'pointer' }}>How this was interpreted</summary>
          <div style={{ marginTop: '0.6rem' }}>
            {signals.matched_phrases.length > 0 && (
              <p style={{ margin: '0 0 0.5rem 0', color: '#333' }}>
                <strong>Matched:</strong>{' '}
                {signals.matched_phrases.join(', ')}
              </p>
            )}
            {signals.symptoms.length > 0 && (
              <p style={{ margin: '0 0 0.5rem 0', color: '#333' }}>
                <strong>Symptoms:</strong>{' '}
                {signals.symptoms.map((s) => s.replace(/_/g, ' ')).join(', ')}
              </p>
            )}
            {Object.keys(signals.traits).length > 0 && (
              <p style={{ margin: 0, color: '#333' }}>
                <strong>Traits:</strong>{' '}
                {Object.entries(signals.traits)
                  .map(([trait, direction]) => `${trait.replace(/_/g, ' ')} ${direction === 'up' ? '↑' : '↓'}`)
                  .join(', ')}
              </p>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

/** Consistent uppercase section label */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginBottom: '0.45rem',
        fontSize: '0.8rem',
        fontWeight: 700,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        color: '#666',
      }}
    >
      {children}
    </div>
  );
}
