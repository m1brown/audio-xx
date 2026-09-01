import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
await p.goto('https://audio-xx.com/auth/signin', { waitUntil: 'domcontentloaded', timeout: 120000 });
await p.waitForTimeout(2500);
await p.locator('input[type="email"]').first().fill('diag@example.com');
await p.locator('input[type="password"]').first().fill('testpass123');
await p.locator('button[type="submit"]').first().click();
await p.waitForTimeout(4000);
await p.goto('https://audio-xx.com/', { waitUntil: 'networkidle', timeout: 120000 });
await p.waitForTimeout(3000);
const box = p.locator('textarea:not([placeholder*="Anything else"]):visible').first();
const send = p.getByRole('button', { name: 'Send', exact: true }).first();
for (let i = 0; i < 60; i++) { if (await send.isEnabled().catch(() => false)) break; await p.waitForTimeout(1000); }
const MSG = 'Assess my system: dCS Rossini Apex, ARC ref 5, Butler Monads, Acora QRC-2';
for (let i = 0; i < 30; i++) { await box.click().catch(()=>{}); await box.fill(MSG).catch(()=>{}); await p.waitForTimeout(500); if ((await box.inputValue().catch(()=>'')) === MSG && (await send.isEnabled().catch(()=>false))) break; }
await send.click();
let t = '';
for (let i = 0; i < 35; i++) { await p.waitForTimeout(4000); t = await p.evaluate(() => document.body.innerText); if (/SYSTEM REVIEW|signal-flow|clarification/i.test(t)) break; }
await p.waitForTimeout(4000);
t = await p.evaluate(() => document.body.innerText);
console.log('REVIEW-RENDERED:', /SYSTEM REVIEW/i.test(t));
console.log('SIGNAL-FLOW-CLARIFICATION:', /signal-flow order|source to output/i.test(t));
console.log('DEGRADED-SAVE-CHIP:', /You described a system: Dcs/i.test(t));
console.log('SAVE-CHIP-PRESENT:', /You described a system/i.test(t));
console.log('CHAIN-OK:', /Butler MONAD A100|Butler Monads/i.test(t) && /Acora/i.test(t));
await b.close(); console.log('JOURNEY-DONE');
