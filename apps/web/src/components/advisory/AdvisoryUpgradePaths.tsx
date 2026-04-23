/**
 * Ranked upgrade paths with product options.
 *
 * Each path: rank, label, impact tag, rationale, then nested product options
 * with pros/cons/verdict/systemDelta. Clean white card styling.
 *
 * Progressive enhancement: cards also render topology line, "What you'll hear",
 * "Technical rationale", positioning hints, and collapsible manufacturer context
 * when data is available. All sections are optional — cards degrade gracefully.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { UpgradePath, UpgradePathOption } from '../../lib/advisory-response';
import { buildProductLinks } from '../../lib/product-links';
import { toSlug } from '../../lib/route-slug';
import { renderText } from './render-text';

// ── Path-level framing post-processing ──
// When every option in a path is directional or sidegrade (not a true upgrade),
// the section heading and summary should not use "Upgrade" language.

function isAllDirectionalOrSidegrade(options: UpgradePathOption[]): boolean {
  if (options.length === 0) return false;
  return options.every(
    (o) => o.recommendationType === 'directional' || o.recommendationType === 'sidegrade',
  );
}

/** Replace "Upgrade" in a path label with "options" when all cards are directional/sidegrade. */
function neutralizeLabel(label: string, allDirectional: boolean): string {
  if (!allDirectional) return label;
  // "Speakers Upgrade" → "Speaker options", "DAC Upgrade" → "DAC options"
  return label
    .replace(/\s+Upgrade$/i, ' options')
    .replace(/\s+Change$/i, ' options');
}

/**
 * Soften rationale text that implies strict improvement when the path is
 * entirely directional. Replaces common upgrade-framing patterns with
 * trade-off-aware alternatives.
 */
function softenRationale(text: string, allDirectional: boolean): string {
  if (!allDirectional) return text;
  return text
    .replace(/\bA?\s*stronger\s+\w+\s+would\b/gi, 'A different direction would')
    .replace(/\bthis\s+upgrade\b/gi, 'this change')
    .replace(/\bupgrading\b/gi, 'changing')
    .replace(/\ban?\s+upgrade\b/gi, 'a change')
    .replace(/\btighten the overall presentation\b/gi, 'shift the system\'s balance toward a different set of trade-offs');
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$', CHF: 'CHF ',
};

function formatPrice(amount: number, currency?: string): string {
  const code = currency ?? 'USD';
  const symbol = CURRENCY_SYMBOLS[code] ?? `${code} `;
  return `${symbol}${amount.toLocaleString()}`;
}

/** Summary of a stacked trait from the system analysis, passed through for bridge text. */
interface StackedTrait {
  label: string;
  classification: 'system_character' | 'system_imbalance';
}

interface Props {
  paths: UpgradePath[];
  /** Stacked trait insights from the advisory — used for system-specific bridge text. */
  stackedTraits?: StackedTrait[];
  /** One-line system character summary (e.g. "controlled and precise"). */
  systemCharacterSummary?: string;
}

/**
 * Classify a path as refinement (same-category upgrade) or directional
 * (cross-category character shift). A path is directional when its label
 * signals system-level rebalancing OR all of its options are directional/sidegrade.
 */
function isDirectionalPath(path: UpgradePath): boolean {
  const lbl = path.label.toLowerCase();
  if (lbl.includes('rebalancing') || lbl.includes('direction')) return true;
  return isAllDirectionalOrSidegrade(path.options);
}

/**
 * Build system-specific bridge text from stacked traits and character summary.
 * Falls back to generic text when no system data is available.
 */
function buildBridgeText(
  hasDirectional: boolean,
  stackedTraits?: StackedTrait[],
  systemCharacterSummary?: string,
): string {
  // Build a readable character descriptor
  const trait = stackedTraits?.[0];
  const character = trait
    ? trait.label.replace(/_/g, ' ')
    : systemCharacterSummary ?? null;

  if (hasDirectional && character) {
    return `Your system leans ${character}. Some options below refine that character; others shift it in a new direction\u2009—\u2009trading what you have in surplus for qualities your chain currently underserves. Choose based on what you want more of.`;
  }
  if (hasDirectional) {
    return 'Some options below refine your current system character; others change it. Each trades one strength for another\u2009—\u2009choose based on what you want more of in your listening.';
  }
  if (character) {
    return `Your system leans ${character}. Each path targets a different part of the chain, ranked by alignment with your priorities\u2009—\u2009not by price or prestige.`;
  }
  return 'Each path targets a different part of the chain, ranked by alignment with your system and priorities\u2009—\u2009not by price or prestige.';
}

