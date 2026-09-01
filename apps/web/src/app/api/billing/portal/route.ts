import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/session';
import { createPortalSession, stripeConfigured } from '@/product/billing';

/** Stripe-hosted billing portal — cancel anytime lives here. */
export async function POST() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!stripeConfigured()) {
    return NextResponse.json({ error: 'Billing is not yet available.' }, { status: 503 });
  }
  try {
    const url = await createPortalSession(prisma, userId);
    if (!url) return NextResponse.json({ error: 'No subscription to manage.' }, { status: 404 });
    return NextResponse.json({ url });
  } catch (err) {
    console.error('[billing] portal failed:', err);
    return NextResponse.json({ error: 'Could not open billing management.' }, { status: 503 });
  }
}
