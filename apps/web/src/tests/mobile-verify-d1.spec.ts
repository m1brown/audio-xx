/**
 * D1 mobile fix verification — M1 / M2 / M4.
 * Checks overflow, nav collapse, dev indicator, and footer wrap
 * at 360 / 390 / 414 / 768px.
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const DIR = '/tmp/mobile-verify-shots';
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

const VIEWPORTS = [
  { label: '360w', width: 360, height: 780 },
  { label: '390w', width: 390, height: 844 },
  { label: '414w', width: 414, height: 896 },
  { label: '768w', width: 768, height: 1024 },
];

async function checkOverflow(page: Page): Promise<{ overflowX: boolean; scrollWidth: number; clientWidth: number }> {
  return page.evaluate(() => {
    const sw = document.documentElement.scrollWidth;
    const cw = document.documentElement.clientWidth;
    return { overflowX: sw > cw + 1, scrollWidth: sw, clientWidth: cw };
  });
}

async function checkFixedBottomElements(page: Page): Promise<{ count: number; elements: string[] }> {
  return page.evaluate(() => {
    const fixed = Array.from(document.querySelectorAll('*')).filter(el => {
      const s = window.getComputedStyle(el as Element);
      const bottom = parseInt(s.bottom || '9999');
      return s.position === 'fixed' && bottom < 120 && (el as HTMLElement).offsetWidth > 0;
    });
    return { count: fixed.length, elements: fixed.map(el => `${el.tagName}#${el.id}.${el.className}`) };
  });
}

test('M1 — nav overflow and link collapse at all viewports', async ({ page }) => {
  const results: string[] = [];

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);

    const overflow = await checkOverflow(page);
    const label = `${vp.label} (${vp.width}px)`;
    const topNav = page.locator('nav').first();
    const navText = await topNav.innerText();

    console.log(`\n[${label}] nav: "${navText.replace(/\s+/g, ' ').trim()}"`);
    console.log(`[${label}] overflow: ${overflow.overflowX ? '❌ YES' : '✅ none'} (sw=${overflow.scrollWidth} cw=${overflow.clientWidth})`);

    // At <480px: Glossary and Resources must be hidden in top nav
    if (vp.width < 480) {
      // Scope to top nav's link container to avoid other navs in the page
      const topNavPrimary = page.locator('nav').first().locator('.nav-links');
      const glossaryInTopNav = topNavPrimary.locator('a[href="/glossary"]');
      const resourcesInTopNav = topNavPrimary.locator('a[href="/resources"]');
      const glossaryHidden = await glossaryInTopNav.count() === 0 || !(await glossaryInTopNav.isVisible());
      const resourcesHidden = await resourcesInTopNav.count() === 0 || !(await resourcesInTopNav.isVisible());
      console.log(`[${label}] Glossary hidden: ${glossaryHidden ? '✅' : '❌ VISIBLE'}`);
      console.log(`[${label}] Resources hidden: ${resourcesHidden ? '✅' : '❌ VISIBLE'}`);
      results.push(`${label}: glossaryHidden=${glossaryHidden}, resourcesHidden=${resourcesHidden}`);
      expect(glossaryHidden, `${label}: Glossary should be hidden`).toBe(true);
      expect(resourcesHidden, `${label}: Resources should be hidden`).toBe(true);
    }

    await page.screenshot({ path: path.join(DIR, `${vp.label}-homepage.png`), fullPage: false });
    expect(overflow.overflowX, `${label}: horizontal overflow`).toBe(false);
    results.push(`${label}: overflow=${overflow.overflowX}`);
  }

  console.log('\n── M1 summary ──');
  results.forEach(r => console.log(' ', r));
});

test('M2 — no visible fixed element at bottom (dev indicator removed)', async ({ page }) => {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const fixedBottom = await checkFixedBottomElements(page);
    const label = `${vp.label} (${vp.width}px)`;
    console.log(`[${label}] fixed bottom elements: ${fixedBottom.count === 0 ? '✅ none' : `❌ ${fixedBottom.count} found: ${fixedBottom.elements.join(', ')}`}`);
    expect(fixedBottom.count, `${label}: no unexpected fixed bottom elements`).toBe(0);
  }
});

test('M4 — footer link whiteSpace and flexWrap at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const textarea = page.locator('#audio-input');
  await textarea.waitFor({ state: 'visible', timeout: 8000 });
  await textarea.fill('test');
  await page.waitForTimeout(200);

  const startOver = page.locator('button', { hasText: /^Start over$/ });
  const whiteSpace = await startOver.evaluate((el) => window.getComputedStyle(el).whiteSpace);
  const flexWrap = await startOver.evaluate((el) => window.getComputedStyle(el.parentElement!).flexWrap);

  console.log(`\n[M4 360w] "Start over" white-space: ${whiteSpace}`);
  console.log(`[M4 360w] footer bar flex-wrap: ${flexWrap}`);

  await page.screenshot({ path: path.join(DIR, '360w-m4-footer.png'), fullPage: false });

  expect(whiteSpace, 'Start over: whiteSpace should be nowrap').toBe('nowrap');
  expect(flexWrap, 'footer bar: flexWrap should be wrap').toBe('wrap');
});
