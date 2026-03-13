/**
 * Drift logging for the LLM memo overlay.
 *
 * Records each overlay attempt: what the LLM tried to change,
 * what passed validation, what was rejected, and why.
 *
 * Design:
 *   - In-memory ring buffer (last N entries) for development
 *   - Console logging for production observability
 *   - Structured entries for future persistence (database/analytics)
 *   - No PII — only structural metadata about the overlay attempt
 */

import type { LlmOverlayFields } from './memo-validation';

// ── Types ────────────────────────────────────────────

export interface DriftLogEntry {
  /** ISO timestamp of the overlay attempt. */
  timestamp: string;
  /** Stable advisory message ID. */
  messageId: string;
  /** Number of components in the system being assessed. */
  componentCount: number;
  /** Which fields the LLM attempted to provide. */
  attempted: (keyof LlmOverlayFields)[];
  /** Which fields passed validation and were applied. */
  accepted: (keyof LlmOverlayFields)[];
  /** Which fields failed validation. */
  rejected: (keyof LlmOverlayFields)[];
  /** Rejection reasons from the validator. */
  rejectionReasons: string[];
  /** Whether the overlay call itself failed (timeout, parse error, network). */
  callFailed: boolean;
  /** Latency in milliseconds (0 if call failed before response). */
  latencyMs: number;
}

// ── Ring buffer ──────────────────────────────────────

const MAX_LOG_ENTRIES = 100;
const logBuffer: DriftLogEntry[] = [];

// ── Public API ───────────────────────────────────────

/**
 * Log a successful overlay attempt (LLM responded, validation ran).
 */
export function logOverlayAttempt(
  messageId: string,
  componentCount: number,
  attempted: Partial<LlmOverlayFields>,
  accepted: Partial<LlmOverlayFields>,
  rejections: string[],
  latencyMs: number,
): void {
  const attemptedKeys = Object.keys(attempted).filter(
    (k) => attempted[k as keyof LlmOverlayFields] !== undefined,
  ) as (keyof LlmOverlayFields)[];

  const acceptedKeys = Object.keys(accepted).filter(
    (k) => accepted[k as keyof LlmOverlayFields] !== undefined,
  ) as (keyof LlmOverlayFields)[];

  const rejectedKeys = attemptedKeys.filter((k) => !acceptedKeys.includes(k));

  const entry: DriftLogEntry = {
    timestamp: new Date().toISOString(),
    messageId,
    componentCount,
    attempted: attemptedKeys,
    accepted: acceptedKeys,
    rejected: rejectedKeys,
    rejectionReasons: rejections,
    callFailed: false,
    latencyMs,
  };

  pushEntry(entry);
}

/**
 * Log a failed overlay attempt (timeout, network error, parse failure).
 */
export function logOverlayFailure(
  messageId: string,
  componentCount: number,
  latencyMs: number,
): void {
  const entry: DriftLogEntry = {
    timestamp: new Date().toISOString(),
    messageId,
    componentCount,
    attempted: [],
    accepted: [],
    rejected: [],
    rejectionReasons: [],
    callFailed: true,
    latencyMs,
  };

  pushEntry(entry);
}

/**
 * Get recent drift log entries (newest first).
 */
export function getDriftLog(limit = 20): DriftLogEntry[] {
  return logBuffer.slice(-limit).reverse();
}

/**
 * Get summary statistics from the drift log.
 */
export function getDriftSummary(): {
  totalAttempts: number;
  callFailures: number;
  fieldAcceptRate: Record<string, { attempted: number; accepted: number }>;
  avgLatencyMs: number;
  commonRejections: { reason: string; count: number }[];
} {
  const total = logBuffer.length;
  const failures = logBuffer.filter((e) => e.callFailed).length;

  // Per-field accept rate
  const fieldStats: Record<string, { attempted: number; accepted: number }> = {};
  for (const entry of logBuffer) {
    for (const field of entry.attempted) {
      if (!fieldStats[field]) fieldStats[field] = { attempted: 0, accepted: 0 };
      fieldStats[field].attempted++;
    }
    for (const field of entry.accepted) {
      if (!fieldStats[field]) fieldStats[field] = { attempted: 0, accepted: 0 };
      fieldStats[field].accepted++;
    }
  }

  // Average latency (excluding failures)
  const successEntries = logBuffer.filter((e) => !e.callFailed && e.latencyMs > 0);
  const avgLatency = successEntries.length > 0
    ? Math.round(successEntries.reduce((sum, e) => sum + e.latencyMs, 0) / successEntries.length)
    : 0;

  // Common rejection reasons
  const reasonCounts = new Map<string, number>();
  for (const entry of logBuffer) {
    for (const reason of entry.rejectionReasons) {
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
  }
  const commonRejections = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([reason, count]) => ({ reason, count }));

  return {
    totalAttempts: total,
    callFailures: failures,
    fieldAcceptRate: fieldStats,
    avgLatencyMs: avgLatency,
    commonRejections,
  };
}

// ── Internal ─────────────────────────────────────────

function pushEntry(entry: DriftLogEntry): void {
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer.shift();
  }

  // Console output for observability
  if (entry.callFailed) {
    console.warn(
      `[memo-overlay] FAILED | msg=${entry.messageId} | components=${entry.componentCount} | latency=${entry.latencyMs}ms`,
    );
  } else if (entry.rejected.length > 0) {
    console.warn(
      `[memo-overlay] PARTIAL | msg=${entry.messageId} | accepted=${entry.accepted.join(',')} | rejected=${entry.rejected.join(',')} | reasons=${entry.rejectionReasons.join('; ')} | latency=${entry.latencyMs}ms`,
    );
  } else if (entry.accepted.length > 0) {
    console.info(
      `[memo-overlay] OK | msg=${entry.messageId} | accepted=${entry.accepted.join(',')} | latency=${entry.latencyMs}ms`,
    );
  }
}
