import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/session';

/** Qualitative value to numeric mapping */
const QUAL_MAP: Record<string, number> = {
  strong: 1.0,
  moderate: 0.7,
  slight: 0.4,
  neutral: 0.0,
  'slight-risk': -0.3,
  'moderate-risk': -0.6,
};

function qualToNum(val: string): number {
  return QUAL_MAP[val] ?? 0;
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { systemId, candidateComponentId } = body;

    if (!systemId || !candidateComponentId) {
      return NextResponse.json({ error: 'systemId and candidateComponentId required' }, { status: 400 });
    }

    const system = await prisma.system.findFirst({
      where: { id: systemId, userId },
      include: { components: { include: { component: true } } },
    });
    if (!system) return NextResponse.json({ error: 'System not found' }, { status: 404 });

    const candidate = await prisma.component.findUnique({ where: { id: candidateComponentId } });
    if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

    let candidateTraits: Record<string, string> = {};
    let candidateRisks: string[] = [];
    try { candidateTraits = JSON.parse(candidate.traitTendencies); } catch { /* malformed */ }
    try { candidateRisks = JSON.parse(candidate.riskFlags); } catch { /* malformed */ }

    // Find existing component in same category
    const existingInCategory = system.components.find(
      (sc) => sc.component.category === candidate.category
    );

    const traitMovement: Record<string, { from: string; to: string; direction: string }> = {};
    const regressionRisks: string[] = [];

    if (existingInCategory) {
      let existingTraits: Record<string, string> = {};
      try { existingTraits = JSON.parse(existingInCategory.component.traitTendencies); } catch { /* malformed */ }

      // Compare traits
      const allTraits = new Set([...Object.keys(existingTraits), ...Object.keys(candidateTraits)]);
      for (const trait of allTraits) {
        const fromVal = existingTraits[trait] || 'neutral';
        const toVal = candidateTraits[trait] || 'neutral';
        if (fromVal !== toVal) {
          const fromNum = qualToNum(fromVal);
          const toNum = qualToNum(toVal);
          const direction = toNum > fromNum ? 'improved' : toNum < fromNum ? 'reduced' : 'unchanged';
          traitMovement[trait] = { from: fromVal, to: toVal, direction };

          // Flag regressions on positive traits
          if (direction === 'reduced' && fromNum > 0) {
            regressionRisks.push(
              `${trait}: moves from ${fromVal} to ${toVal} — risk of losing existing strength`
            );
          }
        }
      }
    }

    // Determine verdict
    let verdict = 'proceed_with_caution';
    if (regressionRisks.length === 0 && Object.keys(traitMovement).length > 0) {
      verdict = 'proceed';
    } else if (regressionRisks.length > 2) {
      verdict = 'pass';
    }

    // Reference component check
    const isReference = candidate.isReference;
    const referenceNote = isReference
      ? 'This is a reference component. Some reference components may not be purchasable. This evaluation explains trait movement, not a purchase recommendation.'
      : null;

    return NextResponse.json({
      candidate: {
        id: candidate.id,
        name: candidate.name,
        brand: candidate.brand,
        category: candidate.category,
      },
      replacing: existingInCategory
        ? {
            id: existingInCategory.component.id,
            name: existingInCategory.component.name,
            brand: existingInCategory.component.brand,
          }
        : null,
      trait_movement: traitMovement,
      regression_risks: regressionRisks,
      candidate_risks: candidateRisks,
      verdict,
      reference_note: referenceNote,
    });
  } catch (err) {
    console.error('[api/evaluate/candidate] Database unavailable:', err);
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
