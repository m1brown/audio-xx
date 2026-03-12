/**
 * Main advisory message renderer.
 *
 * Delegates to section sub-components. Only populated sections render.
 * Section order follows the plan:
 *   1. Comparison summary
 *   2. Listener priorities (tan box)
 *   3. System context
 *   4. Alignment rationale
 *   5. Core advisory body (no labels — prose center)
 *   6. Recommended direction
 *   7. Why this fits
 *   8. Trade-offs
 *   9. Options (product cards)
 *  10. Bottom line
 *  11. Follow-up (blue box)
 *  12. Learn more (links)
 *  13. Sources
 *  14. Diagnostics (collapsible)
 */

import type { AdvisoryResponse } from '../../lib/advisory-response';
import AdvisorySection from './AdvisorySection';
import AdvisoryProse from './AdvisoryProse';
import AdvisoryOptions from './AdvisoryOptions';
import AdvisoryLinks from './AdvisoryLinks';
import AdvisorySources from './AdvisorySources';
import AdvisoryDiagnostics from './AdvisoryDiagnostics';

interface AdvisoryMessageProps {
  advisory: AdvisoryResponse;
}

/** Inline bullet list — reused for priorities, whyThisFits, tradeOffs. */
function BulletList({ items, color }: { items: string[]; color?: string }) {
  return (
    <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.7, color: color ?? '#333' }}>
      {items.map((item, i) => (
        <li key={i} style={{ marginBottom: '0.2rem', fontSize: '0.95rem' }}>{item}</li>
      ))}
    </ul>
  );
}

