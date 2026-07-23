/**
 * Server-side product events (MVP M5) — same canonical event names as
 * product/analytics.ts, for moments only the server can see (webhook
 * activations/cancellations, account auto-creation). Fire-and-forget:
 * analytics must never affect a request's outcome.
 */
import { track as vercelServerTrack } from '@vercel/analytics/server';

type ServerEvent =
  | 'account_created'
  | 'subscription_activated'
  | 'subscription_cancelled';

export function trackServer(event: ServerEvent, props?: Record<string, string | number | boolean>): void {
  try {
    void vercelServerTrack(event, props ?? {}).catch(() => {});
  } catch { /* never throw from analytics */ }
}
