/**
 * API route: /api/orchestrator
 *
 * Server-side entry point for the Audio XX unified orchestrator.
 * Receives a complete OrchestratorInput payload from the client,
 * runs the orchestrator (which may call an external LLM), and
 * returns the structured OrchestratorOutput as JSON.
 *
 * This route exists so that:
 *   1. API keys (OPENAI_API_KEY, ANTHROPIC_API_KEY) stay server-side
 *   2. The LLM call runs in Node.js, not the browser
 *   3. The client (page.tsx) only sends context + candidates
 *
 * Configuration (environment variables):
 *   ORCHESTRATOR_LLM_PROVIDER — 'anthropic' | 'openai' (default: 'anthropic')
 *   ORCHESTRATOR_LLM_MODEL    — model identifier
 *   ANTHROPIC_API_KEY / OPENAI_API_KEY — as needed
 *
 * Returns OrchestratorOutput on success, or { error, fallbackOutput } on failure.
 * The fallbackOutput always contains a valid deterministic response so the
 * client never receives an empty payload.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runAudioXXAssistant } from '@/lib/assistant/runAudioXXAssistant';
import type { OrchestratorInput, OrchestratorOutput } from '@/lib/assistant/runAudioXXAssistant';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

/**
 * Build the standard `{ error, fallbackOutput }` envelope this route
 * always returns on non-2xx. Centralised so the rate-limit branch,
 * the JSON-parse branch, and the assistant-failure branch can all
 * use the same shape — the client never has to special-case which
 * thing went wrong, only whether `fallbackOutput` is usable.
 */
function buildErrorEnvelope(
  message: string,
  mode: OrchestratorInput['mode'] | 'unknown',
  fallbackReason: string,
  responseText: string,
) {
  return {
    error: message,
    fallbackOutput: {
      responseText,
      structured: {
        type: mode === 'shopping' ? 'shopping_recommendation' as const : 'general_response' as const,
        data: {},
      },
      debug: {
        mode: mode === 'unknown' ? 'shopping' : mode,
        timestamp: Date.now(),
        llmCalled: false,
        version: 'error',
        fallbackReason,
      },
    } satisfies OrchestratorOutput,
  };
}

export async function POST(req: NextRequest) {
  // Stage 8.1 rate limit: per-IP in-memory bucket, default 30/5min,
  // overridable via RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS env vars.
  // Guard runs BEFORE JSON parsing so a runaway client can't bypass
  // the limit by sending malformed payloads.
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    console.warn('[rate-limit] ip=%s limit=%d windowResetAt=%s denied',
      ip, rl.limit, new Date(rl.resetAt).toISOString());
    return NextResponse.json(
      buildErrorEnvelope(
        'rate_limited',
        'unknown',
        `rate_limited:${ip}`,
        "You're moving faster than I can think. Try again in a moment.",
      ),
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))),
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.floor(rl.resetAt / 1000)),
        },
      },
    );
  }

  let input: OrchestratorInput;

  try {
    input = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload' },
      { status: 400 },
    );
  }

  // Basic validation: mode is required
  if (!input || !input.mode) {
    return NextResponse.json(
      { error: 'Missing required field: mode' },
      { status: 400 },
    );
  }

  console.log('[orchestrator-api] POST /api/orchestrator mode=%s category=%s candidates=%d',
    input.mode,
    input.constraints?.category ?? 'n/a',
    input.candidates?.length ?? 0,
  );

  try {
    const output = await runAudioXXAssistant(input);

    console.log('[orchestrator-api] Response: llmCalled=%s version=%s recs=%d',
      output.debug.llmCalled,
      output.debug.version,
      output.structured.type === 'shopping_recommendation'
        ? output.structured.data.recommendations.length
        : 0,
    );

    return NextResponse.json(output);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[orchestrator-api] Error:', message);

    // Return a structured error with a minimal fallback so the client
    // always gets something it can log/inspect. Same envelope shape
    // as the 429 rate-limit branch — clients only have to handle one
    // failure shape.
    return NextResponse.json(
      buildErrorEnvelope(
        message,
        input.mode,
        message,
        '[error] Orchestrator failed server-side.',
      ),
      { status: 500 },
    );
  }
}
