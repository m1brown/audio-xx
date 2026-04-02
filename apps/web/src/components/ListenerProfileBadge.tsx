/**
 * Audio XX — Listener Profile Badge (read-only)
 *
 * Persistent, minimal UI element showing the user's inferred listening
 * preferences. Updates after each interaction as the profile accumulates
 * signals from product likes, dislikes, and conversation context.
 *
 * Shows 3–5 traits sorted by strength, with a subtle confidence indicator.
 * Designed to sit below the header, above the conversation.
 *
 * Data source: listenerProfileRef (in-session) + optional stored TasteProfile.
 */

'use client';

// ── Types ────────────────────────────────────────────

export interface ListenerProfileSnapshot {
  /** Top traits sorted by strength, max 5. */
  traits: Array<{ label: string; value: number }>;
  /** Profile confidence 0–1. */
  confidence: number;
  /** Number of signals that shaped the profile. */
  signalCount: number;
  /** Optional archetype direction label. */
  direction?: string;
}

// ── Trait display names ──────────────────────────────

const TRAIT_LABELS: Record<string, string> = {
  flow: 'Flow',
  clarity: 'Clarity',
  rhythm: 'Rhythm',
  tonal_density: 'Tonal density',
  spatial_depth: 'Spatial depth',
  dynamics: 'Dynamics',
  warmth: 'Warmth',
};

// ── Snapshot builder ─────────────────────────────────

/**
 * Build a display snapshot from the raw listener profile.
 * Returns null if the profile has insufficient data to show.
 */
export function buildProfileSnapshot(
  inferredTraits: Record<string, number>,
  confidence: number,
  signalCount: number,
  direction?: string | null,
): ListenerProfileSnapshot | null {
  // Don't show anything until we have at least one meaningful signal
  if (confidence < 0.1) return null;

  // Sort traits by value, filter those above threshold
  const sorted = Object.entries(inferredTraits)
    .filter(([, value]) => value > 0.1)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([key, value]) => ({
      label: TRAIT_LABELS[key] ?? key,
      value,
    }));

  if (sorted.length === 0) return null;

  return {
    traits: sorted,
    confidence,
    signalCount,
    direction: direction ?? undefined,
  };
}

// ── Design tokens ────────────────────────────────────

const COLORS = {
  bg: '#faf9f6',
  border: '#e8e6e0',
  text: '#5a5a5a',
  textMuted: '#8a8a8a',
  accent: '#a89870',
  traitBg: '#f5f3ef',
  traitBgActive: '#ede9e0',
  barFill: '#c4b898',
  barBg: '#ece9e2',
};

// ── Component ────────────────────────────────────────

export default function ListenerProfileBadge({
  snapshot,
}: {
  snapshot: ListenerProfileSnapshot;
}) {
  const confidenceLabel = snapshot.confidence >= 0.5
    ? 'Established'
    : snapshot.confidence >= 0.25
      ? 'Developing'
      : 'Early';

  return (
    <div
      style={{
        padding: '0.6rem 0.85rem',
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        background: COLORS.bg,
        marginBottom: '0.75rem',
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.45rem',
        }}
      >
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase' as const,
            color: COLORS.textMuted,
          }}
        >
          Listening profile
        </span>
        <span
          style={{
            fontSize: '0.65rem',
            color: COLORS.textMuted,
            fontStyle: 'italic',
          }}
        >
          {confidenceLabel} · {snapshot.signalCount} signal{snapshot.signalCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Trait bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        {snapshot.traits.map((trait) => (
          <div
            key={trait.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span
              style={{
                fontSize: '0.75rem',
                color: COLORS.text,
                minWidth: 85,
                fontWeight: 500,
              }}
            >
              {trait.label}
            </span>
            <div
              style={{
                flex: 1,
                height: 5,
                background: COLORS.barBg,
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.round(trait.value * 100)}%`,
                  height: '100%',
                  background: COLORS.barFill,
                  borderRadius: 3,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
            <span
              style={{
                fontSize: '0.65rem',
                color: COLORS.textMuted,
                minWidth: 24,
                textAlign: 'right',
              }}
            >
              {Math.round(trait.value * 100)}
            </span>
          </div>
        ))}
      </div>

      {/* Direction label */}
      {snapshot.direction && (
        <div
          style={{
            marginTop: '0.4rem',
            fontSize: '0.72rem',
            color: COLORS.accent,
            fontStyle: 'italic',
          }}
        >
          Direction: {snapshot.direction}
        </div>
      )}
    </div>
  );
}
