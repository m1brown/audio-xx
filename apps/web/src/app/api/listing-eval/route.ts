/**
 * API route: /api/listing-eval
 *
 * MVP "Evaluate a used listing from an uploaded image". Accepts one or
 * more base64-encoded listing photos plus optional context, builds the
 * vision-prompt via buildListingEvalPrompt, and forwards to a
 * vision-capable OpenAI model. Returns { content: string } with the
 * raw structured evaluation, which page.tsx surfaces as an assistant
 * 'note' message.
 *
 * Mirrors the env-driven shape of /api/memo-overlay: when no API key is
 * configured we return 503 so the client can fall back to a friendly
 * error state rather than 500.
 *
 * Model defaults to gpt-4o (vision-capable). Override with
 * LISTING_EVAL_MODEL if needed.
 *
 * ── Validation contract ────────────────────────────────────
 * Client-side limits are mirrored on the server so a hostile client
 * cannot bypass them. The constants are exported under MAX_IMAGES /
 * MAX_IMAGE_BYTES so tests can assert against the same thresholds.
 *
 *   - exactly 1..3 image entries
 *   - each entry must be a base64 data URL with image/jpeg | image/jpg |
 *     image/png | image/webp media type
 *   - each entry's base64 payload must decode to ≤ MAX_IMAGE_BYTES
 *     (4 MB), checked without materializing the full buffer
 *   - images are forwarded straight to the LLM and never persisted on
 *     this server (no fs/db writes, no logging of payload bytes)
 *
 * Any violation returns 400 with a short, user-readable `error` string.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  buildListingEvalPrompt,
  type ListingEvalRequest,
} from '@/lib/listing-evaluation';

const MODEL = process.env.LISTING_EVAL_MODEL ?? 'gpt-4o';

/** Cap on image count per request — must match the client guard. */
export const MAX_IMAGES = 3;
/** Cap on decoded image bytes — must match the client guard. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const DATA_URL_PATTERN =
  /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\r\n]+)$/;

interface RequestBody {
  text?: string;
  images?: unknown;
  systemContext?: { components: string[]; character?: string };
  listenerPreferences?: string;
}

/**
 * Validate the images array without copying the base64 payload around.
 * Returns the array on success, or a short error string on rejection.
 * Length-based size estimation: base64 expands raw bytes by 4/3, so a
 * payload of length N decodes to ⌊N * 3 / 4⌋ minus padding. We check
 * the upper bound (no minus padding) and reject when it exceeds the
 * raw-byte cap — that gives a tight, fast guard with no allocation.
 */
function validateImages(input: unknown): string[] | { error: string } {
  if (!Array.isArray(input) || input.length === 0) {
    return { error: 'At least one image is required.' };
  }
  if (input.length > MAX_IMAGES) {
    return { error: `Up to ${MAX_IMAGES} images per evaluation.` };
  }

  const accepted: string[] = [];
  for (let i = 0; i < input.length; i++) {
    const entry = input[i];
    if (typeof entry !== 'string') {
      return { error: `Image ${i + 1} is not a valid data URL.` };
    }
    const match = DATA_URL_PATTERN.exec(entry);
    if (!match) {
      return {
        error: `Image ${i + 1} must be a JPEG, PNG, or WebP data URL.`,
      };
    }
    const payload = match[2];
    // Upper-bound decoded byte length: floor(length * 3 / 4) ignoring
    // padding correction. If even this upper bound exceeds the cap, the
    // image is over budget — no need to allocate a Buffer to find out.
    const upperBound = Math.floor((payload.length * 3) / 4);
    if (upperBound > MAX_IMAGE_BYTES) {
      return {
        error: `Image ${i + 1} exceeds the 4 MB per-image limit.`,
      };
    }
    accepted.push(entry);
  }

  return accepted;
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const validated = validateImages(body.images);
  if (!Array.isArray(validated)) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY not configured' },
      { status: 503 },
    );
  }

  // Pass-through only. Images are forwarded straight to the model and
  // never written to disk, queue, or DB by this route — the user owns
  // the bytes for the duration of the round-trip.
  const evalReq: ListingEvalRequest = {
    images: validated,
    userText: typeof body.text === 'string' ? body.text : undefined,
    savedSystem: body.systemContext,
    listenerPreferences:
      typeof body.listenerPreferences === 'string'
        ? body.listenerPreferences
        : undefined,
  };

  const { systemPrompt, userContent } = buildListingEvalPrompt(evalReq);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1600,
        // Low temperature: this endpoint is a format-strict task. The
        // chat renderer segments on Markdown headings + blank lines; if
        // the model is creative with formatting the output collapses
        // into one paragraph (observed regression, 2026-05-21).
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[listing-eval] OpenAI error:', response.status, text);
      return NextResponse.json(
        { error: 'OpenAI API error' },
        { status: 502 },
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';
    return NextResponse.json({ content });
  } catch (err) {
    console.error('[listing-eval] call failed:', err);
    return NextResponse.json({ error: 'LLM call failed' }, { status: 502 });
  }
}
