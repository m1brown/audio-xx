'use client';

import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import TasteRadar from '@/components/TasteRadar';
import AdvisoryMessage from '@/components/advisory/AdvisoryMessage';
import type { PreferenceSelection } from '@/components/advisory/AdvisoryMessage';
import {
  consultationToAdvisory,
  gearResponseToAdvisory,
  shoppingToAdvisory,
  analysisToAdvisory,
  assessmentToAdvisory,
  knowledgeToAdvisory,
  assistantToAdvisory,
  withPhonoCaveat,
} from '@/lib/advisory-response';
import type { AdvisoryResponse, ShoppingAdvisoryContext } from '@/lib/advisory-response';
import { buildProductAssessment } from '@/lib/product-assessment';
import type { AssessmentContext } from '@/lib/product-assessment';
import { buildKnowledgeResponse, buildAssistantResponse, requestKnowledgeLlm, requestAssistantLlm } from '@/lib/audio-lanes';
import type { KnowledgeContext, AssistantContext as AudioAssistantContext } from '@/lib/audio-lanes';
import { buildDecisionFrame } from '@/lib/decision-frame';
import { getClarificationQuestion } from '@/lib/clarification';
import type { ClarificationResponse } from '@/lib/clarification';
import { detectShoppingIntent, buildShoppingAnswer, getShoppingClarification } from '@/lib/shopping-intent';
import { checkGlossaryQuestion } from '@/lib/glossary';
import { detectIntent, isComparisonFollowUp, isConsultationFollowUp, detectContextEnrichment, respondToMusicInput, detectListeningPath, respondToListeningPath, synthesizeOnboardingQuery, type SubjectMatch } from '@/lib/intent';
import { attachQuickRecommendation } from '@/lib/quick-recommendation';
import { type ConvState, INITIAL_CONV_STATE, transition as convTransition, detectInitialMode as detectConvMode } from '@/lib/conversation-state';
import { buildGearResponse } from '@/lib/gear-response';
import { inferSystemDirection } from '@/lib/system-direction';
import { routeConversation, resolveMode } from '@/lib/conversation-router';
import type { ConversationMode } from '@/lib/conversation-router';
import { buildConsultationResponse, buildComparisonRefinement, buildContextRefinement, classifySubjectAsContext, buildConsultationFollowUp, buildSystemAssessment, buildConsultationEntry, buildCableAdvisory, buildSystemDiagnosis } from '@/lib/consultation';
import { findReferenceProduct, buildExplorationResponse, explorationToConsultation } from '@/lib/exploration';
import { buildIntakeResponse, intakeToAdvisory } from '@/lib/intake';
import { inferUnknownProduct } from '@/lib/llm-product-inference';
import { inferProvisionalSystemAssessment } from '@/lib/llm-system-inference';
import type { GlossaryResult } from '@/lib/glossary';
import type { Message, ConversationState } from '@/lib/conversation-types';
import { parseTasteProfile, topTraits, isProfileEmpty, type TasteProfile } from '@/lib/taste-profile';
import { detectChurnSignal } from '@/lib/churn-avoidance';
import { reason } from '@/lib/reasoning';
import type { ReasoningResult } from '@/lib/reasoning';
import { useAudioSession } from '@/lib/audio-session-context';
import { buildTurnContext, type TurnContext } from '@/lib/turn-context';
import { requestLlmOverlay } from '@/lib/memo-llm-overlay';
import { requestShoppingEditorial, mergeEditorialIntoOptions, requestEditorialClosing } from '@/lib/shopping-llm-overlay';
import type { ShoppingEditorialContext } from '@/lib/shopping-llm-overlay';
import { logOverlayAttempt, logOverlayFailure } from '@/lib/memo-render-log';
import SystemBadge from '@/components/system/SystemBadge';
import SystemPanel from '@/components/system/SystemPanel';
import SystemEditor from '@/components/system/SystemEditor';
import SystemSavePrompt from '@/components/system/SystemSavePrompt';
import type { DraftSystem } from '@/lib/system-types';

// ── Constants ─────────────────────────────────────────

/** Design tokens — FT-inspired, calm premium palette. */
const COLOR = {
  bg: '#F7F3EB',
  textPrimary: '#2B2A28',
  textSecondary: '#7A7570',
  accent: '#B08D57',
  accentHover: '#9A7A48',
  accentSubtle: 'rgba(176,141,87,0.08)',
  border: '#E2DDD4',
  inputBg: '#FFFEFA',
  chipBg: '#F0EBE1',
  chipBorder: '#D5CEBC',
} as const;

// Cycling placeholders removed — static placeholder is now used.

/** Maps internal category keys to natural, correctly-cased display labels. */
const CATEGORY_DISPLAY: Record<string, string> = {
  dac: 'a DAC',
  amplifier: 'an amplifier',
  speaker: 'speakers',
  headphone: 'headphones',
  turntable: 'a turntable',
  streamer: 'a streamer',
  general: 'audio gear',
};

/** Returns a natural display phrase for a category key. */
function categoryLabel(key: string): string {
  return CATEGORY_DISPLAY[key] ?? key;
}

