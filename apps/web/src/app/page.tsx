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
  refineDiagnosisWithContext,
} from '@/lib/advisory-response';
import type { AdvisoryResponse, ShoppingAdvisoryContext } from '@/lib/advisory-response';
import { buildProductAssessment } from '@/lib/product-assessment';
import type { AssessmentContext } from '@/lib/product-assessment';
import { buildKnowledgeResponse, buildAssistantResponse, requestKnowledgeLlm, requestAssistantLlm } from '@/lib/audio-lanes';
import type { KnowledgeContext, AssistantContext as AudioAssistantContext } from '@/lib/audio-lanes';
import { buildDecisionFrame } from '@/lib/decision-frame';
import { getClarificationQuestion } from '@/lib/clarification';
import type { ClarificationResponse } from '@/lib/clarification';
import { detectShoppingIntent, buildShoppingAnswer, getShoppingClarification, parseBudgetAmount, detectSelectionMode, detectExplicitCategorySwitch, type PreviousAnchor, type SelectionMode } from '@/lib/shopping-intent';
import {
  createEmptyListenerProfile,
  detectPreferenceSignals,
  applyPreferenceSignals,
  mergeEffectiveTaste,
  generateTasteAcknowledgment,
  generateTasteReflection,
  buildTasteReflection,
  detectConclusionIntent,
  buildDecisiveRecommendation,
  buildSystemPairingIntro,
  findCatalogProduct,
  type ListenerProfile,
} from '@/lib/listener-profile';
import { checkGlossaryQuestion } from '@/lib/glossary';
import { detectIntent, extractSubjectMatches, isComparisonFollowUp, isConsultationFollowUp, isDiagnosisFollowUp, detectContextEnrichment, respondToMusicInput, detectListeningPath, respondToListeningPath, synthesizeOnboardingQuery, type SubjectMatch } from '@/lib/intent';
import { attachQuickRecommendation } from '@/lib/quick-recommendation';
import { type ConvState, INITIAL_CONV_STATE, transition as convTransition, detectInitialMode as detectConvMode, interpretSymptom } from '@/lib/conversation-state';
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
import { fireShadowOrchestrator, buildOrchestratorInput, callOrchestratorAPI } from '@/lib/assistant/shadowOrchestrator';
import type { ShadowOrchestratorContext } from '@/lib/assistant/shadowOrchestrator';
import {
  isOrchestratorRenderEnabled,
  extractValidShoppingOutput,
  orchestratorToAdvisory,
  logRenderSource,
} from '@/lib/assistant/orchestratorAdapter';
import SystemBadge from '@/components/system/SystemBadge';
import SystemPanel from '@/components/system/SystemPanel';
import SystemEditor from '@/components/system/SystemEditor';
import SystemSavePrompt from '@/components/system/SystemSavePrompt';
import type { DraftSystem } from '@/lib/system-types';
import ListenerProfileBadge, { buildProfileSnapshot, type ListenerProfileSnapshot } from '@/components/ListenerProfileBadge';

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

  /** Preserved shopping facts for category switches.
   *  When the user finishes one shopping round and switches to a new
   *  category ("great — now how about an amp"), budget and from-scratch
   *  context carry forward so we don't re-ask. */
  const lastShoppingFactsRef = useRef<{
    budget?: string;
    fromScratch?: boolean;
    roomContext?: 'large' | 'small' | 'desktop' | 'nearfield' | null;
    musicHints?: string[];
    energyLevel?: 'high' | 'low' | null;
    wantsBigScale?: boolean;
    constraints?: import('@/lib/shopping-intent').HardConstraints;
    category?: import('@/lib/shopping-intent').ShoppingCategory;
  } | null>(null);

  /** Products the user has engaged with (selected from cards, mentioned by name,
   *  or received as recommendations). These must never be treated as unknown
   *  on subsequent turns. Keyed by lowercase product name → full product info. */
  const engagedProductsRef = useRef<Map<string, { name: string; brand?: string; category?: string }>>(new Map());

  /** Listener profile — accumulates taste across conversation turns.
   *  Updated when user expresses product/brand preferences. */
  const listenerProfileRef = useRef<import('@/lib/listener-profile').ListenerProfile>(
    createEmptyListenerProfile(),
  );

  // ── Category lock: persists active shopping category across turns ──
  // Only an explicit switch ("show me dacs", "speakers instead") changes this.
  // Clarifications, preferences, budget changes, and mode switches do NOT reset it.
  const activeShoppingCategoryRef = useRef<import('@/lib/shopping-intent').ShoppingCategory | null>(null);

  // ── Selection mode: previous anchor + recent products for anti-repetition ──
  const lastAnchorRef = useRef<PreviousAnchor | null>(null);
  const recentShoppingProductsRef = useRef<string[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Listener profile snapshot — read-only UI display of inferred preferences.
  // Updated after each turn when the profile changes.
  const [profileSnapshot, setProfileSnapshot] = useState<ListenerProfileSnapshot | null>(null);

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
    let intent: string = '';
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

      // When a transition re-enters orientation (e.g. educational intent
      // during an active orientation session), reset to idle so the
      // normal idle → orientation entry path at line ~953 handles
      // response generation with the correct intent-specific copy.
      if (convResult.state.mode === 'orientation' && !convResult.response) {
        convStateRef.current = INITIAL_CONV_STATE;
      }

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
          if (convResult.state.stage === 'ready_to_recommend') {
            convModeHint = 'shopping';
            // Preserve shopping facts for potential category switches on the next turn.
            // Without this, budget and from-scratch context are lost when convState resets.
            lastShoppingFactsRef.current = {
              budget: convResult.state.facts.budget,
              fromScratch: convResult.state.facts.fromScratch,
            };
            // Update category lock to match state machine's resolved category.
            // Without this, a category switch via convTransition (e.g. tube amp → DAC → budget)
            // leaves activeShoppingCategoryRef stale, causing the shopping pipeline
            // to revert to the old category.
            if (convResult.state.facts.category) {
              activeShoppingCategoryRef.current = convResult.state.facts.category as import('@/lib/shopping-intent').ShoppingCategory;
            }
            convStateRef.current = INITIAL_CONV_STATE;
          } else if (convResult.state.stage === 'ready_to_diagnose') {
            convModeHint = 'diagnosis';
            // Override intent so the diagnosis builder fires even when
            // detectIntent returned gear_inquiry (user named components).
            intent = 'diagnosis';
            // Do NOT reset convState — keep diagnosis mode active so
            // follow-up turns (remedy questions, additional symptoms)
            // stay in context instead of collapsing to idle.
          } else if (convResult.state.stage === 'ready_to_assess') {
            // System assessment — override intent and keep convState alive
            // so subsequent turns accumulate components.
            intent = 'system_assessment';
            // Do NOT reset convState — keep system_assessment mode active.
          } else {
            convStateRef.current = INITIAL_CONV_STATE;
          }
          // Fall through to normal pipeline below...
        }
      }
      // null response or proceed — fall through to normal pipeline.
      // When the state machine is done and the user had provided their system,
      // preserve that fact so the fallthrough pipeline doesn't re-ask.
      if (convStateRef.current.stage === 'done') {
        const preserveHasSystem = convStateRef.current.facts?.hasSystem ?? false;
        convStateRef.current = preserveHasSystem
          ? { ...INITIAL_CONV_STATE, facts: { ...INITIAL_CONV_STATE.facts, hasSystem: true } }
          : INITIAL_CONV_STATE;
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
                question: 'What\'s your budget?',
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
              question: 'Which two components are you comparing? For example: "Chord Qutest vs Denafrips Enyo 15th"',
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

      // Detect "from scratch" / "starting fresh" / "don't have any" in this
      // message so we never ask the ownership question after the user already
      // said they're building new.
      const FROM_SCRATCH_RE = /\b(?:from\s+scratch|starting\s+(?:fresh|out|new)|don'?t\s+have\s+(?:any|a)|no\s+(?:system|gear|equipment|setup)|first\s+(?:system|setup)|building\s+(?:new|a\s+new)|brand\s+new)\b/i;
      const isFromScratch = FROM_SCRATCH_RE.test(submittedText);

      const listeningResponse = respondToListeningPath(listeningPath, isFromScratch);
      dispatch({ type: 'ADD_NOTE', content: listeningResponse });
      // Store path in onboarding context — next reply completes the sequence
      if (onboardingContextRef.current) {
        onboardingContextRef.current.listeningPath = listeningPath;
        if (isFromScratch) {
          (onboardingContextRef.current as Record<string, unknown>).fromScratch = true;
        }
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

      // Detect "from scratch" in this message OR carry it from the listening-path stage
      const FROM_SCRATCH_RE = /\b(?:from\s+scratch|starting\s+(?:fresh|out|new)|don'?t\s+have\s+(?:any|a)|no\s+(?:system|gear|equipment|setup)|first\s+(?:system|setup)|building\s+(?:new|a\s+new)|brand\s+new)\b/i;
      const isFromScratch = FROM_SCRATCH_RE.test(submittedText) || !!(ctx as Record<string, unknown>).fromScratch;

      // Append "Starting from scratch." so the shopping pipeline detects build-a-system mode
      const scratchSuffix = isFromScratch ? ' Starting from scratch.' : '';
      const synthesized = synthesizeOnboardingQuery(ctx.musicDescription, category, submittedText) + scratchSuffix;
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
      tasteReflection: generateTasteReflection(listenerProfileRef.current) ?? undefined,
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
    let effectiveMode = convModeHint ?? resolveMode(routedMode, state.activeMode);
    dispatch({ type: 'SET_MODE', mode: effectiveMode });

    // ── Detect intent ───────────────────────────────────
    // Intent detection runs after extraction. We only need the intent
    // classification — subjectMatches, desires, and subjects are
    // already canonical in turnCtx.
    ({ intent } = detectIntent(submittedText));

    // Count prior shopping advisory turns (needed early for category-switch bypass).
    const shoppingAnswerCount = messages.filter(
      (m) => m.role === 'assistant' && m.kind === 'advisory' && m.advisory.kind === 'shopping',
    ).length;

    // ── Debug: turn entry ──────────────────────────────
    console.log('[turn-debug] msg="%s" intent=%s routedMode=%s effectiveMode=%s activeMode=%s shoppingCount=%d convState=%s/%s',
      submittedText, intent, routedMode, effectiveMode, state.activeMode, shoppingAnswerCount,
      convStateRef.current.mode, convStateRef.current.stage);

    // ── First-turn intent authority ──────────────────────
    // When detectIntent returns a high-confidence mode (system_assessment,
    // comparison, product_assessment) with sufficient subject evidence,
    // bypass the state machine entirely. This prevents budget+category
    // fast-tracking, orientation heuristics, or other detectConvMode
    // priorities from overriding a clear, well-supported intent.
    const intentAuthoritative = convStateRef.current.mode === 'idle' && (
      (intent === 'system_assessment' && turnCtx.subjectMatches.length >= 2) ||
      (intent === 'comparison' && (turnCtx.subjectMatches.length >= 2 || /\bvs\.?\b/i.test(submittedText))) ||
      (intent === 'product_assessment' && turnCtx.subjectMatches.length >= 1)
    );

    if (intentAuthoritative) {
      console.log('[intent-authority] Bypassing state machine: intent=%s subjects=%d', intent, turnCtx.subjectMatches.length);
      // Set convState to match the authoritative intent so follow-up
      // turns retain context (e.g. system_assessment accumulates components).
      if (intent === 'system_assessment') {
        convStateRef.current = {
          mode: 'system_assessment',
          stage: 'ready_to_assess',
          facts: {
            hasSystem: true,
            systemAssessmentText: submittedText,
            systemComponents: [submittedText],
          },
        };
      } else if (intent === 'comparison') {
        convStateRef.current = {
          mode: 'comparison',
          stage: 'ready_to_compare',
          facts: { subjectCount: turnCtx.subjectMatches.length },
        };
      }
      // product_assessment is stateless — no convState setup needed.
      // Intent falls through to the handler blocks below unchanged.
    }

    // ── State machine: initial mode detection (idle → active) ──
    // Routes every first message through detectConvMode to ensure the
    // response clearly reflects the detected entry mode.
    //
    // CATEGORY-SWITCH BYPASS: When the user is already in shopping mode
    // and has received recommendations (shoppingAnswerCount > 0), skip
    // state machine re-entry. The shopping pipeline at line ~1400
    // handles refinement/category switches directly via pastClarificationCap.
    // Without this bypass, detectConvMode would re-enter clarify_budget
    // and lose preserved context.
    if (convStateRef.current.mode === 'idle' && !convModeHint && !intentAuthoritative && !(effectiveMode === 'shopping' && shoppingAnswerCount > 0)) {
      const initialConvMode = detectConvMode(submittedText, {
        detectedIntent: intent,
        hasSystem: !!turnCtx.activeSystem || !!audioState.activeSystemRef,
        subjectCount: turnCtx.subjectMatches.length,
      });
      console.log('[diag-cold] detectConvMode result:', initialConvMode ? `${initialConvMode.mode}/${initialConvMode.stage}` : 'null');
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
          let acknowledge: string;
          let question: string;

          if (intent === 'greeting') {
            acknowledge = 'Hey — welcome to Audio XX.';
            question = 'Are you looking to buy something new, improve what you already have, or troubleshoot a problem you\'re hearing?';
          } else if (intent === 'educational') {
            acknowledge = 'Audio XX is a system-level audio advisor. It helps you understand how your components interact, evaluate trade-offs, and make aligned decisions — whether you\'re shopping, diagnosing, or just exploring.';
            question = 'Where would you like to start?\n• Help me choose gear\n• Improve my current system\n• Diagnose a sound issue\n• Learn how system matching works';
          } else {
            acknowledge = 'Good place to start.';
            question = 'Are you looking to buy something new, improve what you already have, or troubleshoot a problem you\'re hearing?';
          }

          dispatch({
            type: 'ADD_QUESTION',
            clarification: { acknowledge, question },
          });
          dispatch({ type: 'SET_LOADING', value: false });
          return;
        }

        // ── Problem entry — symptom alone is sufficient to diagnose ──
        if (initialConvMode.mode === 'diagnosis' && initialConvMode.stage === 'ready_to_diagnose') {
          convModeHint = 'diagnosis';
          intent = 'diagnosis';
          console.log('[diag-cold] ready_to_diagnose — convModeHint set, falling through to eval engine');
          // Fall through to evaluation engine — diagnosis-first, no clarification
        }

        // Legacy: if detectInitialMode ever returns clarify_system, ask for system
        if (initialConvMode.mode === 'diagnosis' && initialConvMode.stage === 'clarify_system') {
          dispatch({
            type: 'ADD_QUESTION',
            clarification: {
              acknowledge: interpretSymptom(submittedText),
              question: 'What components are you using? Knowing the chain will help pinpoint where this is coming from.',
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


    // ── Diagnosis breakout from shopping ─────────────────
    // Must be computed BEFORE the shopping mode lock so that confirmed
    // diagnosis signals are not overridden. Gate: intent must be
    // diagnosis AND either the router independently detected diagnosis
    // (strong symptom signal) or the text has explicit repair language.
    // Vague diagnosis fallbacks ("more warmth") don't qualify.
    const diagnosisBreakout = intent === 'diagnosis' && (
      routedMode === 'diagnosis'
      || /\b(?:fix|repair|troubleshoot|diagnose)\b/i.test(submittedText)
    );

    // ── SHOPPING MODE LOCK ─────────────────────────────
    // When effectiveMode is 'shopping' and the user has already received
    // at least one recommendation (shoppingAnswerCount > 0), ALL subsequent
    // turns MUST route to the shopping pipeline. Override intent immediately
    // so early-return blocks (comparison follow-up, consultation follow-up,
    // consultation path, exploration, gear inquiry) cannot intercept.
    // Exceptions: product_assessment (standalone assessments) and confirmed
    // diagnosis (the user is reporting a problem, not refining a purchase).
    const isInShoppingFlow = effectiveMode === 'shopping' && shoppingAnswerCount > 0;
    if (isInShoppingFlow && intent !== 'product_assessment' && !diagnosisBreakout) {
      console.log('[shopping-lock] Overriding intent=%s → shopping (effectiveMode=%s, shoppingAnswerCount=%d)', intent, effectiveMode, shoppingAnswerCount);
      intent = 'shopping';
    }
    // When diagnosis breaks out, flip effectiveMode so the diagnosis
    // pipeline runs instead of the shopping pipeline.
    if (diagnosisBreakout && effectiveMode === 'shopping') {
      effectiveMode = 'diagnosis';
      dispatch({ type: 'SET_MODE', mode: 'diagnosis' });
      console.log('[diagnosis-breakout] shopping→diagnosis on:', submittedText.slice(0, 60));
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
    // GUARD: Never intercept when in shopping flow — refinements like
    // "i don't want tubes" must reach the shopping pipeline.
    if (
      state.activeComparison &&
      intent !== 'comparison' &&
      intent !== 'shopping' &&
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
    // GUARD: Never intercept when in shopping flow.
    if (
      state.activeComparison &&
      intent !== 'comparison' &&
      intent !== 'shopping'
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

    // ── Diagnosis follow-up detection ──────────────────
    // If the previous assistant message was a diagnosis with a follow-up
    // question (e.g., "Can you describe the room?"), and the user's
    // response provides context rather than a new symptom, refine the
    // diagnosis with the provided context instead of repeating it.
    if (
      intent !== 'shopping' &&
      intent !== 'comparison'
    ) {
      const lastAssistant = [...messages].reverse().find(
        (m): m is Extract<typeof m, { kind: 'advisory' }> =>
          m.role === 'assistant' && 'kind' in m && m.kind === 'advisory'
          && m.advisory.kind === 'diagnosis',
      );
      const prevFollowUp = lastAssistant?.advisory.followUp;
      if (
        lastAssistant &&
        isDiagnosisFollowUp(submittedText, prevFollowUp)
      ) {
        const refined = refineDiagnosisWithContext(lastAssistant.advisory, submittedText);
        if (refined) {
          console.log('[diagnosis-followup] Refined diagnosis with room/system context');
          dispatchAdvisory(refined, advisoryId());
          dispatch({ type: 'SET_LOADING', value: false });
          return;
        }
        // If refineDiagnosisWithContext returns undefined (no extractable
        // context), fall through to the normal pipeline.
      }
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
    //
    // When the state machine is in system_assessment/ready_to_assess, use
    // ALL accumulated text (not just the current message) for subject extraction
    // so that incrementally-provided components are all included.
    if (intent === 'system_assessment') {
      const isAccumulating = convStateRef.current.mode === 'system_assessment'
        && convStateRef.current.stage === 'ready_to_assess';
      const accumulatedText = isAccumulating
        ? (convStateRef.current.facts.systemAssessmentText ?? submittedText)
        : submittedText;

      // Re-extract subjects from accumulated text to capture all components
      const assessmentSubjects = isAccumulating
        ? extractSubjectMatches(accumulatedText)
        : turnCtx.subjectMatches;

      const assessmentResult = buildSystemAssessment(accumulatedText, assessmentSubjects, turnCtx.activeSystem, turnCtx.desires);
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
    const productMatches = turnCtx.subjectMatches.filter((m) => m.kind === 'product');
    // Only treat as brand comparison when NO product-level subjects exist.
    // "compare JOB integrated + WLM Diva vs Crayon + WLM Diva" has product subjects
    // and must route to gear_response, not the brand consultation path.
    const isBrandComparison = intent === 'comparison' && brandMatches.length >= 2 && productMatches.length === 0;
    const isGearWithSubjects = intent === 'gear_inquiry' && turnCtx.subjectMatches.length > 0;
    // Guard: system_assessment intent must NEVER fall into the consultation path.
    // If buildSystemAssessment returned null above, we still don't want consultation
    // to intercept and produce a brand comparison (e.g. "Chord vs Wlm").
    // product_assessment is similarly guarded — it has its own hard gate above.
    // Active shopping guard: when the user is in an active shopping session
    // (shoppingAnswerCount > 0), brand/product mentions like "denafrips?" or
    // "what about denafrips?" are shopping refinements, not consultation queries.
    // Without this guard, gear_inquiry subjects trigger buildConsultationResponse
    // which produces brand essays and early-returns before the mode override can
    // redirect to the shopping pipeline.
    // Diagnosis guard: when diagnosis is active, component mentions ("my dac
    // is a topping") must NOT trigger brand essays. The consultation path would
    // see isGearWithSubjects=true and fire buildConsultationResponse before the
    // diagnosis continuity override can fold gear_inquiry back into diagnosis.
    // Block the entire consultation path during active diagnosis — all inputs
    // must flow to the diagnosis handling downstream.
    const consultationGuarded = intent === 'system_assessment' || intent === 'product_assessment'
      || (effectiveMode === 'shopping' && shoppingAnswerCount > 0)
      || effectiveMode === 'diagnosis';
    if (!consultationGuarded && (effectiveMode === 'consultation' || isBrandComparison || isGearWithSubjects)) {
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
    // product_assessment: when we're in an active shopping session
    // (prior shopping answers shown), "what about denafrips?" is a
    // shopping refinement, not a standalone assessment. Override to
    // shopping so brand/product context is retained. Only allow
    // product_assessment to break out when no shopping answers have
    // been shown yet (i.e., first turn with assessment language).
    // system_assessment, comparison, and confirmed diagnosis are
    // exempt — the SHOPPING MODE LOCK + diagnosis breakout above
    // handles the shoppingAnswerCount > 0 case; this block catches
    // the remaining case (effectiveMode=shopping but no prior answers).
    const productAssessmentInShopping = intent === 'product_assessment' && shoppingAnswerCount > 0;
    if (effectiveMode === 'shopping' && intent !== 'shopping' && intent !== 'system_assessment' && intent !== 'comparison' && !diagnosisBreakout) {
      if (intent !== 'product_assessment' || productAssessmentInShopping) {
        intent = 'shopping';
      }
    }
    // ── Shopping context cleanup on mode exit ──────────
    // When the user transitions from shopping to diagnosis, comparison,
    // or system_assessment, clear shopping-specific refs so stale budget,
    // category lock, and constraints don't leak into the new mode or
    // contaminate a future return to shopping.
    // listenerProfileRef (taste preferences) is intentionally preserved —
    // only shopping-specific facts are cleared.
    if (state.activeMode === 'shopping' && effectiveMode !== 'shopping') {
      lastShoppingFactsRef.current = null;
      activeShoppingCategoryRef.current = null;
      console.log('[mode-exit] shopping→%s: cleared shopping context', effectiveMode);
    }

    // ── Diagnosis continuity override ─────────────────
    // When diagnosis is active, ALL intents fold back into diagnosis
    // except comparison and system_assessment (genuine topic changes).
    // This prevents component mentions ("my dac is a topping"),
    // brand mentions ("topping"), and gear inquiries from escaping
    // to consultation/exploratory handlers mid-diagnosis. The
    // consultation path guard above (consultationGuarded) blocks the
    // early-return path; this override catches anything that slips
    // through to the gear_inquiry handler downstream.
    if (effectiveMode === 'diagnosis' && intent !== 'comparison' && intent !== 'system_assessment') {
      intent = 'diagnosis';
      // Ensure the diagnosis clarification skip is active even when the state
      // machine wasn't engaged (e.g., follow-up after shopping reset to idle).
      if (!convModeHint) convModeHint = 'diagnosis';
    }

    // ── Product assessment — hard gate ─────────────────
    // When intent is product_assessment, this block MUST resolve the
    // request. It never falls through to shopping, exploration, or
    // gear_inquiry. If the product can't be resolved, a clarification
    // question is returned instead.
    if (intent === 'product_assessment') {
      // ── Enrich subject matches with previously recommended products ──
      // If the user references a product we already recommended, inject
      // its brand/category so assessment doesn't treat it as "unknown".
      const enrichedSubjects = turnCtx.subjectMatches.map((m) => {
        if (m.kind === 'product' || m.kind === 'brand') {
          const engaged = engagedProductsRef.current.get(m.name.toLowerCase());
          if (engaged && !m.brand) {
            return { ...m, brand: engaged.brand, category: engaged.category } as SubjectMatch;
          }
        }
        return m;
      });

      const assessmentCtx: AssessmentContext = {
        subjectMatches: enrichedSubjects,
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
      // ── Safety check (Task 5): product detected but resolution failed ──
      // Do NOT fall through to shopping/exploration/gear_inquiry.
      // Instead, return a clarification question so we don't hallucinate
      // substitutes or return unrelated products.
      const productName = turnCtx.subjectMatches.find((m) => m.kind === 'product')?.name
        ?? turnCtx.subjectMatches.find((m) => m.kind === 'brand')?.name
        ?? 'that product';
      const clarificationAdvisory: AdvisoryResponse = {
        kind: 'assessment',
        subject: productName,
        advisoryMode: 'product_assessment',
        bottomLine: `I want to make sure I understand — are you asking about the ${productName}? I don't have full catalog data on that specific model yet. If you can share more details (brand, model number, or category), I can offer a more informed assessment.`,
        followUp: `Could you confirm the exact product name or share a link? That way I can give you a proper evaluation rather than guessing.`,
      };
      dispatchAdvisory(clarificationAdvisory);
      dispatch({ type: 'SET_LOADING', value: false });
      return;
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
    //
    // When the state machine is in diagnosis mode, the symptom may have
    // been provided on an earlier turn (stored in facts.symptom). Combine
    // the stored symptom with the current message so buildSystemDiagnosis
    // can extract the complaint even when the current turn is purely
    // component names.
    if (intent === 'diagnosis' && turnCtx.subjectMatches.length >= 1) {
      const diagSymptom = convStateRef.current.mode === 'diagnosis'
        ? convStateRef.current.facts.symptom
        : undefined;
      const diagText = diagSymptom && !submittedText.includes(diagSymptom)
        ? `${diagSymptom}. ${submittedText}`
        : submittedText;
      const sysDiag = buildSystemDiagnosis(diagText, turnCtx.subjectMatches);
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
    //
    // Final convModeHint safety net: if detectIntent resolved to diagnosis
    // but the state machine wasn't engaged (idle, or returned null), ensure
    // the hint is set so skipDiagClarification works downstream.
    if (intent === 'diagnosis' && !convModeHint) {
      convModeHint = 'diagnosis';
    }
    const allUserText = [...messages.filter((m) => m.role === 'user').map((m) => m.content), submittedText].join('\n');
    const newTurnCount = turnCount + 1;

    // ── Listener Profile: detect and apply preference signals ──
    // Scan the latest message for "I like X" / "I prefer Y" / "I don't like Z"
    // and update the persistent listener profile.
    const preferenceSignals = detectPreferenceSignals(submittedText);
    if (preferenceSignals.length > 0) {
      const { profile: updatedProfile, applied } = applyPreferenceSignals(
        listenerProfileRef.current, preferenceSignals,
      );
      listenerProfileRef.current = updatedProfile;

      // Update profile badge immediately so early-return paths also show changes
      const earlyReflection = generateTasteReflection(updatedProfile);
      setProfileSnapshot(buildProfileSnapshot(
        updatedProfile.inferredTraits,
        updatedProfile.confidence,
        updatedProfile.sourceSignals.length,
        earlyReflection?.direction,
      ));

      console.log('[listener-profile] signals detected:', applied);
      console.log('[listener-profile]', {
        likedProducts: updatedProfile.likedProducts,
        inferredTraits: Object.entries(updatedProfile.inferredTraits)
          .filter(([, v]) => v > 0.1).map(([k, v]) => `${k}:${v.toFixed(2)}`),
        confidence: updatedProfile.confidence,
      });

      // ── "I like X" / "I don't like X" interception ─────
      // When the user expresses preference for a recommended product during
      // shopping, don't re-show the same recommendations. Instead:
      //   1. Acknowledge what that says about taste (short + sharp)
      //   2. Move to the next decision step
      if (intent === 'shopping' && shoppingAnswerCount > 0) {
        // Like interception
        const likeSignal = preferenceSignals.find((s) => s.kind === 'like' && s.product);
        if (likeSignal && likeSignal.product) {
          const tasteAck = generateTasteAcknowledgment(
            updatedProfile,
            `${likeSignal.product.brand} ${likeSignal.product.name}`,
          );

          if (tasteAck) {
            dispatch({
              type: 'ADD_NOTE',
              content: `${tasteAck.acknowledgment}\n\n${tasteAck.nextStep}`,
            });

            if (lastShoppingFactsRef.current) {
              lastShoppingFactsRef.current = {
                ...lastShoppingFactsRef.current,
                category: (tasteAck.nextCategory as import('@/lib/shopping-intent').ShoppingCategory | undefined) ?? lastShoppingFactsRef.current.category,
              };
            }

            console.log('[listener-profile] intercepted "I like %s" — acknowledged taste, suggesting %s',
              likeSignal.product.name, tasteAck.nextCategory);

            dispatch({ type: 'SET_LOADING', value: false });
            return;
          }
        }

        // Dislike interception — short acknowledgment, no product dump
        const dislikeSignal = preferenceSignals.find((s) => s.kind === 'dislike' && (s.product || s.isBrand));
        if (dislikeSignal && !likeSignal) {
          const dislikedName = dislikeSignal.product
            ? `${dislikeSignal.product.brand} ${dislikeSignal.product.name}`
            : dislikeSignal.subject;

          console.log('[decisive-followup] dislike_signal=%s (product=%s, isBrand=%s)',
            dislikedName, !!dislikeSignal.product, dislikeSignal.isBrand);

          // ── Decisive follow-up: if a recent turn was a decisive answer,
          // stay in decisive mode — rebuild with updated dislikes instead of
          // falling back to full product cards.
          // Walk backward through messages to find the latest decisive advisory.
          // This is more robust than checking only messages[-1] since notes or
          // other messages may have been inserted between the decisive turn and now.
          const prevDecisiveMsg = [...messages].reverse().find(
            (m): m is Extract<typeof m, { kind: 'advisory' }> =>
              m.role === 'assistant' && 'kind' in m && m.kind === 'advisory'
              && !!m.advisory.decisiveRecommendation
              && (!m.advisory.options || m.advisory.options.length === 0),
          );
          const prevWasDecisive = !!prevDecisiveMsg;

          console.log('[decisive-followup] detected_previous_decisive=%s', prevWasDecisive);

          if (prevWasDecisive) {
            console.log('[decisive-followup] rebuilding_decisive=true, skipping_orchestrator=true');

            // Find most recent advisory with product options for candidate pool.
            // This may be several turns back — the original shopping cards.
            const lastWithOptions = [...messages].reverse().find(
              (m): m is Extract<typeof m, { kind: 'advisory' }> =>
                m.role === 'assistant' && 'kind' in m && m.kind === 'advisory'
                && m.advisory.kind === 'shopping' && !!m.advisory.options && m.advisory.options.length >= 1,
            );
            const candidateOptions = lastWithOptions?.advisory.options;

            console.log('[decisive-followup] candidate_pool=%d products from prior advisory',
              candidateOptions?.length ?? 0);

            if (candidateOptions && candidateOptions.length >= 1) {
              const products = candidateOptions.map((o) => ({
                name: o.name ?? '',
                brand: o.brand ?? '',
                price: o.price ?? 0,
              }));

              const category = lastWithOptions.advisory.shoppingCategory
                ?? lastShoppingFactsRef.current?.category ?? 'general';
              const anchorPairing = buildSystemPairingIntro(
                listenerProfileRef.current, category, advisoryCtx.systemComponents,
              );
              const decisive = buildDecisiveRecommendation(
                products, listenerProfileRef.current, anchorPairing?.anchorName ?? null, category,
              );

              console.log('[decisive-followup] decisive_built=%s', !!decisive);

              if (decisive) {
                const ackText = `Noted — ${dislikedName} is off the table.`;
                dispatch({ type: 'ADD_NOTE', content: ackText });

                const decisiveAdvisory: AdvisoryResponse = {
                  kind: 'shopping',
                  subject: lastWithOptions.advisory.subject || 'recommendation',
                  shoppingCategory: lastWithOptions.advisory.shoppingCategory,
                  decisiveRecommendation: decisive,
                  systemPairingIntro: anchorPairing?.intro,
                  options: undefined,
                };

                console.log('[decisive-followup] dispatching revised: top=%s %s, alt=%s',
                  decisive.topPick.brand, decisive.topPick.name,
                  decisive.alternative ? `${decisive.alternative.brand} ${decisive.alternative.name}` : 'none');
                console.log('[decisive-followup] early_return=true');

                dispatchAdvisory(decisiveAdvisory, advisoryId());
                dispatch({ type: 'SET_LOADING', value: false });
                return;
              }
              console.log('[decisive-followup] fell_through_to_pipeline=true (buildDecisiveRecommendation returned null)');
            } else {
              console.log('[decisive-followup] fell_through_to_pipeline=true (no prior candidate pool)');
            }
          }

          // Default dislike acknowledgment (non-decisive context)
          const ackText = `Noted — ${dislikedName} is off the table. That helps narrow the direction.`;
          dispatch({ type: 'ADD_NOTE', content: ackText });
          console.log('[listener-profile] intercepted dislike: %s', dislikedName);
          // Don't return — let the pipeline continue with updated taste filtering
        }
      }
    }

    // ── Conclusion / Decisive Mode ─────────────────────────
    // When the user asks "what should I get?" / "just tell me" / "which one?"
    // and we have accumulated taste data, run the pipeline but only render
    // the decisive "What I would actually do" block — no product cards.
    const conclusionDetected = detectConclusionIntent(submittedText);
    const isConclusionRequest = intent === 'shopping' && shoppingAnswerCount > 0
      && conclusionDetected
      && listenerProfileRef.current.confidence >= 0.15;

    console.log('[decisive-debug] detection: text=%s, conclusionDetected=%s, intent=%s, answerCount=%d, confidence=%.2f → isConclusionRequest=%s',
      submittedText.slice(0, 60), conclusionDetected, intent, shoppingAnswerCount,
      listenerProfileRef.current.confidence, isConclusionRequest);

    // ── DECISIVE BYPASS ─────────────────────────────────────
    // When conclusion intent is detected, skip the entire pipeline
    // (no /api/evaluate, no buildShoppingAnswer, no orchestrator).
    // Build the decisive recommendation from the last known products
    // and dispatch immediately.
    if (isConclusionRequest) {
      console.log('[decisive-bypass] skipping orchestrator — building from last known products');

      // Extract products from the most recent shopping advisory
      const lastShoppingMsg = [...messages].reverse().find(
        (m): m is Extract<typeof m, { kind: 'advisory' }> =>
          m.role === 'assistant' && 'kind' in m && m.kind === 'advisory'
          && m.advisory.kind === 'shopping' && !!m.advisory.options && m.advisory.options.length >= 2,
      );

      const lastOptions = lastShoppingMsg?.advisory.options;

      if (lastOptions && lastOptions.length >= 2) {
        const products = lastOptions.map((o) => ({
          name: o.name ?? '',
          brand: o.brand ?? '',
          price: o.price ?? 0,
        }));

        // Build system pairing intro (optional)
        const bypassCategory = lastShoppingMsg.advisory.shoppingCategory
          ?? lastShoppingFactsRef.current?.category ?? 'general';
        const anchorPairing = buildSystemPairingIntro(
          listenerProfileRef.current,
          bypassCategory,
          advisoryCtx.systemComponents,
        );

        // Build decisive recommendation
        const decisiveCategory = lastShoppingMsg.advisory.shoppingCategory ?? lastShoppingFactsRef.current?.category ?? 'general';
        const decisive = buildDecisiveRecommendation(
          products,
          listenerProfileRef.current,
          anchorPairing?.anchorName ?? null,
          decisiveCategory,
        );

        if (decisive) {
          const decisiveAdvisory: AdvisoryResponse = {
            kind: 'shopping',
            subject: lastShoppingMsg.advisory.subject || 'recommendation',
            shoppingCategory: lastShoppingMsg.advisory.shoppingCategory,
            decisiveRecommendation: decisive,
            systemPairingIntro: anchorPairing?.intro,
            options: undefined,
          };

          console.log('[decisive-bypass] dispatching: top=%s %s, alt=%s',
            decisive.topPick.brand, decisive.topPick.name,
            decisive.alternative ? `${decisive.alternative.brand} ${decisive.alternative.name}` : 'none');

          dispatchAdvisory(decisiveAdvisory, advisoryId());
          dispatch({ type: 'SET_LOADING', value: false });
          return;
        }

        console.log('[decisive-bypass] buildDecisiveRecommendation returned null — falling through to normal pipeline');
      } else {
        console.log('[decisive-bypass] no prior shopping options found — falling through to normal pipeline');
      }
    }

    // ── Task A: Scoped evaluate for shopping refinement turns ──
    // On refinement turns (already in shopping, shoppingAnswerCount > 0),
    // only evaluate the current turn + recent context — not the entire
    // accumulated allUserText. This avoids redundant Prisma calls and
    // keeps signal extraction focused on what's new.
    //
    // Also scope the first shopping turn after a non-shopping mode to
    // prevent prior-mode signals (e.g. diagnosis symptoms) from leaking
    // into shopping product selection. state.activeMode still reflects
    // the *prior* turn's mode here because SET_MODE dispatches async.
    const isShoppingRefinement = intent === 'shopping' && shoppingAnswerCount > 0;
    const isFirstShoppingAfterModeSwitch = intent === 'shopping'
      && shoppingAnswerCount === 0
      && state.activeMode !== 'shopping';
    const scopeShoppingText = isShoppingRefinement || isFirstShoppingAfterModeSwitch;

    // Early category-switch detection: when the user explicitly switches
    // categories mid-shopping (e.g. "show me tube amps" after DAC browsing),
    // scope evaluateText to ONLY the current message to prevent prior-category
    // trait signals from leaking into the new category's product selection.
    const earlyCategorySwitch = isShoppingRefinement
      ? detectExplicitCategorySwitch(submittedText)
      : null;

    // Scope diagnosis text when entering diagnosis after shopping.
    // allUserText concatenates ALL prior messages, so shopping phrases
    // like "warm tube amp" inject fatigue_risk:down which overwrites
    // fatigue_risk:up from "harsh", causing the brightness rule to fail.
    // Use only the current message for fresh diagnosis entry after shopping.
    const isDiagnosisAfterShopping = intent === 'diagnosis'
      && (diagnosisBreakout || state.activeMode === 'shopping');
    const scopeDiagnosisText = isDiagnosisAfterShopping;

    // For diagnosis after shopping, use ONLY the current message to avoid
    // signal contamination from prior shopping text. For shopping scoping,
    // include the last 2 user messages for refinement context — UNLESS
    // an explicit category switch was detected, in which case use only
    // the current message to prevent prior-category trait leakage.
    const evaluateText = scopeDiagnosisText
      ? submittedText
      : earlyCategorySwitch
        ? submittedText
        : scopeShoppingText
          ? [submittedText, ...messages.filter((m) => m.role === 'user').map((m) => m.content).slice(-2)].join('\n')
          : allUserText;

    console.log('[diag-cold] about to call /api/evaluate (intent=%s, convModeHint=%s, scopeDiag=%s, scopeShop=%s, text=%s)', intent, convModeHint, scopeDiagnosisText, scopeShoppingText, evaluateText.slice(0, 80));
    let evalData: { signals: import('@/lib/signal-types').ExtractedSignals; result?: unknown } | null = null;
    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: evaluateText }),
      });
      if (res.ok) {
        evalData = await res.json();
        console.log('[diag-cold] /api/evaluate OK (rules=%d)', evalData?.result?.fired_rules?.length ?? 'n/a');
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

    // ── Enrich pipeline signals with listener profile taste ──
    // If the listener profile has accumulated taste (confidence > 0),
    // inject inferred traits as soft 'up' signals so the scoring engine
    // reflects accumulated preference direction. Only traits above a
    // meaningful threshold are injected, and only when the pipeline
    // doesn't already have an explicit signal from the current turn.
    if (listenerProfileRef.current.confidence > 0) {
      const lp = listenerProfileRef.current;
      const TRAIT_MAP: Record<string, string> = {
        flow: 'flow', clarity: 'clarity', rhythm: 'elasticity',
        tonal_density: 'tonal_density', spatial_depth: 'spatial_precision',
        dynamics: 'dynamics', warmth: 'warmth',
      };
      // Scale injection threshold with confidence — higher confidence = more sensitive
      const injectionThreshold = Math.max(0.1, 0.3 - lp.confidence * 0.15);
      for (const [profileKey, traitKey] of Object.entries(TRAIT_MAP)) {
        const inferredValue = lp.inferredTraits[profileKey as keyof typeof lp.inferredTraits];
        // Only inject if the trait is meaningfully present in the profile
        // AND the pipeline doesn't already have an explicit signal for it
        if (inferredValue > injectionThreshold && !pipelineSignals.traits[traitKey]) {
          pipelineSignals.traits[traitKey] = 'up' as import('@/lib/signal-types').SignalDirection;
          console.log('[taste→signals] injected %s:up (profile %s=%.2f, threshold=%.2f, confidence=%.2f)',
            traitKey, profileKey, inferredValue, injectionThreshold, lp.confidence);
        }
      }

      // Log taste reflection state for debugging
      const reflection = generateTasteReflection(lp);
      if (reflection) {
        console.log('[taste-reflection] direction=%s confident=%s bullets=%d summary="%s"',
          reflection.direction, reflection.confident, reflection.bullets.length, reflection.summary);
      }
    }

    if (intent === 'shopping') {
      // ── Shopping path ────────────────────────────
      // All shopping logic runs here — no diagnostic fallback.
      try {
        // ── Category lock: explicit switch detection ──────────
        // Reuse early detection result (computed before evaluateText scoping).
        const explicitCategorySwitch = earlyCategorySwitch;

        // Update locked category: explicit switch overrides, otherwise preserve lock.
        // When the category genuinely changes, clear stale carry-forward context
        // so the new category starts clean (no leaked budget, constraints, or
        // semantic preferences from the prior category session).
        if (explicitCategorySwitch) {
          const previousCategory = activeShoppingCategoryRef.current;
          activeShoppingCategoryRef.current = explicitCategorySwitch;
          console.log('[category-switch]', {
            from: previousCategory,
            to: explicitCategorySwitch,
            reason: 'explicit user switch',
          });

          // Clear stale context when switching to a genuinely different category
          if (previousCategory && previousCategory !== explicitCategorySwitch) {
            lastShoppingFactsRef.current = null;
            console.log('[category-switch] cleared lastShoppingFactsRef (was %s, now %s)', previousCategory, explicitCategorySwitch);
          }
        }

        // On explicit category switch, use ONLY the latest message for signal
        // extraction to avoid prior-category preferences contaminating the new
        // request. Otherwise, use full allUserText for context accumulation.
        const isFreshCategorySwitch = !!(explicitCategorySwitch && activeShoppingCategoryRef.current === explicitCategorySwitch
          && lastShoppingFactsRef.current === null);
        const shoppingInputText = isFreshCategorySwitch ? submittedText : allUserText;

        // When an explicit category switch is detected, scope the text to
        // ONLY the current message. This prevents prior-category constraints
        // (e.g. tube amp topology requirements) from contaminating the new
        // category's product selection (e.g. DAC, speaker).
        // Also scope when the state machine just completed (convModeHint === 'shopping').
        // The budget reply ("5000") is not an explicit category switch, but
        // allUserText still contains the old category's constraints (e.g. "tube amp"
        // topology requirements). The state machine already extracted category/budget
        // into lastShoppingFactsRef, so we only need the current message.
        const shoppingInputText = (earlyCategorySwitch || convModeHint === 'shopping') ? submittedText : allUserText;

        const shoppingCtx = detectShoppingIntent(
          shoppingInputText, pipelineSignals, advisoryCtx.systemComponents,
          // On refinement/category-switch turns, pass the latest message so its
          // category takes priority over earlier mentions in allUserText.
          shoppingAnswerCount > 0 ? submittedText : undefined,
          // Category lock: use locked category as fallback so stale allUserText
          // keywords don't override the user's active category on follow-up turns.
          shoppingAnswerCount > 0 ? (activeShoppingCategoryRef.current ?? lastShoppingFactsRef.current?.category) : undefined,
        );
        if (isFreshCategorySwitch) {
          console.log('[category-switch] using submittedText only for signal extraction (clean slate)');
        }

        // ── effectiveBudget: single source of truth ────────────
        // Priority: latest message budget > allUserText budget > saved budget
        // This prevents stale earlier budgets from overriding the user's
        // most recent budget statement.
        if (shoppingAnswerCount > 0) {
          // Parse budget from latest message FIRST — this is the authority
          const latestBudget = parseBudgetAmount(submittedText);
          if (latestBudget !== null) {
            // User explicitly stated a new budget in this message — override everything
            shoppingCtx.budgetAmount = latestBudget;
            shoppingCtx.budgetMentioned = true;
            console.log('[budget-debug] latest message override: $%d (from: "%s")', latestBudget, submittedText.slice(0, 80));
          }
        }

        if (shoppingAnswerCount > 0 && lastShoppingFactsRef.current) {
          const saved = lastShoppingFactsRef.current;

          // Budget carry-forward — only when current turn has NO budget
          if (!shoppingCtx.budgetAmount && saved.budget) {
            const amount = parseInt(saved.budget.replace(/[$,]/g, ''), 10);
            if (!isNaN(amount)) {
              shoppingCtx.budgetMentioned = true;
              shoppingCtx.budgetAmount = amount;
              console.log('[budget-debug] carry-forward from saved: $%d', amount);
            }
          }

          // Room context carry-forward (room persists across speaker → amp switches)
          if (!shoppingCtx.roomContext && saved.roomContext) {
            shoppingCtx.roomContext = saved.roomContext;
          }

          // Energy / scale / music carry-forward into semantic preferences
          const sp = shoppingCtx.semanticPreferences;
          if (!sp.energyLevel && saved.energyLevel) {
            sp.energyLevel = saved.energyLevel;
          }
          if (!sp.wantsBigScale && saved.wantsBigScale) {
            sp.wantsBigScale = true;
          }
          if (sp.musicHints.length === 0 && saved.musicHints && saved.musicHints.length > 0) {
            sp.musicHints = saved.musicHints;
          }

          // Constraint accumulation: merge saved constraints with current.
          // Constraints are additive — "no tubes" from a prior turn persists
          // even when the current turn says "class ab amps".
          // BUT: skip topology constraints on explicit category switch —
          // tube amp constraints (requireTopologies: ['push-pull-tube'])
          // must NOT leak into DAC or speaker selection.
          if (saved.constraints) {
            const cur = shoppingCtx.constraints;
            if (!explicitCategorySwitch) {
              for (const t of saved.constraints.excludeTopologies) {
                if (!cur.excludeTopologies.includes(t)) cur.excludeTopologies.push(t);
              }
              for (const t of saved.constraints.requireTopologies) {
                if (!cur.requireTopologies.includes(t)) cur.requireTopologies.push(t);
              }
            } else {
              console.log('[category-switch] skipping topology constraint carry-forward (switch to %s)', explicitCategorySwitch);
            }
            if (saved.constraints.newOnly && !cur.newOnly) cur.newOnly = true;
            if (saved.constraints.usedOnly && !cur.usedOnly) cur.usedOnly = true;
          }

          // ── Category lock enforcement ──────────────────────
          // If the locked category is set and no explicit switch happened this
          // turn, force the locked category. This prevents stale allUserText
          // keywords from overriding the active category on clarification,
          // preference, budget, or follow-up turns.
          const lockedCategory = activeShoppingCategoryRef.current;
          if (lockedCategory && lockedCategory !== 'general' && !explicitCategorySwitch) {
            if (shoppingCtx.category !== lockedCategory) {
              console.log('[category-lock]', {
                overridden: shoppingCtx.category,
                locked: lockedCategory,
                reason: 'no explicit switch — preserving locked category',
              });
              shoppingCtx.category = lockedCategory;
            }
          } else if (shoppingCtx.category === 'general' && saved.category && saved.category !== 'general') {
            // Legacy fallback for first-time carry-forward before lock is set
            shoppingCtx.category = saved.category;
          }
        }

        // ── Lock category after all resolution ──────────────
        // Once category is resolved (from explicit switch, latestMessage, or
        // carry-forward), lock it so subsequent turns preserve it.
        if (shoppingCtx.category !== 'general' && shoppingCtx.category !== 'unknown') {
          if (!activeShoppingCategoryRef.current) {
            console.log('[category-lock]', {
              initial: shoppingCtx.category,
              reason: 'first category establishment',
            });
          }
          activeShoppingCategoryRef.current = shoppingCtx.category;
        }

        // ── Budget adjustment for "cheaper" / "more expensive" ──
        // Applied AFTER carry-forward so it works with both fresh and
        // carried-forward budgets. Only fires on refinement turns.
        if (shoppingAnswerCount > 0 && shoppingCtx.budgetAmount) {
          const msgLower = submittedText.toLowerCase();
          const wantsCheaper = /\bcheaper\b|\bless expensive\b|\blower.{0,8}budget\b|\bmore affordable\b|\bbudget.{0,6}friendly\b|\bspend less\b/i.test(msgLower);
          const wantsMore = /\bmore expensive\b|\bhigher.{0,8}budget\b|\bstep up\b|\bspend more\b|\bstretch.{0,6}budget\b/i.test(msgLower);
          if (wantsCheaper) {
            shoppingCtx.budgetAmount = Math.round(shoppingCtx.budgetAmount * 0.6);
            console.log('[budget-adjust] "cheaper" detected — budget scaled to $%d', shoppingCtx.budgetAmount);
          } else if (wantsMore) {
            shoppingCtx.budgetAmount = Math.round(shoppingCtx.budgetAmount * 1.5);
            console.log('[budget-adjust] "more expensive" detected — budget scaled to $%d', shoppingCtx.budgetAmount);
          }
        }

        // ── effectiveBudget — the single authoritative value ──────
        const effectiveBudget = shoppingCtx.budgetAmount;

        // ── Debug: shopping pipeline state ──────────────────
        console.log('[budget-debug] turn=%d msg="%s"', newTurnCount, submittedText.slice(0, 80));
        console.log('[budget-debug]   parsedFromAllText=$%s parsedFromLatest=$%s effective=$%s',
          parseBudgetAmount(allUserText), parseBudgetAmount(submittedText), effectiveBudget);
        console.log('[budget-debug]   savedBudget=%s', lastShoppingFactsRef.current?.budget ?? 'none');
        console.log('[shopping-debug] turn=%d msg="%s"', newTurnCount, submittedText);
        console.log('[shopping-debug]   intent=%s effectiveMode=%s shoppingAnswerCount=%d', intent, effectiveMode, shoppingAnswerCount);
        console.log('[shopping-debug]   ctx.category=%s ctx.budget=$%s ctx.room=%s lockedCategory=%s', shoppingCtx.category, effectiveBudget, shoppingCtx.roomContext, activeShoppingCategoryRef.current ?? 'none');
        console.log('[shopping-debug]   constraints=%j', shoppingCtx.constraints);
        console.log('[shopping-debug]   semantic: bigScale=%s energy=%s', shoppingCtx.semanticPreferences.wantsBigScale, shoppingCtx.semanticPreferences.energyLevel);
        console.log('[shopping-debug]   savedFacts=%j', lastShoppingFactsRef.current);

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

          // Task 5: Removed redundant "Got it — adjusting the direction" note.
          // On refinement turns, the updated recommendations speak for themselves.
          // Skip passive exploratory note — StartHereBlock provides the active CTA
          // when preference signal is weak.

          // ── Engaged product names for shortlist continuity ──
          // When refining, extract product names the user has mentioned across
          // all turns. These get a scoring boost so they stay in the shortlist
          // (e.g. "Klipsch Heresy IV → large living room" keeps the Heresy IV).
          const engagedNames = shoppingAnswerCount > 0
            ? extractSubjectMatches(allUserText)
                .filter((m) => m.kind === 'product')
                .map((m) => m.name)
            : undefined;

          // Detect selection mode for 4-option anchor override
          const selectionMode = detectSelectionMode(submittedText);
          if (selectionMode !== 'default') {
            console.log('[selection-mode]', { input: submittedText, mode: selectionMode });
          }

          // Extract brand constraint from current-turn subject matches.
          // If no explicit brand subject, infer from a product subject via catalog lookup
          // (e.g., "and the ares?" → catalog finds Denafrips Ares 15th → brand = "denafrips").
          const brandSubject = turnCtx.subjectMatches.find((m) => m.kind === 'brand' && !m.parenthetical);
          let brandConstraint = brandSubject?.name;
          if (!brandConstraint) {
            const productSubject = turnCtx.subjectMatches.find((m) => m.kind === 'product');
            if (productSubject) {
              const catalogHit = findCatalogProduct(productSubject.name);
              if (catalogHit) {
                brandConstraint = catalogHit.brand.toLowerCase();
                console.log('[brand-infer] "%s" → catalog brand "%s"', productSubject.name, brandConstraint);
              }
            }
          }

          const answer = buildShoppingAnswer(shoppingCtx, pipelineSignals, tasteProfile ?? undefined, reasoning, advisoryCtx.systemComponents, engagedNames, listenerProfileRef.current, selectionMode, lastAnchorRef.current, recentShoppingProductsRef.current, brandConstraint);

          // ── Debug: final product list ──────────────────
          if (answer.productExamples && answer.productExamples.length > 0) {
            console.log('[shopping-debug]   products:');
            for (const p of answer.productExamples) {
              console.log('[shopping-debug]     %s ($%d) topo=%s sub=%s avail=%s realism=%s role=%s',
                p.name, p.price, (p as any).topology ?? '?', (p as any).subcategory ?? '?',
                p.availability ?? '?', p.budgetRealism ?? '?', p.pickRole ?? '?');
            }
          }

          // ── Hard category guard: verify answer matches locked category ──
          // If the category lock is active, the answer MUST be for that category.
          // This catches any residual drift in the pipeline.
          if (activeShoppingCategoryRef.current
            && activeShoppingCategoryRef.current !== 'general'
            && activeShoppingCategoryRef.current !== 'unknown'
            && shoppingCtx.category !== activeShoppingCategoryRef.current) {
            console.error('[CATEGORY VIOLATION] expected=%s got=%s — forcing locked category',
              activeShoppingCategoryRef.current, shoppingCtx.category);
            // Do not throw — force correct category on the context for downstream use
            shoppingCtx.category = activeShoppingCategoryRef.current;
          }

          // ── Track anchor + recent products for selection mode ──
          if (answer.productExamples && answer.productExamples.length > 0) {
            const anchorEx = answer.productExamples.find((p) => p.pickRole === 'anchor') ?? answer.productExamples[0];
            lastAnchorRef.current = {
              name: anchorEx.name,
              brand: anchorEx.brand,
              philosophy: anchorEx.philosophy,
              marketType: anchorEx.marketType,
              primaryAxes: anchorEx.primaryAxes,
            };
            recentShoppingProductsRef.current = answer.productExamples.map((p) => `${p.brand} ${p.name}`);
          }

          // ── Orchestrator context (shared by render + shadow paths) ──
          const orchestratorCtx: ShadowOrchestratorContext = {
            messages: state.messages,
            allUserText,
            currentMessage: submittedText,
            shoppingAnswerCount,
            category: shoppingCtx.category,
            budgetAmount: shoppingCtx.budgetAmount,
            roomContext: shoppingCtx.roomContext ?? null,
            hardConstraints: shoppingCtx.constraints,
            semanticPreferences: shoppingCtx.semanticPreferences,
            productExamples: answer.productExamples ?? [],
            systemComponents: advisoryCtx.systemComponents,
            systemTendencies: advisoryCtx.systemTendencies ?? undefined,
            musicPreferences: shoppingCtx.semanticPreferences.musicHints.length > 0
              ? shoppingCtx.semanticPreferences.musicHints
              : undefined,
            tasteProfile: tasteProfile
              ? { confidence: tasteProfile.confidence, traits: tasteProfile.traits }
              : undefined,
            dislikedBrands: listenerProfileRef.current.dislikedBrands.length > 0
              ? [...listenerProfileRef.current.dislikedBrands]
              : undefined,
            dislikedProducts: listenerProfileRef.current.dislikedProducts.length > 0
              ? [...listenerProfileRef.current.dislikedProducts]
              : undefined,
            isRefinement: shoppingAnswerCount > 0,
            wantsQuickSuggestions: wantsQuickSuggestions,
          };

          // Build decision frame — strategic framing before product shortlist
          const decisionFrame = buildDecisionFrame(shoppingCtx.category, advisoryCtx, tasteProfile);

          // ── Generate decisive recommendation + system pairing ──
          // These are post-shortlist additions that require the product list.
          if (answer.productExamples && answer.productExamples.length >= 2 && listenerProfileRef.current.confidence >= 0.15) {
            const anchorPairing = buildSystemPairingIntro(
              listenerProfileRef.current,
              shoppingCtx.category,
              advisoryCtx.systemComponents,
            );

            if (anchorPairing) {
              advisoryCtx.systemPairingIntro = anchorPairing.intro;
            }

            const decisive = buildDecisiveRecommendation(
              answer.productExamples.map((p) => ({ name: p.name, brand: p.brand, price: p.price })),
              listenerProfileRef.current,
              anchorPairing?.anchorName ?? null,
              shoppingCtx.category,
            );
            if (decisive) {
              advisoryCtx.decisiveRecommendation = decisive;
            }
          }

          // ── Deterministic advisory (always built — used as fallback) ──
          const deterministicShoppingAdvisory = shoppingToAdvisory(answer, pipelineSignals, reasoning, advisoryCtx, decisionFrame);

          // ── Taste reflection: override editorial intro with profile-derived framing ──
          // Only on first shopping answer (deep conversation guard strips it later).
          if (listenerProfileRef.current.confidence >= 0.15) {
            const tasteReflectionText = buildTasteReflection(listenerProfileRef.current);
            if (tasteReflectionText) {
              deterministicShoppingAdvisory.editorialIntro = tasteReflectionText;
              console.log('[taste-reflection] attached to editorialIntro');
            }
          }

          // ── Refinement guard: suppress onboarding signals on follow-up turns ──
          if (shoppingAnswerCount > 0) {
            deterministicShoppingAdvisory.lowPreferenceSignal = false;
            deterministicShoppingAdvisory.provisional = false;
            deterministicShoppingAdvisory.statedGaps = undefined;
          }

          // ── Deep conversation guard: reduce repetition ──────────
          // After 2+ shopping answers or high confidence, suppress sections
          // the user has already seen — taste reflection, editorial intro,
          // strategy bullets, sonic landscape. Keep: product cards, decisive
          // block, system pairing, refinement prompts (max 2), decision frame.
          const isDeepConversation = shoppingAnswerCount >= 2
            || listenerProfileRef.current.confidence >= 0.4;
          if (isDeepConversation) {
            // Taste reflection was already shown — don't repeat it
            deterministicShoppingAdvisory.tasteReflection = undefined;
            // Editorial intro repeats the same taste narrative
            deterministicShoppingAdvisory.editorialIntro = undefined;
            // System interpretation doesn't change across turns
            deterministicShoppingAdvisory.systemInterpretation = undefined;
            // Strategy bullets are directional — only useful on first pass
            if (shoppingAnswerCount >= 3) {
              deterministicShoppingAdvisory.strategyBullets = undefined;
            }
            // Sonic landscape repeats the same design philosophy overview
            deterministicShoppingAdvisory.sonicLandscape = undefined;
            // Trim refinement prompts to max 2 on deep turns
            if (deterministicShoppingAdvisory.refinementPrompts
              && deterministicShoppingAdvisory.refinementPrompts.length > 2) {
              deterministicShoppingAdvisory.refinementPrompts =
                deterministicShoppingAdvisory.refinementPrompts.slice(0, 2);
            }
            console.log('[deep-conversation] suppressed repeated sections (answerCount=%d, confidence=%.2f)',
              shoppingAnswerCount, listenerProfileRef.current.confidence);
          }

          // ── Step 7: Orchestrator render path ──────────────────
          // When NEXT_PUBLIC_ORCHESTRATOR_RENDER=true, await the orchestrator
          // and use its output for rendering. Otherwise, fire-and-forget shadow.
          let finalAdvisory = deterministicShoppingAdvisory;
          let renderSource: 'orchestrator' | 'deterministic' = 'deterministic';
          let orchestratorDebug: Record<string, unknown> | undefined;

          // Bypass orchestrator for any constrained query:
          // 1. Non-default selection modes (less_traditional, different) — LLM ignores mode constraints
          // 2. Component shopping queries (dac, speaker, amplifier) — LLM can hallucinate products
          //    outside the filtered/validated set, violating budget and category guards.
          // Only allow orchestrator for general/unconstrained default-mode queries.
          const isConstrainedCategory = shoppingCtx.category !== 'general' && shoppingCtx.category !== 'unknown';
          const allowOrchestrator = selectionMode === 'default' && !isConstrainedCategory;
          if (allowOrchestrator && isOrchestratorRenderEnabled() && (answer.productExamples ?? []).length > 0) {
            try {
              const input = buildOrchestratorInput(orchestratorCtx);
              const orchestratorOutput = await callOrchestratorAPI(input);
              const validShopping = extractValidShoppingOutput(orchestratorOutput);

              if (validShopping && orchestratorOutput) {
                const adapted = orchestratorToAdvisory({
                  shoppingOutput: validShopping,
                  productExamples: answer.productExamples ?? [],
                  category: shoppingCtx.category,
                  budget: shoppingCtx.budgetAmount,
                  debug: orchestratorOutput.debug,
                });
                finalAdvisory = adapted;
                renderSource = 'orchestrator';
                orchestratorDebug = orchestratorOutput.debug;
                console.log('[orchestrator-render] Using orchestrator output — %d recommendations',
                  validShopping.recommendations.length);
              } else {
                console.log('[orchestrator-render] Invalid or empty orchestrator output — using deterministic fallback');
              }
            } catch (orchErr) {
              console.error('[orchestrator-render] Failed — using deterministic fallback:', orchErr);
            }
          } else if ((answer.productExamples ?? []).length > 0) {
            // Flag OFF — fire shadow orchestrator (existing behavior)
            try {
              fireShadowOrchestrator(orchestratorCtx);
            } catch (shadowErr) {
              console.error('[orchestrator-shadow] Setup error:', shadowErr);
            }
          }

          if (!allowOrchestrator && isOrchestratorRenderEnabled()) {
            const bypassReason = isConstrainedCategory
              ? `constrained category=${shoppingCtx.category}`
              : `selectionMode=${selectionMode}`;
            console.log('[orchestrator-bypass] %s — using deterministic pipeline to enforce constraints', bypassReason);
          }
          logRenderSource(renderSource, orchestratorDebug);

          // ── Post-validation: hard budget enforcement on final output ──
          // Regardless of render source (deterministic or orchestrator),
          // strip any option whose price exceeds effectiveBudget.
          // This is the last line of defence — no over-budget product can
          // reach the user.
          if (effectiveBudget && finalAdvisory.options && finalAdvisory.options.length > 0) {
            const beforeCount = finalAdvisory.options.length;
            finalAdvisory = {
              ...finalAdvisory,
              options: finalAdvisory.options.filter((opt) => {
                if (!opt.price) return true; // no price info → keep
                if (opt.price <= effectiveBudget) return true;
                // Check used price
                if (opt.usedPriceRange && opt.usedPriceRange.high <= effectiveBudget) return true;
                console.log('[budget-debug] POST-FILTER removed: %s %s ($%d) > budget $%d',
                  opt.brand, opt.name, opt.price, effectiveBudget);
                return false;
              }),
            };
            if (finalAdvisory.options!.length === 0) {
              // All products removed — fall back to deterministic (which has budget-filtered products)
              console.warn('[budget-debug] All orchestrator products exceeded budget $%d — reverting to deterministic', effectiveBudget);
              finalAdvisory = deterministicShoppingAdvisory;
            } else if (finalAdvisory.options!.length < beforeCount) {
              console.log('[budget-debug] Post-filter: %d → %d products (budget=$%d)',
                beforeCount, finalAdvisory.options!.length, effectiveBudget);
            }
          }

          // Debug: final candidates after all filtering
          console.log('[budget-debug] FINAL candidates: [%s] budget=$%s',
            (finalAdvisory.options ?? []).map((o) => `${o.brand} ${o.name} ($${o.price})`).join(', '),
            effectiveBudget);

          // Task 9: Debug log for re-ranking on refinement turns
          if (isShoppingRefinement) {
            const productNames = (finalAdvisory.options ?? []).map((o) => [o.brand, o.name].filter(Boolean).join(' '));
            console.log('[re-ranking] refinement turn=%d, renderSource=%s, products=[%s], category=%s, newSignal=%s',
              shoppingAnswerCount, renderSource, productNames.join(', '), shoppingCtx.category, submittedText.slice(0, 80));
          }

          // ── Conclusion mode: decisive-only rendering ──────────
          // When the user asked "what should I get?" / "just tell me" etc.,
          // strip everything except the decisive recommendation block and
          // system pairing intro. No product cards, no editorial, no
          // repeated taste reflection — just the direct answer.
          console.log('[decisive-debug] pre-strip: isConclusionRequest=%s, hasDecisive=%s, hasOptions=%s, optionCount=%d',
            isConclusionRequest, !!finalAdvisory.decisiveRecommendation,
            !!finalAdvisory.options, (finalAdvisory.options ?? []).length);

          // Fallback: conclusion requested but no decisive rec was generated
          // (e.g., confidence was borderline). Force-build from top 2 options.
          if (isConclusionRequest && !finalAdvisory.decisiveRecommendation
            && finalAdvisory.options && finalAdvisory.options.length >= 2) {
            const top = finalAdvisory.options[0];
            const alt = finalAdvisory.options[1];
            finalAdvisory.decisiveRecommendation = {
              topPick: {
                name: top.name ?? '',
                brand: top.brand ?? '',
                reason: top.fitNote || top.character || 'Best overall alignment with your listening priorities.',
              },
              alternative: {
                name: alt.name ?? '',
                brand: alt.brand ?? '',
                reason: alt.fitNote || alt.character || 'A different balance worth considering.',
              },
            };
            console.log('[decisive-debug] fallback: built decisive from top 2 options');
          }

          if (isConclusionRequest && finalAdvisory.decisiveRecommendation) {
            finalAdvisory = {
              kind: finalAdvisory.kind,
              subject: finalAdvisory.subject,
              shoppingCategory: finalAdvisory.shoppingCategory,
              // Keep the decisive block — the whole point
              decisiveRecommendation: finalAdvisory.decisiveRecommendation,
              // Keep system pairing intro if present (anchor context)
              systemPairingIntro: finalAdvisory.systemPairingIntro,
              // Strip everything else: no product cards, no editorial,
              // no taste reflection, no strategy bullets, no refinement prompts
              options: undefined,
              editorialIntro: undefined,
              editorialClosing: undefined,
              tasteReflection: undefined,
              strategyBullets: undefined,
              systemInterpretation: undefined,
              refinementPrompts: undefined,
              sonicLandscape: undefined,
              decisionFrame: undefined,
              systemContextPreamble: undefined,
              statedGaps: undefined,
              lowPreferenceSignal: false,
              provisional: false,
            };
            console.log('[decisive-debug] post-strip: hasOptions=%s, hasDecisive=%s, top=%s %s, alt=%s %s',
              !!finalAdvisory.options, !!finalAdvisory.decisiveRecommendation,
              finalAdvisory.decisiveRecommendation.topPick.brand,
              finalAdvisory.decisiveRecommendation.topPick.name,
              finalAdvisory.decisiveRecommendation.alternative?.brand ?? 'none',
              finalAdvisory.decisiveRecommendation.alternative?.name ?? '');
          }

          const shoppingMsgId = advisoryId();
          dispatchAdvisory(finalAdvisory, shoppingMsgId);

          // ── Multi-category follow-up ──────────────────────
          // When the user asked for two categories ("amp and dac"), build
          // a second shopping answer for the secondary category and dispatch
          // it immediately after the first.
          if (shoppingCtx.secondaryCategory && shoppingCtx.secondaryCategory !== 'general') {
            try {
              const secondaryCtx = { ...shoppingCtx, category: shoppingCtx.secondaryCategory, secondaryCategory: undefined };
              const secondaryAnswer = buildShoppingAnswer(secondaryCtx, pipelineSignals, tasteProfile ?? undefined, reasoning, advisoryCtx.systemComponents, engagedNames, listenerProfileRef.current);
              if (secondaryAnswer.productExamples && secondaryAnswer.productExamples.length > 0) {
                const secondaryAdvisory = shoppingToAdvisory(secondaryAnswer, pipelineSignals, reasoning, advisoryCtx, buildDecisionFrame(secondaryCtx.category, advisoryCtx, tasteProfile));
                if (shoppingAnswerCount > 0) {
                  secondaryAdvisory.lowPreferenceSignal = false;
                  secondaryAdvisory.provisional = false;
                }
                dispatchAdvisory(secondaryAdvisory, advisoryId());
                console.log('[multi-category] dispatched secondary=%s with %d products',
                  secondaryCtx.category, secondaryAnswer.productExamples.length);
              }
            } catch (secErr) {
              console.warn('[multi-category] secondary category failed:', secErr);
            }
          }

          // Fire-and-forget: request LLM editorial overlay for richer product descriptions.
          // On success, merge enriched fields into the advisory and update in place.
          // On failure (timeout, validation rejection), the deterministic descriptions stand.
          // Skip when using orchestrator output — it already provides rich LLM prose.
          if (renderSource === 'deterministic' && deterministicShoppingAdvisory.options && deterministicShoppingAdvisory.options.length > 0) {
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

          // ── Preserve context for category switches ──────────
          // When user switches categories ("great — now how about an amp"),
          // carry forward room context, music genre, energy, and scale preferences
          // so the next category gets the same environmental context.
          // Merge constraints: accumulate across turns so "no tubes" from
          // Turn 8 persists through Turn 9 "i want new" and Turn 10 "class ab amps".
          const mergedConstraints: import('@/lib/shopping-intent').HardConstraints = {
            excludeTopologies: [
              ...new Set([
                ...(lastShoppingFactsRef.current?.constraints?.excludeTopologies ?? []),
                ...shoppingCtx.constraints.excludeTopologies,
              ]),
            ],
            requireTopologies: [
              ...new Set([
                ...(lastShoppingFactsRef.current?.constraints?.requireTopologies ?? []),
                ...shoppingCtx.constraints.requireTopologies,
              ]),
            ],
            newOnly: shoppingCtx.constraints.newOnly || (lastShoppingFactsRef.current?.constraints?.newOnly ?? false),
            usedOnly: shoppingCtx.constraints.usedOnly || (lastShoppingFactsRef.current?.constraints?.usedOnly ?? false),
          };

          lastShoppingFactsRef.current = {
            ...lastShoppingFactsRef.current,
            budget: shoppingCtx.budgetAmount ? `$${shoppingCtx.budgetAmount}` : lastShoppingFactsRef.current?.budget,
            roomContext: shoppingCtx.roomContext ?? lastShoppingFactsRef.current?.roomContext,
            musicHints: shoppingCtx.semanticPreferences.musicHints.length > 0
              ? shoppingCtx.semanticPreferences.musicHints
              : lastShoppingFactsRef.current?.musicHints,
            energyLevel: shoppingCtx.semanticPreferences.energyLevel ?? lastShoppingFactsRef.current?.energyLevel,
            wantsBigScale: shoppingCtx.semanticPreferences.wantsBigScale || lastShoppingFactsRef.current?.wantsBigScale,
            constraints: mergedConstraints,
            category: shoppingCtx.category !== 'general' ? shoppingCtx.category : lastShoppingFactsRef.current?.category,
          };

          // ── Persist recommended products for cross-turn continuity ──
          // When a product appears in recommendations, it should never be
          // treated as "unknown" on subsequent turns.
          if (answer.productExamples) {
            for (const p of answer.productExamples) {
              engagedProductsRef.current.set(p.name.toLowerCase(), {
                name: p.name,
                brand: p.brand,
                category: p.category,
              });
            }
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

      // Only skip clarification when we have symptoms to act on.
      // If the diagnosis intent fired but no symptom was extracted
      // (e.g. "I want to fix my amp"), we NEED to ask what's wrong.
      const hasSymptomSignals = pipelineSignals.symptoms.length > 0;
      const skipDiagClarification = convModeHint === 'diagnosis' && hasSymptomSignals;

      // ── Component-aware diagnosis clarification ─────────
      // When diagnosis fires with no symptoms but the user mentioned a
      // component category ("amp", "speakers", "DAC"), ask a targeted
      // troubleshooting question instead of a generic "what's wrong?"
      const componentCategoryMap: Array<[RegExp, string, string]> = [
        [/\b(?:amp|amplifier|integrated)\b/i, 'amplifier', 'Is it distorting, running hot, lacking dynamics, sounding thin — or something else?'],
        [/\b(?:speakers?|monitors?|floorstanders?|bookshelfs?)\b/i, 'speakers', 'Are they sounding harsh, boomy, lacking detail, or imaging poorly — or something else?'],
        [/\b(?:dac|d\/a\s*converter)\b/i, 'DAC', 'Does it sound thin, digital, fatiguing, or lifeless — or something else?'],
        [/\b(?:turntable|phono|cartridge|vinyl)\b/i, 'turntable', 'Is it noisy, distorting, lacking bass, or tracking poorly — or something else?'],
        [/\b(?:streamer|transport|source)\b/i, 'source', 'Does it sound flat, lifeless, harsh, or lacking dynamics — or something else?'],
        [/\b(?:cables?|interconnects?|power\s*cords?)\b/i, 'cables', 'What changed when you added or swapped them? More brightness, less bass, different staging?'],
      ];
      let componentClarification: { acknowledge: string; question: string } | null = null;
      if (!hasSymptomSignals && intent === 'diagnosis') {
        for (const [pattern, label, followUp] of componentCategoryMap) {
          if (pattern.test(submittedText)) {
            componentClarification = {
              acknowledge: `Got it — let's figure out what's going on with your ${label}.`,
              question: followUp,
            };
            break;
          }
        }
      }

      if (evalData) {
        // API succeeded — use full evaluation data
        // When the state machine already decided ready_to_diagnose (symptom
        // is sufficient), skip the clarification gate and diagnose immediately.
        // This prevents low-information checks from overriding the state
        // machine's readiness decision with a generic "describe what bothers
        // you" question.
        const clarification = skipDiagClarification
          ? null
          : componentClarification ?? getClarificationQuestion(
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
          console.log('[diag-cold] clarification fired (skipDiag=%s, componentAware=%s)', skipDiagClarification, !!componentClarification);
          dispatch({ type: 'ADD_QUESTION', clarification });
        } else {
          console.log('[diag-cold] dispatching advisory (rules=%d)', evalData.result?.fired_rules?.length ?? 0);
          dispatchAdvisory(analysisToAdvisory(evalData.result, pipelineSignals, diagDirection, reasoning, advisoryCtx), advisoryId());
        }
      } else if (!skipDiagClarification) {
        // API failed — ask a component-aware refinement question if available,
        // otherwise ask a generic question to gather more context.
        dispatch({
          type: 'ADD_QUESTION',
          clarification: componentClarification ?? {
            acknowledge: 'Got it — let me understand a bit more.',
            question: 'Can you describe what you\'re hearing that you\'d like to change? And what equipment are you using?',
          },
        });
      }
    }

    // ── Update listener profile snapshot for UI ──
    // Refresh after all turn processing so the badge reflects the latest state.
    const lp = listenerProfileRef.current;
    const reflection = generateTasteReflection(lp);
    setProfileSnapshot(buildProfileSnapshot(
      lp.inferredTraits,
      lp.confidence,
      lp.sourceSignals.length,
      reflection?.direction,
    ));

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
    setProfileSnapshot(null);
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

      {/* Listener profile badge — visible during conversation when profile has data */}
      {hasMessages && profileSnapshot && (
        <ListenerProfileBadge snapshot={profileSnapshot} />
      )}

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
          </p>
          <p
            style={{
              margin: 0,
              marginTop: '0.35rem',
              color: COLOR.textSecondary,
              fontSize: '0.85rem',
              letterSpacing: '0.04em',
              fontWeight: 500,
            }}
          >
            System Synergy &nbsp;&middot;&nbsp; Component Matching &nbsp;&middot;&nbsp; Product Research
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
              // In inquiry mode (pending question), suppress diagnosis advisory messages —
              // but only when the pending item is an actual clarification question,
              // not when the diagnosis advisory itself is the last message.
              if (
                lastMessage?.kind === 'question' &&
                msg.role === 'assistant' && 'kind' in msg && msg.kind === 'advisory' && msg.advisory.kind === 'diagnosis'
              ) {
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
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: '1.25rem',
        }}
      >
        <div
          style={{
            maxWidth: '82%',
            padding: '0.75rem 1rem',
            background: '#eae6dc',
            borderRadius: '12px 12px 4px 12px',
            color: COLOR.textPrimary,
            fontSize: '0.96rem',
            lineHeight: 1.65,
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  if (message.kind === 'advisory') {
    return (
      <div style={{
        marginBottom: '1.75rem',
        paddingLeft: '0.25rem',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.85rem',
          paddingTop: '0.5rem',
          borderTop: `1px solid ${COLOR.border}`,
        }}>
          <div style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: COLOR.accent,
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase' as const,
            color: COLOR.textSecondary,
          }}>
            Audio XX
          </span>
        </div>
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
        paddingLeft: '0.75rem',
        borderLeft: `2px solid ${COLOR.border}`,
        color: COLOR.textSecondary,
        fontSize: '0.96rem',
        lineHeight: 1.6,
      }}
    >
      {message.content}
    </div>
  );
}

