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

import type { AdvisoryResponse, AdvisoryMode, AdvisorySource, AudioProfile, ProductAssessment, KnowledgeResponse, AssistantResponse, EditorialClosing, EditorialPick } from '../../lib/advisory-response';
import type { DecisionFrame, DecisionDirection, SystemInteraction } from '../../lib/decision-frame';
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

      {/* ── 6. Component Contributions ────────────── */}
      {a.componentAssessments && a.componentAssessments.length > 0 && (
        <>
          <AdvisorySection number={next()} label="Component Contributions">
            <AdvisoryComponentAssessments assessments={a.componentAssessments} />
          </AdvisorySection>
          <SectionDivider />
        </>
      )}

      {/* ── 7. System Bottlenecks ─────────────────── */}
      {a.upgradePaths && a.upgradePaths.length > 0 && (
        <>
          <AdvisorySection number={next()} label="System Bottlenecks">
            <AdvisoryUpgradePaths paths={a.upgradePaths.slice(0, 2)} />
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

function AudioPreferencesBlock({ profile }: { profile: AudioProfile }) {
  const hasSystem = profile.systemChain && profile.systemChain.length > 0;
  const hasPriorities = profile.sonicPriorities && profile.sonicPriorities.length > 0;
  const hasAvoids = profile.sonicAvoids && profile.sonicAvoids.length > 0;
  const hasContext = profile.listeningContext && profile.listeningContext.length > 0;
  const hasAnything = hasSystem || hasPriorities || hasContext;

  if (!hasAnything) {
    // No profile at all — show exploratory note
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
          Exploratory recommendations
        </div>
        <p style={{
          margin: 0,
          fontSize: '0.91rem',
          lineHeight: 1.7,
          color: COLORS.textSecondary,
        }}>
          These suggestions represent different design philosophies. Tell me about your system, sonic preferences, and listening habits for more personalized direction.
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
            Your chain
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
            You prefer
          </div>
          <div style={{
            fontSize: '0.91rem',
            color: COLORS.text,
            lineHeight: 1.65,
          }}>
            {profile.sonicPriorities!.join(' · ')}
          </div>
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
      {a.audioProfile && <AudioPreferencesBlock profile={a.audioProfile} />}

      {/* ── Product name heading ─────────────────────── */}
      <h2 style={{
        margin: '0 0 0.8rem 0',
        fontSize: '1.3rem',
        fontWeight: 600,
        color: COLORS.text,
        letterSpacing: '-0.01em',
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
        {isDoNothing ? '→ ' : ''}{d.label}
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
            margin: '0 0 0.75rem 0',
            fontSize: '1.15rem',
            fontWeight: 600,
            color: COLORS.text,
            letterSpacing: '-0.01em',
          }}>
            Top Recommendations (Value + Sound)
          </h3>
          <p style={{
            margin: '0 0 0.75rem 0',
            fontSize: '0.93rem',
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
            margin: '0 0 0.5rem 0',
            fontSize: '1.15rem',
            fontWeight: 600,
            color: COLORS.text,
            letterSpacing: '-0.01em',
          }}>
            What I&rsquo;d Recommend For <em>Your</em> System
          </h3>
          {closing.systemSummary && (
            <p style={{
              margin: '0 0 0.75rem 0',
              fontSize: '0.93rem',
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

function EditorialFormat({ advisory: a }: AdvisoryMessageProps) {
  return (
    <div style={{ lineHeight: FONTS.lineHeight, color: COLORS.text }}>
      {/* ── Mode indicator ──────────────────────────── */}
      <ModeIndicator mode={a.advisoryMode} />

      {/* ── 1. Page title ────────────────────────────── */}
      {a.subject && (
        <h2 style={{
          margin: '0 0 1rem 0',
          fontSize: '1.45rem',
          fontWeight: 600,
          color: COLORS.text,
          letterSpacing: '-0.02em',
          lineHeight: 1.25,
        }}>
          {a.subject}
        </h2>
      )}

      {/* ── 2. Audio Preferences (replaces listener priorities) ── */}
      {a.audioProfile && (
        <AudioPreferencesBlock profile={a.audioProfile} />
      )}

      {/* ── 2b. Decision Frame ───────────────────────── */}
      {a.decisionFrame && (
        <DecisionFrameBlock frame={a.decisionFrame} />
      )}

      {/* ── 2c. System Context Preamble ─────────────── */}
      {a.systemContextPreamble && (
        <div style={{
          margin: '0.5rem 0 1.25rem 0',
          padding: '0.75rem 1rem',
          background: COLORS.accentBg,
          borderRadius: '6px',
          borderLeft: `3px solid ${COLORS.accent}`,
          fontSize: '0.95rem',
          lineHeight: 1.75,
          color: COLORS.text,
        }}>
          <div style={{
            fontSize: '0.78rem',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.05em',
            color: COLORS.muted,
            marginBottom: '0.35rem',
          }}>
            System Context
          </div>
          {renderText(a.systemContextPreamble)}
        </div>
      )}

      {/* ── 3. Editorial intro — taste-anchored framing ── */}
      {a.editorialIntro && (
        <p style={{
          margin: '0 0 1.25rem 0',
          fontSize: '0.97rem',
          lineHeight: 1.75,
          color: COLORS.text,
        }}>
          {renderText(a.editorialIntro)}
        </p>
      )}

      {/* ── Divider ──────────────────────────────────── */}
      <SectionDivider />

      {/* ── 4. Product sections (PRIMARY CONTENT) ────── */}
      {a.options && a.options.length > 0 && (
        <AdvisoryProductCards options={a.options} />
      )}

      {/* ── 5. Editorial closing (LLM: system picks + avoidance) ── */}
      {a.editorialClosing && (
        <>
          <SectionDivider />
          <EditorialClosingBlock closing={a.editorialClosing} />
        </>
      )}

      {/* ── Divider before supplementary sections ────── */}
      <SectionDivider />

      {/* ── 5b. Provisional caveats ──────────────────── */}
      {a.provisional && a.statedGaps && a.statedGaps.length > 0 && (
        <div style={{
          fontSize: '0.88rem',
          color: COLORS.textLight,
          fontStyle: 'italic',
          marginBottom: '1.25rem',
        }}>
          Based on limited context — missing: {a.statedGaps.join(', ')}
          {a.dependencyCaveat && <>. {a.dependencyCaveat}</>}
        </div>
      )}

      {/* ── 6. Sonic landscape (kept — unique content) ── */}
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

      {/* ── 7. Refinement prompts ────────────────────── */}
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

      {/* ── 8. Learn more (links) ────────────────────── */}
      {a.links && a.links.length > 0 && (
        <AdvisorySection label="Learn more">
          <AdvisoryLinks links={a.links} />
        </AdvisorySection>
      )}

      {/* ── 9. Sources ───────────────────────────────── */}
      {a.sourceReferences && a.sourceReferences.length > 0 && (
        <AdvisorySection label="Sources">
          <AdvisorySources sources={a.sourceReferences} />
        </AdvisorySection>
      )}

      {/* ── 10. Diagnostics (collapsible) ────────────── */}
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

// ── Lane Detection ──────────────────────────────────────

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

      {a.audioProfile && <AudioPreferencesBlock profile={a.audioProfile} />}

      <AdvisorySection label={kr.topic}>
        <p style={{ margin: '0 0 0.8rem 0', color: COLORS.text, lineHeight: FONTS.lineHeight }}>
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
        <p style={{ margin: '0 0 0.8rem 0', color: COLORS.text, lineHeight: FONTS.lineHeight, whiteSpace: 'pre-wrap' }}>
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

// ── Classic Format (Consultations, Diagnosis, Comparisons) ──

function StandardFormat({ advisory: a }: AdvisoryMessageProps) {
  // Redirect to editorial format when product options are present
  if (isEditorialFormat(a)) {
    return <EditorialFormat advisory={a} />;
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

      {/* ── 2. Audio Preferences ────────────────────── */}
      {a.audioProfile && <AudioPreferencesBlock profile={a.audioProfile} />}

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
  if (isAssessmentFormat(advisory)) {
    return <AssessmentFormat advisory={advisory} />;
  }
  if (isKnowledgeFormat(advisory)) {
    return <KnowledgeFormat advisory={advisory} />;
  }
  if (isAssistantFormat(advisory)) {
    return <AssistantFormat advisory={advisory} />;
  }
  return <StandardFormat advisory={advisory} />;
}
