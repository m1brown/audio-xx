import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/session';

/**
 * Normalize a raw Prisma system (with nested components → component) into
 * the frontend SavedSystem shape. Keeps the API response consistent.
 */
function normalizeSystem(raw: {
  id: string;
  name: string;
  notes: string | null;
  location: string | null;
  room: string | null;
  primaryUse: string | null;
  tendencies: string | null;
  components: Array<{
    id: string;
    roleOverride: string | null;
    notes: string | null;
    component: {
      id: string;
      name: string;
      brand: string;
      category: string;
    };
  }>;
}) {
  return {
    id: raw.id,
    name: raw.name,
    notes: raw.notes,
    location: raw.location,
    room: raw.room,
    primaryUse: raw.primaryUse,
    tendencies: raw.tendencies,
    components: raw.components.map((sc) => ({
      id: sc.id,
      componentId: sc.component.id,
      name: sc.component.name,
      brand: sc.component.brand,
      category: sc.component.category,
      role: sc.roleOverride ?? null,
      notes: sc.notes,
    })),
  };
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const systems = await prisma.system.findMany({
    where: { userId },
    include: {
      components: {
        include: { component: { select: { id: true, name: true, brand: true, category: true } } },
        orderBy: { addedAt: 'asc' },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json(systems.map(normalizeSystem));
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  // Create the system record
  const system = await prisma.system.create({
    data: {
      userId,
      name: body.name,
      notes: body.notes || null,
      location: body.location || null,
      room: body.room || null,
      primaryUse: body.primaryUse || null,
      tendencies: body.tendencies || null,
    },
  });

  // Create component records and link them to the system
  const components: Array<{ name: string; brand: string; category: string; roleOverride?: string }> =
    body.components ?? [];

  for (const comp of components) {
    if (!comp.name || !comp.brand) continue;

    // Find or create the component record (user-submitted)
    let component = await prisma.component.findFirst({
      where: {
        name: { equals: comp.name, mode: 'insensitive' },
        brand: { equals: comp.brand, mode: 'insensitive' },
      },
    });

    if (!component) {
      component = await prisma.component.create({
        data: {
          name: comp.name,
          brand: comp.brand,
          category: comp.category || 'other',
          confidenceLevel: 'user',
          userSubmitted: true,
        },
      });
    }

    // Link to system
    await prisma.systemComponent.create({
      data: {
        systemId: system.id,
        componentId: component.id,
        roleOverride: comp.roleOverride || null,
        actionLog: JSON.stringify([{ action: 'added', timestamp: new Date().toISOString() }]),
      },
    });
  }

  // Re-fetch with full includes for consistent response
  const fullSystem = await prisma.system.findUnique({
    where: { id: system.id },
    include: {
      components: {
        include: { component: { select: { id: true, name: true, brand: true, category: true } } },
        orderBy: { addedAt: 'asc' },
      },
    },
  });

  return NextResponse.json(normalizeSystem(fullSystem!), { status: 201 });
}
