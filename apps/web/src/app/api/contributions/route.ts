/**
 * API route: /api/contributions — Suggested Edits Slice 1 (capture only).
 *
 * Accepts a signed-in user's suggestion and stores it as an inert pending
 * record. TRUST BOUNDARY: this route writes ONLY to ContributionV1. It
 * never touches catalog facts, evidence stores, product identity, saved
 * systems, or anything the reasoning lane reads — admission to governed
 * evidence is a future slice with its own review authority.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  validateContributionInput, writeContribution, recentContributionCount,
  type ContributionInput,
} from '@/lib/contributions/contribution-store';

const HOURLY_LIMIT = 5;

export async function POST(req: NextRequest) {
  const session = await getSession();
  const email = (session?.user as { email?: string } | undefined)?.email?.toLowerCase();
  if (!email) {
    return NextResponse.json({ error: 'sign in to suggest an edit' }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }

  const invalid = validateContributionInput(body);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  if ((await recentContributionCount(email)) >= HOURLY_LIMIT) {
    return NextResponse.json(
      { error: 'you have several suggestions in review already — thank you; please try again later' },
      { status: 429 },
    );
  }

  const b = body as Record<string, string>;
  const result = await writeContribution(email, {
    surface: b.surface,
    productKey: b.productKey || undefined,
    productName: b.productName || undefined,
    typedProduct: b.typedProduct || undefined,
    evidenceRef: b.evidenceRef || undefined,
    reason: b.reason as ContributionInput['reason'],
    text: b.text,
    sourceUrl: b.sourceUrl || undefined,
  });
  if (!result.ok) return NextResponse.json({ error: 'could not save your suggestion' }, { status: 503 });

  console.warn('[contributions] captured surface=%s reason=%s known=%s sourced=%s',
    b.surface, b.reason, b.productKey ? 'yes' : 'no', b.sourceUrl ? 'yes' : 'no');
  return NextResponse.json({ ok: true });
}
