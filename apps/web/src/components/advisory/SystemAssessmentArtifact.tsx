'use client';

// React imported explicitly for vitest node-env JSX classic transform.
import React from 'react';

import type { AdvisoryResponse } from '@/lib/advisory-response';
import { COLOR, sectionHeadingStyle, proseStyle } from '@/lib/editorial-tokens';

import SystemHero from './SystemHero';
import SystemProfileCard from './SystemProfileCard';
import EditorialSubCard from './EditorialSubCard';
import AdvisoryUpgradePaths from './AdvisoryUpgradePaths';
import AdvisorySources from './AdvisorySources';

/**
 * Audio XX — System Assessment Artifact.
 *
 * The warm-editorial sibling of the Brand Authority page. Renders a
 * system-assessment response as a 10-section editorial document.
 *
 * Section structure (locked heading set, 2026-05-29):
 *   1.  Your System                       (SystemHero — chart + chain)
 *   2.  Profile                           (SystemProfileCard — 3 lines)
 *   3.  First Impressions                 (introSummary prose)
 *   4.  Character                         (systemContext + systemSynergy)
 *   5.  The Components                    (EditorialSubCard per component)
 *   6.  How They Work Together            (systemInteraction prose)
 *   7.  Strengths and Honest Limits       (two-column grid)
 *   8.  What's Already Working            (EditorialSubCard per kept item)
 *   9.  If You Were to Change Something   (upgradeDirection + paths + sequence)
 *  10.  Sources                           (AdvisorySources)
 *
 * Each section is independently data-gated — renders nothing when its
 * underlying field is absent. The artifact gracefully degrades for
 * sparse responses (consumer-wireless short-circuit, partial chains,
 * etc.) the same way Brand Authority pages degrade for sparse profiles.
 *
 * Visual contract: warm-editorial palette only (see `editorial-tokens.ts`).
 * No cool-slate colors, no chat-bubble chrome, no marketing voice.
 *
 * Gating: the dispatcher in `AdvisoryMessage.tsx` is responsible for
 * checking `SYSTEM_ASSESSMENT_ARTIFACT_ENABLED` before rendering this
 * component. This file does not check the flag itself.
 *
 * Engine, builders, intent classifier, cross-brand resolver, F4 gates,
 * listener-aware framing, listing-eval safety boundaries — none touched.
 */

interface SystemAssessmentArtifactProps {
  advisory: AdvisoryResponse;
}

