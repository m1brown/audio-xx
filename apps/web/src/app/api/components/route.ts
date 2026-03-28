import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/session';

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const search = req.nextUrl.searchParams.get('q') || '';
    const category = req.nextUrl.searchParams.get('category');

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { brand: { contains: search } },
      ];
    }
    if (category) {
      where.category = category;
    }

    const components = await prisma.component.findMany({
      where,
      orderBy: { brand: 'asc' },
    });

    return NextResponse.json(components);
  } catch (err) {
    console.error('[api/components] Database unavailable:', err);
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();

    const component = await prisma.component.create({
      data: {
        name: body.name,
        brand: body.brand,
        category: body.category,
        confidenceLevel: body.confidence_level || 'low',
        traitTendencies: JSON.stringify(body.trait_tendencies || {}),
        riskFlags: JSON.stringify(body.risk_flags || []),
        trustedRefs: JSON.stringify([]),
        reviews: JSON.stringify([]),
        isReference: false,
        userSubmitted: true,
      },
    });

    return NextResponse.json(component, { status: 201 });
  } catch (err) {
    console.error('[api/components] Database unavailable:', err);
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
