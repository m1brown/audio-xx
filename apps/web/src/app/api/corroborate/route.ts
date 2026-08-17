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
  evaluateCorroboration,
  isMalformedRejection,
  normalizeProductName,
  type CorroborationRecord,
} from '@/lib/entity-corroboration';
import { readCached, writeCached, readAnyPositive, getStoreDiagnostics }
  from '@/lib/corroboration-store';

/**
 * The retry exists for ONE failure class: a lookup that did not complete
 * usefully. Production returned a `sourceUrl` of
 * "https://www.acoraacoustics.com/ (via indication of QRC-2 on their site)" —
 * a real address with commentary glued on — and the strict URL parse correctly
 * rejected it. Rejecting it was right; recording it as "this loudspeaker could
 * not be identified" was not.
 *
 * A genuine `uncorroborated` is NEVER retried. Retrying a completed finding
 * until it changes its mind is how a verification gate turns into a slot
 * machine, and the acceptance policy is deliberately frozen.
 */
const TIMEOUT_MS = 9000;
const RETRY_TIMEOUT_MS = 7000;   // 16s worst case, inside the caller's 25s budget
const MAX_ATTEMPTS = 2;

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
- Listeners abbreviate. "ARC" is Audio Research, "PS Audio" is not "PS", and a
  model may be written loosely ("ref 5" for "Reference 5"). Resolve the
  abbreviation and search for the full manufacturer and model before deciding
  the product does not exist. Report the manufacturer's own designation in
  canonicalName.
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

  /**
   * Infrastructure outcome. Never written to the cache, never evidence.
   *
   * Before reporting it, an earlier positive is honoured regardless of age:
   * a product verified against its manufacturer does not become
   * unidentifiable because today's request timed out.
   */
  const lookupUnknown = async (detail: string): Promise<NextResponse> => {
    if (normalizedName) {
      const prior = await readAnyPositive(normalizedName);
      if (prior) {
        console.warn('[corroborate] %s -> lookup failed (%s), serving prior corroboration',
          normalizedName, detail);
        return NextResponse.json({
          ...prior, cached: true, cacheTier: 'stale_positive',
          store: getStoreDiagnostics().state,
        });
      }
    }
    console.warn('[corroborate] %s -> lookup_unknown (%dms) %s',
      normalizedName || '(empty)', Date.now() - started, detail);
    return NextResponse.json({
      normalizedName, status: 'lookup_unknown' as const, checkedAt: Date.now(), detail,
      store: getStoreDiagnostics().state,
    });
  };

  if (!normalizedName) return lookupUnknown('empty name');

  const cached = await readCached(normalizedName, Date.now());
  if (cached) {
    return NextResponse.json({
      ...cached.record, cached: true, cacheTier: cached.tier,
      store: getStoreDiagnostics().state,
    });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) return lookupUnknown('no api key');

  let lastDetail = 'unknown';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const budget = attempt === 1 ? TIMEOUT_MS : RETRY_TIMEOUT_MS;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), budget);
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
        lastDetail = `upstream ${res.status}`;
        continue;   // transport failure — retryable
      }

      const data = await res.json();
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
        lastDetail = 'unparseable reply';
        continue;   // defective response — retryable
      }

      const verdict = evaluateCorroboration(name, parsed as never);

      // A malformed source is a defect in the REPLY. On the first attempt it
      // earns a retry; on the last it is still not evidence about the product.
      if (!verdict.accepted && isMalformedRejection(verdict.reason)) {
        lastDetail = `malformed source (${verdict.reason})`;
        continue;
      }

      const record: CorroborationRecord = {
        normalizedName,
        status: verdict.accepted ? 'corroborated' : 'uncorroborated',
        checkedAt: Date.now(),
        ...(verdict.accepted
          ? {
            canonicalName: typeof parsed.canonicalName === 'string' ? parsed.canonicalName : undefined,
            brand: typeof parsed.brand === 'string' ? parsed.brand : undefined,
            sourceUrl: typeof parsed.sourceUrl === 'string' ? parsed.sourceUrl : undefined,
            sourceKind: parsed.sourceKind as CorroborationRecord['sourceKind'],
            matchQuality: typeof parsed.matchQuality === 'number' ? parsed.matchQuality : undefined,
          }
          : {}),
      };

      console.log('[corroborate] %s -> %s (%dms, attempt %d) %s',
        normalizedName, record.status, Date.now() - started, attempt,
        verdict.accepted ? record.sourceUrl : `rejected:${verdict.reason}`);

      await writeCached(record);
      return NextResponse.json({
        ...record, attempts: attempt, cacheTier: 'live',
        store: getStoreDiagnostics().state,
      });
    } catch (err) {
      lastDetail = String(err).slice(0, 120);
      // Abort/network — retryable.
    }
  }

  return lookupUnknown(`${lastDetail} after ${MAX_ATTEMPTS} attempts`);
}
