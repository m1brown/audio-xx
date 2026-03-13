/**
 * API route: /api/memo-overlay
 *
 * Thin proxy to an LLM provider for the memo overlay layer.
 * Receives pre-built system and user prompts from the client,
 * forwards to the configured LLM, and returns the raw response.
 *
 * Configuration (environment variables):
 *   MEMO_LLM_PROVIDER — 'anthropic' | 'openai' (default: 'anthropic')
 *   MEMO_LLM_MODEL — model identifier (default: 'claude-sonnet-4-5-20250929' for Anthropic,
 *                     'gpt-4o-mini' for OpenAI)
 *   ANTHROPIC_API_KEY — required when provider is 'anthropic'
 *   OPENAI_API_KEY — required when provider is 'openai'
 *
 * Returns { content: string } on success, or an error with appropriate status.
 * When no API key is configured, returns 503 (service unavailable) —
 * the client treats this as a silent fallback to deterministic rendering.
 */

import { NextRequest, NextResponse } from 'next/server';

const PROVIDER = process.env.MEMO_LLM_PROVIDER ?? 'anthropic';
const DEFAULT_MODEL =
  PROVIDER === 'openai' ? 'gpt-4o-mini' : 'claude-sonnet-4-5-20250929';
const MODEL = process.env.MEMO_LLM_MODEL ?? DEFAULT_MODEL;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { systemPrompt, userPrompt } = body;

  if (!systemPrompt || !userPrompt) {
    return NextResponse.json(
      { error: 'systemPrompt and userPrompt required' },
      { status: 400 },
    );
  }

  try {
    if (PROVIDER === 'anthropic') {
      return await callAnthropic(systemPrompt, userPrompt);
    } else if (PROVIDER === 'openai') {
      return await callOpenAI(systemPrompt, userPrompt);
    } else {
      return NextResponse.json(
        { error: `Unknown LLM provider: ${PROVIDER}` },
        { status: 500 },
      );
    }
  } catch (err) {
    console.error('[memo-overlay] LLM call failed:', err);
    return NextResponse.json(
      { error: 'LLM call failed' },
      { status: 502 },
    );
  }
}

async function callAnthropic(
  systemPrompt: string,
  userPrompt: string,
): Promise<NextResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured' },
      { status: 503 },
    );
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[memo-overlay] Anthropic error:', response.status, text);
    return NextResponse.json({ error: 'Anthropic API error' }, { status: 502 });
  }

  const data = await response.json();
  const content = data.content?.[0]?.text ?? '';

  return NextResponse.json({ content });
}

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
): Promise<NextResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY not configured' },
      { status: 503 },
    );
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[memo-overlay] OpenAI error:', response.status, text);
    return NextResponse.json({ error: 'OpenAI API error' }, { status: 502 });
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '';

  return NextResponse.json({ content });
}
