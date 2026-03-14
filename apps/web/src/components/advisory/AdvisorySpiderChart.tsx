/**
 * Audio XX — Listener Taste Spider Chart
 *
 * Lightweight SVG radar/spider chart for listener taste profile visualization.
 * No external charting library required — renders pure SVG.
 *
 * Designed to integrate naturally within the reading flow —
 * centered, appropriately sized (300px), not oversized.
 *
 * Displays 7 sonic trait dimensions on a radar plot:
 *   Tonal Density, Transient Speed, Harmonic Richness,
 *   Micro-detail, Rhythmic Drive, Composure, Spatial Scale
 *
 * Colors: #a89870 accent palette — matches Audio XX visual identity.
 */

interface SpiderChartProps {
  data: Array<{ trait: string; value: number; fullMark: number }>;
}

const SIZE = 300;
const CENTER = SIZE / 2;
const RADIUS = 112;
const LABEL_OFFSET = 24;
const RINGS = 4;

/** Calculate point on the radar for a given axis index and radius. */
function polarToCartesian(index: number, total: number, radius: number): { x: number; y: number } {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  return {
    x: CENTER + radius * Math.cos(angle),
    y: CENTER + radius * Math.sin(angle),
  };
}

/** Build SVG polygon points string from data values. */
function dataToPolygon(data: SpiderChartProps['data']): string {
  return data
    .map((d, i) => {
      const r = (d.value / d.fullMark) * RADIUS;
      const pt = polarToCartesian(i, data.length, r);
      return `${pt.x},${pt.y}`;
    })
    .join(' ');
}

export default function AdvisorySpiderChart({ data }: SpiderChartProps) {
  if (!data || data.length < 3) return null;

  const n = data.length;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '0.75rem 0 1rem 0' }}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        style={{ overflow: 'visible', maxWidth: '100%' }}
      >
        {/* Background rings */}
        {Array.from({ length: RINGS }, (_, ring) => {
          const r = (RADIUS * (ring + 1)) / RINGS;
          const points = Array.from({ length: n }, (_, i) => {
            const pt = polarToCartesian(i, n, r);
            return `${pt.x},${pt.y}`;
          }).join(' ');
          return (
            <polygon
              key={`ring-${ring}`}
              points={points}
              fill="none"
              stroke={ring === RINGS - 1 ? '#ddd' : '#eee'}
              strokeWidth={ring === RINGS - 1 ? 1 : 0.5}
            />
          );
        })}

        {/* Axis lines from center to each vertex */}
        {data.map((_, i) => {
          const pt = polarToCartesian(i, n, RADIUS);
          return (
            <line
              key={`axis-${i}`}
              x1={CENTER}
              y1={CENTER}
              x2={pt.x}
              y2={pt.y}
              stroke="#eee"
              strokeWidth={0.5}
            />
          );
        })}

        {/* Data polygon — filled area */}
        <polygon
          points={dataToPolygon(data)}
          fill="rgba(168, 152, 112, 0.15)"
          stroke="#a89870"
          strokeWidth={1.8}
          strokeLinejoin="round"
        />

        {/* Data points */}
        {data.map((d, i) => {
          const r = (d.value / d.fullMark) * RADIUS;
          const pt = polarToCartesian(i, n, r);
          return (
            <circle
              key={`point-${i}`}
              cx={pt.x}
              cy={pt.y}
              r={3.5}
              fill="#a89870"
              stroke="#fff"
              strokeWidth={1.5}
            />
          );
        })}

        {/* Labels */}
        {data.map((d, i) => {
          const pt = polarToCartesian(i, n, RADIUS + LABEL_OFFSET);
          const angle = (360 * i) / n - 90;
          const normalizedAngle = ((angle % 360) + 360) % 360;
          let textAnchor: 'start' | 'middle' | 'end' = 'middle';
          if (normalizedAngle > 20 && normalizedAngle < 160) textAnchor = 'start';
          if (normalizedAngle > 200 && normalizedAngle < 340) textAnchor = 'end';

          return (
            <text
              key={`label-${i}`}
              x={pt.x}
              y={pt.y}
              textAnchor={textAnchor}
              dominantBaseline="central"
              style={{
                fontSize: '10.5px',
                fill: '#888',
                fontFamily: 'inherit',
                fontWeight: 500,
              }}
            >
              {d.trait}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
