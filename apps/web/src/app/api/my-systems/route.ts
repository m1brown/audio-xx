import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/session';
import { saveAssessment, listMySystems, SaveError } from '@/product/save-system';

/**
 * My Systems (MVP M2).
 *
 * POST — save the assessment for a canonical system text. Recomputes the
 * assessment server-side and stores an immutable snapshot; saving the
 * same canonical text again appends a snapshot to the existing system
 * instead of duplicating it.
 *
 * GET — the user's collection, newest first, with latest-snapshot
 * summaries (chain, verdict, assessment date, engine version).
 */
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const result = await saveAssessment(prisma, userId, {
      systemText: typeof body.systemText === 'string' ? body.systemText : '',
      name: typeof body.name === 'string' ? body.name : undefined,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
    });
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (err) {
    if (err instanceof SaveError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[my-systems] save failed:', err);
    return NextResponse.json({ error: 'Could not save the system.' }, { status: 503 });
  }
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const systems = await listMySystems(prisma, userId);
    return NextResponse.json({ systems });
  } catch (err) {
    console.error('[my-systems] list failed:', err);
    return NextResponse.json({ error: 'Could not load your systems.' }, { status: 503 });
  }
}
