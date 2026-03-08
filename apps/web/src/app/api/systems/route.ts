import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/session';

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const systems = await prisma.system.findMany({
    where: { userId },
    include: { components: { include: { component: true } } },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json(systems);
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const system = await prisma.system.create({
    data: {
      userId,
      name: body.name,
      notes: body.notes || null,
    },
  });

  return NextResponse.json(system, { status: 201 });
}
