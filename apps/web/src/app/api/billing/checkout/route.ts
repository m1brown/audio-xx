import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createCheckoutSession, stripeConfigured } from '@/product/billing';

/** Start Checkout for the one plan. Server-fixed price; hosted by Stripe. */
export async function POST() {
  const session = await getSession();
  const user = session?.user as { id?: string; email?: string } | undefined;
  if (!user?.id || !user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: 'Subscriptions are not yet available.' },
      { status: 503 },
    );
  }
  try {
    const url = await createCheckoutSession(prisma, user.id, user.email);
    return NextResponse.json({ url });
  } catch (err) {
    console.error('[billing] checkout failed:', err);
    return NextResponse.json({ error: 'Could not start checkout.' }, { status: 503 });
  }
}
