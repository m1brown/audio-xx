import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/session';

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Auto-create profile if it doesn't exist (first authenticated access).
  const profile = await prisma.profile.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  return NextResponse.json({
    ...profile,
    sourceTypes: JSON.parse(profile.sourceTypes),
    sensitivityFlags: JSON.parse(profile.sensitivityFlags),
    preferredTraits: JSON.parse(profile.preferredTraits),
    archetypes: JSON.parse(profile.archetypes),
    musicGenres: JSON.parse(profile.musicGenres),
    activeSystemId: profile.activeSystemId ?? null,
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

  // activeSystemId: accept string | null to set or clear.
  if (body.activeSystemId !== undefined) {
    if (body.activeSystemId === null) {
      data.activeSystemId = null;
    } else if (typeof body.activeSystemId === 'string') {
      // Validate the system exists and belongs to this user before setting.
      const system = await prisma.system.findFirst({
        where: { id: body.activeSystemId, userId },
        select: { id: true },
      });
      if (!system) {
        return NextResponse.json(
          { error: 'System not found or does not belong to this user' },
          { status: 400 },
        );
      }
      data.activeSystemId = body.activeSystemId;
    }
  }

  // Upsert so that PATCH works even if profile doesn't exist yet.
  const profile = await prisma.profile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  return NextResponse.json({
    ...profile,
    sourceTypes: JSON.parse(profile.sourceTypes),
    sensitivityFlags: JSON.parse(profile.sensitivityFlags),
    preferredTraits: JSON.parse(profile.preferredTraits),
    archetypes: JSON.parse(profile.archetypes),
    musicGenres: JSON.parse(profile.musicGenres),
    activeSystemId: profile.activeSystemId ?? null,
  });
}
