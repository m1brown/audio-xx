'use client';

import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import TasteRadar from '@/components/TasteRadar';
import AdvisoryMessage from '@/components/advisory/AdvisoryMessage';
import {
  consultationToAdvisory,
  gearResponseToAdvisory,
  shoppingToAdvisory,
  analysisToAdvisory,
  assessmentToAdvisory,
  knowledgeToAdvisory,
  assistantToAdvisory,
} from '@/lib/advisory-response';
import type { AdvisoryResponse, ShoppingAdvisoryContext } from '@/lib/advisory-response';
import { buildProductAssessment } from '@/lib/product-assessment';
import type { AssessmentContext } from '@/lib/product-assessment';
import { buildKnowledgeResponse, buildAssistantResponse } from '@/lib/audio-lanes';
import type { KnowledgeContext, AssistantContext as AudioAssistantContext } from '@/lib/audio-lanes';
import { buildDecisionFrame } from '@/lib/decision-frame';
import { getClarificationQuestion } from '@/lib/clarification';
import type { ClarificationResponse } from '@/lib/clarification';
import { detectShoppingIntent, buildShoppingAnswer, getShoppingClarification } from '@/lib/shopping-intent';
import { checkGlossaryQuestion } from '@/lib/glossary';
import { detectIntent, isBrandOnlyComparison, isComparisonFollowUp, isConsultationFollowUp, detectContextEnrichment, type SubjectMatch } from '@/lib/intent';
import { buildGearResponse } from '@/lib/gear-response';
import { inferSystemDirection } from '@/lib/system-direction';
import { routeConversation, resolveMode } from '@/lib/conversation-router';
import type { ConversationMode } from '@/lib/conversation-router';
import { buildConsultationResponse, buildComparisonRefinement, buildContextRefinement, buildConsultationFollowUp, buildSystemAssessment, buildConsultationEntry, buildCableAdvisory } from '@/lib/consultation';
import { inferUnknownProduct } from '@/lib/llm-product-inference';
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

const CYCLING_PLACEHOLDERS = [
  'Assess my system: Eversolo → Hugo → JOB → WLM Diva',
  'Best DAC under $2000',
  'Best integrated amplifier under $3000',
  'How\u2019s the Laiv Harmony uDAC?',
  'Compare Klipsch Heresy to DeVore O/96',
];