export default function AdvisoryUpgradePaths({ paths, stackedTraits, systemCharacterSummary }: Props) {
  // Detect if any path contains directional or sidegrade options — this
  // changes the intro framing from "upgrades" to "directions".
  const hasDirectional = paths.some((p) =>
    p.options.some((o) => o.recommendationType === 'directional' || o.recommendationType === 'sidegrade'),
  );

  // Separate refinement paths from directional paths for grouped rendering
  const refinementPaths = paths.filter((p) => !isDirectionalPath(p));
  const directionalPaths = paths.filter((p) => isDirectionalPath(p));

  const bridgeText = buildBridgeText(hasDirectional, stackedTraits, systemCharacterSummary);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Interpretive bridge — system-specific framing */}
      <p style={{
        margin: 0,
        fontSize: '0.92rem',
        lineHeight: 1.65,
        color: '#666',
        fontStyle: 'italic',
      }}>
        {bridgeText}
      </p>

      {/* ── Refinement paths ── */}
      {refinementPaths.length > 0 && hasDirectional && (
        <div style={{
          fontSize: '0.76rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase' as const,
          color: '#5a7050',
          marginBottom: '-0.5rem',
          marginTop: '0.25rem',
        }}>
          System refinement — keep current character
        </div>
      )}
      {refinementPaths.map((path) => (
        <PathBlock key={path.rank} path={path} />
      ))}

      {/* ── Directional paths ── */}
      {directionalPaths.length > 0 && (
        <>
          <div style={{
            fontSize: '0.76rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
            color: '#8a6a50',
            marginBottom: '-0.5rem',
            marginTop: '0.5rem',
            paddingTop: refinementPaths.length > 0 ? '0.5rem' : undefined,
            borderTop: refinementPaths.length > 0 ? '1px solid #e8e3d7' : undefined,
          }}>
            System direction — change system behavior
          </div>
          {directionalPaths.map((path) => (
            <PathBlock key={path.rank} path={path} isDirectional />
          ))}
        </>
      )}

      {/* When no directional split, render all paths flat (legacy behavior) */}
      {!hasDirectional && refinementPaths.length === 0 && paths.map((path) => (
        <PathBlock key={path.rank} path={path} />
      ))}
    </div>
  );
}

