/**
 * API route: /api/independent-reviews
 *
 * SLICE 3: acquisition only. Discovers observations and stores them. Nothing
 * reads them yet — no D-12 use, no assessments, no product pages, no
 * comparisons, no Critical Consensus.
 *
 * A thin wrapper. Everything that decides anything lives in
 * `independent-review-acquisition.ts`, which is pure and proved without a
 * network; this file only fetches, parses and reports.
 *
 * Acquisition starts from a CANONICAL product identity. Listener shorthand
 * cannot be used: "ARC ref 5" shares no identifying tokens with "Audio
 * Research Reference 5" and would be rejected against its own review. Callers
 * resolve identity through corroboration first.
 */

import { NextRequest, NextResponse } from 'next/server';
import { SOURCE_WHITELIST } from '@/lib/evidence/source-whitelist';
import { admitAndStore, type ReviewCandidate } from '@/lib/evidence/independent-review-acquisition';
import { readObservations } from '@/lib/evidence/independent-review-store';

const TIMEOUT_MS = 20000;
const RETRY_TIMEOUT_MS = 15000;
const MAX_ATTEMPTS = 2;
const MODEL = process.env.OPENAI_SEARCH_MODEL ?? 'gpt-4o';

/** Approved publications, named for the model exactly as the registry names them. */
const APPROVED = SOURCE_WHITELIST.map((s) => `${s.name} (${new URL(s.url).host})`).join('; ');

const INSTRUCTIONS = `You locate published reviews and credible listening coverage of a named audio product and report what was observed.

SEARCH BROADLY. Relevant evidence lives in established audio publications,
specialist publications, historical reviews of discontinued products, credible
YouTube reviewers with direct listening experience, designer interviews and
show reports. Do not confine yourself to a fixed list of outlets.

PRIORITY KNOWN SOURCES (search these first when relevant, but they are a
starting roster, not a boundary):
${APPROVED}

CATEGORICALLY EXCLUDED: 6moons (6moons.com). Never report anything from it,
under any framing.

A source outside the priority roster is acceptable when it is a real,
identifiable outlet or reviewer with direct experience of the product: name it
exactly, give the real URL, and identify the reviewer. Admission is decided
downstream — your job is accurate discovery and attribution, not gatekeeping.
Skip anonymous forum chatter, dealer/retailer copy and aggregator rehashes.
For a YouTube review, "publication" is the channel name and "sourceUrl" is the
video URL.

Return ONLY this JSON, no prose, no markdown fences:
{
  "found": true|false,
  "observations": [
    {
      "productName": "the product AS THE ARTICLE NAMES IT",
      "publication": "the publication name",
      "reviewer": "byline, or null",
      "sourceUrl": "the article's own absolute https:// URL — NOT a title, citation or description",
      "publishedAt": "ISO date, or null",
      "observationType": "listening"|"measurement"|"comparison"|"positioning",
      "claim": "YOUR OWN one-sentence paraphrase of what they observed",
      "quote": "short exact wording, ONLY where it materially matters, else null",
      "axis": "warm_bright|smooth_detailed|elastic_controlled|airy_closed, listening only, else null",
      "direction": "the position on that axis, listening only, else null",
      "condition": { "kind": "break_in"|"setup"|"mode"|"associated_equipment"|"level"|"other",
                     "description": "the condition" } or null,
      "appliesAcrossVariants": true|false
    }
  ]
}

Rules:
- sourceUrl MUST be an absolute https:// address of the article on the
  publication's own site. A title, a byline, a date or a citation string is not
  a URL. If you cannot give the real URL for an observation, OMIT that
  observation entirely — a claim we cannot check is worse than a gap.
- PARAPHRASE. "claim" is your own sentence, not the article's. Use "quote" only
  where the exact wording carries something a paraphrase would lose, and keep it short.
- EXACT PRODUCT. "productName" must be what the article reviewed. If the article
  reviewed a different variant or a sibling model, report it as it is — do NOT
  relabel it as the requested product. Set appliesAcrossVariants true ONLY when
  the article itself says the observation holds across the range.
- CONDITIONS. If an observation depends on break-in hours, a setting, a mode, a
  partnering component or a listening level, you MUST fill "condition". An
  observation that reads "after 500 hours" without a condition is wrong.
- One observation per distinct claim. A single review usually yields several.
- NO scores, ratings, star counts, rankings or overall summaries. Report what
  was observed, not how good it was judged to be.
- If no credible source has covered this product, return found:false with an
  empty array. That is a correct and useful answer.`;

