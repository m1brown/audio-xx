/**
 * API route: /api/memo-overlay/drift
 *
 * Development-only endpoint to inspect the LLM overlay drift log.
 * Returns recent log entries and summary statistics.
 *
 * GET /api/memo-overlay/drift         — summary + last 20 entries
 * GET /api/memo-overlay/drift?limit=50 — summary + last 50 entries
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDriftLog, getDriftSummary } from '@/lib/memo-render-log';

export async function GET(req: NextRequest) {
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10);

  return NextResponse.json({
    summary: getDriftSummary(),
    entries: getDriftLog(Math.min(limit, 100)),
  });
}
