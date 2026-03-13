/**
 * Main advisory message renderer.
 *
 * Two rendering modes:
 *
 *   A. Memo format — when structured assessment fields are present
 *      (componentAssessments, upgradePaths, etc.). Uses numbered headings
 *      matching the reference advisory memo style.
 *
 *   B. Standard format — existing conditional section rendering with
 *      uppercase labels. Used for consultations, shopping, diagnosis,
 *      and any response that doesn't populate memo-specific fields.
 *
 * Only populated sections render in both modes.
 */

import type { AdvisoryResponse } from '../../lib/advisory-response';
import AdvisorySection from './AdvisorySection';
import AdvisoryProse from './AdvisoryProse';
import AdvisoryOptions from './AdvisoryOptions';
import AdvisoryLinks from './AdvisoryLinks';
import AdvisorySources from './AdvisorySources';
import AdvisoryDiagnostics from './AdvisoryDiagnostics';
import AdvisoryComponentAssessments from './AdvisoryComponentAssessments';
import AdvisoryUpgradePaths from './AdvisoryUpgradePaths';
import { renderText } from './render-text';

interface AdvisoryMessageProps {
  advisory: AdvisoryResponse;
}

/** Inline bullet list — reused across both modes. */
function BulletList({ items, color }: { items: string[]; color?: string }) {
  return (
    <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.7, color: color ?? '#333' }}>
      {items.map((item, i) => (
        <li key={i} style={{ marginBottom: '0.2rem', fontSize: '0.95rem' }}>{renderText(item)}</li>
      ))}
    </ul>
  );
}

/** Detect whether the response has memo-format structured fields. */
function isMemoFormat(a: AdvisoryResponse): boolean {
  return !!(
    (a.componentAssessments && a.componentAssessments.length > 0)
    || (a.upgradePaths && a.upgradePaths.length > 0)
  );
}

/** Horizontal rule — matches the reference PDF section dividers. */
function SectionDivider() {
  return <hr style={{ border: 'none', borderTop: '1px solid #ddd', margin: '1.5rem 0' }} />;
}

// ── Memo Format Renderer ──────────────────────────────
//
// Matches the reference advisory PDF structure:
//   Intro paragraph → Chain display → 7 numbered sections → follow-up.
// Only populated sections render. Section numbers are sequential.

