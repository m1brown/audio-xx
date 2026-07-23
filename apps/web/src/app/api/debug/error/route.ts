import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

/**
 * Controlled error trigger for monitoring verification (MVP M5).
 * Fires ONLY when DEBUG_ERROR_TOKEN is configured and matches — it is a
 * no-op 404 otherwise, so it cannot be used to spam the error tracker.
 * Used once per environment to confirm Sentry capture end-to-end.
 */
export async function GET(req: NextRequest) {
  const token = process.env.DEBUG_ERROR_TOKEN;
  if (!token || req.nextUrl.searchParams.get('token') !== token) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const err = new Error('Audio XX controlled monitoring test error');
  Sentry.captureException(err);
  await Sentry.flush(2000);
  return NextResponse.json({ captured: true });
}
