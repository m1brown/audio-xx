import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/session';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: systemId } = await params;

  // Verify ownership
  const system = await prisma.system.findFirst({ where: { id: systemId, userId } });
  if (!system) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { componentId, roleOverride, notes } = body;

  const sc = await prisma.systemComponent.create({
    data: {
      systemId,
      componentId,
      roleOverride: roleOverride || null,
      notes: notes || null,
      actionLog: JSON.stringify([{ action: 'added', timestamp: new Date().toISOString() }]),
    },
    include: { component: true },
  });

  return NextResponse.json(sc, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: systemId } = await params;
  const system = await prisma.system.findFirst({ where: { id: systemId, userId } });
  if (!system) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { systemComponentId } = body;

  await prisma.systemComponent.delete({ where: { id: systemComponentId } });
  return NextResponse.json({ ok: true });
}