/** Interval in ms between placeholder rotations. */
const PLACEHOLDER_INTERVAL = 4000;

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

    // ── Build canonical turn context ────────────────────
    // Single extraction pass: subjects, desires, system detection,
    // active system resolution, profile, confidence — all builders
    // and routing decisions consume this same object.
    const turnCtx = buildTurnContext(submittedText, audioState, dismissedFingerprintsRef.current);

    // ── Build AudioProfile context (shared across all advisory paths) ──
    const advisoryCtx: ShoppingAdvisoryContext = {
      systemComponents: turnCtx.activeSystem
        ? turnCtx.activeSystem.components.map((c) =>
            c.name.toLowerCase().startsWith(c.brand.toLowerCase())
              ? c.name
              : `${c.brand} ${c.name}`,
          )
        : undefined,
      systemLocation: turnCtx.activeSystem?.location ?? undefined,
      systemPrimaryUse: turnCtx.activeSystem?.primaryUse ?? undefined,
      storedDesires: tasteProfile
        ? topTraits(tasteProfile, 5).map((t) => t.label)
        : undefined,
      systemTendencies: turnCtx.activeSystem?.tendencies ?? undefined,
    };

    // ── Conversation router ──────────────────────────────
    // Classify the message into a conversation mode before detailed
    // intent detection. Mode persistence carries across turns.
    const routedMode = routeConversation(submittedText);
    const effectiveMode = resolveMode(routedMode, state.activeMode);
    dispatch({ type: 'SET_MODE', mode: effectiveMode });

    // ── Detect intent ───────────────────────────────────
    // Intent detection runs after extraction. We only need the intent
    // classification — subjectMatches, desires, and subjects are
    // already canonical in turnCtx.
    let { intent } = detectIntent(submittedText);



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
      dispatch({ type: 'ADD_ADVISORY', advisory: consultationToAdvisory(refinement, undefined, advisoryCtx), id: advisoryId() });
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
        dispatch({ type: 'ADD_ADVISORY', advisory: consultationToAdvisory(refinement, undefined, advisoryCtx), id: advisoryId() });
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
        dispatch({ type: 'ADD_ADVISORY', advisory: consultationToAdvisory(followUp, undefined, advisoryCtx), id: advisoryId() });
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
      dispatch({ type: 'ADD_ADVISORY', advisory: consultationToAdvisory(entryResult, undefined, advisoryCtx), id: advisoryId() });
      dispatch({ type: 'SET_LOADING', value: false });
      return;
    }

    // ── Cable advisory path ────────────────────────────
    // Cable queries get a structured advisory response covering cable
    // strategy, system context, tuning direction, and trade-offs.
    if (intent === 'cable_advisory') {
      const cableResult = buildCableAdvisory(submittedText, turnCtx.subjectMatches, turnCtx.desires, turnCtx.activeSystem);
      dispatch({ type: 'ADD_ADVISORY', advisory: consultationToAdvisory(cableResult, undefined, advisoryCtx), id: advisoryId() });
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
        const assessmentMsgId = advisoryId();
        const deterministicAdvisory = consultationToAdvisory(assessmentResult.response, undefined, advisoryCtx);
        dispatch({ type: 'ADD_ADVISORY', advisory: deterministicAdvisory, id: assessmentMsgId });
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
    // Gear inquiries with subjects also try consultation first — this ensures
    // brand links surface and richer brand profiles are used when available.
    // Falls through to gear-response if consultation returns null.
    const isBrandComparison = intent === 'comparison' && isBrandOnlyComparison(turnCtx.subjectMatches);
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
        dispatch({ type: 'ADD_ADVISORY', advisory: consultationToAdvisory(consultResult, undefined, advisoryCtx), id: advisoryId() });
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
          dispatch({ type: 'ADD_ADVISORY', advisory: consultationToAdvisory(inferred, undefined, advisoryCtx), id: advisoryId() });
          dispatch({ type: 'SET_LOADING', value: false });
          return;
        }
      }
      // LLM inference also failed — fall through to gear inquiry path below
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
        dispatch({ type: 'ADD_ADVISORY', advisory });
        dispatch({ type: 'SET_LOADING', value: false });
        return;
      }
      // If assessment builder returns null (can't identify product),
      // fall through to gear inquiry path
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
        dispatch({ type: 'ADD_ADVISORY', advisory: gearResponseToAdvisory(gearResponse, undefined, advisoryCtx), id: advisoryId() });
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
      dispatch({ type: 'ADD_ADVISORY', advisory: knowledgeToAdvisory(knowledge, advisoryCtx) });
      dispatch({ type: 'SET_LOADING', value: false });
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
      dispatch({ type: 'ADD_ADVISORY', advisory: assistantToAdvisory(assistant) });
      dispatch({ type: 'SET_LOADING', value: false });
      return;
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
          const shoppingCtx = detectShoppingIntent(allUserText, data.signals, advisoryCtx.systemComponents);

          // Decide: ask a clarification question or give a recommendation?
          // Skip clarifications if we've already given a recommendation
          // (refinement mode), hit the turn cap, or user requested quick suggestions.
          const maxClarifications = 2;
          const wantsQuickSuggestions = skipToSuggestionsRef.current;
          const pastClarificationCap = shoppingAnswerCount > 0 || newTurnCount > maxClarifications;
          const shoppingQuestion = pastClarificationCap
            ? null
            : getShoppingClarification(shoppingCtx, data.signals, newTurnCount, wantsQuickSuggestions);
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
              allUserText, turnCtx.desires, data.signals,
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
            const answer = buildShoppingAnswer(shoppingCtx, data.signals, tasteProfile ?? undefined, reasoning);

            // Build decision frame — strategic framing before product shortlist
            const decisionFrame = buildDecisionFrame(shoppingCtx.category, advisoryCtx, tasteProfile);

            const deterministicShoppingAdvisory = shoppingToAdvisory(answer, data.signals, reasoning, advisoryCtx, decisionFrame);
            const shoppingMsgId = advisoryId();
            dispatch({ type: 'ADD_ADVISORY', advisory: deterministicShoppingAdvisory, id: shoppingMsgId });

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
                archetypeHints: data.signals.archetype_hints?.length > 0
                  ? data.signals.archetype_hints
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
            allUserText, turnCtx.desires, data.signals,
            tasteProfile ?? null, null, turnCtx.activeProfile,
          );
          dispatch({ type: 'SET_REASONING', reasoning });

          // Use reasoning direction to frame diagnosis results
          const diagDirection = inferSystemDirection(submittedText, turnCtx.desires, undefined, tasteProfile ?? undefined);

          if (clarification) {
            dispatch({ type: 'ADD_QUESTION', clarification });
          } else {
            dispatch({ type: 'ADD_ADVISORY', advisory: analysisToAdvisory(data.result, data.signals, diagDirection, reasoning, advisoryCtx), id: advisoryId() });
          }
        }
      }
    } catch {
      // Silently handle — user can retry
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
    (lastMessage.kind === 'question' || lastMessage.kind === 'advisory');

  return (
    <div
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '3rem 1.5rem 3rem',
        color: '#2a2a2a',
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
          color: '#2a2a2a',
        }}
      >
        Audio XX
      </h1>

      {/* System badge + panel */}
      <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
        <SystemBadge onClick={() => setSystemPanelOpen((v) => !v)} />
        {/* Fallback entry point when no system is active (and no auto-activated single system) */}
        {!audioState.activeSystemRef && audioState.savedSystems.length !== 1 && !systemPanelOpen && (
          <button
            type="button"
            onClick={() => setSystemPanelOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.78rem',
              color: '#aaa',
              fontFamily: 'inherit',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            {audioState.savedSystems.length > 0 || audioState.draftSystem
              ? 'Select system'
              : 'Add your system'}
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
                <MessageBubble key={i} message={msg} />
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
                border: '1px solid #d5d5d0',
                borderRadius: 6,
                cursor: 'pointer',
                color: '#888',
                fontSize: '0.85rem',
                fontFamily: 'inherit',
                letterSpacing: '0.01em',
                transition: 'color 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#555';
                e.currentTarget.style.borderColor = '#aaa';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#888';
                e.currentTarget.style.borderColor = '#d5d5d0';
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
            color: '#2a2a2a',
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

        {/* Send button */}
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={isLoading || !currentInput.trim()}
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem 1.4rem',
            background: isLoading || !currentInput.trim() ? '#ccc' : '#333',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: '0.88rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            cursor: isLoading || !currentInput.trim() ? 'default' : 'pointer',
            transition: 'background 0.15s ease',
          }}
        >
          {isLoading ? 'Thinking…' : 'Send'}
        </button>

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

  if (message.kind === 'advisory') {
    return (
      <div style={{ marginBottom: '1.75rem' }}>
        <hr style={{ border: 0, borderTop: '1px solid #e5e5e3', margin: '0 0 1.5rem 0' }} />
        <AdvisoryMessage advisory={message.advisory} />
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
            color: '#2a2a2a',
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
              color: '#333',
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

