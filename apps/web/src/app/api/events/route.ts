/**
 * API route: /api/events
 *
 * Minimal validation-telemetry sink for the first 50-user cohort
 * (Workstream 25B). Receives a single structured event from the client
 * and writes it to the server log as a `[AXX-EVENT]` line. No database,
 * no third-party analytics dependency — events are read back from the
 * deploy's stdout/log stream (e.g. `vercel logs` or local dev console)
 * and grepped for `AXX-EVENT`.
 *
 * This is deliberately the smallest durable capture that answers the
 * validation questions (decision-intent / assessment-completed /
 * feedback / return / unknown-product). It is NOT a general analytics
 * platform and should be replaced once the cohort proves the behaviors
 * worth instrumenting properly.
 *
 * Accepts: { event: string, props?: Record<string, unknown>, ts?: number }
 * Returns: 204 No Content (fire-and-forget). Never throws to the client;
 * a telemetry failure must never break a user session.
 */

import { NextRequest, NextResponse } from 'next/server';

/** Allowlisted validation events. Anything else is logged as 'other'. */
const KNOWN_EVENTS = new Set([
  'decision_intent_entry',
  'assessment_completed',
  'feedback_submitted',
  'return_visit',
  'return_visit_new_decision',
  'unknown_product',
]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawEvent = typeof body?.event === 'string' ? body.event : 'unknown';
    const event = KNOWN_EVENTS.has(rawEvent) ? rawEvent : `other:${rawEvent}`;
    const props =
      body && typeof body.props === 'object' && body.props !== null
        ? body.props
        : {};

    // Single-line structured record. Grep the deploy logs for AXX-EVENT.
    // eslint-disable-next-line no-console
    console.log(
      `[AXX-EVENT] ${JSON.stringify({
        event,
        props,
        ts: typeof body?.ts === 'number' ? body.ts : null,
        ua: req.headers.get('user-agent') ?? null,
      })}`,
    );
  } catch {
    // Telemetry must never surface an error to the user session.
  }
  return new NextResponse(null, { status: 204 });
}
