import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStripe, applyStripeEvent } from '@/product/billing';
import { trackServer } from '@/product/analytics-server';

/**
 * Stripe webhook (MVP M5).
 *
 * Signature-verified against STRIPE_WEBHOOK_SECRET; unverifiable
 * payloads are rejected with 400 and never touch the database.
 * Idempotent (event-id ledger) and out-of-order-safe (event.created
 * vs lastEventAt) — see product/billing.ts.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const payload = await req.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    const outcome = await applyStripeEvent(prisma, event);
    if (outcome.handled) {
      if (event.type === 'checkout.session.completed') {
        trackServer('subscription_activated');
      }
      if (event.type === 'customer.subscription.deleted') {
        trackServer('subscription_cancelled');
      }
    }
    return NextResponse.json({ received: true, ...outcome });
  } catch (err) {
    console.error('[billing] webhook processing failed:', err);
    // 500 → Stripe retries; the idempotency ledger makes retries safe.
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
