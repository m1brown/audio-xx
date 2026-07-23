import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/session';
import { getEntitlement } from '@/product/entitlement';
import { syncFromCheckoutSession, stripeConfigured } from '@/product/billing';

/**
 * Entitlement status for the signed-in user (MVP M5).
 *
 * `?session_id=` (checkout return) triggers a direct, server-verified
 * sync so a successful subscriber is active immediately even if the
 * webhook is lagging. The session must belong to this user.
 */
export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sessionId = req.nextUrl.searchParams.get('session_id');
  let synced = false;
  if (sessionId && stripeConfigured()) {
    try {
      synced = await syncFromCheckoutSession(prisma, userId, sessionId);
    } catch (err) {
      console.warn('[billing] checkout-return sync failed (webhook will cover):', err);
    }
  }

  try {
    const entitlement = await getEntitlement(prisma, userId);
    if (!entitlement) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ entitlement, synced, billingAvailable: stripeConfigured() });
  } catch (err) {
    console.error('[billing] status failed:', err);
    // State 10: billing state temporarily unavailable — the client shows
    // a neutral message and never blocks reading the collection.
    return NextResponse.json({ error: 'Status unavailable' }, { status: 503 });
  }
}
