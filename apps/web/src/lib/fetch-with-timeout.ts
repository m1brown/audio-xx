/**
 * fetchWithTimeout — bounded fetch wrapper.
 *
 * Rationale (Phase 5 resilience):
 *   The main shopping pipeline previously used `await fetch('/api/evaluate', …)`
 *   with no timeout. When the server hung (e.g. a prisma/SQLite lock on the
 *   serverless path), the fetch never resolved, which left the UI stuck in
 *   the "Thinking…" state indefinitely because `dispatch({ type: 'SET_LOADING',
 *   value: false })` was never reached.
 *
 *   This wrapper enforces a hard upper bound on any network call by aborting
 *   the request when the timeout elapses. The resulting rejection flows into
 *   the caller's existing try/catch and the deterministic fallback path is
 *   taken (empty signals → engine still produces a shopping panel).
 *
 * Design notes:
 *   - Domain-agnostic utility — contains no audio vocabulary.
 *   - Preserves any caller-supplied AbortSignal by chaining: if either the
 *     caller aborts or the timeout fires, the underlying fetch is aborted.
 *   - Cleans up the timer in a `finally` so the handle is not leaked when
 *     the fetch resolves or rejects early.
 */

/**
 * Default timeout for deterministic backend calls (e.g. /api/evaluate).
 * Short enough that a hung server does not block the UI; long enough
 * to tolerate a cold serverless start and a warm prisma connection.
 */
export const EVALUATE_TIMEOUT_MS = 5000;

export class FetchTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`fetch(${url}) timed out after ${timeoutMs}ms`);
    this.name = 'FetchTimeoutError';
  }
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = EVALUATE_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  // Chain an externally-supplied abort signal so callers can still cancel.
  if (init.signal) {
    if (init.signal.aborted) {
      clearTimeout(timer);
      controller.abort();
    } else {
      init.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (timedOut) {
      throw new FetchTimeoutError(url, timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
