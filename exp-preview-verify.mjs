// Substrate wave — preview verification. Direct POSTs to /api/reasoning-lane
// (server-side; independent of the client flag) + one flag-off page check.
import { chromium } from 'playwright';
const BASE = process.argv[2];
if (!BASE) { console.error('usage: node exp-preview-verify.mjs <preview-url>'); process.exit(1); }

const NATHAN = [
  { displayName: 'dCS Rossini Apex', role: 'dac' },
  { displayName: 'ARC ref 5', role: 'preamplifier' },
  { displayName: 'Butler Monads', role: 'amplifier' },
  { displayName: 'Acora QRC-2', role: 'speaker' },
];

async function lane(body, label) {
  const r = await fetch(`${BASE}/api/reasoning-lane`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  console.log(`\n== ${label}: status=${r.status} repaired=${j?.validation?.repaired} unchecked=${j?.validation?.unchecked}`);
  console.log('   meta:', JSON.stringify(j?.contextMeta ?? null).slice(0, 220));
  console.log('   answer:', String(j?.answer ?? j?.error ?? '').slice(0, 420).replace(/\n/g, ' | '));
  return j;
}

// 1. Counterfactual with computed power delta.
await lane({
  activeSystem: { components: NATHAN, source: 'stated' },
  currentHypothetical: { candidate: 'Leben CS600', incumbent: 'Butler Monads' },
  question: 'Would I lose bass control?',
  recentTurns: [
    { role: 'user', content: 'What about a Leben CS600 instead of the Butler?' },
    { role: 'assistant', content: 'We read the system with the Leben CS600 in place of the Butler Monads.' },
  ],
}, 'bass-control (computed delta)');

// 2. Hegel H590 — production store should hold maker facts (301W).
await lane({
  activeSystem: { components: NATHAN, source: 'stated' },
  currentHypothetical: { candidate: 'Hegel H590', incumbent: 'Butler Monads' },
  question: 'What about a Hegel H590 instead?',
  recentTurns: [],
}, 'hegel-h590 (store evidence)');

// 3. Poor substitution — tier discrimination.
await lane({
  activeSystem: { components: NATHAN, source: 'stated' },
  currentHypothetical: { candidate: 'WiiM Amp', incumbent: 'Butler Monads' },
  question: 'What about a WiiM Amp instead of the Butler?',
  recentTurns: [],
}, 'wiim (tier)');

// 4. Identity discipline — Bakoon never Enleum.
const bak = await lane({
  activeSystem: { components: [
    { displayName: '47 Labs 4706 Gaincard', role: 'amplifier' },
    { displayName: 'Snell Type J', role: 'speaker' },
    { displayName: 'Micromega Stage 3', role: 'dac' },
  ], source: 'stated' },
  currentHypothetical: null,
  question: 'What about a Bakoon AMP-13R instead of the Gaincard?',
  recentTurns: [],
}, 'bakoon (identity)');
console.log('   BAKOON-IDENTITY-OK:', !JSON.stringify(bak?.contextMeta ?? {}).toLowerCase().includes('enleum'));

// 5. Flag-off page behavior: a substitution turn still renders the Wave-2
//    counterfactual artifact (deterministic path untouched).
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1200 } });
await p.goto(BASE, { waitUntil: 'networkidle', timeout: 180000 });
const box = p.locator('textarea:not([placeholder*="Anything else"]):visible, input[placeholder*="Help me choose"]:visible, input[placeholder*="Reply"]:visible').first();
const send = p.getByRole('button', { name: 'Send', exact: true }).first();
for (let i = 0; i < 90; i++) { if (await send.isEnabled().catch(() => false)) break; await p.waitForTimeout(1000); }
const T1 = 'Assess my system: - Dac/Streamer: dCS Rossini Apex. - Pre-amp: ARC ref 5. - Amps: Butler Monads. - Speakers: Acora QRC-2.';
for (let i = 0; i < 40; i++) { await box.click().catch(()=>{}); await box.fill(T1).catch(()=>{}); await p.waitForTimeout(600); if ((await box.inputValue().catch(()=>'')) === T1 && (await send.isEnabled().catch(()=>false))) break; }
await send.click().catch(async () => p.keyboard.press('Enter'));
let t = '';
for (let i = 0; i < 30; i++) { await p.waitForTimeout(5000); t = await p.evaluate(() => document.body.innerText); if (/SYSTEM REVIEW/i.test(t)) break; }
const Q = 'What about a Leben CS600 instead of the Butler?';
for (let i = 0; i < 40; i++) { await box.click().catch(()=>{}); await box.fill(Q).catch(()=>{}); await p.waitForTimeout(600); if ((await box.inputValue().catch(()=>'')) === Q && (await send.isEnabled().catch(()=>false))) break; }
const before = t.length;
await send.click().catch(async () => p.keyboard.press('Enter'));
for (let i = 0; i < 26; i++) { await p.waitForTimeout(5000); t = await p.evaluate(() => document.body.innerText); if (t.length > before + 200) break; }
await p.waitForTimeout(4000);
t = await p.evaluate(() => document.body.innerText);
console.log('\n== flag-off page: counterfactual-frame:', t.includes('in place of the Butler Monads'), '| chain-swap:', /LEBEN CS600/.test(t));
await b.close();
console.log('PREVIEW-VERIFY-DONE');