export default function SystemAssessmentArtifact({
  advisory: a,
}: SystemAssessmentArtifactProps) {
  const hasComponents = !!(a.componentReadings && a.componentReadings.length > 0);
  const hasStrengths = !!(a.assessmentStrengths && a.assessmentStrengths.length > 0);
  const hasLimits = !!(a.assessmentLimitations && a.assessmentLimitations.length > 0);
  const hasStrengthsAndLimits = hasStrengths || hasLimits;
  const hasKeeps = !!(a.keepRecommendations && a.keepRecommendations.length > 0);
  const hasUpgradeDirection = !!a.upgradeDirection;
  const hasUpgradePaths = !!(a.upgradePaths && a.upgradePaths.length > 0);
  const hasSequence = !!(a.recommendedSequence && a.recommendedSequence.length > 0);
  const hasChangeSection = hasUpgradeDirection || hasUpgradePaths || hasSequence;
  const hasSources = !!(a.sourceReferences && a.sourceReferences.length > 0);

  return (
    <article
      aria-label="System Assessment"
      style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '0 1rem',
        color: COLOR.textPrimary,
      }}
    >
      {/* ═══════════ §1 Your System ═══════════ */}
      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={sectionHeadingStyle}>Your System</h2>
        <SystemHero
          spiderChartData={a.spiderChartData}
          systemChain={
            a.systemChain
              ? { names: a.systemChain.names, roles: a.systemChain.roles }
              : undefined
          }
        />
      </section>

      {/* ═══════════ §2 Profile ═══════════ */}
      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={sectionHeadingStyle}>Profile</h2>
        <SystemProfileCard
          whatItIs={a.systemSignature}
          whatItLeansToward={a.tendencies}
          whatItTrades={a.primaryConstraint?.componentName}
        />
      </section>

      {/* ═══════════ §3 First Impressions ═══════════ */}
      {a.introSummary && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={sectionHeadingStyle}>First Impressions</h2>
          <p style={proseStyle}>{a.introSummary}</p>
        </section>
      )}

      {/* ═══════════ §4 Character ═══════════ */}
      {(a.systemContext || a.systemSynergy) && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={sectionHeadingStyle}>Character</h2>
          {a.systemContext && <p style={proseStyle}>{a.systemContext}</p>}
          {a.systemSynergy && (
            <p
              style={{
                ...proseStyle,
                marginTop: a.systemContext ? '0.65rem' : 0,
                fontStyle: 'italic',
                borderLeft: `3px solid ${COLOR.accent}`,
                paddingLeft: '0.9rem',
              }}
            >
              {a.systemSynergy}
            </p>
          )}
        </section>
      )}

      {/* ═══════════ §5 The Components ═══════════ */}
      {hasComponents && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={sectionHeadingStyle}>The Components</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {a.componentReadings!.map((reading, i) => (
              <EditorialSubCard
                key={i}
                name={a.systemChain?.names?.[i] ?? `Component ${i + 1}`}
                subtitle={a.systemChain?.roles?.[i]}
                body={reading}
              />
            ))}
          </div>
        </section>
      )}

      {/* ═══════════ §6 How They Work Together ═══════════ */}
      {a.systemInteraction && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={sectionHeadingStyle}>How They Work Together</h2>
          <p style={proseStyle}>{a.systemInteraction}</p>
        </section>
      )}

      {/* ═══════════ §7 Strengths and Honest Limits ═══════════ */}
      {hasStrengthsAndLimits && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={sectionHeadingStyle}>Strengths and Honest Limits</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
              gap: '1rem',
            }}
          >
            {hasStrengths && (
              <div>
                <h3
                  style={{
                    margin: '0 0 0.4rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: COLOR.textMuted,
                  }}
                >
                  Strengths
                </h3>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: '1.1rem',
                    listStyle: 'disc',
                    fontSize: '0.94rem',
                    lineHeight: 1.65,
                    color: COLOR.textSecondary,
                  }}
                >
                  {a.assessmentStrengths!.map((s, i) => (
                    <li key={i} style={{ marginBottom: '0.2rem', color: '#5a7050' }}>
                      <span style={{ color: COLOR.textSecondary }}>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {hasLimits && (
              <div>
                <h3
                  style={{
                    margin: '0 0 0.4rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: COLOR.textMuted,
                  }}
                >
                  Honest Limits
                </h3>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: '1.1rem',
                    listStyle: 'disc',
                    fontSize: '0.94rem',
                    lineHeight: 1.65,
                    color: COLOR.textSecondary,
                  }}
                >
                  {a.assessmentLimitations!.map((l, i) => (
                    <li key={i} style={{ marginBottom: '0.2rem', color: '#8a6a50' }}>
                      <span style={{ color: COLOR.textSecondary }}>{l}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ═══════════ §8 What's Already Working ═══════════ */}
      {hasKeeps && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={sectionHeadingStyle}>What&rsquo;s Already Working</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {a.keepRecommendations!.map((keep, i) => (
              <EditorialSubCard
                key={i}
                name={keep.name}
                body={keep.reason}
              />
            ))}
          </div>
        </section>
      )}

      {/* ═══════════ §9 If You Were to Change Something ═══════════ */}
      {hasChangeSection && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={sectionHeadingStyle}>If You Were to Change Something</h2>
          {a.upgradeDirection && (
            <p style={{ ...proseStyle, marginBottom: '0.85rem' }}>{a.upgradeDirection}</p>
          )}
          {hasUpgradePaths && (
            <AdvisoryUpgradePaths
              paths={a.upgradePaths!}
              stackedTraits={a.stackedTraitInsights}
              systemCharacterSummary={a.systemSignature}
            />
          )}
          {hasSequence && (
            <div
              style={{
                marginTop: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              {a.recommendedSequence!.map((step) => (
                <EditorialSubCard
                  key={step.step}
                  name={`Step ${step.step}`}
                  body={step.action}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ═══════════ §10 Sources ═══════════ */}
      {hasSources && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={sectionHeadingStyle}>Sources</h2>
          <AdvisorySources sources={a.sourceReferences!} />
        </section>
      )}
    </article>
  );
}
