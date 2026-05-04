/**
 * Audio XX — Advisory Presentation Layer
 *
 * These files format deterministic reasoning output into the structured
 * system review shown to the user.
 *
 * Important:
 *   The reasoning engine remains the source of truth.
 *   This layer should only:
 *     - format advisory structure
 *     - apply narrative tone
 *     - render UI components
 *   Do NOT add reasoning logic here.
 *
 * ── Rendering modes ──────────────────────────────────
 *
 *   A. Memo format — when structured assessment fields are present
 *      (componentAssessments, upgradePaths, etc.). Renders as a
 *      structured hi-fi system review written by an experienced audiophile.
 *
 *   B. Standard format — existing conditional section rendering with
 *      editorial labels. Used for consultations, shopping, diagnosis,
 *      and any response that doesn't populate memo-specific fields.
 *
 * Only populated sections render in both modes.
 */

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { toSlug } from '../../lib/route-slug';
import type { AdvisoryResponse, AdvisoryMode, AdvisorySource, AudioProfile, ProductAssessment, KnowledgeResponse, AssistantResponse, EditorialClosing, EditorialPick, QuickRecommendation } from '../../lib/advisory-response';
import type { DecisionFrame, DecisionDirection, SystemInteraction } from '../../lib/decision-frame';
import AdvisorySection from './AdvisorySection';
import AdvisoryProse from './AdvisoryProse';
import AdvisoryProductCards, { ShoppingLinks } from './AdvisoryProductCard';
import { DIRECTION_CONTENT } from '../../lib/upgrade-path-content';
import { findProductByComponentName, findBrandProfileByName } from '../../lib/consultation';
import { getProductImage } from '../../lib/product-images';
import AdvisoryLinks from './AdvisoryLinks';
import AdvisorySources from './AdvisorySources';
import AdvisoryDiagnostics from './AdvisoryDiagnostics';
import AdvisoryComponentAssessments from './AdvisoryComponentAssessments';
import AdvisoryUpgradePaths from './AdvisoryUpgradePaths';
import AdvisorySpiderChart from './AdvisorySpiderChart';
import { ProductImageProvider, useProductImageClaim } from './ProductImageContext';
import AdvisoryListenerProfile from './AdvisoryListenerProfile';
import AdvisoryIntake from './AdvisoryIntake';
import { renderText, renderTextWithProductLinks, type ProductUrlMap } from './render-text';

/** Preference selections from the "Start here" quick-capture flow. */
export interface PreferenceSelection {
  axis: string;
  choice: 'a' | 'b';
  label: string;
}

interface AdvisoryMessageProps {
  advisory: AdvisoryResponse;
  /** Callback for intake form submission — threaded to AdvisoryIntake. */
  onIntakeSubmit?: (text: string) => void;
  /** Callback when user completes the "Start here" preference capture flow. */
  onPreferenceCapture?: (selections: PreferenceSelection[], category: string) => void;
}

// ── Design tokens ─────────────────────────────────────
//
// Centralized here for consistency across both rendering modes.

// Palette aligned with page.tsx (single warm-neutral family, no new hues).
// Primary/secondary/muted shifted ~1 step darker to increase contrast against
// the warm page bg (#F7F3EB) so headings, body, and muted labels separate
// more clearly without changing the palette's character.
const COLORS = {
  text: '#1F1D1B',           // was #2a2a2a — matches page.tsx textPrimary; stronger headlines/body
  textSecondary: '#4F4B46',  // was #5a5a5a — warmer dark secondary, higher contrast on warm bg
  textMuted: '#7A756D',      // was #8a8a8a — warm-toned muted, still recedes but legible
  textLight: '#A09B91',      // was #aaa     — warm-neutral
  accent: '#a89870',
  accentLight: '#c8c0a8',
  accentBg: '#faf8f3',
  border: '#E4DFD2',         // was #eeece8 — stronger section/card edge vs warm bg
  borderLight: '#ECE8DD',    // was #f4f2ee — visible but soft dividers
  sectionLabel: '#8E7A4E',   // was #a89870 — same warm-gold family, darker for label-vs-content contrast
  green: '#5a7050',
  amber: '#8a6a50',
  white: '#fff',
  bg: '#fff',
};

const FONTS = {
  bodySize: '1.02rem',
  smallSize: '0.92rem',
  labelSize: '0.82rem',
  sectionHeading: '1.38rem',  // was 1.3rem — slight bump for header dominance
  lineHeight: 1.85,
  labelTracking: '0.08em',    // consistent tracking for uppercase section labels
  labelWeight: 700 as const,  // unified weight for labels (was mixed 600/700)
};

/** Inline bullet list — reused across both modes. */
function BulletList({ items, color }: { items: string[]; color?: string }) {
  return (
    <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: FONTS.lineHeight, color: color ?? COLORS.text }}>
      {items.map((item, i) => (
        <li key={i} style={{ marginBottom: '0.55rem', fontSize: FONTS.bodySize }}>{renderText(item)}</li>
      ))}
    </ul>
  );
}

/** Detect whether the response has memo-format structured fields. */
function isMemoFormat(a: AdvisoryResponse): boolean {
  return !!(
    (a.componentAssessments && a.componentAssessments.length > 0)
    || (a.upgradePaths && a.upgradePaths.length > 0)
    // Rewritten system review: six-section narrative is carried in systemContext.
    // All the legacy structured sections (componentAssessments, upgradePaths, etc.)
    // are intentionally cleared by buildSystemAssessment after narrative composition,
    // so detect memo mode from the advisory mode tag instead.
    || (a.advisoryMode === 'system_review' && !!a.systemContext)
  );
}

/** Subtle section divider. */
function SectionDivider() {
  // Slightly wider margin + stronger border color (via COLORS.border bump) for
  // clearer separation between major advisory blocks without adding new elements.
  return <hr style={{ border: 'none', borderTop: `1px solid ${COLORS.border}`, margin: '3.1rem 0' }} />;
}

/** Mode label display names. */
const MODE_LABELS: Record<AdvisoryMode, string> = {
  system_review: 'System Review',
  gear_advice: 'Gear Advice',
  gear_comparison: 'Gear Comparison',
  upgrade_suggestions: '',  // No label — the Audio Preferences block provides context
  product_assessment: '',   // No label — the assessment format provides its own structure
  audio_knowledge: 'Audio Knowledge',
  audio_assistant: 'Audio Assistant',
  general: 'Advisory',
};

/** Mode awareness indicator — subtle label at the top of the response. */
function ModeIndicator({ mode }: { mode?: AdvisoryMode }) {
  if (!mode || mode === 'general') return null;
  const label = MODE_LABELS[mode];
  if (!label) return null; // No label for this mode (e.g. upgrade_suggestions)
  return (
    <div style={{
      fontSize: '0.72rem',
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
      color: COLORS.accentLight,
      marginBottom: '0.6rem',
    }}>
      {label}
    </div>
  );
}

/** Provenance label — shows when response data comes from LLM inference rather than verified catalog. */
function ProvenanceLabel({ source, unknownComponents }: { source?: AdvisorySource; unknownComponents?: string[] }) {
  if (!source || source === 'catalog' || source === 'brand_profile') return null;

  if (source === 'provisional_system') {
    const unknownList = unknownComponents && unknownComponents.length > 0
      ? `: ${unknownComponents.join(', ')}`
      : '';
    return (
      <div style={{
        fontSize: '0.75rem',
        lineHeight: 1.4,
        color: '#7c5e2a',
        backgroundColor: '#fef6e0',
        border: '1px solid #e8d5a8',
        borderRadius: '4px',
        padding: '0.55rem 0.75rem',
        marginBottom: '0.85rem',
      }}>
        <span style={{ fontWeight: 600 }}>Provisional System Assessment.</span>
        {' '}This system includes components not yet fully mapped in the Audio XX validated catalog{unknownList}. The analysis below is based on general knowledge and their likely interaction. Treat as directional guidance.
      </div>
    );
  }

  return (
    <div style={{
      fontSize: '0.75rem',
      lineHeight: 1.4,
      color: '#96722e',
      backgroundColor: '#fef9ec',
      border: '1px solid #f0e4c4',
      borderRadius: '4px',
      padding: '0.45rem 0.65rem',
      marginBottom: '0.85rem',
    }}>
      <span style={{ fontWeight: 600 }}>Not from verified catalog.</span>
      {' '}This response is based on general knowledge and may contain inaccuracies. Treat as directional guidance, not confirmed data.
    </div>
  );
}

// ── Memo Format Renderer ──────────────────────────────
//
// Structured hi-fi system diagnosis format:
//   1. System Character
//   2. System Signature
//   3. System Synergy
//   4. What the System Does Well
//   5. Trade-offs in the System
//   6. Component Contributions
//   7. System Bottlenecks (moved below components; suppressed for reference-tier systems)
//   8. Upgrade Strategy
//   9. Components Worth Keeping
//  10. Listener Taste Profile

/**
 * Rewritten system review renderer.
 *
 * Parses the six-section narrative carried in `systemContext` and applies
 * section-level styling: constraint section is visually dominant, optimize
 * section is emphasized as the action section, "Do not touch:" renders as
 * a distinct chip row, and the system chain renders as a single deduplicated
 * horizontal line above the narrative.
 *
 * Pure presentation — no wording, logic, or structural changes.
 */
/**
 * Display-only normalization for component names.
 *
 * `normalizeComponentName` title-cases a full component phrase and forces
 * known brand tokens (WLM, JOB, Chord) to their canonical form. Safe to
 * call on standalone names like "wlm diva monitor" → "WLM Diva Monitor".
 *
 * `normalizeBrandCasing` operates on prose: it only rewrites bolded
 * markdown spans (**…**) via `normalizeComponentName` and patches the
 * known all-caps brand tokens as standalone words. It does NOT title-case
 * arbitrary prose words.
 *
 * Presentation-only. Matching logic and internal keys are untouched.
 */
const BRAND_CANONICAL: Record<string, string> = {
  wlm: 'WLM',
  job: 'JOB',
  chord: 'Chord',
};

// Pre-review blocker fix: "job" is also a common English word ("does its job",
// "the job of the amp is to..."), so unconditional standalone replacement
// uppercases it to "JOB" in narrative prose. The bolded-component path
// (normalizeComponentName) already handles canonical brand casing for
// component names like "Job Integrated"; the standalone-prose patch should
// only apply to brand tokens that are unambiguous in free text.
const STANDALONE_BRAND_CANONICAL: Record<string, string> = {
  wlm: 'WLM',
  chord: 'Chord',
};

// Audio-domain acronyms that must stay uppercase even when they appear
// as lowercase model-name tokens ("wlm dac" → "WLM DAC").
const ACRONYM_CANONICAL: Record<string, string> = {
  dac: 'DAC',
  adc: 'ADC',
  set: 'SET',
  nos: 'NOS',
  pse: 'PSE',
  sacd: 'SACD',
  dsd: 'DSD',
  pcm: 'PCM',
  se: 'SE',
  mk: 'Mk',
  ii: 'II',
  iii: 'III',
  iv: 'IV',
};

