'use client';

import { useReducer, useEffect, useRef, useCallback, useMemo, useState, type ReactNode } from 'react';
import { getProductImageEntry } from '@/lib/product-images';
import { isMakerPublished } from '@/lib/evidence/manufacturer-facts';
import { buildComponentViews } from '@/lib/system-component-view';
import { tierFor } from '@/lib/entity-corroboration';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import AdvisoryMessage from '@/components/advisory/AdvisoryMessage';
import type { PreferenceSelection } from '@/components/advisory/AdvisoryMessage';
import FeedbackPrompt from '@/components/FeedbackPrompt';
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
import { buildUnknownProductClarification, resolveUnknownProductName } from '@/lib/unknown-product-clarification';
import { buildProductAssessment } from '@/lib/product-assessment';
import type { AssessmentContext } from '@/lib/product-assessment';
import { buildKnowledgeResponse, buildAssistantResponse, requestKnowledgeLlm, requestAssistantLlm } from '@/lib/audio-lanes';
import type { KnowledgeContext, AssistantContext as AudioAssistantContext } from '@/lib/audio-lanes';
import { buildDecisionFrame } from '@/lib/decision-frame';
import { getClarificationQuestion, SYSTEM_COMPONENTS_QUESTION, SYSTEM_JUDGMENT_REQUEST } from '@/lib/clarification';
import type { ClarificationResponse } from '@/lib/clarification';
import { tryBetaInterceptRouting } from '@/lib/beta-intent-routing';
import { detectShoppingIntent, buildShoppingAnswer, validateShoppingAnswer, getShoppingClarification, parseBudgetAmount, mentionsRecommendedProduct, extractBrandExclusions, detectSelectionMode, detectExplicitCategorySwitch, extractPriorityCategory, type PreviousAnchor, type SelectionMode } from '@/lib/shopping-intent';
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
import {
  createDefaultProfile as createDefaultListenerPreferenceProfile,
  applySignals as applyListenerPreferenceSignals,
  extractPreferenceSignals as extractListenerPreferenceSignals,
  renderProfileSummary as renderListenerPreferenceSummary,
  type PreferenceSignal as ListenerPreferenceSignal,
} from '@/lib/listener-preferences';
import { buildPreferenceReflection } from '@/lib/preference-reflection';
import { checkGlossaryQuestion } from '@/lib/glossary';
import { fetchWithTimeout, EVALUATE_TIMEOUT_MS } from '@/lib/fetch-with-timeout';
import { detectIntent, detectExplicitCategoryPivot, extractSubjectMatches, isComparisonFollowUp, isConsultationFollowUp, isDiagnosisFollowUp, isGearQuestionEscape, detectContextEnrichment, respondToMusicInput, MUSIC_INPUT_FALLBACK, detectListeningPath, respondToListeningPath, synthesizeOnboardingQuery, isNonAdvisoryIntent, type SubjectMatch } from '@/lib/intent';
import { attachQuickRecommendation } from '@/lib/quick-recommendation';
import { type ConvState, INITIAL_CONV_STATE, transition as convTransition, detectInitialMode as detectConvMode, interpretSymptom, isSystemDirectedAssessmentTurn } from '@/lib/conversation-state';
import { detectHypotheticalChain, chainToComponentNames, type HypotheticalChain } from '@/lib/hypothetical-system';
// P0 fix: resolveSavedSystemForAdvisory no longer called from page.tsx.
// System resolution now uses turnCtx.activeSystem exclusively (single source of truth).
import { buildGearResponse, dedupeComparisonSubjects } from '@/lib/gear-response';
import { inferSystemDirection } from '@/lib/system-direction';
import {
  routeConversation,
  resolveMode,
  classifyDomain,
  composeDomainPrefix,
  composeOutOfScopeAnswer,
  composeDomainSuffix,
} from '@/lib/conversation-router';
import type { ConversationMode } from '@/lib/conversation-router';
import { buildConsultationResponse, buildComparisonRefinement, buildContextRefinement, classifySubjectAsContext, buildConsultationFollowUp, buildSystemAssessment, buildConsultationEntry, buildCableAdvisory, buildSystemDiagnosis } from '@/lib/consultation';
import { composeAssessmentFollowUp, composeReviewAnchoredAnswer, isReviewDirectedFollowUp } from '@/lib/assessment-followup';
import { REASONING_LANE_ENABLED } from '@/lib/feature-flags';
import SystemBuilder from '@/product/SystemBuilder';
import { track as trackProduct } from '@/product/analytics';
import { ASSESSMENT_ARTIFACT_V2_ENABLED } from '@/lib/feature-flags';
import { classifySystemArchetype, buildConsumerWirelessResponse } from '@/lib/system-class';
import { findReferenceProduct, buildExplorationResponse, explorationToConsultation } from '@/lib/exploration';
import { buildIntakeResponse, intakeToAdvisory } from '@/lib/intake';
import { inferUnknownProduct } from '@/lib/llm-product-inference';
// Validation telemetry + feedback (Workstream 25B — throwaway cohort scaffolding).
import { trackEvent, trackDecisionIntent, initSessionTelemetry } from '@/lib/track-event';
import { collectUnmatchedModels } from '@/lib/unmatched-telemetry';
// A3 hybrid advisor (WS31 — flag-gated, known-system advisory only; default OFF).
import { a3Enabled, a3IsAdvisoryQuestion, runA3Advisor } from '@/lib/a3-advisor';
import { inferProvisionalSystemAssessment } from '@/lib/llm-system-inference';
import { createArtifactSnapshot } from '@/product/create-artifact-snapshot';
import { dossierFor } from '@/lib/evidence/product-dossier';
import { presentDossier, worthRendering } from '@/lib/evidence/dossier-presentation';
import { FRANCE_FACTS, FRANCE_UNKNOWN_BY_PRODUCT, FRANCE_SUPERSEDED_HELD_SPECS } from '@/lib/evidence/france-product-facts';
import {
  NATHAN_FACTS, NATHAN_UNKNOWN_BY_PRODUCT, NATHAN_SUPERSEDED_HELD_SPECS,
} from '@/lib/evidence/nathan-product-facts';
import { resolveObservationKey } from '@/lib/artifact/sonic-synthesis';
import { seedObservations } from '@/lib/evidence/independent-review-seed';

/**
 * Component dossiers for one assessment.
 *
 * Shared by both reasoning paths. The first wiring attached them only to the
 * provisional path, and FRANCE is a catalogued system — so the dossiers were
 * built and never rendered, the same format-specific mistake the artifact
 * actions made a pass earlier.
 */
/**
 * Chain-role labels -> the dossier's role vocabulary.
 *
 * `systemChain.roles` carries display labels ("Streamer", "Speakers"); spec
 * roles are keyed on the engine vocabulary. An unmapped label yields
 * undefined, which leaves a specification's role UNKNOWN rather than guessed —
 * the distinction that closes the power-output collision.
 */
/* One normaliser for the whole product — see `normalizeRole`. This was a
 * second copy, and a second copy of a mapping is a mapping that will disagree
 * with the first one eventually. */
const dossierRole = normalizeRole;


function buildDossierViews(
  components: Array<{ displayName: string; role: string; canonicalName?: string }>,
  manufacturerEvidence: Array<Record<string, unknown>>,
  reviewObservations: Record<string, Array<Record<string, unknown>>> = {},
) {
  return components.map((c) => {
    const key = c.displayName.toLowerCase()
      .replace(/[^\w\s/-]/g, ' ').replace(/\s+/g, ' ').trim();
    /*
     * Authored facts are filed under the CANONICAL product key; the listener
     * writes "ARC ref 5" and "Butler Monads". Without this the dCS facts
     * landed — its display name happens to be canonical — and the ARC and
     * Butler ones silently did not, which reads exactly like "we hold nothing
     * for those" rather than "we filed them under another name".
     *
     * Resolved through the same governed identity table the review evidence
     * uses, so a shorthand either means the exact product on both paths or on
     * neither. Falls back to the display key when nothing is registered.
     */
    const factKey = resolveObservationKey(c.displayName, seedObservations().admitted) ?? key;
    const authoredFacts = [...FRANCE_FACTS, ...NATHAN_FACTS]
      .map((f) => (f.productKey === factKey && factKey !== key ? { ...f, productKey: key } : f));
    const superseded = new Set([
      ...(NATHAN_SUPERSEDED_HELD_SPECS[factKey] ?? []),
      ...(FRANCE_SUPERSEDED_HELD_SPECS[factKey] ?? []),
    ]);
    const heldSpecs = manufacturerEvidence
      .filter((m) => m.productKey === key)
      // A held figure an authored fact corrects is dropped, not shown beside
      // it: the ARC's held frequency response was the SE variant's.
      .filter((m) => !superseded.has(String(m.field)))
      .map((m) => {
        const sourceUrl = (m.attribution as { sourceUrl?: string } | undefined)?.sourceUrl;
        return {
          field: String(m.field), value: String(m.value), sourceUrl,
          // Decided HERE, where the URL is known. `isMakerPublished` is
          // stricter than the admission test on purpose: admission asks
          // whether a document is close enough to the product's own web
          // presence to hold, classification asks whether Audio XX may tell a
          // reader the manufacturer published it. The looser test accepts
          // `arcdb.ws` for an ARC product by substring; the stricter one does
          // not, so the fact is kept and reported as third-party.
          sourceClass: (sourceUrl && isMakerPublished(sourceUrl, c.displayName)
            ? 'maker_published' : 'third_party_reported') as 'maker_published' | 'third_party_reported',
        };
      });
    const view = presentDossier(dossierFor(key, c.displayName, {
      // Two authored sets, one list. Facts are keyed by product, so a system
      // drawing on both is simply a system whose components appear in both.
      authoredFacts, heldSpecs, role: c.role,
      unknowns: FRANCE_UNKNOWN_BY_PRODUCT[key] ?? NATHAN_UNKNOWN_BY_PRODUCT[factKey],
      reviews: (reviewObservations[c.displayName] ?? []) as never,
    }));
    // The ONE place a dossier photograph is attached, so conversation,
    // artifact and PDF all receive it from a single data decision. The
    // resolver is the governed boundary: exact identity, approved provenance,
    // recorded rights. Nothing admissible for this product yields `undefined`,
    // which every surface renders as nothing at all.
    /*
     * The image is resolved against the CORROBORATED identity where one
     * exists, and the listener's words only otherwise.
     *
     * Nathan types "Butler Monads". That string now resolves, under a founder
     * decision of 2026-08-26 recorded in `product-images.ts`: Butler's site
     * has exactly one Monad, so the plural has no sibling it could denote and
     * naming it is identity rather than substitution. The earlier reading here
     * — that the site "lists MONAD and A100 as separate items" — was a
     * misreading of a section link beside a product heading.
     *
     * The precedence is unchanged and still matters: where entity
     * corroboration has INDEPENDENTLY established the canonical designation,
     * that is the identity to resolve against, and no image is admitted that
     * the governed boundary would not admit for the canonical name.
     */
    const admitted = (c.canonicalName && getProductImageEntry(undefined, c.canonicalName))
      || getProductImageEntry(undefined, c.displayName);
    return {
      ...view,
      role: c.role,
      ...(admitted ? { image: { url: admitted.url, credit: admitted.source?.credit } } : {}),
    };
  });
  /*
   * EVERY COMPONENT IN THE GRAPH APPEARS IN YOUR SYSTEM. ALL OF THEM.
   *
   * This ended `.filter(worthRendering)`, which dropped any component Audio XX
   * held little about — so a listener's own equipment could vanish from the
   * section named "Your system". ARC Reference 5 survived only because three
   * facts happened to be held for it; a component with none would simply not
   * be there, and the reader is left to wonder whether Audio XX even saw it.
   *
   * Absence of evidence about a component is INFORMATION, not grounds for
   * hiding the component. The card says so plainly instead.
   */
}
import { snapshotFromCanonical, snapshotFromProvisional } from '@/lib/artifact/snapshot';
import { composeSystemReview } from '@/lib/artifact/system-review';
import { synthesiseChain } from '@/lib/artifact/sonic-synthesis';
import { synthesizeArtifact } from '@/lib/artifact/synthesizeArtifact';
import { normalizeRole } from '@/lib/assessment/authoritative';
import { toCanonicalAssessment } from '@/lib/artifact/canonical';
import type { GlossaryResult } from '@/lib/glossary';
import type { Message, ConversationState } from '@/lib/conversation-types';
import { parseTasteProfile, topTraits, isProfileEmpty, type TasteProfile } from '@/lib/taste-profile';
import { detectChurnSignal } from '@/lib/churn-avoidance';
import { reason } from '@/lib/reasoning';
import type { ReasoningResult } from '@/lib/reasoning';
import { useAudioSession } from '@/lib/audio-session-context';
import { buildTurnContext, type TurnContext } from '@/lib/turn-context';
import { requestLlmOverlay } from '@/lib/memo-llm-overlay';
import { a3CharacterEnabled, generateA3Character, spliceCharacter } from '@/lib/a3-character';
import { a3ArtifactCaseEnabled, generateA3ArtifactCase } from '@/lib/a3-artifact-case';
import { toAdvisorContext } from '@/lib/advisor-context';
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
import LeftRail from '@/components/workspace/LeftRail';
import RightRail from '@/components/workspace/RightRail';
import SystemEditor from '@/components/system/SystemEditor';
import SystemSavePrompt from '@/components/system/SystemSavePrompt';
import type { DraftSystem } from '@/lib/system-types';
import { EDITORIAL } from '@/lib/editorial-tokens';
import ListenerProfileBadge, { buildProfileSnapshot, type ListenerProfileSnapshot } from '@/components/ListenerProfileBadge';

// ── Constants ─────────────────────────────────────────

/** Design tokens — FT-inspired, calm premium palette.
 *  Pass 9: tightened for contrast and a single shared accent.
 *    - textPrimary darkened (was #2B2A28) for stronger primary hierarchy.
 *    - textSecondary darkened (was #7A7570) for clearer secondary contrast.
 *    - cardBg added so product cards lift cleanly off the warm page bg.
 *    - accent unchanged: warm gold #B08D57 is the SINGLE accent across
 *      buttons, key labels (PRIMARY RECOMMENDATION), links and verdict
 *      block. AdvisoryProductCard.tsx mirrors these exact values so the
 *      palette is consistent across components. */
const COLOR = {
  bg: '#F7F9FC',
  cardBg: '#FFFFFF',
  textPrimary: '#111827',
  textSecondary: '#4A5568',
  textMuted: '#64748B',
  accent: '#1F3A5F',
  accentHover: '#2D5C8A',
  accentSubtle: 'rgba(31,58,95,0.08)',
  accentBg: '#EEF2F8',
  border: '#E2E8F0',
  borderLight: '#EDF2F7',
  inputBg: '#FFFFFF',
  chipBg: '#EDF2F7',
  chipBorder: '#CBD5E1',
} as const;

/** Pass 9: layout tokens — wider container, but text and conversation
 *  columns stay readable. Cards live inside CONVERSATION column and breathe
 *  wider than text.
 *
 *  Pass 10 (visual polish): page and conversation columns bumped
 *  moderately so the centered layout feels less tight on wide
 *  displays. `textMax` stays at 720 — the readable measure for prose,
 *  hero, and input must not widen or long lines hurt legibility. */
const LAYOUT = {
  pageMax: 1440,        // outer container — widened for product image prominence
  textMax: 720,         // hero, intro, input — readable measure (unchanged)
  conversationMax: 1280, // conversation thread — cards expand into this for large product images
} as const;

// Local EDITORIAL constant removed 2026-06-30 — homepage now consumes the
// canonical EDITORIAL palette from `@/lib/editorial-tokens` (imported above).
// Token renames applied below:
//   EDITORIAL.paper     → EDITORIAL.paper      (#FCFCFB → #FBFAF6)
//   EDITORIAL.hairline   → EDITORIAL.hairline   (#E5E5E5 → rgba(27,26,24,0.14))
//   EDITORIAL.button → EDITORIAL.ink        (buttons are ink-on-paper)
// Value shifts (intentional, per Design Doctrine v1):
//   ink       #151515 → #1B1A18  (warmer near-black, matches artifact)
//   inkMuted  #3A3A3A → #6B6862  (lighter, more "magazine-airy" body type)
//   faint     #8A8A8A → #9E9A93  (slightly warmer)

/**
 * Pinned fresh-visitor assessment example. Stage 7.1 onboarding-
 * clarity fix: the most-differentiated mode (system-level review)
 * was previously invisible to fresh visitors unless the random
 * chip shuffle happened to surface it — and there was no
 * assessment example in the pool to surface. This is the
 * leben-devore reviewer-benchmark gold case, the same chain the
 * Playwright benchmark validates every commit, so the rendered
 * response a click produces is the same one we already test.
 */
const PINNED_ASSESS_PROMPT = 'Assess my system: Denafrips Pontus II, Leben CS600X, DeVore O/96';

/**
 * Homepage composer placeholder prompts — cycled with a calm typewriter
 * effect (see the useEffect in Home that drives `dynamicPlaceholder`).
 * Order matters: the visitor's first impression is whichever prompt
 * appears first, so the sequence opens with a curious-shopper question
 * and then walks the capability range — brand knowledge, assessment,
 * upgrade direction, budgeted shopping, taste, troubleshooting.
 *
 * Edit guidance: keep each under ~52 characters so it fits inside the
 * editorial column without wrapping. Title-case product names; restore
 * brand capitalization (DeVore, Accuphase). No trailing punctuation
 * except for natural sentence endings.
 */
const HOMEPAGE_PLACEHOLDER_PROMPTS: readonly string[] = [
  // UX-2 (2026-08-12, founder-approved range): the rotation communicates
  // Audio XX's principal capabilities — recommendations, brand knowledge,
  // assessment, upgrades, preferences, troubleshooting. "Why did you
  // recommend that one?" is deliberately withheld pending founder
  // decision: recommendation challenges currently preserve state but do
  // not yet explain the ranking, and the placeholder must not promise a
  // capability the product does not provide.
  'Help me choose a DAC',
  'What do you think of Shindo?',
  'Is my system well balanced?',
  'What would you upgrade first?',
  'I want speakers for around $2,000',
  'I listen mostly to jazz',
  'My system sounds a little bright',
] as const;

/**
 * Primary-CTA composer template. A structured prompt scaffold that
 * shows the visitor exactly what information Audio XX expects — labelled
 * lines for the four component slots — without locking the chain shape:
 * the visitor can delete labels they don't have (active speakers → no
 * amplifier line) or add lines for components they do (preamp, phono,
 * cables). Cursor is placed after "Speakers: " so the visitor starts
 * typing immediately, and tabs/arrows down to the other lines naturally.
 *
 * Intentionally not a real demo system — using one would invite editing
 * our example rather than entering their own gear, which is the wrong
 * signal for the primary CTA.
 */
const ASSESS_TEMPLATE = [
  'Assess my system',
  '',
  'Speakers: ',
  'Amplifier:',
  'DAC / Streamer:',
  'Source:',
].join('\n');

/**
 * Position of the cursor inside ASSESS_TEMPLATE — immediately after
 * "Speakers: " (including its trailing space), so the visitor begins
 * typing in the right place. Derived from the template itself so the
 * two stay in sync.
 */
const ASSESS_TEMPLATE_CURSOR = ASSESS_TEMPLATE.indexOf('Speakers: ') + 'Speakers: '.length;

/**
 * Comparison-mode starter prompts. Slot 2 of the chip row always
 * draws from this subpool so every fresh visitor sees one comparison
 * example. Selection is session-stable.
 *
 * Stage PB2.1 (preference-first refresh): comparison prompts were
 * rephrased to lead with trade-off framing ("what's the real
 * trade-off between …") rather than a bare versus comparison. The
 * point of comparison in this advisor is not to declare a winner but
 * to surface what each option costs and what it buys — and the chip
 * copy should signal that intent before the user submits.
 */
const COMPARE_PROMPTS: ReadonlyArray<string> = [
  "what's the real trade-off between Bifrost 2/64 and Qutest?",
  "what's the real trade-off between Chord and Denafrips?",
];

/**
 * Variety starter prompts. Slot 3 of the chip row draws from this
 * subpool so the third chip rotates session-stably across the
 * remaining advisor modes.
 *
 * Stage PB1.1 (positioning refresh) rebalanced the pool away from
 * generic shopping framing ("best DAC under $1500", "I want more flow
 * without losing detail") toward diagnostic "why" questions, explicit
 * trade-off reasoning, and the change-vs-restraint question.
 *
 * Stage PB2.1 (preference-first refresh) takes the same direction
 * further. The prompts now centre on what the listener values, on
 * whether a contemplated change would actually improve the system,
 * and on whether the user is solving the right problem at all.
 * Restraint ("should I change anything at all?") is given equal
 * weight with change. The diagnostic "why does my system sound
 * fatiguing?" prompt is preserved verbatim because it remains the
 * cleanest entry point into the system-fit framing.
 */
// Workstream 25B: the variety pool now explicitly covers the six
// decision types the validation cohort must be able to initiate
// (buy / upgrade / alternative / compatibility / avoid / keep), so a
// first-time visitor self-selects into a real decision rather than
// general browsing. All six render as example chips on the landing
// surface (the assess anchor + a compare example sit alongside).
const VARIETY_PROMPTS: ReadonlyArray<string> = [
  'Should I buy a used Rega Planar 3?',                          // buy
  'What should I upgrade first in my system?',                   // upgrade
  'What is a more affordable alternative to the Chord Qutest?',  // alternative
  'Is a Leben CS600X a good match for DeVore O/96?',             // compatibility
  'What should I avoid for a small, untreated room?',            // avoid
  'Should I change anything at all?',                            // keep
];

/**
 * Combined pool used by the existing post-mount Fisher–Yates shuffle.
 * The chip renderer partitions the shuffled order by membership in
 * COMPARE_PROMPTS vs VARIETY_PROMPTS so slot 2 always gets a compare
 * example and slot 3 always gets a variety example — without forcing
 * the renderer to keep two separate shuffled lists.
 */
const CURATED_STARTER_PROMPTS: ReadonlyArray<string> = [
  ...COMPARE_PROMPTS,
  ...VARIETY_PROMPTS,
];

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
  | { type: 'ADD_USER_MESSAGE'; images?: string[] }
  | { type: 'ADD_QUESTION'; clarification: ClarificationResponse }
  | { type: 'ADD_GLOSSARY'; entry: GlossaryResult }
  | { type: 'ADD_ADVISORY'; advisory: AdvisoryResponse; id?: string }
  | { type: 'UPDATE_ADVISORY'; id: string; advisory: AdvisoryResponse }
  | { type: 'SET_ARTIFACT_TOKEN'; id: string; viewToken: string }
  | { type: 'ADD_NOTE'; content: string }
  | { type: 'SET_MODE'; mode: ConversationMode }
  | { type: 'SET_REASONING'; reasoning: ReasoningResult }
  | { type: 'SET_COMPARISON'; left: SubjectMatch; right: SubjectMatch; scope: 'brand' | 'product'; sourceReferences?: import('@/lib/advisory-response').SourceReference[]; links?: import('@/lib/advisory-response').AdvisoryLink[] }
  | { type: 'CLEAR_COMPARISON' }
  | { type: 'SET_CONSULTATION_CONTEXT'; subjects: SubjectMatch[]; originalQuery: string }
  | { type: 'CLEAR_CONSULTATION_CONTEXT' }
  | { type: 'SET_LOADING'; value: boolean }
  | { type: 'UPDATE_LISTENER_PROFILE'; signals: ListenerPreferenceSignal[] }
  | { type: 'RESET' };

const initialState: ConversationState = {
  messages: [],
  currentInput: '',
  turnCount: 0,
  isLoading: false,
  listenerPreferenceProfile: createDefaultListenerPreferenceProfile(),
};

