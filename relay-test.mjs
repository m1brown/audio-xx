import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
p.on('console', (m) => console.log('CONSOLE:', m.text().slice(0, 120)));
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 120000 });
await p.waitForTimeout(4000);
await b.close(); console.log('DONE');