function titleCaseWord(word: string): string {
  if (!word) return word;
  const lower = word.toLowerCase();
  if (BRAND_CANONICAL[lower]) return BRAND_CANONICAL[lower];
  if (ACRONYM_CANONICAL[lower]) return ACRONYM_CANONICAL[lower];
  // Preserve tokens that already look intentional (all-caps acronyms,
  // mixed case like "McIntosh", numerics like "300B").
  if (/^[A-Z0-9]+$/.test(word) && word.length >= 2) return word;
  if (/[A-Z]/.test(word.slice(1))) return word;
  if (/^\d/.test(word)) return word;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function normalizeComponentName(name: string): string {
  if (!name) return name;
  return name
    .split(/(\s+|-)/)
    .map((tok) => (/^\s+$|^-$/.test(tok) ? tok : titleCaseWord(tok)))
    .join('');
}

function normalizeBrandCasing(text: string): string {
  if (!text) return text;
  // 1. Rewrite any bolded span as a full component phrase.
  let out = text.replace(/\*\*([^*]+)\*\*/g, (_m, inner: string) =>
    `**${normalizeComponentName(inner)}**`,
  );
  // 2. Patch standalone brand tokens in prose (word-bounded, any case).
  // Pre-review blocker fix: use STANDALONE_BRAND_CANONICAL so genuine English
  // words shared with brand names (e.g. "job") are not force-uppercased
  // in narrative copy ("does its job" → "does its JOB"). Bolded component
  // spans still pick up the full BRAND_CANONICAL via normalizeComponentName.
  for (const [lower, canonical] of Object.entries(STANDALONE_BRAND_CANONICAL)) {
    const re = new RegExp(`\\b${lower}\\b`, 'gi');
    out = out.replace(re, canonical);
  }
  // 3. Model-name pass (runs AFTER brand normalization): when a canonical
  //    brand is followed by lowercase model words in prose, title-case
  //    the trailing phrase up to four words, stopping at punctuation or
  //    any already-capitalized token. Known acronyms (DAC, SET, NOS, …)
  //    are forced uppercase via titleCaseWord.
  const brandAlt = Object.values(BRAND_CANONICAL).map(
    (b) => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  ).join('|');
  const modelPass = new RegExp(
    `(\\b(?:${brandAlt})\\b)((?:\\s+[a-z][a-z0-9-]*){1,4})`,
    'g',
  );
  out = out.replace(modelPass, (_m, brand: string, tail: string) => {
    const fixed = tail.replace(/\s+([a-z][a-z0-9-]*)/g, (_s, w: string) =>
      ' ' + titleCaseWord(w),
    );
    return brand + fixed;
  });
  return out;
}

function RewrittenSystemReview({ advisory: a }: AdvisoryMessageProps) {
  // ── Post-response follow-up chip state. ──
  // Chips dispatch in-chat panels rather than navigating away. Selecting
  // a chip toggles its panel open; selecting it again (or clicking the
  // × on the panel) closes it. Only one panel is open at a time — the
  // previous one is replaced rather than accumulated, so the
  // conversation stays tight.
  //
  // Two chip families share this single state so they cannot be open
  // simultaneously:
  //   - the "See recommended upgrades" primary action (kind: 'upgrade').
  //   - the "Do not touch" component chips (kind: 'component'), each
  //     keyed by component name.
  type FollowUpKey =
    | { kind: 'upgrade' }
    | { kind: 'component'; name: string };
  const [activeFollowUp, setActiveFollowUp] = useState<FollowUpKey | null>(null);

  // Small toggle helpers — close if the same chip is clicked again,
  // otherwise open the requested panel (and replace any other open
  // panel). Keeps the chip onClick handlers terse.
  const toggleDirection = (kind: 'upgrade') =>
    setActiveFollowUp((prev) =>
      prev && prev.kind === kind ? null : { kind },
    );
  const toggleComponent = (name: string) =>
    setActiveFollowUp((prev) =>
      prev && prev.kind === 'component' && prev.name === name
        ? null
        : { kind: 'component', name },
    );

  // ── Parse the narrative into { header, body } sections. ──
  // The composer emits sections as:   **Header**\n\nbody...\n\n**Next**...
  // Presentation-only brand-casing normalization is applied to the raw
  // narrative so every downstream parsed section inherits it.
  const raw = normalizeBrandCasing(a.systemContext ?? '');
  // Pre-review blocker fix (PDF 4 — Pontus II / Leben CS300 / Super HL5 Plus):
  // the section parser used `(?=\n\*\*[^*]+\*\*|$)` as the end-of-section
  // lookahead, which matched ANY `\n**...**` — including inline bolds like
  // `\n**Change the DAC.** Expect more depth...`. The result was that the
  // optimize body was truncated to just the "Do not touch:" line, and the
  // actual upgrade directive ended up orphaned (no recognised section claimed
  // it, so the renderer dropped it). Tighten the lookahead to require the
  // bolded text to occupy the entire line — i.e. `**Header**` followed
  // immediately by a newline or end-of-input. Inline bolds inside a paragraph
  // no longer terminate the section.
  const sectionRegex = /\*\*([^*]+)\*\*\s*\n+([\s\S]*?)(?=\n\*\*[^*\n]+\*\*\s*(?:\n|$)|$)/g;
  type Section = { header: string; body: string };
  const sections: Section[] = [];
  let m: RegExpExecArray | null;
  while ((m = sectionRegex.exec(raw)) !== null) {
    sections.push({ header: m[1].trim(), body: m[2].trim() });
  }
  const findSection = (needle: string) =>
    sections.find((s) => s.header.toLowerCase().includes(needle));

  // Parse both old (v1) and new (v2) section headers for backwards compat.
  const overview = findSection('system read') ?? findSection('overview');
  const systemLogic = findSection('system logic');
  const strengths = findSection('does well') ?? findSection('doing well');
  const constrained = findSection('constrained');
  const primaryLeverage = findSection('primary leverage');
  const identity = findSection('listener alignment') ?? findSection('identity');
  const decision = findSection('decision');
  const tradeoffs = findSection('trade-offs') ?? findSection('trade offs');
  const changeNothing = findSection('do nothing check') ?? findSection('change nothing');
  const optimize = findSection('action path') ?? findSection('optimize');
  const nextSteps = findSection('next step');
  const outcomeValidation = findSection('outcome validation');

  // ── Dedupe chain into a single aligned array of { name, role }. ──
  // One source of truth so name and role can never drift out of alignment.
  type ChainEntry = { name: string; role: string | null };
  const chain: ChainEntry[] = [];
  if (a.systemChain?.names) {
    const seen = new Set<string>();
    a.systemChain.names.forEach((n, i) => {
      const key = (n || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      chain.push({ name: normalizeComponentName(n), role: a.systemChain?.roles?.[i] ?? null });
    });
  }
  const hasAnyRole = chain.some((c) => !!c.role);

  // ── Build product URL map for clickable product names. ──
  // Priority: first retailer_link URL (typically the manufacturer page).
  // Falls back to brand page URL if no retailer link exists.
  // Only verified, existing URLs are included — nothing is fabricated.
  const productUrlMap: ProductUrlMap = useMemo(() => {
    const map: ProductUrlMap = new Map();
    for (const c of chain) {
      const product = findProductByComponentName(c.name);
      if (!product) continue;
      const key = c.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      // Also index by the canonical product name (may differ from chain name)
      const canonicalKey = `${product.brand} ${product.name}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const url = product.retailer_links?.[0]?.url;
      if (url) {
        if (!map.has(key)) map.set(key, url);
        if (!map.has(canonicalKey)) map.set(canonicalKey, url);
      }
    }
    return map;
  }, [chain]);

  // ── Extract "Do not touch:" line from optimize body. ──
  let optimizeBody = optimize?.body ?? '';
  let doNotTouchItems: string[] = [];
  const dntMatch = optimizeBody.match(/\*\*Do not touch:\*\*\s*([^\n]+?)\.?\s*(?:\n|$)/i);
  if (dntMatch) {
    doNotTouchItems = dntMatch[1]
      .split(',')
      .map((s) => normalizeComponentName(s.trim()))
      .filter((s) => s.length > 0);
    optimizeBody = optimizeBody.replace(dntMatch[0], '').trim();
  }

  // ── Shared tokens. ──
  const maxWidth = '68rem';
  const sectionGap = '1.8rem';
  const bodyLine = 1.9;

  const sectionLabel = (text: string, opts?: { emphasis?: 'primary' | 'action' }) => {
    const emphasis = opts?.emphasis;
    return (
      <h3 style={{
        margin: '0 0 1rem 0', // was 0.9rem — clearer label-to-content separation
        fontSize: emphasis ? '1.3rem' : '1.05rem', // primary header bumped 1.25 → 1.3rem
        fontWeight: 700, // unified (was 700/600 split); stronger hierarchy for non-emphasis too
        letterSpacing: emphasis === 'primary' ? '-0.01em'
          : emphasis === 'action' ? '0'
          : FONTS.labelTracking, // uppercase labels get wider tracking for scannability
        color: emphasis === 'action' ? COLORS.accent : COLORS.text,
        textTransform: emphasis ? 'none' : 'uppercase',
      }}>
        {text}
      </h3>
    );
  };

  const bodyPara = (text: string, extra?: React.CSSProperties) => (
    <p style={{
      margin: 0,
      fontSize: FONTS.bodySize,
      lineHeight: bodyLine,
      color: COLORS.text,
      ...(extra ?? {}),
    }}>
      {renderTextWithProductLinks(text, productUrlMap)}
    </p>
  );

  // ── Narrative prose image rendering ──
  // Dedup applies only here (prose/inline context). Card contexts
  // (comparison cards, product cards, upgrade paths) always show images.
  const { claimImage } = useProductImageClaim();

  /** Resolve and render an inline product image for a component name.
   *  Returns null if no image is available or already claimed. */
  const renderFirstReferenceImage = (componentName: string) => {
    const product = findProductByComponentName(componentName);
    const brand = product?.brand ?? componentName.split(/\s+/)[0];
    const name = product?.name ?? componentName;
    const imageUrl = product
      ? product.imageUrl ?? getProductImage(product.brand, product.name)
      : getProductImage(brand, name);
    if (!imageUrl) return null;
    if (!claimImage(brand, name)) return null;
    return (
      <div style={{
        marginTop: '0.6rem',
        borderRadius: '8px',
        overflow: 'hidden',
        width: '100%',
        maxHeight: '320px',
        minHeight: '140px',
        aspectRatio: '4 / 3',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        boxSizing: 'border-box' as const,
      }}>
        <img
          src={imageUrl}
          alt={componentName}
          loading="eager"
          referrerPolicy="no-referrer"
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain' as const,
            display: 'block',
          }}
          onError={(e) => {
            const wrap = (e.currentTarget as HTMLImageElement).parentElement;
            if (wrap) wrap.style.display = 'none';
          }}
        />
      </div>
    );
  };

  /** Extract a bold product name from a list item (e.g. "**Chord Hugo** — ..."). */
  const extractBoldName = (text: string): string | null => {
    const m = text.match(/\*\*(.+?)\*\*/);
    return m ? m[1] : null;
  };

  // Strengths render as numbered list items (already numbered in source).
  // Each item that names a product in bold gets an inline image at first reference.
  const renderListBody = (body: string) => {
    const items = body
      .split(/\n+/)
      .map((l) => l.replace(/^\s*\d+\.\s*/, '').trim())
      .filter((l) => l.length > 0);
    return (
      <ol style={{
        margin: 0,
        paddingLeft: '1.3rem',
        lineHeight: bodyLine,
        fontSize: FONTS.bodySize,
        color: COLORS.text,
      }}>
        {items.map((it, i) => {
          const productName = extractBoldName(it);
          const img = productName ? renderFirstReferenceImage(productName) : null;
          return (
            <li key={i} style={{ marginBottom: img ? '1.25rem' : '0.75rem' }}>
              {renderTextWithProductLinks(it, productUrlMap)}
              {img}
            </li>
          );
        })}
      </ol>
    );
  };

  return (
    <div style={{
      lineHeight: bodyLine,
      color: COLORS.text,
      maxWidth,
      margin: '0 auto',
    }}>
      <ModeIndicator mode={a.advisoryMode} />

      {a.title && (
        <h2 style={{
          margin: '0 0 1.65rem 0', // was 1.5rem — slightly more air before system chain/overview
          fontSize: '1.6rem',       // was 1.55rem — key decisions read first
          fontWeight: 700,
          color: COLORS.text,       // was hard-coded #2a2a2a; use darkened primary token
          letterSpacing: '-0.02em',
        }}>
          {a.title}
        </h2>
      )}

      {/* System chain — single horizontal line, deduped. */}
      {chain.length > 0 && (
        <div style={{
          marginBottom: sectionGap,
          padding: '0.75rem 1rem',
          background: COLORS.accentBg,
          borderRadius: '8px',
          border: `1px solid ${COLORS.border}`,
          fontSize: '0.95rem',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
        }}>
          <div style={{
            color: COLORS.text,
            fontWeight: 500,
            display: 'inline-block',
          }}>
            {chain.map((c, i) => {
              const key = c.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
              const url = productUrlMap.get(key);
              return (
                <span key={i}>
                  {i > 0 && (
                    <span style={{ color: COLORS.accentLight, margin: '0 0.55rem' }}>→</span>
                  )}
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: 'inherit',
                        textDecoration: 'underline',
                        textDecorationColor: 'rgba(168, 152, 112, 0.45)',
                        textUnderlineOffset: '2px',
                        textDecorationThickness: '1.5px',
                        transition: 'text-decoration-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget.style as CSSStyleDeclaration).textDecorationColor = 'rgba(168, 152, 112, 0.85)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget.style as CSSStyleDeclaration).textDecorationColor = 'rgba(168, 152, 112, 0.45)';
                      }}
                    >
                      {c.name}
                    </a>
                  ) : (
                    <span>{c.name}</span>
                  )}
                </span>
              );
            })}
          </div>
          {hasAnyRole && (
            <div style={{
              marginTop: '0.3rem',
              fontSize: '0.82rem',
              color: COLORS.textMuted,
            }}>
              {chain.map((c, i) => (
                <span key={i}>
                  {i > 0 && <span style={{ margin: '0 0.55rem' }}>→</span>}
                  <span>{c.role ?? ''}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* System read. */}
      {overview && (
        <section style={{ marginBottom: sectionGap }}>
          {sectionLabel('System read')}
          {bodyPara(overview.body)}
        </section>
      )}

      {/* System logic — causal chain rows. */}
      {systemLogic && (
        <section style={{
          marginBottom: sectionGap,
          padding: '1rem 1.25rem',
          background: '#f8f7f3',
          borderRadius: '6px',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '0.85rem',
          lineHeight: 1.7,
          whiteSpace: 'pre-line',
          color: COLORS.text,
        }}>
          {sectionLabel('System logic')}
          {systemLogic.body.split('\n').filter(Boolean).map((row, i) => (
            <div key={i}>{row}</div>
          ))}
        </section>
      )}

      {/* Strengths. */}
      {strengths && (
        <section style={{ marginBottom: sectionGap }}>
          {sectionLabel('What the system does well')}
          {renderListBody(strengths.body)}
        </section>
      )}

      {/* Constraint — visually dominant. */}
      {constrained && (
        <section style={{
          marginBottom: sectionGap,
          padding: '1.5rem 1.6rem',
          background: '#fbfaf6',
          borderLeft: `4px solid ${COLORS.accent}`,
          borderRadius: '6px',
        }}>
          {sectionLabel('Where the system is constrained', { emphasis: 'primary' })}
          {bodyPara(constrained.body, { lineHeight: 1.95 })}
        </section>
      )}

      {/* Primary leverage — the ONE component to change. */}
      {primaryLeverage && (
        <section style={{
          marginBottom: sectionGap,
          padding: '1.25rem 1.5rem',
          background: '#fbfaf6',
          borderRadius: '6px',
          borderLeft: `4px solid ${COLORS.accent}`,
        }}>
          {sectionLabel('Primary leverage', { emphasis: 'primary' })}
          {primaryLeverage.body.split('\n').filter(Boolean).map((line, i) => (
            <div key={i} style={{
              fontSize: FONTS.bodySize,
              lineHeight: 1.75,
              color: COLORS.text,
              fontWeight: line.startsWith('Change this') ? 500 : 400,
            }}>{line}</div>
          ))}
        </section>
      )}

      {/* Listener alignment (legacy — no longer emitted). */}
      {identity && (
        <section style={{ marginBottom: sectionGap }}>
          {sectionLabel('Listener alignment')}
          {bodyPara(identity.body)}
        </section>
      )}

      {/* Decision — clear verdict. */}
      {decision && (
        <section style={{
          marginBottom: sectionGap,
          padding: '1.25rem 1.5rem',
          background: '#f8f7f3',
          borderRadius: '6px',
          borderLeft: `4px solid ${COLORS.text}`,
        }}>
          {sectionLabel('Decision', { emphasis: 'primary' })}
          {bodyPara(decision.body, { fontWeight: 500 })}
        </section>
      )}

      {/* Trade-offs. */}
      {tradeoffs && (
        <section style={{ marginBottom: sectionGap }}>
          {sectionLabel('Trade-offs')}
          {bodyPara(tradeoffs.body)}
        </section>
      )}

      {/* Next step options. */}
      {nextSteps && (
        <section style={{ marginBottom: sectionGap }}>
          {sectionLabel('Next step options')}
          {renderListBody(nextSteps.body)}
        </section>
      )}

      {/* Action path — action emphasis, grouped with follow-up chips. */}
      {optimize && (
        <div style={{ marginBottom: sectionGap }}>
        <section style={{
          padding: '1.5rem 1.6rem',
          background: COLORS.white,
          border: `1.5px solid ${COLORS.accent}`,
          borderRadius: '6px',
        }}>
          {sectionLabel('Action path', { emphasis: 'action' })}

          {doNotTouchItems.length > 0 && (
            <div style={{ marginBottom: '1.15rem' }}>
              <div style={{
                fontSize: FONTS.labelSize,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: COLORS.textMuted,
                marginBottom: '0.5rem',
                fontWeight: 600,
              }}>
                Do not touch
              </div>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}>
                {doNotTouchItems.map((name, i) => {
                  // Component chips behave the same way as the
                  // "See recommended upgrades" chip:
                  // clicking dispatches an inline follow-up panel
                  // inside the same chat message rather than
                  // navigating to a brand page. Single-panel-at-a-
                  // time is enforced by the shared `activeFollowUp`
                  // state.
                  //
                  // Styling is preserved from the prior <Link>
                  // implementation (same padding, accent-bg, pill
                  // radius, border, weight) with an `aria-pressed`
                  // treatment when the chip's panel is open.
                  const isActive =
                    activeFollowUp !== null &&
                    activeFollowUp.kind === 'component' &&
                    activeFollowUp.name === name;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleComponent(name)}
                      aria-pressed={isActive}
                      style={{
                        display: 'inline-block',
                        padding: '0.35rem 0.7rem',
                        background: isActive
                          ? COLORS.accentBg
                          : COLORS.accentBg,
                        border: `1px ${isActive ? 'solid' : 'solid'} ${
                          isActive ? COLORS.accent : COLORS.border
                        }`,
                        borderRadius: '999px',
                        fontSize: '0.88rem',
                        color: COLORS.text,
                        fontWeight: 500,
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        lineHeight: 1.3,
                        transition:
                          'border-color 120ms ease, background 120ms ease, color 120ms ease',
                      }}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>

              {/* Inline follow-up panel for a selected "Do not touch"
                * component. Dispatched in-chat from the chips above;
                * never navigates. Shares `activeFollowUp` with the
                * direction chips so only one panel is open at a
                * time. */}
              {activeFollowUp?.kind === 'component' && (
                <ComponentKeepFollowUp
                  name={activeFollowUp.name}
                  onDismiss={() => setActiveFollowUp(null)}
                />
              )}
            </div>
          )}

          {optimizeBody && bodyPara(optimizeBody, { lineHeight: 1.95 })}

          {/* Structured upgrade-path product cards — rendered inside the
            * action path section so product images are visible without
            * requiring user interaction. The narrative prose above provides
            * the directional context; these cards make the recommendations
            * tangible with images, pricing, and trade-offs. */}
          {a.upgradePaths && a.upgradePaths.length > 0 && (
            <div style={{ marginTop: '1.25rem' }}>
              <AdvisoryUpgradePaths
                paths={a.upgradePaths}
                stackedTraits={a.stackedTraitInsights?.map((s) => ({ label: s.label, classification: s.classification }))}
              />
            </div>
          )}
        </section>
        </div>
      )}

      {/* Primary follow-up action — always visible, independent of Action Path.
        *
        * Single high-value next step: opens the Safe direction upgrade
        * panel with rich product cards (images, audible outcomes,
        * technical rationale, positioning). Renders unconditionally so
        * users can always explore upgrade options regardless of
        * whether the decision was KEEP or a specific change. */}
      <div style={{ marginBottom: sectionGap, marginTop: optimize ? '0' : sectionGap, paddingLeft: '0.15rem' }}>
        <div style={{
          fontSize: '0.82rem',
          color: COLORS.textMuted,
          fontStyle: 'italic',
          marginBottom: '0.45rem',
        }}>
          Your next step:
        </div>
        <div>
          <FollowUpChip
            label="See recommended upgrades"
            active={activeFollowUp !== null && activeFollowUp.kind === 'upgrade'}
            onClick={() => toggleDirection('upgrade')}
          />
        </div>

        {activeFollowUp?.kind === 'upgrade' && (
          <UpgradeOptionsFollowUp
            onDismiss={() => setActiveFollowUp(null)}
          />
        )}
      </div>

      {/* Do nothing check. */}
      {changeNothing && (
        <section style={{ marginBottom: sectionGap }}>
          {sectionLabel('Do nothing check')}
          {bodyPara(changeNothing.body)}
        </section>
      )}

      {/* Outcome validation. */}
      {outcomeValidation && (
        <section style={{ marginBottom: sectionGap }}>
          {sectionLabel('Outcome validation')}
          {bodyPara(outcomeValidation.body)}
        </section>
      )}
    </div>
  );
}

/**
 * In-chat follow-up for the "Hear what this change does" chip.
 *
 * Dispatched inline from the chip row — no page navigation. Keeps a
 * tight connection to the advisor's existing narrative: the primary
 * constraint and the recommended change are summarised in one or two
 * short sentences, followed by 2–3 concrete listening phrases matched
 * against keywords in the narrative, and then anchored by 2–3
 * direction-exemplar products rendered via the shared product-card
 * component (photos, manufacturer insight, retailer links).
 *
 * Products are drawn from DIRECTION_CONTENT.safe — the refinement
 * direction — because the purpose of this panel is to illustrate the
 * listening outcome of the recommended change, not to explore a
 * different philosophy. Selection is static; see Playbook §8 (engine vs
 * domain boundary).
 */
function HearFollowUp({
  constrainedBody,
  optimizeBody,
  onDismiss,
}: {
  constrainedBody: string;
  optimizeBody: string;
  onDismiss: () => void;
}) {
  // First-sentence extraction — keep references short and precise.
  const firstSentence = (text: string): string => {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    const match = clean.match(/^(.*?[.!?])(\s|$)/);
    return (match ? match[1] : clean).trim();
  };

  const constraintLead = firstSentence(constrainedBody);
  const changeLead = firstSentence(optimizeBody);

  // ── Concrete listening phrases keyed to language in the narrative. ──
  // Order matters: first match wins, and we take at most three.
  const haystack = `${constrainedBody} ${optimizeBody}`.toLowerCase();
  const examplePool: { test: RegExp; phrase: string }[] = [
    { test: /decay|ring|sustain/, phrase: 'shorter decay on snare hits' },
    { test: /attack|leading edge|transient|speed/, phrase: 'harder leading edges on plucked strings' },
    { test: /body|density|weight|warmth|lower/, phrase: 'more weight in the lower vocal register' },
    { test: /space|air|stage|image|separation/, phrase: 'clearer space between instruments' },
    { test: /control|damping|grip|bass|low end|bottom/, phrase: 'a tighter stop on bass notes' },
    { test: /detail|resolution|fine|micro/, phrase: 'small room cues surfacing more clearly' },
    { test: /smooth|ease|relaxed|fatigue/, phrase: 'less edge on massed strings' },
  ];
  const picked: string[] = [];
  for (const { test, phrase } of examplePool) {
    if (picked.length >= 3) break;
    if (test.test(haystack)) picked.push(phrase);
  }
  // Fallback defaults if the narrative language did not match.
  if (picked.length < 2) {
    const defaults = [
      'cleaner space between instruments',
      'a firmer stop on bass notes',
      'more body in sustained vocal notes',
    ];
    for (const d of defaults) {
      if (picked.length >= 3) break;
      if (!picked.includes(d)) picked.push(d);
    }
  }

  // Anchor products — first 2–3 from the Safe direction, rendered with
  // full card treatment (image, maker insight, retailer links).
  // Enrich with product images from the catalog when not already set.
  const anchors = DIRECTION_CONTENT.safe.options.slice(0, 3).map((o) => ({
    ...o,
    imageUrl: o.imageUrl ?? getProductImage(o.brand, o.name),
  }));

  return (
    <div
      aria-label="Hear what this change does"
      style={{
        marginTop: '1rem',
        padding: '1.15rem 1.3rem',
        background: COLORS.accentBg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '6px',
        fontSize: '0.95rem',
        lineHeight: 1.85,
        color: COLORS.text,
      }}
    >
      <div style={{
        fontSize: FONTS.labelSize,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: COLORS.textMuted,
        fontWeight: 600,
        marginBottom: '0.55rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span>What this change does, in listening terms</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close"
          style={{
            background: 'transparent',
            border: 'none',
            color: COLORS.textMuted,
            cursor: 'pointer',
            fontSize: '0.95rem',
            padding: '0 0.25rem',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {(constraintLead || changeLead) && (
        <p style={{ margin: '0 0 0.55rem 0' }}>
          {constraintLead && <>The constraint we are addressing: {constraintLead.replace(/\.$/, '')}. </>}
          {changeLead && <>The recommended change: {changeLead.replace(/\.$/, '')}.</>}
        </p>
      )}
      <p style={{ margin: '0 0 0.4rem 0' }}>
        If it lands, the shift is subtle rather than dramatic — you would notice it on familiar tracks before you noticed it on new ones. Specifically:
      </p>
      <ul style={{ margin: '0.1rem 0 0.9rem 1.1rem', padding: 0 }}>
        {picked.map((p, i) => (
          <li key={i} style={{ marginBottom: '0.2rem' }}>{p}</li>
        ))}
      </ul>

      {/* Anchor products — photos, maker insight, retailer links. */}
      <div style={{
        fontSize: FONTS.labelSize,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: COLORS.textMuted,
        fontWeight: 600,
        margin: '0.55rem 0 0.5rem 0',
      }}>
        Products that express this direction
      </div>
      <AdvisoryProductCards options={anchors} hideMakerInsight preferImage />
    </div>
  );
}

/**
 * In-chat follow-up for the "See upgrade options" chip.
 *
 * Renders the Safe direction — refinement within the same design
 * philosophy — as a set of real catalog products via the shared
 * AdvisoryProductCards component. Each card carries the product
 * photo (when available), maker insight, and retailer links, so the
 * chip produces a richer continuation than a text-only archetype.
 *
 * Data comes from DIRECTION_CONTENT.safe in the shared
 * upgrade-path-content module; the same data drives the full
 * /path/upgrade/safe page. Per Playbook §8, the curated product
 * selection is a domain-layer artifact and appropriate here.
 */
function UpgradeOptionsFollowUp({
  onDismiss,
}: {
  onDismiss: () => void;
}) {
  const { blurb, options } = DIRECTION_CONTENT.safe;
  // Show up to 4 options — matches the page's authored list length.
  // Enrich with product images from the catalog when not already set.
  const picked = options.slice(0, 4).map((o) => ({
    ...o,
    imageUrl: o.imageUrl ?? getProductImage(o.brand, o.name),
  }));

  return (
    <div
      aria-label="Upgrade options"
      style={{
        marginTop: '1rem',
        padding: '0.85rem 1.1rem',
        background: COLORS.accentBg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '6px',
        fontSize: '0.95rem',
        lineHeight: 1.65,
        color: COLORS.text,
      }}
    >
      <div style={{
        fontSize: FONTS.labelSize,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: COLORS.textMuted,
        fontWeight: 600,
        marginBottom: '0.6rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span>Safe upgrade path — direction exemplars</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close"
          style={{
            background: 'transparent',
            border: 'none',
            color: COLORS.textMuted,
            cursor: 'pointer',
            fontSize: '0.95rem',
            padding: '0 0.25rem',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      <p style={{ margin: '0 0 0.9rem 0' }}>{blurb}</p>

      <AdvisoryProductCards options={picked} preferImage />

      <p style={{
        margin: '0.85rem 0 0 0',
        fontSize: '0.82rem',
        color: COLORS.textMuted,
        fontStyle: 'italic',
      }}>
        Direction exemplars — curated catalog illustrations of this path, not personalised picks for your current system.
      </p>
    </div>
  );
}

/**
 * In-chat follow-up for the "Compare paths" chip.
 *
 * Shows all three direction paths inline — Safe, Alternative, Stretch —
 * each with its authored blurb and two catalog products rendered via
 * the shared product-card component. The purpose is side-by-side
 * comparison of what each direction gains and trades off, using real
 * products to make the differences concrete.
 *
 * Data comes from DIRECTION_CONTENT. Each path is capped at two
 * products here (the full list remains on /path/upgrade/[flavor]) to
 * keep the comparison legible in the chat flow.
 */
function ComparePathsFollowUp({
  onDismiss,
}: {
  onDismiss: () => void;
}) {
  const paths = [
    { key: 'safe' as const, label: 'Safe — refinement' },
    { key: 'alternative' as const, label: 'Alternative — different philosophy' },
    { key: 'stretch' as const, label: 'Stretch — structural step-up' },
  ];

  return (
    <div
      aria-label="Compare upgrade paths"
      style={{
        marginTop: '1rem',
        padding: '0.85rem 1.1rem',
        background: COLORS.accentBg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '6px',
        fontSize: '0.95rem',
        lineHeight: 1.65,
        color: COLORS.text,
      }}
    >
      <div style={{
        fontSize: FONTS.labelSize,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: COLORS.textMuted,
        fontWeight: 600,
        marginBottom: '0.75rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span>Three paths, side by side</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close"
          style={{
            background: 'transparent',
            border: 'none',
            color: COLORS.textMuted,
            cursor: 'pointer',
            fontSize: '0.95rem',
            padding: '0 0.25rem',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
        {paths.map(({ key, label }) => {
          const content = DIRECTION_CONTENT[key];
          // Enrich with product images from the catalog when not already set.
          const picked = content.options.slice(0, 2).map((o) => ({
            ...o,
            imageUrl: o.imageUrl ?? getProductImage(o.brand, o.name),
          }));
          return (
            <div
              key={key}
              style={{
                padding: '0.85rem 0.95rem',
                background: COLORS.white,
                border: `1px solid ${COLORS.border}`,
                borderRadius: '5px',
              }}
            >
              <div style={{
                fontSize: '0.72rem',
                textTransform: 'uppercase',
                letterSpacing: '0.09em',
                color: COLORS.accent,
                fontWeight: 700,
                marginBottom: '0.35rem',
              }}>
                {label}
              </div>
              <p style={{ margin: '0 0 0.7rem 0' }}>{content.blurb}</p>
              <AdvisoryProductCards options={picked} hideMakerInsight preferImage />
            </div>
          );
        })}
      </div>

      <p style={{
        margin: '0.85rem 0 0 0',
        fontSize: '0.82rem',
        color: COLORS.textMuted,
        fontStyle: 'italic',
      }}>
        Direction exemplars across three philosophies — each list is curated, not filtered against your current system.
      </p>
    </div>
  );
}

/**
 * In-chat follow-up for a "Do not touch" component chip.
 *
 * Renders a compact component dossier with real catalog data when
 * available — product photo, brand/manufacturer identity, country of
 * origin, what the component contributes to the chain, why it is being
 * kept, and reference links (manufacturer, used market, reviews).
 *
 * Data resolution:
 *   1. `findProductByComponentName` matches the free-form chip text
 *      ("WLM Diva Monitor") against the unified product catalog.
 *   2. `findBrandProfileByName` resolves the brand to its curated
 *      philosophy/country/tendency profile.
 *   3. `getProductImage` resolves product photos.
 *   4. When no catalog match exists, the panel degrades honestly to
 *      a short generic keep rationale — no fabricated details.
 *
 * Per Playbook §8 (engine vs domain boundary), this is a presentation-
 * layer component consuming domain data from the adapter layer. The
 * product/brand lookups are read-only and deterministic; no engine
 * logic runs here.
 */
function ComponentKeepFollowUp({
  name,
  onDismiss,
}: {
  name: string;
  onDismiss: () => void;
}) {
  const product = findProductByComponentName(name);
  const brandName = product?.brand ?? name.trim().split(/\s+/)[0] ?? '';
  const brandProfile = findBrandProfileByName(brandName);
  const rawImageUrl = product
    ? product.imageUrl ?? getProductImage(product.brand, product.name)
    : undefined;
  // Card context — always show image when available (no dedup).
  const imageUrl = rawImageUrl ?? undefined;

  // ── Derive "what this component contributes" from catalog tendencies.
  // First sentence of the product description is the densest summary
  // available. Tendency character entries add specificity.
  const contributionLines: string[] = [];
  if (product?.tendencies?.character) {
    for (const c of product.tendencies.character) {
      contributionLines.push(c.tendency);
    }
  }
  // Fallback: first sentence of description if no structured tendencies.
  if (contributionLines.length === 0 && product?.description) {
    const first = product.description.match(/^(.*?[.!?])(\s|$)/);
    if (first) contributionLines.push(first[1]);
  }

  // ── Collect reference links from product + brand profile.
  type RefLink = { label: string; url: string };
  const links: RefLink[] = [];
  if (product?.retailer_links) {
    for (const rl of product.retailer_links) {
      if (rl.url) links.push({ label: rl.label, url: rl.url });
    }
  }
  if (brandProfile?.links) {
    for (const bl of brandProfile.links) {
      if (bl.url && !links.some((l) => l.url === bl.url)) {
        links.push({ label: bl.label, url: bl.url });
      }
    }
  }
  if (product?.sourceReferences) {
    for (const sr of product.sourceReferences) {
      if (sr.url && !links.some((l) => l.url === sr.url)) {
        links.push({ label: `${sr.source} — ${sr.note}`, url: sr.url });
      }
    }
  }

  // ── Country of origin: product.country (ISO), brand profile country,
  // or nothing. Display the more human-readable brand profile version
  // when available.
  const country = brandProfile?.country ?? product?.country;

  // ── Panel header label ──
  const headerLabel = product
    ? `${product.brand} ${product.name} — kept in place`
    : `${name} — kept in place`;

  return (
    <div
      aria-label={`Why ${name} is being preserved`}
      style={{
        marginTop: '0.9rem',
        padding: '1.15rem 1.3rem',
        background: COLORS.accentBg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '6px',
        fontSize: '0.95rem',
        lineHeight: 1.8,
        color: COLORS.text,
      }}
    >
      {/* ── Header + dismiss ── */}
      <div style={{
        fontSize: FONTS.labelSize,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: COLORS.textMuted,
        fontWeight: 600,
        marginBottom: '0.55rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span>Component dossier</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close"
          style={{
            background: 'transparent',
            border: 'none',
            color: COLORS.textMuted,
            cursor: 'pointer',
            fontSize: '0.95rem',
            padding: '0 0.25rem',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* ── Product hero image ── */}
      {imageUrl && (
        <div style={{
          marginBottom: '1rem',
          borderRadius: '8px',
          overflow: 'hidden',
          width: '100%',
          minHeight: '180px',
          maxHeight: '340px',
          aspectRatio: '4 / 3',
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.25rem',
          boxSizing: 'border-box',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={name}
            referrerPolicy="no-referrer"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
            onError={(e) => {
              const wrap = (e.currentTarget as HTMLImageElement).parentElement;
              if (wrap) wrap.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* ── Identity header ── */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div>
          <div style={{
            fontSize: '1.05rem',
            fontWeight: 600,
            color: COLORS.text,
            lineHeight: 1.3,
          }}>
            {headerLabel}
          </div>
          <div style={{
            fontSize: '0.82rem',
            color: COLORS.textMuted,
            lineHeight: 1.5,
            marginTop: '0.15rem',
          }}>
            {[
              product?.category,
              country,
              product?.architecture,
            ].filter(Boolean).join(' · ')}
          </div>
          {product?.availability === 'discontinued' && (
            <div style={{
              fontSize: '0.78rem',
              color: COLORS.amber,
              marginTop: '0.15rem',
            }}>
              Discontinued — {product.typicalMarket === 'used'
                ? 'used market only'
                : 'available new and used'}
              {product.usedPriceRange
                ? ` ($${product.usedPriceRange.low}–$${product.usedPriceRange.high} used)`
                : ''}
            </div>
          )}
        </div>
      </div>

      {/* ── Manufacturer identity (from brand profile) ── */}
      {brandProfile && (
        <div style={{
          marginBottom: '0.7rem',
          padding: '0.6rem 0.75rem',
          background: COLORS.white,
          border: `1px solid ${COLORS.border}`,
          borderRadius: '5px',
          fontSize: '0.88rem',
          lineHeight: 1.65,
        }}>
          <div style={{
            fontSize: '0.72rem',
            textTransform: 'uppercase',
            letterSpacing: '0.09em',
            color: COLORS.accent,
            fontWeight: 700,
            marginBottom: '0.2rem',
          }}>
            Manufacturer
          </div>
          {brandProfile.designPhilosophy
            ? <p style={{ margin: 0, color: COLORS.text }}>{brandProfile.designPhilosophy}</p>
            : <p style={{ margin: 0, color: COLORS.text }}>
                {brandProfile.philosophy.length > 200
                  ? brandProfile.philosophy.slice(0, 200).replace(/\s+\S*$/, '') + '…'
                  : brandProfile.philosophy}
              </p>
          }
          {brandProfile.sonicTendency && (
            <p style={{ margin: '0.3rem 0 0 0', color: COLORS.textSecondary, fontStyle: 'italic' }}>
              {brandProfile.sonicTendency}
            </p>
          )}
        </div>
      )}

      {/* ── What this component contributes ── */}
      {contributionLines.length > 0 && (
        <>
          <div style={{
            fontSize: FONTS.labelSize,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: COLORS.textMuted,
            fontWeight: 600,
            margin: '0.55rem 0 0.3rem 0',
          }}>
            What it contributes in this system
          </div>
          <ul style={{ margin: '0 0 0.5rem 1.1rem', padding: 0, fontSize: '0.92rem' }}>
            {contributionLines.map((line, i) => (
              <li key={i} style={{ marginBottom: '0.2rem' }}>{line}</li>
            ))}
          </ul>
        </>
      )}

      {/* ── Why it holds — specific to catalog data when available ── */}
      <div style={{
        fontSize: FONTS.labelSize,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: COLORS.textMuted,
        fontWeight: 600,
        margin: '0.55rem 0 0.3rem 0',
      }}>
        Why it holds
      </div>
      {product?.tendencies?.tradeoffs?.[0] ? (
        <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.92rem' }}>
          Replacing the {product.brand} {product.name} means giving up{' '}
          <strong>{product.tendencies.tradeoffs[0].gains}</strong> in exchange
          for uncertainty. The current recommendation targets a higher-leverage
          change elsewhere in your system.
        </p>
      ) : (
        <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.92rem' }}>
          This component already expresses a strength the system relies on.
          Swapping it trades a known tendency for an unknown one — higher-leverage
          change exists elsewhere in the system.
        </p>
      )}

      {/* ── Reference links ── */}
      {links.length > 0 && (
        <>
          <div style={{
            fontSize: FONTS.labelSize,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: COLORS.textMuted,
            fontWeight: 600,
            margin: '0.55rem 0 0.3rem 0',
          }}>
            Further reading
          </div>
          <ul style={{ margin: '0 0 0.4rem 1.1rem', padding: 0, fontSize: '0.85rem' }}>
            {links.map((lk, i) => (
              <li key={i} style={{ marginBottom: '0.15rem' }}>
                <a
                  href={lk.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: COLORS.accent,
                    textDecoration: 'none',
                  }}
                >
                  {lk.label}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}

      <p style={{
        margin: '0.55rem 0 0 0',
        fontSize: '0.82rem',
        color: COLORS.textMuted,
        fontStyle: 'italic',
      }}>
        Worth revisiting if the room changes, the rest of the system
        steps up a tier, or a new listening priority emerges.
      </p>
    </div>
  );
}

function FollowUpChip({
  label,
  onClick,
  href,
  active = false,
}: {
  label: string;
  onClick?: () => void;
  /**
   * When provided, the chip renders as a Next.js `<Link>` with identical
   * inline styling. Mutually exclusive with `onClick` in practice — if both
   * are supplied, `href` wins (navigation is the stronger affordance).
   */
  href?: string;
  active?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const lit = hover || active;

  // Identical style payload for both render paths. Centralized so the
  // `<Link>` and `<button>` cases cannot drift visually.
  const style = {
    padding: '0.45rem 0.9rem',
    background: lit ? 'rgba(47, 95, 179, 0.16)' : 'rgba(47, 95, 179, 0.08)',
    border: `1px solid ${lit ? 'rgba(47, 95, 179, 0.5)' : 'rgba(47, 95, 179, 0.3)'}`,
    borderRadius: '999px',
    fontSize: '0.9rem',
    color: '#2f5fb3',
    fontWeight: 500 as const,
    cursor: 'pointer',
    fontFamily: 'inherit',
    lineHeight: 1.3,
    transition: 'background 120ms ease, border-color 120ms ease',
    textDecoration: 'none',
    display: 'inline-block',
  } as const;

  if (href) {
    return (
      <Link
        href={href}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={style}
      >
        {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={style}
    >
      {label}
    </button>
  );
}

function MemoFormat({ advisory: a }: AdvisoryMessageProps) {
  let sectionNum = 0;
  const next = () => ++sectionNum;

  // Rewritten system review: when the assessment response carries the
  // six-section narrative in `systemContext`, the legacy multi-section
  // memo layout is suppressed and only the narrative renders. The
  // structured fields are still present on the response (so parity tests
  // and non-UI consumers keep working) but are intentionally hidden.
  const isRewrittenReview = a.advisoryMode === 'system_review' && !!a.systemContext;

  if (isRewrittenReview) {
    return <RewrittenSystemReview advisory={a} />;
  }

  return (
    <div style={{ lineHeight: FONTS.lineHeight, color: COLORS.text }}>
      {/* ── Mode indicator ──────────────────────────── */}
      <ModeIndicator mode={a.advisoryMode} />

      {/* ── Title ──────────────────────────────────── */}
      {a.title && (
        <h2 style={{
          margin: '0 0 1.35rem 0', // was 1.25rem — pairs with strengthened label hierarchy below
          fontSize: '1.55rem',      // was 1.5rem — match primary-mode title weight
          fontWeight: 700,
          color: COLORS.text,       // was hard-coded #2a2a2a; use darkened primary token
          letterSpacing: '-0.02em',
        }}>
          {a.title}
        </h2>
      )}

      {/* ── Assessment summary one-liner (Feature 10) ── */}
      {!isRewrittenReview && a.systemSignature && (
        <p style={{
          margin: '0 0 1.5rem 0',
          fontSize: '1.02rem',
          fontWeight: 500,
          lineHeight: 1.55,
          color: '#555',
          fontStyle: 'italic',
        }}>
          {a.systemSignature}
          {a.primaryConstraint
            ? ` — the ${a.primaryConstraint.componentName.toLowerCase()} is the main area for improvement.`
            : ' — no urgent changes needed.'}
        </p>
      )}

      {/* ── 1. System Character ────────────────────── */}
      <AdvisorySection number={next()} label="System Character">
        {/* Intro summary — system philosophy framing */}
        {!isRewrittenReview && a.introSummary && (
          <p style={{ margin: '0 0 0.85rem 0', fontSize: FONTS.bodySize, lineHeight: FONTS.lineHeight }}>
            {renderText(a.introSummary)}
          </p>
        )}
        {/* System character prose */}
        {a.systemContext && (
          <p style={{ margin: '0 0 0.85rem 0', fontSize: FONTS.bodySize, lineHeight: FONTS.lineHeight }}>
            {renderText(a.systemContext)}
          </p>
        )}
        {/* System interaction description */}
        {!isRewrittenReview && a.systemInteraction && (
          <p style={{ margin: '0 0 0.4rem 0', fontSize: FONTS.bodySize, lineHeight: FONTS.lineHeight }}>
            {renderText(a.systemInteraction)}
          </p>
        )}
        {/* System synergy — folded into System Character instead of separate section */}
        {!isRewrittenReview && a.systemSynergy && (
          <p style={{
            margin: '0.6rem 0 0.4rem 0',
            fontSize: FONTS.bodySize,
            lineHeight: 1.8,
            color: COLORS.textSecondary,
            fontStyle: 'italic',
            borderLeft: `3px solid ${COLORS.accentLight}`,
            paddingLeft: '0.9rem',
          }}>
            {renderText(a.systemSynergy)}
          </p>
        )}
        {/* System chain — compact signal-path display using clean names + roles */}
        {a.systemChain && a.systemChain.names && a.systemChain.names.length > 0 && (
          <div style={{
            marginTop: '0.8rem',
            padding: '0.65rem 0.85rem',
            background: COLORS.accentBg,
            borderRadius: '6px',
            fontSize: '0.9rem',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              flexWrap: 'wrap',
              color: COLORS.text,
              fontWeight: 500,
            }}>
              {a.systemChain.names.map((name, ci) => (
                <span key={ci} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  {ci > 0 && (
                    <span style={{ color: COLORS.accentLight, fontSize: '0.85rem' }}>→</span>
                  )}
                  <span>{name}</span>
                </span>
              ))}
            </div>
            {a.systemChain.roles && a.systemChain.roles.length > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                flexWrap: 'wrap',
                marginTop: '0.3rem',
                fontSize: '0.82rem',
                color: COLORS.textMuted,
              }}>
                {a.systemChain.roles.map((role, ri) => (
                  <span key={ri} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    {ri > 0 && (
                      <span style={{ color: COLORS.borderLight, fontSize: '0.78rem' }}>→</span>
                    )}
                    <span>{role}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </AdvisorySection>

      <SectionDivider />

      {/* ── 2. System Signature ─────────────────────── */}
      {!isRewrittenReview && a.systemSignature && (
        <>
          <AdvisorySection number={next()} label="System Signature">
            <p style={{
              margin: 0,
              fontSize: '1rem',
              lineHeight: 1.75,
              color: COLORS.text,
              fontWeight: 500,
            }}>
              {renderText(a.systemSignature)}
            </p>
          </AdvisorySection>
          <SectionDivider />
        </>
      )}

      {/* System Synergy is now folded into System Character above */}

      {/* ── 4. What the System Does Well ─────────── */}
      {!isRewrittenReview && a.assessmentStrengths && a.assessmentStrengths.length > 0 && (
        <>
          <AdvisorySection number={next()} label="What the System Does Well">
            <BulletList items={a.assessmentStrengths} />
            {/* Stacked trait synergy insight */}
            {a.stackedTraitInsights && a.stackedTraitInsights.length > 0 && (
              <div style={{ marginTop: '0.7rem' }}>
                {a.stackedTraitInsights.map((insight, i) => (
                  <p key={i} style={{ margin: '0 0 0.4rem 0', fontSize: FONTS.bodySize, lineHeight: FONTS.lineHeight, color: COLORS.textSecondary }}>
                    {renderText(insight.explanation)}
                  </p>
                ))}
              </div>
            )}
          </AdvisorySection>
          <SectionDivider />
        </>
      )}

      {/* ── 5. Trade-offs in the System ───────────── */}
      {!isRewrittenReview && a.assessmentLimitations && a.assessmentLimitations.length > 0 && (
        <>
          <AdvisorySection number={next()} label="Trade-offs in the System">
            {a.primaryConstraint && (
              <p style={{ margin: '0 0 0.85rem 0', fontSize: FONTS.bodySize, lineHeight: FONTS.lineHeight, color: COLORS.textSecondary }}>
                {renderText(a.primaryConstraint.explanation)}
              </p>
            )}
            <BulletList items={a.assessmentLimitations} color={COLORS.textSecondary} />
          </AdvisorySection>
          <SectionDivider />
        </>
      )}

      {/* ── 6. Component Contributions ────────────── */}
      {!isRewrittenReview && a.componentAssessments && a.componentAssessments.length > 0 && (
        <>
          <AdvisorySection number={next()} label="Component Contributions">
            <AdvisoryComponentAssessments assessments={a.componentAssessments} />
          </AdvisorySection>
          <SectionDivider />
        </>
      )}

      {/* ── 7. System Bottlenecks ─────────────────── */}
      {!isRewrittenReview && a.upgradePaths && a.upgradePaths.length > 0 && (
        <>
          <AdvisorySection number={next()} label="System Bottlenecks">
            <AdvisoryUpgradePaths
              paths={a.upgradePaths}
              stackedTraits={a.stackedTraitInsights?.map((s) => ({ label: s.label, classification: s.classification }))}
            />
          </AdvisorySection>
          <SectionDivider />
        </>
      )}

      {/* ── 8. Upgrade Strategy (only for upgrade queries) ── */}
      {!isRewrittenReview && a.advisoryMode !== 'system_review' && a.recommendedSequence && a.recommendedSequence.length > 0 && (
        <>
          <AdvisorySection number={next()} label="Upgrade Strategy">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {a.recommendedSequence.map((step) => (
                <div key={step.step} style={{ fontSize: FONTS.bodySize, lineHeight: 1.65 }}>
                  <span style={{ fontWeight: 600, color: COLORS.text }}>Step {step.step}.</span>{' '}
                  {renderText(step.action)}
                </div>
              ))}
            </div>
          </AdvisorySection>
          <SectionDivider />
        </>
      )}

      {/* ── 9. Components Worth Keeping (only for upgrade queries) ── */}
      {!isRewrittenReview && a.advisoryMode !== 'system_review' && a.keepRecommendations && a.keepRecommendations.length > 0 && (
        <>
          <AdvisorySection number={next()} label="Components Worth Keeping">
            {a.keepRecommendations.map((k, i) => (
              <div key={i}>
                {i > 0 && <hr style={{ border: 'none', borderTop: `1px solid ${COLORS.borderLight}`, margin: '0.8rem 0' }} />}
                <div style={{ marginBottom: '0.3rem' }}>
                  <strong style={{ fontSize: '0.98rem', color: COLORS.text }}>{k.name}</strong>
                </div>
                <p style={{ margin: 0, fontSize: FONTS.bodySize, lineHeight: 1.65, color: COLORS.textSecondary }}>
                  {renderText(k.reason)}
                </p>
              </div>
            ))}
          </AdvisorySection>
          <SectionDivider />
        </>
      )}

      {/* ── 10. Listener Taste Profile ─────────────── */}
      {!isRewrittenReview && (a.listenerTasteProfile || a.keyObservation) && (
        <>
          <AdvisorySection number={next()} label="Listener Taste Profile">
            {/* Spider chart visualization */}
            {a.spiderChartData && a.spiderChartData.length > 0 && (
              <AdvisorySpiderChart data={a.spiderChartData} />
            )}
            {/* Structured taste profile */}
            {a.listenerTasteProfile ? (
              <AdvisoryListenerProfile
                profile={a.listenerTasteProfile}
                keyObservation={a.keyObservation}
              />
            ) : a.keyObservation ? (
              <p style={{ margin: 0, fontSize: FONTS.bodySize, lineHeight: 1.8, color: COLORS.text }}>
                {renderText(a.keyObservation)}
              </p>
            ) : null}
          </AdvisorySection>
          <SectionDivider />
        </>
      )}

      {/* ── Follow-up ────────────────────────────── */}
      {a.followUp && (
        <div
          style={{
            borderLeft: `3px solid ${COLORS.border}`,
            paddingLeft: '1rem',
            padding: '0.7rem 1rem',
            marginBottom: '1.5rem',
            fontSize: FONTS.bodySize,
            color: COLORS.textSecondary,
            lineHeight: 1.7,
          }}
        >
          {renderText(a.followUp)}
        </div>
      )}

      {/* ── Learn more (links) ───────────────────── */}
      {a.links && a.links.length > 0 && (
        <AdvisorySection label="Learn more">
          <AdvisoryLinks links={a.links} />
        </AdvisorySection>
      )}

      {/* ── Sources ──────────────────────────────── */}
      {a.sourceReferences && a.sourceReferences.length > 0 && (
        <AdvisorySection label="Sources">
          <AdvisorySources sources={a.sourceReferences} />
        </AdvisorySection>
      )}

      {/* ── Diagnostics (collapsible) ────────────── */}
      {a.diagnostics && (
        <div style={{ marginTop: '0.75rem' }}>
          <AdvisoryDiagnostics
            matchedPhrases={a.diagnostics.matchedPhrases}
            symptoms={a.diagnostics.symptoms}
            traits={a.diagnostics.traits}
          />
        </div>
      )}
    </div>
  );
}

// ── Standard Format Renderer ──────────────────────────
//
// Two rendering paths:
//   A. Editorial format — when product options are present (shopping/gear mode).
//      Prioritizes products as the main content with reasoning sections below.
//   B. Classic format — for consultations, diagnosis, comparisons, etc.

/** Detect whether this response should use the editorial product layout. */
function isEditorialFormat(a: AdvisoryResponse): boolean {
  return !!(a.options && a.options.length > 0);
}

// ── Audio Preferences Block ──────────────────────────
//
// Replaces the old "What you seem to value" section with a richer
// profile display showing system chain, sonic priorities, listening
// context, and archetype. When profile is incomplete, shows a
// transparent note about what's missing.

function AudioPreferencesBlock({ profile, advisoryMode, namedProduct }: {
  profile: AudioProfile;
  advisoryMode?: string;
  /** True when the query targets a specific named product (even if not in catalog).
   *  False/undefined when only a brand name was mentioned. */
  namedProduct?: boolean;
}) {
  const hasSystem = profile.systemChain && profile.systemChain.length > 0;
  const hasPriorities = profile.sonicPriorities && profile.sonicPriorities.length > 0;
  const hasAvoids = profile.sonicAvoids && profile.sonicAvoids.length > 0;
  const hasContext = profile.listeningContext && profile.listeningContext.length > 0;
  const hasAnything = hasSystem || hasPriorities || hasContext;

  if (!hasAnything) {
    // Determine the correct label based on advisory mode
    const isAssessment = advisoryMode === 'product_assessment';
    const label = isAssessment
      ? (namedProduct ? 'Product assessment' : 'Brand assessment')
      : 'Exploratory recommendations';
    const description = isAssessment
      ? 'Tell me about your system, sonic preferences, and listening habits for a more specific fit assessment.'
      : 'These suggestions represent different design philosophies. Tell me about your system, sonic preferences, and listening habits for more personalized direction.';

    return (
      <div
        style={{
          borderLeft: `3px solid ${COLORS.border}`,
          paddingLeft: '1rem',
          marginBottom: '1.25rem',
          background: '#f9f9f7',
          padding: '0.8rem 1rem',
          borderRadius: '0 6px 6px 0',
        }}
      >
        <div style={{
          fontSize: FONTS.labelSize,
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase' as const,
          color: COLORS.textMuted,
          marginBottom: '0.4rem',
        }}>
          {label}
        </div>
        <p style={{
          margin: 0,
          fontSize: '0.91rem',
          lineHeight: 1.7,
          color: COLORS.textSecondary,
        }}>
          {description}
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        borderLeft: `3px solid ${COLORS.accent}`,
        paddingLeft: '1rem',
        marginBottom: '1.25rem',
        background: COLORS.accentBg,
        padding: '0.8rem 1rem',
        borderRadius: '0 6px 6px 0',
      }}
    >
      {/* Section heading */}
      <div style={{
        fontSize: FONTS.labelSize,
        fontWeight: 600,
        letterSpacing: '0.05em',
        textTransform: 'uppercase' as const,
        color: COLORS.accent,
        marginBottom: '0.55rem',
      }}>
        Audio Preferences
      </div>

      {/* System chain */}
      {hasSystem && (
        <div style={{ marginBottom: '0.55rem' }}>
          <div style={{
            fontSize: '0.82rem',
            fontWeight: 600,
            color: COLORS.textSecondary,
            marginBottom: '0.2rem',
          }}>
            Your system
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            flexWrap: 'wrap',
            fontSize: '0.91rem',
            color: COLORS.text,
          }}>
            {profile.systemChain!.map((comp, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                {i > 0 && (
                  <span style={{ color: COLORS.accentLight, fontSize: '0.82rem' }}>→</span>
                )}
                <span>{comp}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sonic priorities */}
      {hasPriorities && (
        <div style={{ marginBottom: hasAvoids || hasContext ? '0.45rem' : 0 }}>
          <div style={{
            fontSize: '0.82rem',
            fontWeight: 600,
            color: COLORS.textSecondary,
            marginBottom: '0.2rem',
          }}>
            {profile.preferenceSource === 'default'
              ? 'Starting point (default)'
              : 'You prefer'}
          </div>
          <div style={{
            fontSize: '0.91rem',
            color: COLORS.text,
            lineHeight: 1.65,
          }}>
            {profile.sonicPriorities!.join(' · ')}
          </div>
          {profile.preferenceSource === 'default' && (
            <>
              <div style={{
                fontSize: '0.86rem',
                color: COLORS.textSecondary,
                marginTop: '0.3rem',
                lineHeight: 1.6,
              }}>
                This is a safe starting assumption — slightly warm and easy to listen to.
              </div>
              <div style={{
                fontSize: '0.86rem',
                color: COLORS.text,
                marginTop: '0.25rem',
                fontWeight: 500,
                lineHeight: 1.6,
              }}>
                Do you want to keep that direction, or shift toward clarity and precision?
              </div>
            </>
          )}
        </div>
      )}

      {/* Sonic avoids */}
      {hasAvoids && (
        <div style={{ marginBottom: hasContext ? '0.45rem' : 0 }}>
          <div style={{
            fontSize: '0.82rem',
            fontWeight: 600,
            color: COLORS.textSecondary,
            marginBottom: '0.2rem',
          }}>
            You avoid
          </div>
          <div style={{
            fontSize: '0.91rem',
            color: COLORS.textMuted,
            lineHeight: 1.65,
          }}>
            {profile.sonicAvoids!.join(' · ')}
          </div>
        </div>
      )}

      {/* Listening context */}
      {hasContext && (
        <div>
          <div style={{
            fontSize: '0.82rem',
            fontWeight: 600,
            color: COLORS.textSecondary,
            marginBottom: '0.2rem',
          }}>
            Context
          </div>
          <div style={{
            fontSize: '0.91rem',
            color: COLORS.text,
            lineHeight: 1.65,
          }}>
            {profile.listeningContext!.join(' · ')}
          </div>
        </div>
      )}

      {/* Archetype badge + budget — inline */}
      {(profile.archetype || profile.budget) && (
        <div style={{
          marginTop: '0.55rem',
          display: 'flex',
          gap: '0.6rem',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          {profile.archetype && (
            <span style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '0.15rem 0.5rem',
              borderRadius: '4px',
              color: COLORS.accent,
              background: '#f0ece3',
              letterSpacing: '0.02em',
            }}>
              {profile.archetype}
            </span>
          )}
          {profile.budget && (
            <span style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '0.15rem 0.5rem',
              borderRadius: '4px',
              color: COLORS.textMuted,
              background: '#f2f2f0',
              letterSpacing: '0.02em',
            }}>
              Budget: {profile.budget}
            </span>
          )}
        </div>
      )}

      {/* Missing dimensions note */}
      {!profile.profileComplete && profile.missingDimensions && profile.missingDimensions.length > 0 && (
        <p style={{
          margin: '0.5rem 0 0 0',
          fontSize: '0.82rem',
          color: COLORS.textMuted,
          fontStyle: 'italic',
          lineHeight: 1.6,
        }}>
          For sharper recommendations, tell me about your {profile.missingDimensions.join(' and ')}.
        </p>
      )}
    </div>
  );
}

// ── Start Here Block (Preference Capture CTA) ────────
//
// High-visibility entry point for users with low preference signal.
// Replaces passive "balanced" output with an active refinement path.
// Shows inline binary choices, then fires callback to re-run pipeline.

const PREFERENCE_PAIRS = [
  {
    axis: 'tonal',
    a: { label: 'Warm / rich', traits: 'warmth and tonal richness' },
    b: { label: 'Clean / detailed', traits: 'detail and precision' },
  },
  {
    axis: 'energy',
    a: { label: 'Relaxed / smooth', traits: 'natural, organic presentation' },
    b: { label: 'Fast / dynamic', traits: 'dynamics and impact' },
  },
  {
    axis: 'spatial',
    a: { label: 'Big / spacious', traits: 'spatial presentation' },
    b: { label: 'Focused / intimate', traits: 'rhythmic engagement' },
  },
];

function StartHereBlock({
  category,
  onCapture,
}: {
  category: string;
  onCapture: (selections: PreferenceSelection[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selections, setSelections] = useState<Record<string, 'a' | 'b'>>({});
  const [submitted, setSubmitted] = useState(false);

  const selectedCount = Object.keys(selections).length;
  const canSubmit = selectedCount >= 2;

  function handleSelect(axis: string, choice: 'a' | 'b') {
    if (submitted) return;
    setSelections((prev) => ({ ...prev, [axis]: choice }));
  }

  function handleSubmit() {
    if (!canSubmit || submitted) return;
    setSubmitted(true);
    const result: PreferenceSelection[] = [];
    for (const pair of PREFERENCE_PAIRS) {
      const choice = selections[pair.axis];
      if (choice) {
        const picked = choice === 'a' ? pair.a : pair.b;
        result.push({ axis: pair.axis, choice, label: picked.traits });
      }
    }
    onCapture(result);
  }

  if (submitted) {
    return (
      <div style={{
        margin: '1.25rem 0',
        padding: '1rem 1.25rem',
        background: '#f0ece3',
        borderRadius: '8px',
        border: `2px solid ${COLORS.accent}`,
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '0.92rem',
          color: COLORS.accent,
          fontWeight: 600,
        }}>
          Updating recommendations…
        </div>
      </div>
    );
  }

  if (!expanded) {
    return (
      <div style={{
        margin: '1.25rem 0',
        padding: '1.15rem 1.35rem',
        background: '#f5f0e6',
        borderRadius: '10px',
        border: `2px solid ${COLORS.accent}`,
        cursor: 'pointer',
        transition: 'background 0.15s ease',
      }}
        onClick={() => setExpanded(true)}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f0ece3'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#f5f0e6'; }}
      >
        {/* START HERE label */}
        <div style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase' as const,
          color: COLORS.accent,
          marginBottom: '0.45rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
        }}>
          {/* Waveform icon */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <rect x="1" y="6" width="2" height="4" rx="1" fill={COLORS.accent} />
            <rect x="4.5" y="4" width="2" height="8" rx="1" fill={COLORS.accent} />
            <rect x="8" y="2" width="2" height="12" rx="1" fill={COLORS.accent} />
            <rect x="11.5" y="4" width="2" height="8" rx="1" fill={COLORS.accent} />
          </svg>
          START HERE
        </div>
        {/* CTA text */}
        <div style={{
          fontSize: '1.05rem',
          fontWeight: 600,
          color: COLORS.text,
          lineHeight: 1.5,
        }}>
          Dial in your sound → get better suggestions
        </div>
      </div>
    );
  }

  // ── Expanded: preference capture flow ──
  return (
    <div style={{
      margin: '1.25rem 0',
      padding: '1.25rem 1.35rem',
      background: '#f5f0e6',
      borderRadius: '10px',
      border: `2px solid ${COLORS.accent}`,
    }}>
      {/* Header */}
      <div style={{
        fontSize: '0.72rem',
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase' as const,
        color: COLORS.accent,
        marginBottom: '0.15rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <rect x="1" y="6" width="2" height="4" rx="1" fill={COLORS.accent} />
          <rect x="4.5" y="4" width="2" height="8" rx="1" fill={COLORS.accent} />
          <rect x="8" y="2" width="2" height="12" rx="1" fill={COLORS.accent} />
          <rect x="11.5" y="4" width="2" height="8" rx="1" fill={COLORS.accent} />
        </svg>
        START HERE
      </div>
      <div style={{
        fontSize: '0.98rem',
        color: COLORS.text,
        marginBottom: '1.1rem',
        lineHeight: 1.6,
      }}>
        Let&apos;s tune this quickly.
      </div>

      {/* Preference pairs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', marginBottom: '1.1rem' }}>
        {PREFERENCE_PAIRS.map((pair) => {
          const selected = selections[pair.axis];
          return (
            <div key={pair.axis} style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'stretch',
            }}>
              <button
                onClick={() => handleSelect(pair.axis, 'a')}
                style={{
                  flex: 1,
                  padding: '0.65rem 0.85rem',
                  borderRadius: '7px',
                  border: `2px solid ${selected === 'a' ? COLORS.accent : '#ddd8ce'}`,
                  background: selected === 'a' ? '#f0ece3' : COLORS.white,
                  cursor: 'pointer',
                  fontSize: '0.92rem',
                  fontWeight: selected === 'a' ? 600 : 400,
                  color: selected === 'a' ? COLORS.text : COLORS.textSecondary,
                  textAlign: 'center',
                  lineHeight: 1.4,
                  transition: 'all 0.12s ease',
                }}
              >
                {pair.a.label}
              </button>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                color: COLORS.textMuted,
                fontSize: '0.78rem',
                fontWeight: 500,
                flexShrink: 0,
                width: '1.6rem',
                justifyContent: 'center',
              }}>
                or
              </div>
              <button
                onClick={() => handleSelect(pair.axis, 'b')}
                style={{
                  flex: 1,
                  padding: '0.65rem 0.85rem',
                  borderRadius: '7px',
                  border: `2px solid ${selected === 'b' ? COLORS.accent : '#ddd8ce'}`,
                  background: selected === 'b' ? '#f0ece3' : COLORS.white,
                  cursor: 'pointer',
                  fontSize: '0.92rem',
                  fontWeight: selected === 'b' ? 600 : 400,
                  color: selected === 'b' ? COLORS.text : COLORS.textSecondary,
                  textAlign: 'center',
                  lineHeight: 1.4,
                  transition: 'all 0.12s ease',
                }}
              >
                {pair.b.label}
              </button>
            </div>
          );
        })}
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        style={{
          width: '100%',
          padding: '0.7rem 1rem',
          borderRadius: '8px',
          border: 'none',
          background: canSubmit ? COLORS.accent : '#d5d0c5',
          color: canSubmit ? COLORS.white : '#a09888',
          fontSize: '0.95rem',
          fontWeight: 600,
          cursor: canSubmit ? 'pointer' : 'default',
          transition: 'all 0.15s ease',
          letterSpacing: '0.01em',
        }}
      >
        {canSubmit ? 'Update my recommendations' : `Pick at least ${2 - selectedCount} more`}
      </button>

      {/* Optional system add — non-blocking, secondary */}
      <div style={{
        marginTop: '0.85rem',
        textAlign: 'center',
        fontSize: '0.82rem',
        color: COLORS.textMuted,
      }}>
        <span style={{ cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '2px' }}
          onClick={() => {
            /* User can type system info in the chat — no gating here */
          }}
        >
          Add your system (optional)
        </span>
      </div>
    </div>
  );
}

// ── Assessment Format (Practical Product Assessment) ──
//
// Assessment-first response for "I'm considering X" queries.
// Leads with a short answer, then structured sections.
// No product lists — this evaluates a single component.

function isAssessmentFormat(a: AdvisoryResponse): boolean {
  return !!(a.productAssessment);
}

function AssessmentFormat({ advisory: a }: AdvisoryMessageProps) {
  const pa = a.productAssessment!;

  return (
    <div style={{ lineHeight: FONTS.lineHeight, color: COLORS.text }}>
      {/* ── Audio Preferences ────────────────────────── */}
      {a.audioProfile && <AudioPreferencesBlock profile={a.audioProfile} advisoryMode={a.advisoryMode} namedProduct={pa.catalogMatch || pa.candidateName.toLowerCase() !== pa.candidateBrand.toLowerCase()} />}

      {/* ── Product name heading ─────────────────────── */}
      <h2 style={{
        margin: '0 0 1rem 0',
        fontSize: '1.5rem',
        fontWeight: 700,
        color: COLORS.text,
        letterSpacing: '-0.02em',
        lineHeight: 1.3,
      }}>
        {pa.candidateName}
        {pa.candidateArchitecture && (
          <span style={{
            fontSize: '0.85rem',
            fontWeight: 400,
            color: COLORS.textMuted,
            marginLeft: '0.6rem',
          }}>
            {/* Explicit separator so copy-paste reads as "Chord · FPGA"
                rather than "chordFPGA" (QA residual R2 — run-on header). */}
            {'· '}
            {pa.candidateArchitecture}
            {pa.candidatePrice ? ` · ~$${pa.candidatePrice.toLocaleString()}` : ''}
          </span>
        )}
      </h2>

      {/* ── Short answer (the lead) ──────────────────── */}
      <div style={{
        borderLeft: `3px solid ${COLORS.accent}`,
        paddingLeft: '1rem',
        marginBottom: '1.5rem',
        background: COLORS.accentBg,
        padding: '0.85rem 1rem',
        borderRadius: '0 6px 6px 0',
      }}>
        <p style={{
          margin: 0,
          fontSize: '1.02rem',
          lineHeight: 1.75,
          color: COLORS.text,
          fontWeight: 500,
        }}>
          {pa.shortAnswer}
        </p>
      </div>

      {!pa.catalogMatch && (
        <div style={{
          padding: '0.6rem 0.85rem',
          marginBottom: '1.25rem',
          background: '#f9f7f2',
          borderRadius: '6px',
          fontSize: '0.88rem',
          color: COLORS.textMuted,
          fontStyle: 'italic',
        }}>
          This product is not in the Audio XX catalog. Assessment is based on brand-level knowledge and may be less precise.
        </div>
      )}

      {/* ── 1. What actually changes ─────────────────── */}
      {pa.whatChanges.length > 0 && (
        <AdvisorySection label={pa.currentComponentName ? `What changes vs ${pa.currentComponentName}` : 'What this component brings'}>
          {pa.whatChanges.map((item, i) => (
            <p key={i} style={{
              margin: '0 0 0.45rem 0',
              fontSize: FONTS.bodySize,
              lineHeight: FONTS.lineHeight,
              color: COLORS.text,
              paddingLeft: '0.8rem',
              borderLeft: `2px solid ${COLORS.borderLight}`,
            }}>
              {item}
            </p>
          ))}
        </AdvisorySection>
      )}

      {/* ── 2. How it behaves in this system ──────────── */}
      {pa.systemBehavior.length > 0 && (
        <AdvisorySection label="In your system">
          {pa.systemBehavior.map((item, i) => (
            <p key={i} style={{
              margin: '0 0 0.45rem 0',
              fontSize: FONTS.bodySize,
              lineHeight: FONTS.lineHeight,
              color: COLORS.text,
            }}>
              {item}
            </p>
          ))}
        </AdvisorySection>
      )}

      {/* ── 3. Does this solve the real goal? ─────────── */}
      <AdvisorySection label="Alignment with your priorities">
        <p style={{
          margin: 0,
          fontSize: FONTS.bodySize,
          lineHeight: FONTS.lineHeight,
          color: COLORS.text,
        }}>
          {pa.goalAlignment}
        </p>
      </AdvisorySection>

      {/* ── 4. Honest recommendation ─────────────────── */}
      <div style={{
        borderLeft: `3px solid ${COLORS.accent}`,
        paddingLeft: '1rem',
        marginTop: '1.25rem',
        marginBottom: '1rem',
        padding: '0.75rem 1rem',
        borderRadius: '0 6px 6px 0',
        background: COLORS.accentBg,
      }}>
        <div style={{
          fontSize: FONTS.labelSize,
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase' as const,
          color: COLORS.accent,
          marginBottom: '0.35rem',
        }}>
          Recommendation
        </div>
        <p style={{
          margin: 0,
          fontSize: FONTS.bodySize,
          lineHeight: FONTS.lineHeight,
          color: COLORS.text,
        }}>
          {pa.recommendation}
        </p>
        {/*
          Pre-review blocker fix (Audio XX Playbook §5 Confidence Calibration):
          this attribution claims the recommendation is grounded in the user's
          components and listener profile. On brand-only inquiries ("Tell me
          about the Chord sound") neither exists, so the line is a false
          confidence signal. Render only when at least one of those grounding
          sources is actually present.
        */}
        {(() => {
          const hasSystem = !!(a.audioProfile?.systemChain?.length);
          const hasProfile = !!(
            (a.audioProfile?.sonicPriorities?.length ?? 0) > 0 ||
            (a.audioProfile?.sonicAvoids?.length ?? 0) > 0 ||
            !!a.audioProfile?.archetype
          );
          if (!hasSystem && !hasProfile) return null;
          let attribution: string;
          if (hasSystem && hasProfile) {
            attribution = 'Based on how your components interact and your listener profile.';
          } else if (hasSystem) {
            attribution = 'Based on how your components interact.';
          } else {
            attribution = 'Based on your stated listening preferences.';
          }
          return (
            <p style={{
              margin: '0.55rem 0 0 0',
              fontSize: '0.78rem',
              lineHeight: 1.5,
              color: COLORS.textSecondary,
              fontStyle: 'italic',
              opacity: 0.9,
            }}>
              {attribution}
            </p>
          );
        })()}
      </div>

      {/* ── Follow-up ────────────────────────────────── */}
      {a.followUp && (
        <div style={{
          marginTop: '1rem',
          padding: '0.65rem 0.85rem',
          background: '#f9f9f7',
          borderRadius: '6px',
          fontSize: '0.91rem',
          color: COLORS.textSecondary,
          fontStyle: 'italic',
        }}>
          {a.followUp}
        </div>
      )}

      {/* ── Learn more (links) ────────────────────────── */}
      {/* All outbound links render here — never above the follow-up. */}
      <div style={{ marginTop: '1.25rem' }}>
        {a.links && a.links.length > 0 && (
          <AdvisorySection label="Learn more">
            <AdvisoryLinks links={a.links} />
          </AdvisorySection>
        )}
        <ShoppingLinks
          brand={pa.candidateBrand}
          name={pa.candidateName}
          manufacturerUrl={a.links?.find(l => l.kind === 'reference')?.url}
        />
      </div>

      {/* ── Sources (continued reading) ──────────────── */}
      {a.sourceReferences && a.sourceReferences.length > 0 && (
        <AdvisorySection label="Sources">
          <AdvisorySources sources={a.sourceReferences} />
        </AdvisorySection>
      )}
    </div>
  );
}

// ── Editorial Format (Shopping / Gear Results) ────────
//
// ── Decision Frame Block ─────────────────────────────
//
// Renders the strategic decision frame before product shortlists.
// Shows the core question and 2-3 directions with trade-offs.

function DecisionFrameBlock({ frame }: { frame: DecisionFrame }) {
  return (
    <div
      style={{
        marginBottom: '1.5rem',
        padding: '1rem 1.1rem',
        background: '#f8f7f4',
        borderRadius: '8px',
        border: `1px solid ${COLORS.border}`,
      }}
    >
      {/* Current component note */}
      {frame.currentComponent && (
        <div style={{
          fontSize: '0.88rem',
          color: COLORS.textSecondary,
          marginBottom: '0.75rem',
          lineHeight: 1.65,
        }}>
          <span style={{ fontWeight: 600, color: COLORS.text }}>
            Current {frame.category}:
          </span>{' '}
          {frame.currentComponent.name}
          {frame.currentComponent.characterSummary && (
            <span> — {frame.currentComponent.characterSummary}</span>
          )}
        </div>
      )}

      {/* System reading — compact: 1 sentence character + max 1 note */}
      {frame.systemAnalysis && (
        <div style={{
          fontSize: '0.86rem',
          color: COLORS.textSecondary,
          marginBottom: '0.75rem',
          lineHeight: 1.65,
        }}>
          {frame.systemAnalysis.summary}
        </div>
      )}

      {/* Core question */}
      <p style={{
        margin: '0 0 1rem 0',
        fontSize: '0.95rem',
        lineHeight: 1.7,
        color: COLORS.text,
        fontWeight: 500,
      }}>
        {frame.coreQuestion}
      </p>

      {/* Directions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {frame.directions.map((dir, i) => (
          <DirectionCard key={i} direction={dir} />
        ))}
      </div>
    </div>
  );
}

function DirectionCard({ direction: d }: { direction: DecisionDirection }) {
  const isDoNothing = d.isDoNothing;
  const borderColor = isDoNothing ? COLORS.accentLight : COLORS.accent;

  // Pass 13 (interaction depth): the direction LABEL is the click target,
  // routing to a filtered recommendation view at /path/upgrade/[flavor].
  // Destination is a placeholder until the filtered view ships.
  //
  // Why label-only and not the whole card: when `exampleGear` is present,
  // DirectionExamples renders inline <a> tags (HiFiShark / Manufacturer).
  // Wrapping the card in a <Link> would create nested anchors (invalid
  // HTML, unpredictable click behavior). Label-as-link is the smallest
  // change that satisfies "each card clickable" without restructuring the
  // existing nested-link layout.
  return (
    <div
      style={{
        borderLeft: `3px solid ${borderColor}`,
        paddingLeft: '0.9rem',
        padding: '0.6rem 0.9rem',
        background: isDoNothing ? '#faf9f6' : COLORS.white,
        borderRadius: '0 5px 5px 0',
      }}
    >
      <div style={{
        fontSize: '0.91rem',
        fontWeight: 600,
        color: COLORS.text,
        marginBottom: '0.3rem',
      }}>
        <Link
          href={`/path/upgrade/${toSlug(d.label)}`}
          className="audioxx-direction-label"
          style={{ color: 'inherit', textDecoration: 'none' }}
        >
          {isDoNothing ? '→ ' : ''}{d.label}
        </Link>
      </div>
      <div style={{
        fontSize: '0.86rem',
        lineHeight: 1.65,
        color: COLORS.textSecondary,
      }}>
        <span style={{ fontWeight: 500 }}>Optimises:</span> {d.optimises}
      </div>
      <div style={{
        fontSize: '0.86rem',
        lineHeight: 1.65,
        color: COLORS.textSecondary,
      }}>
        <span style={{ fontWeight: 500 }}>Trade-off:</span> {d.tradeOff}
      </div>
      {d.systemInteraction && (
        <div style={{
          fontSize: '0.84rem',
          lineHeight: 1.6,
          color: COLORS.textMuted,
          marginTop: '0.2rem',
          fontStyle: 'italic',
        }}>
          {d.systemInteraction}
        </div>
      )}
      {d.exampleGear && d.exampleGear.length > 0 && (
        <DirectionExamples examples={d.exampleGear} />
      )}
    </div>
  );
}

// ── Explore examples block ───────────────────────────
//
// Minimal, secondary-weight list of 2–3 representative products per
// direction. Mirrors the visual level of "Further reading" on product
// cards: 0.72rem uppercase muted label, inline link row beneath.
// No pricing, no trait data, no full card UI — name + links only.

function DirectionExamples({
  examples,
}: { examples: Array<{ brand: string; name: string; hifiSharkUrl: string; manufacturerUrl?: string }> }) {
  return (
    <div style={{ marginTop: '0.5rem' }}>
      <span style={{
        fontSize: '0.72rem',
        fontWeight: 600,
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginRight: '0.4rem',
      }}>
        Explore examples
      </span>
      <ul style={{
        margin: '0.25rem 0 0 0',
        padding: 0,
        listStyle: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.2rem',
      }}>
        {examples.map((ex, idx) => (
          <li key={idx} style={{
            fontSize: '0.82rem',
            lineHeight: 1.55,
            color: COLORS.textSecondary,
          }}>
            <span style={{ fontWeight: 500, color: COLORS.text }}>
              {ex.brand} {ex.name}
            </span>
            <span style={{ color: COLORS.textLight, margin: '0 0.4rem' }}>·</span>
            <a
              href={ex.hifiSharkUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: COLORS.accent,
                textDecoration: 'none',
                fontSize: '0.78rem',
              }}
            >
              HiFiShark
            </a>
            {ex.manufacturerUrl && (
              <>
                <span style={{ color: COLORS.textLight, margin: '0 0.4rem' }}>·</span>
                <a
                  href={ex.manufacturerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: COLORS.accent,
                    textDecoration: 'none',
                    fontSize: '0.78rem',
                  }}
                >
                  Manufacturer
                </a>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Editorial Closing Block ──────────────────────────

function EditorialClosingBlock({ closing }: { closing: EditorialClosing }) {
  return (
    <div style={{ marginTop: '0.5rem' }}>
      {/* Top picks on sound quality */}
      {closing.topPicks && closing.topPicks.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{
            margin: '0 0 0.85rem 0',
            fontSize: '1.3rem',
            fontWeight: 700,
            color: COLORS.text,
            letterSpacing: '-0.015em',
          }}>
            Top Recommendations (Value + Sound)
          </h3>
          <p style={{
            margin: '0 0 0.75rem 0',
            fontSize: '0.95rem',
            color: COLORS.textSecondary,
          }}>
            If choosing purely on sound quality:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {closing.topPicks.map((pick, i) => (
              <EditorialPickLine key={i} pick={pick} index={i + 1} />
            ))}
          </div>
        </div>
      )}

      {/* System-specific picks */}
      {closing.systemPicks && closing.systemPicks.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{
            margin: '0 0 0.65rem 0',
            fontSize: '1.3rem',
            fontWeight: 700,
            color: COLORS.text,
            letterSpacing: '-0.015em',
          }}>
            What I&rsquo;d Recommend For <em>Your</em> System
          </h3>
          {closing.systemSummary && (
            <p style={{
              margin: '0 0 0.75rem 0',
              fontSize: '0.95rem',
              color: COLORS.textSecondary,
            }}>
              {closing.systemSummary}
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {closing.systemPicks.map((pick, i) => (
              <EditorialPickLine key={i} pick={pick} index={i + 1} />
            ))}
          </div>
        </div>
      )}

      {/* Avoidance note */}
      {closing.avoidanceNote && (
        <p style={{
          margin: '0.5rem 0 0 0',
          fontSize: '0.91rem',
          lineHeight: 1.7,
          color: COLORS.textSecondary,
          fontStyle: 'italic',
        }}>
          {closing.avoidanceNote}
        </p>
      )}
    </div>
  );
}

function EditorialPickLine({ pick, index }: { pick: EditorialPick; index: number }) {
  const ORDINAL_EMOJI = ['', '\u0031\uFE0F\u20E3', '\u0032\uFE0F\u20E3', '\u0033\uFE0F\u20E3'];
  const emoji = ORDINAL_EMOJI[index] ?? `${index}.`;

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
      <span style={{ fontSize: '0.95rem', flexShrink: 0 }}>{emoji}</span>
      <div>
        <span style={{
          fontWeight: 600,
          fontSize: '0.95rem',
          color: COLORS.text,
        }}>
          {pick.name}
        </span>
        <span style={{
          fontSize: '0.91rem',
          color: COLORS.textSecondary,
          marginLeft: '0.4rem',
        }}>
          {pick.reason}
        </span>
      </div>
    </div>
  );
}

// ── Editorial Format (Shopping Recommendations) ──────
//
// Page structure:
//   1. Title (e.g. "Best DACs Under $2,000")
//   2. Audio Preferences profile
//   3. Decision frame (strategic directions)
//   4. Editorial intro paragraph
//   5. Divider
//   6. Product sections (primary content — supporting evidence)
//   7. Editorial closing (LLM: system-specific picks + avoidance)
//   8. Refinement prompts
//   9. Sources

function EditorialFormat({ advisory: a, onPreferenceCapture }: AdvisoryMessageProps) {
  // Build concise decision guidance — short "If you want X → choose Y" lines.
  // Extract the core quality from fitNote (expected format: "Best for X and Y").
  const decisionLines: string[] = [];
  if (a.options && a.options.length >= 2) {
    for (const opt of a.options) {
      const name = [opt.brand, opt.name].filter(Boolean).join(' ');
      const raw = opt.fitNote || opt.character || '';
      if (!raw) continue;
      // Strip "Best for " prefix to get the quality, then rebuild as guidance
      const quality = raw.replace(/^best for\s+/i, '').split('.')[0].trim();
      if (quality && quality.length <= 60) {
        decisionLines.push(`If you want ${quality.toLowerCase()} → **${name}**`);
      }
    }
  }

  return (
    <div style={{ lineHeight: FONTS.lineHeight, color: COLORS.text }}>

      {/* ── 0. Audio Preferences ────────────────────────── */}
      {a.audioProfile && <AudioPreferencesBlock profile={a.audioProfile} advisoryMode={a.advisoryMode} />}

      {/* ── 0b. Start Here — preference capture CTA ────── */}
      {a.lowPreferenceSignal && a.shoppingCategory && onPreferenceCapture && (
        <StartHereBlock
          category={a.shoppingCategory}
          onCapture={(sels) => onPreferenceCapture(sels, a.shoppingCategory!)}
        />
      )}

      {/* ── 0c. Category Preamble — decision framing (NOT gated by lowPreferenceSignal) ── */}
      {a.categoryPreamble && (
        <p style={{
          margin: '0 0 1.25rem 0',
          fontSize: FONTS.bodySize,
          lineHeight: FONTS.lineHeight,
          color: COLORS.text,
        }}>
          {renderText(a.categoryPreamble)}
        </p>
      )}

      {/* ── 0d. Category Framing — what actually matters in this category ── */}
      {a.categoryFraming && (
        <div style={{
          margin: '0 0 1.5rem 0',
          padding: '0.9rem 1.1rem',
          background: '#f6f4ee',
          borderRadius: '6px',
          borderLeft: `3px solid ${COLORS.accent}`,
        }}>
          <div style={{
            fontWeight: 700,
            fontSize: '0.78rem',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: COLORS.accent,
            marginBottom: '0.5rem',
          }}>
            {a.categoryFraming.headline}
          </div>
          {a.categoryFraming.points.map((pt, i) => (
            <p key={i} style={{
              margin: i === 0 ? 0 : '0.4rem 0 0 0',
              fontSize: '0.92rem',
              lineHeight: 1.65,
              color: COLORS.text,
            }}>
              {renderText(`\u2022 ${pt}`)}
            </p>
          ))}
        </div>
      )}

      {/* ── 1. System Interpretation (reasoning before products) ── */}
      {/* Suppress when StartHereBlock is active — passive explanations replaced by active CTA */}
      {a.systemInterpretation && !a.lowPreferenceSignal && (
        <p style={{
          margin: '0 0 1.5rem 0',
          fontSize: FONTS.bodySize,
          lineHeight: FONTS.lineHeight,
          color: COLORS.text,
        }}>
          {renderText(a.systemInterpretation)}
        </p>
      )}

      {/* ── 2. Strategy Bullets (conceptual guidance) ──────── */}
      {a.strategyBullets && a.strategyBullets.length > 0 && (
        <div style={{
          margin: '0 0 1.5rem 0',
          padding: '0.75rem 1rem',
          background: COLORS.accentBg,
          borderRadius: '6px',
          borderLeft: `3px solid ${COLORS.accent}`,
          fontSize: '0.95rem',
          lineHeight: 1.8,
          color: COLORS.text,
        }}>
          {a.strategyBullets.map((bullet, i) => (
            <p key={i} style={{ margin: i === 0 ? 0 : '0.35rem 0 0 0' }}>
              {renderText(`• ${bullet}`)}
            </p>
          ))}
        </div>
      )}

      {/* ── 2b. Expected Impact ───────────────────────────── */}
      {a.expectedImpact && (
        <div style={{
          margin: '0 0 1.25rem 0',
          padding: '0.6rem 0.85rem',
          background: '#f8f7f4',
          borderRadius: '5px',
          fontSize: '0.9rem',
          lineHeight: 1.6,
          color: COLORS.textSecondary,
        }}>
          <span style={{ fontWeight: 600, color: COLORS.text }}>
            Expected impact in your system:
          </span>{' '}
          <span style={{
            fontWeight: 600,
            color: a.expectedImpact.tier === 'system-level' ? COLORS.green
              : a.expectedImpact.tier === 'noticeable' ? COLORS.amber
              : COLORS.textMuted,
          }}>
            {a.expectedImpact.label}
          </span>
          <span style={{ color: COLORS.textMuted }}> — </span>
          {a.expectedImpact.explanation}
        </div>
      )}

      {/* ── 2c. System Fit Explanation ─────────────────────── */}
      {a.systemFitExplanation && (
        <p style={{
          margin: '0 0 1.25rem 0',
          padding: '0.55rem 0.85rem',
          fontSize: '0.9rem',
          lineHeight: 1.65,
          color: COLORS.text,
          fontStyle: 'italic',
          borderLeft: `2px solid ${COLORS.accent}`,
          background: 'transparent',
        }}>
          <span style={{ fontWeight: 600, fontStyle: 'normal', fontSize: '0.85rem', color: COLORS.textSecondary }}>
            Why this works in your system:
          </span>{' '}
          {renderText(a.systemFitExplanation)}
        </p>
      )}

      {/* ── 3. Transition to products ─────────────────────── */}
      <p style={{
        margin: '0 0 1.25rem 0',
        fontSize: '0.95rem',
        lineHeight: 1.75,
        color: COLORS.textSecondary,
      }}>
        {a.editorialIntro
          ? renderText(a.editorialIntro)
          : null}
      </p>

      {/* ── 4. Product cards ──────────────────────────────── */}
      {a.options && a.options.length > 0 && (
        <AdvisoryProductCards options={a.options} preferImage />
      )}

      {/* ── 4a0. Decision Guidance — "If X → choose Y" ── */}
      {a.decisionGuidance && a.decisionGuidance.length > 0 && (
        <div style={{
          margin: '1.5rem 0',
          padding: '1rem 1.25rem',
          background: '#fbfaf6',
          borderRadius: '8px',
          border: `1px solid ${COLORS.accent}`,
        }}>
          <div style={{
            fontWeight: 700,
            fontSize: '0.78rem',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: COLORS.accent,
            marginBottom: '0.6rem',
          }}>
            How to choose
          </div>
          {a.decisionGuidance.map((g, i) => (
            <p key={i} style={{
              margin: i === 0 ? 0 : '0.45rem 0 0 0',
              fontSize: '0.95rem',
              lineHeight: 1.65,
              color: COLORS.text,
            }}>
              <span style={{ color: COLORS.textSecondary }}>If {g.condition} → </span>
              <strong>{g.pick}</strong>
            </p>
          ))}
        </div>
      )}

      {/* ── 4a. Preference reflection ── */}
      {/* Suppress when content is thin (≤2 priorities, no avoids, no listening context)
          — it would just echo back what the user already said. Only show when there's
          enough accumulated signal to add genuine value. */}
      {(a.listenerPriorities && a.listenerPriorities.length > 2
        || (a.listenerPriorities && a.listenerPriorities.length > 0 && a.listenerAvoids && a.listenerAvoids.length > 0)
        || (a.listenerPriorities && a.listenerPriorities.length > 0 && a.audioProfile?.listeningContext && a.audioProfile.listeningContext.length > 0)) && (
        <div style={{
          margin: '1.5rem 0',
          padding: '1rem 1.25rem',
          background: 'linear-gradient(135deg, #faf8f3 0%, #f5f3ee 100%)',
          borderRadius: '8px',
          borderLeft: `3px solid ${COLORS.accent}`,
          fontSize: '0.93rem',
          lineHeight: 1.7,
          color: COLORS.text,
        }}>
          <div style={{
            fontWeight: 700,
            marginBottom: '0.5rem',
            fontSize: '0.75rem',
            color: COLORS.accent,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            What I&apos;m hearing from you
          </div>

          {/* Context signals: budget / room / music (compact row) */}
          {a.audioProfile && (a.audioProfile.budget || (a.audioProfile.listeningContext && a.audioProfile.listeningContext.length > 0)) && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.4rem',
              marginBottom: '0.6rem',
            }}>
              {a.audioProfile.budget && (
                <span style={{
                  fontSize: '0.78rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '3px',
                  background: '#eee',
                  color: COLORS.textSecondary,
                  fontWeight: 500,
                }}>
                  {a.audioProfile.budget}
                </span>
              )}
              {a.audioProfile.listeningContext?.map((ctx, i) => (
                <span key={i} style={{
                  fontSize: '0.78rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '3px',
                  background: '#eee',
                  color: COLORS.textSecondary,
                  fontWeight: 500,
                }}>
                  {ctx}
                </span>
              ))}
            </div>
          )}

          {/* Priority values */}
          {a.listenerPriorities.map((p, i) => (
            <p key={i} style={{ margin: i === 0 ? 0 : '0.3rem 0 0 0' }}>
              {renderText(`\u2022 ${p}`)}
            </p>
          ))}

          {/* Avoids */}
          {a.listenerAvoids && a.listenerAvoids.length > 0 && (
            <div style={{
              marginTop: '0.6rem',
              paddingTop: '0.5rem',
              borderTop: '1px solid #e8e4dd',
            }}>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                color: COLORS.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                Deprioritizing
              </span>
              <span style={{ fontSize: '0.88rem', color: COLORS.textMuted, marginLeft: '0.5rem' }}>
                {a.listenerAvoids.join(', ')}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── 4b. Taste Reflection Block (post-products context) ── */}
      {a.tasteReflection && a.tasteReflection.bullets.length > 0 && (
        <div style={{
          margin: '1.5rem 0',
          padding: '1rem 1.25rem',
          background: 'linear-gradient(135deg, #f8f6f1 0%, #f3f0ea 100%)',
          borderRadius: '8px',
          borderLeft: '3px solid #8a7a5a',
          fontSize: '0.9rem',
          lineHeight: 1.75,
          color: COLORS.text,
        }}>
          <div style={{
            fontWeight: 700,
            marginBottom: '0.6rem',
            fontSize: '0.73rem',
            color: '#8a7a5a',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            What your choices reveal
          </div>
          <p style={{
            margin: '0 0 0.7rem 0',
            fontSize: '0.88rem',
            fontWeight: 500,
            color: COLORS.textSecondary,
            fontStyle: 'italic',
          }}>
            {a.tasteReflection.summary}
          </p>
          {a.tasteReflection.bullets.map((bullet, i) => (
            <p key={i} style={{
              margin: i === 0 ? 0 : '0.5rem 0 0 0',
              fontSize: '0.88rem',
              lineHeight: 1.7,
              color: COLORS.text,
            }}>
              {renderText(`\u2022 ${bullet}`)}
            </p>
          ))}
        </div>
      )}

      {/* ── 4c. System Pairing Intro (post-products context) ── */}
      {a.systemPairingIntro && (
        <p style={{
          margin: '0 0 1rem 0',
          fontSize: '0.93rem',
          lineHeight: 1.75,
          color: COLORS.text,
          fontWeight: 500,
        }}>
          {renderText(a.systemPairingIntro)}
        </p>
      )}

      {/* ── 4d. Decisive Recommendation ("What I would actually do") ── */}
      {a.decisiveRecommendation && (
        <div style={{
          margin: '1.75rem 0 1.5rem 0',
          padding: '1rem 1.25rem',
          background: 'linear-gradient(135deg, #f5f3ee 0%, #f0ede6 100%)',
          borderRadius: '8px',
          borderLeft: '3px solid #6a7a5a',
          fontSize: '0.9rem',
          lineHeight: 1.7,
          color: COLORS.text,
        }}>
          <div style={{
            fontWeight: 700,
            marginBottom: '0.7rem',
            fontSize: '0.73rem',
            color: '#6a7a5a',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            What I would do
          </div>
          <div style={{ marginBottom: '0.6rem' }}>
            <span style={{ fontWeight: 600, color: COLORS.text }}>
              {'→ Pick '}
              {a.decisiveRecommendation.topPick.brand}{' '}
              {a.decisiveRecommendation.topPick.name}
            </span>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.88rem', color: COLORS.textSecondary }}>
              {a.decisiveRecommendation.topPick.reason}
            </p>
          </div>
          {a.decisiveRecommendation.alternative && (
            <div>
              <span style={{ fontWeight: 600, color: COLORS.textSecondary }}>
                {'→ Alternative: '}
                {a.decisiveRecommendation.alternative.brand}{' '}
                {a.decisiveRecommendation.alternative.name}
              </span>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.88rem', color: COLORS.textSecondary }}>
                {a.decisiveRecommendation.alternative.reason}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── 5. Decision guidance (only when ≥4 products — small lists speak for themselves) ── */}
      {decisionLines.length >= 4 && (
        <div style={{
          margin: '2rem 0 1.5rem 0',
          padding: '0.85rem 1.1rem',
          background: COLORS.accentBg,
          borderRadius: '6px',
          borderLeft: `3px solid ${COLORS.accent}`,
          fontSize: '0.95rem',
          lineHeight: 1.85,
          color: COLORS.text,
        }}>
          {decisionLines.map((line, i) => (
            <p key={i} style={{ margin: i === 0 ? 0 : '0.4rem 0 0 0' }}>
              {renderText(line)}
            </p>
          ))}
        </div>
      )}

      {/* ── 6. Follow-up question ─────────────────────────── */}
      {/* Suppress when StartHereBlock is active — it replaces the text-based refinement path */}
      {a.followUp && !a.lowPreferenceSignal && (
        <p style={{
          margin: '0 0 1rem 0',
          fontSize: '0.95rem',
          lineHeight: 1.75,
          color: COLORS.textSecondary,
          fontStyle: 'italic',
        }}>
          {a.followUp}
        </p>
      )}

      {/* ── 7. Provisional caveat (subtle) ────────────────── */}
      {/* Suppress when StartHereBlock is active — it provides the refinement path */}
      {a.provisional && a.statedGaps && a.statedGaps.length > 0 && !a.lowPreferenceSignal && (
        <div style={{
          fontSize: '0.88rem',
          color: COLORS.textLight,
          fontStyle: 'italic',
          marginBottom: '1rem',
        }}>
          Based on limited context — missing: {a.statedGaps.join(', ')}
        </div>
      )}

      {/* ── 8. Learn more (links) ──────────────────────────── */}
      {/* Guard: any response-level links render here, after follow-up. */}
      {a.links && a.links.length > 0 && (
        <AdvisorySection label="Learn more">
          <AdvisoryLinks links={a.links} />
        </AdvisorySection>
      )}
    </div>
  );
}

// ── Lane Detection ──────────────────────────────────────

function isIntakeFormat(a: AdvisoryResponse): boolean {
  return !!(a.intakeQuestions && a.intakeQuestions.length > 0);
}

function isKnowledgeFormat(a: AdvisoryResponse): boolean {
  return !!(a.knowledgeResponse);
}

function isAssistantFormat(a: AdvisoryResponse): boolean {
  return !!(a.assistantResponse);
}

// ── Knowledge Format (Lane 2) ──────────────────────────

const ASSISTANT_TASK_LABELS: Record<string, string> = {
  negotiation: 'Negotiation Advice',
  translation: 'Translation',
  message: 'Message Draft',
  logistics: 'Dealer & Audition Info',
  listing_evaluation: 'Listing Evaluation',
  general: 'Practical Help',
};

function KnowledgeFormat({ advisory: a }: AdvisoryMessageProps) {
  const kr = a.knowledgeResponse!;

  return (
    <div style={{ fontSize: FONTS.bodySize, lineHeight: FONTS.lineHeight, color: COLORS.text }}>
      <ModeIndicator mode={a.advisoryMode} />

      {a.audioProfile && <AudioPreferencesBlock profile={a.audioProfile} advisoryMode={a.advisoryMode} />}

      <AdvisorySection label={kr.topic}>
        <p style={{ margin: '0 0 0.95rem 0', color: COLORS.text, lineHeight: FONTS.lineHeight }}>
          {kr.explanation}
        </p>
      </AdvisorySection>

      {kr.keyPoints && kr.keyPoints.length > 0 && (
        <AdvisorySection label="Key points">
          <BulletList items={kr.keyPoints} />
        </AdvisorySection>
      )}

      {kr.systemNote && (
        <div
          style={{
            borderLeft: `3px solid ${COLORS.accent}`,
            paddingLeft: '1rem',
            padding: '0.8rem 1rem',
            marginBottom: '1.5rem',
            background: '#f6f9fa',
            borderRadius: '0 6px 6px 0',
          }}
        >
          <div style={{
            fontSize: '0.78rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase' as const,
            color: COLORS.accentLight,
            marginBottom: '0.4rem',
          }}>
            In your system
          </div>
          <p style={{ margin: 0, color: COLORS.text, lineHeight: FONTS.lineHeight }}>
            {kr.systemNote}
          </p>
        </div>
      )}

      {a.followUp && (
        <p style={{
          margin: '0 0 0.5rem 0',
          fontStyle: 'italic',
          color: COLORS.textMuted,
          fontSize: '0.92rem',
        }}>
          {a.followUp}
        </p>
      )}
    </div>
  );
}

// ── Assistant Format (Lane 3) ──────────────────────────

function AssistantFormat({ advisory: a }: AdvisoryMessageProps) {
  const ar = a.assistantResponse!;
  const taskLabel = ASSISTANT_TASK_LABELS[ar.taskType] || 'Audio Assistant';

  return (
    <div style={{ fontSize: FONTS.bodySize, lineHeight: FONTS.lineHeight, color: COLORS.text }}>
      <ModeIndicator mode={a.advisoryMode} />

      <AdvisorySection label={taskLabel}>
        <p style={{ margin: '0 0 0.95rem 0', color: COLORS.text, lineHeight: FONTS.lineHeight, whiteSpace: 'pre-wrap' }}>
          {ar.body}
        </p>
      </AdvisorySection>

      {ar.sourceLanguage && ar.targetLanguage && (
        <div style={{
          fontSize: '0.82rem',
          color: COLORS.textMuted,
          marginBottom: '0.8rem',
          fontStyle: 'italic',
        }}>
          {ar.sourceLanguage} → {ar.targetLanguage}
        </div>
      )}

      {ar.tips && ar.tips.length > 0 && (
        <AdvisorySection label="Things to keep in mind">
          <BulletList items={ar.tips} />
        </AdvisorySection>
      )}
    </div>
  );
}

// ── Decisive Format (Conclusion mode — "What would you actually do?") ──
//
// A completely separate render path for conclusion-intent turns.
// Shows ONLY the advisor's direct recommendation — no product cards,
// no price blocks, no "Why this fits you", no editorial chrome.
// Designed to feel like a personal conclusion from a trusted advisor.

function isDecisiveFormat(a: AdvisoryResponse): boolean {
  // Decisive mode wins when decisiveRecommendation is present AND options are
  // absent/empty. The page.tsx conclusion-mode code strips options before
  // dispatch, so this should always be true for conclusion-intent turns.
  const result = !!(a.decisiveRecommendation && (!a.options || a.options.length === 0));
  console.log('[decisive-debug] isDecisiveFormat: hasDecisive=%s, hasOptions=%s, optionCount=%d → %s',
    !!a.decisiveRecommendation, !!a.options, (a.options ?? []).length, result);
  return result;
}

function DecisiveFormat({ advisory: a }: AdvisoryMessageProps) {
  const d = a.decisiveRecommendation!;

  return (
    <div style={{
      lineHeight: FONTS.lineHeight,
      color: COLORS.text,
      maxWidth: '68rem',
    }}>

      {/* ── System pairing context (if available) ──────── */}
      {a.systemPairingIntro && (
        <p style={{
          margin: '0 0 1.5rem 0',
          fontSize: '0.94rem',
          lineHeight: 1.8,
          color: COLORS.textSecondary,
        }}>
          {renderText(a.systemPairingIntro)}
        </p>
      )}

      {/* ── Decisive container ───────────────────────── */}
      <div style={{
        padding: '1.4rem 1.5rem 1.3rem',
        background: '#faf9f5',
        borderRadius: '10px',
        border: '1px solid #e8e4da',
      }}>
        {/* Section label */}
        <div style={{
          fontWeight: 700,
          marginBottom: '1.1rem',
          paddingBottom: '0.65rem',
          borderBottom: '1px solid #ece8df',
          fontSize: '0.72rem',
          color: '#6a7a5a',
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
        }}>
          What I would actually do
        </div>

        {/* ── Top pick ─────────────────────────────── */}
        <div style={{ marginBottom: '1.2rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '0.45rem',
            marginBottom: '0.35rem',
          }}>
            <span style={{
              color: '#6a7a5a',
              fontWeight: 700,
              fontSize: '1rem',
              lineHeight: 1,
            }}>→</span>
            <span style={{
              fontWeight: 600,
              fontSize: '1.05rem',
              color: COLORS.text,
              letterSpacing: '-0.01em',
            }}>
              {d.topPick.brand} {d.topPick.name}
            </span>
          </div>
          <p style={{
            margin: '0 0 0 1.15rem',
            fontSize: '0.93rem',
            color: COLORS.textSecondary,
            lineHeight: 1.75,
          }}>
            {d.topPick.reason}
          </p>
        </div>

        {/* ── Alternative (optional — omitted when only one eligible product) ── */}
        {d.alternative && (
          <>
            <div style={{
              height: 1,
              background: '#ece8df',
              margin: '0 0 1.1rem 0',
            }} />
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '0.45rem',
                marginBottom: '0.3rem',
              }}>
                <span style={{
                  color: COLORS.textMuted,
                  fontWeight: 600,
                  fontSize: '0.92rem',
                  lineHeight: 1,
                }}>→</span>
                <span style={{
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  color: COLORS.textSecondary,
                }}>
                  Alternative: {d.alternative.brand} {d.alternative.name}
                </span>
              </div>
              <p style={{
                margin: '0 0 0 1.15rem',
                fontSize: '0.9rem',
                color: COLORS.textMuted,
                lineHeight: 1.7,
              }}>
                {d.alternative.reason}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Classic Format (Consultations, Diagnosis, Comparisons) ──

function StandardFormat({ advisory: a, onPreferenceCapture }: AdvisoryMessageProps) {
  // Redirect to editorial format when product options are present
  if (isEditorialFormat(a)) {
    return <EditorialFormat advisory={a} onPreferenceCapture={onPreferenceCapture} />;
  }

  const hasListenerPriorities = (a.listenerPriorities && a.listenerPriorities.length > 0)
    || (a.listenerAvoids && a.listenerAvoids.length > 0);

  const hasProvisionalCaveats = a.provisional
    && a.statedGaps
    && a.statedGaps.length > 0;

  return (
    <div style={{ lineHeight: FONTS.lineHeight, color: COLORS.text }}>
      {/* ── Mode indicator ──────────────────────────── */}
      <ModeIndicator mode={a.advisoryMode} />

      {/* ── Provenance label (LLM-inferred responses) ── */}
      <ProvenanceLabel source={a.source} unknownComponents={a.unknownComponents} />

      {/* ── 0a. Diagnosis: system interpretation ────────── */}
      {a.diagnosisInterpretation && (
        <p style={{
          margin: '0 0 1.25rem 0',
          fontSize: FONTS.bodySize,
          lineHeight: FONTS.lineHeight,
          color: COLORS.text,
        }}>
          {a.diagnosisInterpretation}
        </p>
      )}

      {/* ── 1. Comparison summary (side-by-side format) ── */}
      {a.comparisonSummary && (
        <div
          style={{
            margin: '0 0 1.25rem 0',
            fontSize: '1rem',
            color: '#333',
            lineHeight: 1.75,
          }}
        >
          {/* Compared-subject thumbnails. Only render when BOTH entries have a
              real image — otherwise the block collapses and the comparison
              renders as clean labelled prose. Letter-tile placeholders are
              suppressed globally (see product-images.ts) because the
              catalog's imageUrl fields are not yet populated. */}
          {/* ── Comparison hero images — side by side, large format ── */}
          {a.comparisonImages
            && a.comparisonImages.length === 2
            && a.comparisonImages.every((e) => !!e.imageUrl) && (
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'stretch',
                margin: '0 0 1rem 0',
              }}
            >
              {a.comparisonImages.map((entry, i) => {
                // Card context — always show image when available (no dedup).
                const show = !!entry.imageUrl;
                return show ? (
                <div key={i} style={{ flex: '1 1 0', minWidth: 0 }}>
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '4 / 3',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      background: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.75rem',
                      boxSizing: 'border-box',
                      marginBottom: '0.4rem',
                    }}
                  >
                    <img
                      src={entry.imageUrl}
                      alt={`${entry.brand} ${entry.name}`.trim()}
                      referrerPolicy="no-referrer"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                      onError={(e) => {
                        const wrap = (e.currentTarget as HTMLImageElement).parentElement;
                        if (wrap) wrap.style.display = 'none';
                      }}
                    />
                  </div>
                  <div style={{
                    fontSize: '0.85rem',
                    color: '#555',
                    textAlign: 'center',
                    fontWeight: 500,
                  }}>
                    {[entry.brand, entry.name].filter(Boolean).join(' ')}
                  </div>
                </div>
                ) : <div key={i} />;
              })}
            </div>
          )}
          {a.comparisonSummary.split(/\n\n/).filter((s: string) => s.trim()).map((segment: string, i: number) => (
            <p
              key={i}
              style={{
                margin: i === 0 ? '0 0 0.7rem 0' : '0 0 0.7rem 0',
              }}
            >
              {renderText(segment.trim())}
            </p>
          ))}
        </div>
      )}

      {/* ── 2. Audio Preferences ────────────────────── */}
      {a.audioProfile && <AudioPreferencesBlock profile={a.audioProfile} advisoryMode={a.advisoryMode} />}

      {/* ── System Assessment Block ── */}
      {a.componentReadings && a.componentReadings.length > 0 && a.systemContext && (
        <AdvisorySection label="System character">
          <p style={{ margin: 0, fontSize: FONTS.bodySize, lineHeight: FONTS.lineHeight }}>
            {a.systemContext}
          </p>
        </AdvisorySection>
      )}

      {a.componentReadings && a.componentReadings.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          {a.componentReadings.map((para, i) => (
            <p key={i} style={{ margin: '0 0 0.95rem 0', fontSize: FONTS.bodySize, lineHeight: FONTS.lineHeight, color: COLORS.text }}>
              {para}
            </p>
          ))}
        </div>
      )}

      {a.systemInteraction && (
        <AdvisorySection label="How the components interact">
          <p style={{ margin: 0, fontSize: FONTS.bodySize, lineHeight: FONTS.lineHeight }}>
            {a.systemInteraction}
          </p>
        </AdvisorySection>
      )}

      {a.assessmentStrengths && a.assessmentStrengths.length > 0 && (
        <AdvisorySection label="What is working well">
          <BulletList items={a.assessmentStrengths} />
        </AdvisorySection>
      )}

      {a.assessmentLimitations && a.assessmentLimitations.length > 0 && (
        <AdvisorySection label="Where limitations may appear">
          <BulletList items={a.assessmentLimitations} color={COLORS.textMuted} />
        </AdvisorySection>
      )}

      {a.upgradeDirection && (
        <AdvisorySection label="Likely upgrade direction">
          <p style={{ margin: 0, fontSize: FONTS.bodySize, lineHeight: FONTS.lineHeight }}>
            {a.upgradeDirection}
          </p>
        </AdvisorySection>
      )}

      {/* ── 3. System context (non-assessment) ── */}
      {a.systemContext && !a.componentReadings && (
        <AdvisorySection label="Your system">
          <p style={{ margin: 0, fontSize: FONTS.bodySize, lineHeight: FONTS.lineHeight }}>
            {a.systemContext}
          </p>
        </AdvisorySection>
      )}

      {a.systemTendencies && !a.systemContext && !a.systemInteraction && (
        <AdvisorySection label="System tendencies">
          <p style={{ margin: 0, fontSize: FONTS.bodySize, lineHeight: FONTS.lineHeight }}>
            {a.systemTendencies}
          </p>
        </AdvisorySection>
      )}

      {/* ── Why this fits you ──────────────────────── */}
      {a.whyFitsYou && a.whyFitsYou.length > 0 && (
        <div
          style={{
            borderLeft: `3px solid ${COLORS.accentLight}`,
            paddingLeft: '1rem',
            marginBottom: '1.5rem',
            background: COLORS.accentBg,
            padding: '0.8rem 1rem',
            borderRadius: '0 6px 6px 0',
          }}
        >
          <div
            style={{
              fontSize: FONTS.labelSize,
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase' as const,
              color: COLORS.accentLight,
              marginBottom: '0.45rem',
            }}
          >
            Why this fits you
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: FONTS.lineHeight }}>
            {a.whyFitsYou.map((bullet, i) => (
              <li key={i} style={{ fontSize: '0.95rem', color: COLORS.textSecondary, marginBottom: '0.4rem' }}>
                {bullet}
              </li>
            ))}
          </ul>
        </div>
      )}

      {a.strengths && a.strengths.length > 0 && (
        <AdvisorySection label="What is working well">
          <BulletList items={a.strengths} />
        </AdvisorySection>
      )}

      {a.limitations && a.limitations.length > 0 && (
        <AdvisorySection label="Where limitations may appear">
          <BulletList items={a.limitations} color={COLORS.textMuted} />
        </AdvisorySection>
      )}

      {/* ── 5. Core advisory body ────────────────── */}
      {(a.improvements && a.improvements.length > 0) ? (
        <>
          {a.tendencies && (
            <AdvisorySection label="What the proposed change actually does">
              <p style={{ margin: 0, fontSize: FONTS.bodySize, lineHeight: FONTS.lineHeight }}>
                {renderText(a.tendencies)}
              </p>
            </AdvisorySection>
          )}
        </>
      ) : (
        <AdvisoryProse
          philosophy={a.philosophy}
          tendencies={a.tendencies}
          systemFit={a.systemFit}
          provenanceNote={a.provenanceNote}
        />
      )}

      {/* ── 5a. Diagnosis: what this means ────────────── */}
      {a.diagnosisExplanation && (
        <AdvisorySection label="What this means">
          <p style={{ margin: 0, fontSize: FONTS.bodySize, lineHeight: FONTS.lineHeight }}>
            {a.diagnosisExplanation}
          </p>
        </AdvisorySection>
      )}

      {/* ── 5b. Diagnosis: where to act ─────────────── */}
      {a.diagnosisActions && a.diagnosisActions.length > 0 && (
        <AdvisorySection label="Where to act">
          <div style={{ display: 'grid', gap: '1.1rem' }}>
            {a.diagnosisActions.map((action, i) => (
              <div key={i} style={{ paddingLeft: '0.25rem' }}>
                <div style={{
                  fontWeight: 600,
                  fontSize: FONTS.bodySize,
                  color: COLORS.text,
                  marginBottom: '0.25rem',
                }}>
                  {i + 1}. {action.area}
                </div>
                <p style={{
                  margin: 0,
                  fontSize: FONTS.bodySize,
                  lineHeight: FONTS.lineHeight,
                  color: COLORS.textSecondary,
                }}>
                  {action.guidance}
                </p>
                {action.examples && (
                  <p style={{
                    margin: '0.3rem 0 0 0',
                    fontSize: FONTS.smallSize,
                    color: COLORS.textMuted,
                    fontStyle: 'italic',
                  }}>
                    Examples: {action.examples}
                  </p>
                )}
              </div>
            ))}
          </div>
        </AdvisorySection>
      )}

      {a.improvements && a.improvements.length > 0 && (
        <AdvisorySection label="What improves">
          <BulletList items={a.improvements} />
        </AdvisorySection>
      )}

      {a.unchanged && a.unchanged.length > 0 && (
        <AdvisorySection label="What probably stays the same">
          <BulletList items={a.unchanged} color={COLORS.textMuted} />
        </AdvisorySection>
      )}

      {/* ── 5b. Product detail (origin, interactions) */}
      {a.productOrigin && (
        <p style={{ margin: '0.5rem 0', fontSize: FONTS.smallSize, color: COLORS.textMuted, lineHeight: FONTS.lineHeight }}>
          {a.productOrigin}
        </p>
      )}

      {a.interactionNotes && a.interactionNotes.length > 0 && (
        <AdvisorySection label="System interactions">
          <BulletList items={a.interactionNotes} color={COLORS.textSecondary} />
        </AdvisorySection>
      )}

      {/* ── 6. Recommended direction ─────────────── */}
      {a.recommendedDirection && (
        <AdvisorySection label="What this means for component choice">
          <p style={{ margin: 0, fontSize: FONTS.bodySize, lineHeight: FONTS.lineHeight }}>
            {a.recommendedDirection}
          </p>
        </AdvisorySection>
      )}

      {a.whyThisFits && a.whyThisFits.length > 0 && (
        <AdvisorySection label="Why this fits">
          <BulletList items={a.whyThisFits} />
        </AdvisorySection>
      )}

      {a.tradeOffs && a.tradeOffs.length > 0 && (
        <AdvisorySection label="Trade-offs">
          <BulletList items={a.tradeOffs} color={COLORS.textMuted} />
        </AdvisorySection>
      )}

      {a.whenToAct && (
        <AdvisorySection label="When this upgrade makes sense">
          <p style={{ margin: 0, fontSize: FONTS.bodySize, lineHeight: FONTS.lineHeight }}>
            {a.whenToAct}
          </p>
        </AdvisorySection>
      )}

      {a.whenToWait && (
        <AdvisorySection label="When it may not be the best next step">
          <p style={{ margin: 0, fontSize: FONTS.bodySize, lineHeight: FONTS.lineHeight, color: COLORS.textMuted }}>
            {a.whenToWait}
          </p>
        </AdvisorySection>
      )}

      {a.systemBalance && a.systemBalance.length > 0 && (
        <AdvisorySection label="System balance summary">
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            {a.systemBalance.map((entry, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '0.5rem',
                  fontSize: '0.95rem',
                  lineHeight: 1.65,
                }}
              >
                <span style={{ fontWeight: 500, minWidth: '10rem', color: COLORS.text }}>
                  {entry.label}
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    color: entry.level === 'Strong' ? '#3a7a3a'
                      : entry.level === 'Good' ? '#5a7a3a'
                      : entry.level === 'Moderate' ? '#8a7a3a'
                      : entry.level === 'Limited' ? '#a06030'
                      : COLORS.textMuted,
                  }}
                >
                  {entry.level}
                </span>
                {entry.note && (
                  <span style={{ fontSize: '0.85rem', color: COLORS.textMuted, fontStyle: 'italic' }}>
                    — {entry.note}
                  </span>
                )}
              </div>
            ))}
          </div>
        </AdvisorySection>
      )}

      {a.upgradeImpactAreas && a.upgradeImpactAreas.length > 0 && (
        <AdvisorySection label="Where upgrades would have the most impact">
          <BulletList items={a.upgradeImpactAreas} />
        </AdvisorySection>
      )}

      {a.changeMagnitude && (
        <AdvisorySection label="Expected magnitude of change">
          <div style={{ fontSize: FONTS.bodySize, lineHeight: FONTS.lineHeight }}>
            <span
              style={{
                display: 'inline-block',
                fontWeight: 600,
                fontSize: '0.8rem',
                letterSpacing: '0.04em',
                textTransform: 'uppercase' as const,
                padding: '0.15rem 0.5rem',
                borderRadius: '4px',
                marginBottom: '0.45rem',
                color: a.changeMagnitude.tier === 'major' ? '#2a6a2a'
                  : a.changeMagnitude.tier === 'moderate' ? '#6a6a2a'
                  : COLORS.textMuted,
                background: a.changeMagnitude.tier === 'major' ? '#e8f5e8'
                  : a.changeMagnitude.tier === 'moderate' ? '#f5f5e0'
                  : '#f5f5f3',
              }}
            >
              {a.changeMagnitude.label}
            </span>
            <p style={{ margin: '0.45rem 0 0.2rem 0', color: COLORS.text }}>
              {a.changeMagnitude.changesmost}
            </p>
            <p style={{ margin: 0, color: COLORS.textMuted }}>
              {a.changeMagnitude.remainsSimilar}
            </p>
          </div>
        </AdvisorySection>
      )}

      {/* ── 9. Sonic Landscape ──────────────────── */}
      {a.sonicLandscape && (
        <AdvisorySection label="Sonic directions represented">
          <div style={{ fontSize: FONTS.bodySize, lineHeight: 1.8, color: COLORS.text }}>
            {a.sonicLandscape.split('\n').map((line, i) => {
              const boldMatch = line.match(/^\*\*(.+?)\*\*\s*(.+)/);
              if (boldMatch) {
                return (
                  <div key={i} style={{ marginBottom: '0.55rem', paddingLeft: '0.25rem' }}>
                    <span style={{ fontWeight: 600, color: '#333' }}>{boldMatch[1]}</span>
                    <span style={{ color: COLORS.textSecondary }}> {boldMatch[2]}</span>
                  </div>
                );
              }
              if (line.trim() === '') return null;
              return (
                <p key={i} style={{ margin: '0 0 0.55rem 0', color: i === 0 ? COLORS.text : COLORS.textSecondary }}>
                  {line}
                </p>
              );
            })}
          </div>
        </AdvisorySection>
      )}

      {hasProvisionalCaveats && (
        <div
          style={{
            fontSize: '0.85rem',
            color: COLORS.textLight,
            fontStyle: 'italic',
            marginBottom: '1rem',
          }}
        >
          Based on limited context
          {a.statedGaps && a.statedGaps.length > 0 && (
            <> — missing: {a.statedGaps.join(', ')}</>
          )}
          {a.dependencyCaveat && <>. {a.dependencyCaveat}</>}
        </div>
      )}

      {/* ── 11. Bottom line ──────────────────────── */}
      {a.bottomLine && (
        <p
          style={{
            margin: '0 0 1.25rem 0',
            fontWeight: 500,
            fontSize: '1.02rem',
            color: '#333',
            lineHeight: 1.7,
          }}
        >
          {a.bottomLine}
        </p>
      )}

      {/* ── 11b. Saved-system note ────────────────── */}
      {a.savedSystemNote && (
        <div
          style={{
            borderLeft: `3px solid ${COLORS.accent}`,
            paddingLeft: '1rem',
            padding: '0.8rem 1rem',
            marginBottom: '1.5rem',
            background: '#f6f9fa',
            borderRadius: '0 6px 6px 0',
          }}
        >
          <div style={{
            fontSize: '0.78rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase' as const,
            color: COLORS.accentLight,
            marginBottom: '0.4rem',
          }}>
            In your system
          </div>
          <p style={{ margin: 0, color: COLORS.text, lineHeight: FONTS.lineHeight }}>
            {a.savedSystemNote}
          </p>
        </div>
      )}

      {/* ── 12. Refinement prompts ────────────────── */}
      {/* Suppress when StartHereBlock is active — it replaces text-based refinement */}
      {a.refinementPrompts && a.refinementPrompts.length > 0 && !a.lowPreferenceSignal && (
        <div
          style={{
            borderLeft: '3px solid #7a9aaa',
            paddingLeft: '1rem',
            padding: '0.8rem 1rem',
            marginBottom: '1.5rem',
            background: '#f6f9fa',
            borderRadius: '0 6px 6px 0',
          }}
        >
          <div
            style={{
              fontSize: FONTS.labelSize,
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase' as const,
              color: '#7a9aaa',
              marginBottom: '0.45rem',
            }}
          >
            To refine this shortlist
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: FONTS.lineHeight }}>
            {a.refinementPrompts.map((prompt, i) => (
              <li key={i} style={{ fontSize: '0.95rem', color: COLORS.textSecondary, marginBottom: '0.15rem' }}>
                {prompt}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── 13. Follow-up ─────────────────────────── */}
      {a.followUp && !a.refinementPrompts?.length && !a.lowPreferenceSignal && (
        <div
          style={{
            borderLeft: '3px solid #7a9aaa',
            paddingLeft: '1rem',
            padding: '0.7rem 1rem',
            marginBottom: '1.5rem',
            background: '#f6f9fa',
            borderRadius: '0 6px 6px 0',
            fontSize: FONTS.bodySize,
            color: COLORS.textSecondary,
            lineHeight: 1.7,
          }}
        >
          {a.followUp}
        </div>
      )}

      {/* ── 14. Learn more (links) ───────────────── */}
      {/* All outbound links render here — never above the follow-up. */}
      {(a.links && a.links.length > 0) || (a.kind === 'consultation' && !a.componentReadings && (a.tendencies || a.philosophy || a.productOrigin || (a.improvements && a.improvements.length > 0))) ? (
        <AdvisorySection label="Learn more">
          {a.links && a.links.length > 0 && (
            <AdvisoryLinks links={a.links} />
          )}
          {a.kind === 'consultation' && !a.componentReadings && (a.tendencies || a.philosophy || a.productOrigin || (a.improvements && a.improvements.length > 0)) && (
            <ShoppingLinks
              name={a.subject}
              manufacturerUrl={a.links?.find((l) => l.kind === 'reference')?.url}
            />
          )}
        </AdvisorySection>
      ) : null}

      {/* ── 15. Sources ──────────────────────────── */}
      {a.sourceReferences && a.sourceReferences.length > 0 && (
        <AdvisorySection label="Sources">
          <AdvisorySources sources={a.sourceReferences} />
        </AdvisorySection>
      )}

      {/* ── 16. Diagnostics (collapsible) ────────── */}
      {a.diagnostics && (
        <div style={{ marginTop: '0.75rem' }}>
          <AdvisoryDiagnostics
            matchedPhrases={a.diagnostics.matchedPhrases}
            symptoms={a.diagnostics.symptoms}
            traits={a.diagnostics.traits}
          />
        </div>
      )}
    </div>
  );
}

// ── Quick Recommendation Format ────────────────────────

function QuickRecFormat({ quickRec }: { quickRec: QuickRecommendation }) {
  return (
    <div
      style={{
        padding: '0.85rem 0',
        fontSize: '0.95rem',
        lineHeight: 1.6,
        color: '#2a2a2a',
      }}
    >
      {/* Summary */}
      <p style={{ margin: '0 0 0.85rem 0', color: '#555', fontSize: '0.92rem' }}>
        {quickRec.summary}
      </p>

      {/* Options */}
      {quickRec.options.map((opt, i) => (
        <div
          key={i}
          style={{
            marginBottom: '0.75rem',
            paddingLeft: '0.75rem',
            borderLeft: '2px solid #e5e5e3',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '0.92rem', marginBottom: '0.2rem' }}>
            {opt.name}
          </div>
          <div
            style={{
              fontSize: '0.8rem',
              color: '#888',
              letterSpacing: '0.02em',
              marginBottom: '0.3rem',
            }}
          >
            {opt.direction}
          </div>
          <ul
            style={{
              margin: '0.15rem 0 0 0',
              paddingLeft: '1.1rem',
              fontSize: '0.88rem',
              color: '#555',
            }}
          >
            {opt.bullets.map((bullet, j) => (
              <li key={j} style={{ marginBottom: '0.1rem' }}>{bullet}</li>
            ))}
          </ul>
        </div>
      ))}

      {/* Follow-up question */}
      <p
        style={{
          margin: '0.85rem 0 0 0',
          color: '#666',
          fontSize: '0.9rem',
          fontStyle: 'italic',
        }}
      >
        {quickRec.followUp}
      </p>
    </div>
  );
}

// ── Main Export ────────────────────────────────────────

export default function AdvisoryMessage({ advisory, onIntakeSubmit, onPreferenceCapture }: AdvisoryMessageProps) {
  // Each advisory message gets its own ProductImageProvider.
  // Card contexts (product cards, comparison cards, upgrade paths)
  // always show images when available — no dedup.
  // Narrative prose references use claimImage() for first-reference dedup.
  let content: React.ReactNode;

  if (advisory.quickRecommendation) {
    content = <QuickRecFormat quickRec={advisory.quickRecommendation} />;
  } else if (isIntakeFormat(advisory)) {
    content = <AdvisoryIntake advisory={advisory} onSubmit={onIntakeSubmit} />;
  } else if (isMemoFormat(advisory)) {
    content = <MemoFormat advisory={advisory} />;
  } else if (isAssessmentFormat(advisory)) {
    content = <AssessmentFormat advisory={advisory} />;
  } else if (isKnowledgeFormat(advisory)) {
    content = <KnowledgeFormat advisory={advisory} />;
  } else if (isAssistantFormat(advisory)) {
    content = <AssistantFormat advisory={advisory} />;
  } else if (isDecisiveFormat(advisory)) {
    console.log('[decisive-debug] routing → DecisiveFormat');
    content = <DecisiveFormat advisory={advisory} />;
  } else {
    console.log('[decisive-debug] routing → StandardFormat (hasDecisive=%s, hasOptions=%s)',
      !!advisory.decisiveRecommendation, !!advisory.options);
    content = <StandardFormat advisory={advisory} onPreferenceCapture={onPreferenceCapture} />;
  }

  return (
    <ProductImageProvider
      comparisonImages={advisory.comparisonImages}
      options={advisory.options}
    >
      {content}
    </ProductImageProvider>
  );
}