export default function AdvisoryMessage({ advisory }: AdvisoryMessageProps) {
  const a = advisory;

  const hasListenerPriorities = (a.listenerPriorities && a.listenerPriorities.length > 0)
    || (a.listenerAvoids && a.listenerAvoids.length > 0);

  const hasProvisionalCaveats = a.provisional
    && a.statedGaps
    && a.statedGaps.length > 0;

  return (
    <div style={{ lineHeight: 1.7, color: '#333' }}>
      {/* ── 1. Comparison summary ────────────────────── */}
      {a.comparisonSummary && (
        <p
          style={{
            margin: '0 0 1.1rem 0',
            fontWeight: 600,
            fontSize: '1.02rem',
            color: '#222',
            lineHeight: 1.65,
          }}
        >
          {a.comparisonSummary}
        </p>
      )}

      {/* ── 2. Listener priorities ────────────────────── */}
      {hasListenerPriorities && (
        <div
          style={{
            borderLeft: '3px solid #a89870',
            paddingLeft: '1rem',
            marginBottom: '1.25rem',
            background: '#faf8f4',
            padding: '0.75rem 1rem',
          }}
        >
          {a.listenerPriorities && a.listenerPriorities.length > 0 && (
            <div style={{ marginBottom: a.listenerAvoids?.length ? '0.6rem' : 0 }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase' as const,
                  color: '#a89870',
                  marginBottom: '0.3rem',
                }}
              >
                What you seem to value
              </div>
              <BulletList items={a.listenerPriorities} />
            </div>
          )}
          {a.listenerAvoids && a.listenerAvoids.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase' as const,
                  color: '#a89870',
                  marginBottom: '0.3rem',
                }}
              >
                What you tend to avoid
              </div>
              <BulletList items={a.listenerAvoids} />
            </div>
          )}
        </div>
      )}

      {/* ── 3. System context ────────────────────────── */}
      {a.systemContext && (
        <AdvisorySection label="Your system">
          <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.7 }}>
            {a.systemContext}
          </p>
        </AdvisorySection>
      )}

      {/* ── 3b. System tendencies ────────────────────── */}
      {a.systemTendencies && !a.systemContext && (
        <AdvisorySection label="System tendencies">
          <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.7 }}>
            {a.systemTendencies}
          </p>
        </AdvisorySection>
      )}

      {/* ── 3c. What is working well (upgrade) ───────── */}
      {a.strengths && a.strengths.length > 0 && (
        <AdvisorySection label="What is working well">
          <BulletList items={a.strengths} />
        </AdvisorySection>
      )}

      {/* ── 3d. Where limitations may appear (upgrade) ── */}
      {a.limitations && a.limitations.length > 0 && (
        <AdvisorySection label="Where limitations may appear">
          <BulletList items={a.limitations} color="#666" />
        </AdvisorySection>
      )}

      {/* ── 5. Core advisory body (no labels) ────────── */}
      {/* For upgrade analyses, tendencies carries "What the proposed change actually does" */}
      {(a.improvements && a.improvements.length > 0) ? (
        /* Upgrade path: render tendencies under a labelled section */
        <>
          {a.tendencies && (
            <AdvisorySection label="What the proposed change actually does">
              <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.7 }}>
                {a.tendencies}
              </p>
            </AdvisorySection>
          )}
        </>
      ) : (
        /* Standard path: unlabelled prose body */
        <AdvisoryProse
          philosophy={a.philosophy}
          tendencies={a.tendencies}
          systemFit={a.systemFit}
        />
      )}

      {/* ── 5b. What improves (upgrade) ────────────────── */}
      {a.improvements && a.improvements.length > 0 && (
        <AdvisorySection label="What improves">
          <BulletList items={a.improvements} />
        </AdvisorySection>
      )}

      {/* ── 5c. What probably stays the same (upgrade) ─── */}
      {a.unchanged && a.unchanged.length > 0 && (
        <AdvisorySection label="What probably stays the same">
          <BulletList items={a.unchanged} color="#666" />
        </AdvisorySection>
      )}

      {/* ── 6. Recommended direction ─────────────────── */}
      {a.recommendedDirection && (
        <AdvisorySection label="What this means for component choice">
          <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.7 }}>
            {a.recommendedDirection}
          </p>
        </AdvisorySection>
      )}

      {/* ── 7. Why this fits ─────────────────────────── */}
      {a.whyThisFits && a.whyThisFits.length > 0 && (
        <AdvisorySection label="Why this fits">
          <BulletList items={a.whyThisFits} />
        </AdvisorySection>
      )}

      {/* ── 8. Trade-offs ────────────────────────────── */}
      {a.tradeOffs && a.tradeOffs.length > 0 && (
        <AdvisorySection label="Trade-offs">
          <BulletList items={a.tradeOffs} color="#666" />
        </AdvisorySection>
      )}

      {/* ── 8b. When this upgrade makes sense ─────────── */}
      {a.whenToAct && (
        <AdvisorySection label="When this upgrade makes sense">
          <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.7 }}>
            {a.whenToAct}
          </p>
        </AdvisorySection>
      )}

      {/* ── 8c. When it may not be the best next step ─── */}
      {a.whenToWait && (
        <AdvisorySection label="When it may not be the best next step">
          <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.7, color: '#666' }}>
            {a.whenToWait}
          </p>
        </AdvisorySection>
      )}

      {/* ── 8d. System balance summary ────────────────── */}
      {a.systemBalance && a.systemBalance.length > 0 && (
        <AdvisorySection label="System balance summary">
          <div style={{ display: 'grid', gap: '0.3rem' }}>
            {a.systemBalance.map((entry, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '0.5rem',
                  fontSize: '0.93rem',
                  lineHeight: 1.6,
                }}
              >
                <span style={{ fontWeight: 500, minWidth: '10rem', color: '#333' }}>
                  {entry.label}
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    color: entry.level === 'Strong' ? '#3a7a3a'
                      : entry.level === 'Good' ? '#5a7a3a'
                      : entry.level === 'Moderate' ? '#8a7a3a'
                      : entry.level === 'Limited' ? '#a06030'
                      : '#888',
                  }}
                >
                  {entry.level}
                </span>
                {entry.note && (
                  <span style={{ fontSize: '0.85rem', color: '#888', fontStyle: 'italic' }}>
                    — {entry.note}
                  </span>
                )}
              </div>
            ))}
          </div>
        </AdvisorySection>
      )}

      {/* ── 8e. Where upgrades would have the most impact ─ */}
      {a.upgradeImpactAreas && a.upgradeImpactAreas.length > 0 && (
        <AdvisorySection label="Where upgrades would have the most impact">
          <BulletList items={a.upgradeImpactAreas} />
        </AdvisorySection>
      )}

      {/* ── 8f. Expected magnitude of change ──────────── */}
      {a.changeMagnitude && (
        <AdvisorySection label="Expected magnitude of change">
          <div style={{ fontSize: '0.95rem', lineHeight: 1.7 }}>
            <span
              style={{
                display: 'inline-block',
                fontWeight: 700,
                fontSize: '0.8rem',
                letterSpacing: '0.04em',
                textTransform: 'uppercase' as const,
                padding: '0.15rem 0.5rem',
                borderRadius: '3px',
                marginBottom: '0.4rem',
                color: a.changeMagnitude.tier === 'major' ? '#2a6a2a'
                  : a.changeMagnitude.tier === 'moderate' ? '#6a6a2a'
                  : '#888',
                background: a.changeMagnitude.tier === 'major' ? '#e8f5e8'
                  : a.changeMagnitude.tier === 'moderate' ? '#f5f5e0'
                  : '#f0f0f0',
              }}
            >
              {a.changeMagnitude.label}
            </span>
            <p style={{ margin: '0.4rem 0 0.2rem 0', color: '#333' }}>
              {a.changeMagnitude.changesmost}
            </p>
            <p style={{ margin: 0, color: '#666' }}>
              {a.changeMagnitude.remainsSimilar}
            </p>
          </div>
        </AdvisorySection>
      )}

      {/* ── 9. Options ───────────────────────────────── */}
      {a.options && a.options.length > 0 && (
        <AdvisorySection label="Worth considering">
          <AdvisoryOptions options={a.options} />
        </AdvisorySection>
      )}

      {/* ── 9b. Provisional caveats ──────────────────── */}
      {hasProvisionalCaveats && (
        <div
          style={{
            fontSize: '0.85rem',
            color: '#999',
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

      {/* ── 10. Bottom line ──────────────────────────── */}
      {a.bottomLine && (
        <p
          style={{
            margin: '0 0 1.1rem 0',
            fontWeight: 500,
            fontSize: '1.02rem',
            color: '#222',
            lineHeight: 1.65,
          }}
        >
          {a.bottomLine}
        </p>
      )}

      {/* ── 11. Follow-up (blue box) ─────────────────── */}
      {a.followUp && (
        <div
          style={{
            borderLeft: '3px solid #5a8a9a',
            paddingLeft: '1rem',
            padding: '0.6rem 1rem',
            marginBottom: '1.25rem',
            background: '#f4f8fa',
            fontSize: '0.95rem',
            color: '#444',
            lineHeight: 1.65,
          }}
        >
          {a.followUp}
        </div>
      )}

      {/* ── 12. Learn more (links) ───────────────────── */}
      {a.links && a.links.length > 0 && (
        <AdvisorySection label="Learn more">
          <AdvisoryLinks links={a.links} />
        </AdvisorySection>
      )}

      {/* ── 13. Sources ──────────────────────────────── */}
      {a.sourceReferences && a.sourceReferences.length > 0 && (
        <AdvisorySection label="Sources">
          <AdvisorySources sources={a.sourceReferences} />
        </AdvisorySection>
      )}

      {/* ── 14. Diagnostics (collapsible) ────────────── */}
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
