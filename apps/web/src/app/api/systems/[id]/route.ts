import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/session';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const system = await prisma.system.findFirst({
      where: { id, userId },
      include: {
        components: {
          include: { component: true },
          orderBy: { addedAt: 'asc' },
        },
        snapshots: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!system) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(system);
  } catch (err) {
    console.error('[api/systems/[id]] Database unavailable:', err);
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json();

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.location !== undefined) data.location = body.location;
    if (body.room !== undefined) data.room = body.room;
    if (body.primaryUse !== undefined) data.primaryUse = body.primaryUse;
    if (body.tendencies !== undefined) data.tendencies = body.tendencies;

    const result = await prisma.system.updateMany({
      where: { id, userId },
      data,
    });

    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/systems/[id]] Database unavailable:', err);
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;

    // If this was the user's active system, clear the reference.
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { activeSystemId: true },
    });
    if (profile?.activeSystemId === id) {
      await prisma.profile.update({
        where: { userId },
        data: { activeSystemId: null },
      });
    }

    await prisma.system.deleteMany({ where: { id, userId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/systems/[id]] Database unavailable:', err);
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
