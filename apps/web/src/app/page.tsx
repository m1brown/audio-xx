'use client';

import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import EvaluationOutput from '@/components/EvaluationOutput';
import TasteRadar from '@/components/TasteRadar';
import { getClarificationQuestion } from '@/lib/clarification';
import type { ClarificationResponse } from '@/lib/clarification';
import { detectShoppingIntent, buildShoppingAnswer, getShoppingClarification } from '@/lib/shopping-intent';
import { checkGlossaryQuestion } from '@/lib/glossary';
import { detectIntent, isBrandOnlyComparison, isComparisonFollowUp, isConsultationFollowUp, detectContextEnrichment, type SubjectMatch } from '@/lib/intent';
import { buildGearResponse } from '@/lib/gear-response';
import { inferSystemDirection } from '@/lib/system-direction';
import { routeConversation, resolveMode } from '@/lib/conversation-router';
import type { ConversationMode } from '@/lib/conversation-router';
import { buildConsultationResponse, buildComparisonRefinement, buildContextRefinement, buildConsultationFollowUp } from '@/lib/consultation';
import type { ConsultationResponse } from '@/lib/consultation';
import type { SystemDirection } from '@/lib/system-direction';
import type { GlossaryResult } from '@/lib/glossary';
import type { ShoppingAnswer } from '@/lib/shopping-intent';
import type { Message, ConversationState, GearResponse } from '@/lib/conversation-types';
import type { ExtractedSignals } from '@/lib/signal-types';
import type { EvaluationResult } from '@/lib/rule-types';
import { parseTasteProfile, topTraits, isProfileEmpty, type TasteProfile } from '@/lib/taste-profile';
import { detectChurnSignal } from '@/lib/churn-avoidance';
import { reason } from '@/lib/reasoning';
import type { ReasoningResult } from '@/lib/reasoning';

// ── Helpers ──────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$', CHF: 'CHF ',
};

/** Format a price with its currency symbol. Falls back to ISO code prefix. */
function formatPrice(amount: number, currency?: string): string {
  const code = currency ?? 'USD';
  const symbol = CURRENCY_SYMBOLS[code] ?? `${code} `;
  return `${symbol}${amount.toLocaleString()}`;
}

// ── Constants ─────────────────────────────────────────

