import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/session';

/**
 * My Systems item (MVP M2) — rename, edit notes, remove.
 * Snapshots are immutable and are never editable through any route;
 * deleting a system cascades its snapshots (the user's own choice).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  try {
    const owned = await prisma.system.findFirst({ where: { id, userId } });
    if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const data: { name?: string; notes?: string | null } = {};
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 120);
    if (typeof body.notes === 'string') data.notes = body.notes.trim() || null;
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
    }

    const updated = await prisma.system.update({ where: { id }, data });
    return NextResponse.json({ id: updated.id, name: updated.name, notes: updated.notes });
  } catch (err) {
    console.error('[my-systems] update failed:', err);
    return NextResponse.json({ error: 'Could not update the system.' }, { status: 503 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  try {
    const owned = await prisma.system.findFirst({ where: { id, userId } });
    if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await prisma.system.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[my-systems] delete failed:', err);
    return NextResponse.json({ error: 'Could not remove the system.' }, { status: 503 });
  }
}
