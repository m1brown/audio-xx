import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/session';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const system = await prisma.system.updateMany({
    where: { id, userId },
    data: {
      name: body.name,
      notes: body.notes,
    },
  });

  if (system.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await prisma.system.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}
