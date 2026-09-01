// §9 saved-system invariant + §12 UX checks, through the real UI on the
// flag-on local preview. Asserts the persisted record never changes while
// hypotheticals, reverts, refreshes and navigation happen around it.
import { chromium } from 'playwright';
const BASE = process.argv[2] ?? 'http://localhost:53297';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });

// Sign in (register if the local DB lacks the account).
await p.goto(`${BASE}/auth/signin`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await p.waitForTimeout(2000);
await p.locator('input[type="email"]').first().fill('diag@example.com');
await p.locator('input[type="password"]').first().fill('testpass123');
await p.locator('button[type="submit"]').first().click();
await p.waitForTimeout(4000);
let systems = await p.evaluate(async () => {
  const r = await fetch('/api/systems'); return { s: r.status, j: r.ok ? await r.json() : null };
});
if (systems.s === 401) {
  console.log('SIGNIN-FAILED — trying signup');
  await p.goto(`${BASE}/auth/signup`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await p.waitForTimeout(2000);
  const inputs = p.locator('input:visible');
  if (await inputs.count()) {
    await p.locator('input[type="email"]').first().fill('diag@example.com').catch(() => {});
    await p.locator('input[type="password"]').first().fill('testpass123').catch(() => {});
    await p.locator('button[type="submit"]').first().click().catch(() => {});
    await p.waitForTimeout(4000);
    systems = await p.evaluate(async () => {
      const r = await fetch('/api/systems'); return { s: r.status, j: r.ok ? await r.json() : null };
    });
  }
}
console.log('AUTH:', systems.s);
if (systems.s !== 200) { console.log('NO-LOCAL-AUTH — saved-system UI test not runnable locally'); await b.close(); process.exit(0); }

// Ensure exactly one saved Nathan system.
const snapshot = async () => p.evaluate(async () => {
  const r = await fetch('/api/systems'); const j = await r.json();
  return JSON.stringify(j.map((s) => ({ n: s.name, c: s.components.map((c) => `${c.brand} ${c.name}:${c.category ?? c.role ?? ''}`) })));
});
if (!systems.j.length) {
  // Create via API for speed (creation UI is covered elsewhere).
  const created = await p.evaluate(async () => {
    const r = await fetch('/api/systems', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Invariant test', components: [
        { brand: 'dCS', name: 'Rossini Apex', category: 'streamer_dac' },
        { brand: 'ARC', name: 'ref 5', category: 'preamp' },
        { brand: 'Butler', name: 'Monads', category: 'power_amp' },
        { brand: 'Acora', name: 'QRC-2', category: 'speaker' },
      ] }),
    });
    return r.status;
  });
  console.log('CREATE:', created);
}
const before = await snapshot();
console.log('SAVED-BEFORE:', before.slice(0, 200));

const typeAndSend = async (msg) => {
  const box = p.locator('textarea:not([placeholder*="Anything else"]):visible, input[placeholder*="Help me choose"]:visible, input[placeholder*="Reply"]:visible').first();
  const send = p.getByRole('button', { name: 'Send', exact: true }).first();
  for (let i = 0; i < 90; i++) { if (await send.isEnabled().catch(() => false)) break; await p.waitForTimeout(1000); }
  for (let i = 0; i < 40; i++) {
    await box.click().catch(() => {}); await box.fill(msg).catch(() => {});
    await p.waitForTimeout(500);
    if ((await box.inputValue().catch(() => '')) === msg && (await send.isEnabled().catch(() => false))) break;
  }
  await send.click().catch(async () => { await p.keyboard.press('Enter'); });
};
const waitGrow = async (min = 80) => {
  const before2 = (await p.evaluate(() => document.body.innerText)).length;
  for (let i = 0; i < 30; i++) {
    await p.waitForTimeout(3000);
    if ((await p.evaluate(() => document.body.innerText)).length > before2 + min) break;
  }
  await p.waitForTimeout(2000);
};

await p.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
await typeAndSend('Assess my system: - Dac/Streamer: dCS Rossini Apex. - Pre-amp: ARC ref 5. - Amps: Butler Monads. - Speakers: Acora QRC-2.');
let t = '';
for (let i = 0; i < 40; i++) { await p.waitForTimeout(4000); t = await p.evaluate(() => document.body.innerText); if (/SYSTEM REVIEW|What remains unknown/i.test(t)) break; }

// Sequential substitutions, assume, revert.
for (const q of [
  'What about a Leben CS600 instead of the Butler?',
  'What about a Hegel H590 instead?',
  'Assume that one for a minute.',
  'Go back to my real system.',
]) { await typeAndSend(q); await waitGrow(); }
console.log('AFTER-HYPOTHETICALS-UNCHANGED:', (await snapshot()) === before);

// §12: refresh DURING generation.
await typeAndSend('What about a Pass Labs XA25 instead of the Butler?');
await p.waitForTimeout(2500);
await p.reload({ waitUntil: 'networkidle' }).catch(() => {});
await p.waitForTimeout(4000);
console.log('AFTER-MIDGEN-REFRESH-UNCHANGED:', (await snapshot()) === before);
const errText = await p.evaluate(() => document.body.innerText);
console.log('PAGE-ALIVE-AFTER-REFRESH:', /AUDIO XX|Conversation/i.test(errText));

// Navigate away and back; new conversation; reload systems page.
await p.goto(`${BASE}/systems`, { waitUntil: 'networkidle' }).catch(() => {});
await p.waitForTimeout(2000);
await p.goto(BASE, { waitUntil: 'networkidle' });
await p.waitForTimeout(2000);
console.log('AFTER-NAV-UNCHANGED:', (await snapshot()) === before);
console.log('SAVED-AFTER:', (await snapshot()).slice(0, 200));
console.log('SAVED-UI-DONE');
await b.close();
