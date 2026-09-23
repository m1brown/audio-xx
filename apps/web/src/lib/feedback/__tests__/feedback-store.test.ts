/**
 * Durable beta feedback — pins (human-beta readiness, 2026-09-22).
 *
 * The repair contract: feedback_submitted events are ALSO written to a
 * durable table; every other event class stays log-only; storage failures
 * never reach the user; the store touches nothing but the prisma client.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(__dirname, p), 'utf8');
const STORE = read('../feedback-store.ts');
const ROUTE = read('../../../app/api/events/route.ts');

describe('feedback store boundary', () => {
  it('imports nothing but the prisma client — no evidence, catalog, identity, or reasoning', () => {
    const imports = STORE.match(/^import .+$/gm) ?? [];
    for (const line of imports) {
      expect(line, line).not.toMatch(/evidence|catalog|products|consultation|reasoning|identity/);
    }
    expect(imports.join('\n')).toContain("from '../prisma'");
  });

  it('writes ONLY to BetaFeedbackV1', () => {
    for (const m of STORE.match(/INSERT INTO "([^"]+)"|UPDATE "([^"]+)"|DELETE FROM "([^"]+)"/g) ?? []) {
      expect(m).toContain('BetaFeedbackV1');
    }
  });

  it('nothing in the reasoning or evidence layer reads feedback', () => {
    // The store is telemetry-out only; the product must not consume it.
    expect(STORE).not.toMatch(/reasoning|governed|advisory-response/);
  });
});

describe('/api/events durable-write contract', () => {
  it('feedback_submitted — and only feedback_submitted — is written durably', () => {
    expect(ROUTE).toContain("if (event === 'feedback_submitted')");
    expect((ROUTE.match(/writeFeedback\(/g) ?? []).length).toBe(1);
  });

  it('the log line is retained and the route still never fails the session', () => {
    expect(ROUTE).toContain('[AXX-EVENT]');
    expect(ROUTE).toContain('status: 204');
    // The durable write happens INSIDE the try that swallows telemetry
    // failures — a broken table must never surface to the user.
    const tryBlock = ROUTE.slice(ROUTE.indexOf('try {'), ROUTE.indexOf('return new NextResponse'));
    expect(tryBlock).toContain('writeFeedback');
  });

  it('the session email is looked up server-side, never trusted from the client body', () => {
    expect(ROUTE).toContain('getSession()');
    expect(ROUTE).not.toMatch(/props\.email|body\.email/);
  });
});