const CYCLING_PLACEHOLDERS = [
  'My system sounds thin — what might cause that?',
  'I value warmth and flow. What DAC direction fits that?',
  'How would a Denafrips Ares sound in my system?',
  'Compare R-2R vs delta-sigma for long listening sessions',
  'Best DAC under $1000 for detail and naturalness',
  'What is Shindo known for?',
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
  | { type: 'ADD_CONSULTATION'; consultation: ConsultationResponse }
  | { type: 'ADD_NOTE'; content: string }
  | { type: 'SET_MODE'; mode: ConversationMode }
  | { type: 'SET_REASONING'; reasoning: ReasoningResult }
  | { type: 'SET_COMPARISON'; left: SubjectMatch; right: SubjectMatch; scope: 'brand' | 'product' }
  | { type: 'CLEAR_COMPARISON' }
  | { type: 'SET_CONSULTATION_CONTEXT'; subjects: SubjectMatch[]; originalQuery: string }
  | { type: 'CLEAR_CONSULTATION_CONTEXT' }
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

    case 'ADD_CONSULTATION':
      return {
        ...state,
        messages: [
          ...state.messages,
          { role: 'assistant', kind: 'consultation', consultation: action.consultation },
        ],
      };

    case 'ADD_NOTE':
      return {
        ...state,
        messages: [
          ...state.messages,
          { role: 'assistant', content: action.content, kind: 'note' },
        ],
      };

    case 'SET_MODE':
      return { ...state, activeMode: action.mode };

    case 'SET_REASONING':
      return { ...state, lastReasoning: action.reasoning };

    case 'SET_COMPARISON':
      return {
        ...state,
        activeComparison: { left: action.left, right: action.right, scope: action.scope },
      };

    case 'CLEAR_COMPARISON':
      return { ...state, activeComparison: undefined };

    case 'SET_CONSULTATION_CONTEXT':
      return {
        ...state,
        activeConsultation: { subjects: action.subjects, originalQuery: action.originalQuery },
      };

    case 'CLEAR_CONSULTATION_CONTEXT':
      return { ...state, activeConsultation: undefined };

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
  const { status } = useSession();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Taste profile — loaded from API for authenticated users
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null);
  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (p?.preferredTraits) {
          const parsed = parseTasteProfile(p.preferredTraits);
          if (!isProfileEmpty(parsed)) setTasteProfile(parsed);
        }
      })
      .catch(() => {/* ignore — widget just won't appear */});
  }, [status]);

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

    // ── Conversation router ──────────────────────────────
    // Classify the message into a conversation mode before detailed
    // intent detection. Mode persistence carries across turns.
    const routedMode = routeConversation(submittedText);
    const effectiveMode = resolveMode(routedMode, state.activeMode);
    dispatch({ type: 'SET_MODE', mode: effectiveMode });

    // Detect intent BEFORE running the evaluation engine
    // (moved above consultation so subjectMatches are available for brand comparison routing)
    let { intent, subjects, subjectMatches, desires } = detectIntent(submittedText);

    // ── Comparison follow-up detection ─────────────────
    // If an active comparison exists and the message looks like a
    // follow-up ("what's better with tubes?", "which has more flow?"),
    // resolve against the stored pair instead of falling through.
    if (
      state.activeComparison &&
      intent !== 'comparison' &&
      isComparisonFollowUp(submittedText, state.activeComparison)
    ) {
      const refinement = buildComparisonRefinement(state.activeComparison, submittedText);
      dispatch({ type: 'ADD_CONSULTATION', consultation: refinement });
      dispatch({ type: 'SET_LOADING', value: false });
      return;
    }

    // ── Context enrichment for active comparisons ──────
    // If an active comparison exists and the user provides system context
    // ("my amp is a Crayon CIA", "small room", "mostly jazz"), use it to
    // refine the comparison instead of falling through to diagnostic evaluation.
    if (
      state.activeComparison &&
      intent !== 'comparison'
    ) {
      const contextKind = detectContextEnrichment(submittedText);
      if (contextKind) {
        const refinement = buildContextRefinement(state.activeComparison, submittedText, contextKind);
        dispatch({ type: 'ADD_CONSULTATION', consultation: refinement });
        dispatch({ type: 'SET_LOADING', value: false });
        return;
      }
    }

    // ── Clear comparison on explicit mode shift ─────────
    // Shopping and diagnosis are new topics — drop the comparison context.
    if (state.activeComparison && (effectiveMode === 'shopping' || effectiveMode === 'diagnosis')) {
      dispatch({ type: 'CLEAR_COMPARISON' });
    }

    // ── Consultation follow-up detection ────────────────
    // If an active consultation exists (single-subject gear inquiry or
    // brand consultation) and the message looks like a follow-up
    // ("but aren't there smaller models?", "how is the bass?"),
    // resolve against the stored subject instead of falling through.
    if (
      state.activeConsultation &&
      intent !== 'comparison' &&
      intent !== 'shopping' &&
      isConsultationFollowUp(submittedText, state.activeConsultation)
    ) {
      const followUp = buildConsultationFollowUp(state.activeConsultation, submittedText);
      if (followUp) {
        dispatch({ type: 'ADD_CONSULTATION', consultation: followUp });
        dispatch({ type: 'SET_LOADING', value: false });
        return;
      }
    }

    // ── Clear consultation on explicit mode shift ───────
    // Shopping and diagnosis are new topics — drop the consultation context.
    if (state.activeConsultation && (effectiveMode === 'shopping' || effectiveMode === 'diagnosis')) {
      dispatch({ type: 'CLEAR_CONSULTATION_CONTEXT' });
    }

    // ── Consultation path ───────────────────────────────
    // Knowledge / philosophy questions — answer first, no diagnostic logic.
    // Also catches brand-level comparisons ("Chord vs Denafrips") that should
    // be handled at the philosophy level, not routed to product matching.
    // Gear inquiries with subjects also try consultation first — this ensures
    // brand links surface and richer brand profiles are used when available.
    // Falls through to gear-response if consultation returns null.
    const isBrandComparison = intent === 'comparison' && isBrandOnlyComparison(subjectMatches);
    const isGearWithSubjects = intent === 'gear_inquiry' && subjectMatches.length > 0;
    if (effectiveMode === 'consultation' || isBrandComparison || isGearWithSubjects) {
      const consultResult = buildConsultationResponse(submittedText, subjectMatches);
      if (consultResult) {
        // Store comparison context for follow-up turns
        if (isBrandComparison && subjectMatches.length >= 2) {
          dispatch({
            type: 'SET_COMPARISON',
            left: subjectMatches[0],
            right: subjectMatches[1],
            scope: 'brand',
          });
        }
        // Store consultation context for single-subject follow-ups
        if (subjectMatches.length > 0 && !isBrandComparison) {
          dispatch({
            type: 'SET_CONSULTATION_CONTEXT',
            subjects: subjectMatches,
            originalQuery: submittedText,
          });
        }
        dispatch({ type: 'ADD_CONSULTATION', consultation: consultResult });
        dispatch({ type: 'SET_LOADING', value: false });
        return;
      }
      // No match — fall through to gear inquiry path below
    }

    // ── Mode-aware intent override ─────────────────────
    // When in shopping mode, ALL intents stay in shopping so that
    // follow-ups like "what about the Pontus?" or "more warmth"
    // never fall through to the diagnostic engine.
    // Consultation is handled upstream (before detectIntent) and
    // returns early, so it cannot be swallowed by this override.
    if (effectiveMode === 'shopping' && intent !== 'shopping') {
      intent = 'shopping';
    }
    if (effectiveMode === 'diagnosis' && intent !== 'comparison' && intent !== 'gear_inquiry') {
      intent = 'diagnosis';
    }

    // Count how many shopping-answer turns have already been shown.
    const shoppingAnswerCount = messages.filter(
      (m) => m.role === 'assistant' && m.kind === 'shopping-answer',
    ).length;

    // Gear inquiries and comparisons — conversational path, skip diagnostic engine
    if (intent === 'gear_inquiry' || intent === 'comparison') {
      const gearResponse = buildGearResponse(intent, subjects, submittedText, desires, tasteProfile ?? undefined);
      if (gearResponse) {
        // Store comparison context for product-level comparisons
        if (intent === 'comparison' && subjectMatches.length >= 2) {
          dispatch({
            type: 'SET_COMPARISON',
            left: subjectMatches[0],
            right: subjectMatches[1],
            scope: subjectMatches.every((m) => m.kind === 'product') ? 'product' : 'brand',
          });
        }
        // Store consultation context for single-subject follow-ups
        if (intent === 'gear_inquiry' && subjectMatches.length > 0) {
          dispatch({
            type: 'SET_CONSULTATION_CONTEXT',
            subjects: subjectMatches,
            originalQuery: submittedText,
          });
        }
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

        if (intent === 'shopping') {
          // ── Shopping path ────────────────────────────
          // All shopping logic runs here — no diagnostic fallback.
          const shoppingCtx = detectShoppingIntent(allUserText, data.signals);

          // Decide: ask a clarification question or give a recommendation?
          // Skip clarifications if we've already given a recommendation
          // (refinement mode) or if we've hit the 2-turn cap.
          const maxClarifications = 2;
          const pastClarificationCap = shoppingAnswerCount > 0 || newTurnCount > maxClarifications;
          const shoppingQuestion = pastClarificationCap
            ? null
            : getShoppingClarification(shoppingCtx, data.signals, newTurnCount);

          if (shoppingQuestion) {
            // Still gathering context — ask one more question
            dispatch({
              type: 'ADD_QUESTION',
              clarification: {
                acknowledge: 'Got it — that helps narrow things down.',
                question: shoppingQuestion,
              },
            });
          } else {
            // ── Three-layer reasoning ──────────────────
            // Always run fresh reasoning on accumulated text.
            // lastReasoning is continuity context, not a substitute.
            const reasoning = reason(
              allUserText, desires, data.signals,
              tasteProfile ?? null, shoppingCtx,
            );
            dispatch({ type: 'SET_REASONING', reasoning });

            // On refinement turns, add a brief conversational bridge.
            if (shoppingAnswerCount > 0) {
              dispatch({
                type: 'ADD_NOTE',
                content: 'Got it — adjusting the direction based on what you\'ve added.',
              });
            }
            const answer = buildShoppingAnswer(shoppingCtx, data.signals, tasteProfile ?? undefined, reasoning);
            dispatch({ type: 'ADD_SHOPPING_ANSWER', answer, signals: data.signals });

            // Subtle note when the stored taste profile influenced the direction
            if (reasoning.taste.storedProfileUsed) {
              dispatch({
                type: 'ADD_NOTE',
                content: 'Your taste profile contributed to this direction.',
              });
            }
          }
        } else {
          // ── Diagnosis path ───────────────────────────
          // Churn avoidance — on first turn, check for vague upgrade intent
          // without clear symptoms. If detected, ask a reflective question
          // before proceeding to diagnosis.
          if (newTurnCount === 1) {
            const churn = detectChurnSignal(submittedText);
            if (churn.detected && churn.reflectiveQuestion) {
              dispatch({
                type: 'ADD_QUESTION',
                clarification: {
                  acknowledge: 'That\'s worth thinking through.',
                  question: churn.reflectiveQuestion,
                },
              });
              dispatch({ type: 'SET_LOADING', value: false });
              return;
            }
          }

          // Check if more context is needed before showing results
          const clarification = getClarificationQuestion(
            data.signals,
            data.result,
            newTurnCount,
            allUserText,
            submittedText,
          );

          // ── Three-layer reasoning (diagnosis) ──────
          const reasoning = reason(
            allUserText, desires, data.signals,
            tasteProfile ?? null, null,
          );
          dispatch({ type: 'SET_REASONING', reasoning });

          // Use reasoning direction to frame diagnosis results
          const diagDirection = inferSystemDirection(submittedText, desires, undefined, tasteProfile ?? undefined);

          if (clarification) {
            dispatch({ type: 'ADD_QUESTION', clarification });
          } else {
            dispatch({ type: 'ADD_ANALYSIS', signals: data.signals, result: data.result, systemDirection: diagDirection });
          }
        }
      }
    } catch {
      // Silently handle — user can retry
    }

    dispatch({ type: 'SET_LOADING', value: false });
  }, [currentInput, isLoading, messages, turnCount, tasteProfile, state.activeMode]);

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
        maxWidth: 720,
        margin: '0 auto',
        padding: '3rem 1.5rem 3rem',
        color: '#1a1a1a',
        lineHeight: 1.6,
      }}
    >
      {/* Header — always visible */}
      <div
        style={{
          borderTop: '3px solid #b8372e',
          width: 48,
          marginBottom: '1.5rem',
        }}
      />

      <h1
        style={{
          marginBottom: '0.4rem',
          fontSize: '1.85rem',
          fontWeight: 700,
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
          color: '#111',
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
              marginBottom: '1.75rem',
              maxWidth: 560,
              color: '#666',
              fontSize: '0.98rem',
              lineHeight: 1.65,
            }}
          >
            A listening advisor that interprets what you hear, reflects underlying system traits,
            and suggests the most sensible next step.
          </p>

          {/* Compact taste widget — authenticated users with profile data */}
          {tasteProfile && tasteProfile.confidence > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                marginBottom: '1.75rem',
                padding: '0.7rem 0.95rem',
                border: '1px solid #e5e5e3',
                borderRadius: 8,
                background: '#fff',
                maxWidth: 360,
              }}
            >
              <TasteRadar profile={tasteProfile} compact size={80} />
              <div style={{ fontSize: '0.88rem', lineHeight: 1.55, color: '#666' }}>
                <div style={{ fontWeight: 600, color: '#333', marginBottom: '0.2rem', fontSize: '0.82rem', letterSpacing: '0.03em', textTransform: 'uppercase' as const }}>
                  Your taste
                </div>
                <div>
                  {topTraits(tasteProfile, 3).map((t) => t.label).join(' · ')}
                </div>
                <Link
                  href="/profile"
                  style={{
                    fontSize: '0.82rem',
                    color: '#999',
                    textDecoration: 'none',
                  }}
                >
                  Edit →
                </Link>
              </div>
            </div>
          )}

          {/* Example prompts removed — revisit later */}
        </>
      )}

      {/* Conversation thread */}
      {hasMessages && (
        <div style={{ marginTop: '0.75rem', marginBottom: '1.5rem' }}>
          {messages
            .filter((msg) => {
              // In inquiry mode (pending question), suppress analysis messages
              if (hasPendingQuestion && msg.role === 'assistant' && 'kind' in msg && msg.kind === 'analysis') {
                return false;
              }
              return true;
            })
            .map((msg, i) => (
              <div
                key={i}
                style={{
                  animation: 'fadeInUp 0.3s ease-out both',
                  animationDelay: `${Math.min(i * 0.05, 0.3)}s`,
                }}
              >
                <MessageBubble key={i} message={msg} />
              </div>
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
              fontSize: '0.78rem',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#999',
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
            minHeight: hasMessages ? 72 : 130,
            padding: '0.9rem 1rem',
            border: '1px solid #d5d5d0',
            borderRadius: 8,
            outline: 'none',
            fontSize: '0.98rem',
            lineHeight: 1.6,
            resize: 'vertical',
            background: '#fff',
            color: '#1a1a1a',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#8a8a85';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.04)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#d5d5d0';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />

        {/* Input hint — landing state only */}
        {!hasMessages && (
          <div
            style={{
              marginTop: '0.5rem',
              fontSize: '0.82rem',
              color: '#aaa',
              lineHeight: 1.5,
            }}
          >
            Describe what you hear, name a component, or ask about a technology. Press Enter to send.
          </div>
        )}

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
              padding: '2px 0',
              margin: 0,
              cursor: 'pointer',
              color: '#aaa',
              fontSize: '0.85rem',
              fontFamily: 'inherit',
              textDecoration: 'none',
              letterSpacing: '0.01em',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#666'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#aaa'; }}
          >
            Start over
          </button>
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          marginTop: '3.5rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid #e5e5e3',
        }}
      >
        <Link
          href="/about"
          style={{
            color: '#aaa',
            fontSize: '0.85rem',
            textDecoration: 'none',
            letterSpacing: '0.01em',
          }}
        >
          How this works
        </Link>
      </div>
    </div>
  );
}

// ── Thinking Indicator ────────────────────────────────

function ThinkingIndicator() {
  return (
    <div
      style={{
        padding: '0.85rem 0',
        color: '#999',
        fontSize: '0.88rem',
        letterSpacing: '0.01em',
        animation: 'thinking-pulse 2.2s ease-in-out infinite',
      }}
    >
      Thinking…
    </div>
  );
}

// ── Message Rendering ─────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <div
        style={{
          marginBottom: '1.5rem',
          padding: '0.85rem 1.1rem',
          background: '#f5f5f3',
          borderRadius: 8,
          color: '#333',
          fontSize: '0.98rem',
          lineHeight: 1.6,
        }}
      >
        {message.content}
      </div>
    );
  }

  if (message.kind === 'analysis') {
    return (
      <div style={{ marginBottom: '1.75rem' }}>
        <hr style={{ border: 0, borderTop: '1px solid #e5e5e3', margin: '0 0 1.5rem 0' }} />

        {/* System direction context — tendency and desired direction */}
        {message.systemDirection && (message.systemDirection.tendencySummary || message.systemDirection.directionSummary) && (
          <div
            style={{
              marginBottom: '1.25rem',
              padding: '0.85rem 1.1rem',
              borderLeft: '3px solid #a89870',
              background: '#faf9f6',
              borderRadius: '0 6px 6px 0',
              color: '#444',
              fontSize: '0.95rem',
              lineHeight: 1.65,
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
        <hr style={{ border: 0, borderTop: '1px solid #e5e5e3', margin: '0 0 1.5rem 0' }} />
        <ShoppingRecommendation answer={message.answer} signals={message.signals} />
      </div>
    );
  }

  if (message.kind === 'glossary') {
    return (
      <div
        style={{
          marginTop: '1.25rem',
          marginBottom: '1.5rem',
          padding: '1rem 1.15rem',
          borderLeft: '3px solid #3d8a5a',
          background: '#f7faf8',
          borderRadius: '0 8px 8px 0',
        }}
      >
        <div
          style={{
            marginBottom: '0.45rem',
            fontSize: '0.72rem',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#3d8a5a',
          }}
        >
          Audio term
        </div>
        <div
          style={{
            marginBottom: '0.4rem',
            fontSize: '1.05rem',
            fontWeight: 600,
            color: '#1a1a1a',
          }}
        >
          {message.entry.term}
        </div>
        <p style={{ margin: '0 0 0.35rem 0', color: '#333', fontSize: '0.95rem', lineHeight: 1.65 }}>
          {message.entry.explanation}
        </p>
        {message.entry.example && (
          <p style={{ margin: 0, color: '#888', fontSize: '0.9rem', lineHeight: 1.55, fontStyle: 'italic' }}>
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
          marginTop: '1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* "What I'm hearing" reflective block */}
        {response.hearing && response.hearing.length > 0 && (
          <div
            style={{
              margin: '0 0 1.1rem 0',
              padding: '0.8rem 1.1rem',
              borderLeft: '3px solid #a89870',
              background: '#faf9f6',
              borderRadius: '0 6px 6px 0',
              fontSize: '0.93rem',
              lineHeight: 1.65,
              color: '#555',
            }}
          >
            <div style={{ fontWeight: 600, color: '#444', marginBottom: '0.35rem', fontSize: '0.82rem', letterSpacing: '0.03em', textTransform: 'uppercase' as const }}>
              What I&apos;m hearing
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.15rem', listStyleType: 'disc' }}>
              {response.hearing.map((bullet, i) => (
                <li key={i} style={{ marginBottom: i < response.hearing!.length - 1 ? '0.25rem' : 0 }}>
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Advisory body — flows as natural prose */}
        <div
          style={{
            margin: '0 0 1.1rem 0',
            color: '#333',
            fontSize: '0.98rem',
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
            padding: '0.85rem 1.1rem',
            borderLeft: '3px solid #5a8a9a',
            background: '#f5f9fa',
            borderRadius: '0 6px 6px 0',
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

  if (message.kind === 'consultation') {
    const { consultation } = message;
    return (
      <div
        style={{
          marginTop: '1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Comparison summary — renders first, answers the question */}
        {consultation.comparisonSummary && (
          <p
            style={{
              margin: '0 0 1rem 0',
              color: '#222',
              fontSize: '1.02rem',
              lineHeight: 1.7,
              fontWeight: 500,
            }}
          >
            {consultation.comparisonSummary}
          </p>
        )}

        <div
          style={{
            margin: '0 0 1.1rem 0',
            color: '#333',
            fontSize: '0.98rem',
            lineHeight: 1.7,
          }}
        >
          <p style={{ margin: '0 0 0.7rem 0' }}>
            {consultation.philosophy}
          </p>
          <p style={{ margin: '0 0 0.7rem 0' }}>
            {consultation.tendencies}
          </p>
          {consultation.systemContext && (
            <p style={{ margin: '0 0 0.7rem 0' }}>
              {consultation.systemContext}
            </p>
          )}
        </div>

        {/* Structured reference links — grouped by kind */}
        {consultation.links && consultation.links.length > 0 && (() => {
          const refLinks = consultation.links.filter((l) => !l.kind || l.kind === 'reference');
          const dealerLinks = consultation.links.filter((l) => l.kind === 'dealer');
          const reviewLinks = consultation.links.filter((l) => l.kind === 'review');
          const renderLinkGroup = (links: typeof consultation.links, label?: string) => (
            <div style={{ marginBottom: '0.3rem' }}>
              {label && (
                <span style={{ color: '#888', fontSize: '0.82rem', marginRight: '0.5rem' }}>{label}</span>
              )}
              {links!.map((link) => (
                <span key={link.url} style={{ marginRight: '1.2rem' }}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#4a7a8a', textDecoration: 'none' }}
                  >
                    {link.label}
                    {link.region && link.region !== 'global' && (
                      <span style={{ color: '#999', fontSize: '0.8rem', marginLeft: '0.25rem' }}>
                        ({link.region})
                      </span>
                    )}
                    {' '}↗
                  </a>
                </span>
              ))}
            </div>
          );
          return (
            <div
              style={{
                marginBottom: '0.9rem',
                fontSize: '0.88rem',
                color: '#666',
                lineHeight: 1.8,
              }}
            >
              {refLinks.length > 0 && renderLinkGroup(refLinks)}
              {dealerLinks.length > 0 && renderLinkGroup(dealerLinks, 'Dealers:')}
              {reviewLinks.length > 0 && renderLinkGroup(reviewLinks, 'Reference:')}
            </div>
          );
        })()}

        {/* Optional light follow-up */}
        {consultation.followUp && (
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
              {consultation.followUp}
            </div>
          </div>
        )}
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
      {/* Provisional marker */}
      {answer.provisional && (
        <div
          style={{
            margin: '0 0 1rem 0',
            padding: '0.6rem 0.85rem',
            background: '#faf8f4',
            borderLeft: '3px solid #b8a070',
            fontSize: '0.92rem',
            lineHeight: 1.55,
            color: '#666',
          }}
        >
          Based on what you&apos;ve shared so far — you can keep refining this.
          Try things like &ldquo;I want more body&rdquo; or &ldquo;what if my system is already bright?&rdquo;
        </div>
      )}

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
                      {formatPrice(product.price, product.priceCurrency)}
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

      {/* Dependency caveat (e.g., phono stage for turntables) */}
      {answer.dependencyCaveat && (
        <div
          style={{
            margin: '0 0 1.25rem 0',
            padding: '0.75rem 1rem',
            borderLeft: '3px solid #c4915e',
            background: '#fdf8f3',
            fontSize: '0.95rem',
            lineHeight: 1.6,
            color: '#555',
          }}
        >
          <strong style={{ color: '#8a6530' }}>Important:</strong>{' '}
          {answer.dependencyCaveat}
        </div>
      )}

      {/* Dependency-aware refinement question */}
      {answer.refinementQuestion && (
        <p
          style={{
            margin: '0 0 1rem 0',
            color: '#555',
            fontStyle: 'italic',
            lineHeight: 1.55,
          }}
        >
          {answer.refinementQuestion}
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
