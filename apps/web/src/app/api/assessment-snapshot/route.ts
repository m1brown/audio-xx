/**
 * Assessment snapshot API.
 *
 *   POST  { snapshot }              -> { viewToken }   create (never public)
 *   POST  { viewToken, action:'share' } -> { shareToken }  explicit Share
 *
 * Two separate actions on purpose. View and Print call CREATE and stop there;
 * only Share mints public access. Printing must never alter access state, so
 * there is no code path from the print flow to `share()`.
 *
 * No authentication required. An anonymous listener may create, view and print
 * an assessment they were just shown; requiring an account to print a page
 * would put a wall in front of the sharing loop for no privacy gain, since the
 * snapshot holds only resolved assessment output — never conversation history,
 * listener profile or account state.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSnapshot, share } from '@/product/assessment-snapshot';
import { prismaSnapshotPort } from '@/product/snapshot-port-prisma';
import { parseSnapshot, freezeSnapshot } from '@/lib/artifact/snapshot';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_request' }, { status: 400 }); }

  // ── explicit Share ────────────────────────────────────────────────
  if (body.action === 'share') {
    const viewToken = typeof body.viewToken === 'string' ? body.viewToken : '';
    if (!viewToken) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    const result = await share(prismaSnapshotPort, viewToken);
    if (!result) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json(result);
  }

  // ── create (private) ──────────────────────────────────────────────
  // Re-parsed through the schema gate rather than trusted: the client posts
  // what it was shown, and a snapshot whose shape we do not recognise is one
  // we cannot faithfully display later.
  const snapshot = parseSnapshot(
    typeof body.snapshot === 'string' ? body.snapshot : freezeSnapshot(body.snapshot as never));
  if (!snapshot) return NextResponse.json({ error: 'unrecognised_schema' }, { status: 422 });

  let userId: string | null = null;
  try {
    const session = await getServerSession(authOptions);
    userId = (session?.user as { id?: string } | undefined)?.id ?? null;
  } catch { userId = null; }

  try {
    const created = await createSnapshot(prismaSnapshotPort, snapshot, {
      userId,
      systemId: typeof body.systemId === 'string' ? body.systemId : null,
    });
    return NextResponse.json(created);
  } catch {
    // The site must work without a database.
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
}
