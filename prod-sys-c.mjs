import { chromium } from 'playwright';
const MSG = 'My system is dCS Rossini Apex, ARC ref, Butler Monads, Acora QRC-2';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
await p.goto('https://audio-xx.com/auth/signin', { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForTimeout(3000);
await p.locator('input[type="email"]').first().fill('diag@example.com');
await p.locator('input[type="password"]').first().fill('testpass123');
await p.locator('button[type="submit"]').first().click();
await p.waitForTimeout(5000);
// What do the stored records actually hold?
const api = await p.evaluate(async () => {
  for (const url of ['/api/systems', '/api/user/systems', '/api/saved-systems']) {
    try { const r = await fetch(url); if (r.ok) return { url, body: await r.json() }; } catch {}
  }
  return null;
});
const systems = api?.body ?? [];
console.log('systems:', systems.length);
for (const sys of systems) {
  console.log('---', sys.name, sys.id);
  for (const c of sys.components) console.log('   ', JSON.stringify({ brand: c.brand, name: c.name, category: c.category, role: c.role }));
}
await b.close(); console.log('DONE');
