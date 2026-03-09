'use client';

import { useReducer, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import EvaluationOutput from '@/components/EvaluationOutput';
import { getClarificationQuestion } from '@/lib/clarification';
import type { Message, ConversationState } from '@/lib/conversation-types';
import type { ExtractedSignals } from '@/lib/signal-types';
import type { EvaluationResult } from '@/lib/rule-types';

// ── Constants ─────────────────────────────────────────

const PLACEHOLDERS = [
  'I value sweetness, flow, and elasticity but dislike glare and fatigue. What does this say about my preferences?',
  'After switching DACs, the system sounds sharper and more fatiguing. What changed?',
  'My system feels technically impressive but less engaging than before.',
  'The system sounds thin unless I turn it up.',
  'I have about $500 for a DAC and prefer smooth, non-fatiguing sound. What should I consider?',
];

const EXAMPLES = [
  'I like the sweetness of the JOB amplifier.',
  'After switching DACs the system sounds brighter and more fatiguing.',
];

// ── Reducer ───────────────────────────────────────────

type Action =
  | { type: 'SET_INPUT'; value: string }
  | { type: 'ADD_USER_MESSAGE' }
  | { type: 'ADD_ANALYSIS'; signals: ExtractedSignals; result: EvaluationResult }
  | { type: 'ADD_QUESTION'; content: string }
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
          { role: 'assistant', kind: 'analysis', signals: action.signals, result: action.result },
        ],
      };

    case 'ADD_QUESTION':
      return {
        ...state,
        messages: [
          ...state.messages,
          { role: 'assistant', content: action.content, kind: 'question' },
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

  // Rotating placeholder
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

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

    dispatch({ type: 'ADD_USER_MESSAGE' });
    dispatch({ type: 'SET_LOADING', value: true });

    // Concatenate all user messages for evaluation
    const allUserText = [...messages.filter((m) => m.role === 'user').map((m) => m.content), currentInput].join('\n');
    const newTurnCount = turnCount + 1;

    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: allUserText }),
      });

      if (res.ok) {
        const data = await res.json();
        dispatch({ type: 'ADD_ANALYSIS', signals: data.signals, result: data.result });

        // Check if clarification would help
        const question = getClarificationQuestion(
          data.signals,
          data.result,
          newTurnCount,
          allUserText,
        );
        if (question) {
          dispatch({ type: 'ADD_QUESTION', content: question });
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
    lastMessage?.role === 'assistant' && lastMessage.kind === 'question';

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
        <>
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
        </>
      )}

      {/* Conversation thread */}
      {hasMessages && (
        <div style={{ marginBottom: '1.5rem' }}>
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}
          {isLoading && (
            <div style={{ color: '#888', fontSize: '0.95rem', padding: '0.75rem 0' }}>
              Analyzing…
            </div>
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
                : PLACEHOLDERS[placeholderIndex]
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

      {/* Examples — only before conversation starts */}
      {!hasMessages && (
        <div
          style={{
            marginBottom: '1.5rem',
            paddingBottom: '1.25rem',
            borderBottom: '1px solid #ddd',
          }}
        >
          <div
            style={{
              marginBottom: '0.6rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: '#666',
            }}
          >
            Try an example
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => dispatch({ type: 'SET_INPUT', value: example })}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  margin: 0,
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: '#222',
                  fontSize: '0.98rem',
                  lineHeight: 1.4,
                }}
              >
                <span style={{ color: '#c4122f', marginRight: 6 }}>•</span>
                <span style={{ textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                  {example}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button
          onClick={handleSubmit}
          disabled={isLoading || !currentInput.trim()}
          style={{
            background: '#4a4a4a',
            color: '#fff',
            border: 'none',
            borderRadius: 0,
            padding: '0.75rem 1.25rem',
            fontSize: '0.95rem',
            cursor: isLoading || !currentInput.trim() ? 'not-allowed' : 'pointer',
            opacity: isLoading || !currentInput.trim() ? 0.65 : 1,
          }}
        >
          {isLoading ? 'Running…' : hasPendingQuestion ? 'Reply' : hasMessages ? 'Continue' : 'Run analysis'}
        </button>

        {hasMessages && (
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
        )}
      </div>

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
        <EvaluationOutput signals={message.signals} result={message.result} />
      </div>
    );
  }

  if (message.kind === 'question') {
    return (
      <div
        style={{
          marginTop: '1.5rem',
          marginBottom: '1.25rem',
          padding: '1rem 1.1rem',
          borderLeft: '3px solid #c4122f',
          background: '#faf7f7',
        }}
      >
        <div
          style={{
            marginBottom: '0.5rem',
            fontSize: '0.78rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: '#c4122f',
          }}
        >
          Audio XX asks
        </div>
        <div
          style={{
            color: '#222',
            fontSize: '1.05rem',
            lineHeight: 1.6,
          }}
        >
          {message.content}
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