function reducer(state: ConversationState, action: Action): ConversationState {
  switch (action.type) {
    case 'SET_INPUT':
      return { ...state, currentInput: action.value };

    case 'ADD_USER_MESSAGE':
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            role: 'user',
            content: state.currentInput,
            ...(action.images && action.images.length > 0
              ? { images: action.images }
              : {}),
          },
        ],
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
            ? {
              ...m,
              advisory: {
                ...action.advisory,
                // The artifact capability belongs to the MESSAGE, not to the
                // advisory payload being recomputed. Without this, whichever
                // of two async writes landed second won: the catalog path
                // splices a character line into `systemContext` after
                // dispatch, and that update — built from the ORIGINAL
                // advisory object — silently dropped the token the snapshot
                // had just attached. On production the snapshot was created,
                // the token returned, and the actions never appeared.
                artifactViewToken:
                  action.advisory.artifactViewToken ?? m.advisory.artifactViewToken,
                artifactShareToken:
                  action.advisory.artifactShareToken ?? m.advisory.artifactShareToken,
              },
            }
            : m,
        ),
      };

    // Attach the artifact capability to an assessment already on screen.
    // A separate action from UPDATE_ADVISORY so freezing can never rewrite the
    // assessment the listener is reading — it only adds the way to open it.
    case 'SET_ARTIFACT_TOKEN':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.role === 'assistant' && m.kind === 'advisory' && 'id' in m && m.id === action.id
            ? { ...m, advisory: { ...m.advisory, artifactViewToken: action.viewToken } }
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
        activeComparison: {
          left: action.left,
          right: action.right,
          scope: action.scope,
          sourceReferences: action.sourceReferences,
          links: action.links,
        },
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

    case 'UPDATE_LISTENER_PROFILE': {
      if (!action.signals.length) return state;
      const base = state.listenerPreferenceProfile
        ?? createDefaultListenerPreferenceProfile();
      return {
        ...state,
        listenerPreferenceProfile: applyListenerPreferenceSignals(base, action.signals),
      };
    }

    case 'RESET':
      return {
        ...initialState,
        // Fresh default profile on RESET — each conversation starts blank.
        listenerPreferenceProfile: createDefaultListenerPreferenceProfile(),
      };

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

  // Funnel (M5): the landing was seen. Deduped per page load.
  useEffect(() => { trackProduct('landing_viewed'); }, []);

  // ── System panel/editor UI state (local, not in context) ──
  const [systemPanelOpen, setSystemPanelOpen] = useState(false);
  const [systemEditorOpen, setSystemEditorOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState(false);
  // ── Toast state for system switch/save feedback ──
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Prefill data for editor when opening from a proposed system. */
  const [editorPrefill, setEditorPrefill] = useState<DraftSystem | null>(null);
  /** Fingerprints of dismissed proposals — prevents re-prompting same system. */
  const dismissedFingerprintsRef = useRef(new Set<string>());
  /** When true, bypasses consultation confidence gating and produces exploratory suggestions. */
  const skipToSuggestionsRef = useRef(false);
  /** Set after an intake form has been shown — forces next intake-classified message to shopping. */
  const intakeShownRef = useRef(false);
  /** Tracks which consumer-wireless system fingerprints we've already greeted with the short intro. */
  const consumerWirelessIntroShownRef = useRef<Set<string>>(new Set());
  /** Counts submit-handler entries, so a duplicate run is visible as #1 and #2. */
  const submitSeqRef = useRef(0);
  /** Conversation state machine — tracks the first 2–4 turns with explicit transitions. */
  const convStateRef = useRef<ConvState>(INITIAL_CONV_STATE);
  /** Set after the music-input first question is asked — next message is interpreted as the listening-path answer. */
  const awaitingListeningPathRef = useRef(false);
  /**
   * Governed reasoning lane state (Substrate Doctrine, flag-gated).
   * The LAST rendered chain and the one-slot hypothetical — written where the
   * canonical snapshot is written, read only when REASONING_LANE_ENABLED.
   * This is deliberately ALL the conversational state the lane keeps.
   */
  const laneStateRef = useRef<{
    components: Array<{ displayName: string; role: string }>;
    hypothetical: { candidate: string; incumbent: string } | null;
  } | null>(null);
  /** Founder-cohort eligibility, decided SERVER-side (REASONING_LANE_USERS).
   *  Fetched once; false until the server says otherwise. The build-time
   *  flag remains the local-QA switch; this is the production cohort path. */
  const laneEligibleRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/reasoning-lane', { method: 'GET' })
      .then((r) => (r.ok ? r.json() : { eligible: false }))
      .then((j) => { if (!cancelled) laneEligibleRef.current = j?.eligible === true; })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const laneActive = () => REASONING_LANE_ENABLED || laneEligibleRef.current;

  /** Tracks accumulated onboarding context across the music → path → follow-up sequence. */
  const onboardingContextRef = useRef<{
    musicDescription: string;
    listeningPath: 'headphones' | 'speakers' | 'unknown';
  } | null>(null);
  /** Tracks chip-initiated intent — persists across turns so follow-ups stay in the correct lane. */
  const chipIntentRef = useRef<'shopping' | 'improvement' | 'diagnosis' | 'comparison' | null>(null);

  /** Show a brief toast notification (auto-dismisses after 2.5s). */
  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 2500);
  }, []);

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
    /** Phase K — sticky domain mirror. Set whenever a non-general
     *  category appears in any turn (shopping or diagnosis), so a
     *  follow-up like "it's noisy" after "recommend a turntable"
     *  retains turntable as the active domain. */
    domainContext?: import('@/lib/shopping-intent').ShoppingCategory;
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

  // ── Hypothetical chain: user-defined temporary system for the thread ──
  // When the user names a specific chain that differs from the saved system
  // ("what do you think of the kinki integrated with denafrips dac?"), the
  // saved system MUST NOT drive recommendation logic while that thread is
  // active. The saved system may still be visible in the UI. Lifetime: the
  // thread — cleared on full reset (same conditions that clear the
  // category lock and saved shopping facts).
  //
  // Populated incrementally: each turn's detectHypotheticalChain merges
  // newly-named components into the slot map. Explicit category change
  // does NOT clear it — the user is often switching the slot they're
  // asking about ("and for speakers, with kinki and terminator"), not
  // walking away from the chain.
  //
  // See: hypothetical-system.ts, Pass 15.
  const hypotheticalChainRef = useRef<HypotheticalChain | null>(null);

  // ── Selection mode: previous anchor + recent products for anti-repetition ──
  const lastAnchorRef = useRef<PreviousAnchor | null>(null);
  const recentShoppingProductsRef = useRef<string[]>([]);

  // ── Pending clarification (Mission 4, 2026-08-10) ──────────────
  // When the advisor asks a question that requests specific information
  // (the system-components ask, the churn reflective question), the next
  // user turn is an ANSWER to it. Without this state, the answer re-entered
  // the pipeline cold: "amp is a feliks audio envy, …" after "What
  // components are in your system?" was classified as a fresh diagnosis
  // entry and produced "let's figure out what's going on with your
  // amplifier" — an invented problem. The consuming side reunites the
  // answer with the original request so extraction and routing see the
  // whole exchange (verified: the reunited text routes to
  // system_assessment where the answer alone routes to gear_inquiry).
  const pendingClarificationRef = useRef<{
    kind: 'system_components' | 'churn_reflection';
    originalRequest: string;
  } | null>(null);
  // What THIS turn consumed (kind + the state turnCount at consume time).
  // Read by the assessment-clarification dispatch to cap re-asks: if the
  // user already answered a components ask this cycle and a component is
  // STILL unresolved, asking the same question again loops — proceed
  // provisionally instead.
  const consumedClarificationRef = useRef<{
    kind: 'system_components' | 'churn_reflection';
    atTurn: number;
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Homepage composer typewriter — cycles through
  // HOMEPAGE_PLACEHOLDER_PROMPTS, typing each one character at a time,
  // holding, backspacing, and moving on. Active only on the homepage
  // (`!hasMessages`) AND only while the composer is empty. Respects
  // `prefers-reduced-motion: reduce` by showing the first prompt as a
  // static placeholder instead of animating.
  const [dynamicPlaceholder, setDynamicPlaceholder] = useState('');

  // Listing-evaluation MVP — uploaded photo(s) of a used listing that the
  // user wants Audio XX to read for them. When pendingImages is non-empty,
  // handleSubmit routes the turn through /api/listing-eval instead of the
  // normal advisory pipeline. Limits enforced client-side: ≤ 3 images,
  // ≤ 4 MB each, JPEG/PNG/WebP only.
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  // Listener profile snapshot — read-only UI display of inferred preferences.
  // Updated after each turn when the profile changes.
  const [profileSnapshot, setProfileSnapshot] = useState<ListenerProfileSnapshot | null>(null);

  // Session-stable starter prompts — SSR-safe.
  //
  // Hydration-fix 2026-05-14: previously this was a `useMemo([])` that
  // called `Math.random()` during the first render. That runs once on
  // the server (one shuffle) and once on the client during hydration
  // (a different shuffle), so the first chip's text diverged and React
  // logged a hydration-mismatch error on every page load (see the
  // reviewer-benchmark transcripts).
  //
  // Fix: render the curated order verbatim on the server and on the
  // client's first paint (identical HTML, no mismatch). After mount,
  // the effect below shuffles once for session variety. Chips remain
  // session-stable after that single client-side shuffle — no interval,
  // no continuous rotation.
  const [sessionStarterPrompts, setSessionStarterPrompts] =
    useState<ReadonlyArray<string>>(CURATED_STARTER_PROMPTS);
  useEffect(() => {
    const pool = [...CURATED_STARTER_PROMPTS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setSessionStarterPrompts(pool);
  }, []);

  // Composer placeholder typewriter — types each prompt one character
  // at a time, holds, backspaces, advances. Only runs on the homepage
  // and only while the composer is empty (so the visitor's own text
  // never competes with the animation).
  //
  // Implementation note: this uses refs for animation state +
  // requestAnimationFrame for the driver loop instead of chained
  // setTimeouts, which proved fragile across React StrictMode's
  // double-invocation in dev. The rAF loop is naturally single-shot
  // per effect mount and survives placeholder-state re-renders
  // without the closure dance that chained setTimeouts require.
  useEffect(() => {
    const hasMessages = state.messages.length > 0;
    const composerEmpty = state.currentInput.trim().length === 0;

    if (hasMessages || !composerEmpty) {
      setDynamicPlaceholder('');
      return;
    }
    if (
      typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setDynamicPlaceholder(HOMEPAGE_PLACEHOLDER_PROMPTS[0]);
      return;
    }

    let cancelled = false;
    let promptIdx = 0;
    let charIdx = 0;
    type Phase = 'type' | 'hold' | 'delete' | 'gap';
    let phase: Phase = 'type';
    let nextActionAt = performance.now() + 1200; // initial read pause
    let rafId = 0;

    const TYPE_MS = 80;       // calm typing rhythm
    const HOLD_MS = 1900;     // sit on the full prompt before deleting
    const DELETE_MS = 32;     // backspace speed
    const GAP_MS = 480;       // breath between prompts

    const driver = (now: number) => {
      if (cancelled) return;
      if (now >= nextActionAt) {
        const prompt = HOMEPAGE_PLACEHOLDER_PROMPTS[promptIdx];
        if (phase === 'type') {
          charIdx += 1;
          setDynamicPlaceholder(prompt.slice(0, charIdx));
          if (charIdx >= prompt.length) {
            phase = 'hold';
            nextActionAt = now + HOLD_MS;
          } else {
            nextActionAt = now + TYPE_MS;
          }
        } else if (phase === 'hold') {
          phase = 'delete';
          nextActionAt = now;
        } else if (phase === 'delete') {
          charIdx -= 1;
          setDynamicPlaceholder(prompt.slice(0, charIdx));
          if (charIdx <= 0) {
            phase = 'gap';
            nextActionAt = now + GAP_MS;
          } else {
            nextActionAt = now + DELETE_MS;
          }
        } else {
          promptIdx = (promptIdx + 1) % HOMEPAGE_PLACEHOLDER_PROMPTS.length;
          charIdx = 0;
          phase = 'type';
          nextActionAt = now;
        }
      }
      rafId = window.requestAnimationFrame(driver);
    };

    rafId = window.requestAnimationFrame(driver);

    return () => {
      cancelled = true;
      if (rafId) window.cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.messages.length > 0, state.currentInput.trim().length === 0]);

  // Hand-off from the artifact follow-up surface. When the user submits
  // a question on /artifact, FollowUp.tsx writes the question to
  // sessionStorage under `axx_followup_q` and navigates here. Read it
  // once on mount, seed the composer, and clear the key so the question
  // doesn't repopulate on a later visit.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const handoff = window.sessionStorage.getItem('axx_followup_q');
      if (handoff) {
        dispatch({ type: 'SET_INPUT', value: handoff });
        window.sessionStorage.removeItem('axx_followup_q');
      }
    } catch {
      /* private mode / quota — nothing to do */
    }
  }, []);

  // Cover composer auto-grow (Mike, 2026-07-16 prod review): the
  // manuscript field sizes itself to its content — the signed-in
  // system autofill spans several lines and was clipping at the fixed
  // height once the resize grip was removed. Conversation state keeps
  // its compact fixed composer.
  useEffect(() => {
    if (state.messages.length > 0) return;
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.max(148, ta.scrollHeight)}px`;
  }, [state.currentInput, state.messages.length]);

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



  // UX-1 (2026-08-12): position the viewport at the BEGINNING of the
  // newest message when messages change. The previous chat-style
  // scroll-to-bottom put the END of a long assessment in view — the
  // founder-observed failure: a ~2,900px result rendered with its
  // heading 2,600px above the viewport, forcing an upward scroll to
  // find where the answer starts. Scrolling the newest message's top
  // into view handles both cases with one rule: short conversational
  // turns remain fully visible; long results open at their heading.
  // The effect fires once per messages transition and never re-runs on
  // loading/typing state, so it cannot fight manual scrolling.
  useEffect(() => {
    const position = () => {
      const anchors = document.querySelectorAll('[data-msg-anchor]');
      const newest = anchors[anchors.length - 1];
      if (newest) newest.scrollIntoView({ behavior: 'auto', block: 'start' });
    };
    // Instant positioning: smooth animations raced progressive layout
    // (consecutive user+assistant message transitions) and landed short.
    position();
    // One settle re-assert absorbs late layout from the same transition
    // (fonts/images inside the new message). This is part of the single
    // transition, not continuous viewport control — nothing re-runs
    // until the NEXT messages change.
    const settle = setTimeout(position, 250);
    return () => clearTimeout(settle);
  }, [messages]);

  // Focus textarea after assistant message
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      // preventScroll (UX-1): plain focus() scrolls the composer into
      // view, yanking the viewport away from the reading position the
      // messages effect just established.
      textareaRef.current?.focus({ preventScroll: true });
    }
  }, [isLoading, messages.length]);

  // ── Listing-evaluation upload helpers ──────────────────
  // Convert a File to a base64 data URL the listing-eval API can pass
  // straight to the vision model. Stays client-side; no temporary upload.
  const fileToDataUrl = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error('read failed'));
      reader.readAsDataURL(file);
    });
  }, []);

  // Shared acceptance path for attached AND pasted images (GTM Bug 2,
  // 2026-07-05). Validation, limits, and preview state are identical
  // regardless of how the image arrived.
  const addImageFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      const maxBytes = 4 * 1024 * 1024;
      const maxImages = 3;

      const remaining = maxImages - pendingImages.length;
      if (remaining <= 0) {
        setImageUploadError(`Up to ${maxImages} images per evaluation.`);
        return;
      }

      const accepted: string[] = [];
      let firstError: string | null = null;
      for (const file of files.slice(0, remaining)) {
        if (!allowed.includes(file.type)) {
          firstError ??= 'Only JPEG, PNG, or WebP images are supported.';
          continue;
        }
        if (file.size > maxBytes) {
          firstError ??= 'Each image must be 4 MB or smaller.';
          continue;
        }
        try {
          accepted.push(await fileToDataUrl(file));
        } catch {
          firstError ??= 'Could not read one of the selected images.';
        }
      }

      if (files.length > remaining) {
        firstError ??= `Only the first ${remaining} image${remaining === 1 ? '' : 's'} added — limit is ${maxImages}.`;
      }

      if (accepted.length > 0) {
        setPendingImages((prev) => [...prev, ...accepted].slice(0, maxImages));
      }
      setImageUploadError(firstError);
    },
    [pendingImages.length, fileToDataUrl],
  );

  const handleImageSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = ''; // allow re-selecting the same file later
      await addImageFiles(files);
    },
    [addImageFiles],
  );

  // Paste-to-attach (GTM Bug 2). Screenshots and copied images pasted
  // into the composer enter the exact same pipeline as the paperclip.
  // Text paste is untouched: default insertion is suppressed only when
  // the clipboard carries no text at all (a pure image paste would
  // otherwise insert nothing or a filename).
  const handleComposerPaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const files = items
        .filter((i) => i.kind === 'file' && i.type.startsWith('image/'))
        .map((i) => i.getAsFile())
        .filter((f): f is File => f !== null);
      if (files.length === 0) return; // plain text paste — browser default
      const pastedText = e.clipboardData.getData('text/plain');
      if (!pastedText) e.preventDefault();
      void addImageFiles(files);
    },
    [addImageFiles],
  );

  const removePendingImage = useCallback((index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
    setImageUploadError(null);
  }, []);

  // Validation telemetry (Workstream 25B): record return visits once on mount.
  useEffect(() => {
    initSessionTelemetry();
  }, []);

  /**
   * Editorial cover autofill — REMOVED (founder request, 2026-07-31).
   *
   * The composer previously pre-populated with the active saved
   * system's components mapped into the labelled assessment template.
   * The founder asked for the box to open intentionally empty (the
   * cycling placeholder carries the affordance); the panel itself and
   * its dimensions are unchanged.
   *
   * TODO(phase-2): this region is reserved for future contextual
   * sponsorship, partner messages, underwriting, or other editorial
   * modules. Any future occupant replaces the removed autofill, not
   * the composer itself.
   *
   * The pure helpers (`populateAssessTemplate` in lib/cta-template.ts)
   * are kept — they remain unit-tested and available if a deliberate
   * user-initiated "use my saved system" affordance returns.
   */

  const handleSubmit = useCallback(async (overrideText?: string, options?: { source?: 'follow-up' | 'fresh' }) => {
    // Latency waterfall + duplicate-work detection. `console.warn` survives the
    // production bundle where `console.log` does not, and these numbers are
    // only meaningful measured in the browser the listener actually uses.
    const T0 = performance.now();
    const mark = (label: string) =>
      console.warn('[assess] %s +%dms', label, Math.round(performance.now() - T0));
    mark(`submit#${++submitSeqRef.current} source=${options?.source ?? 'fresh'}`);
    const inputText = overrideText ?? currentInput;
    const hasPendingImagesForTurn = !overrideText && pendingImages.length > 0;
    if (!inputText.trim() && !hasPendingImagesForTurn) return;
    if (isLoading) return;

    // If override was provided, set the input first so ADD_USER_MESSAGE captures it
    if (overrideText) {
      dispatch({ type: 'SET_INPUT', value: overrideText });
    }

    let submittedText = inputText;
    const isFollowUp = options?.source === 'follow-up';

    // ── Consume pending clarification ─────────────────────────────
    // If the previous assistant turn asked for specific information, this
    // turn answers it. Reunite the answer with the original request so the
    // pipeline reasons over the whole exchange instead of re-entering cold.
    // Guard: if the user ignored the question and pivoted to a standalone
    // request (shopping, comparison, an assessment of something else…),
    // honour the pivot — reuniting would contaminate it with the stale ask.
    if (pendingClarificationRef.current && !hasPendingImagesForTurn) {
      const pending = pendingClarificationRef.current;
      pendingClarificationRef.current = null;
      const STANDALONE_PIVOT_INTENTS = new Set([
        'shopping', 'comparison', 'product_assessment', 'system_assessment',
        'intake', 'music_input', 'greeting', 'educational',
        'preference_reflection', 'audio_assistant',
      ]);
      const rawIntent = detectIntent(inputText).intent;
      if (!STANDALONE_PIVOT_INTENTS.has(rawIntent)) {
        submittedText = `${inputText}. ${pending.originalRequest}`;
        consumedClarificationRef.current = { kind: pending.kind, atTurn: turnCount };
        console.log('[pending-clarification] reunited answer with original request (kind=%s): "%s"',
          pending.kind, submittedText.slice(0, 100));
      } else {
        console.log('[pending-clarification] user pivoted (intent=%s) — pending %s cleared without reunite',
          rawIntent, pending.kind);
      }
    }

    // Funnel (M5): the conversational path was chosen. Deduped per load.
    if (!isFollowUp) trackProduct('composer_started');
    // Funnel (pre-beta item 5): unified submit event across both entry
    // lanes; the builder lane fires its own in SystemBuilder.submit.
    if (!isFollowUp) trackProduct('assessment_submitted', { source: 'composer' });

    // Validation telemetry (Workstream 25B): a user-submitted query is a
    // decision-intent entry. trackDecisionIntent also emits
    // return_visit_new_decision when appropriate.
    trackDecisionIntent({ source: options?.source ?? 'fresh', followUp: isFollowUp });

    // ── A3 hybrid advisor (WS31, flag-gated, known-system advisory only) ──
    // When enabled AND a system is known AND the message is advisory, try the
    // guarded LLM-led advisor first. It returns null on any validation failure
    // or LLM unavailability, in which case we fall through to the existing
    // engine below (the default + fallback). Scope: known-system advisory
    // questions only — shopping/discovery/cold-start are untouched.
    /*
     * FOLLOW-UP NET — ABOVE the A3 advisor (Nathan beta, 2026-08-28). The
     * experimental A3 branch was consuming review-directed questions before
     * any user bubble rendered, and an uncaught rejection there ate the
     * turn entirely. While a governed system review stands, a judgment
     * question about it is answered FROM that review — deterministic,
     * licensed, and ahead of any model advisor. Genuine shopping
     * transitions are excluded by the predicate.
     */
    {
      const standingReviewEarly = convStateRef.current.facts.lastSystemReview ?? [];
      // With the governed lane on and armed, the review-anchored net stands
      // down: the lane answers direction questions from the same review
      // evidence WITH reasoning, instead of quoting paragraphs (preview
      // battery: the net intercepted "Should I replace the Rossini…" before
      // the lane could reason about it).
      const laneWillOwnTurn = laneActive()
        && convStateRef.current.mode === 'system_assessment'
        && (laneStateRef.current?.components.length ?? 0) >= 2;
      if (!laneWillOwnTurn && standingReviewEarly.length > 0 && isReviewDirectedFollowUp(submittedText)) {
        const anchoredEarly = composeReviewAnchoredAnswer(submittedText, standingReviewEarly);
        if (anchoredEarly) {
          dispatch({ type: 'ADD_USER_MESSAGE' });
          dispatch({ type: 'ADD_NOTE', content: anchoredEarly });
          dispatch({ type: 'SET_INPUT', value: '' });
          dispatch({ type: 'SET_LOADING', value: false });
          return;
        }
      }
    }

    if (a3Enabled() && !hasPendingImagesForTurn && a3IsAdvisoryQuestion(submittedText)) {
      const a3Ctx = buildTurnContext(
        submittedText,
        audioState,
        dismissedFingerprintsRef.current,
        state.listenerPreferenceProfile,
      );
      if (a3Ctx.activeSystem && a3Ctx.activeSystem.components.length > 0) {
        dispatch({ type: 'SET_LOADING', value: true });
        let a3: Awaited<ReturnType<typeof runA3Advisor>> = null;
        try {
          a3 = await runA3Advisor({ question: submittedText, activeSystem: a3Ctx.activeSystem });
        } catch {
          // An advisor failure must never eat the listener's turn — fall
          // through to the engine exactly like a declined answer.
          a3 = null;
        }
        if (a3) {
          dispatch({ type: 'ADD_USER_MESSAGE' });
          dispatch({ type: 'ADD_NOTE', content: a3.answer });
          dispatch({ type: 'SET_INPUT', value: '' });
          dispatch({ type: 'SET_LOADING', value: false });
          trackEvent('a3_advisory', { status: a3.status });
          return;
        }
        // A3 declined → fall back to the existing engine. Reset loading and do
        // NOT add the user message here (the engine path adds it) to avoid a
        // duplicate user turn.
        dispatch({ type: 'SET_LOADING', value: false });
        trackEvent('a3_advisory', { status: 'fallback' });
      }
    }

    // ── Listing-evaluation branch ─────────────────────────
    // If the user attached photos, this turn is a used-listing read —
    // route to the dedicated vision endpoint instead of the normal
    // advisory pipeline. Saved-system context (if any) is shared so the
    // "Fit with your system" section has something to reason against.
    if (hasPendingImagesForTurn) {
      const imagesForTurn = pendingImages;
      dispatch({ type: 'ADD_USER_MESSAGE', images: imagesForTurn });
      dispatch({ type: 'SET_LOADING', value: true });
      setPendingImages([]);
      setImageUploadError(null);

      const turnCtxForListing = buildTurnContext(
        submittedText || 'Evaluate the attached listing.',
        audioState,
        dismissedFingerprintsRef.current,
        state.listenerPreferenceProfile,
      );
      const systemContext = turnCtxForListing.activeSystem
        ? {
            components: turnCtxForListing.activeSystem.components.map((c) =>
              c.name.toLowerCase().startsWith(c.brand.toLowerCase())
                ? c.name
                : `${c.brand} ${c.name}`,
            ),
            character: turnCtxForListing.activeSystem.tendencies ?? undefined,
          }
        : undefined;
      const listenerPreferences = state.listenerPreferenceProfile
        ? renderListenerPreferenceSummary(state.listenerPreferenceProfile)
        : undefined;

      try {
        const res = await fetch('/api/listing-eval', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: submittedText,
            images: imagesForTurn,
            systemContext,
            listenerPreferences,
          }),
        });
        if (res.status === 503) {
          dispatch({
            type: 'ADD_NOTE',
            content:
              'Listing evaluation is not configured on this build. Please try again from a deployment with an OpenAI key set.',
          });
        } else if (!res.ok) {
          dispatch({
            type: 'ADD_NOTE',
            content:
              'Something went wrong reading that listing. Try again with a clearer photo, or describe the listing in words.',
          });
        } else {
          const data = await res.json();
          const content = typeof data?.content === 'string' ? data.content : '';
          dispatch({
            type: 'ADD_NOTE',
            content:
              content.trim().length > 0
                ? content
                : 'I could not produce a reading for that listing. Try a clearer photo or include the seller text.',
          });
        }
      } catch (err) {
        console.error('[listing-eval] client error:', err);
        dispatch({
          type: 'ADD_NOTE',
          content:
            'The listing read could not be completed (network error). Please try again.',
        });
      } finally {
        dispatch({ type: 'SET_LOADING', value: false });
      }
      return;
    }

    dispatch({ type: 'ADD_USER_MESSAGE' });
    dispatch({ type: 'SET_LOADING', value: true });

    // ── Stage PB2.3 — accumulate listener preference profile ──
    // Extract phrase-level preference signals once per user turn and
    // fold them onto the profile already held in conversation state.
    // The same signals are passed to buildTurnContext(...) below via
    // state.listenerPreferenceProfile, so the per-turn TurnContext sees
    // the same accumulated lean we surface in the visibility panel.
    const turnPreferenceSignals = extractListenerPreferenceSignals(submittedText);
    if (turnPreferenceSignals.length > 0) {
      dispatch({ type: 'UPDATE_LISTENER_PROFILE', signals: turnPreferenceSignals });
    }

    // Check for glossary questions first — no API call needed.
    // Skip when the submission originated from a clicked follow-up CTA:
    // advisor-emitted follow-ups are conversational, not definitional, so
    // the glossary gate would only ever produce a false positive for them.
    if (!isFollowUp) {
      const glossaryResult = checkGlossaryQuestion(submittedText);
      if (glossaryResult) {
        dispatch({ type: 'ADD_GLOSSARY', entry: glossaryResult });
        dispatch({ type: 'SET_LOADING', value: false });
        return;
      }
    }

    // ── Beta intent intercepts (Step 3 of 9 — beta path) ──────────────
    // Three high-frequency real-enthusiast prompt classes that the main
    // pipeline misroutes today:
    //   • sequencing ("DAC or speakers first?") → comparison thinks the
    //     user wants a head-to-head and asks which two components.
    //   • room context ("small reflective room — what should I avoid?")
    //     → has no dedicated route; falls into generic recommendations.
    //   • vague preference ("musical and engaging") → shallow generic
    //     clarification.
    // Each rule produces a hedged operational response so the user
    // gets a useful answer instead of a misroute. Skipped on
    // follow-ups so the routes do not interrupt mid-conversation
    // refinements.
    if (!isFollowUp) {
      // Cheap pre-pipeline subject count — extractSubjectMatches is the
      // same pure function the main pipeline uses below.
      const earlySubjectCount = extractSubjectMatches(submittedText).length;
      const betaIntercept = tryBetaInterceptRouting(submittedText, earlySubjectCount);
      if (betaIntercept) {
        console.log('[beta-intercept] %s rule fired', betaIntercept.kind);
        dispatch({ type: 'ADD_QUESTION', clarification: betaIntercept.clarification });
        dispatch({ type: 'SET_LOADING', value: false });
        return;
      }
    }

    // Phase 5 resilience: guarantee SET_LOADING:false no matter how the
    // pipeline exits. The many inner SET_LOADING:false dispatches remain
    // (they keep the existing behaviour for clean exits); this `finally`
    // is the safety net that prevents the UI from ever being stuck at
    // "Thinking…" if an unexpected throw/hang slips past them.
    /* Some lanes finish asynchronously: they post a placeholder, fire an LLM
     * call, and clear the loading state when it resolves. The `finally` below
     * used to clear it the moment those lanes RETURNED — which is immediately,
     * since the call is not awaited. The result was a turn that announced
     * itself complete while showing only "Thinking about kef…": measured at
     * +405 ms the placeholder is on screen and the Send button already reads
     * "Send"; real prose lands ~5–9 s later. It looked broken for the whole
     * window, on essentially all non-catalog traffic.
     *
     * A lane sets this once its promise chain is attached, taking ownership of
     * the teardown. It is set AFTER the chain is attached, so a synchronous
     * throw inside the lane still falls through to the safety net below. */
    let asyncLaneOwnsLoading = false;
    try {
    // ── Conversation state machine routing ──────────────
    // When the state machine is active (mode !== 'idle'), route through
    // transition() before the legacy ref-based blocks below.
    let convModeHint: ConversationMode | undefined;
    let intent: string = '';
    // Assessment follow-up continuity (launch, 2026-07-19): the state
    // machine's ready_to_assess override runs BEFORE the main detectIntent
    // call, which would clobber it (a direction question classifies as
    // audio_knowledge). This flag re-applies the override after detection
    // for exactly the armed continuity turn.
    let assessmentFollowUpOverride = false;
    // P1 follow-on (2026-05-18): capture detectIntent's subjectMatches
    // alongside intent so the synthesized subjectMatch for unknown
    // products (gate 0a in intent.ts) survives into the safety-check
    // fallback. turnCtx.subjectMatches is built independently via
    // extractSubjectMatches and returns [] for non-catalogued products,
    // so without this fallback the safety-check sees no subject and
    // defaults productName to "that product" — breaking the hedged
    // clarification text and disabling Explore links.
    let intentSyntheticSubjects: SubjectMatch[] = [];

    // ── Category switch bypass ──────────────────────────
    // When the user sends a bare category request (e.g. "tube amp", "dac",
    // "speakers") during an active state machine session, reset to idle so
    // the message flows through the normal shopping pipeline. Without this,
    // the state machine intercepts the message and asks for budget/category
    // clarification instead of immediately switching to the new category.
    if (convStateRef.current.mode !== 'idle') {
      const shoppingAnswerCount = messages.filter(
        (m) => m.role === 'assistant' && m.kind === 'advisory' && m.advisory.kind === 'shopping',
      ).length;
      if (shoppingAnswerCount > 0) {
        const bareCategorySwitch = detectExplicitCategorySwitch(submittedText);
        if (bareCategorySwitch) {
          console.log('[category-switch-bypass] resetting convState to idle for bare category switch: %s', bareCategorySwitch);
          convStateRef.current = INITIAL_CONV_STATE;
        }
      }
      // Block A2 — global continuation-state pivot guard.
      // Even before a shopping turn lands (e.g. when the state machine is
      // mid-diagnosis or mid-system-assessment), an explicit category pivot
      // like "i'm thinking about a turntable" must reset the state machine
      // so the message reaches the standard pipeline instead of being
      // absorbed as continuation context.
      if (detectExplicitCategoryPivot(submittedText)) {
        console.log('[pivot-reset] resetting convState to idle for explicit category pivot');
        convStateRef.current = INITIAL_CONV_STATE;
      }
    }

    if (convStateRef.current.mode !== 'idle') {
      // When the state machine is active, it is the single source of truth.
      // Clear legacy refs that duplicate music_input / onboarding tracking
      // so they never fire stale handlers after convState resets.
      awaitingListeningPathRef.current = false;
      onboardingContextRef.current = null;

      const earlyTurnCtx = buildTurnContext(submittedText, audioState, dismissedFingerprintsRef.current, state.listenerPreferenceProfile);
      // Blocker fix §1: pass active-saved-system flag so bare evaluation
      // phrasings ("assess my system", "evaluate the saved system",
      // "tell me what you think") route to system_assessment instead of
      // consultation_entry intake.
      // Mission 3 F1 (2026-08-10): an inline-stated system persisted by
      // Phase K is just as much "the system" as a saved one — excluding
      // it sent post-assessment tuning requests ("more air and openness")
      // to the knowledge lane's generic essay instead of the
      // active-system tuning handler.
      const hasActiveSavedSystemEarly = earlyTurnCtx.systemSource === 'saved'
        || earlyTurnCtx.systemSource === 'draft'
        || earlyTurnCtx.systemSource === 'inline';
      const { intent: earlyIntent } = detectIntent(submittedText, {
        hasActiveSavedSystem: hasActiveSavedSystemEarly,
      });

      // ── Saved-system bridge (Step 3): inject the active system into
      // the text pipeline for system assessments and consultation entry.
      //
      // P0 fix: use earlyTurnCtx.activeSystem (resolved from AudioSessionContext)
      // as the SINGLE SOURCE OF TRUTH instead of calling resolveSavedSystemForAdvisory()
      // which reads from a separate localStorage layer. The two sources can
      // diverge, causing the evaluated system to differ from the selected one.
      //
      // Guard: skip injection when the user already described a system
      // in this message (proposedSystem with ≥ 2 components). The user's
      // stated chain takes precedence over any saved system.
      let injectedSystemText: string | undefined;
      const userStatedSystemWarm = earlyTurnCtx.proposedSystem && earlyTurnCtx.proposedSystem.components.length >= 2;
      if ((earlyIntent === 'system_assessment' || earlyIntent === 'consultation_entry') && !userStatedSystemWarm) {
        if (earlyTurnCtx.activeSystem && earlyTurnCtx.activeSystem.components.length > 0) {
          // Build synthetic text from the resolved active system — same source
          // that all downstream advisory builders will use.
          const componentNames = earlyTurnCtx.activeSystem.components.map((c) => {
            const b = (c.brand || '').trim();
            const n = (c.name || '').trim();
            if (!b) return n || 'Unknown';
            if (n.toLowerCase().startsWith(b.toLowerCase())) return n;
            return `${b} ${n}`;
          });
          injectedSystemText = `My system: ${componentNames.join(', ')}.`;

          // P0 debug log
          console.log('[system-bridge] Active system used for evaluation:', {
            name: earlyTurnCtx.activeSystem.name,
            source: earlyTurnCtx.systemSource,
            components: componentNames,
          });
        } else if (!earlyTurnCtx.activeSystem && audioState.savedSystems.length > 1 && !audioState.activeSystemRef) {
          // Multiple saved systems, none explicitly active — ask user to pick.
          const list = audioState.savedSystems.map((s) => `• ${s.name}`).join('\n');
          dispatch({
            type: 'ADD_QUESTION',
            clarification: {
              acknowledge: 'You have more than one saved system.',
              question: `Which one should I evaluate?\n${list}\n\nOpen the system you want from Saved Systems and ask again.`,
            },
          });
          dispatch({ type: 'SET_LOADING', value: false });
          return;
        }
      }

      let convResult = convTransition(convStateRef.current, submittedText, {
        hasSystem: !!earlyTurnCtx.activeSystem || !!audioState.activeSystemRef || !!injectedSystemText,
        subjectCount: earlyTurnCtx.subjectMatches.length,
        detectedIntent: earlyIntent,
        injectedSystemText,
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
          // ── Known-fact backfill (M5-F6, 2026-08-11) ──────────────
          // Post-answer turns that re-enter shopping intake must never
          // ask for facts the conversation already holds. Live: after a
          // recommendation, "why that one?" and "maybe 2k? honestly not
          // sure…" both restarted intake and re-asked the budget — the
          // machine's fresh facts could not see lastShoppingFactsRef
          // (the parallel-store seam). When the machine asks for
          // category or budget that the previous shopping turns already
          // established, backfill the fact and re-run the transition;
          // the machine then proceeds with a synthesized query instead
          // of asking. Core invariant: budget persists unless
          // explicitly changed.
          const askState = convResult.state;
          const saved = lastShoppingFactsRef.current;
          const priorAnswers = messages.some(
            (m) => m.role === 'assistant' && m.kind === 'advisory' && m.advisory.kind === 'shopping',
          );
          if (
            priorAnswers && saved
            && askState.mode === 'shopping'
            && ((askState.stage === 'clarify_budget' && saved.budget)
              || (askState.stage === 'clarify_category' && saved.category))
          ) {
            const backfilled = {
              ...askState,
              facts: {
                ...askState.facts,
                budget: askState.facts.budget ?? saved.budget,
                category: askState.facts.category ?? saved.category,
              },
            };
            console.log('[fact-backfill] suppressed %s re-ask — backfilled from saved facts', askState.stage);
            const rerun = convTransition(backfilled, submittedText, {
              hasSystem: !!earlyTurnCtx.activeSystem || !!audioState.activeSystemRef || !!injectedSystemText,
              subjectCount: earlyTurnCtx.subjectMatches.length,
              detectedIntent: earlyIntent,
              injectedSystemText,
            });
            convStateRef.current = rerun.state;
            convResult = rerun;
          }
        }
        const settledResponse = convResult.response;
        if (settledResponse && settledResponse.kind === 'question') {
          dispatch({
            type: 'ADD_QUESTION',
            clarification: {
              acknowledge: settledResponse.acknowledge,
              question: settledResponse.question,
            },
          });
          dispatch({ type: 'SET_LOADING', value: false });
          return;
        }
        if (settledResponse && settledResponse.kind === 'note') {
          dispatch({ type: 'ADD_NOTE', content: settledResponse.content });
          dispatch({ type: 'SET_LOADING', value: false });
          return;
        }
        if (settledResponse && settledResponse.kind === 'proceed') {
          // ── Synthesized query (onboarding music → path → budget completion) ──
          if (settledResponse.synthesizedQuery) {
            const synthesized = settledResponse.synthesizedQuery;
            // Category from established facts first (M5-F6 follow-through,
            // 2026-08-11): this handler predates non-onboarding synthesized
            // queries and defaulted to 'speakers' — a backfilled amplifier
            // refinement rendered "You're looking for speakers." over amp
            // cards. The listening-path default remains for the music
            // onboarding flow that has no category fact.
            const synCategory = (convResult.state.facts.category as string | undefined)
              ?? (convResult.state.facts.listeningPath === 'headphones' ? 'headphones' : 'speakers');
            const synTurnCtx = buildTurnContext(synthesized, audioState, dismissedFingerprintsRef.current, state.listenerPreferenceProfile);
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
              const res = await fetchWithTimeout('/api/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: synthesized }),
              }, EVALUATE_TIMEOUT_MS);
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
              // D2 residual (2026-08-11): single money authority — the ad-hoc
              // regex read "3k" as "$3" in the intent summary.
              const parsedBudget = parseBudgetAmount(submittedText);
              const budgetStr = parsedBudget !== null ? `under $${parsedBudget}` : '';
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
              // Phase K — mirror sticky domain so a follow-up symptom
              // turn after recommendation keeps the right category.
              domainContext: convResult.state.facts.domainContext as
                | import('@/lib/shopping-intent').ShoppingCategory
                | undefined,
            };
            // Update category lock to match state machine's resolved category.
            // Without this, a category switch via convTransition (e.g. tube amp → DAC → budget)
            // leaves activeShoppingCategoryRef stale, causing the shopping pipeline
            // to revert to the old category.
            if (convResult.state.facts.category) {
              activeShoppingCategoryRef.current = convResult.state.facts.category as import('@/lib/shopping-intent').ShoppingCategory;
            }

            // ── Refinement handling (Prompt 3) ──────────────────
            // When the state carries refinement data (isRefinement + preferenceDeltas),
            // intercept and re-rank from the prior product pool instead of running
            // the full pipeline fresh.
            const refinementFacts = convResult.state.facts;
            if (refinementFacts.isRefinement && refinementFacts.preferenceDeltas && refinementFacts.preferenceDeltas.length > 0) {
              console.log('[refinement-intercept] detected refinement turn',
                { deltas: refinementFacts.preferenceDeltas, priorProducts: refinementFacts.priorProductNames });

              // Find the most recent shopping advisory with product options
              const lastShoppingAdvisory = [...messages].reverse().find(
                (m): m is Extract<typeof m, { kind: 'advisory' }> =>
                  m.role === 'assistant' && 'kind' in m && m.kind === 'advisory'
                  && m.advisory.kind === 'shopping' && !!m.advisory.options && m.advisory.options.length >= 1,
              );

              if (lastShoppingAdvisory?.advisory.options) {
                const { reRankForRefinement } = await import('@/lib/product-scoring');
                const { buildRefinementTradeoffs } = await import('@/lib/shopping-intent');
                const { buildDeltaExplanation } = await import('@/lib/conversation-state');
                const { findCatalogProduct: findCatalogProductForRerank } = await import('@/lib/listener-profile');

                // Look up catalog products for each prior advisory option
                const priorScored = lastShoppingAdvisory.advisory.options
                  .map((o) => {
                    const searchName = [o.brand, o.name].filter(Boolean).join(' ');
                    const catalogProduct = findCatalogProductForRerank(searchName);
                    if (!catalogProduct) return null;
                    return { product: catalogProduct, score: 0 };
                  })
                  .filter((s): s is NonNullable<typeof s> => s !== null);

                const deltas = refinementFacts.preferenceDeltas!;
                const reRanked = reRankForRefinement(priorScored, deltas);

                // Build delta explanation and trade-offs
                const deltaExplanation = buildDeltaExplanation(deltas);
                const tradeoffs = buildRefinementTradeoffs(deltas);

                // Rebuild product options from re-ranked results — preserve original advisory fields
                const refinedOptions = reRanked.slice(0, 5).map((scored) => {
                  const original = lastShoppingAdvisory.advisory.options!.find(
                    (o) => o.name === scored.product.name && (o.brand ?? '') === scored.product.brand,
                  );
                  return original ?? null;
                }).filter((o): o is NonNullable<typeof o> => o !== null);

                if (refinedOptions.length > 0) {
                  // Re-assign primary: new position 0 is the "Start here" pick.
                  // Clear old primary flags, then mark the new top pick.
                  const reframedOptions = refinedOptions.map((o, i) => ({
                    ...o,
                    isPrimary: i === 0,
                    roleLabel: i === 0 ? 'Start here' : (o.roleLabel === 'Start here' ? undefined : o.roleLabel),
                    pickRole: i === 0 ? ('anchor' as const) : o.pickRole,
                  }));
                  // Cap at 3
                  const cappedOptions = reframedOptions.slice(0, 3);
                  // Dispatch compact refinement advisory
                  const refinedAdvisory: AdvisoryResponse = {
                    kind: 'shopping',
                    subject: lastShoppingAdvisory.advisory.subject || 'refined recommendation',
                    shoppingCategory: lastShoppingAdvisory.advisory.shoppingCategory,
                    options: cappedOptions,
                    // Compact refinement framing
                    refinementDelta: deltaExplanation,
                    refinementTradeoffs: tradeoffs ?? undefined,
                  };

                  // Dispatch the delta explanation as a note, then the refined cards
                  dispatch({ type: 'ADD_NOTE', content: deltaExplanation });
                  if (tradeoffs) {
                    dispatch({ type: 'ADD_NOTE', content: `You gain: ${tradeoffs.gain}\nYou risk: ${tradeoffs.risk}` });
                  }
                  // dispatchAdvisory isn't defined yet at this point in the function.
                  // Use the same mechanism: dispatch ADD_ADVISORY with phonoWrap.
                  dispatch({ type: 'ADD_ADVISORY', advisory: refinedAdvisory, id: `advisory-refine-${Date.now()}` });

                  // Keep state alive for further refinement
                  const refinedProductNames = refinedOptions.map(o => `${o.brand ?? ''} ${o.name}`.trim());
                  convStateRef.current = {
                    mode: 'shopping',
                    stage: 'done',
                    facts: {
                      ...convResult.state.facts,
                      priorProductNames: refinedProductNames,
                      priorCategory: convResult.state.facts.category,
                      priorBudget: convResult.state.facts.budget,
                      isRefinement: false,
                    },
                  };

                  dispatch({ type: 'SET_LOADING', value: false });
                  return;
                }
              }

              console.log('[refinement-intercept] no prior products found — falling through to fresh pipeline');
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
            // Continuity turn: survive the main detectIntent re-assignment
            // below (see assessmentFollowUpOverride declaration).
            if (convResult.state.facts.assessmentFollowUpTurn) {
              assessmentFollowUpOverride = true;
            }
            // Counterfactual turns (Wave 2, 2026-08-29): a substitution
            // proposal or revert that the state machine kept in
            // ready_to_assess is OWNED by the assessment flow. The main
            // detectIntent below reads the product name and returns
            // product_assessment — the same clobber the continuity flag
            // was invented for — which sent "What about a Leben CS600
            // instead of the Butler?" to the product lane as an isolated
            // unknown-product inquiry. Same restore mechanism, same scope
            // rule: only a turn transition() itself kept.
            if (isSystemDirectedAssessmentTurn(submittedText)) {
              assessmentFollowUpOverride = true;
            }
            // Do NOT reset convState — keep system_assessment mode active.

            /*
             * ── Governed reasoning lane (Substrate Doctrine, flag-gated) ──
             * When the flag is on, EVERY turn the state machine keeps in the
             * assessment is a reasoning turn and the lane owns it — the
             * substrate assembles what is knowable, the model resolves what
             * it means over the raw recent turns, the claim gate holds the
             * evidence boundary. Placed HERE, before the main detectIntent
             * clobber and the follow-up routing tower, so lane selection is
             * one rule: "the conversation is about the system → the lane".
             * Off by default; with the flag off this block is inert and
             * Wave-2 behavior is byte-identical. Any failure falls through
             * to the deterministic path below.
             */
            if (laneActive() && laneStateRef.current
              && laneStateRef.current.components.length >= 2) {
              try {
                /*
                 * RAW recent turns — the referent substrate. A user turn is
                 * its text; an assistant turn is its actual content when it
                 * has one (lane answers, notes), else the standing review's
                 * opening. Substituting the review for EVERY assistant turn
                 * blinded the model to its own prior answers, and "the
                 * second one" stopped resolving (preview battery, C1-T6).
                 */
                const recentTurns = messages.slice(-10).map((m) => {
                  const own = 'content' in m ? String((m as { content?: unknown }).content ?? '') : '';
                  return {
                    role: m.role === 'user' ? 'user' : 'assistant',
                    content: m.role === 'user'
                      ? own
                      : (own || (convStateRef.current.facts.lastSystemReview ?? []).slice(0, 2).join('\n')),
                  };
                }).filter((t) => t.content.trim().length > 0);
                const res = await fetchWithTimeout('/api/reasoning-lane', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    activeSystem: { components: laneStateRef.current.components, source: audioState.activeSystemRef?.kind === 'saved' ? 'saved' : 'stated' },
                    currentHypothetical: laneStateRef.current.hypothetical,
                    question: submittedText,
                    recentTurns,
                  }),
                }, 60000);
                if (res.ok) {
                  const data = await res.json();
                  if (typeof data?.answer === 'string' && data.answer.trim()) {
                    if (data?.contextMeta?.hypothetical !== undefined) {
                      laneStateRef.current = { ...laneStateRef.current, hypothetical: data.contextMeta.hypothetical };
                    }
                    dispatch({ type: 'ADD_NOTE', content: data.answer });
                    dispatch({ type: 'SET_LOADING', value: false });
                    return;
                  }
                }
              } catch { /* fall through to the deterministic path */ }
            }
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
        const turnCtx = buildTurnContext(shoppingText, audioState, dismissedFingerprintsRef.current, state.listenerPreferenceProfile);
        let chipSignals: import('@/lib/signal-types').ExtractedSignals = {
          traits: {} as Record<string, import('@/lib/signal-types').SignalDirection>,
          symptoms: [] as string[],
          archetype_hints: [] as string[],
          uncertainty_level: 0,
          matched_phrases: [] as string[],
          matched_uncertainty_markers: [] as string[],
        };
        try {
          const res = await fetchWithTimeout('/api/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: shoppingText }),
          }, EVALUATE_TIMEOUT_MS);
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
        const turnCtx = buildTurnContext(submittedText, audioState, dismissedFingerprintsRef.current, state.listenerPreferenceProfile);
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
        const turnCtx = buildTurnContext(submittedText, audioState, dismissedFingerprintsRef.current, state.listenerPreferenceProfile);
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
        const turnCtx = buildTurnContext(submittedText, audioState, dismissedFingerprintsRef.current, state.listenerPreferenceProfile);
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
      const syntheticTurnCtx = buildTurnContext(synthesized, audioState, dismissedFingerprintsRef.current, state.listenerPreferenceProfile);
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
        const res = await fetchWithTimeout('/api/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: synthesized }),
        }, EVALUATE_TIMEOUT_MS);
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
        // D2 residual (2026-08-11): single money authority — see the
        // synthesized-onboarding site above.
        const parsedBudget = parseBudgetAmount(submittedText);
        const budgetStr = parsedBudget !== null ? `under $${parsedBudget}` : '';
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
    const turnCtx = buildTurnContext(submittedText, audioState, dismissedFingerprintsRef.current, state.listenerPreferenceProfile);

    // ── Build AudioProfile context (shared across all advisory paths) ──
    //
    // Saved-system personalization split: when the user did NOT state a
    // system in this message but has a saved/draft system, we keep the
    // main answer general and add the system context as a secondary
    // personalized note. The user's stated system (inline) drives the
    // main answer as before.
    const activeComponentNames: string[] | undefined = turnCtx.activeSystem
      ? turnCtx.activeSystem.components.map((c) => {
          const b = (c.brand || '').trim();
          const n = (c.name || '').trim();
          if (!b) return n || 'Unknown';
          if (!n) return b;
          if (n.toLowerCase().startsWith(b.toLowerCase())) return n;
          return `${b} ${n}`;
        })
      : undefined;

    const isInlineSystem = turnCtx.systemSource === 'inline';
    const isSavedSystem = turnCtx.systemSource === 'saved' || turnCtx.systemSource === 'draft';

    // Build a personalized note when a saved/draft system exists but
    // the user didn't state one — keeps the main answer general.
    // Guard: tendencies may be stored as a JSON object string —
    // extract prose or suppress to prevent JSON leaking into the UI.
    let tendenciesStr: string | null = null;
    if (typeof turnCtx.activeSystem?.tendencies === 'string') {
      const raw = turnCtx.activeSystem.tendencies.trim();
      if (raw.length > 0 && raw !== '{}' && raw !== '[]') {
        if (raw.startsWith('{')) {
          try { const p = JSON.parse(raw); tendenciesStr = typeof p.summary === 'string' ? p.summary.trim().toLowerCase() : null; } catch { tendenciesStr = raw.toLowerCase(); }
        } else {
          tendenciesStr = raw.toLowerCase();
        }
      }
    }

    // ── System-awareness gate ──────────────────────────
    // For saved/draft systems, only inject system context when the user
    // explicitly references their system in the query.  Cold shopping
    // queries ("best DAC under $1500") should not produce "your current
    // DAC" language just because a system happens to be saved.
    // Inline systems always pass — the user stated components directly.
    const queryReferencesSystem = /\b(?:my|the)\s+(?:system|setup|chain|rig|gear)\b|\bfor\s+(?:my|the)\s+(?:system|setup|chain|rig|gear)\b|\bfit\s+(?:my|the)\b|\bmatch\s+(?:my|the)\b|\bmy\s+(?:dac|amp|amplifier|speakers?|headphones?|turntable|preamp)\b/i.test(submittedText);
    const useSystemContext = isInlineSystem || (isSavedSystem && queryReferencesSystem);
    const hasActiveSystem = useSystemContext;

    /*
     * SHOPPING COPY, AND ONLY ON A SHOPPING TURN.
     *
     * "Assess my system" matches `queryReferencesSystem`, so a signed-in
     * listener asking for an assessment was shown "picks below are judged on
     * fit with that system" above an assessment that contains no picks.
     *
     * Worse, the tendency clause asserted system CHARACTER from the saved
     * system's stored `tendencies` — the axis-derived aggregate the licensing
     * gate removes everywhere else. On Nathan it read "which leans solid-state
     * amplification" two paragraphs above the assessment's own "both
     * amplification stages are valve designs". Butler's output stage is a 300B
     * directly heated triode. The claim was unlicensed AND wrong AND
     * contradicted the document it sat in.
     *
     * The chain reference is kept for shopping turns, where naming what the
     * picks are judged against is the point. The character clause is gone: no
     * surface may author system character from stored axes.
     */
    const savedSystemNote: string | undefined =
      isSavedSystem && queryReferencesSystem && intent !== 'system_assessment'
        && activeComponentNames && activeComponentNames.length > 0
        ? `Evaluated against your current chain (${activeComponentNames.slice(0, 3).join(', ')})`
          + ' — picks below are judged on fit with that system, not in isolation.'
        : undefined;
    const advisoryCtx: ShoppingAdvisoryContext = {
      systemComponents: hasActiveSystem ? activeComponentNames : undefined,
      systemLocation: hasActiveSystem ? (turnCtx.activeSystem?.location ?? undefined) : undefined,
      systemPrimaryUse: hasActiveSystem ? (turnCtx.activeSystem?.primaryUse ?? undefined) : undefined,
      storedDesires: tasteProfile
        ? topTraits(tasteProfile, 5).map((t) => t.label)
        : undefined,
      systemTendencies: hasActiveSystem ? (turnCtx.activeSystem?.tendencies ?? undefined) : undefined,
      tasteReflection: generateTasteReflection(listenerProfileRef.current) ?? undefined,
      savedSystemNote,
    };

    // ── Non-assessment active system ─────────────────────
    // For builders outside the system_assessment path, only pass the
    // active system when the user stated it in this message (inline).
    // Saved/draft systems appear only as the secondary savedSystemNote.
    // Assessment mode overrides this — see the safeguard below.
    const generalActiveSystem = isInlineSystem ? turnCtx.activeSystem : null;

    // ── Phono caveat helper ────────────────────────────────
    // Wraps any advisory with phono stage awareness before dispatch.
    // No-op when the advisory subject doesn't involve turntables.
    const phonoWrap = (a: AdvisoryResponse): AdvisoryResponse =>
      withPhonoCaveat(a, turnCtx.activeSystem);

    // Dispatch wrapper that applies phono caveat to all advisory messages.
    const dispatchAdvisory = (advisory: AdvisoryResponse, id?: string) => {
      // Adjacent-domain prefix: prepend live-sound framing before dispatch.
      // Mutates only editorialIntro — no shape change, no new fields.
      if (domainClass === 'adjacent') {
        const prefix = composeDomainPrefix(domainClass);
        if (prefix) {
          advisory.editorialIntro = advisory.editorialIntro
            ? `${prefix} ${advisory.editorialIntro}`
            : prefix;
        }
      }
      dispatch({ type: 'ADD_ADVISORY', advisory: phonoWrap(advisory), ...(id ? { id } : {}) });
    };

    // ── Conversation router ──────────────────────────────
    // Classify the message into a conversation mode before detailed
    // intent detection. Mode persistence carries across turns.
    const routedMode = routeConversation(submittedText);
    const domainClass = classifyDomain(submittedText);
    let effectiveMode = convModeHint ?? resolveMode(routedMode, state.activeMode);
    dispatch({ type: 'SET_MODE', mode: effectiveMode });

    // ── Domain short-circuit (out_of_scope) ─────────────
    // Live-sound territory — bypass detectIntent + advisory pipeline and
    // emit a brief templated note. Adjacent and core continue normally.
    if (domainClass === 'out_of_scope') {
      const body = composeOutOfScopeAnswer(submittedText);
      const suffix = composeDomainSuffix(domainClass);
      dispatch({
        type: 'ADD_NOTE',
        content: suffix ? `${body} ${suffix}` : body,
      });
      return;
    }

    // ── Detect intent ───────────────────────────────────
    // Intent detection runs after extraction. We only need the intent
    // classification — subjectMatches, desires, and subjects are
    // already canonical in turnCtx.
    // Blocker fix §1: pass active-saved-system flag so bare evaluation
    // phrasings route to system_assessment rather than consultation_entry.
    // 'inline' included since Mission 3 F1 (2026-08-10) — see the early
    // variant above. The Phase K persisted inline system must give
    // follow-up desire statements the tuning path, not a knowledge essay.
    const hasActiveSavedSystemMain = turnCtx.systemSource === 'saved'
      || turnCtx.systemSource === 'draft'
      || turnCtx.systemSource === 'inline';
    {
      const _intentResult = detectIntent(submittedText, {
        hasActiveSavedSystem: hasActiveSavedSystemMain,
      });
      intent = _intentResult.intent;
      intentSyntheticSubjects = _intentResult.subjectMatches;
    }

    // Assessment follow-up continuity: the armed turn answers from the
    // existing assessment regardless of how the question classifies.
    if (assessmentFollowUpOverride) {
      intent = 'system_assessment';
    }

    // Count prior shopping advisory turns (needed early for category-switch bypass).
    const shoppingAnswerCount = messages.filter(
      (m) => m.role === 'assistant' && m.kind === 'advisory' && m.advisory.kind === 'shopping',
    ).length;

    // ── Debug: turn entry ──────────────────────────────
    console.log('[turn-debug] msg="%s" intent=%s routedMode=%s effectiveMode=%s activeMode=%s shoppingCount=%d convState=%s/%s',
      submittedText, intent, routedMode, effectiveMode, state.activeMode, shoppingAnswerCount,
      convStateRef.current.mode, convStateRef.current.stage);

    // ── Lane: Preference reflection ───────────────────────
    // The homepage h1 promises "Hifi gear recommendations matched to your
    // taste and system." This lane is the only path that honours the
    // taste-discovery half of that promise directly. It catches meta-
    // questions ("help me understand my listening preferences", "what
    // do I actually value", "I don't know what kind of sound I like")
    // and produces a short reflection with optional questions — never
    // fabricates a profile, never routes to diagnosis or shopping.
    // Fires BEFORE the cold-start state machine so
    // these prompts bypass the orientation handler entirely.
    if (intent === 'preference_reflection') {
      const reflection = buildPreferenceReflection(state.listenerPreferenceProfile);
      dispatch({
        type: 'ADD_QUESTION',
        clarification: { acknowledge: reflection.acknowledge, question: reflection.question },
      });
      dispatch({ type: 'SET_LOADING', value: false });
      return;
    }

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
      // Saved-system bridge (Step 3) — cold path. Mirrors the warm-path
      // injection above. Uses turnCtx.activeSystem as single source of truth
      // (P0 fix: no longer calls resolveSavedSystemForAdvisory / localStorage).
      let coldInjectedSystemText: string | undefined;
      const userStatedSystemCold = turnCtx.proposedSystem && turnCtx.proposedSystem.components.length >= 2;
      if ((intent === 'system_assessment' || intent === 'consultation_entry') && !userStatedSystemCold) {
        if (turnCtx.activeSystem && turnCtx.activeSystem.components.length > 0) {
          const coldNames = turnCtx.activeSystem.components.map((c) => {
            const b = (c.brand || '').trim();
            const n = (c.name || '').trim();
            if (!b) return n || 'Unknown';
            if (n.toLowerCase().startsWith(b.toLowerCase())) return n;
            return `${b} ${n}`;
          });
          coldInjectedSystemText = `My system: ${coldNames.join(', ')}.`;

          console.log('[system-bridge-cold] Active system used for evaluation:', {
            name: turnCtx.activeSystem.name,
            source: turnCtx.systemSource,
            components: coldNames,
          });
        } else if (!turnCtx.activeSystem && audioState.savedSystems.length > 1 && !audioState.activeSystemRef) {
          const list = audioState.savedSystems.map((s) => `• ${s.name}`).join('\n');
          dispatch({
            type: 'ADD_QUESTION',
            clarification: {
              acknowledge: 'You have more than one saved system.',
              question: `Which one should I evaluate?\n${list}\n\nOpen the system you want from Saved Systems and ask again.`,
            },
          });
          dispatch({ type: 'SET_LOADING', value: false });
          return;
        }
      }

      const initialConvMode = detectConvMode(submittedText, {
        detectedIntent: intent,
        hasSystem: !!turnCtx.activeSystem || !!audioState.activeSystemRef || !!coldInjectedSystemText,
        subjectCount: turnCtx.subjectMatches.length,
        injectedSystemText: coldInjectedSystemText,
      });
      console.log('[diag-cold] detectConvMode result:', initialConvMode ? `${initialConvMode.mode}/${initialConvMode.stage}` : 'null');
      if (initialConvMode) {
        convStateRef.current = initialConvMode;

        // ── System assessment ready (saved system injected) ──
        // When detectInitialMode short-circuits straight to ready_to_assess
        // (because a saved system's synthetic text was injected above),
        // override `intent` so the downstream dispatcher calls
        // buildSystemAssessment instead of the consultation_entry builder.
        // Without this override, "evaluate my system" with a saved system
        // is classified as consultation_entry by detectIntent and never
        // reaches buildSystemAssessment → composeAssessmentNarrative.
        if (
          initialConvMode.mode === 'system_assessment'
          && initialConvMode.stage === 'ready_to_assess'
        ) {
          intent = 'system_assessment';
          console.log('[diag-cold] ready_to_assess from injection — intent overridden to system_assessment');
        }

        // ── System entry — confirm system, ask what to improve ──
        if (initialConvMode.mode === 'system_assessment' && initialConvMode.stage === 'entry') {
          // Run transition immediately to produce the "what are you trying to improve?" question
          const convResult = convTransition(initialConvMode, submittedText, {
            hasSystem: !!turnCtx.activeSystem || !!audioState.activeSystemRef || !!coldInjectedSystemText,
            subjectCount: turnCtx.subjectMatches.length,
            detectedIntent: intent,
            injectedSystemText: coldInjectedSystemText,
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
            question = 'Want to understand your current system, explore what you value as a listener, work through a possible change, or troubleshoot something you\'re hearing?';
          } else if (intent === 'educational') {
            acknowledge = 'Audio XX is a system-level listening advisor. It helps you understand how your components interact, what you actually respond to as a listener, and the trade-offs of any change — including when not to change anything at all.';
            question = 'Where would you like to start?\n• Understand my current system\n• Work through a possible change\n• Diagnose something I\'m hearing\n• Learn how system matching works';
          } else {
            acknowledge = 'Good place to start.';
            question = 'Want to understand your current system, explore what you value as a listener, work through a possible change, or troubleshoot something you\'re hearing?';
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
          pendingClarificationRef.current = { kind: 'system_components', originalRequest: submittedText };
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

    // ── Non-advisory bypass: greeting / educational (QA C2) ───────────
    // The state-machine orientation handler upstream already responds
    // when these intents land on the first turn. Once the conversation
    // has moved past orientation (or never entered it), a mid-session
    // "hi", "thanks", or "tell me what Audio XX does" must NOT fall
    // through to the consultation / shopping / diagnosis pipelines —
    // the shopping-lock and shopping-mode overrides below would
    // otherwise clobber the intent to 'shopping' and consume the
    // greeting as a recommendation refinement, producing advisory
    // framing for a non-advisory turn.
    //
    // The audio_knowledge and audio_assistant intents have their own
    // downstream handlers (Lane 2/3, ~line 2550/2584). For those we
    // only need to exempt the shopping overrides below — see the
    // `isNonAdvisoryIntent(intent)` guards there.
    //
    // Glossary is already handled at the top of handleSubmit via
    // `checkGlossaryQuestion` and never reaches this block.
    if (intent === 'greeting' || intent === 'educational') {
      const acknowledge = intent === 'greeting'
        ? 'Hi — happy to keep going whenever you are.'
        : 'Audio XX is a system-level listening advisor — focused on how your components interact and what you tend to respond to as a listener.';
      const question =
        'What would be most useful next — a check on your system, working through a possible change, troubleshooting something you\'re hearing, or something else?';
      dispatch({
        type: 'ADD_QUESTION',
        clarification: { acknowledge, question },
      });
      dispatch({ type: 'SET_LOADING', value: false });
      return;
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
    // diagnosis AND at least one concrete symptom signal is present.
    // Covers: router-detected diagnosis, explicit repair language, AND
    // symptom descriptions that DIAGNOSIS_PATTERNS already matched
    // (standalone "too bright", "no bass", "sounds harsh", etc.).
    // Vague desires without symptom language ("more warmth") don't qualify.
    const diagnosisBreakout = intent === 'diagnosis' && (
      routedMode === 'diagnosis'
      || /\b(?:fix|repair|troubleshoot|diagnose)\b/i.test(submittedText)
      || /\btoo\s+(?:bright|thin|harsh|fatiguing|muddy|dull|veiled|grainy|flat|dry|sterile|clinical|analytical|cold|hard|forward|strident|sharp|lean|aggressive)\b/i.test(submittedText)
      || /\bsounds?\s+(?:bright|thin|harsh|fatiguing|muddy|dull|veiled|grainy|flat|dry|sterile|clinical|analytical|cold|hard|forward|strident|sharp|lean|aggressive|tiny|small|dark|empty|hollow|boomy|noisy|nasal|distant|lifeless|congested)\b/i.test(submittedText)
      || /\b(?:lacks?|lacking|no)\s+(?:bass|treble|body|warmth|dynamics|punch|impact|life|presence|weight|detail|air|clarity|low\s+end)\b/i.test(submittedText)
      || /\b(?:problem|issue)\s+with\b/i.test(submittedText)
      // Causal-hypothesis pivot (M5-F8): "could my amp be causing the
      // brightness?" mid-shopping is a diagnosis breakout.
      || /\b(?:could|might|can)\s+(?:my|the)\s+[\w\s-]{2,24}?\bbe\s+(?:causing|behind|responsible\s+for)\b/i.test(submittedText)
      || /\blistening\s+fatigue\b/i.test(submittedText)
      || /\b(?:noisy|hum(?:ming)?|buzz(?:ing)?|ground(?:ing)?\s+(?:loop|hum|noise))\b/i.test(submittedText)
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
    // Mission 3 F4 (2026-08-10): the isNonAdvisoryIntent exemption exists so
    // "what is soundstage?" mid-session gets a real answer — but category
    // pivots phrased as questions ("ok, now what about speakers?", "now how
    // about an amp") also classify audio_knowledge, and the exemption sent
    // them to a generic essay, dropping budget and preference context the
    // carry-forward machinery holds. An explicit category switch is
    // unambiguous shopping — it wins over the exemption.
    const lockCategorySwitch = isInShoppingFlow ? detectExplicitCategorySwitch(submittedText) : null;
    if (isInShoppingFlow && intent !== 'product_assessment' && !diagnosisBreakout
      && (!isNonAdvisoryIntent(intent) || lockCategorySwitch !== null)) {
      console.log('[shopping-lock] Overriding intent=%s → shopping (effectiveMode=%s, shoppingAnswerCount=%d, catSwitch=%s)', intent, effectiveMode, shoppingAnswerCount, lockCategorySwitch ?? 'none');
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
    // ── Block A2 — global continuation-state pivot guard ─────────────
    // Before any of the four follow-up gates below (comparison-followup,
    // comparison-context-enrichment, bare-product-as-context, consultation-
    // followup), check whether the user's message is an explicit category
    // pivot. If so, clear ALL stored continuation state and fall through
    // to the standard pipeline.
    //
    // Without this guard, phrases like "i'm thinking about a turntable"
    // or "considering speakers" — which don't always classify as 'shopping'
    // intent — slip past the `intent !== 'shopping'` filters on each gate
    // and get absorbed as refinement context for the active comparison /
    // consultation. The diagnosis-followup gate (later) already consults
    // `detectExplicitCategoryPivot` via `isDiagnosisFollowUp`; this block
    // applies the same rule to the other three continuation modes.
    //
    // First fires win — pivot detection runs ONCE per turn and clears
    // both comparison and consultation contexts in a single dispatch.
    const explicitPivot = detectExplicitCategoryPivot(submittedText);
    if (explicitPivot && (state.activeComparison || state.activeConsultation)) {
      console.log('[pivot-reset] clearing continuation state for explicit category pivot');
      if (state.activeComparison) {
        dispatch({ type: 'CLEAR_COMPARISON' });
      }
      if (state.activeConsultation) {
        dispatch({ type: 'CLEAR_CONSULTATION_CONTEXT' });
      }
      // Fall through to standard pipeline — do NOT return.
    }

    if (
      state.activeComparison &&
      intent !== 'comparison' &&
      intent !== 'shopping' &&
      !explicitPivot &&
      isComparisonFollowUp(submittedText, state.activeComparison)
    ) {
      const refinement = buildComparisonRefinement(state.activeComparison, submittedText, state.listenerPreferenceProfile);
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
      intent !== 'shopping' &&
      !explicitPivot
    ) {
      const contextKind = detectContextEnrichment(submittedText);
      if (contextKind) {
        const refinement = buildContextRefinement(state.activeComparison, submittedText, contextKind, state.listenerPreferenceProfile);
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
      !explicitPivot &&
      turnCtx.subjectMatches.length > 0
    ) {
      const subjectContextKind = classifySubjectAsContext(turnCtx.subjectMatches);
      const refinement = buildContextRefinement(state.activeComparison, submittedText, subjectContextKind, state.listenerPreferenceProfile);
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
      !explicitPivot &&
      // Assessment follow-up continuity: the armed turn must reach the
      // assessment lane, not the single-subject consultation follow-up
      // (which would answer about one component instead of the system).
      !assessmentFollowUpOverride &&
      isConsultationFollowUp(submittedText, state.activeConsultation)
    ) {
      // Blocker fix §2: pass active saved/inline system into the
      // consultation follow-up so fit questions ("would it fit my
      // system?") ground in the user's real chain instead of asking
      // them to describe it again.
      const followUp = buildConsultationFollowUp(
        state.activeConsultation,
        submittedText,
        turnCtx.activeSystem,
      );
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

    // ── System archetype router ────────────────────────
    // Classify the user's system into one of five coarse archetypes and
    // route BEFORE any inferred-product consultation / advisory logic /
    // LLM inference runs. This replaces case-by-case brand and product-
    // gap branching with a single classify → dispatch step.
    //
    //   - consumer_wireless   → buildConsumerWirelessResponse (short)
    //   - entry_hifi          → fall through to normal pipeline
    //   - resolving_hifi      → fall through to normal pipeline
    //   - high_end            → fall through to normal pipeline
    //   - unknown             → fall through to normal pipeline
    //
    // The archetype router fires ONCE per system fingerprint per
    // session, only on system-description turns (gear_inquiry /
    // system_assessment / consultation_entry) — follow-ups (diagnosis,
    // shopping, refinement) pass through unaffected. This preserves
    // context and avoids re-greeting the user.
    const systemArchetype = classifySystemArchetype(turnCtx.activeSystem?.components);
    const systemFingerprint = turnCtx.activeSystem
      ? turnCtx.activeSystem.components
          .map((c) => `${(c.brand ?? '').toLowerCase()}|${(c.name ?? '').toLowerCase()}`)
          .sort()
          .join('::')
      : '';
    const archetypeRoutingAllowed =
      intent === 'gear_inquiry'
      || intent === 'system_assessment'
      || intent === 'consultation_entry';

    if (
      systemArchetype === 'consumer_wireless'
      && archetypeRoutingAllowed
      && !consumerWirelessIntroShownRef.current.has(systemFingerprint)
      && turnCtx.activeSystem
    ) {
      consumerWirelessIntroShownRef.current.add(systemFingerprint);
      const response = buildConsumerWirelessResponse(turnCtx.activeSystem.components);
      const cwResponse: import('@/lib/consultation').ConsultationResponse = {
        title: turnCtx.activeSystem.name ?? response.title,
        subject: response.subject,
        advisoryMode: 'system_review',
        source: 'brand_profile',
        systemSignature: response.systemSignature,
        tendencies: response.tendencies,
        systemContext:
          `${response.systemSignature}\n\n`
          + `${response.tendencies}`,
        provenanceNote: response.provenanceNote,
        followUp: response.followUp,
      };
      dispatchAdvisory(consultationToAdvisory(cwResponse, undefined, advisoryCtx), advisoryId());
      dispatch({
        type: 'SET_CONSULTATION_CONTEXT',
        subjects: turnCtx.subjectMatches,
        originalQuery: submittedText,
      });
      dispatch({ type: 'SET_LOADING', value: false });
      return;
    }
    // entry_hifi / resolving_hifi / high_end / unknown all fall through
    // to the normal pipeline below — the existing deterministic
    // consultation + advisory paths already produce correct output for
    // those archetypes. This keeps archetype routing as an additive
    // layer: today it only intercepts consumer_wireless, but future
    // archetype-specific builders can hook in here without disturbing
    // downstream code.

    // ── Consultation entry path ────────────────────────
    // User asks for system assessment or upgrade guidance but hasn't named
    // specific gear. Produces a structured intake response that explains
    // the evaluation approach and asks for system details.
    //
    // Saved-system upgrade-followup bridge (Block A2 follow-up, 2026-05-13).
    // For consultation_entry specifically, pass through the active saved
    // OR draft system in addition to inline. Without this, an upgrade
    // follow-up like "what should I change first?" after a saved-system
    // diagnosis falls through to the no-active-system branch of
    // buildConsultationEntry (consultation.ts ~line 12093), producing
    // a generic "what components make up your current system?" intake
    // even though the saved chain is attached. The buildConsultationEntry
    // saved-system branch (~line 11995) is already authored to anchor
    // upgrade-direction guidance on the saved chain — passing
    // turnCtx.activeSystem reaches it.
    //
    // Scope is intentionally narrow: only buildConsultationEntry sees the
    // saved system here. Other builders that share generalActiveSystem
    // keep their existing null-on-saved-system behavior — saved/draft
    // systems still appear only as the secondary savedSystemNote in
    // shopping/gear/exploration advisories. The intent classifier already
    // gates consultation_entry on hasActiveSavedSystem in intent.ts, so
    // the routing decision relied on the saved system being present —
    // the builder needs that same context to produce the targeted
    // response the routing implied.
    if (intent === 'consultation_entry') {
      const entryActiveSystem = (isInlineSystem || isSavedSystem)
        ? (turnCtx.activeSystem ?? null)
        : null;
      const entryResult = buildConsultationEntry(submittedText, turnCtx.desires, entryActiveSystem);
      dispatchAdvisory(consultationToAdvisory(entryResult, undefined, advisoryCtx), advisoryId());
      dispatch({ type: 'SET_LOADING', value: false });
      return;
    }

    // ── Music input path ──────────────────────────────────
    // User leads with musical taste ("I listen to jazz", "I like Van Halen").
    // Acknowledge briefly and ask one guiding question. No advisory logic yet.
    // ── GTM Phase 4 (2026-07-15): "no turn may end empty" ──────────────
    // The knowledge-lane body, hoisted above the guarded lanes so any
    // lane that produces no substantive user-visible response can fall
    // through to a real answer instead of ending the turn in silence.
    // Fires ONLY where the alternative is nothing (or a canned
    // non-answer); populated lanes are untouched.
    const runKnowledgeLane = () => {
      const knowledgeCtx: KnowledgeContext = {
        currentMessage: submittedText,
        subjectMatches: turnCtx.subjectMatches,
        activeSystem: generalActiveSystem,
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
      // Chain attached — this lane now owns the teardown.
      asyncLaneOwnsLoading = true;
    };

    if (intent === 'music_input') {
      const musicResponse = respondToMusicInput(submittedText);
      // Empty-turn guard (benchmark PH-03, RS-02, CN-06, VG-09): the
      // music lane exists for descriptions of what the user listens to.
      // A QUESTION that merely contains a music word ("why does vinyl
      // sound better", "do I need acoustic panels…") false-positives
      // the matcher and got a music-taste note — a non-answer. Answer
      // questions; keep the onboarding flow for actual descriptions.
      // The generic no-match fallback is likewise a non-answer.
      const musicIsQuestion = /\?\s*$/.test(submittedText.trim())
        || /^(?:do|does|is|are|can|could|should|what|whats|what's|why|how|which|when|where)\b/i.test(submittedText.trim())
        || /\b(?:where do i start|how do i|should i|worth it)\b/i.test(submittedText);
      if (musicIsQuestion || musicResponse === MUSIC_INPUT_FALLBACK) {
        runKnowledgeLane();
        return;
      }
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
      // Empty-turn guard: the intake questionnaire exists for vague
      // WANTS ("I need speakers"). A question-shaped message ("do I
      // need a DAC if my amp has one built in?") deserves an answer,
      // not a form — the questionnaire is a non-answer to a question
      // (benchmark BG-06).
      const isQuestionShaped = /\?\s*$/.test(submittedText.trim())
        || /^(?:do|does|is|are|can|could|should|what|whats|what's|why|how|which|when|where)\b/i.test(submittedText.trim());
      if (isQuestionShaped) {
        runKnowledgeLane();
        return;
      }
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
      const cableResult = buildCableAdvisory(submittedText, turnCtx.subjectMatches, turnCtx.desires, generalActiveSystem);
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

    // ── Assessment safeguard: restore full system context ──
    // For system assessments, the active system IS the subject — not
    // secondary context. Restore systemComponents so the assessment
    // pipeline sees the full chain regardless of systemSource.
    if (intent === 'system_assessment' && activeComponentNames && !advisoryCtx.systemComponents) {
      advisoryCtx.systemComponents = activeComponentNames;
      advisoryCtx.systemTendencies = turnCtx.activeSystem?.tendencies ?? undefined;
      advisoryCtx.systemLocation = turnCtx.activeSystem?.location ?? undefined;
      advisoryCtx.systemPrimaryUse = turnCtx.activeSystem?.primaryUse ?? undefined;
      advisoryCtx.savedSystemNote = undefined; // Not an addendum in assessment mode
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

      // ── Assessment follow-up continuity (launch, 2026-07-19) ──
      // The state machine armed assessmentFollowUpTurn for exactly this
      // turn: the first post-assessment direction question ("what would I
      // upgrade first?", "weakest link?"). Consume the flag up front —
      // whatever happens below — so it can never leak into a later turn.
      const isAssessmentFollowUpTurn = convStateRef.current.facts.assessmentFollowUpTurn === true;
      if (isAssessmentFollowUpTurn) {
        convStateRef.current = {
          ...convStateRef.current,
          facts: { ...convStateRef.current.facts, assessmentFollowUpTurn: false },
        };
      }

      let assessmentResult = buildSystemAssessment(accumulatedText, assessmentSubjects, turnCtx.activeSystem, turnCtx.desires, state.listenerPreferenceProfile);

      // ── Lazy manufacturer evidence for an unassessable pairing ──────
      //
      // Deliberately lazy. Catalog facts win by precedence, so fetching for
      // every turn would buy nothing on the systems Audio XX already knows
      // and would put a network round trip in front of each of them. The
      // fetch happens only when the compatibility check actually came back
      // unassessable AND both an amplifier and a loudspeaker are present —
      // the one case where a published figure changes the verdict.
      if (assessmentResult?.kind === 'assessment') {
        const pm = assessmentResult.findings?.powerMatchAssessment;
        const needsFigures = pm?.compatibility === 'unknown' && !!pm?.ampName && !!pm?.speakerName;
        if (needsFigures) {
          const wanted = [pm!.ampName!, pm!.speakerName!];
          const settled = await Promise.race([
            Promise.all(wanted.map(async (name) => {
              try {
                const r = await fetch('/api/manufacturer-facts', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name }),
                });
                if (!r.ok) return [];
                const j = await r.json();
                return Array.isArray(j?.facts) ? j.facts : [];
              } catch { return []; }
            })),
            new Promise<'deadline'>((r) => setTimeout(() => r('deadline'), 20000)),
          ]);
          const evidence = settled === 'deadline'
            ? []
            : (settled as Array<Array<Record<string, unknown>>>).flat();
          if (evidence.length > 0) {
            // Rebuilt rather than patched: the compatibility result feeds the
            // constraint layer, the verdict and the decision line, and
            // rewriting one field would leave the others reasoning from the
            // old 'unknown'.
            assessmentResult = buildSystemAssessment(
              accumulatedText, assessmentSubjects, turnCtx.activeSystem, turnCtx.desires,
              state.listenerPreferenceProfile, evidence as never,
            );
            console.log('[power-match] rebuilt with %d manufacturer fact(s)', evidence.length);
          }
        }
      }
      if (assessmentResult) {
        // H1 demand telemetry — log each distinct unresolved model token once
        // (privacy-safe: a token the user typed, never the full string), so the
        // most-requested unsupported gear can be ranked post-beta. Pure
        // telemetry: no effect on resolution/routing/confidence/graph/
        // assessment; returns nothing for a successful assessment.
        for (const ev of collectUnmatchedModels(assessmentResult)) {
          trackEvent('unmatched_model', ev);
        }
        if (assessmentResult.kind === 'clarification') {
          // Re-ask cap (Mission 4, 2026-08-10): if THIS turn already
          // consumed a components-ask answer and a component is STILL
          // unresolved (typically uncatalogued gear — the user cannot
          // answer any better than they already have), asking the same
          // question again loops forever. Proceed provisionally instead —
          // the same LLM-assisted whole-system reading the low_confidence
          // branch below uses, with unknown components labelled.
          const consumed = consumedClarificationRef.current;
          const isRepeatSystemAsk = consumed?.kind === 'system_components' && consumed.atTurn === turnCount;
          if (isRepeatSystemAsk) {
            const clarNames = [
              ...(assessmentResult.clarification.recognized ?? []),
              ...(assessmentResult.clarification.unresolved ?? []),
            ];
            const provisional = await inferProvisionalSystemAssessment(submittedText, clarNames, []);
            if (provisional) {
              provisional.source = 'provisional_system';
              const provisionalAdvisory = consultationToAdvisory(provisional, undefined, advisoryCtx);
              provisionalAdvisory.unknownComponents = assessmentResult.clarification.unresolved;
              provisionalAdvisory.reasoningMode = 'expanded';
              provisionalAdvisory.fallbackReason = 'low_confidence_system';
              console.log('[pending-clarification] repeat components ask capped — provisional assessment dispatched');
              dispatchAdvisory(provisionalAdvisory, advisoryId());
              dispatch({ type: 'SET_LOADING', value: false });
              return;
            }
            // LLM unavailable — fall through to asking once more rather
            // than answering with nothing.
          }
          // Validation detected a conflict — ask the user before proceeding,
          // and arm the pending state so the answer is reunited with this
          // turn's full context instead of re-entering the pipeline cold.
          pendingClarificationRef.current = { kind: 'system_components', originalRequest: submittedText };
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
          // Order the chain by signal position rather than resolution order, so
          // the rendered line reads as a chain and not as a lookup log.
          const CHAIN_ORDER = ['turntable', 'cartridge', 'tonearm', 'phono', 'transport',
            'source', 'streamer', 'streamer_dac', 'dac', 'preamplifier', 'integrated', 'amplifier',
            'speaker', 'headphone'];
          const orderedComponents = [...assessmentResult.components].sort((a, b) => {
            const ai = CHAIN_ORDER.indexOf(a.role); const bi = CHAIN_ORDER.indexOf(b.role);
            return (ai < 0 ? CHAIN_ORDER.length : ai) - (bi < 0 ? CHAIN_ORDER.length : bi);
          });
          const componentNames = orderedComponents.map(c => c.displayName);
          const unresolvedRoster = orderedComponents
            .filter(c => c.unresolved || (!c.product && !c.brandProfile))
            .map(c => ({ name: c.displayName, role: c.role }));
          mark('graph built');
          // ── Entity corroboration ─────────────────────────────────
          // Independently establish that each uncatalogued component is a real
          // product before model knowledge may describe it. Curated components
          // are never looked up — we already hold better evidence than a search
          // could provide. All lookups run in PARALLEL under one shared
          // deadline, and every failure path (timeout, unavailable, ambiguous,
          // malformed) simply omits the component, leaving it at the
          // user-supplied tier. Corroboration can slow a turn slightly; it can
          // never block or fail one.
          // Cold lookups measured ~4-5s each in production. Parallel they fit
          // easily; the budget is generous because exceeding it costs the
          // listener real evidence — every component silently drops to
          // user-supplied — while waiting costs seconds on first sight only.
          const CORROBORATION_BUDGET_MS = 25000;
          let corroborated: string[] = [];
          let lookupUnknown: string[] = [];
          const canonicalByName = new Map<string, { canonicalName?: string; brand?: string }>();
          if (unresolvedRoster.length > 0) {
            const deadline = new Promise<'deadline'>((r) =>
              setTimeout(() => r('deadline'), CORROBORATION_BUDGET_MS));
            const lookups = Promise.all(unresolvedRoster.map(async (u) => {
              try {
                const r = await fetch('/api/corroborate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: u.name }),
                });
                if (!r.ok) return null;
                const rec = await r.json();
                // Keep the whole record. The canonical name was being computed
                // and then discarded here, so HiFiShark and eBay searched the
                // listener's shorthand ("ARC ref 5") when corroboration had
                // already resolved "Audio Research Reference 5".
                if (rec?.status === 'corroborated') {
                  return { name: u.name, corroborated: true,
                    canonicalName: rec.canonicalName as string | undefined,
                    brand: rec.brand as string | undefined };
                }
                // A lookup that did not COMPLETE is not a finding about the
                // product. Kept distinct so the assessment never tells a
                // listener their loudspeaker could not be identified because a
                // request timed out.
                return { name: u.name, corroborated: false,
                  lookupUnknown: rec?.status !== 'uncorroborated' };
              } catch {
                return { name: u.name, corroborated: false, lookupUnknown: true };
              }
            }));
            const settled = await Promise.race([lookups, deadline]);
            if (settled === 'deadline') {
              console.warn('[corroboration] deadline hit for %d components', unresolvedRoster.length);
            } else {
              console.log('[corroboration] %d of %d corroborated',
                (settled as Array<string | null>).filter(Boolean).length, unresolvedRoster.length);
            }
            type Outcome = { name: string; corroborated: boolean; lookupUnknown?: boolean;
              canonicalName?: string; brand?: string };
            // Hitting the shared deadline is itself an infrastructure failure,
            // so every component becomes lookup-unknown rather than silently
            // unverified.
            const outcomes: Outcome[] = settled === 'deadline'
              ? unresolvedRoster.map((u) => ({ name: u.name, corroborated: false, lookupUnknown: true }))
              : (settled as Array<Outcome | null>).filter((r): r is Outcome => !!r);
            const verified = outcomes.filter((r) => r.corroborated);
            corroborated = verified.map((r) => r.name);
            lookupUnknown = outcomes.filter((r) => !r.corroborated && r.lookupUnknown).map((r) => r.name);
            for (const r of verified) canonicalByName.set(r.name.toLowerCase().trim(), r);
          }

          // ── Manufacturer evidence ────────────────────────────────
          // Read from the site-level store; this path never populates it.
          // Fetched only for components whose identity is established, since a
          // fact needs a product to belong to. All lookups run in parallel
          // under one deadline, and every failure simply yields no facts —
          // absence is a state the licensing layer already handles.
          mark('corroboration done');
          const FACTS_BUDGET_MS = 20000;
          let manufacturerEvidence: Array<Record<string, unknown>> = [];
          const factCandidates = orderedComponents
            .filter((c) => corroborated.includes(c.displayName) || c.product || c.brandProfile)
            .map((c) => c.displayName);
          if (factCandidates.length > 0) {
            const factsDeadline = new Promise<'deadline'>((r) =>
              setTimeout(() => r('deadline'), FACTS_BUDGET_MS));
            const factLookups = Promise.all(factCandidates.map(async (name) => {
              try {
                const r = await fetch('/api/manufacturer-facts', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name }),
                });
                if (!r.ok) return [];
                const j = await r.json();
                return Array.isArray(j?.facts) ? j.facts : [];
              } catch { return []; }
            }));
            const factsSettled = await Promise.race([factLookups, factsDeadline]);
            manufacturerEvidence = factsSettled === 'deadline'
              ? []
              : (factsSettled as Array<Array<Record<string, unknown>>>).flat();
            console.log('[manufacturer-facts] %d fact(s) for %d component(s)',
              manufacturerEvidence.length, factCandidates.length);
          }

          // ── Independent-review evidence: READ ONLY ───────────────
          // Site-level product knowledge. The assessment reads what is held
          // and never acquires: four search-backed calls do not belong inside
          // a listener's wait, and a first encounter with a product
          // legitimately has none. Absence here is not a failure to identify
          // the component — provenance already says what we know about it.
          const reviewObservations: Record<string, unknown[]> = {};
          if (factCandidates.length > 0) {
            const reads = await Promise.race([
              Promise.all(factCandidates.map(async (name) => {
                try {
                  const r = await fetch('/api/independent-reviews', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, mode: 'read' }),
                  });
                  if (!r.ok) return [name, [] as unknown[]] as const;
                  const j = await r.json();
                  return [name, Array.isArray(j?.observations) ? j.observations : []] as const;
                } catch { return [name, [] as unknown[]] as const; }
              })),
              new Promise<'deadline'>((r) => setTimeout(() => r('deadline'), 8000)),
            ]);
            if (reads !== 'deadline') {
              for (const [name, items] of reads as Array<readonly [string, unknown[]]>) {
                if (items.length > 0) reviewObservations[name] = items;
              }
            }
            const totalObs = Object.values(reviewObservations).reduce((n, v) => n + v.length, 0);
            console.log('[independent-reviews] read %d observation(s) for %d component(s)',
              totalObs, factCandidates.length);
          }

          // Component dossiers — what each piece of equipment IS, built from
          // evidence already fetched. No acquisition, no reasoning: a
          // projection over authored product facts plus the manufacturer
          // specifications this turn already read.
          const dossierViews = buildDossierViews(
            orderedComponents.map((c) => ({
              displayName: c.displayName,
              // Saved records carry storage vocabulary ('power_amp',
              // 'preamp'); the dossier's role line is an editorial surface
              // and prints the normalised role, never the storage token.
              role: dossierRole(c.role) ?? c.role,
              canonicalName: canonicalByName.get(c.displayName.toLowerCase().trim())?.canonicalName,
            })),
            manufacturerEvidence as Array<Record<string, unknown>>,
            reviewObservations as Record<string, Array<Record<string, unknown>>>);

          mark('evidence read');
          const provisional = await inferProvisionalSystemAssessment(
            assessmentResult.query,
            componentNames,
            knownDescriptions,
            unresolvedRoster,
            corroborated,
            lookupUnknown,
            manufacturerEvidence as never,
            reviewObservations as never,
            // Roles travel with the components so the publication boundary can
            // resolve "the amplifier" to the product holding that role.
            orderedComponents.map((c) => ({ name: c.displayName, role: c.role })),
          );
          if (provisional) {
            // Override source to provisional_system for distinct UI labeling
            provisional.source = 'provisional_system';
            // The recognition line must reflect the AUTHORITATIVE component
            // graph, not subjectMatches. Beta defect (2026-08-15): the graph
            // held all four components the listener named while the line
            // above the prose still read "Your system: Dcs → ARC", because it
            // was composed from brand recognition that is knowingly
            // incomplete. This is a record of what the listener supplied — it
            // asserts nothing about catalog coverage.
            const graphCtx = { ...advisoryCtx, systemComponents: componentNames };
            mark('inference done');
            provisional.componentDossiers = dossierViews;
            const provisionalAdvisory = consultationToAdvisory(provisional, undefined, graphCtx);
            provisionalAdvisory.unknownComponents = assessmentResult.unknownComponents;
            // ONE review, composed once, read by both surfaces. The
            // conversation and the frozen artifact must not compose separately
            // — that is how two renderings of one payload drift apart.
            const reviewComponents = orderedComponents.map((c) => ({
              displayName: c.displayName, role: c.role,
            }));
            trackEvent('unmatched_model', { model: 'PROBE-w1', reason: 'probe' });
            laneStateRef.current = {
              components: orderedComponents.map((c) => ({ displayName: c.displayName, role: c.role ?? '' })),
              // The low_confidence union carries no findings; a provisional
              // assessment has no stated substitution to carry either.
              hypothetical: null,
            };
            provisionalAdvisory.systemReview = convStateRef.current.facts.lastSystemReview = composeSystemReview({
              components: reviewComponents,
              synthesis: synthesiseChain(reviewComponents),
              dossiers: dossierViews,
              driveFinding: provisional.systemSignature ?? undefined,
              driveQualification: provisional.qualification,
              // The coverage statement is already inside `philosophy`, which
              // the conversation renders. Passing it here too would print it
              // twice on one surface.
            });
            // Per-component provenance — computed by Audio XX from what it
            // actually holds, so the model cannot promote its own knowledge to
            // curated authority. This is the rendering layer the original
            // Expanded Reasoning design specified and never built.
            // Provenance is computed HERE, where the evidence actually lives:
            // the catalog/brand facts come from the graph node and the
            // corroboration result is in hand. Passing corroboration down into
            // the inference module and recomputing there added a layer of
            // indirection in which the result was being lost — the label read
            // "your description only" while the prose, built from the same
            // call, characterised the component confidently. A label and a
            // paragraph that disagree are worse than either alone, so both now
            // derive from one place.
            const corroboratedSet = new Set(corroborated.map((c) => c.toLowerCase().trim()));
            provisionalAdvisory.componentProvenance = orderedComponents.map((c) => ({
              name: c.displayName,
              basis: tierFor(
                !!c.product,
                !!c.brandProfile,
                corroboratedSet.has(c.displayName.toLowerCase().trim())
                  ? 'corroborated'
                  : 'uncorroborated',
              ),
            }));
            // One presentation per graph node. The joined `subject` string may
            // remain as display copy, but it must never be the identity a
            // product, image, provenance or commerce surface consumes.
            provisionalAdvisory.systemComponentViews = buildComponentViews(
              orderedComponents.map((c) => ({
                displayName: c.displayName,
                role: c.role,
                roles: c.roles,
                canonicalName: canonicalByName.get(c.displayName.toLowerCase().trim())?.canonicalName,
                canonicalBrand: canonicalByName.get(c.displayName.toLowerCase().trim())?.brand,
                product: c.product
                  ? { brand: c.product.brand, name: c.product.name, imageUrl: c.product.imageUrl }
                  : undefined,
              })),
              provisionalAdvisory.componentProvenance,
            );

            // Resources travel with the ONE dossier that represents each box.
            // Taken from the component views rather than rebuilt, so the query
            // is constructed once, from canonical identity, and the artifact
            // cannot search for something different from the conversation.
            for (const d of dossierViews) {
              const view = provisionalAdvisory.systemComponentViews
                ?.find((v) => v.displayName === d.displayName || v.listenerName === d.displayName);
              const picked = [
                view?.hifiSharkUrl ? { label: 'HiFiShark', url: view.hifiSharkUrl } : null,
                view?.ebayUrl ? { label: 'eBay', url: view.ebayUrl } : null,
              ].filter(Boolean) as Array<{ label: string; url: string }>;
              if (picked.length) d.resources = picked;
              // Identity provenance travels with the ONE dossier too, so the
              // badge survives the removal of the separate card list.
              if (view?.basis) d.basis = view.basis;
            }
            // Trust-layer pass: tag the provisional system assessment
            // with expanded-reasoning metadata so the unified
            // ResponseHeader renders the calm indicator + caption
            // instead of the old amber warning box.
            provisionalAdvisory.reasoningMode = 'expanded';
            provisionalAdvisory.fallbackReason = 'low_confidence_system';
            const provisionalMsgId = advisoryId();
            dispatchAdvisory(provisionalAdvisory, provisionalMsgId);
            mark('assessment rendered');

            // Freeze what the listener was just shown. Built from the SAME
            // response object the conversation rendered, so parity is a
            // property of construction rather than something to verify later.
            const provisionalSnap = snapshotFromProvisional(provisional, {
              engineVersion: 'prod',
              createdAt: new Date().toISOString(),
              components: orderedComponents.map((c) => ({
                name: c.displayName, role: c.role,
              })),
              componentDossiers: dossierViews,
            });
            // The snapshot's review is the one the listener actually reads;
            // follow-up continuity answers from the same text.
            trackEvent('unmatched_model', { model: 'PROBE-w2', reason: 'probe' });
            convStateRef.current.facts.lastSystemReview = provisionalSnap.systemReview ?? [];
            void createArtifactSnapshot(provisionalSnap).then((viewToken) => {
              if (viewToken) {
                dispatch({ type: 'SET_ARTIFACT_TOKEN', id: provisionalMsgId, viewToken });
              }
            });
            dispatch({ type: 'SET_LOADING', value: false });
            return;
          }
          // LLM call failed — fall through to consultation path
          dispatch({ type: 'SET_LOADING', value: false });
          return;
        }

        // ── First-follow-up continuity answer ──────────────
        // Answer the direction question from the findings just computed:
        // a short focused reply, not a second full artifact (which would
        // duplicate the one already on screen). Composer returns null on
        // thin findings — then the standard artifact path below stands.
        if (isAssessmentFollowUpTurn) {
          // The standing review's own experiment, for substitution questions
          // on sparse systems — the flat systemReview is the only stored
          // shape, so the experiment paragraph is recovered by its content.
          const lastReview = (convStateRef.current.facts.lastSystemReview?.length ?? 0) > 0
            ? { advisory: { systemReview: convStateRef.current.facts.lastSystemReview as string[] } }
            : [...state.messages].reverse().find(
              (m) => m.role === 'assistant' && 'kind' in m && m.kind === 'advisory'
                && ((m as { advisory?: { systemReview?: string[] } }).advisory?.systemReview?.length ?? 0) > 0,
            ) as { advisory?: { systemReview?: string[] } } | undefined;
          const reviewExperiment = (lastReview?.advisory?.systemReview ?? []).filter(
            (para) => /most informative experiment|experiment worth running|conversion stages|informative place to experiment|informative question this system can be asked|if this were my system/i.test(para),
          );
          const followUpAnswer = composeAssessmentFollowUp(assessmentResult.findings, reviewExperiment)
            ?? composeReviewAnchoredAnswer(submittedText, convStateRef.current.facts.lastSystemReview ?? []);
          if (followUpAnswer) {
            dispatch({ type: 'ADD_NOTE', content: followUpAnswer });
            dispatch({ type: 'SET_LOADING', value: false });
            return;
          }
        }

        const assessmentMsgId = advisoryId();
        // `systemChain` is the authoritative, role-sorted, catalog-resolved
        // component list. `assessmentResult.components` is empty on this path,
        // which is why the first wiring produced no dossiers at all.
        const chain = assessmentResult.findings?.systemChain;
        const chainComponents = (chain?.names ?? []).map((name: string, i: number) => ({
          displayName: name,
          role: dossierRole(chain?.roles?.[i]) ?? '',
        }));
        /*
         * HELD EVIDENCE REACHES THIS PATH TOO.
         *
         * This call passed `[]`, so a catalogued system's dossiers were built
         * from the catalog alone — which carries no specifications. Every
         * interface question therefore resolved to "missing product evidence"
         * for exactly the systems Audio XX knows best, and the system review
         * had nothing to reason across.
         *
         * `heldOnly` reads the site-level store without acquiring: no web
         * search, no model call, no per-assessment cost. Whether this path
         * should also ACQUIRE facts is a separate policy question with real
         * cost attached, and is not decided here.
         */
        const HELD_FACTS_BUDGET_MS = 2500;
        let heldFacts: Array<Record<string, unknown>> = [];
        /*
         * INDEPENDENT REVIEW EVIDENCE REACHES CATALOGUED SYSTEMS TOO.
         *
         * The read-only review fetch existed only on the UNCATALOGUED branch,
         * so a catalogued system — FRANCE, Magnepan, Leben/Cornwall, the
         * balanced reference — never read a single listening observation. The
         * trait/axis prose had been standing in for evidence that was never
         * fetched, which is why removing it left those assessments looking
         * specification-only.
         *
         * The remedy is the evidence, not the prose. `mode: 'read'` acquires
         * nothing: it returns what the site already holds, so this adds a
         * store read and no per-assessment cost.
         */
        const reviewObs: Record<string, Array<Record<string, unknown>>> = {};
        if (chainComponents.length > 0) {
          const deadline = new Promise<'deadline'>((r) =>
            setTimeout(() => r('deadline'), HELD_FACTS_BUDGET_MS));
          const reads = Promise.all(chainComponents.map(async (c) => {
            const [facts, observations] = await Promise.all([
              (async () => {
                try {
                  const r = await fetch('/api/manufacturer-facts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: c.displayName, heldOnly: true }),
                  });
                  if (!r.ok) return [];
                  const j = await r.json();
                  return Array.isArray(j?.facts) ? j.facts : [];
                } catch { return []; }
              })(),
              (async () => {
                try {
                  const r = await fetch('/api/independent-reviews', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: c.displayName, mode: 'read' }),
                  });
                  if (!r.ok) return [];
                  const j = await r.json();
                  return Array.isArray(j?.observations) ? j.observations : [];
                } catch { return []; }
              })(),
            ]);
            return { name: c.displayName, facts, observations };
          }));
          const settled = await Promise.race([reads, deadline]);
          if (settled !== 'deadline') {
            for (const row of settled as Array<{
              name: string;
              facts: Array<Record<string, unknown>>;
              observations: Array<Record<string, unknown>>;
            }>) {
              heldFacts.push(...row.facts);
              if (row.observations.length > 0) reviewObs[row.name] = row.observations;
            }
          }
        }
        const catalogDossiers = buildDossierViews(chainComponents, heldFacts, reviewObs);

        /*
         * RESOURCES TRAVEL WITH THE DOSSIER ON THIS PATH TOO.
         *
         * HiFiShark and eBay links were attached only on the UNCATALOGUED
         * branch, so a catalogued system's dossiers carried no "Find one" at
         * all — the commercial surface was present for the products Audio XX
         * knew least about and absent for the ones it knew best.
         *
         * Built from `buildComponentViews`, so the marketplace query is
         * constructed once from CANONICAL product identity. Rebuilding the
         * query here would let the artifact search for something different
         * from the conversation.
         */
        const catalogViews = buildComponentViews(
          chainComponents.map((c) => ({
            displayName: c.displayName, role: c.role, roles: [c.role],
          })),
          undefined,
        );
        for (const dv of catalogDossiers) {
          const view = catalogViews.find(
            (v) => v.displayName === dv.displayName || v.listenerName === dv.displayName);
          const picked = [
            view?.hifiSharkUrl ? { label: 'HiFiShark', url: view.hifiSharkUrl } : null,
            view?.ebayUrl ? { label: 'eBay', url: view.ebayUrl } : null,
          ].filter(Boolean) as Array<{ label: string; url: string }>;
          if (picked.length) dv.resources = picked;
        }
        assessmentResult.response.componentDossiers = catalogDossiers;
        const deterministicAdvisory = consultationToAdvisory(assessmentResult.response, undefined, advisoryCtx);
        // v2 Assessment Artifact carrier — flag-gated, presentation-only.
        // Off path: deterministicAdvisory.__rawAssessment stays undefined and
        // no consumer reads it. On path: the chat-side dispatch consumes it
        // via synthesizeArtifact() to render the v2 editorial artifact.
        if (ASSESSMENT_ARTIFACT_V2_ENABLED) {
          deterministicAdvisory.__rawAssessment = assessmentResult;
        }
        dispatchAdvisory(deterministicAdvisory, assessmentMsgId);

        // Same result object the conversation rendered — synthesised into the
        // Canonical Assessment Model and frozen. `synthesizeArtifact` is a
        // RENDERING step over a completed result, not a second assessment: it
        // recognises nothing and consults no evidence.
        try {
          const synth = synthesizeArtifact(assessmentResult);
          const cam = toCanonicalAssessment(synth.payload, assessmentResult);
          const canonicalSnap = snapshotFromCanonical(cam, {
            engineVersion: 'prod',
            createdAt: new Date().toISOString(),
            actionVerdict: assessmentResult.response?.actionVerdict,
            componentDossiers: assessmentResult.response?.componentDossiers,
            statedSubstitution: assessmentResult.findings?.statedSubstitution,
          });
          trackEvent('unmatched_model', { model: 'PROBE-w3', reason: 'probe' });
          convStateRef.current.facts.lastSystemReview = canonicalSnap.systemReview ?? [];
          laneStateRef.current = {
            components: chainComponents.map((c) => ({ displayName: c.displayName, role: c.role })),
            hypothetical: assessmentResult.findings?.statedSubstitution ?? null,
          };
          void createArtifactSnapshot(canonicalSnap).then((viewToken) => {
            if (viewToken) {
              dispatch({ type: 'SET_ARTIFACT_TOKEN', id: assessmentMsgId, viewToken });
            }
          });
        } catch { /* the assessment stands even when the artifact cannot be frozen */ }
        // Validation telemetry (Workstream 25B): assessment delivered.
        trackEvent('assessment_completed', {
          id: assessmentMsgId,
          components: assessmentResult.findings.componentNames.length,
        });
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
          // Trust-layer pass: memo overlay merged validated LLM prose
          // into deterministic findings. Mark as 'hybrid' for
          // observability — the deterministic structure is intact, so
          // ResponseHeader continues to render as 'core' (no UI signal).
          merged.reasoningMode = 'hybrid';
          dispatch({ type: 'UPDATE_ADVISORY', id: assessmentMsgId, advisory: merged });
        }).catch(() => {
          logOverlayFailure(assessmentMsgId, overlayComponentCount, Date.now() - overlayStart);
        });

        // Audio XX vI Phase 1 — A3 Character overlay (flag-gated, default OFF).
        // Deterministic Character is already on screen (dispatched above); when
        // the flag is on we ask A3 to regenerate ONLY the Character portion of
        // systemContext, grounded in AdvisorContext + doctrine, and splice it in
        // place. On model-unavailable / timeout / validation-failure the
        // generator returns null and the deterministic Character stands.
        if (a3CharacterEnabled()) {
          const a3ctx = toAdvisorContext(assessmentResult.findings);
          generateA3Character(a3ctx).then((res) => {
            if (!res || !deterministicAdvisory.systemContext) return;
            const spliced = spliceCharacter(deterministicAdvisory.systemContext, res.character);
            if (spliced === deterministicAdvisory.systemContext) return; // nothing replaced
            const merged = { ...deterministicAdvisory, systemContext: spliced };
            merged.reasoningMode = 'hybrid';
            dispatch({ type: 'UPDATE_ADVISORY', id: assessmentMsgId, advisory: merged });
          }).catch(() => {
            /* deterministic Character stands — no user-visible failure */
          });
        }

        // Audio XX vI Phase 2 — A3 Artifact Case overlay (flag-gated).
        // Only meaningful when the v2 artifact is the render path (the
        // __rawAssessment carrier is what AdvisoryMessage synthesizes from).
        // Deterministic case paragraphs are already on screen; when A3
        // produces a validated judgment column, we re-attach the carrier
        // with a3CaseParagraphs and update in place — synthesizeArtifact
        // prefers the attached paragraphs and still runs its own R5/R8
        // post-conditions over them. On model-unavailable / validation-
        // failure the deterministic column stands.
        if (ASSESSMENT_ARTIFACT_V2_ENABLED && a3ArtifactCaseEnabled()) {
          generateA3ArtifactCase(assessmentResult).then((res) => {
            if (!res) return;
            const merged = {
              ...deterministicAdvisory,
              __rawAssessment: { ...assessmentResult, a3CaseParagraphs: res.caseParagraphs },
            };
            merged.reasoningMode = 'hybrid';
            dispatch({ type: 'UPDATE_ADVISORY', id: assessmentMsgId, advisory: merged });
          }).catch(() => {
            /* deterministic judgment column stands — no user-visible failure */
          });
        }

        return;
      }
      /*
       * SA-08 (2026-07-19) sends a null assessment to the knowledge lane
       * because a real prose answer about RECOGNISED gear (Genelec + RME)
       * beats a broken assessment. That reasoning has a boundary the
       * convergence pass found the hard way: when NOTHING in the message
       * resolves — every listed product unknown — the knowledge lane has
       * no knowledge to draw on and invents it. Production answered
       * "Assess my system: Zorblax ZX-1..." with "the Zorblax ZX-1 is
       * known for its highly resolving nature": a reputation authored for
       * a product that does not exist, in Audio XX's voice.
       *
       * An explicit assessment request over an unrecognised chain gets the
       * honest assessment-lane answer instead: name what was listed, say
       * plainly that none of it is held, ask for exact makes and models.
       * Sparse evidence produces explicit limits, never generic filler.
       */
      if (assessmentSubjects.length === 0) {
        const listed = /(?:system|setup|rig|chain)\s*[:\-\u2013\u2014]\s*(.+)$/is
          .exec(accumulatedText)?.[1]
          ?.split(/[,;]/).map((x) => x.trim().replace(/\.$/, '')).filter(Boolean) ?? [];
        pendingClarificationRef.current = { kind: 'system_components', originalRequest: submittedText };
        dispatch({
          type: 'ADD_QUESTION',
          clarification: {
            acknowledge: 'I can see the shape of your system, but none of these components '
              + 'matches anything Audio XX holds evidence for.',
            question: (listed.length
              ? `I couldn't match ${listed.join(', ')} to any product I know — `
              : 'I couldn\u2019t match any of the components you listed — ')
              + 'could you check the exact makes and models? I would rather ask than '
              + 'guess at gear I cannot verify.',
            unresolved: listed.length ? listed : undefined,
          },
        });
        dispatch({ type: 'SET_LOADING', value: false });
        return;
      }
      runKnowledgeLane();
      return;
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
        // Build the advisory once so we can both dispatch it and lift its
        // source attributions/links into the active-comparison state for
        // carry-forward to follow-up refinement turns.
        const consultAdvisory = consultationToAdvisory(consultResult, undefined, advisoryCtx);
        // Store comparison context for follow-up turns. Carry forward
        // sources/links so criterion follow-ups and system-relative
        // refinements stay as rich as the originating turn.
        if (isBrandComparison && turnCtx.subjectMatches.length >= 2) {
          dispatch({
            type: 'SET_COMPARISON',
            left: turnCtx.subjectMatches[0],
            right: turnCtx.subjectMatches[1],
            scope: 'brand',
            sourceReferences: consultAdvisory.sourceReferences,
            links: consultAdvisory.links,
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
        dispatchAdvisory(consultAdvisory, advisoryId());
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
          // Trust-layer pass: LLM-inferred unknown subject. Surface the
          // calm "Expanded reasoning" indicator + caption.
          const inferredAdvisory = consultationToAdvisory(inferred, undefined, advisoryCtx);
          inferredAdvisory.reasoningMode = 'expanded';
          inferredAdvisory.fallbackReason = 'unknown_subject';
          dispatchAdvisory(inferredAdvisory, advisoryId());
          // Validation telemetry (Workstream 25B): out-of-catalog, LLM-inferred.
          trackEvent('unknown_product', { subject: subjectName ?? null, resolved: 'inferred' });
          dispatch({ type: 'SET_LOADING', value: false });
          return;
        }
        // Curated layer AND LLM product inference both came up empty.
        // GTM Phase 4 empty-turn guard: the old hedged apology
        // (buildUnknownProductFallback, "I don't have calibrated
        // data…") was a canned non-answer — the definition of a
        // dead-end turn. The knowledge lane answers the actual
        // question instead (benchmark BG-05, VG-02, EC-01), and its
        // own LLM-down fallback text remains the floor.
        trackEvent('unknown_product', { subject: subjectName ?? null, resolved: 'knowledge_fallback' });
        runKnowledgeLane();
        return;
      }
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
    // D9 (2026-08-11): fold a mid-shopping product question back into
    // refinement ONLY when it names a product the recommendations
    // actually showed. "have you heard anything about the aiyima a07?"
    // named novel external gear and was absorbed by the re-rendered
    // shopping answer — the explicit-subject-wins principle applies at
    // this gate too.
    const assessmentSubjectNames = (intentSyntheticSubjects.length > 0 ? intentSyntheticSubjects : turnCtx.subjectMatches).map((m) => m.name);
    const productAssessmentInShopping = intent === 'product_assessment'
      && shoppingAnswerCount > 0
      && mentionsRecommendedProduct(assessmentSubjectNames, recentShoppingProductsRef.current);
    if (effectiveMode === 'shopping' && intent !== 'shopping' && intent !== 'system_assessment' && intent !== 'comparison' && !diagnosisBreakout && !isNonAdvisoryIntent(intent)) {
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
      hypotheticalChainRef.current = null;
      console.log('[mode-exit] shopping→%s: cleared shopping context', effectiveMode);
    }

    // ── Block A2 Smoke 3 follow-up — saved-system pivot exit ─────────
    // When `effectiveMode === 'diagnosis'` persists from a prior turn
    // (e.g. the user just received a saved-system harshness diagnosis)
    // AND the current turn is an explicit category pivot that detectIntent
    // already routed to 'shopping' ("looking at speakers", "thinking
    // about a turntable"), exit the diagnosis lane so the standard
    // pipeline can route the pivot correctly. Without this exit, the
    // diagnosis continuity override below clobbers the pivot's
    // 'shopping' intent back to 'diagnosis', re-firing the saved-system
    // diagnosis short-circuit (and producing the prior brightness/
    // fatigue diagnostic again on a "looking at speakers" message).
    //
    // The guard is intentionally narrow:
    //   - explicitPivot must be true (PIVOT_VERB + CATEGORY_WORD)
    //   - intent must already be 'shopping' (i.e. detectIntent gate 6e
    //     fired — no diagnosis pattern in the current message)
    //   - effectiveMode must be 'diagnosis' (inherited from prior turn)
    //
    // Legitimate diagnosis follow-ups ("why is it harsh?", "what should
    // I change first?", "is the DAC the issue?") don't match
    // detectExplicitCategoryPivot and continue through the override
    // unchanged. Combined inputs ("looking at speakers, mine sound
    // harsh") classify as 'diagnosis' via the diagnosis-patterns guard
    // in detectIntent gate 6e and also continue through the override
    // unchanged.
    if (explicitPivot && intent === 'shopping' && effectiveMode === 'diagnosis') {
      console.log('[pivot-reset] effectiveMode diagnosis→shopping on explicit category pivot');
      effectiveMode = 'shopping';
      dispatch({ type: 'SET_MODE', mode: 'shopping' });
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
    // D12 (2026-08-11): a QUESTION about named gear escapes the lock —
    // "someone offered me a pass labs xa25, tempting?" mid-triage was
    // re-rendered as symptom triage with the named product ignored.
    // Context-enrichment statements ("my dac is a topping") and bare
    // component names answering the triage stay locked, which is the
    // lock's purpose. Third application of explicit-subject-wins:
    // saved-system §1b, shopping lock (D9), diagnosis lock (here).
    const gearQuestionEscapesDiagnosis = isGearQuestionEscape(submittedText, intent, turnCtx.subjectMatches.length);
    if (effectiveMode === 'diagnosis' && intent !== 'comparison' && intent !== 'system_assessment' && !gearQuestionEscapesDiagnosis) {
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

      // Phase C blocker fix #3: pass the active saved/draft system (not
      // generalActiveSystem) into product assessment. When the user has a
      // saved system active, brand/product inquiries must ground in that
      // chain — the "No system context available" fallback is only valid
      // when there is genuinely no system in session.
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
        // Trust-layer pass: when the assessment is on a product that
        // didn't match the curated catalog (brand-knowledge fallback),
        // tag it so the unified ResponseHeader caption fires instead of
        // the legacy in-format catalog-warning block (now removed).
        if (assessment.catalogMatch === false) {
          advisory.reasoningMode = 'expanded';
          advisory.fallbackReason = 'brand_only';
        }
        dispatchAdvisory(advisory);
        // Phase C blocker fix #2: set consultation context so elliptical
        // follow-ups ("would it fit my system?", "how does it pair?")
        // route through the consultation-follow-up gate instead of
        // falling through to diagnosis.
        if (enrichedSubjects.length > 0) {
          dispatch({
            type: 'SET_CONSULTATION_CONTEXT',
            subjects: enrichedSubjects,
            originalQuery: submittedText,
          });
        }
        dispatch({ type: 'SET_LOADING', value: false });
        return;
      }
      // ── Safety check (Task 5): product detected but resolution failed ──
      // Do NOT fall through to shopping/exploration/gear_inquiry.
      // Instead, return a hedged clarification advisory built by
      // buildUnknownProductClarification — admits limited catalog
      // knowledge, asks for confirmation, and surfaces Explore links
      // (manufacturer search, eBay, HiFi Shark). The image surface
      // is handled by AdvisoryMessage's ConsultationSubjectContext
      // fallback (generic placeholder when no catalog image resolves).
      // P1 follow-on fallback (2026-05-18): when the catalog lookup
      // (turnCtx) has no subject, fall through to the synthesized
      // match produced by detectIntent's unknown-product gate (gate
      // 0a in intent.ts). See resolveUnknownProductName for full
      // precedence + rationale.
      const productName = resolveUnknownProductName(turnCtx.subjectMatches, intentSyntheticSubjects);
      const clarificationAdvisory = buildUnknownProductClarification(productName);
      dispatchAdvisory(clarificationAdvisory);
      dispatch({ type: 'SET_LOADING', value: false });
      return;
    }

    // ── Exploration — "what else is like X?" ───────────
    // Maps a philosophical neighborhood around a reference product.
    if (intent === 'exploration') {
      const refProduct = findReferenceProduct(turnCtx.subjectMatches, submittedText);
      if (refProduct) {
        const exploration = buildExplorationResponse(refProduct, generalActiveSystem, submittedText);
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
      const gearResponse = buildGearResponse(intent, turnCtx.subjects, submittedText, turnCtx.desires, tasteProfile ?? undefined, generalActiveSystem, state.listenerPreferenceProfile);
      if (gearResponse) {
        // Build the advisory once so we can dispatch it and (for comparisons)
        // lift its sourceReferences/links into the active-comparison state.
        const gearAdvisory = gearResponseToAdvisory(gearResponse, undefined, advisoryCtx);

        // ── Comparison context resolution ───────────────────
        // Two paths produce a comparison advisory: an explicit comparison
        // intent with two subjects, OR an upgrade-comparison response
        // (gearResponse.upgradeAnalysis populated). Same-brand upgrade
        // questions like "should I upgrade my Hugo to Hugo TT2?" can
        // collapse to a single brand subject + model variants, which
        // failed the old `subjectMatches.length >= 2` gate. We now also
        // accept the from/to products carried on `matchedProducts` for
        // upgrade comparisons, synthesizing SubjectMatch entries for the
        // comparison-state machine.
        const isUpgradeComparison = !!gearResponse.upgradeAnalysis
          && (gearResponse.matchedProducts?.length ?? 0) >= 2;
        const isSubjectMatchedComparison = intent === 'comparison'
          && turnCtx.subjectMatches.length >= 2;

        if (isUpgradeComparison || isSubjectMatchedComparison) {
          // Prefer the from/to products on upgrade comparisons (they're
          // the actual decision pair, even when the user typed only a
          // brand name). Fall back to subjectMatches for general
          // comparisons where matchedProducts may not perfectly align.
          let left: SubjectMatch;
          let right: SubjectMatch;
          let scope: 'brand' | 'product';

          if (isUpgradeComparison && gearResponse.matchedProducts && gearResponse.matchedProducts.length >= 2) {
            const [from, to] = gearResponse.matchedProducts;
            left = { name: from.name, kind: 'product' };
            right = { name: to.name, kind: 'product' };
            scope = 'product';
          } else {
            // D4 (2026-08-11): drop brand subjects owned by a listed
            // product before pairing — "harbeth p3esr vs kef ls50 meta"
            // extracts [p3esr, harbeth, kef] and positional pairing armed
            // P3ESR-vs-Harbeth (a product against its own brand), which
            // follow-up turns then rendered as the active comparison.
            const paired = dedupeComparisonSubjects(turnCtx.subjectMatches);
            left = paired[0] ?? turnCtx.subjectMatches[0];
            right = paired[1] ?? turnCtx.subjectMatches[1];
            scope = paired.length >= 2 && paired.every((m) => m.kind === 'product') ? 'product' : 'brand';
          }

          dispatch({
            type: 'SET_COMPARISON',
            left,
            right,
            scope,
            sourceReferences: gearAdvisory.sourceReferences,
            links: gearAdvisory.links,
          });
        }
        // Store consultation context for single-subject follow-ups
        if (intent === 'gear_inquiry' && !isUpgradeComparison && turnCtx.subjectMatches.length > 0) {
          dispatch({
            type: 'SET_CONSULTATION_CONTEXT',
            subjects: turnCtx.subjectMatches,
            originalQuery: submittedText,
          });
        }
        dispatchAdvisory(gearAdvisory, advisoryId());
        dispatch({ type: 'SET_LOADING', value: false });
        return;
      }
    }

    // ── Lane 2: Audio Knowledge ────────────────────────
    // General audio questions not tied to a system decision.
    // LLM generates prose; structured context is passed as input.
    // (Lane body lives in runKnowledgeLane, defined above the guarded
    // lanes so the empty-turn guards can reuse it.)
    if (intent === 'audio_knowledge') {
      // Churn avoidance parity with the diagnosis path (~line 4665):
      // a first-turn vague-upgrade ask with no symptom ("should i
      // upgrade my dac") routes here rather than to diagnosis, so the
      // reflective-question gate must fire here too — otherwise the
      // knowledge LLM answers a question about a problem the user
      // never reported. Turn 1 only, same condition as the diagnosis
      // gate; churn-control-pin.test.ts pins which prompts may fire.
      if (turnCount === 0) {
        const churn = detectChurnSignal(submittedText);
        if (churn.detected && churn.reflectiveQuestion) {
          pendingClarificationRef.current = { kind: 'churn_reflection', originalRequest: submittedText };
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
      runKnowledgeLane();
      return;
    }

    // ── Lane 3: Audio Assistant ──────────────────────────
    // Practical hobby tasks — negotiation, translation, message writing,
    // travel/audition logistics. Open LLM with tone guardrails.
    if (intent === 'audio_assistant') {
      const assistCtx: AudioAssistantContext = {
        currentMessage: submittedText,
        subjectMatches: turnCtx.subjectMatches,
        activeSystem: generalActiveSystem,
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
      // Chain attached — this lane now owns the teardown.
      asyncLaneOwnsLoading = true;
      return;
    }

    // ── System diagnosis short-circuit ─────────────────
    // When diagnosis intent fires AND we have system context (either from
    // the current message OR from an active saved/draft system), produce
    // a concise contextual diagnosis directly — no need for the full
    // evaluate engine.
    //
    // Two ways to acquire system context for the diagnosis:
    //   (a) `turnCtx.subjectMatches.length >= 1` — user named components
    //       in the current message (e.g. "I have Hugo + Crayon, sounds
    //       dry").
    //   (b) `turnCtx.activeSystem.components.length >= 1` — user has a
    //       saved or draft system selected. Synthesize SubjectMatch
    //       objects from those components so buildSystemDiagnosis can
    //       reason against them. This handles tuning queries like
    //       "I want more flow" or "my system sounds a little dry" where
    //       the user is implicitly referencing the active chain.
    //
    // When the state machine is in diagnosis mode, the symptom may have
    // been provided on an earlier turn (stored in facts.symptom). Combine
    // the stored symptom with the current message so buildSystemDiagnosis
    // can extract the complaint even when the current turn is purely
    // component names.
    const hasInlineSubjects = turnCtx.subjectMatches.length >= 1;
    const hasActiveSystemForDiagnosis = !!turnCtx.activeSystem
      && turnCtx.activeSystem.components.length >= 1;
    if (intent === 'diagnosis' && (hasInlineSubjects || hasActiveSystemForDiagnosis)) {
      const diagSymptom = convStateRef.current.mode === 'diagnosis'
        ? convStateRef.current.facts.symptom
        : undefined;
      const diagText = diagSymptom && !submittedText.includes(diagSymptom)
        ? `${diagSymptom}. ${submittedText}`
        : submittedText;

      // Prefer inline subjects when present (user is actively naming
      // components in this turn). Fall back to synthesized SubjectMatch
      // objects from the active system. This preserves the existing
      // "user names X + Y, sounds dry" behavior while extending the
      // short-circuit to tuning-with-active-system queries.
      const diagSubjects = hasInlineSubjects
        ? turnCtx.subjectMatches
        : turnCtx.activeSystem!.components.map((c) => {
            const brand = (c.brand || '').trim();
            const name = (c.name || '').trim();
            const fullName = brand && !name.toLowerCase().startsWith(brand.toLowerCase())
              ? `${brand} ${name}`
              : name || brand || 'Unknown';
            // Synthetic SubjectMatch — buildSystemDiagnosis only reads
            // .name and .kind, so this minimal shape is sufficient.
            return { name: fullName, kind: 'product' } as import('@/lib/intent').SubjectMatch;
          });

      const sysDiag = buildSystemDiagnosis(diagText, diagSubjects, state.listenerPreferenceProfile);
      if (sysDiag) {
        dispatchAdvisory(consultationToAdvisory(sysDiag, undefined, advisoryCtx), advisoryId());
        // Save system context for continuity (only when the user named
        // components in THIS turn — when relying on the active system,
        // the system context is already persisted upstream).
        if (hasInlineSubjects && turnCtx.subjectMatches.length >= 2) {
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
    // Primary: verb-first directive switches ("show me amps", "what about dacs").
    const verbDirectiveSwitch = isShoppingRefinement
      ? detectExplicitCategorySwitch(submittedText)
      : null;
    // Secondary: noun-first explicit-override shapes that the verb-first
    // detector misses ("amp recommendations", "not speakers, amps",
    // "what about amps"). These are the user's literal category demand and
    // MUST replace any prior lock, so they count as an explicit switch.
    const priorityOverride = isShoppingRefinement
      ? extractPriorityCategory(submittedText)
      : undefined;
    /*
     * THE CURRENT QUESTION'S CATEGORY IS AUTHORITATIVE (Nathan beta,
     * 2026-08-28). "What modern amplifier should I audition against the
     * Butler?" — a fresh shopping turn after an assessment — resolved its
     * category from allUserText, where the system description's
     * "Dac/Streamer" leads, and recommended DACs for an amplifier
     * question. When a shopping-intent message names exactly ONE product
     * category, that category scopes the turn, exactly as an explicit
     * switch does. Messages naming none or several keep the accumulated
     * context.
     */
    const CURRENT_CATEGORY_RES: Array<[import('@/lib/shopping-intent').ShoppingCategory, RegExp]> = [
      ['amplifier', /\b(?:amplifiers?|power\s+amps?|integrateds?|monoblocks?)\b|\bamps?\b/i],
      ['dac', /\bdacs?\b|\bd\/a\b|digital-to-analog/i],
      ['speaker', /\b(?:loud)?speakers?\b|\bmonitors?\b|\bfloorstanders?\b/i],
    ];
    const categoriesNamedNow = CURRENT_CATEGORY_RES.filter(([, re]) => re.test(submittedText));
    const currentMessageCategory = (intent === 'shopping' && categoriesNamedNow.length === 1)
      ? categoriesNamedNow[0][0]
      : null;

    const earlyCategorySwitch: import('@/lib/shopping-intent').ShoppingCategory | null =
      verbDirectiveSwitch ?? priorityOverride?.category ?? currentMessageCategory ?? null;
    if (priorityOverride && !verbDirectiveSwitch) {
      console.log('[category-override] priority pattern treated as explicit switch → %s', priorityOverride.category);
    }

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
      // Phase 5 resilience: bounded fetch — if /api/evaluate hangs (e.g. prisma
      // lock on SQLite), we still fall through to the deterministic path below
      // rather than blocking the UI at "Thinking…" forever.
      const res = await fetchWithTimeout('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: evaluateText }),
      }, EVALUATE_TIMEOUT_MS);
      if (res.ok) {
        evalData = await res.json();
        console.log('[diag-cold] /api/evaluate OK (rules=%d)', evalData?.result?.fired_rules?.length ?? 'n/a');
      } else {
        console.warn('[main-pipeline] /api/evaluate returned', res.status, '— using deterministic fallback');
      }
    } catch (err) {
      console.warn('[main-pipeline] /api/evaluate failed/timed out:', err, '— using deterministic fallback');
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

        // On explicit category switch or state machine completion, use ONLY
        // the latest message for signal extraction to avoid prior-category
        // preferences/constraints contaminating the new request.
        // - isFreshCategorySwitch: first-time explicit switch with no prior facts
        // - earlyCategorySwitch: any explicit category switch detected
        // - convModeHint === 'shopping': state machine just completed a budget flow
        //   (e.g. tube amp → DAC → "5000") — allUserText still contains old topology
        const isFreshCategorySwitch = !!(explicitCategorySwitch && activeShoppingCategoryRef.current === explicitCategorySwitch
          && lastShoppingFactsRef.current === null);
        const shoppingInputText = (isFreshCategorySwitch || earlyCategorySwitch || convModeHint === 'shopping') ? submittedText : allUserText;

        // ── Hypothetical (temporary) chain detection — Pass 15 ────
        // When the user names a specific chain in the thread that differs
        // from the saved system, treat that chain as the active reasoning
        // context. The saved system may remain visible in the UI, but must
        // not control shopping, fit, or compatibility reasoning while the
        // hypothetical chain is active.
        //
        // Detection is per-turn; slots accumulate across turns (amp named
        // on turn 1 + dac named on turn 2 → chain has both by turn 2).
        // The ref persists across turns; full reset happens on mode exit.
        const turnHypChain = detectHypotheticalChain(`${submittedText}\n${allUserText}`);
        if (turnHypChain) {
          const prev = hypotheticalChainRef.current;
          if (!prev) {
            hypotheticalChainRef.current = turnHypChain;
            console.log('[hypothetical-chain] detected: amp=%s dac=%s speaker=%s',
              turnHypChain.amp?.name ?? '-', turnHypChain.dac?.name ?? '-', turnHypChain.speaker?.name ?? '-');
          } else {
            // Merge: newly-named slots override previous values for the
            // same role. "terminator - not entry level" refines the DAC
            // slot after an earlier "denafrips dac" was less specific.
            const merged: HypotheticalChain = {
              amp: turnHypChain.amp ?? prev.amp,
              dac: turnHypChain.dac ?? prev.dac,
              speaker: turnHypChain.speaker ?? prev.speaker,
              headphone: turnHypChain.headphone ?? prev.headphone,
              componentNames: Array.from(new Set([...prev.componentNames, ...turnHypChain.componentNames])),
              hasExternalAmplification: !!(turnHypChain.amp ?? prev.amp),
            };
            hypotheticalChainRef.current = merged;
          }
        }
        const activeHypChain = hypotheticalChainRef.current;
        const hypComponents = chainToComponentNames(activeHypChain);

        // Pass 16: HARD OVERRIDE — when a hypothetical chain is active, it
        // takes ABSOLUTE precedence over the saved system. The saved system's
        // component names, tendencies, location, and savedSystemNote must
        // NOT be injected into shopping reasoning, even if the chain is
        // partial (e.g. only the amp slot is filled).
        //
        // Strict priority:
        //   activeHypChain present → hypComponents (may be undefined if
        //                             chain is empty — still no saved leak)
        //   → else advisoryCtx.systemComponents
        //   → else saved activeComponentNames
        //
        // We also mutate advisoryCtx in place so every downstream caller
        // (buildShoppingAnswer, shoppingToAdvisory, secondary dispatch,
        // editorial overlay, etc.) sees ONLY the hypothetical chain, never
        // the saved system. This is the single chokepoint.
        const shoppingSystemComponents = activeHypChain
          ? hypComponents
          : (advisoryCtx.systemComponents
              ?? (turnCtx.activeSystem && activeComponentNames ? activeComponentNames : undefined));
        if (activeHypChain) {
          console.log('[hypothetical-chain] HARD OVERRIDE — suppressing saved system (hyp components=%d, saved present=%s)',
            hypComponents?.length ?? 0, !!advisoryCtx.systemComponents);
          // Purge saved-system fields from advisoryCtx so downstream text
          // generation (savedSystemNote, "Evaluated against your chain",
          // "In your system", editorial preamble) cannot reference the
          // saved chain. Replace with hypothetical chain components when
          // available; otherwise leave undefined so callers emit neutral
          // phrasing.
          advisoryCtx.systemComponents = hypComponents;
          advisoryCtx.savedSystemNote = undefined;
          advisoryCtx.systemTendencies = undefined;
          advisoryCtx.systemLocation = undefined;
          advisoryCtx.systemPrimaryUse = undefined;
        }
        const shoppingCtx = detectShoppingIntent(
          shoppingInputText, pipelineSignals, shoppingSystemComponents,
          // On refinement/category-switch turns, pass the latest message so its
          // category takes priority over earlier mentions in allUserText.
          shoppingAnswerCount > 0 ? submittedText : undefined,
          // Category lock: use locked category as fallback so stale allUserText
          // keywords don't override the user's active category on follow-up turns.
          // Phase K — sticky domain continuity: also check facts.domainContext
          // so a turn like "it's noisy" after "recommend a turntable" stays
          // in the turntable domain instead of drifting back to general.
          shoppingAnswerCount > 0
            ? (
              activeShoppingCategoryRef.current
              ?? lastShoppingFactsRef.current?.category
              ?? lastShoppingFactsRef.current?.domainContext
            )
            : undefined,
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
              // Brand rejections persist across refinement turns (M5-F3) —
              // "not the wharfedales" still holds two turns later.
              for (const b of saved.constraints.excludeBrands ?? []) {
                cur.excludeBrands = cur.excludeBrands ?? [];
                if (!cur.excludeBrands.includes(b)) cur.excludeBrands.push(b);
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
          // TYPED CONSTRAINT: an explicit product class named in the current
          // utterance (shoppingCtx.requestedCategory) is immutable and must win
          // over the carried-forward lock. Without this guard, "what other
          // streamers would you recommend?" was force-relabelled to a stale
          // 'dac' lock and answered with DAC education + DAC picks.
          if (lockedCategory && lockedCategory !== 'general' && !explicitCategorySwitch && !shoppingCtx.requestedCategory) {
            if (shoppingCtx.category !== lockedCategory) {
              console.log('[category-lock]', {
                overridden: shoppingCtx.category,
                locked: lockedCategory,
                reason: 'no explicit switch — preserving locked category',
              });
              shoppingCtx.category = lockedCategory;
            }
          } else if (shoppingCtx.requestedCategory && lockedCategory && lockedCategory !== shoppingCtx.requestedCategory) {
            // Explicit class this turn overrides the stale lock and re-arms it.
            console.log('[category-lock] explicit requestedCategory overrides lock', {
              requested: shoppingCtx.requestedCategory, wasLocked: lockedCategory,
            });
            shoppingCtx.category = shoppingCtx.requestedCategory;
            activeShoppingCategoryRef.current = shoppingCtx.requestedCategory;
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
          //
          // Pass 15: when a hypothetical chain is active, its resolved
          // brand+name strings are seeded into engagedNames on every turn
          // (not just refinements). This drives the anchor + tier-floor
          // logic in rankProducts for the thread's declared components —
          // e.g. a named "Denafrips Terminator II" anchors at position 0
          // and drops the cheaper Ares/Pontus from the same shortlist.
          const baseEngagedNames = shoppingAnswerCount > 0
            ? extractSubjectMatches(allUserText)
                .filter((m) => m.kind === 'product')
                .map((m) => m.name)
            : undefined;
          const hypEngaged = activeHypChain?.componentNames ?? [];
          const engagedNames = hypEngaged.length > 0
            ? Array.from(new Set([...(baseEngagedNames ?? []), ...hypEngaged]))
            : baseEngagedNames;

          // Detect selection mode for 4-option anchor override
          const selectionMode = detectSelectionMode(submittedText);
          if (selectionMode !== 'default') {
            console.log('[selection-mode]', { input: submittedText, mode: selectionMode });
          }

          // Extract brand constraint from current-turn subject matches.
          // If no explicit brand subject, infer from a product subject via catalog lookup
          // (e.g., "and the ares?" → catalog finds Denafrips Ares 15th → brand = "denafrips").
          // Boost guard (M5-F3, 2026-08-11): a brand the user is
          // EXCLUDING this turn ("no klipsch please") must never become
          // a positive brand constraint — the subject match alone made
          // the rejection boost the rejected brand.
          const excludedThisTurn = new Set(extractBrandExclusions(submittedText));
          const brandSubject = turnCtx.subjectMatches.find(
            (m) => m.kind === 'brand' && !m.parenthetical && !excludedThisTurn.has(m.name.toLowerCase()),
          );
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

          // ── GTM Phase 4 empty-turn guard ─────────────────
          // A shopping answer with zero product options is an empty
          // shell — the render is a canned sentence plus a taste
          // question and nothing to buy (benchmark PD-04, CG-04,
          // LS-02, LS-03). Conservative condition: only when there
          // are NO products at all; any populated answer renders
          // exactly as before.
          // Exception (2026-08-13): a coverage gap is NOT an empty shell.
          // When the category is servable but the catalogue holds nothing
          // inside the stated budget, the answer carries an explicit
          // explanation ("No in-ear monitor in this catalogue falls under
          // $75 — coverage starts at $80"). Falling back to the knowledge
          // lane here replaced that honest, catalogue-grounded limit with
          // generative prose about products we do not carry — which is both
          // less useful and a D-7 violation (claims beyond our evidence).
          if (!answer.productExamples || answer.productExamples.length === 0) {
            if (answer.coverageGap) {
              console.log('[shopping-empty] coverage gap for %s under $%d — rendering the honest limit',
                shoppingCtx.category, answer.coverageGap.budget);
            } else {
              console.log('[shopping-empty] no products for %s — knowledge-lane fallback', shoppingCtx.category);
              runKnowledgeLane();
              return;
            }
          }

          // ── FINAL FAIL-CLOSED VALIDATOR ───────────────────
          // Last line of defense for the licensed-category invariant (the
          // streamer→DAC production failure). If the composed answer violates
          // the class the user is entitled to — wrong resolved category, a
          // preamble for a different class, or a cross-class product — we do
          // NOT render it. Hard violations withhold and re-route to the
          // knowledge lane rather than emit a mis-directed recommendation.
          {
            const validation = validateShoppingAnswer(
              shoppingCtx,
              answer,
              advisoryCtx.systemComponents ?? [],
            );
            if (validation.soft.length > 0) {
              console.warn('[shopping-validate] soft', validation.soft);
            }
            if (!validation.ok) {
              console.error('[shopping-validate] HARD violation — withholding answer', {
                category: shoppingCtx.category,
                requestedCategory: shoppingCtx.requestedCategory,
                violations: validation.hard,
              });
              // Remove any out-of-class products; if a conforming subset
              // survives AND the only violations were product-level, render the
              // cleaned set. Otherwise fail closed to the knowledge lane.
              const onlyProductViolations = validation.hard.every(
                (v) => v.code === 'product-out-of-class',
              );
              if (onlyProductViolations && validation.conformingProducts.length > 0) {
                console.warn('[shopping-validate] rendering %d conforming products (dropped %d out-of-class)',
                  validation.conformingProducts.length,
                  answer.productExamples.length - validation.conformingProducts.length);
                answer.productExamples = validation.conformingProducts;
              } else {
                runKnowledgeLane();
                return;
              }
            }
          }

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
            // D6 (2026-08-11): pass the current turn's desires so the
            // reflection never names an explicitly requested quality as
            // a depriority (persisted profile must not contradict the
            // present request).
            const tasteReflectionText = buildTasteReflection(listenerProfileRef.current, turnCtx.desires);
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
                // Trust-layer pass: orchestrator render path uses
                // validated LLM prose over deterministic catalog
                // selection. Mark as 'hybrid' for observability — no
                // visible UI distinction (treated as 'core' by
                // ResponseHeader). The deterministic catalog/selection
                // structure is intact.
                adapted.reasoningMode = 'hybrid';
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
                reason: top.fitNote || top.character || 'Strongest overall match in this set.',
              },
              alternative: {
                name: alt.name ?? '',
                brand: alt.brand ?? '',
                reason: alt.fitNote || alt.character || 'A different trade-off — leans the other direction on flow vs detail.',
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

          // ── Store product names for refinement (Prompt 3) ──
          // After dispatching shopping advisory, preserve product names in
          // convState so the next turn can detect refinement and re-rank.
          if (finalAdvisory.options && finalAdvisory.options.length > 0) {
            const productNames = finalAdvisory.options.map(
              (o) => `${o.brand ?? ''} ${o.name ?? ''}`.trim(),
            );
            convStateRef.current = {
              mode: 'shopping',
              stage: 'done',
              facts: {
                priorProductNames: productNames,
                priorCategory: shoppingCtx.category,
                priorBudget: lastShoppingFactsRef.current?.budget,
                category: shoppingCtx.category,
                budget: lastShoppingFactsRef.current?.budget,
                domainContext: shoppingCtx.category as string,
              },
            };
            console.log('[refinement-store] stored %d product names for future refinement: %s',
              productNames.length, productNames.join(', '));
          }

          // ── Multi-category follow-up ──────────────────────
          // Pass 16 SINGLE-PANEL RULE: IF the current turn has a definite
          // category (not 'general'/'unknown'), render ONLY that category
          // block. The secondary panel is suppressed entirely — no stale
          // DAC panel trailing a speaker recommendation, no amp panel
          // trailing a DAC recommendation.
          //
          // The only remaining path to a secondary panel is an EXPLICIT,
          // neutral multi-category query where the current turn did not
          // narrow to a single category (no early switch, no priority
          // override, no verb directive, no hypothetical chain anchor).
          const isSingleCategoryTurn =
            !!activeHypChain
            || !!earlyCategorySwitch
            || !!verbDirectiveSwitch
            || !!priorityOverride
            || (shoppingCtx.category !== 'general' && shoppingAnswerCount > 0);
          const shouldDispatchSecondary =
            !isSingleCategoryTurn
            && !!shoppingCtx.secondaryCategory
            && shoppingCtx.secondaryCategory !== 'general'
            && shoppingCtx.secondaryCategory !== shoppingCtx.category;
          if (!shouldDispatchSecondary && shoppingCtx.secondaryCategory) {
            console.log('[single-panel] suppressing secondary=%s (primary=%s, hypChain=%s, earlySwitch=%s, priorityOverride=%s)',
              shoppingCtx.secondaryCategory, shoppingCtx.category,
              !!activeHypChain, !!earlyCategorySwitch, !!priorityOverride);
          }
          if (shouldDispatchSecondary) {
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
            // Pass 16: when a hypothetical chain is active, the editorial
            // overlay must see ONLY the hypothetical components, never the
            // saved turnCtx.activeSystem — otherwise LLM prose will re-inject
            // saved-system names ("WLM Diva / Job Integrated / Chord Hugo").
            const editorialSystemComponents = activeHypChain
              ? hypComponents
              : (turnCtx.activeSystem
                  ? turnCtx.activeSystem.components.map((c) =>
                      c.name.toLowerCase().startsWith(c.brand.toLowerCase())
                        ? c.name
                        : `${c.brand} ${c.name}`,
                    )
                  : undefined);
            const editorialSystemCharacter = activeHypChain
              ? undefined
              : (turnCtx.activeSystem?.tendencies ?? undefined);
            const editorialContext: ShoppingEditorialContext = {
              // System
              systemComponents: editorialSystemComponents,
              systemCharacter: editorialSystemCharacter,
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
              // Phase C blocker fix #4: pull brand/product names out of the
              // user's query and surface them as the PRIMARY system-fit
              // anchor so the LLM does not silently swap the user-named
              // component ("for Harbeth") with the saved-system speaker.
              queryAnchors: (() => {
                const anchors = turnCtx.subjectMatches
                  .filter((m) => m.kind === 'brand' || m.kind === 'product')
                  .map((m) => m.name)
                  .filter((n, i, arr) => arr.indexOf(n) === i);
                return anchors.length > 0 ? anchors : undefined;
              })(),
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
                    // Trust-layer pass: shopping editorial overlay
                    // merged validated LLM prose into the deterministic
                    // recommendation set. Mark as 'hybrid' for
                    // observability — no UI signal (treated as 'core').
                    reasoningMode: 'hybrid',
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
            // Brand rejections accumulate like topology exclusions (M5-F3).
            excludeBrands: [
              ...new Set([
                ...(lastShoppingFactsRef.current?.constraints?.excludeBrands ?? []),
                ...(shoppingCtx.constraints.excludeBrands ?? []),
              ]),
            ],
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
          pendingClarificationRef.current = { kind: 'churn_reflection', originalRequest: submittedText };
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
      // A judgment request about the whole system must not be hijacked into
      // component troubleshooting just because it names component categories
      // (Mission 4B, 2026-08-10: "my system: <dac>, <amp>, <speakers> — how
      // does it hang together?" was answered with "let's figure out what's
      // going on with your DAC. Does it sound thin, digital…"). Skipping the
      // map lets getClarificationQuestion's system ask fire, which arms the
      // pending-clarification state and leads to a real assessment.
      const isSystemJudgment = SYSTEM_JUDGMENT_REQUEST.test(submittedText) && !hasSymptomSignals;
      if (!hasSymptomSignals && intent === 'diagnosis' && !isSystemJudgment) {
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
          // Arm the pending-clarification state when the ask is for the
          // system itself, so the next turn's answer is reunited with this
          // request instead of re-entering the pipeline cold.
          if (clarification.question === SYSTEM_COMPONENTS_QUESTION) {
            pendingClarificationRef.current = { kind: 'system_components', originalRequest: submittedText };
          }
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
    } finally {
      // Phase 5 resilience: guarantee the loading state always clears, even
      // if an unexpected exception slips past the inner handlers — unless an
      // async lane has taken ownership and will clear it when its answer
      // arrives. Clearing here would tell the user the turn is finished while
      // only a placeholder is on screen.
      if (!asyncLaneOwnsLoading) {
        dispatch({ type: 'SET_LOADING', value: false });
      }
    }
  // GTM Bug 2 (2026-07-07): pendingImages was missing from this list, so
  // an image-only submit read the initial empty array from a stale
  // closure and silently returned — attached OR pasted images only ever
  // submitted if the user also typed text afterwards.
  }, [currentInput, isLoading, messages, turnCount, tasteProfile, state.activeMode, audioState, pendingImages]);

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
      const turnCtx = buildTurnContext(syntheticQuery, audioState, dismissedFingerprintsRef.current, state.listenerPreferenceProfile);
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
    // Mission 3 F4 (2026-08-10): "Start over" reset the transcript but not
    // the conversation-scoped context, so the previous thread's
    // inline-stated system leaked into the next one ("WHAT I'M WORKING
    // WITH: Denafrips Pontus II → Leben CS600X" on a fresh 'recommend an
    // integrated amp' conversation) and shopping facts/category/chain
    // carried across resets. Saved systems are durable user data and are
    // deliberately NOT cleared here.
    audioDispatch({ type: 'SET_PROPOSED_SYSTEM', proposed: null });
    dismissedFingerprintsRef.current = new Set();
    lastShoppingFactsRef.current = null;
    activeShoppingCategoryRef.current = null;
    hypotheticalChainRef.current = null;
    engagedProductsRef.current = new Map();
    lastAnchorRef.current = null;
    recentShoppingProductsRef.current = [];
    skipToSuggestionsRef.current = false;
    pendingClarificationRef.current = null;
    consumedClarificationRef.current = null;
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
        // Pass 10 (visual polish): the flat warm-cream backdrop
        // Phase 2 palette normalization: flat warm off-white. The earlier
        // cream→beige gradient + tinted central column read muddy and
        // contradicted the editorial direction. A single calm tone keeps
        // the page integrated and lets the hero typography carry the
        // visual weight, not the surface.
        background: EDITORIAL.paper,
        minHeight: '100vh',
        width: '100%',
      }}
    >
    {/* Workspace shell — 3-column grid on desktop (left rail + main +
     *  right rail), collapses progressively below tablet/mobile widths.
     *  This is layout architecture only: no routing change, no advisory
     *  rendering change, no engine touch.
     *
     *  Dimensions (refined 2026-05-09):
     *    Left rail    184px      atmospheric, navigational
     *    Main column  ≤ 820px    existing content, capped to keep the
     *                            reading measure honest at wide viewports
     *    Right rail   296px      semantic context (Listener / System /
     *                            Recent)
     *    Gap          1.5rem (24px)
     *    Outer max    LAYOUT.pageMax (1440)
     *
     *  Total at full grid: 184 + 820 + 296 + 48 (two gaps) = 1348px,
     *  comfortably under the 1360px content area at pageMax with
     *  2.5rem padding both sides.
     *
     *  Responsive: see globals.css `audioxx-workspace-grid` rules. */}
    <div
      className="audioxx-workspace-grid"
      style={{
        maxWidth: hasMessages ? LAYOUT.pageMax : 880,
        margin: '0 auto',
        // 2026-06-30 editorial recomposition: on the homepage (!hasMessages)
        // the page is a single editorial column — no workspace rails, no
        // utility sidebar, no chrome competing with the cover composition.
        // The rails return during conversation so the workspace surfaces
        // (Conversation/Systems/Listening profile on the left, SYSTEM
        // metadata on the right) are present once the visitor is reading
        // an article-in-progress. Generous top padding on the homepage
        // so the editorial cover breathes; tighter during conversation.
        // Phase 2A: cover top padding scales with viewport height so the
        // full composition (rubric → headline → dek → composer → example
        // line) sits within one desktop frame.
        padding: hasMessages ? '4rem 2.5rem 3rem' : 'clamp(2rem, 5vh, 3.25rem) 2.5rem 3rem',
        color: EDITORIAL.ink,
        lineHeight: 1.6,
        display: 'grid',
        gridTemplateColumns: hasMessages
          ? '184px minmax(0, 820px) 296px'
          : 'minmax(0, 1fr)',
        gap: '1.5rem',
        alignItems: 'start',
      }}
    >
      {hasMessages && <LeftRail onReset={handleReset} />}

      <div className="audioxx-workspace-main" style={{ minWidth: 0 }}>
      {/*
        2026-06-30 editorial recomposition:
        The hero accent rule, the center "Audio XX" wordmark h1, and the
        SystemBadge area below are CONVERSATION chrome — they make sense
        once the visitor is reading their assessment-in-progress, but on
        the homepage cover they compete with the editorial lede for
        attention. They render only when hasMessages now. The Nav's
        wordmark carries identity on the homepage; the active-system
        chain is absorbed into the editorial credit line below the
        headline pair.
      */}
      {hasMessages && <div
        className="audioxx-hero-accent"
        onClick={() => handleReset()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleReset(); }}
        style={{
          borderTop: '2.5px solid #C83A3A',
          width: 40,
          marginBottom: '2rem',
          cursor: 'pointer',
        }}
      />}

      {/*
        2026-06-30 editorial recomposition: this center wordmark is
        hasMessages-only. The homepage cover gets its identity from
        the Nav's masthead wordmark above; rendering AUDIO XX twice
        on the cover would be chrome-redundant. During conversation
        the wordmark stays as a reset affordance.
      */}
      {hasMessages && <h1
        className="audioxx-hero-wordmark"
        onClick={() => handleReset()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleReset(); }}
        style={{
          margin: '0 0 0.85rem 0',
          fontSize: '1.3rem',
          fontWeight: 600,
          letterSpacing: '-0.015em',
          lineHeight: 1.2,
          color: '#2A2A2A',
          cursor: 'pointer',
        }}
      >
        {/* XX picks up the restrained brand red (#C83A3A) — pass-8
         *  subtle accent restoration. Quieter than the saturated reds
         *  used by the radar/profile palette so it reads as identity
         *  rather than competing with the analytical color language. */}
        Audio <span style={{ color: '#C83A3A' }}>XX</span>
      </h1>}

      {/*
        SystemBadge area is hasMessages-only. On the homepage cover the
        active system is named in the editorial credit line below the
        headline; rendering a SystemBadge here would duplicate the same
        information in two different visual idioms.
      */}
      {hasMessages && <div className="audioxx-hero-system-badge" style={{ position: 'relative', marginBottom: '0.7rem' }}>
        <SystemBadge onClick={() => setSystemPanelOpen((v) => !v)} />
        {/* Stage 7.1: the fresh-visitor "Add your system" CTA was moved
         *  out of this inline-link position and re-rendered as a small
         *  primary CTA directly above the textarea (see further down in
         *  this component). The CTA target — opening the SystemPanel —
         *  is unchanged; only the visual treatment and placement moved.
         *  Multi-system selection and active-system display continue to
         *  live in SystemBadge above. */}
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
            onSwitch={(name) => showToast(`Switched to: ${name}`)}
          />
        )}
      </div>}

      {/* Helper text was homepage-only; replaced by the editorial active-
       *  system credit line in the new !hasMessages composition below. */}

      {/* Listener profile badge — visible during conversation when profile has data */}
      {hasMessages && profileSnapshot && (
        <ListenerProfileBadge snapshot={profileSnapshot} />
      )}

      {/* Stage PB2.3 — listener preference panel (phrase-level lean). Shown
          once we have at least 2-3 signals (confidence > 0.2). One short
          observational sentence with uncertainty language. Hidden until
          renderProfileSummary returns text — default profile renders to ''. */}
      {hasMessages
        && (state.listenerPreferenceProfile?.confidence ?? 0) > 0.2
        && (() => {
          const summary = renderListenerPreferenceSummary(
            state.listenerPreferenceProfile ?? createDefaultListenerPreferenceProfile(),
          );
          if (!summary) return null;
          return (
            <div
              role="note"
              aria-label="What you seem to value"
              style={{
                padding: '0.55rem 0.85rem',
                border: `1px solid ${COLOR.borderLight}`,
                borderRadius: 8,
                background: COLOR.cardBg,
                marginBottom: '0.75rem',
              }}
            >
              <div
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase' as const,
                  color: COLOR.textMuted,
                  marginBottom: '0.3rem',
                }}
              >
                What you seem to value
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.82rem',
                  lineHeight: 1.45,
                  color: COLOR.textSecondary,
                  fontStyle: 'italic',
                }}
              >
                {summary}
              </p>
            </div>
          );
        })()}

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
            showToast('System saved');
          }}
        />
      )}

      {/*
        ┌────────────────────────────────────────────────────────────┐
        │  2026-06-30 EDITORIAL COVER — Design Doctrine v1            │
        │                                                              │
        │  The homepage is the cover page of an assessment that has    │
        │  not yet been written. The visitor is completing the         │
        │  missing manuscript.                                         │
        │                                                              │
        │  Composition (single column, editorial proportions):         │
        │    ▬ SYSTEM ASSESSMENT  (rubric, small caps + accent rule)   │
        │    Notes on Your System  (headline, Fraunces display)        │
        │    standfirst            (Source Serif italic)               │
        │    ACTIVE SYSTEM credit  (Inter small caps, when applicable) │
        │    ▬ BEGIN HERE          (rubric, above composer)             │
        │    composer              (editorial flow, no card)            │
        │    pull-quote            (Source Serif italic, after Send)   │
        │                                                              │
        │  Removed from prior homepage (the SaaS shell):                │
        │   - center "Audio XX" wordmark   redundant with Nav masthead  │
        │   - SystemBadge area              absorbed into credit line   │
        │   - Two-door block                cover promotes one story    │
        │   - taste-profile widget          chrome competing with cover │
        │   - left workspace nav            hasMessages-only            │
        │   - right LISTENER/SYSTEM rail    hasMessages-only            │
        └────────────────────────────────────────────────────────────┘
      */}
      {!hasMessages && (
        <>
          {/* ── ▬ SYSTEM ASSESSMENT (rubric) ──
           *  Left-aligned article opening (founder, 2026-08-13 — the
           *  centered cover read as small and floating; the entry
           *  surface now opens like the proposal documents: rule +
           *  eyebrow flush left). */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: '0.85rem',
              fontFamily: 'var(--face-grotesque)',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase' as const,
              color: EDITORIAL.inkMuted,
              marginBottom: '1.75rem',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: '1.5rem',
                height: '2px',
                background: EDITORIAL.accent,
              }}
            />
            <span style={{ whiteSpace: 'nowrap' }}>System Assessment</span>
          </div>

          {/* ── Headline + standfirst (article opening) ──
           *  Left-aligned at cover scale — the headline opens the
           *  column like a feature spread, not a floating cover. */}
          <h1
            style={{
              fontFamily: 'var(--face-display)',
              fontWeight: 600,
              fontSize: 'clamp(2.4rem, 6vw, 4.35rem)',
              lineHeight: 1.03,
              letterSpacing: '-0.02em',
              margin: '0 0 1.5rem',
              color: EDITORIAL.ink,
              maxWidth: '16ch',
              textAlign: 'left' as const,
              textWrap: 'balance' as React.CSSProperties['textWrap'],
            }}
          >
            Notes on Your System
          </h1>
          <p
            style={{
              fontFamily: 'var(--face-text)',
              fontStyle: 'italic',
              fontSize: 'clamp(1.1rem, 1.75vw, 1.2rem)',
              lineHeight: 1.55,
              color: EDITORIAL.ink,
              margin: 0,
              maxWidth: '46ch',
              textAlign: 'left' as const,
              textWrap: 'pretty' as React.CSSProperties['textWrap'],
            }}
          >
            Audio XX is a system-level listening advisor for{' '}
            <span style={{ whiteSpace: 'nowrap' }}>hi-fi</span> enthusiasts.
            It explains how your components work together, identifies real
            bottlenecks, and tells you when nothing needs changing.
          </p>

          {/* ── Active system credit line ── */}
          {(() => {
            const ref = audioState.activeSystemRef;
            let name: string | undefined;
            let components: Array<{ brand?: string | null; name?: string | null }> = [];
            if (!ref) {
              if (audioState.savedSystems.length === 1) {
                name = audioState.savedSystems[0].name;
                components = audioState.savedSystems[0].components;
              }
            } else if (ref.kind === 'draft' && audioState.draftSystem) {
              name = audioState.draftSystem.name;
              components = audioState.draftSystem.components;
            } else if (ref.kind === 'saved') {
              const saved = audioState.savedSystems.find((s) => s.id === ref.id);
              if (saved) {
                name = saved.name;
                components = saved.components;
              }
            }
            if (!name || components.length === 0) return null;
            const labels = components.map((c) => {
              const b = (c.brand || '').trim();
              const n = (c.name || '').trim();
              return b && !n.toLowerCase().startsWith(b.toLowerCase())
                ? `${b} ${n}` : n || b || 'Unknown';
            });
            return (
              <div
                style={{
                  fontFamily: 'var(--face-grotesque)',
                  fontSize: '0.75rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase' as const,
                  color: EDITORIAL.inkMuted,
                  marginTop: '3rem',
                  lineHeight: 1.7,
                  textAlign: 'left' as const,
                }}
              >
                <div style={{ color: EDITORIAL.ink, fontWeight: 600 }}>
                  Active system · {name}
                </div>
                <div style={{ textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--face-text)', fontSize: '1.0625rem', color: EDITORIAL.inkMuted, marginTop: '0.35rem' }}>
                  {labels.join(' · ')}
                </div>
                {/* Assess the active system — deterministic entry to the
                 *  assessment pipeline.
                 *
                 *  This composes the ONE phrasing the pipeline is proven on
                 *  ("Assess my system: A, B, C") rather than sending the
                 *  chain as free text. That distinction is the whole point:
                 *  the same three components routed to a gear comparison when
                 *  submitted as "A · B · C", and blocked on a role-clarification
                 *  when submitted as "DAC A Amplifier B Speakers C", but
                 *  produced a correct full assessment in this form. The engine
                 *  was never the problem — reaching it reliably was.
                 *
                 *  Uses the existing handleSubmit path; no new API, no new
                 *  engine route, no change to intent classification. */}
                <button
                  type="button"
                  onClick={() => handleSubmit(
                    `Assess my system: ${labels.join(', ')}`,
                    { source: 'fresh' },
                  )}
                  disabled={isLoading}
                  style={{
                    display: 'inline-block',
                    marginTop: '0.7rem',
                    padding: '0.4rem 0.9rem',
                    fontFamily: 'var(--face-grotesque)',
                    fontSize: '0.75rem',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase' as const,
                    color: isLoading ? EDITORIAL.inkMuted : EDITORIAL.ink,
                    background: 'transparent',
                    border: `1px solid ${EDITORIAL.hairline}`,
                    borderRadius: 4,
                    cursor: isLoading ? 'default' : 'pointer',
                  }}
                >
                  Assess this system
                </button>
                <Link
                  href="/systems"
                  style={{
                    display: 'inline-block',
                    marginTop: '0.5rem',
                    fontSize: '0.75rem',
                    letterSpacing: '0.08em',
                    color: EDITORIAL.inkMuted,
                    textDecoration: 'none',
                    borderBottom: `1px solid ${EDITORIAL.hairline}`,
                    paddingBottom: '1px',
                  }}
                >
                  change
                </Link>
              </div>
            );
          })()}

          {/* ── ▬ BEGIN HERE (rubric, above composer) ──
           *  Flush left with a single leading rule, mirroring the
           *  opening rubric. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: '0.85rem',
              fontFamily: 'var(--face-grotesque)',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase' as const,
              color: EDITORIAL.inkMuted,
              marginTop: '2.75rem',
              marginBottom: '1rem',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: '1.5rem',
                height: '2px',
                background: EDITORIAL.accent,
              }}
            />
            <span style={{ whiteSpace: 'nowrap' }}>Begin Here</span>
          </div>

          {/* ── MVP M1: Build Your System — the primary interaction. ──
           *  Catalog typeahead over the static index; free text stands as
           *  typed; CTA navigates to the self-contained assessment URL.
           *  The conversational composer below remains the secondary path
           *  and the full advisory surface. */}
          <div style={{ marginTop: '1.5rem' }}>
            <SystemBuilder />
          </div>

          <div
            style={{
              fontFamily: 'var(--face-grotesque)',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase' as const,
              color: EDITORIAL.faint,
              textAlign: 'left' as const,
              marginTop: '3.25rem',
              marginBottom: '1rem',
            }}
          >
            Or describe it in your own words
          </div>

          {/* Composer follows below (rendered once for both states; styling
           *  conditions on hasMessages so the editorial flow on the homepage
           *  has no card border and the conversation surface keeps its
           *  bordered composer chrome). */}

        </>
      )}

      {/* Conversation thread.
       * Pass 9: widened to LAYOUT.conversationMax so product cards inside
       * can breathe horizontally on desktop while text-heavy assistant
       * messages still wrap at a comfortable measure (handled per-block
       * inside MessageBubble / AdvisoryMessage). */}
      {hasMessages && (
        <div style={{
          marginTop: '0.75rem',
          marginBottom: '1.5rem',
          maxWidth: LAYOUT.conversationMax,
        }}>
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
                data-msg-anchor
                style={{
                  animation: 'fadeInUp 0.3s ease-out both',
                  animationDelay: `${Math.min(i * 0.05, 0.3)}s`,
                  // Breathing room under the nav when scrolled to start (UX-1).
                  scrollMarginTop: '84px',
                }}
              >
                <MessageBubble
                  message={msg}
                  onIntakeSubmit={handleSubmit}
                  onPreferenceCapture={handlePreferenceCapture}
                  onFollowUpClick={(text) => handleSubmit(text, { source: 'follow-up' })}
                />
              </div>
            ))}
          {/* Trust pass (Product Lead, cycle 1): the post-assessment "Did this
           * help? Yes/No" survey was the single strongest "this is a chatbot,
           * not an advisor" tell — an admin coda landing exactly where the
           * consultation should end at maximum confidence. Removed so the
           * experience closes on the advice, not a satisfaction poll. */}
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

      {/* Stage 7.1 "Add your system" standalone CTA was removed in the
       * Phase 2 presentation redesign to reduce competing primary
       * actions on the landing surface. The two-door block above now
       * carries the primary call to action ("Assess my system" focuses
       * the entry field below), and system creation remains reachable
       * from the SystemBadge / SystemPanel above the hero. */}

      {/* Input area — hidden when an intake form is active (it has its own Submit).
       *
       * Phase 1 editorial refresh (landing state):
       *   - thin hairline border using the editorial rule color
       *   - no resting shadow — the field sits flat on the white surface
       *   - calmer focus state (subtle ink underline, no halo)
       *   - column width matches EDITORIAL.narrow so the input aligns
       *     with the hero text above it
       *
       * Conversation state retains its existing visual weight (compact,
       * slate-bordered) — the editorial treatment applies to entry only.
       */}
      {!hasPendingIntake && <div data-print-hide style={{ marginBottom: '1rem', maxWidth: hasMessages ? LAYOUT.textMax : EDITORIAL.narrow, margin: '0 0 1rem' }}>
        <textarea
          ref={textareaRef}
          id="audio-input"
          value={currentInput}
          onChange={(e) => dispatch({ type: 'SET_INPUT', value: e.target.value })}
          onKeyDown={handleKeyDown}
          onPaste={handleComposerPaste}
          placeholder={
            hasPendingQuestion
              ? 'Reply here…'
              : hasMessages
                ? 'Continue describing your system, what you value, or what you\'re considering…'
                : dynamicPlaceholder
          }
          className={hasMessages ? '' : 'audioxx-editorial-input'}
          style={{
            width: '100%',
            // Editorial composer (!hasMessages). Mike (2026-07-16, prod
            // review): the field is white so it reads clearly against
            // the cream paper, and the height auto-grows to fit the
            // content (see the effect on currentInput below) — the
            // signed-in system autofill was clipping at a fixed height
            // with the resize grip hidden.
            minHeight: hasMessages ? 72 : 148,
            padding: hasMessages ? '1rem 1.1rem' : '1.1rem 1.1rem',
            border: hasMessages ? `1.5px solid ${COLOR.border}` : `1px solid ${EDITORIAL.hairline}`,
            borderRadius: hasMessages ? 10 : 4,
            outline: 'none',
            fontSize: hasMessages ? '0.98rem' : '1.0625rem',
            lineHeight: hasMessages ? 1.55 : 1.65,
            // Editorial QA: no resize grip on the cover — the field
            // grows itself to fit its content instead.
            resize: hasMessages ? 'vertical' : 'none',
            overflow: hasMessages ? undefined : 'hidden',
            background: hasMessages ? COLOR.inputBg : '#FFFFFF',
            color: hasMessages ? COLOR.textPrimary : EDITORIAL.ink,
            boxSizing: 'border-box',
            boxShadow: 'none',
            fontFamily: hasMessages ? 'inherit' : 'var(--face-text)',
            transition: 'border-color 0.2s ease',
          }}
          onFocus={(e) => {
            if (hasMessages) {
              e.currentTarget.style.borderColor = COLOR.accent;
              e.currentTarget.style.boxShadow = `0 0 0 3px rgba(31,58,95,0.10)`;
              e.currentTarget.style.background = '#fff';
            } else {
              e.currentTarget.style.borderColor = EDITORIAL.ink;
            }
          }}
          onBlur={(e) => {
            if (hasMessages) {
              e.currentTarget.style.borderColor = COLOR.border;
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.background = COLOR.inputBg;
            } else {
              e.currentTarget.style.borderColor = EDITORIAL.hairline;
            }
          }}
        />

        {/* Listing-evaluation upload — hidden file input + subtle entry
         *  point under the textarea. When images are pending, the Send
         *  button switches its disabled-rule so an image-only submission
         *  (no typed text) is allowed. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleImageSelect}
          style={{ display: 'none' }}
        />
        {pendingImages.length > 0 && (
          <div className="audioxx-image-previews">
            {pendingImages.map((src, i) => (
              <div key={i} className="audioxx-image-preview">
                <img src={src} alt={`Listing photo ${i + 1}`} />
                <button
                  type="button"
                  onClick={() => removePendingImage(i)}
                  aria-label={`Remove image ${i + 1}`}
                  className="audioxx-image-preview-remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {imageUploadError && (
          <p className="audioxx-image-upload-error" role="alert">
            {imageUploadError}
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: hasMessages ? 'flex-start' : 'center', gap: '0.85rem', marginTop: hasMessages ? '0.85rem' : '1.25rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isLoading || (!currentInput.trim() && pendingImages.length === 0)}
            style={(() => {
              const inactive = isLoading || (!currentInput.trim() && pendingImages.length === 0);
              return {
                padding: '0.6rem 1.6rem',
                // Editorial QA: on the cover the resting Send is a quiet
                // hairline-outlined mark, not a grey filled pill (a web-form
                // tell). It fills to ink the moment there is text to send.
                // Conversation keeps its existing treatment.
                background: inactive ? (hasMessages ? '#F2F2F2' : 'transparent') : EDITORIAL.ink,
                color: inactive ? (hasMessages ? EDITORIAL.faint : EDITORIAL.inkMuted) : '#FFFFFF',
                border: inactive && !hasMessages ? `1px solid ${EDITORIAL.hairline}` : '1px solid transparent',
                borderRadius: hasMessages ? 4 : 2,
                fontSize: '0.88rem',
                fontWeight: 500,
                letterSpacing: '0.02em',
                cursor: inactive ? 'default' : 'pointer',
                transition: 'background 0.15s ease, border-color 0.15s ease',
              };
            })()}
            onMouseEnter={(e) => {
              if (!isLoading && (currentInput.trim() || pendingImages.length > 0)) {
                e.currentTarget.style.background = EDITORIAL.buttonHover;
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading && (currentInput.trim() || pendingImages.length > 0)) {
                e.currentTarget.style.background = EDITORIAL.ink;
              }
            }}
          >
            {isLoading
              ? 'Thinking…'
              : pendingImages.length > 0
                ? 'Evaluate listing'
                : 'Send'}
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || pendingImages.length >= 3}
            className="audioxx-image-upload-button"
            aria-label="Upload listing image"
            title="Upload listing image"
            // Editorial QA: on the cover the paperclip loses its boxed
            // button chrome — a quiet inline mark beside Send. The
            // conversation composer keeps the bordered treatment.
            style={hasMessages ? undefined : { background: 'transparent', border: 'none', boxShadow: 'none' }}
          >
            <span aria-hidden="true" className="audioxx-image-upload-icon">
              {'📎'}
            </span>
          </button>

        </div>

        {/* HELP US IMPROVE — once per conversation, BELOW the reply box,
          * joined to the most recent advisory so feedback stays attributable.
          * Blue-eyebrow tinted card: product chrome, visually distinct from
          * both the editorial advisory above and the composer it follows. */}
        {hasMessages && (() => {
          const lastAdvisory = [...state.messages].reverse().find(
            (m) => m.role === 'assistant' && 'kind' in m && m.kind === 'advisory'
              && (m as { advisory?: { kind?: string } }).advisory?.kind !== 'intake'
              && 'id' in m && (m as { id?: string }).id,
          ) as { id?: string } | undefined;
          return lastAdvisory?.id ? <FeedbackPrompt advisoryId={lastAdvisory.id} /> : null;
        })()}

        {/* Editorial secondary entry — the example assessment IS the
         *  publication's strongest proof, so it gets its own centered
         *  line beneath the composer rather than hiding beside Send.
         *  Renders on the homepage only. */}
        {!hasMessages && (
          <div style={{ textAlign: 'center', marginTop: '2.25rem' }}>
            <Link
              href="/artifact?case=flawed"
              style={{
                fontFamily: 'var(--face-text)',
                fontStyle: 'italic',
                fontSize: '1rem',
                color: EDITORIAL.inkMuted,
                textDecoration: 'none',
                borderBottom: `1px solid ${EDITORIAL.hairline}`,
                paddingBottom: '2px',
                transition: 'color 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = EDITORIAL.ink; e.currentTarget.style.borderBottomColor = EDITORIAL.ink; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = EDITORIAL.inkMuted; e.currentTarget.style.borderBottomColor = EDITORIAL.hairline; }}
            >
              Prefer to read first? See an example assessment&nbsp;→
            </Link>
          </div>
        )}

        {/* Editorial pull quote removed 2026-06-30 — Mike's call: the cover
         *  is stronger without a closing aphorism beat. The headline +
         *  standfirst already carry the editorial voice; the pull quote
         *  was adding length without adding clarity. */}

      </div>}

      {/* Footer — "Start over" is always visible below the Send button, so
        * the reset affordance never disappears. "Contact" is kept conditional
        * on `hasMessages` so the fresh-session view (which already shows the
        * "Questions or feedback? hello@audio-xx.com" welcome line above)
        * doesn't render Contact twice. */}
      {/* D1 mobile QA — M4 (2026-05-18).
        * Add `flexWrap: 'wrap'` to the row + `whiteSpace: 'nowrap'` to each
        * child so the row breaks between items at narrow widths instead of
        * splitting individual phrases mid-word ("Start\nover", "Report\nissue"). */}
      {/* Footer / colophon. On the homepage (!hasMessages) this is a
       *  quiet hairline-separated colophon — magazine staff-box
       *  treatment — sitting deep below the pull quote. During
       *  conversation it keeps its current row-of-utility-links style. */}
      <div data-print-hide style={{
        marginTop: hasMessages ? 0 : '5rem',
        paddingTop: hasMessages ? 0 : '1.5rem',
        marginBottom: '1.5rem',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1.5rem',
        alignItems: 'center',
        // Phase 2A: the cover colophon is centered — a magazine staff
        // box, not a row of app utilities. "Start over" is conversation
        // chrome (there is nothing to start over on a fresh cover) and
        // renders only when hasMessages.
        justifyContent: hasMessages ? 'flex-start' : 'center',
        borderTop: hasMessages ? 'none' : `1px solid ${EDITORIAL.hairline}`,
      }}>
        {!hasMessages && (
          <a
            href="mailto:hello@audio-xx.com"
            style={{
              fontFamily: 'var(--face-grotesque)',
              fontSize: '0.75rem',
              letterSpacing: '0.06em',
              color: EDITORIAL.inkMuted,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = EDITORIAL.ink; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = EDITORIAL.inkMuted; }}
          >
            hello@audio-xx.com
          </a>
        )}
        {hasMessages && <button
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
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = COLOR.accent; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = COLOR.textSecondary; }}
        >
          Start over
        </button>}
        {hasMessages && (
          <a
            href="mailto:hello@audio-xx.com"
            style={{
              color: COLOR.textSecondary,
              fontSize: '0.85rem',
              fontFamily: 'inherit',
              textDecoration: 'none',
              letterSpacing: '0.01em',
              transition: 'color 0.15s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = COLOR.accent; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = COLOR.textSecondary; }}
          >
            Contact
          </a>
        )}
        {hasMessages && (
          <a
            href="mailto:hello@audio-xx.com?subject=Audio%20XX%20Issue&body=Describe%20the%20issue%20and%20what%20you%20expected"
            style={{
              color: COLOR.textSecondary,
              fontSize: '0.85rem',
              fontFamily: 'inherit',
              textDecoration: 'none',
              letterSpacing: '0.01em',
              transition: 'color 0.15s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = COLOR.accent; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = COLOR.textSecondary; }}
          >
            Report issue
          </a>
        )}
      </div>

      </div> {/* /audioxx-workspace-main */}

      {hasMessages && <RightRail
        topTraitLabels={
          tasteProfile && tasteProfile.confidence > 0
            ? topTraits(tasteProfile, 3).map((t) => t.label)
            : []
        }
        activeSystemComponents={(() => {
          // Mirror the same chain-resolution logic used by the curated
          // starter prompts above (line ~4174). Active = saved or draft.
          const ref = audioState.activeSystemRef;
          if (!ref) {
            // No active ref but a single saved system → show it
            if (audioState.savedSystems.length === 1) {
              return audioState.savedSystems[0].components.map((c) => {
                const b = (c.brand || '').trim();
                const n = (c.name || '').trim();
                return b && !n.toLowerCase().startsWith(b.toLowerCase())
                  ? `${b} ${n}` : n || b || 'Unknown';
              });
            }
            // 2026-05-11 (Step 7 of 9 — beta path): right-rail population
            // from the conversation's most recent extracted system chain.
            // The engine already extracts the chain from prompts like
            // "Evaluate my system: A → B → C → D" and renders it inside
            // the response (advisory.systemChain.names). Without this
            // fallback the SYSTEM rail stays empty even when the engine
            // is reasoning over a clearly identified chain — a
            // credibility leak ("preferences accumulate here as we talk"
            // / "No system active") that contradicts what the user can
            // see in the response body. Only consulted when no saved or
            // draft system is active.
            for (let i = messages.length - 1; i >= 0; i--) {
              const m = messages[i];
              if (m.role !== 'assistant' || m.kind !== 'advisory') continue;
              const names = m.advisory?.systemChain?.names;
              if (Array.isArray(names) && names.length > 0) {
                return names;
              }
            }
            return [];
          }
          if (ref.kind === 'draft' && audioState.draftSystem) {
            return audioState.draftSystem.components.map((c) => {
              const b = (c.brand || '').trim();
              const n = (c.name || '').trim();
              return b && !n.toLowerCase().startsWith(b.toLowerCase())
                ? `${b} ${n}` : n || b || 'Unknown';
            });
          }
          const saved = audioState.savedSystems.find(
            (s) => ref.kind === 'saved' && s.id === ref.id,
          );
          return saved
            ? saved.components.map((c) => {
                const b = (c.brand || '').trim();
                const n = (c.name || '').trim();
                return b && !n.toLowerCase().startsWith(b.toLowerCase())
                  ? `${b} ${n}` : n || b || 'Unknown';
              })
            : [];
        })()}
        activeSystemName={(() => {
          const ref = audioState.activeSystemRef;
          if (!ref) {
            return audioState.savedSystems.length === 1
              ? audioState.savedSystems[0].name
              : undefined;
          }
          if (ref.kind === 'draft') return audioState.draftSystem?.name;
          return audioState.savedSystems.find(
            (s) => ref.kind === 'saved' && s.id === ref.id,
          )?.name;
        })()}
        recentActivity={(() => {
          // Last 3 USER messages, trimmed to a short label. Skips
          // assistant messages and system-internal entries.
          const userMessages = messages
            .filter((m) => m.role === 'user')
            .map((m) => m.content)
            .reverse()
            .slice(0, 3);
          // Truncate each to a reasonable label length — the rail's
          // CSS `text-overflow: ellipsis` handles overflow visually too.
          return userMessages.map((t) =>
            t.length > 60 ? t.slice(0, 57).trim() + '…' : t,
          );
        })()}
      />}

    </div>

    {/* Toast notification — lightweight feedback for system switch/save */}
    {toastMessage && (
      <div
        key={toastMessage}
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#1F1D1B',
          color: '#FFFFFF',
          padding: '0.55rem 1.2rem',
          borderRadius: 8,
          fontSize: '0.85rem',
          fontWeight: 500,
          letterSpacing: '0.01em',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          zIndex: 9999,
          animation: 'toast-in 0.2s ease-out',
          fontFamily: 'inherit',
        }}
      >
        {toastMessage}
      </div>
    )}
    <style>{`
      @keyframes toast-in {
        from { opacity: 0; transform: translateX(-50%) translateY(8px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    `}</style>

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

function MessageBubble({ message, onIntakeSubmit, onPreferenceCapture, onFollowUpClick }: { message: Message; onIntakeSubmit?: (overrideText?: string) => void; onPreferenceCapture?: (selections: PreferenceSelection[], category: string) => void; onFollowUpClick?: (text: string) => void }) {
  if (message.role === 'user') {
    const images = 'images' in message ? message.images : undefined;
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
            // User message bubble — light neutral grey. Pass-9
            // (2026-05-09) replaced the prior warm beige (#e3dcc8) and
            // the slightly cool chipBorder (#CBD5E1) with neutral
            // greys that match the rest of the workspace's monochrome
            // direction. No warm tint, no blue tint.
            maxWidth: '82%',
            padding: '0.85rem 1.1rem',
            background: '#EDEDED',
            border: '1px solid #E0E0E0',
            borderRadius: '12px 12px 4px 12px',
            color: COLOR.textPrimary,
            fontSize: '0.96rem',
            fontWeight: 500,
            lineHeight: 1.65,
          }}
        >
          {images && images.length > 0 && (
            <div className="audioxx-image-message-thumbs">
              {images.map((src, i) => (
                <img key={i} src={src} alt={`Listing photo ${i + 1}`} />
              ))}
            </div>
          )}
          {message.content || (images && images.length > 0 ? 'Listing photo attached for evaluation.' : '')}
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
        {/* Per-advisory turn marker. The "Audio XX" wordmark text was
         *  removed 2026-05-09 — the persistent left-rail wordmark now
         *  carries identity across the session, so repeating it on every
         *  advisory turn was visual duplication. The dot + top hairline
         *  stay as a quiet turn rhythm marker; the dot uses a light
         *  grey rather than accent color to keep the rhythm calm. */}
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
            background: '#C8C8C8',
            flexShrink: 0,
          }} />
        </div>
        <AdvisoryMessage
          advisory={message.advisory}
          onIntakeSubmit={message.advisory.kind === 'intake' ? onIntakeSubmit : undefined}
          onPreferenceCapture={message.advisory.lowPreferenceSignal ? onPreferenceCapture : undefined}
          onFollowUpClick={onFollowUpClick}
        />
        {/* Validation feedback capture (LB-6). Rendered once beneath a
         *  COMPLETED advisory.
         *
         *  Intake turns are excluded: an intake is a question put to the
         *  reader, not an answer to react to, so asking "was this helpful?"
         *  there would be incoherent.
         *
         *  `advisoryId` is the same message id `assessment_completed`
         *  telemetry already carries, so a feedback event can be joined back
         *  to the advisory that produced it. The id is optional on the
         *  message union (only set when dispatchAdvisory was given one), and
         *  where it is absent we render nothing rather than invent an
         *  identifier that could never be joined — unjoinable feedback is
         *  not evidence.
         *
         *  Uses the existing `feedback_submitted` event and /api/events sink
         *  unchanged; the component dedups per advisory via localStorage. */}
        {/* FeedbackPrompt moved below the composer (founder, 2026-08-28):
          * rendered once per conversation, joined to the latest advisory,
          * so it no longer sits between an advisory and the reply box. */}
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

        {/* Recognised components — compact visual confirmation ("careful
            listening") before the question. Presentation only. */}
        {clarification.recognized && clarification.recognized.length > 0 && (
          <div style={{ marginBottom: '0.85rem' }}>
            <div
              style={{
                fontSize: '0.7rem',
                letterSpacing: '0.09em',
                textTransform: 'uppercase' as const,
                color: COLOR.textMuted,
                marginBottom: '0.4rem',
              }}
            >
              Recognised
            </div>
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.3rem 1.25rem',
              }}
            >
              {clarification.recognized.map((name, i) => (
                <li
                  key={i}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem' }}
                >
                  <span aria-hidden style={{ color: COLOR.accent, fontWeight: 700 }}>✓</span>
                  <span style={{ color: COLOR.textPrimary }}>{name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

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
      {renderNoteContent(message.content)}
    </div>
  );
}

/**
 * Minimal inline Markdown renderer for assistant 'note' messages.
 *
 * Listing-evaluation notes use `## heading`, `- bullet`, and `**bold**`
 * markers. The rest of the codebase's notes are short plain-text
 * strings ("You gain: …\nYou risk: …", listening-mode replies, etc.)
 * that don't use any of these markers — for those, the renderer is a
 * no-op and the original line breaks render via React's natural
 * whitespace handling.
 *
 * Intentionally NOT a full Markdown parser: we handle only the three
 * markers the listing-eval prompt emits. Anything else passes through
 * as plain text. Adding a Markdown dependency would be heavier than
 * the one render path warrants.
 */
/**
 * Self-healing pre-pass for listing-eval responses. If the model
 * obeyed the prompt this is a no-op. If the model dropped the `## `
 * markers or the blank-line breaks (observed in real-world tests
 * where gpt-4o emits "1. Listing read - Brand: … 2. Translation …"
 * as one paragraph), we re-introduce them so the existing renderer
 * can segment the response.
 *
 * Scoped: only the seven known listing-eval section phrases trigger
 * a rewrite, so non-listing notes ("You gain: … You risk: …") are
 * never touched even if they happen to share punctuation.
 */
const LISTING_SECTION_PHRASES = [
  'Listing read',
  'Translation',
  'Likely gear identified',
  'Fit with your system',
  'Risks / missing information',
  'Risks and missing information',
  'Questions to ask the seller',
  'Bottom-line recommendation',
  'Bottom line recommendation',
];

function normalizeListingNote(raw: string): string {
  // If we already have at least three `## ` headings, the model gave
  // us proper Markdown — leave it alone.
  const hashHeadingCount = (raw.match(/(^|\n)##\s+/g) ?? []).length;
  if (hashHeadingCount >= 3) return raw;

  // Match each known section phrase, allowing an optional leading
  // numeric prefix ("1. ", "2) ", "**1.** ") and an optional trailing
  // colon. The captured phrase is rewritten as a standalone `## ` heading
  // separated from surrounding text by blank lines.
  const phraseAlt = LISTING_SECTION_PHRASES.map((p) =>
    p.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'),
  ).join('|');
  const re = new RegExp(
    String.raw`(^|\s|[-*])\*{0,2}\s*\d{0,2}[.)]?\s*\*{0,2}\s*(` +
      phraseAlt +
      String.raw`)\s*:?\s*`,
    'g',
  );

  let hits = 0;
  const normalized = raw.replace(re, (_match, lead, phrase) => {
    hits += 1;
    // Lead may be whitespace or a punctuation char that preceded the
    // section marker mid-paragraph. We always restart with two newlines
    // so the renderer's blank-line rule fires.
    const leadingBreak = lead === '' ? '' : '\n\n';
    return `${leadingBreak}## ${phrase}\n\n`;
  });

  // Only rewrite if at least three section phrases were found — that's
  // strong evidence the content is a listing-eval response. Otherwise
  // hand back the original string untouched.
  return hits >= 3 ? normalized : raw;
}

function renderNoteContent(raw: string): ReactNode {
  const lines = normalizeListingNote(raw).split('\n');
  const blocks: ReactNode[] = [];
  let paragraphBuffer: string[] = [];
  let bulletBuffer: string[] = [];

  const flushParagraph = (key: string) => {
    if (paragraphBuffer.length === 0) return;
    const text = paragraphBuffer.join('\n');
    blocks.push(
      <p key={key} style={{ margin: '0 0 0.6rem 0' }}>
        {renderInline(text)}
      </p>,
    );
    paragraphBuffer = [];
  };
  const flushBullets = (key: string) => {
    if (bulletBuffer.length === 0) return;
    const items = bulletBuffer.slice();
    blocks.push(
      <ul key={key} style={{ margin: '0 0 0.6rem 1.1rem', padding: 0 }}>
        {items.map((item, i) => (
          <li key={i} style={{ marginBottom: '0.2rem' }}>
            {renderInline(item)}
          </li>
        ))}
      </ul>,
    );
    bulletBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s+/.test(line)) {
      flushParagraph(`p-${i}`);
      flushBullets(`u-${i}`);
      const heading = line.replace(/^##\s+/, '');
      blocks.push(
        <h3
          key={`h-${i}`}
          style={{
            margin: '0.9rem 0 0.45rem 0',
            fontSize: '1rem',
            fontWeight: 600,
            color: COLOR.textPrimary,
          }}
        >
          {renderInline(heading)}
        </h3>,
      );
      continue;
    }
    if (/^[-•]\s+/.test(line)) {
      flushParagraph(`p-${i}`);
      bulletBuffer.push(line.replace(/^[-•]\s+/, ''));
      continue;
    }
    if (line.trim() === '') {
      flushParagraph(`p-${i}`);
      flushBullets(`u-${i}`);
      continue;
    }
    flushBullets(`u-${i}`);
    paragraphBuffer.push(line);
  }
  flushParagraph('p-end');
  flushBullets('u-end');

  return blocks.length === 0 ? raw : blocks;
}

/** Inline `**bold**` substitution for note Markdown. */
function renderInline(text: string): ReactNode {
  if (!text.includes('**')) return text;
  const parts: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(<strong key={key++}>{match[1]}</strong>);
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

