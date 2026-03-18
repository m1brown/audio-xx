import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/session';
import { evaluateText } from '@/lib/engine';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { systemId, inputText, text, mode } = body;

  // Support both {inputText} and {text} for homepage compatibility
  const input = inputText || text;
  if (!input) {
    return NextResponse.json({ error: 'inputText or text required' }, { status: 400 });
  }

  // Load archetypes from profile if authenticated
  // Wrapped in try/catch so the engine still works when the database is
  // unavailable (e.g. SQLite on serverless where the file is ephemeral).
  let archetypes: string[] = [];
  let userId: string | null = null;
  try {
    userId = await getUserId();
    if (userId) {
      const profile = await prisma.profile.findUnique({ where: { userId } });
      if (profile) archetypes = JSON.parse(profile.archetypes);
    }
  } catch {
    // Database unavailable — continue without profile data
  }

  // Run evaluation pipeline
  const { signals, result } = evaluateText(input, archetypes);

  // Save snapshot only if systemId is provided and user is authenticated
  let snapshotId: string | null = null;
  try {
    if (systemId && userId) {
      const system = await prisma.system.findFirst({ where: { id: systemId, userId } });
      if (system) {
        const snapshot = await prisma.preferenceSnapshot.create({
          data: {
            systemId,
            inputText: input,
            extractedSignals: JSON.stringify(signals),
            firedRules: JSON.stringify(result.fired_rules.map((r) => r.id)),
            output: JSON.stringify(result),
          },
        });
        snapshotId = snapshot.id;
      }
    }
  } catch {
    // Database unavailable — skip snapshot persistence
  }

  return NextResponse.json({
    snapshotId,
    signals,
    result,
  });
}