export async function POST(req: NextRequest) {
  const started = Date.now();
  let canonicalName = '';
  let productKey = '';
  let mode: 'read' | 'acquire' = 'acquire';
  try {
    const body = await req.json().catch(() => ({}));
    canonicalName = typeof body?.name === 'string' ? body.name.slice(0, 160) : '';
    mode = body?.mode === 'read' ? 'read' : 'acquire';
    productKey = typeof body?.productKey === 'string'
      ? body.productKey
      : canonicalName.toLowerCase().replace(/[^\w\s/-]/g, ' ').replace(/\s+/g, ' ').trim();
  } catch { /* fall through */ }

  const lookupUnknown = (detail: string) => {
    console.warn('[independent-reviews] %s -> lookup_unknown (%dms) %s',
      canonicalName || '(empty)', Date.now() - started, detail);
    return NextResponse.json({ status: 'lookup_unknown', detail, observations: [] });
  };

  if (!canonicalName || !productKey) return lookupUnknown('empty product identity');

  // READ MODE. Assessments and every other consumer use this: independent
  // reviews are site-level product knowledge, so a turn reads what is held and
  // never acquires. Acquisition is a seeding concern, run out of band, because
  // four search-backed calls do not belong inside a listener's wait.
  if (mode === 'read') {
    const stored = await readObservations(productKey, Date.now());
    return NextResponse.json({
      status: stored.length > 0 ? 'observations' : 'no_coverage',
      observations: stored,
      rejected: [],
      source: 'store',
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
          input: `Audio product: "${canonicalName}"`,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) { lastDetail = `upstream ${res.status}`; continue; }

      const data = await res.json();
      const text: string = data.output_text
        ?? (Array.isArray(data.output)
          ? data.output
            .flatMap((o: { content?: Array<{ text?: string }> }) => o.content ?? [])
            .map((c: { text?: string }) => c.text ?? '').join('')
          : '');

      let parsed: { found?: boolean; observations?: ReviewCandidate[] };
      try {
        parsed = JSON.parse(
          text.trim().replace(/^```(?:json)?\s*/, '').replace(/```$/, ''));
      } catch { lastDetail = 'unparseable reply'; continue; }

      const candidates = Array.isArray(parsed.observations) ? parsed.observations : [];
      const outcome = await admitAndStore(canonicalName, productKey, candidates, Date.now());

      // A reply whose every candidate carried a title where a URL belongs is a
      // DEFECTIVE REPLY, not a finding that no publication covers the product.
      // Reporting it as no_coverage would repeat the defect this architecture
      // has already paid for twice — a failure of our request presented as
      // evidence about the world. Retryable; on the last attempt it becomes
      // lookup_unknown rather than silence.
      const urlShaped = new Set(['malformed_source_url', 'source_not_publication_domain']);
      if (outcome.status === 'no_coverage'
        && outcome.rejected.length > 0
        && outcome.rejected.every((r) => urlShaped.has(r.reason as string))
        && outcome.rejected.some((r) => !/^https?:\/\//i.test(r.detail ?? ''))) {
        lastDetail = `every candidate carried a non-URL source (${outcome.rejected.length})`;
        if (attempt < MAX_ATTEMPTS) continue;
        return lookupUnknown(lastDetail);
      }

      console.log('[independent-reviews] %s -> %s (%d admitted, %d rejected, %dms, attempt %d)',
        canonicalName, outcome.status,
        outcome.status === 'observations' ? outcome.observations.length : 0,
        outcome.status === 'lookup_unknown' ? 0 : outcome.rejected.length,
        Date.now() - started, attempt);

      return NextResponse.json({ ...outcome, attempts: attempt });
    } catch (err) {
      lastDetail = String(err).slice(0, 120);
    }
  }

  return lookupUnknown(`${lastDetail} after ${MAX_ATTEMPTS} attempts`);
}
