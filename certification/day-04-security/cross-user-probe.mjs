/**
 * Gate 4 — live cross-user access probe.
 *
 * Two real authenticated sessions. User A creates a system; User B then
 * attempts every read/write/delete against A's system id from inside B's
 * own authenticated session. Every attempt must be denied (404 — the
 * route scopes by userId, so A's row is simply invisible to B). Also
 * probes the checkout-return sync with a foreign session id.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const PASS = 'journey-m5-pass';
const USER_A = 'cert-sec-a@example.com';
const USER_B = 'cert-sec-b@example.com';
const out = { probes: [] };

async function signedContext(browser, email) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/auth/signin`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  return { context, page };
}

// Run fetch inside the page so the session cookie is attached automatically.
async function apiFetch(page, method, path, body) {
  return page.evaluate(
    async ([m, p, b]) => {
      const res = await fetch(p, {
        method: m,
        headers: b ? { 'Content-Type': 'application/json' } : undefined,
        body: b ? JSON.stringify(b) : undefined,
      });
      let json = null;
      try { json = await res.json(); } catch {}
      return { status: res.status, json };
    },
    [method, path, body],
  );
}

const browser = await chromium.launch();

// User A signs in and saves a system.
const a = await signedContext(browser, USER_A);
const saved = await apiFetch(a.page, 'POST', '/api/my-systems', {
  systemText: 'Assess my system: Chord Qutest, Naim SuperNait 3, Harbeth Super HL5 Plus',
  name: "A's private system",
  notes: 'A private note that must never reach B',
});
const listA = await apiFetch(a.page, 'GET', '/api/my-systems');
const aSystem = (listA.json?.systems || []).find((s) => s.name === "A's private system") || (listA.json?.systems || [])[0];
const aId = aSystem?.id;
out.setup = { saveStatus: saved.status, aSystemId: aId ? 'captured' : 'MISSING', aCount: listA.json?.systems?.length ?? null };

// User B signs in and attacks A's id.
const b = await signedContext(browser, USER_B);

async function probe(name, expectDenied, fn) {
  const r = await fn();
  const bodyErr = String(r.json?.error || '');
  // A 400 counts as a denial only when it is an explicit ownership rejection
  // (the profile route answers a foreign id with "does not belong to this user").
  const ownershipReject = r.status === 400 && /does not belong|not found/i.test(bodyErr);
  const denied = r.status === 404 || r.status === 403 || r.status === 401 || ownershipReject;
  // A leak = B sees A's private name/notes in any response body.
  const bodyStr = JSON.stringify(r.json || {});
  const leaked = bodyStr.includes('private note') || bodyStr.includes("A's private system") || bodyStr.includes('must never reach B');
  out.probes.push({ name, status: r.status, denied, leaked, pass: denied && !leaked });
}

if (aId) {
  await probe('B GET A system (my-systems list is self-scoped)', true, async () => {
    const list = await apiFetch(b.page, 'GET', '/api/my-systems');
    // B's own list must not contain A's system
    const hasA = (list.json?.systems || []).some((s) => s.id === aId);
    return { status: hasA ? 200 : 404, json: hasA ? list.json : { note: "A's system absent from B's list" } };
  });
  await probe('B PATCH rename A system', true, () =>
    apiFetch(b.page, 'PATCH', `/api/my-systems/${aId}`, { name: 'HIJACKED BY B' }));
  await probe('B PATCH notes on A system', true, () =>
    apiFetch(b.page, 'PATCH', `/api/my-systems/${aId}`, { notes: 'B overwrote this' }));
  await probe('B GET A system detail (/api/systems/[id])', true, () =>
    apiFetch(b.page, 'GET', `/api/systems/${aId}`));
  await probe('B DELETE A system', true, () =>
    apiFetch(b.page, 'DELETE', `/api/my-systems/${aId}`));
  await probe('B set A system as active profile', true, () =>
    apiFetch(b.page, 'PATCH', '/api/profile', { activeSystemId: aId }));
}

// Foreign / bogus checkout session sync (must not activate B).
await probe('B checkout-return sync with bogus session id', true, async () => {
  const r = await apiFetch(b.page, 'GET', '/api/billing/status?session_id=cs_test_foreign_or_bogus');
  // status 200 is fine; what matters is B was NOT activated by it
  const state = r.json?.entitlement?.state;
  const activated = r.json?.synced === true;
  return { status: activated ? 200 : 404, json: { synced: r.json?.synced, state } };
});

// Confirm A's system still intact and unmodified after B's attacks.
const listAafter = await apiFetch(a.page, 'GET', '/api/my-systems');
const aAfter = (listAafter.json?.systems || []).find((s) => s.id === aId);
out.integrityAfter = {
  stillExists: Boolean(aAfter),
  nameIntact: aAfter?.name === "A's private system",
  notesIntact: aAfter?.notes === 'A private note that must never reach B',
};

// Cleanup: A deletes its own probe system.
if (aId) await apiFetch(a.page, 'DELETE', `/api/my-systems/${aId}`);

await a.context.close();
await b.context.close();
await browser.close();

out.summary = {
  totalProbes: out.probes.length,
  allDenied: out.probes.every((p) => p.pass),
  anyLeak: out.probes.some((p) => p.leaked),
};
console.log(JSON.stringify(out, null, 2));
