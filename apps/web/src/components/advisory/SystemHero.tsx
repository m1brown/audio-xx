'use client';

// React imported explicitly for vitest node-env JSX classic transform.
import React from 'react';

import AdvisorySpiderChart from './AdvisorySpiderChart';
import SystemChainBanner from './SystemChainBanner';

/**
 * Audio XX — System Hero block.
 *
 * Renders the §1 *Your System* visual anchor inside the System Assessment
 * Artifact. Composes two existing primitives:
 *   - `AdvisorySpiderChart` — radar visualization of the system's sonic
 *     traits (uses `spiderChartData`).
 *   - `SystemChainBanner` — arrow-separated chain of component names
 *     with role labels (uses `systemChain`).
 *
 * Layout: on desktop the chart sits at 1/2 width and the chain banner
 * spans full width below; on narrow viewports they stack. Pure flex
 * layout — no media queries required.
 *
 * Renders nothing when both `spiderChartData` and `systemChain` are
 * absent (graceful degradation matching the Brand Authority sparse
 * profile pattern).
 */

interface SystemHeroProps {
  spiderChartData?: Array<{ trait: string; value: number; fullMark: number }>;
  systemChain?: {
    names: string[];
    roles?: string[];
  };
}

export default function SystemHero({
  spiderChartData,
  systemChain,
}: SystemHeroProps) {
  const hasChart = !!(spiderChartData && spiderChartData.length > 0);
  const hasChain = !!(systemChain?.names && systemChain.names.length > 0);

  if (!hasChart && !hasChain) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {hasChart && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <AdvisorySpiderChart data={spiderChartData!} />
        </div>
      )}
      {hasChain && (
        <SystemChainBanner
          names={systemChain!.names}
          roles={systemChain!.roles}
        />
      )}
    </div>
  );
}
