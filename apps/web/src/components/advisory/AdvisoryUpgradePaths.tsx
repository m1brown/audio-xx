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
import type { UpgradePath, UpgradePathOption } from '../../lib/advisory-response';
import { buildProductLinks } from '../../lib/product-links';
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

interface Props {
  paths: UpgradePath[];
}

export default function AdvisoryUpgradePaths({ paths }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {paths.map((path) => {
        // Post-process framing: neutralize "Upgrade" labels when all cards
        // inside this path are directional or sidegrade.
        const allDir = isAllDirectionalOrSidegrade(path.options);
        const displayLabel = neutralizeLabel(path.label, allDir);
        const displayStrategy = path.strategyLabel
          ? neutralizeLabel(path.strategyLabel, allDir)
          : undefined;
        const displayRationale = softenRationale(path.rationale, allDir);

        return (
        <div key={path.rank}>
          {/* Path header — rank + strategy label + impact tag */}
          <div style={{ marginBottom: '0.45rem', display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: '0.98rem', color: '#333' }}>
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
          <p style={{ margin: '0 0 0.7rem 0', fontSize: '0.95rem', lineHeight: 1.65, color: '#444' }}>
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

          {/* Product options — hidden when restraint is the recommended outcome */}
          {!(path.counterfactual?.restraintRecommended) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingLeft: '0.25rem' }}>
            {path.options.map((opt) => (
              <div
                key={opt.rank}
                style={{
                  padding: '0.75rem 0.95rem',
                  border: '1px solid #eae8e4',
                  borderRadius: '6px',
                  background: '#fff',
                }}
              >
                {/* Product image — always show when available (card context, no dedup) */}
                {opt.imageUrl && (
                  <div style={{
                    marginBottom: '0.75rem',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    background: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.75rem',
                    aspectRatio: '4 / 3',
                  }}>
                    <img
                      src={opt.imageUrl}
                      alt={`${opt.brand ?? ''} ${opt.name}`.trim()}
                      referrerPolicy="no-referrer"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                      }}
                      onError={(e) => {
                        (e.currentTarget.parentElement as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* Option header — rank + name + recommendation type badge + price */}
                <div style={{ marginBottom: '0.15rem' }}>
                  <span style={{ fontWeight: 500, color: '#999', fontSize: '0.85rem', marginRight: '0.4rem' }}>
                    {opt.rank}.
                  </span>
                  <span
                    className="audioxx-product-name"
                    style={{
                      fontWeight: 700,
                      color: '#2a2a2a',
                    }}
                  >
                    {opt.brand ? `${opt.brand} ` : ''}{opt.name}
                  </span>
                  {/* Recommendation type badge — only shown for non-upgrade types */}
                  {opt.recommendationType === 'directional' && (
                    <span style={{
                      marginLeft: '0.45rem',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      color: '#8a6a50',
                      background: '#faf3eb',
                      border: '1px solid #e8dcc8',
                      borderRadius: '3px',
                      padding: '0.1rem 0.4rem',
                      letterSpacing: '0.03em',
                      textTransform: 'uppercase',
                      verticalAlign: 'middle',
                    }}>
                      Directional change
                    </span>
                  )}
                  {opt.recommendationType === 'sidegrade' && (
                    <span style={{
                      marginLeft: '0.45rem',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      color: '#6a7a8a',
                      background: '#f0f3f6',
                      border: '1px solid #d8dfe8',
                      borderRadius: '3px',
                      padding: '0.1rem 0.4rem',
                      letterSpacing: '0.03em',
                      textTransform: 'uppercase',
                      verticalAlign: 'middle',
                    }}>
                      Alternative voicing
                    </span>
                  )}
                  {opt.price != null && opt.price > 0 && (
                    <span style={{ color: '#777', marginLeft: '0.5rem', fontSize: '0.92rem' }}>
                      {formatPrice(opt.price, opt.priceCurrency)}
                    </span>
                  )}
                  {opt.priceNote && (
                    <span style={{ color: '#999', marginLeft: '0.35rem', fontSize: '0.85rem' }}>
                      {opt.priceNote}
                    </span>
                  )}
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
                    color: '#888',
                    marginBottom: '0.4rem',
                    letterSpacing: '0.01em',
                  }}>
                    {opt.topologyLine}
                  </div>
                )}

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
                      color: '#888',
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
                <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.93rem', lineHeight: 1.6, color: '#444' }}>
                  {renderText(opt.summary)}
                </p>

                {/* What you'll hear — sensory delta bullets */}
                {opt.whatYoullHear && opt.whatYoullHear.length > 0 && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <div style={{
                      fontSize: '0.72rem', fontWeight: 600, color: '#888',
                      textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem',
                    }}>
                      What you&apos;ll hear
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.6 }}>
                      {opt.whatYoullHear.map((h, j) => (
                        <li key={j} style={{ fontSize: '0.88rem', color: '#4a6a50', marginBottom: '0.1rem' }}>
                          {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Technical rationale — design → audible outcome */}
                {opt.technicalRationale && opt.technicalRationale.length > 0 && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <div style={{
                      fontSize: '0.72rem', fontWeight: 600, color: '#888',
                      textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem',
                    }}>
                      Technical rationale
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.6 }}>
                      {opt.technicalRationale.map((t, j) => (
                        <li key={j} style={{ fontSize: '0.88rem', color: '#666', marginBottom: '0.1rem' }}>
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Pros */}
                {opt.pros.length > 0 && (
                  <ul style={{ margin: '0 0 0.3rem 0', paddingLeft: '1.1rem', lineHeight: 1.6 }}>
                    {opt.pros.map((p, j) => (
                      <li key={j} style={{ fontSize: '0.9rem', color: '#5a7050', marginBottom: '0.1rem' }}>
                        {renderText(p)}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Cons */}
                {opt.cons && opt.cons.length > 0 && (
                  <ul style={{ margin: '0 0 0.3rem 0', paddingLeft: '1.1rem', lineHeight: 1.6 }}>
                    {opt.cons.map((c, j) => (
                      <li key={j} style={{ fontSize: '0.9rem', color: '#8a6a50', marginBottom: '0.1rem' }}>
                        {renderText(c)}
                      </li>
                    ))}
                  </ul>
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
                      <p style={{ margin: '0 0 0.3rem 0', color: '#555' }}>
                        {renderText(opt.systemDelta.whyFitsSystem)}
                      </p>
                    )}
                    {opt.systemDelta.likelyImprovements && opt.systemDelta.likelyImprovements.length > 0 && (
                      <div style={{ margin: '0 0 0.25rem 0', color: '#666' }}>
                        <span style={{ fontWeight: 500, color: '#5a7050' }}>Likely improvements: </span>
                        {opt.systemDelta.likelyImprovements.join(' \u00b7 ')}
                      </div>
                    )}
                    {opt.systemDelta.tradeOffs && opt.systemDelta.tradeOffs.length > 0 && (
                      <div style={{ color: '#999' }}>
                        <span style={{ fontWeight: 500 }}>Trade-offs: </span>
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
                    color: '#777',
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
                      fontSize: '0.72rem', fontWeight: 600, color: '#888',
                      textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem',
                    }}>
                      Further reading
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                      {opt.sources.slice(0, 2).map((s) => (
                        <li key={s.id} style={{
                          fontSize: '0.82rem',
                          lineHeight: 1.55,
                          color: '#999',
                          marginBottom: '0.15rem',
                        }}>
                          <span style={{ color: '#777', fontWeight: 500 }}>
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
            ))}
          </div>
          )}
        </div>
        );
      })}
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
      marginTop: '0.65rem',
      paddingTop: '0.55rem',
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
