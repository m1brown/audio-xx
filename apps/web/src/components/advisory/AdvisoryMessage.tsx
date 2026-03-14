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

import type { AdvisoryResponse, AdvisoryMode } from '../../lib/advisory-response';
import AdvisorySection from './AdvisorySection';
import AdvisoryProse from './AdvisoryProse';
import AdvisoryProductCards from './AdvisoryProductCard';
import AdvisoryLinks from './AdvisoryLinks';
import AdvisorySources from './AdvisorySources';
import AdvisoryDiagnostics from './AdvisoryDiagnostics';
import AdvisoryComponentAssessments from './AdvisoryComponentAssessments';
import AdvisoryUpgradePaths from './AdvisoryUpgradePaths';
import AdvisorySpiderChart from './AdvisorySpiderChart';
import AdvisoryListenerProfile from './AdvisoryListenerProfile';
import { renderText } from './render-text';

interface AdvisoryMessageProps {
  advisory: AdvisoryResponse;
}

// ── Design tokens ─────────────────────────────────────
//
// Centralized here for consistency across both rendering modes.

const COLORS = {
  text: '#2a2a2a',
  textSecondary: '#5a5a5a',
  textMuted: '#8a8a8a',
  textLight: '#aaa',
  accent: '#a89870',
  accentLight: '#c8c0a8',
  accentBg: '#faf8f3',
  border: '#eeece8',
  borderLight: '#f4f2ee',
  sectionLabel: '#aaa',
  green: '#5a7050',
  amber: '#8a6a50',
  white: '#fff',
  bg: '#fff',
};

const FONTS = {
  bodySize: '0.95rem',
  smallSize: '0.88rem',
  labelSize: '0.78rem',
  sectionHeading: '1.08rem',
  lineHeight: 1.7,
};

