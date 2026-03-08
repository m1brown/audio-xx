import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/session';

const QUAL_MAP: Record<string, number> = {
  strong: 1.0, moderate: 0.7, slight: 0.4, neutral: 0.0,
  'slight-risk': -0.3, 'moderate-risk': -0.6,
};

function qualToNum(val: string): number {
  return QUAL_MAP[val] ?? 0;
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { systemAId, systemBId } = body;

  if (!systemAId || !systemBId) {
    return NextResponse.json({ error: 'systemAId and systemBId required' }, { status: 400 });
  }

  const [systemA, systemB] = await Promise.all([
    prisma.system.findFirst({
      where: { id: systemAId, userId },
      include: { components: { include: { component: true } } },
    }),
    prisma.system.findFirst({
      where: { id: systemBId, userId },
      include: { components: { include: { component: true } } },
    }),
  ]);

  if (!systemA || !systemB) {
    return NextResponse.json({ error: 'One or both systems not found' }, { status: 404 });
  }

  // Aggregate trait profiles for each system
  function aggregateTraits(components: Array<{ component: { traitTendencies: string } }>) {
    const totals: Record<string, number> = {};
    const counts: Record<string, number> = {};
    for (const sc of components) {
      const traits: Record<string, string> = JSON.parse(sc.component.traitTendencies);
      for (const [trait, val] of Object.entries(traits)) {
        totals[trait] = (totals[trait] || 0) + qualToNum(val);
        counts[trait] = (counts[trait] || 0) + 1;
      }
    }
    const averages: Record<string, number> = {};
    for (const trait of Object.keys(totals)) {
      averages[trait] = totals[trait] / counts[trait];
    }
    return averages;
  }

  const traitsA = aggregateTraits(systemA.components);
  const traitsB = aggregateTraits(systemB.components);

  const allTraits = new Set([...Object.keys(traitsA), ...Object.keys(traitsB)]);
  const traitComparison: Record<string, { systemA: number; systemB: number; delta: string }> = {};

  for (const trait of allTraits) {
    const a = traitsA[trait] || 0;
    const b = traitsB[trait] || 0;
    const diff = b - a;
    let delta = 'similar';
    if (diff > 0.2) delta = `${systemB.name} stronger`;
    else if (diff < -0.2) delta = `${systemA.name} stronger`;
    traitComparison[trait] = { systemA: a, systemB: b, delta };
  }

  // Component diffs
  const componentsA = new Set(systemA.components.map((sc) => sc.component.seedId || sc.component.id));
  const componentsB = new Set(systemB.components.map((sc) => sc.component.seedId || sc.component.id));

  const onlyInA = systemA.components
    .filter((sc) => !componentsB.has(sc.component.seedId || sc.component.id))
    .map((sc) => ({ name: sc.component.name, brand: sc.component.brand, category: sc.component.category }));

  const onlyInB = systemB.components
    .filter((sc) => !componentsA.has(sc.component.seedId || sc.component.id))
    .map((sc) => ({ name: sc.component.name, brand: sc.component.brand, category: sc.component.category }));

  // Generate trade-off explanation
  const tradeoffs: string[] = [];
  for (const [trait, comp] of Object.entries(traitComparison)) {
    if (comp.delta !== 'similar') {
      tradeoffs.push(`${trait}: ${comp.delta}`);
    }
  }

  return NextResponse.json({
    systemA: { id: systemA.id, name: systemA.name },
    systemB: { id: systemB.id, name: systemB.name },
    trait_comparison: traitComparison,
    component_diffs: { only_in_a: onlyInA, only_in_b: onlyInB },
    tradeoffs,
    note: 'Trait comparisons are qualitative summaries based on known component tendencies. They describe likely audible differences, not objective rankings.',
  });
}
