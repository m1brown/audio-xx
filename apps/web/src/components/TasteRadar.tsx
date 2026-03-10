'use client';

import { PROFILE_TRAITS, isProfileEmpty, type TasteProfile } from '@/lib/taste-profile';

interface TasteRadarProps {
  profile: TasteProfile;
  /** Overall SVG size in px. Default 240 (full) or 100 (compact). */
  size?: number;
  /** Compact mode: hides labels, smaller dots. */
  compact?: boolean;
  /** Miniature mode: even smaller, suitable for nav/header (32–48px). */
  miniature?: boolean;
}

/**
 * Pure SVG radar chart for 7 taste-profile traits.
 *
 * Three rendering modes:
 *   - Full (default): 240px, labels, grid, colored dots + polygon
 *   - Compact: 100px, no labels, colored dots + polygon
 *   - Miniature: 32–48px, colored dots + polygon only, very clean
 *
 * Empty profile: dashed heptagon outline with hollow colored circles.
 * Per-trait colors from PROFILE_TRAITS.color.
 */
export default function TasteRadar({
  profile,
  size,
  compact = false,
  miniature = false,
}: TasteRadarProps) {
  const isCompact = compact || miniature;
  const s = size ?? (miniature ? 32 : compact ? 100 : 240);
  const cx = s / 2;
  const cy = s / 2;

  // Reserve space for labels in full mode
  const radius = isCompact ? s * 0.42 : s * 0.32;
  const labelRadius = radius + 28;
  const dotR = miniature ? 1.5 : compact ? 2 : 3;

  const traits = PROFILE_TRAITS;
  const n = traits.length;
  const angleStep = (2 * Math.PI) / n;
  // Start from top (−π/2)
  const startAngle = -Math.PI / 2;
  const empty = isProfileEmpty(profile);

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

  // Outer ring points (for empty state)
  const outerPoints = traits.map((_, i) => point(i, 1));

  const rings = [0.25, 0.5, 0.75, 1.0];
  const showGrid = !isCompact;
  const showLabels = !isCompact;

  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      style={{ display: 'block', overflow: 'visible' }}
      aria-label="Taste profile radar chart"
    >
      {/* Concentric grid rings (full mode only) */}
      {showGrid &&
        rings.map((r) => (
          <path
            key={r}
            d={ringPath(r)}
            fill="none"
            stroke="#e0e0e0"
            strokeWidth={0.5}
          />
        ))}

      {/* Axis lines from center to each vertex */}
      {showGrid &&
        traits.map((t, i) => {
          const [x, y] = point(i, 1);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke={t.color}
              strokeWidth={0.5}
              strokeOpacity={0.3}
            />
          );
        })}

      {/* Empty state: dashed outer heptagon */}
      {empty && (
        <path
          d={ringPath(1)}
          fill="none"
          stroke="#ccc"
          strokeWidth={miniature ? 0.5 : 1}
          strokeDasharray={miniature ? '2 2' : '4 3'}
        />
      )}

      {/* Profile polygon (only when non-empty) */}
      {!empty && (
        <path
          d={profilePath}
          fill="rgba(160, 160, 160, 0.08)"
          stroke="rgba(100, 100, 100, 0.4)"
          strokeWidth={miniature ? 0.5 : compact ? 1 : 1.5}
          strokeLinejoin="round"
        />
      )}

      {/* Vertex dots — colored per trait */}
      {empty
        ? /* Hollow colored circles for empty state */
          outerPoints.map(([x, y], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={dotR}
              fill="none"
              stroke={traits[i].color}
              strokeWidth={miniature ? 0.5 : 1}
            />
          ))
        : /* Filled colored dots for active profile */
          profilePoints.map(([x, y], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={dotR}
              fill={traits[i].color}
            />
          ))}

      {/* Labels (full mode only) */}
      {showLabels &&
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
          if (Math.sin(angle) < -0.5) dy = '-0.1em';
          else if (Math.sin(angle) > 0.5) dy = '0.8em';

          return (
            <text
              key={t.key}
              x={lx}
              y={ly}
              textAnchor={anchor}
              dy={dy}
              fontSize={11}
              fill={t.color}
              fontWeight={500}
              style={{ userSelect: 'none' }}
            >
              {t.label}
            </text>
          );
        })}
    </svg>
  );
}
