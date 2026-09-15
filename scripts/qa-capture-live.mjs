#!/usr/bin/env node
/**
 * Audio XX — capture live production assessments for TIER 3 soft judging.
 *
 * Drives the production conversation surface with selected golden inputs and
 * writes each rendered response to apps/web/src/qa/captures/<caseId>.txt,
 * where `node scripts/qa-harness.mjs full` picks them up. Captures are
 * working files, not fixtures: they reflect production at capture time.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = 'https://audio-xx.com';
const OUT = 'apps/web/src/qa/captures';
const TARGETS = [
  { id: 'nad-vintage', msg: 'assess my system: NAD AV716 Reciever. TOPPING D70 Pro OCTO DAC. Dynaco A35 Speakers' },
  { id: 'accuphase-trio', msg: 'assess my system: Accuphase E-600, Accuphase DP-450 and Harbeth SHL5 Plus' },
];

mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
for (const { id, msg } of TARGETS) {
  const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  await p.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
  await p.waitForTimeout(3000);
  const box = p.locator('textarea:not([placeholder*="Anything else"]):visible').first();
  const send = p.getByRole('button', { name: 'Send', exact: true }).first();
  for (let i = 0; i < 60; i++) { if (await send.isEnabled().catch(() => false)) break; await p.waitForTimeout(1000); }
  for (let i = 0; i < 30; i++) {
    await box.click().catch(() => {});
    await box.fill(msg).catch(() => {});
    await p.waitForTimeout(500);
    if ((await box.inputValue().catch(() => '')) === msg && (await send.isEnabled().catch(() => false))) break;
  }
  await send.click();
  let t = '';
  for (let i = 0; i < 45; i++) {
    await p.waitForTimeout(4000);
    t = await p.evaluate(() => document.body.innerText);
    if (/System review/i.test(t)) break;
  }
  await p.waitForTimeout(6000);
  t = await p.evaluate(() => document.body.innerText);
  const start = t.indexOf(msg);
  const end = t.indexOf('You described a system:');
  const text = t.slice(Math.max(0, start), end > start ? end : undefined).trim();
  writeFileSync(`${OUT}/${id}.txt`, text);
  console.log(`[qa-capture] ${id}: ${text.length} chars`);
  await p.close();
}
await b.close();