/** Generate a stable message ID for advisory messages. */
function advisoryId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `adv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}


// ── Reducer ───────────────────────────────────────────

type Action =
  | { type: 'SET_INPUT'; value: string }
  | { type: 'ADD_USER_MESSAGE' }
  | { type: 'ADD_QUESTION'; clarification: ClarificationResponse }
  | { type: 'ADD_GLOSSARY'; entry: GlossaryResult }
  | { type: 'ADD_ADVISORY'; advisory: AdvisoryResponse; id?: string }
  | { type: 'UPDATE_ADVISORY'; id: string; advisory: AdvisoryResponse }
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

    case 'ADD_ADVISORY':
      return {
        ...state,
        messages: [
          ...state.messages,
          { role: 'assistant', kind: 'advisory', advisory: action.advisory, ...(action.id ? { id: action.id } : {}) },
        ],
      };

    case 'UPDATE_ADVISORY':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.role === 'assistant' && m.kind === 'advisory' && 'id' in m && m.id === action.id
            ? { ...m, advisory: action.advisory }
            : m,
        ),
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
  const { state: audioState, dispatch: audioDispatch } = useAudioSession();

  // ── System panel/editor UI state (local, not in context) ──
  const [systemPanelOpen, setSystemPanelOpen] = useState(false);
  const [systemEditorOpen, setSystemEditorOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState(false);
  /** Prefill data for editor when opening from a proposed system. */
  const [editorPrefill, setEditorPrefill] = useState<DraftSystem | null>(null);
  /** Fingerprints of dismissed proposals — prevents re-prompting same system. */
  const dismissedFingerprintsRef = useRef(new Set<string>());
  /** When true, bypasses consultation confidence gating and produces exploratory suggestions. */
  const skipToSuggestionsRef = useRef(false);
  /** Set after an intake form has been shown — forces next intake-classified message to shopping. */
  const intakeShownRef = useRef(false);
  /** Conversation state machine — tracks the first 2–4 turns with explicit transitions. */
  const convStateRef = useRef<ConvState>(INITIAL_CONV_STATE);
  /** Set after the music-input first question is asked — next message is interpreted as the listening-path answer. */
  const awaitingListeningPathRef = useRef(false);
  /** Tracks accumulated onboarding context across the music → path → follow-up sequence. */
  const onboardingContextRef = useRef<{
    musicDescription: string;
    listeningPath: 'headphones' | 'speakers' | 'unknown';
  } | null>(null);
  /** Tracks chip-initiated intent — persists across turns so follow-ups stay in the correct lane. */
  const chipIntentRef = useRef<'shopping' | 'improvement' | 'diagnosis' | 'comparison' | null>(null);

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

  const handleSubmit = useCallback(async (overrideText?: string) => {
    const inputText = overrideText ?? currentInput;
    if (!inputText.trim() || isLoading) return;

    // If override was provided, set the input first so ADD_USER_MESSAGE captures it
    if (overrideText) {
      dispatch({ type: 'SET_INPUT', value: overrideText });
    }

    const submittedText = inputText;
    dispatch({ type: 'ADD_USER_MESSAGE' });
    dispatch({ type: 'SET_LOADING', value: true });

    // Check for glossary questions first — no API call needed
    const glossaryResult = checkGlossaryQuestion(submittedText);
    if (glossaryResult) {
      dispatch({ type: 'ADD_GLOSSARY', entry: glossaryResult });
      dispatch({ type: 'SET_LOADING', value: false });
      return;
    }

    // ── Conversation state machine routing ──────────────
    // When the state machine is active (mode !== 'idle'), route through
    // transition() before the legacy ref-based blocks below.
    let convModeHint: ConversationMode | undefined;
    if (convStateRef.current.mode !== 'idle') {
      // When the state machine is active, it is the single source of truth.
      // Clear legacy refs that duplicate music_input / onboarding tracking
      // so they never fire stale handlers after convState resets.
      awaitingListeningPathRef.current = false;
      onboardingContextRef.current = null;

      const earlyTurnCtx = buildTurnContext(submittedText, audioState, dismissedFingerprintsRef.current);
      const { intent: earlyIntent } = detectIntent(submittedText);
      const convResult = convTransition(convStateRef.current, submittedText, {
        hasSystem: !!earlyTurnCtx.activeSystem || !!audioState.activeSystemRef,
        subjectCount: earlyTurnCtx.subjectMatches.length,
        detectedIntent: earlyIntent,
      });
      convStateRef.current = convResult.state;

      if (convResult.response) {
        if (convResult.response.kind === 'question') {
          dispatch({
            type: 'ADD_QUESTION',
            clarification: {
              acknowledge: convResult.response.acknowledge,
              question: convResult.response.question,
            },
          });
          dispatch({ type: 'SET_LOADING', value: false });
          return;
        }
        if (convResult.response.kind === 'note') {
          dispatch({ type: 'ADD_NOTE', content: convResult.response.content });
          dispatch({ type: 'SET_LOADING', value: false });
          return;
        }
        if (convResult.response.kind === 'proceed') {
          // ── Synthesized query (onboarding music → path → budget completion) ──
          if (convResult.response.synthesizedQuery) {
            const synthesized = convResult.response.synthesizedQuery;
            const synCategory = convResult.state.facts.listeningPath === 'headphones' ? 'headphones' : 'speakers';
            const synTurnCtx = buildTurnContext(synthesized, audioState, dismissedFingerprintsRef.current);
            const synAdvisoryCtx: ShoppingAdvisoryContext = {
              systemComponents: synTurnCtx.activeSystem
                ? synTurnCtx.activeSystem.components.map((c) => {
                    const b = (c.brand || '').trim();
                    const n = (c.name || '').trim();
                    if (!b) return n || 'Unknown';
                    if (!n) return b;
                    if (n.toLowerCase().startsWith(b.toLowerCase())) return n;
                    return `${b} ${n}`;
                  })
                : undefined,
              systemLocation: synTurnCtx.activeSystem?.location ?? undefined,
              systemPrimaryUse: synTurnCtx.activeSystem?.primaryUse ?? undefined,
              storedDesires: tasteProfile
                ? topTraits(tasteProfile, 5).map((t) => t.label)
                : undefined,
              systemTendencies: synTurnCtx.activeSystem?.tendencies ?? undefined,
            };
            dispatch({ type: 'SET_MODE', mode: 'shopping' });

            // Attempt API evaluation for richer signal extraction.
            // On failure, fall back to deterministic shopping with
            // empty signals — the user always gets recommendations.
            let evalSignals: import('@/lib/signal-types').ExtractedSignals | null = null;
            try {
              const res = await fetch('/api/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: synthesized }),
              });
              if (res.ok) {
                const data = await res.json();
                evalSignals = data.signals;
              } else {
                console.warn('[onboarding→shopping] /api/evaluate returned', res.status, '— using deterministic fallback');
              }
            } catch (err) {
              console.warn('[onboarding→shopping] /api/evaluate failed:', err, '— using deterministic fallback');
            }

            // Use evaluated signals or fall back to empty signals.
            // The shopping pipeline works deterministically with empty
            // signals — it just produces less personalized results.
            const signals = evalSignals ?? {
              traits: {} as Record<string, import('@/lib/signal-types').SignalDirection>,
              symptoms: [] as string[],
              archetype_hints: [] as string[],
              uncertainty_level: 0,
              matched_phrases: [] as string[],
              matched_uncertainty_markers: [] as string[],
            };

            try {
              const shoppingCtx = detectShoppingIntent(synthesized, signals, synAdvisoryCtx.systemComponents);
              const reasoning = reason(
                synthesized, synTurnCtx.desires, signals,
                tasteProfile ?? null, shoppingCtx, synTurnCtx.activeProfile,
              );
              dispatch({ type: 'SET_REASONING', reasoning });
              const answer = buildShoppingAnswer(shoppingCtx, signals, tasteProfile ?? undefined, reasoning, synAdvisoryCtx.systemComponents);
              const decisionFrame = buildDecisionFrame(shoppingCtx.category, synAdvisoryCtx, tasteProfile);
              const shoppingAdvisory = shoppingToAdvisory(answer, signals, reasoning, synAdvisoryCtx, decisionFrame);
              const budgetMatch = submittedText.match(/\$?\d[\d,]*/);
              const budgetStr = budgetMatch ? `under ${budgetMatch[0].startsWith('$') ? budgetMatch[0] : '$' + budgetMatch[0]}` : '';
              const quickSummary = `You're looking for ${categoryLabel(synCategory)}${budgetStr ? ' ' + budgetStr : ''}.`;
              const quickAdvisory = attachQuickRecommendation(shoppingAdvisory, synCategory, quickSummary);
              dispatch({ type: 'ADD_ADVISORY', advisory: quickAdvisory, id: advisoryId() });
            } catch (err) {
              console.warn('[onboarding→shopping] Shopping pipeline error:', err, '— asking category');
              dispatch({
                type: 'ADD_QUESTION',
                clarification: {
                  acknowledge: 'Got it.',
                  question: 'What type of component? For example: speakers, headphones, DAC, amplifier, or turntable.',
                },
              });
            }
            convStateRef.current = INITIAL_CONV_STATE;
            dispatch({ type: 'SET_LOADING', value: false });
            return;
          }

          // ── Ready to recommend / diagnose / compare ──
          // Set mode hint and fall through to normal pipeline.
          if (convResult.state.stage === 'ready_to_recommend') convModeHint = 'shopping';
          else if (convResult.state.stage === 'ready_to_diagnose') convModeHint = 'diagnosis';
          convStateRef.current = INITIAL_CONV_STATE;
          // Fall through to normal pipeline below...
        }
      }
      // null response or proceed — fall through to normal pipeline
      if (convStateRef.current.stage === 'done') {
        convStateRef.current = INITIAL_CONV_STATE;
      }
    }

    // ── Chip-intent routing (legacy — dead code when convState is active) ──
    // When a chip set an explicit intent, the user's reply should stay in
    // that lane. Override normal intent detection with the chip's intent.
    if (chipIntentRef.current) {
      const chipIntent = chipIntentRef.current;
      chipIntentRef.current = null; // One-shot: consume after use

      if (chipIntent === 'shopping') {
        // User replied to "What are you looking for?" → route to shopping
        // Prepend "I want to buy" to strengthen shopping signal for downstream
        const shoppingText = `I want to buy ${submittedText}`;
        dispatch({ type: 'SET_MODE', mode: 'shopping' });

        // Build context and fire shopping pipeline.
        // Attempt API evaluation for richer signals; on failure, fall back
        // to deterministic shopping with empty signals.
        const turnCtx = buildTurnContext(shoppingText, audioState, dismissedFingerprintsRef.current);
        let chipSignals: import('@/lib/signal-types').ExtractedSignals = {
          traits: {} as Record<string, import('@/lib/signal-types').SignalDirection>,
          symptoms: [] as string[],
          archetype_hints: [] as string[],
          uncertainty_level: 0,
          matched_phrases: [] as string[],
          matched_uncertainty_markers: [] as string[],
        };
        try {
          const res = await fetch('/api/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: shoppingText }),
          });
          if (res.ok) {
            const data = await res.json();
            chipSignals = data.signals;
          } else {
            console.warn('[chip→shopping] /api/evaluate returned', res.status, '— using deterministic fallback');
          }
        } catch (err) {
          console.warn('[chip→shopping] /api/evaluate failed:', err, '— using deterministic fallback');
        }

        try {
          const shoppingCtx = detectShoppingIntent(shoppingText, chipSignals, undefined);
          // Check if we have enough to recommend (category + budget)
          const hasBudget = /\$\d|\bunder\b|\bbudget\b/i.test(submittedText);
          if (shoppingCtx.category !== 'general' && hasBudget) {
            // Enough info — recommend immediately
            const reasoning = reason(shoppingText, turnCtx.desires, chipSignals, tasteProfile ?? null, shoppingCtx, turnCtx.activeProfile);
            dispatch({ type: 'SET_REASONING', reasoning });
            const answer = buildShoppingAnswer(shoppingCtx, chipSignals, tasteProfile ?? undefined, reasoning, undefined);
            const decisionFrame = buildDecisionFrame(shoppingCtx.category, {} as ShoppingAdvisoryContext, tasteProfile);
            const advisory = shoppingToAdvisory(answer, chipSignals, reasoning, {} as ShoppingAdvisoryContext, decisionFrame);
            dispatch({ type: 'ADD_ADVISORY', advisory, id: advisoryId() });
          } else if (shoppingCtx.category !== 'general') {
            // Have category but no budget — ask budget
            dispatch({
              type: 'ADD_QUESTION',
              clarification: {
                acknowledge: `Got it — looking for ${categoryLabel(shoppingCtx.category)}.`,
                question: 'What\'s your budget? And do you have a system these need to work with?',
              },
            });
            chipIntentRef.current = 'shopping'; // Keep in shopping lane
          } else {
            // Category not detected — ask to clarify
            dispatch({
              type: 'ADD_QUESTION',
              clarification: {
                acknowledge: 'Got it.',
                question: 'What type of component? For example: speakers, headphones, DAC, amplifier, or turntable.',
              },
            });
            chipIntentRef.current = 'shopping'; // Keep in shopping lane
          }
        } catch (err) {
          console.warn('[chip→shopping] pipeline error:', err, '— asking category');
          dispatch({
            type: 'ADD_QUESTION',
            clarification: {
              acknowledge: 'Got it.',
              question: 'What type of component? For example: speakers, headphones, DAC, amplifier, or turntable.',
            },
          });
          chipIntentRef.current = 'shopping';
        }
        dispatch({ type: 'SET_LOADING', value: false });
        return;
      }

      if (chipIntent === 'diagnosis') {
        // User described a problem → route directly to diagnosis
        // Let the normal diagnosis path handle it, but force intent
        const turnCtx = buildTurnContext(submittedText, audioState, dismissedFingerprintsRef.current);
        // If no system is declared, ask for system before diagnosing
        if (!turnCtx.activeSystem && !audioState.activeSystemRef) {
          dispatch({
            type: 'ADD_QUESTION',
            clarification: {
              acknowledge: `Understood — "${submittedText}."`,
              question: 'What\'s in your system? Knowing the main components (source, DAC, amp, speakers) will help me pinpoint where this is coming from.',
            },
          });
          // Stay in diagnosis lane — next reply provides system context
          chipIntentRef.current = 'diagnosis';
          dispatch({ type: 'SET_LOADING', value: false });
          return;
        }
        // Has system — fall through to normal diagnosis (don't return, let handleSubmit continue)
      }

      if (chipIntent === 'improvement') {
        // User provided system details → treat as system_assessment
        // The text likely contains component names now
        const turnCtx = buildTurnContext(submittedText, audioState, dismissedFingerprintsRef.current);
        if (turnCtx.subjectMatches.length > 0) {
          // Has gear names — route to consultation/assessment
          // Fall through to normal routing with a nudge toward consultation
          dispatch({ type: 'SET_MODE', mode: 'consultation' });
          // Don't return — let normal handleSubmit routing handle it with mode set
        } else {
          // No gear detected — ask again more specifically
          dispatch({
            type: 'ADD_QUESTION',
            clarification: {
              acknowledge: 'Got it.',
              question: 'Can you name the specific components? For example: "Bluesound Node, Hegel H190, KEF Q350." That way I can identify the best upgrade path.',
            },
          });
          chipIntentRef.current = 'improvement'; // Stay in lane
          dispatch({ type: 'SET_LOADING', value: false });
          return;
        }
      }

      if (chipIntent === 'comparison') {
        // User named components to compare
        const turnCtx = buildTurnContext(submittedText, audioState, dismissedFingerprintsRef.current);
        if (turnCtx.subjectMatches.length >= 2) {
          // Two subjects detected — fall through to comparison routing
          // Normal detectIntent will pick up 'comparison' since text has two products
        } else if (turnCtx.subjectMatches.length === 1) {
          // Only one component — ask for the second
          dispatch({
            type: 'ADD_QUESTION',
            clarification: {
              acknowledge: `${turnCtx.subjectMatches[0].name} — got it.`,
              question: 'What do you want to compare it against?',
            },
          });
          chipIntentRef.current = 'comparison'; // Stay in lane
          dispatch({ type: 'SET_LOADING', value: false });
          return;
        } else {
          // No components detected — ask again
          dispatch({
            type: 'ADD_QUESTION',
            clarification: {
              acknowledge: 'I didn\'t catch specific product names.',
              question: 'Which two components are you comparing? For example: "Chord Qutest vs Denafrips Ares II"',
            },
          });
          chipIntentRef.current = 'comparison'; // Stay in lane
          dispatch({ type: 'SET_LOADING', value: false });
          return;
        }
      }
    }

    // ── Music-input second stage ─────────────────────────
    // If the previous turn asked "Do you listen on headphones or speakers?"
    // interpret this message as the listening-path answer and return the
    // appropriate follow-up. Still clarification mode — no advisory yet.
    if (awaitingListeningPathRef.current) {
      awaitingListeningPathRef.current = false;
      const listeningPath = detectListeningPath(submittedText);
      const listeningResponse = respondToListeningPath(listeningPath);
      dispatch({ type: 'ADD_NOTE', content: listeningResponse });
      // Store path in onboarding context — next reply completes the sequence
      if (onboardingContextRef.current) {
        onboardingContextRef.current.listeningPath = listeningPath;
      }
      dispatch({ type: 'SET_LOADING', value: false });
      return;
    }

    // ── Onboarding third stage ──────────────────────────
    // The user answered: music → path → now budget/preference.
    // Synthesize a shopping query from accumulated context and route directly.
    if (onboardingContextRef.current) {
      const ctx = onboardingContextRef.current;
      onboardingContextRef.current = null; // Clear — one-shot
      const category = ctx.listeningPath === 'headphones' ? 'headphones' : 'speakers';
      const synthesized = synthesizeOnboardingQuery(ctx.musicDescription, category, submittedText);
      // Replace the submitted text with the synthesized query for downstream routing
      const syntheticTurnCtx = buildTurnContext(synthesized, audioState, dismissedFingerprintsRef.current);
      const syntheticAdvisoryCtx: ShoppingAdvisoryContext = {
        systemComponents: syntheticTurnCtx.activeSystem
          ? syntheticTurnCtx.activeSystem.components.map((c) => {
              const b = (c.brand || '').trim();
              const n = (c.name || '').trim();
              if (!b) return n || 'Unknown';
              if (!n) return b;
              if (n.toLowerCase().startsWith(b.toLowerCase())) return n;
              return `${b} ${n}`;
            })
          : undefined,
        systemLocation: syntheticTurnCtx.activeSystem?.location ?? undefined,
        systemPrimaryUse: syntheticTurnCtx.activeSystem?.primaryUse ?? undefined,
        storedDesires: tasteProfile
          ? topTraits(tasteProfile, 5).map((t) => t.label)
          : undefined,
        systemTendencies: syntheticTurnCtx.activeSystem?.tendencies ?? undefined,
      };
      // Route into shopping: fire API call with synthesized query.
      // Falls back to deterministic shopping if the API is unavailable.
      dispatch({ type: 'SET_MODE', mode: 'shopping' });
      let legacyEvalSignals: import('@/lib/signal-types').ExtractedSignals | null = null;
      try {
        const res = await fetch('/api/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: synthesized }),
        });
        if (res.ok) {
          const data = await res.json();
          legacyEvalSignals = data.signals;
        } else {
          console.warn('[legacy-onboarding] /api/evaluate returned', res.status, '— using deterministic fallback');
        }
      } catch (err) {
        console.warn('[legacy-onboarding] /api/evaluate failed:', err, '— using deterministic fallback');
      }
      const legacySignals = legacyEvalSignals ?? {
        traits: {} as Record<string, import('@/lib/signal-types').SignalDirection>,
        symptoms: [] as string[],
        archetype_hints: [] as string[],
        uncertainty_level: 0,
        matched_phrases: [] as string[],
        matched_uncertainty_markers: [] as string[],
      };
      try {
        const shoppingCtx = detectShoppingIntent(synthesized, legacySignals, syntheticAdvisoryCtx.systemComponents);
        const reasoning = reason(
          synthesized, syntheticTurnCtx.desires, legacySignals,
          tasteProfile ?? null, shoppingCtx, syntheticTurnCtx.activeProfile,
        );
        dispatch({ type: 'SET_REASONING', reasoning });
        const answer = buildShoppingAnswer(shoppingCtx, legacySignals, tasteProfile ?? undefined, reasoning, syntheticAdvisoryCtx.systemComponents);
        const decisionFrame = buildDecisionFrame(shoppingCtx.category, syntheticAdvisoryCtx, tasteProfile);
        const shoppingAdvisory = shoppingToAdvisory(answer, legacySignals, reasoning, syntheticAdvisoryCtx, decisionFrame);
        const budgetMatch = submittedText.match(/\$?\d[\d,]*/);
        const budgetStr = budgetMatch ? `under ${budgetMatch[0].startsWith('$') ? budgetMatch[0] : '$' + budgetMatch[0]}` : '';
        const quickSummary = `You're looking for ${categoryLabel(category)}${budgetStr ? ' ' + budgetStr : ''}.`;
        const quickAdvisory = attachQuickRecommendation(shoppingAdvisory, category, quickSummary);
        dispatch({ type: 'ADD_ADVISORY', advisory: quickAdvisory, id: advisoryId() });
      } catch (err) {
        console.warn('[legacy-onboarding] Shopping pipeline error:', err, '— asking category');
        dispatch({
          type: 'ADD_QUESTION',
          clarification: {
            acknowledge: 'Got it.',
            question: 'What type of component? For example: speakers, headphones, DAC, amplifier, or turntable.',
          },
        });
      }
      dispatch({ type: 'SET_LOADING', value: false });
      return;
    }

    // ── Build canonical turn context ────────────────────
    // Single extraction pass: subjects, desires, system detection,
    // active system resolution, profile, confidence — all builders
    // and routing decisions consume this same object.
    const turnCtx = buildTurnContext(submittedText, audioState, dismissedFingerprintsRef.current);

    // ── Build AudioProfile context (shared across all advisory paths) ──
    const advisoryCtx: ShoppingAdvisoryContext = {
      systemComponents: turnCtx.activeSystem
        ? turnCtx.activeSystem.components.map((c) => {
            const b = (c.brand || '').trim();
            const n = (c.name || '').trim();
            if (!b) return n || 'Unknown';
            if (!n) return b;
            // Avoid "JOB JOB Integrated" — if name already starts with the brand, skip prefix
            if (n.toLowerCase().startsWith(b.toLowerCase())) return n;
            return `${b} ${n}`;
          })
        : undefined,
      systemLocation: turnCtx.activeSystem?.location ?? undefined,
      systemPrimaryUse: turnCtx.activeSystem?.primaryUse ?? undefined,
      storedDesires: tasteProfile
        ? topTraits(tasteProfile, 5).map((t) => t.label)
        : undefined,
      systemTendencies: turnCtx.activeSystem?.tendencies ?? undefined,
    };

    // ── Phono caveat helper ────────────────────────────────
    // Wraps any advisory with phono stage awareness before dispatch.
    // No-op when the advisory subject doesn't involve turntables.
    const phonoWrap = (a: AdvisoryResponse): AdvisoryResponse =>
      withPhonoCaveat(a, turnCtx.activeSystem);

    // Dispatch wrapper that applies phono caveat to all advisory messages.
    const dispatchAdvisory = (advisory: AdvisoryResponse, id?: string) => {
      dispatch({ type: 'ADD_ADVISORY', advisory: phonoWrap(advisory), ...(id ? { id } : {}) });
    };

    // ── Conversation router ──────────────────────────────
    // Classify the message into a conversation mode before detailed
    // intent detection. Mode persistence carries across turns.
    const routedMode = routeConversation(submittedText);
    const effectiveMode = convModeHint ?? resolveMode(routedMode, state.activeMode);
    dispatch({ type: 'SET_MODE', mode: effectiveMode });

    // ── Detect intent ───────────────────────────────────
    // Intent detection runs after extraction. We only need the intent
    // classification — subjectMatches, desires, and subjects are
    // already canonical in turnCtx.
    let { intent } = detectIntent(submittedText);

    // ── State machine: initial mode detection (idle → active) ──
    // Routes every first message through detectConvMode to ensure the
    // response clearly reflects the detected entry mode.
    if (convStateRef.current.mode === 'idle' && !convModeHint) {
      const initialConvMode = detectConvMode(submittedText, {
        detectedIntent: intent,
        hasSystem: !!turnCtx.activeSystem || !!audioState.activeSystemRef,
        subjectCount: turnCtx.subjectMatches.length,
      });
      if (initialConvMode) {
        convStateRef.current = initialConvMode;

        // ── System entry — confirm system, ask what to improve ──
        if (initialConvMode.mode === 'system_assessment' && initialConvMode.stage === 'entry') {
          // Run transition immediately to produce the "what are you trying to improve?" question
          const convResult = convTransition(initialConvMode, submittedText, {
            hasSystem: !!turnCtx.activeSystem || !!audioState.activeSystemRef,
            subjectCount: turnCtx.subjectMatches.length,
            detectedIntent: intent,
          });
          convStateRef.current = convResult.state;
          if (convResult.response && convResult.response.kind === 'question') {
            dispatch({
              type: 'ADD_QUESTION',
              clarification: {
                acknowledge: convResult.response.acknowledge,
                question: convResult.response.question,
              },
            });
            dispatch({ type: 'SET_LOADING', value: false });
            return;
          }
        }

        // ── Orientation — beginner uncertainty must not fall to diagnosis ──
        if (initialConvMode.mode === 'orientation') {
          dispatch({
            type: 'ADD_QUESTION',
            clarification: {
              acknowledge: 'Good place to start.',
              question: 'Are you looking to buy something new, improve what you already have, or troubleshoot a problem you\'re hearing?',
            },
          });
          dispatch({ type: 'SET_LOADING', value: false });
          return;
        }

        // ── Problem entry — gate on system before running diagnosis ──
        if (initialConvMode.mode === 'diagnosis' && initialConvMode.stage === 'clarify_system') {
          dispatch({
            type: 'ADD_QUESTION',
            clarification: {
              acknowledge: `Understood — "${submittedText.length > 60 ? submittedText.slice(0, 57) + '...' : submittedText}."`,
              question: "What's in your system? Knowing the main components will help me pinpoint where this is coming from.",
            },
          });
          dispatch({ type: 'SET_LOADING', value: false });
          return;
        }

        // ── Music input — set state, let existing handler produce first response ──
        if (initialConvMode.mode === 'music_input') {
          // Let existing music_input handler below run for the first response
        }

        // ── Shopping — recommend immediately or ask ONE question ──
        if (initialConvMode.mode === 'shopping') {
          // Override intent so we never fall to generic intake
          intent = 'shopping';
          if (initialConvMode.stage === 'ready_to_recommend') {
            // Explicit purchase intent — skip clarifications, recommend immediately
            skipToSuggestionsRef.current = true;
          } else {
            // State is set — pipeline will ask ONE narrowing question via getShoppingClarification
          }
        }

        // ── Comparison — compare directly when 2+ subjects, else ask ──
        if (initialConvMode.mode === 'comparison') {
          if (initialConvMode.stage === 'ready_to_compare') {
            intent = 'comparison';
            // Fall through to normal pipeline for direct comparison
          } else {
            // Only 1 or 0 subjects — ask for targets
            const convResult = convTransition(initialConvMode, submittedText, {
              hasSystem: !!turnCtx.activeSystem || !!audioState.activeSystemRef,
              subjectCount: turnCtx.subjectMatches.length,
              detectedIntent: intent,
            });
            convStateRef.current = convResult.state;
            if (convResult.response && convResult.response.kind === 'question') {
              dispatch({
                type: 'ADD_QUESTION',
                clarification: {
                  acknowledge: convResult.response.acknowledge,
                  question: convResult.response.question,
                },
              });
              dispatch({ type: 'SET_LOADING', value: false });
              return;
            }
          }
        }
      }
    }

    // ── Intake → shopping promotion ─────────────────────
    // If we already showed intake questions, the user's reply is their
    // intake answers. Default to shopping — UNLESS the router detected
    // a strong non-shopping signal (diagnosis, consultation, system
    // assessment). These signals indicate the user is providing
    // constraint/preference info, not answering intake questions, and
    // must break the intake→shopping lock to avoid misrouting.
    if (intakeShownRef.current) {
      intakeShownRef.current = false; // Always reset so future messages detect normally
      const strongNonShoppingMode = routedMode === 'diagnosis' || routedMode === 'consultation';
      if (!strongNonShoppingMode) {
        intent = 'shopping';
      }
      // When a strong signal is detected, keep the intent from detectIntent()
      // and let the normal routing (effectiveMode) handle it correctly.
    }


    // ── Dispatch proposed system ────────────────────────
    if (turnCtx.proposedSystem && !dismissedFingerprintsRef.current.has(turnCtx.proposedSystem.fingerprint)) {
      audioDispatch({ type: 'SET_PROPOSED_SYSTEM', proposed: turnCtx.proposedSystem });
    } else if (!turnCtx.proposedSystem) {
      // Clear any stale proposal from a previous turn
      audioDispatch({ type: 'SET_PROPOSED_SYSTEM', proposed: null });
    }

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
      dispatchAdvisory(consultationToAdvisory(refinement, undefined, advisoryCtx), advisoryId());
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
        dispatchAdvisory(consultationToAdvisory(refinement, undefined, advisoryCtx), advisoryId());
        dispatch({ type: 'SET_LOADING', value: false });
        return;
      }
    }

    // ── Bare product/brand answer for active comparison ──
    // If the comparison follow-up asked about pairing context and the
    // user answered with a product/brand name (e.g. "devore o96"),
    // treat it as system context rather than triggering a gear essay.
    if (
      state.activeComparison &&
      intent !== 'comparison' &&
      intent !== 'shopping' &&
      effectiveMode !== 'diagnosis' &&
      turnCtx.subjectMatches.length > 0
    ) {
      const subjectContextKind = classifySubjectAsContext(turnCtx.subjectMatches);
      const refinement = buildContextRefinement(state.activeComparison, submittedText, subjectContextKind);
      dispatchAdvisory(consultationToAdvisory(refinement, undefined, advisoryCtx), advisoryId());
      dispatch({ type: 'SET_LOADING', value: false });
      return;
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
        dispatchAdvisory(consultationToAdvisory(followUp, undefined, advisoryCtx), advisoryId());
        dispatch({ type: 'SET_LOADING', value: false });
        return;
      }
    }

    // ── Clear consultation on explicit mode shift ───────
    // Shopping and diagnosis are new topics — drop the consultation context.
    if (state.activeConsultation && (effectiveMode === 'shopping' || effectiveMode === 'diagnosis')) {
      dispatch({ type: 'CLEAR_CONSULTATION_CONTEXT' });
    }

    // ── Consultation entry path ────────────────────────
    // User asks for system assessment or upgrade guidance but hasn't named
    // specific gear. Produces a structured intake response that explains
    // the evaluation approach and asks for system details.
    if (intent === 'consultation_entry') {
      const entryResult = buildConsultationEntry(submittedText, turnCtx.desires, turnCtx.activeSystem);
      dispatchAdvisory(consultationToAdvisory(entryResult, undefined, advisoryCtx), advisoryId());
      dispatch({ type: 'SET_LOADING', value: false });
      return;
    }

    // ── Music input path ──────────────────────────────────
    // User leads with musical taste ("I listen to jazz", "I like Van Halen").
    // Acknowledge briefly and ask one guiding question. No advisory logic yet.
    if (intent === 'music_input') {
      const musicResponse = respondToMusicInput(submittedText);
      dispatch({ type: 'ADD_NOTE', content: musicResponse });
      awaitingListeningPathRef.current = true;
      // Store original music description for the onboarding sequence
      onboardingContextRef.current = { musicDescription: submittedText, listeningPath: 'unknown' };
      dispatch({ type: 'SET_LOADING', value: false });
      return;
    }

    // ── Guided intake path ──────────────────────────────
    // Vague entry queries ("I want a new stereo", "I need speakers")
    // get structured intake questions before routing to shopping.
    if (intent === 'intake') {
      const intakeResult = buildIntakeResponse(submittedText);
      dispatchAdvisory(intakeToAdvisory(intakeResult), advisoryId());
      intakeShownRef.current = true;
      dispatch({ type: 'SET_LOADING', value: false });
      return;
    }

    // ── Cable advisory path ────────────────────────────
    // Cable queries get a structured advisory response covering cable
    // strategy, system context, tuning direction, and trade-offs.
    if (intent === 'cable_advisory') {
      const cableResult = buildCableAdvisory(submittedText, turnCtx.subjectMatches, turnCtx.desires, turnCtx.activeSystem);
      dispatchAdvisory(consultationToAdvisory(cableResult, undefined, advisoryCtx), advisoryId());
      if (turnCtx.subjectMatches.length > 0) {
        dispatch({
          type: 'SET_CONSULTATION_CONTEXT',
          subjects: turnCtx.subjectMatches,
          originalQuery: submittedText,
        });
      }
      dispatch({ type: 'SET_LOADING', value: false });
      return;
    }

    // ── System assessment path ─────────────────────────
    // User describes their system and asks for evaluation — answer first with
    // per-component character descriptions and system interaction summary,
    // then ask what they want to explore. Must fire before consultation/comparison
    // to prevent multi-brand system descriptions from being misrouted.
    if (intent === 'system_assessment') {
      const assessmentResult = buildSystemAssessment(submittedText, turnCtx.subjectMatches, turnCtx.activeSystem, turnCtx.desires);
      if (assessmentResult) {
        if (assessmentResult.kind === 'clarification') {
          // Validation detected a conflict — ask the user before proceeding
          dispatch({ type: 'ADD_QUESTION', clarification: assessmentResult.clarification });
          dispatch({ type: 'SET_LOADING', value: false });
          return;
        }

        // ── Provisional System Assessment Mode ──────────────
        // When too many components are unknown, the deterministic model
        // can't produce a reliable system reading. Fall back to LLM-assisted
        // whole-system assessment with clear provenance labeling.
        if (assessmentResult.kind === 'low_confidence') {
          const knownDescriptions = assessmentResult.components
            .filter(c => c.product || c.brandProfile)
            .map(c => ({
              name: c.displayName,
              character: c.character,
              source: (c.product ? 'product' : 'brand') as 'product' | 'brand',
            }));
          const componentNames = assessmentResult.components.map(c => c.displayName);
          const provisional = await inferProvisionalSystemAssessment(
            assessmentResult.query,
            componentNames,
            knownDescriptions,
          );
          if (provisional) {
            // Override source to provisional_system for distinct UI labeling
            provisional.source = 'provisional_system';
            const provisionalAdvisory = consultationToAdvisory(provisional, undefined, advisoryCtx);
            provisionalAdvisory.unknownComponents = assessmentResult.unknownComponents;
            dispatchAdvisory(provisionalAdvisory, advisoryId());
            dispatch({ type: 'SET_LOADING', value: false });
            return;
          }
          // LLM call failed — fall through to consultation path
          dispatch({ type: 'SET_LOADING', value: false });
          return;
        }

        const assessmentMsgId = advisoryId();
        const deterministicAdvisory = consultationToAdvisory(assessmentResult.response, undefined, advisoryCtx);
        dispatchAdvisory(deterministicAdvisory, assessmentMsgId);
        // Store consultation context so follow-ups stay in the system context
        dispatch({
          type: 'SET_CONSULTATION_CONTEXT',
          subjects: turnCtx.subjectMatches,
          originalQuery: submittedText,
        });
        dispatch({ type: 'SET_LOADING', value: false });

        // Fire-and-forget: request LLM overlay for prose refinement.
        // On success, merge validated fields into the advisory and update in place.
        // On failure (timeout, validation rejection), the deterministic memo stands.
        const overlayStart = Date.now();
        const overlayComponentCount = assessmentResult.findings.componentNames.length;
        requestLlmOverlay(assessmentResult.findings).then((result) => {
          const latency = Date.now() - overlayStart;
          if (!result) {
            logOverlayFailure(assessmentMsgId, overlayComponentCount, latency);
            return;
          }
          // Log the attempt (even if no fields accepted)
          logOverlayAttempt(
            assessmentMsgId, overlayComponentCount,
            result.fields, result.fields, result.rejections, latency,
          );
          if (Object.keys(result.fields).length === 0) return;
          const merged = { ...deterministicAdvisory };
          if (result.fields.introSummary) merged.introSummary = result.fields.introSummary;
          if (result.fields.keyObservation) merged.keyObservation = result.fields.keyObservation;
          if (result.fields.recommendedSequence) merged.recommendedSequence = result.fields.recommendedSequence;
          dispatch({ type: 'UPDATE_ADVISORY', id: assessmentMsgId, advisory: merged });
        }).catch(() => {
          logOverlayFailure(assessmentMsgId, overlayComponentCount, Date.now() - overlayStart);
        });

        return;
      }
      // Falls through to consultation if assessment couldn't identify enough components
    }

    // ── Consultation path ───────────────────────────────
    // Knowledge / philosophy questions — answer first, no diagnostic logic.
    // Also catches brand-level comparisons ("Chord vs Denafrips") that should
    // be handled at the philosophy level, not routed to product matching.
    // Includes product-level comparisons with brand context ("compare klipsch
    // heresy to devore o/96") — these have both brand and product subject
    // matches but should still route through the structured comparison builder.
    // Gear inquiries with subjects also try consultation first — this ensures
    // brand links surface and richer brand profiles are used when available.
    // Falls through to gear-response if consultation returns null.
    const brandMatches = turnCtx.subjectMatches.filter((m) => m.kind === 'brand');
    const isBrandComparison = intent === 'comparison' && brandMatches.length >= 2;
    const isGearWithSubjects = intent === 'gear_inquiry' && turnCtx.subjectMatches.length > 0;
    if (effectiveMode === 'consultation' || isBrandComparison || isGearWithSubjects) {
      const consultResult = buildConsultationResponse(submittedText, turnCtx.subjectMatches);
      if (consultResult) {
        // Store comparison context for follow-up turns
        if (isBrandComparison && turnCtx.subjectMatches.length >= 2) {
          dispatch({
            type: 'SET_COMPARISON',
            left: turnCtx.subjectMatches[0],
            right: turnCtx.subjectMatches[1],
            scope: 'brand',
          });
        }
        // Store consultation context for single-subject follow-ups
        if (turnCtx.subjectMatches.length > 0 && !isBrandComparison) {
          dispatch({
            type: 'SET_CONSULTATION_CONTEXT',
            subjects: turnCtx.subjectMatches,
            originalQuery: submittedText,
          });
        }
        dispatchAdvisory(consultationToAdvisory(consultResult, undefined, advisoryCtx), advisoryId());
        dispatch({ type: 'SET_LOADING', value: false });
        return;
      }
      // No catalog match — try LLM inference for unknown products/brands
      {
        const subjectName = turnCtx.subjectMatches.length > 0
          ? turnCtx.subjectMatches.map((m) => m.name).join(' ')
          : undefined;
        const inferred = await inferUnknownProduct(submittedText, subjectName);
        if (inferred) {
          dispatchAdvisory(consultationToAdvisory(inferred, undefined, advisoryCtx), advisoryId());
          dispatch({ type: 'SET_LOADING', value: false });
          return;
        }
        // LLM inference also failed — show a transparent fallback message
        // instead of silently falling through to an empty response.
        if (subjectName) {
          const fallbackResponse: import('@/lib/consultation').ConsultationResponse = {
            subject: subjectName,
            philosophy: `I don't have calibrated data on ${subjectName} in my product database. This means I can't provide the kind of detailed, review-sourced assessment I'd normally offer.`,
            tendencies: `If you can tell me more about this product — what type it is, its approximate price range, or what you've heard about it — I can offer general directional guidance based on the design approach. Alternatively, I can suggest products in a similar category that I do have detailed data on.`,
            followUp: `What category is ${subjectName} — is it a DAC, amplifier, speaker, or something else?`,
          };
          dispatchAdvisory(consultationToAdvisory(fallbackResponse, undefined, advisoryCtx), advisoryId());
          dispatch({ type: 'SET_LOADING', value: false });
          return;
        }
      }
      // No subjects identified — fall through to gear inquiry path below
    }

    // ── Mode-aware intent override ─────────────────────
    // When in shopping mode, ALL intents stay in shopping so that
    // follow-ups like "what about the Pontus?" or "more warmth"
    // never fall through to the diagnostic engine.
    // Consultation is handled upstream (before detectIntent) and
    // returns early, so it cannot be swallowed by this override.
    // product_assessment is exempt — "I'm considering the X" should
    // always produce a direct assessment, even mid-shopping flow.
    if (effectiveMode === 'shopping' && intent !== 'shopping' && intent !== 'product_assessment') {
      intent = 'shopping';
    }
    if (effectiveMode === 'diagnosis' && intent !== 'comparison' && intent !== 'gear_inquiry' && intent !== 'system_assessment') {
      intent = 'diagnosis';
    }

    // ── Product assessment — "I'm considering the X" ───
    // Fires when user asks about a specific product with assessment
    // language. Produces a structured evaluation, not a shopping list.
    if (intent === 'product_assessment') {
      const assessmentCtx: AssessmentContext = {
        subjectMatches: turnCtx.subjectMatches,
        activeSystem: turnCtx.activeSystem,
        tasteProfile: tasteProfile ?? undefined,
        advisoryCtx,
        currentMessage: submittedText,
      };
      const assessment = buildProductAssessment(assessmentCtx);
      if (assessment) {
        const advisory = assessmentToAdvisory(assessment, advisoryCtx);
        dispatchAdvisory(advisory);
        dispatch({ type: 'SET_LOADING', value: false });
        return;
      }
      // If assessment builder returns null (can't identify product),
      // fall through to gear inquiry path
    }

    // ── Exploration — "what else is like X?" ───────────
    // Maps a philosophical neighborhood around a reference product.
    if (intent === 'exploration') {
      const refProduct = findReferenceProduct(turnCtx.subjectMatches, submittedText);
      if (refProduct) {
        const exploration = buildExplorationResponse(refProduct, turnCtx.activeSystem, submittedText);
        const consultResult = explorationToConsultation(exploration);
        dispatchAdvisory(consultationToAdvisory(consultResult, undefined, advisoryCtx), advisoryId());
        if (turnCtx.subjectMatches.length > 0) {
          dispatch({
            type: 'SET_CONSULTATION_CONTEXT',
            subjects: turnCtx.subjectMatches,
            originalQuery: submittedText,
          });
        }
        dispatch({ type: 'SET_LOADING', value: false });
        return;
      }
      // If no reference product found, fall through to gear inquiry
    }

    // Count how many shopping advisory turns have already been shown.
    const shoppingAnswerCount = messages.filter(
      (m) => m.role === 'assistant' && m.kind === 'advisory' && m.advisory.kind === 'shopping',
    ).length;

    // Gear inquiries and comparisons — conversational path, skip diagnostic engine
    if (intent === 'gear_inquiry' || intent === 'comparison') {
      const gearResponse = buildGearResponse(intent, turnCtx.subjects, submittedText, turnCtx.desires, tasteProfile ?? undefined, turnCtx.activeSystem);
      if (gearResponse) {
        // Store comparison context for product-level comparisons
        if (intent === 'comparison' && turnCtx.subjectMatches.length >= 2) {
          dispatch({
            type: 'SET_COMPARISON',
            left: turnCtx.subjectMatches[0],
            right: turnCtx.subjectMatches[1],
            scope: turnCtx.subjectMatches.every((m) => m.kind === 'product') ? 'product' : 'brand',
          });
        }
        // Store consultation context for single-subject follow-ups
        if (intent === 'gear_inquiry' && turnCtx.subjectMatches.length > 0) {
          dispatch({
            type: 'SET_CONSULTATION_CONTEXT',
            subjects: turnCtx.subjectMatches,
            originalQuery: submittedText,
          });
        }
        dispatchAdvisory(gearResponseToAdvisory(gearResponse, undefined, advisoryCtx), advisoryId());
        dispatch({ type: 'SET_LOADING', value: false });
        return;
      }
    }

    // ── Lane 2: Audio Knowledge ────────────────────────
    // General audio questions not tied to a system decision.
    // LLM generates prose; structured context is passed as input.
    if (intent === 'audio_knowledge') {
      const knowledgeCtx: KnowledgeContext = {
        currentMessage: submittedText,
        subjectMatches: turnCtx.subjectMatches,
        activeSystem: turnCtx.activeSystem,
        tasteProfile: tasteProfile ?? undefined,
        advisoryCtx,
      };
      const knowledge = buildKnowledgeResponse(knowledgeCtx);
      const knowledgeMsgId = advisoryId();
      dispatchAdvisory(knowledgeToAdvisory(knowledge, advisoryCtx), knowledgeMsgId);

      // Fire LLM call to replace placeholder explanation with real content.
      // Keep loading indicator until LLM responds or times out.
      requestKnowledgeLlm(knowledgeCtx).then((result) => {
        if (result) {
          const updated = { ...knowledge, explanation: result.explanation };
          if (result.keyPoints) updated.keyPoints = result.keyPoints;
          dispatch({ type: 'UPDATE_ADVISORY', id: knowledgeMsgId, advisory: knowledgeToAdvisory(updated, advisoryCtx) });
        } else {
          // LLM failed — update with a more helpful fallback
          const fallback = { ...knowledge, explanation: `I don't have enough structured data to answer this question thoroughly. This topic — ${knowledge.topic} — falls outside my calibrated product database. In a future update, I'll be able to provide deeper coverage here.` };
          dispatch({ type: 'UPDATE_ADVISORY', id: knowledgeMsgId, advisory: knowledgeToAdvisory(fallback, advisoryCtx) });
        }
        dispatch({ type: 'SET_LOADING', value: false });
      }).catch(() => {
        dispatch({ type: 'SET_LOADING', value: false });
      });
      return;
    }

    // ── Lane 3: Audio Assistant ──────────────────────────
    // Practical hobby tasks — negotiation, translation, message writing,
    // travel/audition logistics. Open LLM with tone guardrails.
    if (intent === 'audio_assistant') {
      const assistCtx: AudioAssistantContext = {
        currentMessage: submittedText,
        subjectMatches: turnCtx.subjectMatches,
        activeSystem: turnCtx.activeSystem,
      };
      const assistant = buildAssistantResponse(assistCtx);
      const assistMsgId = advisoryId();
      dispatchAdvisory(assistantToAdvisory(assistant), assistMsgId);

      // Fire LLM call to generate the actual task output.
      requestAssistantLlm(assistCtx).then((result) => {
        if (result) {
          const updated = { ...assistant, body: result.body };
          if (result.tips) updated.tips = result.tips;
          dispatch({ type: 'UPDATE_ADVISORY', id: assistMsgId, advisory: assistantToAdvisory(updated) });
        } else {
          const fallback = { ...assistant, body: `I wasn't able to complete this task right now. The language model service didn't respond in time. Please try again.` };
          dispatch({ type: 'UPDATE_ADVISORY', id: assistMsgId, advisory: assistantToAdvisory(fallback) });
        }
        dispatch({ type: 'SET_LOADING', value: false });
      }).catch(() => {
        dispatch({ type: 'SET_LOADING', value: false });
      });
      return;
    }

    // ── System diagnosis short-circuit ─────────────────
    // When diagnosis intent fires AND user mentioned system components,
    // produce a concise contextual diagnosis directly — no need for the
    // full evaluate engine. This handles: "I have X and Y, sounds dry."
    if (intent === 'diagnosis' && turnCtx.subjectMatches.length >= 1) {
      const sysDiag = buildSystemDiagnosis(submittedText, turnCtx.subjectMatches);
      if (sysDiag) {
        dispatchAdvisory(consultationToAdvisory(sysDiag, undefined, advisoryCtx), advisoryId());
        // Save system context for continuity
        if (turnCtx.subjectMatches.length >= 2) {
          dispatch({
            type: 'SET_SYSTEM_CONTEXT',
            components: turnCtx.subjectMatches.map((m) => m.name),
            source: submittedText,
          });
        }
        dispatch({ type: 'SET_LOADING', value: false });
        return;
      }
      // If buildSystemDiagnosis returns null, fall through to evaluate engine
    }

    // Shopping and diagnosis intents go through the evaluation engine.
    // Attempt API evaluation for richer signals; on failure, fall back
    // to deterministic pipeline with empty signals.
    const allUserText = [...messages.filter((m) => m.role === 'user').map((m) => m.content), submittedText].join('\n');
    const newTurnCount = turnCount + 1;

    let evalData: { signals: import('@/lib/signal-types').ExtractedSignals; result?: unknown } | null = null;
    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: allUserText }),
      });
      if (res.ok) {
        evalData = await res.json();
      } else {
        console.warn('[main-pipeline] /api/evaluate returned', res.status, '— using deterministic fallback');
      }
    } catch (err) {
      console.warn('[main-pipeline] /api/evaluate failed:', err, '— using deterministic fallback');
    }

    // Use evaluated signals or fall back to empty signals.
    // The shopping pipeline works deterministically with empty signals —
    // it just produces less personalized results.
    const pipelineSignals: import('@/lib/signal-types').ExtractedSignals = evalData?.signals ?? {
      traits: {} as Record<string, import('@/lib/signal-types').SignalDirection>,
      symptoms: [] as string[],
      archetype_hints: [] as string[],
      uncertainty_level: 0,
      matched_phrases: [] as string[],
      matched_uncertainty_markers: [] as string[],
    };

    if (intent === 'shopping') {
      // ── Shopping path ────────────────────────────
      // All shopping logic runs here — no diagnostic fallback.
      try {
        const shoppingCtx = detectShoppingIntent(allUserText, pipelineSignals, advisoryCtx.systemComponents);

        // Decide: ask a clarification question or give a recommendation?
        // Skip clarifications if we've already given a recommendation
        // (refinement mode), hit the turn cap, or user requested quick suggestions.
        const maxClarifications = 2;
        const wantsQuickSuggestions = skipToSuggestionsRef.current;
        const pastClarificationCap = shoppingAnswerCount > 0 || newTurnCount > maxClarifications;
        const shoppingQuestion = pastClarificationCap
          ? null
          : getShoppingClarification(shoppingCtx, pipelineSignals, newTurnCount, wantsQuickSuggestions);
        // Reset skip flag after use
        if (wantsQuickSuggestions) skipToSuggestionsRef.current = false;

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
            allUserText, turnCtx.desires, pipelineSignals,
            tasteProfile ?? null, shoppingCtx, turnCtx.activeProfile,
          );
          dispatch({ type: 'SET_REASONING', reasoning });

          // On refinement turns, add a brief conversational bridge.
          if (shoppingAnswerCount > 0) {
            dispatch({
              type: 'ADD_NOTE',
              content: 'Got it — adjusting the direction based on what you\'ve added.',
            });
          }
          // Add exploratory note when skipping to quick suggestions
          if (wantsQuickSuggestions) {
            dispatch({
              type: 'ADD_NOTE',
              content: 'Showing a range of design philosophies since I don\'t have your full listening profile yet. Tell me more about your system and preferences anytime to sharpen the direction.',
            });
          }
          const answer = buildShoppingAnswer(shoppingCtx, pipelineSignals, tasteProfile ?? undefined, reasoning, advisoryCtx.systemComponents);

          // Build decision frame — strategic framing before product shortlist
          const decisionFrame = buildDecisionFrame(shoppingCtx.category, advisoryCtx, tasteProfile);

          const deterministicShoppingAdvisory = shoppingToAdvisory(answer, pipelineSignals, reasoning, advisoryCtx, decisionFrame);
          const shoppingMsgId = advisoryId();
          dispatchAdvisory(deterministicShoppingAdvisory, shoppingMsgId);

          // Fire-and-forget: request LLM editorial overlay for richer product descriptions.
          // On success, merge enriched fields into the advisory and update in place.
          // On failure (timeout, validation rejection), the deterministic descriptions stand.
          if (deterministicShoppingAdvisory.options && deterministicShoppingAdvisory.options.length > 0) {
            const editorialContext: ShoppingEditorialContext = {
              // System
              systemComponents: turnCtx.activeSystem
                ? turnCtx.activeSystem.components.map((c) =>
                    c.name.toLowerCase().startsWith(c.brand.toLowerCase())
                      ? c.name
                      : `${c.brand} ${c.name}`,
                  )
                : undefined,
              systemCharacter: turnCtx.activeSystem?.tendencies ?? undefined,
              // Taste & preferences
              tasteLabel: reasoning.taste.tasteLabel || undefined,
              archetype: reasoning.taste.archetype ?? undefined,
              desires: reasoning.taste.desires.map((d) => ({
                quality: d.quality,
                direction: d.direction,
              })),
              preserve: reasoning.direction.preserve.length > 0
                ? reasoning.direction.preserve
                : undefined,
              traitSignals: Object.keys(reasoning.taste.traitSignals).length > 0
                ? reasoning.taste.traitSignals
                : undefined,
              archetypeHints: pipelineSignals.archetype_hints?.length > 0
                ? pipelineSignals.archetype_hints
                : undefined,
              // Shopping context
              category: shoppingCtx.category,
              budget: shoppingCtx.budgetAmount ? `$${shoppingCtx.budgetAmount}` : undefined,
              userQuery: submittedText,
              // Directional recommendation
              directionStatement: reasoning.direction.statement || undefined,
              archetypeNote: reasoning.direction.archetypeNote ?? undefined,
            };
            // Fire both LLM requests in parallel
            const editorialPromise = requestShoppingEditorial(
              deterministicShoppingAdvisory.options, editorialContext,
            );
            const closingPromise = requestEditorialClosing(
              deterministicShoppingAdvisory.options, editorialContext,
            );

            Promise.allSettled([editorialPromise, closingPromise])
              .then(([editorialResult, closingResult]) => {
                const editorial = editorialResult.status === 'fulfilled' ? editorialResult.value : null;
                const closing = closingResult.status === 'fulfilled' ? closingResult.value : null;

                if (!editorial && !closing) return;

                const enrichedOptions = editorial && editorial.length > 0
                  ? mergeEditorialIntoOptions(deterministicShoppingAdvisory.options!, editorial)
                  : deterministicShoppingAdvisory.options;

                dispatch({
                  type: 'UPDATE_ADVISORY',
                  id: shoppingMsgId,
                  advisory: {
                    ...deterministicShoppingAdvisory,
                    options: enrichedOptions,
                    editorialClosing: closing ?? undefined,
                  },
                });
              })
              .catch(() => { /* deterministic descriptions stand */ });
          }

          // Subtle note when the stored taste profile influenced the direction
          if (reasoning.taste.storedProfileUsed) {
            dispatch({
              type: 'ADD_NOTE',
              content: 'Your taste profile contributed to this direction.',
            });
          }
        }
      } catch (err) {
        console.warn('[main-pipeline] shopping pipeline error:', err, '— asking category');
        dispatch({
          type: 'ADD_QUESTION',
          clarification: {
            acknowledge: 'Got it.',
            question: 'What type of component? For example: speakers, headphones, DAC, amplifier, or turntable.',
          },
        });
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

      if (evalData) {
        // API succeeded — use full evaluation data
        const clarification = getClarificationQuestion(
          pipelineSignals,
          evalData.result,
          newTurnCount,
          allUserText,
          submittedText,
        );

        // ── Three-layer reasoning (diagnosis) ──────
        const reasoning = reason(
          allUserText, turnCtx.desires, pipelineSignals,
          tasteProfile ?? null, null, turnCtx.activeProfile,
        );
        dispatch({ type: 'SET_REASONING', reasoning });

        // Use reasoning direction to frame diagnosis results
        const diagDirection = inferSystemDirection(submittedText, turnCtx.desires, undefined, tasteProfile ?? undefined);

        if (clarification) {
          dispatch({ type: 'ADD_QUESTION', clarification });
        } else {
          dispatchAdvisory(analysisToAdvisory(evalData.result, pipelineSignals, diagDirection, reasoning, advisoryCtx), advisoryId());
        }
      } else {
        // API failed — ask a refinement question to gather more context
        dispatch({
          type: 'ADD_QUESTION',
          clarification: {
            acknowledge: 'Got it — let me understand a bit more.',
            question: 'Can you describe what you\'re hearing that you\'d like to change? And what equipment are you using?',
          },
        });
      }
    }

    dispatch({ type: 'SET_LOADING', value: false });
  }, [currentInput, isLoading, messages, turnCount, tasteProfile, state.activeMode, audioState]);

  /**
   * Skip clarification questions and go straight to exploratory suggestions.
   * Sets the skip ref and triggers submit with a synthetic message.
   */
  const handleSkipToSuggestions = useCallback(() => {
    if (isLoading) return;
    skipToSuggestionsRef.current = true;
    handleSubmit('Show me options from different design approaches.');
  }, [isLoading, handleSubmit]);

  // ── Preference Capture Handler ──────────────────────
  // Fires when user completes the "Start here" preference capture flow.
  // Maps binary taste selections to trait signals and re-runs shopping.
  const handlePreferenceCapture = useCallback(async (selections: PreferenceSelection[], category: string) => {
    if (isLoading) return;
    dispatch({ type: 'SET_LOADING', value: true });

    // Map preference selections to trait signals
    const traits: Record<string, import('@/lib/signal-types').SignalDirection> = {};
    const phrases: string[] = [];
    for (const sel of selections) {
      phrases.push(sel.label);
      if (sel.axis === 'tonal') {
        if (sel.choice === 'a') {
          // Warm / rich → tonal_density up, flow up
          traits.tonal_density = 'up';
          traits.flow = 'up';
        } else {
          // Clean / detailed → clarity up
          traits.clarity = 'up';
        }
      } else if (sel.axis === 'energy') {
        if (sel.choice === 'a') {
          // Relaxed / smooth → flow up, composure up
          traits.flow = traits.flow ?? 'up';
          traits.composure = 'up';
        } else {
          // Fast / dynamic → dynamics up, elasticity up
          traits.dynamics = 'up';
          traits.elasticity = 'up';
        }
      } else if (sel.axis === 'spatial') {
        if (sel.choice === 'a') {
          // Big / spacious → spatiality up (no direct trait — map through symptom)
          traits.spaciousness = 'up';
        } else {
          // Focused / intimate → dynamics up (rhythm/focus)
          traits.dynamics = traits.dynamics ?? 'up';
        }
      }
    }

    const capturedSignals: import('@/lib/signal-types').ExtractedSignals = {
      traits: traits as Record<string, import('@/lib/signal-types').SignalDirection>,
      symptoms: [],
      archetype_hints: [],
      uncertainty_level: 0,
      matched_phrases: phrases,
      matched_uncertainty_markers: [],
    };

    // Build a synthetic query for the shopping pipeline
    const syntheticQuery = `I want ${category} — I prefer ${phrases.join(', ')}`;

    try {
      const turnCtx = buildTurnContext(syntheticQuery, audioState, dismissedFingerprintsRef.current);
      const shoppingCtx = detectShoppingIntent(syntheticQuery, capturedSignals, turnCtx.activeSystem);
      const reasoning = reason(syntheticQuery, turnCtx.desires, capturedSignals, tasteProfile ?? null, shoppingCtx, turnCtx.activeProfile);
      dispatch({ type: 'SET_REASONING', reasoning });

      const advisoryCtx: ShoppingAdvisoryContext = {
        systemComponents: turnCtx.activeSystem,
        systemTendencies: turnCtx.systemTendencies ?? undefined,
        storedDesires: turnCtx.desires,
      };

      const answer = buildShoppingAnswer(shoppingCtx, capturedSignals, tasteProfile ?? undefined, reasoning, advisoryCtx.systemComponents);
      const decisionFrame = buildDecisionFrame(shoppingCtx.category, advisoryCtx, tasteProfile);
      const advisory = shoppingToAdvisory(answer, capturedSignals, reasoning, advisoryCtx, decisionFrame);

      // Add user message showing what they selected
      dispatch({ type: 'SET_INPUT', value: `My sound preferences: ${phrases.join(', ')}` });
      dispatch({ type: 'ADD_USER_MESSAGE' });
      dispatch({ type: 'ADD_ADVISORY', advisory, id: advisoryId() });
      dispatch({ type: 'SET_MODE', mode: 'shopping' });
    } catch (err) {
      console.warn('[preference-capture] pipeline error:', err);
    }

    dispatch({ type: 'SET_LOADING', value: false });
  }, [isLoading, audioState, tasteProfile, state.activeMode]);

  function handleReset() {
    convStateRef.current = INITIAL_CONV_STATE;
    chipIntentRef.current = null;
    onboardingContextRef.current = null;
    awaitingListeningPathRef.current = false;
    intakeShownRef.current = false;
    dispatch({ type: 'RESET' });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Enter sends, Shift+Enter for newline
      e.preventDefault();
      handleSubmit();
    }
  }

  /**
   * Chip click handler — each chip acts as a strong intent signal.
   * Instead of prefilling text, it immediately starts a focused conversation
   * with the right first question for that intent lane.
   */
  function handleChipClick(intent: 'shopping' | 'improvement' | 'diagnosis' | 'comparison', label: string) {
    if (isLoading) return;

    // Show the chip label as a "user message" so the conversation has context
    dispatch({ type: 'SET_INPUT', value: label });
    dispatch({ type: 'ADD_USER_MESSAGE' });

    // Set the state machine to the appropriate initial mode
    // so the user's next reply routes through convTransition().
    switch (intent) {
      case 'shopping':
        convStateRef.current = { mode: 'shopping', stage: 'clarify_category', facts: {} };
        dispatch({ type: 'SET_MODE', mode: 'shopping' });
        dispatch({
          type: 'ADD_QUESTION',
          clarification: {
            acknowledge: 'Great — let\'s find something good.',
            question: 'What are you looking for? For example: headphones, speakers, a DAC, an amplifier, or a turntable.',
          },
        });
        break;

      case 'diagnosis':
        convStateRef.current = { mode: 'diagnosis', stage: 'clarify_symptom', facts: {} };
        dispatch({
          type: 'ADD_QUESTION',
          clarification: {
            acknowledge: 'Let\'s figure out what\'s going on.',
            question: 'What does it sound like? For example: too bright, thin, muddy, fatiguing, or lacking energy.',
          },
        });
        break;

      case 'improvement':
        convStateRef.current = { mode: 'improvement', stage: 'clarify_system', facts: {} };
        dispatch({
          type: 'ADD_QUESTION',
          clarification: {
            acknowledge: 'Let\'s see what would make the biggest difference.',
            question: 'What\'s in your system right now? List the main components — source, DAC, amp, speakers — and I\'ll identify where to focus.',
          },
        });
        break;

      case 'comparison':
        convStateRef.current = { mode: 'comparison', stage: 'clarify_targets', facts: {} };
        dispatch({
          type: 'ADD_QUESTION',
          clarification: {
            acknowledge: 'Sure — let\'s compare.',
            question: 'Which two components are you deciding between?',
          },
        });
        break;
    }
  }

  const hasMessages = messages.length > 0;
  const lastMessage = messages[messages.length - 1];
  const hasPendingQuestion =
    lastMessage?.role === 'assistant' &&
    (lastMessage.kind === 'question' || lastMessage.kind === 'advisory');
  /** True when the last assistant message is an intake form — hides the main input area. */
  const hasPendingIntake =
    lastMessage?.role === 'assistant' &&
    lastMessage.kind === 'advisory' &&
    lastMessage.advisory?.kind === 'intake';

  return (
    <div
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '3rem 1.5rem 3rem',
        color: COLOR.textPrimary,
        background: COLOR.bg,
        minHeight: '100vh',
        lineHeight: 1.6,
      }}
    >
      {/* Header — always visible */}
      <div
        onClick={() => handleReset()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleReset(); }}
        style={{
          borderTop: `2.5px solid ${COLOR.accent}`,
          width: 40,
          marginBottom: '1.75rem',
          cursor: 'pointer',
        }}
      />

      <h1
        onClick={() => handleReset()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleReset(); }}
        style={{
          marginBottom: '0.35rem',
          fontSize: '1.8rem',
          fontWeight: 700,
          letterSpacing: '-0.025em',
          lineHeight: 1.15,
          color: COLOR.textPrimary,
          cursor: 'pointer',
        }}
      >
        Audio <span style={{ color: COLOR.accent }}>XX</span>
      </h1>

      {/* System badge + panel */}
      <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
        <SystemBadge onClick={() => setSystemPanelOpen((v) => !v)} />
        {!audioState.activeSystemRef && !systemPanelOpen && (
          <button
            type="button"
            onClick={() => setSystemPanelOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8rem',
              color: COLOR.textSecondary,
              fontFamily: 'inherit',
              padding: '0.15rem 0',
              textDecoration: 'underline',
              textDecorationColor: COLOR.border,
              textUnderlineOffset: '2px',
            }}
          >
            {audioState.savedSystems.length > 0 ? 'Select system' : 'Add your system'}
          </button>
        )}
        {systemPanelOpen && (
          <SystemPanel
            onClose={() => setSystemPanelOpen(false)}
            onCreateNew={() => {
              setSystemPanelOpen(false);
              setEditingDraft(false);
              setEditorPrefill(null);
              setSystemEditorOpen(true);
            }}
            onEditDraft={() => {
              setSystemPanelOpen(false);
              setEditingDraft(true);
              setEditorPrefill(null);
              setSystemEditorOpen(true);
            }}
          />
        )}
      </div>

      {/* System editor modal */}
      {systemEditorOpen && (
        <SystemEditor
          initial={editorPrefill ?? (editingDraft ? audioState.draftSystem : null)}
          onClose={() => {
            setSystemEditorOpen(false);
            setEditorPrefill(null);
          }}
          onSaved={() => {
            setSystemEditorOpen(false);
            setEditorPrefill(null);
          }}
        />
      )}

      {/* Intro — only before conversation starts */}
      {!hasMessages && (
        <>
          <p
            style={{
              marginTop: '0.15rem',
              marginBottom: '0.5rem',
              maxWidth: 520,
              color: COLOR.textPrimary,
              fontSize: '1.05rem',
              lineHeight: 1.55,
              fontWeight: 500,
            }}
          >
            Audio advice based on your system and how you listen.
            <br />
            Describe your setup, a problem, or an upgrade you&#39;re considering.
          </p>
          <div style={{ marginBottom: '2rem' }} />

          {/* Compact taste widget — authenticated users with profile data */}
          {tasteProfile && tasteProfile.confidence > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                marginBottom: '1.75rem',
                padding: '0.7rem 0.95rem',
                border: `1px solid ${COLOR.border}`,
                borderRadius: 8,
                background: '#fff',
                maxWidth: 360,
              }}
            >
              <TasteRadar profile={tasteProfile} compact size={80} />
              <div style={{ fontSize: '0.88rem', lineHeight: 1.55, color: COLOR.textSecondary }}>
                <div style={{ fontWeight: 600, color: COLOR.textPrimary, marginBottom: '0.2rem', fontSize: '0.82rem', letterSpacing: '0.03em', textTransform: 'uppercase' as const }}>
                  Your taste
                </div>
                <div>
                  {topTraits(tasteProfile, 3).map((t) => t.label).join(' · ')}
                </div>
                <Link
                  href="/profile"
                  style={{
                    fontSize: '0.82rem',
                    color: COLOR.textSecondary,
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
              // In inquiry mode (pending question), suppress diagnosis advisory messages
              if (hasPendingQuestion && msg.role === 'assistant' && 'kind' in msg && msg.kind === 'advisory' && msg.advisory.kind === 'diagnosis') {
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
                <MessageBubble message={msg} onIntakeSubmit={handleSubmit} onPreferenceCapture={handlePreferenceCapture} />
              </div>
            ))}
          {/* Skip-to-suggestions button — visible when asking clarifying questions in shopping mode */}
          {!isLoading && lastMessage?.role === 'assistant' && lastMessage.kind === 'question' && state.activeMode === 'shopping' && (
            <button
              type="button"
              onClick={handleSkipToSuggestions}
              style={{
                display: 'block',
                margin: '0.5rem 0 1rem 0',
                padding: '0.45rem 0.85rem',
                background: 'none',
                border: `1px solid ${COLOR.border}`,
                borderRadius: 6,
                cursor: 'pointer',
                color: COLOR.textSecondary,
                fontSize: '0.85rem',
                fontFamily: 'inherit',
                letterSpacing: '0.01em',
                transition: 'color 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = COLOR.accent;
                e.currentTarget.style.borderColor = COLOR.accent;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = COLOR.textSecondary;
                e.currentTarget.style.borderColor = COLOR.border;
              }}
            >
              Skip → show me options from different design approaches
            </button>
          )}

          {/* System save prompt — appears when a system description was detected */}
          {!isLoading && audioState.proposedSystem && (
            <SystemSavePrompt
              proposed={audioState.proposedSystem}
              onReviewAndSave={() => {
                const p = audioState.proposedSystem;
                if (!p) return;
                // Convert ProposedSystem to DraftSystem for the editor
                const prefill: DraftSystem = {
                  name: p.suggestedName,
                  components: p.components,
                  tendencies: null,
                  notes: null,
                };
                setEditorPrefill(prefill);
                setEditingDraft(false);
                setSystemEditorOpen(true);
                audioDispatch({ type: 'SET_PROPOSED_SYSTEM', proposed: null });
              }}
              onDismiss={() => {
                const fp = audioState.proposedSystem?.fingerprint;
                if (fp) dismissedFingerprintsRef.current.add(fp);
                audioDispatch({ type: 'SET_PROPOSED_SYSTEM', proposed: null });
              }}
            />
          )}
          {isLoading && (
            <ThinkingIndicator />
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input area — hidden when an intake form is active (it has its own Submit) */}
      {!hasPendingIntake && <div style={{ marginBottom: '1rem' }}>
        {/* Label is visually handled by the headline + supporting line above */}

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
                : 'Start with your system, a problem, or something you\'re considering.'
          }
          style={{
            width: '100%',
            minHeight: hasMessages ? 72 : 120,
            padding: '1rem 1.1rem',
            border: `1.5px solid ${COLOR.border}`,
            borderRadius: 10,
            outline: 'none',
            fontSize: '0.98rem',
            lineHeight: 1.6,
            resize: 'vertical',
            background: COLOR.inputBg,
            color: COLOR.textPrimary,
            boxSizing: 'border-box',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = COLOR.accent;
            e.currentTarget.style.boxShadow = `0 0 0 3px rgba(176,141,87,0.12)`;
            e.currentTarget.style.background = '#fff';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = COLOR.border;
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.background = COLOR.inputBg;
          }}
        />

        {/* Send button */}
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={isLoading || !currentInput.trim()}
          style={{
            marginTop: '0.6rem',
            padding: '0.55rem 1.5rem',
            background: isLoading || !currentInput.trim() ? COLOR.border : COLOR.accent,
            color: isLoading || !currentInput.trim() ? COLOR.textSecondary : '#FFFEFA',
            border: 'none',
            borderRadius: 8,
            fontSize: '0.88rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            cursor: isLoading || !currentInput.trim() ? 'default' : 'pointer',
            transition: 'background 0.15s ease, transform 0.1s ease',
          }}
          onMouseEnter={(e) => {
            if (!isLoading && currentInput.trim()) e.currentTarget.style.background = COLOR.accentHover;
          }}
          onMouseLeave={(e) => {
            if (!isLoading && currentInput.trim()) e.currentTarget.style.background = COLOR.accent;
          }}
        >
          {isLoading ? 'Thinking…' : 'Send'}
        </button>

        {/* Starter chips — landing state only */}
        {!hasMessages && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              marginTop: '1rem',
            }}
          >
            {[
              { label: 'Buy something new', intent: 'shopping' as const },
              { label: 'Improve my system', intent: 'improvement' as const },
              { label: 'Something sounds off', intent: 'diagnosis' as const },
              { label: 'Compare two options', intent: 'comparison' as const },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => handleChipClick(chip.intent, chip.label)}
                style={{
                  padding: '0.4rem 0.85rem',
                  background: COLOR.chipBg,
                  border: `1px solid ${COLOR.chipBorder}`,
                  borderRadius: 20,
                  cursor: 'pointer',
                  fontSize: '0.83rem',
                  fontWeight: 500,
                  color: COLOR.textPrimary,
                  fontFamily: 'inherit',
                  letterSpacing: '0.01em',
                  transition: 'color 0.15s ease, border-color 0.15s ease, background 0.15s ease, transform 0.1s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = COLOR.accent;
                  e.currentTarget.style.borderColor = COLOR.accent;
                  e.currentTarget.style.background = COLOR.accentSubtle;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = COLOR.textPrimary;
                  e.currentTarget.style.borderColor = COLOR.chipBorder;
                  e.currentTarget.style.background = COLOR.chipBg;
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(0.97)';
                  e.currentTarget.style.background = 'rgba(176,141,87,0.15)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {/* Contact line — subtle, below chips */}
        {!hasMessages && (
          <p style={{
            margin: '1.25rem 0 0 0',
            fontSize: '0.78rem',
            color: COLOR.textSecondary,
            letterSpacing: '0.01em',
            opacity: 0.7,
          }}>
            Questions or feedback?{' '}
            <a
              href="mailto:hello@audio-xx.com"
              style={{
                color: COLOR.textSecondary,
                textDecoration: 'none',
                borderBottom: '1px solid transparent',
                transition: 'color 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = COLOR.accent;
                e.currentTarget.style.borderBottomColor = COLOR.accent;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = COLOR.textSecondary;
                e.currentTarget.style.borderBottomColor = 'transparent';
              }}
            >
              hello@audio-xx.com
            </a>
          </p>
        )}

      </div>}

      {/* Footer — start-over + contact */}
      {hasMessages && (
        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => handleReset()}
            style={{
              background: 'none',
              border: 'none',
              padding: '2px 0',
              margin: 0,
              cursor: 'pointer',
              color: COLOR.textSecondary,
              fontSize: '0.85rem',
              fontFamily: 'inherit',
              textDecoration: 'none',
              letterSpacing: '0.01em',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = COLOR.accent; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = COLOR.textSecondary; }}
          >
            Start over
          </button>
          <a
            href="mailto:hello@audio-xx.com"
            style={{
              color: COLOR.textSecondary,
              fontSize: '0.85rem',
              fontFamily: 'inherit',
              textDecoration: 'none',
              letterSpacing: '0.01em',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = COLOR.accent; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = COLOR.textSecondary; }}
          >
            Contact
          </a>
        </div>
      )}

    </div>
  );
}