/** Inline bullet list — reused across both modes. */
function BulletList({ items, color }: { items: string[]; color?: string }) {
  return (
    <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: FONTS.lineHeight, color: color ?? COLORS.text }}>
      {items.map((item, i) => (
        <li key={i} style={{ marginBottom: '0.25rem', fontSize: FONTS.bodySize }}>{renderText(item)}</li>
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

/** Subtle section divider. */
function SectionDivider() {
  return <hr style={{ border: 'none', borderTop: `1px solid ${COLORS.border}`, margin: '1.75rem 0' }} />;
}

/** Mode label display names. */
const MODE_LABELS: Record<AdvisoryMode, string> = {
  system_review: 'System Review',
  gear_advice: 'Gear Advice',
  gear_comparison: 'Gear Comparison',
  upgrade_suggestions: 'Upgrade Suggestions',
  general: 'Advisory',
};

/** Mode awareness indicator — subtle label at the top of the response. */
function ModeIndicator({ mode }: { mode?: AdvisoryMode }) {
  if (!mode || mode === 'general') return null;
  return (
    <div style={{
      fontSize: '0.72rem',
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
      color: COLORS.accentLight,
      marginBottom: '0.6rem',
    }}>
      {MODE_LABELS[mode]}
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
//   6. System Bottlenecks
//   7. Component Contributions
//   8. Upgrade Strategy
//   9. Components Worth Keeping
//  10. Listener Taste Profile

function MemoFormat({ advisory: a }: AdvisoryMessageProps) {
  let sectionNum = 0;
  const next = () => ++sectionNum;

  return (
    <div style={{ lineHeight: FONTS.lineHeight, color: COLORS.text }}>
      {/* ── Mode indicator ──────────────────────────── */}
      <ModeIndicator mode={a.advisoryMode} />

      {/* ── Title ──────────────────────────────────── */}
      {a.title && (
        <h2 style={{
          margin: '0 0 1rem 0',
          fontSize: '1.2rem',
          fontWeight: 600,
          color: '#2a2a2a',
          letterSpacing: '-0.01em',
        }}>
          {a.title}
        </h2>
      )}

      {/* ── 1. System Character ────────────────────── */}
      <AdvisorySection number={next()} label="System Character">
        {/* Intro summary — system philosophy framing */}
        {a.introSummary && (
          <p style={{ margin: '0 0 0.7rem 0', fontSize: '0.98rem', lineHeight: 1.8 }}>
            {renderText(a.introSummary)}
          </p>
        )}
        {/* System character prose */}
        {a.systemContext && (
          <p style={{ margin: '0 0 0.7rem 0', fontSize: FONTS.bodySize, lineHeight: FONTS.lineHeight }}>
            {renderText(a.systemContext)}
          </p>
        )}
        {/* System interaction description */}
        {a.systemInteraction && (
          <p style={{ margin: '0 0 0.4rem 0', fontSize: FONTS.bodySize, lineHeight: FONTS.lineHeight }}>
            {renderText(a.systemInteraction)}
          </p>
        )}
        {/* System chain — clean inline display */}
        {a.systemChain && a.systemChain.fullChain && a.systemChain.fullChain.length > 0 && (
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
              {a.systemChain.fullChain.map((name, ci) => (
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
      {a.systemSignature && (
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

      {/* ── 3. System Synergy Summary ─────────────── */}
      {a.systemSynergy && (
        <>
          <AdvisorySection number={next()} label="System Synergy">
            <p style={{
              margin: 0,
              fontSize: FONTS.bodySize,
              lineHeight: 1.8,
              color: COLORS.textSecondary,
              fontStyle: 'italic',
              borderLeft: `3px solid ${COLORS.accentLight}`,
              paddingLeft: '0.9rem',
            }}>
              {renderText(a.systemSynergy)}
            </p>
          </AdvisorySection>
          <SectionDivider />
        </>
      )}

      {/* ── 4. What the System Does Well ─────────── */}
      {a.assessmentStrengths && a.assessmentStrengths.length > 0 && (
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
      {a.assessmentLimitations && a.assessmentLimitations.length > 0 && (
        <>
          <AdvisorySection number={next()} label="Trade-offs in the System">
            {a.primaryConstraint && (
              <p style={{ margin: '0 0 0.7rem 0', fontSize: FONTS.bodySize, lineHeight: FONTS.lineHeight, color: COLORS.textSecondary }}>
                {renderText(a.primaryConstraint.explanation)}
              </p>
            )}
            <BulletList items={a.assessmentLimitations} color={COLORS.textSecondary} />
          </AdvisorySection>
          <SectionDivider />
        </>
      )}

      {/* ── 6. System Bottlenecks ─────────────────── */}
      {a.upgradePaths && a.upgradePaths.length > 0 && (
        <>
          <AdvisorySection number={next()} label="System Bottlenecks">
            <AdvisoryUpgradePaths paths={a.upgradePaths.slice(0, 2)} />
          </AdvisorySection>
          <SectionDivider />
        </>
      )}

      {/* ── 7. Component Contributions ────────────── */}
      {a.componentAssessments && a.componentAssessments.length > 0 && (
        <>
          <AdvisorySection number={next()} label="Component Contributions">
            <AdvisoryComponentAssessments assessments={a.componentAssessments} />
          </AdvisorySection>
          <SectionDivider />
        </>
      )}

      {/* ── 8. Upgrade Strategy ──────────────────── */}
      {a.recommendedSequence && a.recommendedSequence.length > 0 && (
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

      {/* ── 9. Components Worth Keeping ───────────── */}
      {a.keepRecommendations && a.keepRecommendations.length > 0 && (
        <>
          <AdvisorySection number={next()} label="Components Worth Keeping">
            {a.keepRecommendations.map((k, i) => (
              <div key={i}>
                {i > 0 && <hr style={{ border: 'none', borderTop: `1px solid ${COLORS.borderLight}`, margin: '0.8rem 0' }} />}
                <div style={{ marginBottom: '0.3rem' }}>
                  <strong style={{ fontSize: '0.98rem', color: '#2a2a2a' }}>{k.name}</strong>
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
      {(a.listenerTasteProfile || a.keyObservation) && (
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

function StandardFormat({ advisory: a }: AdvisoryMessageProps) {
  const hasListenerPriorities = (a.listenerPriorities && a.listenerPriorities.length > 0)
    || (a.listenerAvoids && a.listenerAvoids.length > 0);

  const hasProvisionalCaveats = a.provisional
    && a.statedGaps
    && a.statedGaps.length > 0;

  return (
    <div style={{ lineHeight: FONTS.lineHeight, color: COLORS.text }}>
      {/* ── Mode indicator ──────────────────────────── */}
      <ModeIndicator mode={a.advisoryMode} />

      {/* ── 1. Comparison summary ────────────────────── */}
      {a.comparisonSummary && (
        <p
          style={{
            margin: '0 0 1.25rem 0',
            fontWeight: 500,
            fontSize: '1.02rem',
            color: '#333',
            lineHeight: 1.7,
          }}
        >
          {a.comparisonSummary}
        </p>
      )}

      {/* ── 2. Listener priorities ────────────────────── */}
      {hasListenerPriorities && (
        <div
          style={{
            borderLeft: `3px solid ${COLORS.accent}`,
            paddingLeft: '1rem',
            marginBottom: '1.5rem',
            background: COLORS.accentBg,
            padding: '0.8rem 1rem',
            borderRadius: '0 6px 6px 0',
          }}
        >
          {a.listenerPriorities && a.listenerPriorities.length > 0 && (
            <div style={{ marginBottom: a.listenerAvoids?.length ? '0.7rem' : 0 }}>
              <div
                style={{
                  fontSize: FONTS.labelSize,
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase' as const,
                  color: COLORS.accent,
                  marginBottom: '0.35rem',
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
                  fontSize: FONTS.labelSize,
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase' as const,
                  color: COLORS.accent,
                  marginBottom: '0.35rem',
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
          <p style={{ margin: 0, fontSize: FONTS.bodySize, lineHeight: FONTS.lineHeight }}>
            {a.systemContext}
          </p>
        </AdvisorySection>
      )}

      {a.componentReadings && a.componentReadings.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          {a.componentReadings.map((para, i) => (
            <p key={i} style={{ margin: '0 0 0.8rem 0', fontSize: FONTS.bodySize, lineHeight: FONTS.lineHeight, color: COLORS.text }}>
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
              <li key={i} style={{ fontSize: '0.93rem', color: COLORS.textSecondary, marginBottom: '0.2rem' }}>
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
          <BulletList items={a.unchanged} color={COLORS.textMuted} />
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
                  fontSize: '0.93rem',
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
              // Lines starting with ** are philosophy labels
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

      {/* ── 10. Options ───────────────────────────── */}
      {a.options && a.options.length > 0 && (
        <AdvisorySection label="Worth considering">
          <AdvisoryProductCards options={a.options} />
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

      {/* ── 12. Refinement prompts ────────────────── */}
      {a.refinementPrompts && a.refinementPrompts.length > 0 && (
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
              <li key={i} style={{ fontSize: '0.93rem', color: COLORS.textSecondary, marginBottom: '0.15rem' }}>
                {prompt}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── 13. Follow-up ─────────────────────────── */}
      {a.followUp && !a.refinementPrompts?.length && (
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
      {a.links && a.links.length > 0 && (
        <AdvisorySection label="Learn more">
          <AdvisoryLinks links={a.links} />
        </AdvisorySection>
      )}

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

// ── Main Export ────────────────────────────────────────

export default function AdvisoryMessage({ advisory }: AdvisoryMessageProps) {
  if (isMemoFormat(advisory)) {
    return <MemoFormat advisory={advisory} />;
  }
  return <StandardFormat advisory={advisory} />;
}
