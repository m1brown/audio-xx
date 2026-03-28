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

export async function POST(req: NextRequest) {
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
    // always gets something it can log/inspect.
    return NextResponse.json(
      {
        error: message,
        fallbackOutput: {
          responseText: '[error] Orchestrator failed server-side.',
          structured: {
            type: input.mode === 'shopping' ? 'shopping_recommendation' : 'general_response',
            data: {},
          },
          debug: {
            mode: input.mode,
            timestamp: Date.now(),
            llmCalled: false,
            version: 'error',
            fallbackReason: message,
          },
        } satisfies OrchestratorOutput,
      },
      { status: 500 },
    );
  }
}