function MemoFormat({ advisory: a }: AdvisoryMessageProps) {
  let sectionNum = 0;
  const next = () => ++sectionNum;

  return (
    <div style={{ lineHeight: 1.7, color: '#333' }}>
      {/* ── Intro paragraph ──────────────────────── */}
      {a.introSummary && (
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.98rem', lineHeight: 1.7 }}>
            {renderText(a.introSummary)}
          </p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.95rem', color: '#555' }}>
            Below is a structured assessment.
          </p>
        </div>
      )}

      <SectionDivider />

      {/* ── 1. System Character ──────────────────── */}
      <AdvisorySection number={next()} label="System Character">
        {/* Chain display — full chain + major signal path */}
        {a.systemChain && a.systemChain.roles.length > 0 && (
          <div style={{ marginBottom: '0.8rem' }}>
            {/* Full chain as entered (includes cables, accessories) */}
            {a.systemChain.fullChain && a.systemChain.fullChain.length > 0 && (
              <>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#222', marginBottom: '0.25rem' }}>
                  Full chain
                </div>
                <div style={{ fontSize: '0.95rem', color: '#222', marginBottom: '0.5rem' }}>
                  {a.systemChain.fullChain.join(' → ')}
                </div>
              </>
            )}
            {/* Major signal path (major components only) */}
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#222', marginBottom: '0.25rem' }}>
              {a.systemChain.fullChain ? 'Major signal path' : 'Current chain'}
            </div>
            <div style={{ fontSize: '0.95rem', color: '#444' }}>
              {a.systemChain.roles.join(' → ')}
            </div>
            <div style={{ fontSize: '0.95rem', color: '#222' }}>
              {a.systemChain.names.join(' → ')}
            </div>
          </div>
        )}

        {/* System character prose */}
        {a.systemContext && (
          <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.95rem', lineHeight: 1.7 }}>
            {renderText(a.systemContext)}
          </p>
        )}
        {a.systemInteraction && (
          <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.95rem', lineHeight: 1.7 }}>
            {renderText(a.systemInteraction)}
          </p>
        )}

        {/* What this combination does well */}
        {a.assessmentStrengths && a.assessmentStrengths.length > 0 && (
          <div style={{ marginTop: '0.5rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#222', marginBottom: '0.3rem' }}>
              What this combination does well
            </div>
            <BulletList items={a.assessmentStrengths} />
          </div>
        )}

        {/* Stacked trait insight */}
        {a.stackedTraitInsights && a.stackedTraitInsights.length > 0 && (
          <div style={{ marginTop: '0.6rem' }}>
            {a.stackedTraitInsights.map((insight, i) => (
              <p key={i} style={{ margin: '0 0 0.4rem 0', fontSize: '0.95rem', lineHeight: 1.7, color: '#555' }}>
                {renderText(insight.explanation)}
              </p>
            ))}
          </div>
        )}
      </AdvisorySection>

      <SectionDivider />

      {/* ── 2. Weak Points in the System ─────────── */}
      {a.assessmentLimitations && a.assessmentLimitations.length > 0 && (
        <>
          <AdvisorySection number={next()} label="Weak Points in the System">
            {a.primaryConstraint && (
              <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.95rem', lineHeight: 1.7 }}>
                {renderText(a.primaryConstraint.explanation)}
              </p>
            )}
            {a.assessmentLimitations.map((item, i) => (
              <div key={i} style={{ marginBottom: '0.6rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#222' }}>
                  {String.fromCharCode(65 + i)}. {renderText(item)}
                </div>
              </div>
            ))}
          </AdvisorySection>
          <SectionDivider />
        </>
      )}

      {/* ── 3. Strength of Each Component ────────── */}
      {a.componentAssessments && a.componentAssessments.length > 0 && (
        <>
          <AdvisorySection number={next()} label="Strength of Each Component">
            <AdvisoryComponentAssessments assessments={a.componentAssessments} />
          </AdvisorySection>
          <SectionDivider />
        </>
      )}

      {/* ── 4. The Best Upgrade Path ─────────────── */}
      {a.upgradePaths && a.upgradePaths.length > 0 && (
        <>
          <AdvisorySection number={next()} label="The Best Upgrade Path">
            <AdvisoryUpgradePaths paths={a.upgradePaths} />
          </AdvisorySection>
          <SectionDivider />
        </>
      )}

      {/* ── 5. Components I Would NOT Change ─────── */}
      {a.keepRecommendations && a.keepRecommendations.length > 0 && (
        <>
          <AdvisorySection number={next()} label="Components I Would NOT Change">
            {a.keepRecommendations.map((k, i) => (
              <div key={i}>
                {i > 0 && <SectionDivider />}
                <div style={{ marginBottom: '0.3rem' }}>
                  <strong style={{ fontSize: '0.98rem', color: '#111' }}>{k.name}</strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.6, color: '#444' }}>
                  {renderText(k.reason)}
                </p>
              </div>
            ))}
          </AdvisorySection>
          <SectionDivider />
        </>
      )}

      {/* ── 6. What I Would Personally Do ────────── */}
      {a.recommendedSequence && a.recommendedSequence.length > 0 && (
        <>
          <AdvisorySection number={next()} label="What I Would Personally Do">
            <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.95rem', color: '#444' }}>
              If this were my system:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {a.recommendedSequence.map((step) => (
                <div key={step.step} style={{ fontSize: '0.95rem', lineHeight: 1.6 }}>
                  <span style={{ fontWeight: 600, color: '#333' }}>Step {step.step}</span>
                  <br />
                  {renderText(step.action)}
                </div>
              ))}
            </div>
          </AdvisorySection>
          <SectionDivider />
        </>
      )}

      {/* ── 7. A Key Observation ─────────────────── */}
      {a.keyObservation && (
        <>
          <AdvisorySection number={next()} label="A Key Observation">
            <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.7, color: '#333' }}>
              {renderText(a.keyObservation)}
            </p>
          </AdvisorySection>
          <SectionDivider />
        </>
      )}

      {/* ── Follow-up ────────────────────────────── */}
      {a.followUp && (
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', lineHeight: 1.7, color: '#444' }}>
          {renderText(a.followUp)}
        </p>
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

function StandardFormat({ advisory: a }: AdvisoryMessageProps) {
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

      {/* ── System Assessment Block ── */}
      {a.componentReadings && a.componentReadings.length > 0 && a.systemContext && (
        <AdvisorySection label="System character">
          <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.7 }}>
            {a.systemContext}
          </p>
        </AdvisorySection>
      )}

      {a.componentReadings && a.componentReadings.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          {a.componentReadings.map((para, i) => (
            <p key={i} style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', lineHeight: 1.7, color: '#333' }}>
              {para}
            </p>
          ))}
        </div>
      )}

      {a.systemInteraction && (
        <AdvisorySection label="How the components interact">
          <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.7 }}>
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
          <BulletList items={a.assessmentLimitations} color="#666" />
        </AdvisorySection>
      )}

      {a.upgradeDirection && (
        <AdvisorySection label="Likely upgrade direction">
          <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.7 }}>
            {a.upgradeDirection}
          </p>
        </AdvisorySection>
      )}

      {/* ── 3. System context (non-assessment) ── */}
      {a.systemContext && !a.componentReadings && (
        <AdvisorySection label="Your system">
          <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.7 }}>
            {a.systemContext}
          </p>
        </AdvisorySection>
      )}

      {a.systemTendencies && !a.systemContext && !a.systemInteraction && (
        <AdvisorySection label="System tendencies">
          <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.7 }}>
            {a.systemTendencies}
          </p>
        </AdvisorySection>
      )}

      {a.strengths && a.strengths.length > 0 && (
        <AdvisorySection label="What is working well">
          <BulletList items={a.strengths} />
        </AdvisorySection>
      )}

      {a.limitations && a.limitations.length > 0 && (
        <AdvisorySection label="Where limitations may appear">
          <BulletList items={a.limitations} color="#666" />
        </AdvisorySection>
      )}

      {/* ── 5. Core advisory body ────────────────── */}
      {(a.improvements && a.improvements.length > 0) ? (
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
        <AdvisoryProse
          philosophy={a.philosophy}
          tendencies={a.tendencies}
          systemFit={a.systemFit}
        />
      )}

      {a.improvements && a.improvements.length > 0 && (
        <AdvisorySection label="What improves">
          <BulletList items={a.improvements} />
        </AdvisorySection>
      )}

      {a.unchanged && a.unchanged.length > 0 && (
        <AdvisorySection label="What probably stays the same">
          <BulletList items={a.unchanged} color="#666" />
        </AdvisorySection>
      )}

      {/* ── 6. Recommended direction ─────────────── */}
      {a.recommendedDirection && (
        <AdvisorySection label="What this means for component choice">
          <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.7 }}>
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
          <BulletList items={a.tradeOffs} color="#666" />
        </AdvisorySection>
      )}

      {a.whenToAct && (
        <AdvisorySection label="When this upgrade makes sense">
          <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.7 }}>
            {a.whenToAct}
          </p>
        </AdvisorySection>
      )}

      {a.whenToWait && (
        <AdvisorySection label="When it may not be the best next step">
          <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.7, color: '#666' }}>
            {a.whenToWait}
          </p>
        </AdvisorySection>
      )}

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

      {a.upgradeImpactAreas && a.upgradeImpactAreas.length > 0 && (
        <AdvisorySection label="Where upgrades would have the most impact">
          <BulletList items={a.upgradeImpactAreas} />
        </AdvisorySection>
      )}

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

      {/* ── 9. Options ───────────────────────────── */}
      {a.options && a.options.length > 0 && (
        <AdvisorySection label="Worth considering">
          <AdvisoryOptions options={a.options} />
        </AdvisorySection>
      )}

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

      {/* ── 10. Bottom line ──────────────────────── */}
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

      {/* ── 11. Follow-up (blue box) ─────────────── */}
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

      {/* ── 12. Learn more (links) ───────────────── */}
      {a.links && a.links.length > 0 && (
        <AdvisorySection label="Learn more">
          <AdvisoryLinks links={a.links} />
        </AdvisorySection>
      )}

      {/* ── 13. Sources ──────────────────────────── */}
      {a.sourceReferences && a.sourceReferences.length > 0 && (
        <AdvisorySection label="Sources">
          <AdvisorySources sources={a.sourceReferences} />
        </AdvisorySection>
      )}

      {/* ── 14. Diagnostics (collapsible) ────────── */}
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

// ── Main Export ────────────────────────────────────────

export default function AdvisoryMessage({ advisory }: AdvisoryMessageProps) {
  if (isMemoFormat(advisory)) {
    return <MemoFormat advisory={advisory} />;
  }
  return <StandardFormat advisory={advisory} />;
}
