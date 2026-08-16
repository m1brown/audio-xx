/**
 * API route: /api/corroborate
 *
 * Entity corroboration — answers ONE question about a listener-supplied
 * product name: does this product actually exist?
 *
 * Audio XX cannot curate every legitimate audio product and should not have to
 * before it can discuss one. Expanded Reasoning supplies that breadth, but a
 * model may not grant ITSELF permission to use model knowledge — on identical
 * input the fictional "Qwibble Q1" alternated between correctly unknown and
 * confidently characterised. This route supplies the independent signal.
 *
 * HARD SCOPE. Nothing but identity crosses this boundary:
 *   - no sonic character, no design prose, no reviews
 *   - no specifications, no prices, no recommendations
 * The response shape below is the entire contract. Acceptance is decided by
 * `isCorroborationAcceptable`, not by the model's say-so, and every failure
 * path — timeout, malformed reply, missing key, ambiguity — returns
 * 'unavailable', which the caller treats as user-supplied-only.
 *
 * Corroboration establishes IDENTITY, never QUALITY. A corroborated product is
 * eligible for Expanded Reasoning at its own labelled authority; this never
 * promotes a claim.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  isCorroborationAcceptable,
  normalizeProductName,
  isCacheFresh,
  type CorroborationRecord,
} from '@/lib/entity-corroboration';

const TIMEOUT_MS = 9000;

/**
 * Warm-instance cache. Corroboration is near-static — a product either exists
 * or it does not — so repeating the lookup for the same name is pure waste.
 * TTLs come from the frozen policy: positives long-lived but revalidatable,
 * negatives short because new gear appears, and 'unavailable' NEVER cached as
 * an answer. Durable Turso persistence is the next step; this already removes
 * the repeat cost within an instance.
 */
const cache = new Map<string, CorroborationRecord>();
const MODEL = process.env.OPENAI_SEARCH_MODEL ?? 'gpt-4o';

const INSTRUCTIONS = `You verify whether a named audio product exists. You are NOT reviewing it.

Search the web and find the manufacturer's own page for the product, if one exists.

Return ONLY this JSON, no prose, no markdown fences:
{
  "exists": true|false,
  "canonicalName": "the manufacturer's own designation, or null",
  "brand": "manufacturer name, or null",
  "sourceUrl": "URL of the page that identifies this product, or null",
  "sourceKind": "official"|"manufacturer"|"retailer"|"other",
  "sourceTitle": "title of that page, or null",
  "matchQuality": 0.0-1.0
}

Rules:
- "official"/"manufacturer" mean the maker's own site. A dealer, forum, review
  site or marketplace is "retailer" or "other".
- If you cannot find a page that names this specific product, return
  exists:false. Do NOT guess from the name's plausibility.
- Never include sonic description, specifications, price or opinion.`;

export async function POST(req: NextRequest) {
  const started = Date.now();
  let name = '';
  try {
    const body = await req.json().catch(() => ({}));
    name = typeof body?.name === 'string' ? body.name.slice(0, 120) : '';
  } catch { /* fall through */ }

  const normalizedName = normalizeProductName(name);
  const fail = (status: CorroborationRecord['status']): NextResponse =>
    NextResponse.json({ normalizedName, status, checkedAt: Date.now() });

  if (!normalizedName) return fail('unavailable');

  const cached = cache.get(normalizedName);
  if (cached && isCacheFresh(cached, Date.now())) {
    return NextResponse.json({ ...cached, cached: true });
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) return fail('unavailable');

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        tools: [{ type: 'web_search' }],
        instructions: INSTRUCTIONS,
        input: `Audio product: "${name}"`,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.warn('[corroborate] upstream %s: %s', res.status, detail.slice(0, 300));
      return fail('unavailable');
    }

    const data = await res.json();
    // The Responses API returns content across output items; take the text.
    const text: string =
      data.output_text
      ?? (Array.isArray(data.output)
        ? data.output
          .flatMap((o: { content?: Array<{ text?: string }> }) => o.content ?? [])
          .map((c: { text?: string }) => c.text ?? '')
          .join('')
        : '');

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text.trim().replace(/^```(?:json)?\s*/, '').replace(/```$/, ''));
    } catch {
      console.warn('[corroborate] unparseable reply for %s: %s', normalizedName, text.slice(0, 200));
      return fail('unavailable');
    }

    const accepted = isCorroborationAcceptable(name, parsed as never);
    const record: CorroborationRecord & { rejectedReason?: string } = {
      normalizedName,
      status: accepted ? 'corroborated' : 'uncorroborated',
      checkedAt: Date.now(),
      ...(accepted
        ? {
          canonicalName: typeof parsed.canonicalName === 'string' ? parsed.canonicalName : undefined,
          brand: typeof parsed.brand === 'string' ? parsed.brand : undefined,
          sourceUrl: typeof parsed.sourceUrl === 'string' ? parsed.sourceUrl : undefined,
          sourceKind: parsed.sourceKind as CorroborationRecord['sourceKind'],
          matchQuality: typeof parsed.matchQuality === 'number' ? parsed.matchQuality : undefined,
        }
        : {}),
    };

    console.log('[corroborate] %s -> %s (%dms) %s',
      normalizedName, record.status, Date.now() - started,
      accepted ? record.sourceUrl : `claimed:${String(parsed.sourceKind)}/${String(parsed.sourceUrl).slice(0, 60)}`);

    cache.set(normalizedName, record);
    return NextResponse.json(record);
  } catch (err) {
    console.warn('[corroborate] failed for %s: %s', normalizedName, String(err).slice(0, 200));
    return fail('unavailable');
  }
}