/** Single path block — extracted for reuse between groups. */
function PathBlock({ path, isDirectional }: { path: UpgradePath; isDirectional?: boolean }) {
  // Post-process framing: neutralize "Upgrade" labels when all cards
  // inside this path are directional or sidegrade.
  const allDir = isAllDirectionalOrSidegrade(path.options);
  const displayLabel = neutralizeLabel(path.label, allDir);
  const displayStrategy = path.strategyLabel
    ? neutralizeLabel(path.strategyLabel, allDir)
    : undefined;
  const displayRationale = softenRationale(path.rationale, allDir);

  return (
    <div
      style={{
        // Directional paths get a subtle warm-tinted left border
        borderLeft: isDirectional ? '3px solid #d4b896' : undefined,
        paddingLeft: isDirectional ? '0.75rem' : undefined,
      }}
    >
      {/* Path header — rank + strategy label + impact tag */}
      <div style={{ marginBottom: '0.45rem', display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: '1rem', color: '#2a2a2a' }}>
          Path {path.rank}: {displayStrategy ?? displayLabel}
        </span>
            {displayStrategy && displayStrategy !== displayLabel && (
              <span style={{ fontSize: '0.82rem', color: '#999', fontWeight: 400 }}>
                {displayLabel}
              </span>
            )}
            {path.impact && (
              <span
                style={{
                  fontSize: '0.73rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase' as const,
                  padding: '0.12rem 0.5rem',
                  borderRadius: '4px',
                  color: path.rank === 1 ? '#3a6a3a' : '#6a6a3a',
                  background: path.rank === 1 ? '#eaf5ea' : '#f5f5e2',
                }}
              >
                {path.impact}
              </span>
            )}
          </div>

          {/* Rationale */}
          <p style={{ margin: '0 0 0.7rem 0', fontSize: '0.96rem', lineHeight: 1.65, color: '#3a3a3a' }}>
            {renderText(displayRationale)}
          </p>

          {/* Explanation layer (Feature 9) — "Why this works" */}
          {path.explanation && path.explanation.length > 0 && (
            <div style={{ margin: '0 0 0.7rem 0', fontSize: '0.88rem', color: '#6a6a5a', lineHeight: 1.55 }}>
              <span style={{ fontWeight: 500, fontSize: '0.82rem', letterSpacing: '0.02em', color: '#888' }}>Why this works:</span>
              <ul style={{ margin: '0.2rem 0 0 1.1rem', padding: 0, listStyle: 'disc' }}>
                {path.explanation.slice(0, 2).map((line, i) => (
                  <li key={i} style={{ marginBottom: '0.1rem' }}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Restraint recommendation — "do nothing" card when counterfactual says hold */}
          {path.counterfactual?.restraintRecommended && path.counterfactual.restraintReason && (
            <div style={{
              padding: '0.75rem 0.95rem',
              border: '1px solid #dde4d8',
              borderRadius: '6px',
              background: '#f5f7f2',
              marginBottom: '0.5rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.93rem', color: '#4a6a40' }}>
                  Keep your current system
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.93rem', lineHeight: 1.6, color: '#555' }}>
                {renderText(path.counterfactual.restraintReason)}
              </p>
            </div>
          )}

          {/* Product options — 2-col grid on desktop, single col on mobile */}
          {!(path.counterfactual?.restraintRecommended) && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 380px), 1fr))',
            gap: '0.6rem',
            alignItems: 'start',
          }}>
            {path.options.map((opt) => {
              const isDir = opt.recommendationType === 'directional' || opt.recommendationType === 'sidegrade';
              return (
              <div
                key={opt.rank}
                className="audioxx-upgrade-card"
                style={{
                  padding: '0.75rem 0.95rem',
                  border: isDir ? '1px solid #ddd0b8' : '1px solid #dcd7cf',
                  borderLeft: isDir ? '3px solid #c9a96e' : '1px solid #dcd7cf',
                  borderRadius: '8px',
                  background: isDir ? '#fdfaf5' : '#FFFEFA',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.05)';
                }}
              >
                {/* Product image — always show when available (card context, no dedup) */}
                {opt.imageUrl && (
                  <div style={{
                    marginBottom: '0.5rem',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.35rem 0',
                    maxHeight: '200px',
                    minHeight: '100px',
                  }}>
                    <img
                      src={opt.imageUrl}
                      alt={`${opt.brand ?? ''} ${opt.name}`.trim()}
                      referrerPolicy="no-referrer"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                      onError={(e) => {
                        (e.currentTarget.parentElement as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* Option header — name row + meta row */}
                <div style={{ marginBottom: '0.35rem' }}>
                  {/* Primary line: product name */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontWeight: 500, color: '#b0a890', fontSize: '0.8rem', flexShrink: 0 }}>
                      {opt.rank}.
                    </span>
                    <span
                      className="audioxx-product-name"
                      style={{
                        fontWeight: 700,
                        fontSize: '1.1rem',
                        color: '#1F1D1B',
                        letterSpacing: '-0.01em',
                        lineHeight: 1.3,
                      }}
                    >
                      {opt.brand ? `${opt.brand} ` : ''}{opt.name}
                    </span>
                  </div>
                  {/* Secondary line: badge + price */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {/* Recommendation type badge — only shown for non-upgrade types */}
                    {opt.recommendationType === 'directional' && (
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        color: '#8a6a50',
                        background: '#faf3eb',
                        border: '1px solid #e8dcc8',
                        borderRadius: '3px',
                        padding: '0.1rem 0.4rem',
                        letterSpacing: '0.03em',
                        textTransform: 'uppercase',
                      }}>
                        Directional change
                      </span>
                    )}
                    {opt.recommendationType === 'sidegrade' && (
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        color: '#6a7a8a',
                        background: '#f0f3f6',
                        border: '1px solid #d8dfe8',
                        borderRadius: '3px',
                        padding: '0.1rem 0.4rem',
                        letterSpacing: '0.03em',
                        textTransform: 'uppercase',
                      }}>
                        Alternative voicing
                      </span>
                    )}
                    {opt.price != null && opt.price > 0 && (
                      <span style={{ color: '#555', fontSize: '0.88rem', fontWeight: 600 }}>
                        {formatPrice(opt.price, opt.priceCurrency)}
                      </span>
                    )}
                    {opt.priceNote && (
                      <span style={{ color: '#888', fontSize: '0.78rem' }}>
                        {opt.priceNote}
                      </span>
                    )}
                    {opt.brand && (
                      <Link
                        href={`/brand/${toSlug(opt.brand)}`}
                        style={{
                          fontSize: '0.73rem',
                          color: '#b0a890',
                          textDecoration: 'none',
                          marginLeft: 'auto',
                          flexShrink: 0,
                        }}
                        title={`How ${opt.brand} tends to sound`}
                      >
                        About {opt.brand} →
                      </Link>
                    )}
                  </div>
                </div>

                {/* Legacy note — successor context for discontinued/vintage models */}
                {opt.legacyNote && (
                  <div style={{
                    fontSize: '0.78rem',
                    color: '#b08030',
                    fontStyle: 'italic',
                    marginBottom: '0.3rem',
                    lineHeight: 1.5,
                  }}>
                    {opt.legacyNote}
                    {opt.legacyUsedNote && (
                      <span style={{ color: '#999', fontStyle: 'normal' }}>
                        {' · '}{opt.legacyUsedNote}
                      </span>
                    )}
                  </div>
                )}

                {/* Topology line — concise identity under the product name */}
                {opt.topologyLine && (
                  <div style={{
                    fontSize: '0.82rem',
                    fontWeight: 500,
                    color: '#6a6560',
                    marginBottom: '0.4rem',
                    letterSpacing: '0.01em',
                  }}>
                    {opt.topologyLine}
                  </div>
                )}

                {/* ── Divider between header zone and body ── */}
                <div style={{
                  borderTop: '1px solid #f0ede6',
                  marginBottom: '0.55rem',
                  marginTop: '0.15rem',
                }} />

                {/* Directional change explanation — explicit gains/losses block */}
                {(opt.recommendationType === 'directional' || opt.recommendationType === 'sidegrade') &&
                  (opt.directionalGains?.length || opt.directionalLosses?.length) && (
                  <div style={{
                    marginBottom: '0.55rem',
                    padding: '0.6rem 0.75rem',
                    background: opt.recommendationType === 'directional' ? '#fdfaf5' : '#f5f7fa',
                    border: `1px solid ${opt.recommendationType === 'directional' ? '#efe5d5' : '#e0e5ec'}`,
                    borderRadius: '5px',
                    fontSize: '0.88rem',
                    lineHeight: 1.6,
                  }}>
                    <div style={{
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: '#6a6560',
                      marginBottom: '0.3rem',
                      fontStyle: 'italic',
                    }}>
                      {opt.recommendationType === 'directional'
                        ? 'This is not a strict upgrade. It changes the system\u2019s character:'
                        : 'This is a different voicing at a similar level:'}
                    </div>
                    {opt.directionalGains && opt.directionalGains.length > 0 && (
                      <div style={{ marginBottom: '0.2rem' }}>
                        <span style={{ fontWeight: 600, color: '#5a7050' }}>What improves: </span>
                        {opt.directionalGains.join(', ')}
                      </div>
                    )}
                    {opt.directionalLosses && opt.directionalLosses.length > 0 && (
                      <div>
                        <span style={{ fontWeight: 600, color: '#8a6a50' }}>What you give up: </span>
                        {opt.directionalLosses.join(', ')}
                      </div>
                    )}
                  </div>
                )}

                {/* Summary */}
                <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.9rem', lineHeight: 1.6, color: '#444' }}>
                  {renderText(opt.summary)}
                </p>

                {/* What you'll hear — sensory delta bullets */}
                {opt.whatYoullHear && opt.whatYoullHear.length > 0 && (
                  <div style={{ marginBottom: '0.45rem' }}>
                    <div style={{
                      fontSize: '0.7rem', fontWeight: 700, color: '#888',
                      textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.15rem',
                    }}>
                      What you&apos;ll hear
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.55 }}>
                      {opt.whatYoullHear.map((h, j) => (
                        <li key={j} style={{ fontSize: '0.84rem', color: '#4a6a50', marginBottom: '0.08rem', fontWeight: 400 }}>
                          {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Technical rationale — design → audible outcome */}
                {opt.technicalRationale && opt.technicalRationale.length > 0 && (
                  <div style={{ marginBottom: '0.45rem' }}>
                    <div style={{
                      fontSize: '0.7rem', fontWeight: 700, color: '#888',
                      textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.15rem',
                    }}>
                      Technical rationale
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.55 }}>
                      {opt.technicalRationale.map((t, j) => (
                        <li key={j} style={{ fontSize: '0.84rem', color: '#555', marginBottom: '0.08rem', fontWeight: 400 }}>
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Outcome — pros & cons under a labeled group */}
                {(opt.pros.length > 0 || (opt.cons && opt.cons.length > 0)) && (
                  <div style={{ marginBottom: '0.4rem' }}>
                    <div style={{
                      fontSize: '0.7rem', fontWeight: 700, color: '#888',
                      textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem',
                    }}>
                      What changes
                    </div>
                    {opt.pros.length > 0 && (
                      <ul style={{ margin: '0 0 0.15rem 0', paddingLeft: '1.1rem', lineHeight: 1.55 }}>
                        {opt.pros.map((p, j) => (
                          <li key={j} style={{ fontSize: '0.85rem', color: '#4a6a45', marginBottom: '0.08rem' }}>
                            {renderText(p)}
                          </li>
                        ))}
                      </ul>
                    )}
                    {opt.cons && opt.cons.length > 0 && (
                      <ul style={{ margin: '0 0 0.15rem 0', paddingLeft: '1.1rem', lineHeight: 1.55 }}>
                        {opt.cons.map((c, j) => (
                          <li key={j} style={{ fontSize: '0.85rem', color: '#7a5a40', marginBottom: '0.08rem' }}>
                            {renderText(c)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* System delta — why this fits / improvements / trade-offs */}
                {opt.systemDelta && (
                  <div style={{
                    marginTop: '0.5rem',
                    padding: '0.55rem 0.75rem',
                    background: '#f8f6f0',
                    borderRadius: '5px',
                    fontSize: '0.88rem',
                    lineHeight: 1.6,
                  }}>
                    {opt.systemDelta.whyFitsSystem && (
                      <p style={{ margin: '0 0 0.3rem 0', color: '#444' }}>
                        {renderText(opt.systemDelta.whyFitsSystem)}
                      </p>
                    )}
                    {opt.systemDelta.likelyImprovements && opt.systemDelta.likelyImprovements.length > 0 && (
                      <div style={{ margin: '0 0 0.25rem 0', color: '#555' }}>
                        <span style={{ fontWeight: 600, color: '#4a6a45' }}>Likely improvements: </span>
                        {opt.systemDelta.likelyImprovements.join(' \u00b7 ')}
                      </div>
                    )}
                    {opt.systemDelta.tradeOffs && opt.systemDelta.tradeOffs.length > 0 && (
                      <div style={{ color: '#777' }}>
                        <span style={{ fontWeight: 600 }}>Trade-offs: </span>
                        {opt.systemDelta.tradeOffs.join(' \u00b7 ')}
                      </div>
                    )}
                  </div>
                )}

                {/* Verdict */}
                {opt.verdict && (
                  <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.9rem', fontWeight: 600, color: '#333' }}>
                    {renderText(opt.verdict)}
                  </p>
                )}

                {/* Positioning hint — Best for / Less ideal if */}
                {(opt.bestFor || opt.lessIdealIf) && (
                  <div style={{
                    marginTop: '0.5rem',
                    fontSize: '0.85rem',
                    lineHeight: 1.55,
                    color: '#555',
                  }}>
                    {opt.bestFor && (
                      <div><span style={{ fontWeight: 600, color: '#5a7050' }}>Best for:</span> {opt.bestFor}</div>
                    )}
                    {opt.lessIdealIf && (
                      <div><span style={{ fontWeight: 600, color: '#8a6a50' }}>Less ideal if:</span> {opt.lessIdealIf}</div>
                    )}
                  </div>
                )}

                {/* Manufacturer context — collapsible */}
                <MakerContextBlock brand={opt.brand} context={opt.makerContext} />

                {/* Further reading ��� curated review links */}
                {opt.sources && opt.sources.length > 0 && (
                  <div style={{ marginTop: '0.55rem' }}>
                    <div style={{
                      fontSize: '0.72rem', fontWeight: 700, color: '#888',
                      textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem',
                    }}>
                      Further reading
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                      {opt.sources.slice(0, 2).map((s) => (
                        <li key={s.id} style={{
                          fontSize: '0.82rem',
                          lineHeight: 1.55,
                          color: '#777',
                          marginBottom: '0.15rem',
                        }}>
                          <span style={{ color: '#555', fontWeight: 500 }}>
                            {s.reviewer.publication}
                          </span>
                          {' '}({s.year}){' '}
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#8a7a55', textDecoration: 'none' }}
                          >
                            {s.medium === 'video' ? 'watch' : 'read'}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Purchase links — final block in card hierarchy */}
                <UpgradePurchaseLinks opt={opt} />
              </div>
              );
            })}
          </div>
          )}
        </div>
  );
}

/** Purchase links for upgrade path cards — action-oriented, structured.
 *
 * Uses the same canonical buildProductLinks() builder as AdvisoryProductCard,
 * ensuring both card types resolve links identically (priority, dedup, Amazon
 * ASIN gating). Maps UpgradePathOption fields to ProductLinkInput.
 */
function UpgradePurchaseLinks({ opt }: { opt: UpgradePathOption }) {
  const { newLinks, usedLinks } = buildProductLinks({
    name: opt.name,
    brand: opt.brand,
    retailerLinks: opt.retailerLinks?.map(l => ({ label: l.label, url: l.url })),
    manufacturerUrl: opt.manufacturerUrl,
    availability: opt.availability,
    typicalMarket: opt.typicalMarket,
  });

  const linkStyle: React.CSSProperties = {
    color: '#999',
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
    textDecorationColor: '#ddd',
    fontSize: '0.82rem',
    transition: 'color 0.15s',
  };
  const sepStyle: React.CSSProperties = { margin: '0 0.45rem', color: '#ddd' };
  const labelStyle: React.CSSProperties = {
    fontSize: '0.72rem', fontWeight: 600, color: '#888',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.15rem',
  };

  return (
    <div style={{
      marginTop: '0.4rem',
      paddingTop: '0.35rem',
      borderTop: '1px solid #eae8e4',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.4rem',
    }}>
      {/* Buy new — from canonical link builder */}
      {newLinks.length > 0 && (
        <div>
          <div style={labelStyle}>Buy new</div>
          <span style={{ lineHeight: 1.9 }}>
            {newLinks.map((link, i) => (
              <span key={i}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkStyle}
                >
                  Buy new &rarr; {link.label}
                </a>
                {i < newLinks.length - 1 && <span style={sepStyle}>&middot;</span>}
              </span>
            ))}
          </span>
        </div>
      )}

      {/* Buy used — from canonical link builder */}
      <div>
        <div style={labelStyle}>Buy used</div>
        <span style={{ lineHeight: 1.9 }}>
          {usedLinks.map((link, i) => {
            const isHiFiShark = link.label.toLowerCase().includes('hifi shark') || link.label.toLowerCase().includes('hifishark');
            const prefix = isHiFiShark ? 'Browse used' : 'Search used';
            return (
              <span key={i}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkStyle}
                >
                  {prefix} &rarr; {link.label}
                </a>
                {i < usedLinks.length - 1 && <span style={sepStyle}>&middot;</span>}
              </span>
            );
          })}
        </span>
        {/* Typical used price — only from catalog data, never estimated */}
        {opt.usedPriceRange && (
          <div style={{ fontSize: '0.78rem', color: '#aaa', marginTop: '0.15rem' }}>
            Typical used: ${opt.usedPriceRange.low.toLocaleString()}&ndash;${opt.usedPriceRange.high.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

/** Collapsible manufacturer context block — collapsed by default. */
function MakerContextBlock({ brand, context }: { brand?: string; context?: string[] }) {
  const [open, setOpen] = useState(false);
  if (!brand || !context || context.length === 0) return null;

  return (
    <div style={{ marginTop: '0.55rem' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: '#999',
          fontFamily: 'inherit',
          letterSpacing: '0.02em',
        }}
      >
        {open ? '\u25BE' : '\u25B8'} About {brand}
      </button>
      {open && (
        <ul style={{
          margin: '0.25rem 0 0 0',
          paddingLeft: '1.1rem',
          lineHeight: 1.6,
        }}>
          {context.map((line, i) => (
            <li key={i} style={{ fontSize: '0.85rem', color: '#777', marginBottom: '0.1rem' }}>
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