// ── Thinking Indicator ────────────────────────────────

function ThinkingIndicator() {
  return (
    <div
      style={{
        padding: '0.85rem 0',
        color: COLOR.textSecondary,
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

function MessageBubble({ message, onIntakeSubmit, onPreferenceCapture }: { message: Message; onIntakeSubmit?: (overrideText?: string) => void; onPreferenceCapture?: (selections: PreferenceSelection[], category: string) => void }) {
  if (message.role === 'user') {
    return (
      <div
        style={{
          marginBottom: '1.5rem',
          padding: '0.85rem 1.1rem',
          background: COLOR.bg,
          borderRadius: 8,
          color: COLOR.textPrimary,
          fontSize: '0.98rem',
          lineHeight: 1.6,
        }}
      >
        {message.content}
      </div>
    );
  }

  if (message.kind === 'advisory') {
    return (
      <div style={{ marginBottom: '1.75rem' }}>
        <hr style={{ border: 0, borderTop: `1px solid ${COLOR.border}`, margin: '0 0 1.5rem 0' }} />
        <AdvisoryMessage
          advisory={message.advisory}
          onIntakeSubmit={message.advisory.kind === 'intake' ? onIntakeSubmit : undefined}
          onPreferenceCapture={message.advisory.lowPreferenceSignal ? onPreferenceCapture : undefined}
        />
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
          borderLeft: `3px solid ${COLOR.accent}`,
          background: '#faf9f6',
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
            color: COLOR.accent,
          }}
        >
          Audio term
        </div>
        <div
          style={{
            marginBottom: '0.4rem',
            fontSize: '1.05rem',
            fontWeight: 600,
            color: COLOR.textPrimary,
          }}
        >
          {message.entry.term}
        </div>
        <p style={{ margin: '0 0 0.35rem 0', color: COLOR.textPrimary, fontSize: '0.95rem', lineHeight: 1.65 }}>
          {message.entry.explanation}
        </p>
        {message.entry.example && (
          <p style={{ margin: 0, color: COLOR.textSecondary, fontSize: '0.9rem', lineHeight: 1.55, fontStyle: 'italic' }}>
            {message.entry.example}
          </p>
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
            color: COLOR.textPrimary,
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
            borderLeft: `3px solid ${COLOR.accent}`,
            background: '#faf9f6',
          }}
        >
          <div
            style={{
              color: COLOR.textPrimary,
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
        color: COLOR.textSecondary,
        fontSize: '0.98rem',
        lineHeight: 1.55,
      }}
    >
      {message.content}
    </div>
  );
}

