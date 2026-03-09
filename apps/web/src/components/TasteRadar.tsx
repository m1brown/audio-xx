'use client';

import { PROFILE_TRAITS, type TasteProfile } from '@/lib/taste-profile';

interface TasteRadarProps {
  profile: TasteProfile;
  /** Overall SVG size in px. Default 240. */
  size?: number;
  /** Compact mode: hides labels, smaller dots, default size 100. */
  compact?: boolean;
}

/**
 * Pure SVG radar chart for 7 taste-profile traits.
 *
 * - 7-pointed spider plot with concentric rings at 0.25, 0.5, 0.75, 1.0
 * - Profile polygon filled with app accent red
 * - Compact mode for inline/widget use
 */
export default function TasteRadar({ profile, size, compact = false }: TasteRadarProps) {
  const s = size ?? (compact ? 100 : 240);
  const cx = s / 2;
  const cy = s / 2;
  // Reserve space for labels in full mode
  const radius = compact ? s * 0.42 : s * 0.32;
  const labelRadius = radius + (compact ? 0 : 24);
  const dotR = compact ? 2 : 3;

  const traits = PROFILE_TRAITS;
  const n = traits.length;
  const angleStep = (2 * Math.PI) / n;
  // Start from top (−π/2)
  const startAngle = -Math.PI / 2;

  /** Get (x, y) for a trait index at a given normalized value (0–1). */
  function point(index: number, value: number): [number, number] {
    const angle = startAngle + index * angleStep;
    return [
      cx + radius * value * Math.cos(angle),
      cy + radius * value * Math.sin(angle),
    ];
  }

  /** Build a polygon path string for a given uniform value. */
  function ringPath(value: number): string {
    return traits
      .map((_, i) => {
        const [x, y] = point(i, value);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ') + ' Z';
  }

  // Profile polygon
  const profilePoints = traits.map((t, i) => point(i, profile.traits[t.key]));
  const profilePath =
    profilePoints
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
      .join(' ') + ' Z';

  const rings = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      style={{ display: 'block' }}
      aria-label="Taste profile radar chart"
    >
      {/* Concentric grid rings */}
      {rings.map((r) => (
        <path
          key={r}
          d={ringPath(r)}
          fill="none"
          stroke="#e0e0e0"
          strokeWidth={0.5}
        />
      ))}

      {/* Axis lines from center to each vertex */}
      {traits.map((_, i) => {
        const [x, y] = point(i, 1);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="#d0d0d0"
            strokeWidth={0.5}
          />
        );
      })}

      {/* Profile polygon */}
      <path
        d={profilePath}
        fill="rgba(196, 18, 47, 0.1)"
        stroke="#c4122f"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      {/* Vertex dots */}
      {profilePoints.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={dotR}
          fill="#c4122f"
        />
      ))}

      {/* Labels (full mode only) */}
      {!compact &&
        traits.map((t, i) => {
          const angle = startAngle + i * angleStep;
          const lx = cx + labelRadius * Math.cos(angle);
          const ly = cy + labelRadius * Math.sin(angle);

          // Text anchor based on position
          let anchor: 'start' | 'middle' | 'end' = 'middle';
          if (Math.cos(angle) > 0.3) anchor = 'start';
          else if (Math.cos(angle) < -0.3) anchor = 'end';

          // Vertical nudge for top/bottom labels
          let dy = '0.35em';
          if (Math.sin(angle) < -0.5) dy = '0em';
          else if (Math.sin(angle) > 0.5) dy = '0.7em';

          return (
            <text
              key={t.key}
              x={lx}
              y={ly}
              textAnchor={anchor}
              dy={dy}
              fontSize={11}
              fill="#555"
              style={{ userSelect: 'none' }}
            >
              {t.label}
            </text>
          );
        })}
    </svg>
  );
}
