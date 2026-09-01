/**
 * Gate 7 (G2, G7-D1) — malformed / non-object request bodies must fail as
 * 4xx, never 5xx. `req.json()` on invalid JSON throws, and `JSON.parse("null")`
 * returns null (which then throws on destructure); both must be guarded.
 */
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as evaluatePOST } from '../evaluate/route';
import { POST as memoPOST } from '../memo-overlay/route';

function req(body: string): NextRequest {
  return new NextRequest('http://localhost/api/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}

const BAD_BODIES = ['not json at all', 'null', '[]', '{{{', '123', '"str"'];

describe('malformed request bodies never 5xx', () => {
  for (const b of BAD_BODIES) {
    it(`/api/evaluate rejects ${JSON.stringify(b)} as 4xx`, async () => {
      const res = await evaluatePOST(req(b));
      expect(res.status).toBeLessThan(500);
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
    it(`/api/memo-overlay rejects ${JSON.stringify(b)} as 4xx`, async () => {
      const res = await memoPOST(req(b));
      expect(res.status).toBeLessThan(500);
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  }
});
