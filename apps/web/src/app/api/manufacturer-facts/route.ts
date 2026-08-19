/**
 * API route: /api/manufacturer-facts
 *
 * Acquisition for the manufacturer evidence regime. SITE-LEVEL: it takes a
 * product identity and nothing else — no chain, no role, no listener, no
 * assessment. Anything that resolves a product identity may call it, and the
 * assessment path is one caller among several rather than its owner.
 *
 * HARD SCOPE, enforced by `isManufacturerFactAcceptable` rather than by
 * asking the model nicely: specification, construction and topology, each
 * with the manufacturer's own words attached. No sonic character, no quality,
 * no price, no recommendation. A maker's marketing about how their product
 * sounds is not a manufacturer fact.
 *
 * Same three-state discipline the corroboration layer earned:
 *
 *   facts          the lookup completed and returned admissible evidence
 *   none           the lookup COMPLETED and found no admissible facts
 *   lookup_unknown the lookup did not complete — timeout, upstream error,
 *                  unparseable reply. Never cached, retried once.
 *
 * A failed lookup is not evidence that a product has no published
 * specifications.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  isManufacturerFactAcceptable, toEvidenceItem, productKeyFor,
  MANUFACTURER_FACT_FIELDS, isManufacturerFactField,
} from '@/lib/evidence/manufacturer-facts';
import { readFacts, writeFacts, getFactStoreState } from '@/lib/evidence/manufacturer-fact-store';

const TIMEOUT_MS = 9000;
const RETRY_TIMEOUT_MS = 7000;
const MAX_ATTEMPTS = 2;
const MODEL = process.env.OPENAI_SEARCH_MODEL ?? 'gpt-4o';

const INSTRUCTIONS = `You read published specifications from a manufacturer's own website.

Search for the manufacturer's page for the named audio product and report ONLY
what THEY publish, quoting them.

Return ONLY this JSON, no prose, no markdown fences:
{
  "sourceUrl": "the manufacturer's page you read, or null",
  "facts": [
    { "field": "<one of the permitted fields>",
      "value": "the figure or description as published, units preserved",
      "quotedText": "the manufacturer's own sentence containing that value" }
  ]
}

Permitted fields, and NOTHING else: ${MANUFACTURER_FACT_FIELDS.join(', ')}.

Rules:
- The source must be the MANUFACTURER's own site. Not a dealer, review,
  forum or marketplace. If you cannot find their page, return an empty facts array.
- "quotedText" must be their actual sentence and must CONTAIN the value.
  If you cannot quote it, omit the fact.
- Specifications and construction ONLY. Never how the product sounds, never
  quality, never price, never comparisons, never awards. "8 ohms" is a fact;
  "effortless dynamics" is marketing and must be omitted even when the
  manufacturer writes it.
- Report nothing you did not read. An empty facts array is a correct answer.`;

export async function POST(req: NextRequest) {
  let name = '';
  /**
   * Read the store and stop there — never acquire.
   *
   * The deterministic assessment path consumes facts on every system read,
   * and a live web-search lookup per component on that path would turn a
   * consumption site into an acquisition trigger with the latency and cost
   * of one. Facts are site-level: acquired once, by the paths that already
   * acquire, and read by everyone thereafter.
   */
  let cachedOnly = false;
  try {
    const body = await req.json().catch(() => ({}));
    name = typeof body?.name === 'string' ? body.name.slice(0, 120) : '';
    cachedOnly = body?.cachedOnly === true;
  } catch { /* fall through */ }

  const productKey = productKeyFor(name);
  const store = () => getFactStoreState();

  const lookupUnknown = (detail: string) => NextResponse.json({
    productKey, status: 'lookup_unknown' as const, facts: [], detail, store: store(),
  });

  if (!productKey) return lookupUnknown('empty name');

  const cached = await readFacts(productKey, Date.now());
  if (cached.length > 0) {
    return NextResponse.json({ productKey, status: 'facts', facts: cached, cached: true, store: store() });
  }

  // Holding nothing is a complete answer for a consumer. It is NOT the same
  // finding as "this product has no published specifications", which is why
  // it reports its own status rather than borrowing `lookup_unknown`.
  if (cachedOnly) {
    return NextResponse.json({
      productKey, status: 'no_cached_facts' as const, facts: [], store: store(),
    });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) return lookupUnknown('no api key');

  let lastDetail = 'unknown';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(),
        attempt === 1 ? TIMEOUT_MS : RETRY_TIMEOUT_MS);
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

      if (!res.ok) { lastDetail = `upstream ${res.status}`; continue; }

      const data = await res.json();
      const text: string = data.output_text
        ?? (Array.isArray(data.output)
          ? data.output.flatMap((o: { content?: Array<{ text?: string }> }) => o.content ?? [])
            .map((c: { text?: string }) => c.text ?? '').join('')
          : '');

      let parsed: { sourceUrl?: string; facts?: Array<Record<string, string>> };
      try {
        parsed = JSON.parse(text.trim().replace(/^```(?:json)?\s*/, '').replace(/```$/, ''));
      } catch { lastDetail = 'unparseable reply'; continue; }

      const sourceUrl = typeof parsed.sourceUrl === 'string' ? parsed.sourceUrl : '';
      const now = Date.now();
      const accepted = (parsed.facts ?? [])
        .map((f) => ({ field: f.field, value: f.value, quotedText: f.quotedText, sourceUrl }))
        .filter((f) => isManufacturerFactAcceptable(f, name))
        .filter((f) => isManufacturerFactField(f.field!))
        .map((f) => toEvidenceItem(name, {
          field: f.field as never, value: f.value!, sourceUrl, quotedText: f.quotedText!,
        }, now));

      console.log('[manufacturer-facts] %s -> %d of %d admissible (attempt %d) %s',
        productKey, accepted.length, (parsed.facts ?? []).length, attempt, sourceUrl);

      // An empty result IS a completed lookup. It means this manufacturer
      // publishes nothing we may admit, which is a finding, not a failure.
      if (accepted.length > 0) await writeFacts(accepted);
      return NextResponse.json({
        productKey,
        status: accepted.length > 0 ? 'facts' : 'none',
        facts: accepted,
        attempts: attempt,
        store: store(),
      });
    } catch (err) {
      lastDetail = String(err).slice(0, 120);
    }
  }

  return lookupUnknown(`${lastDetail} after ${MAX_ATTEMPTS} attempts`);
}
