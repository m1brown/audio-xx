import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/session';

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  return NextResponse.json({
    ...profile,
    sourceTypes: JSON.parse(profile.sourceTypes),
    sensitivityFlags: JSON.parse(profile.sensitivityFlags),
    preferredTraits: JSON.parse(profile.preferredTraits),
    archetypes: JSON.parse(profile.archetypes),
  });
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.roomSize !== undefined) data.roomSize = body.roomSize;
  if (body.roomType !== undefined) data.roomType = body.roomType;
  if (body.listeningLevel !== undefined) data.listeningLevel = body.listeningLevel;
  if (body.sourceTypes !== undefined) data.sourceTypes = JSON.stringify(body.sourceTypes);
  if (body.sensitivityFlags !== undefined) data.sensitivityFlags = JSON.stringify(body.sensitivityFlags);
  if (body.preferredTraits !== undefined) data.preferredTraits = JSON.stringify(body.preferredTraits);
  if (body.archetypes !== undefined) data.archetypes = JSON.stringify(body.archetypes);
  if (body.notes !== undefined) data.notes = body.notes;

  const profile = await prisma.profile.update({
    where: { userId },
    data,
  });

  return NextResponse.json(profile);
}
