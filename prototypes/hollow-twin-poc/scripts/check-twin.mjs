// Smoke test for the 3D twin: opens #/demo, switches disasters, checks for console errors, takes screenshots.
// Usage: node scripts/check-twin.mjs <base url> <out dir>
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:5194/';
const out = process.argv[3] ?? '.';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
for (const vp of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 375, height: 812 }]) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${vp.name} ${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${vp.name} pageerror: ${e.message}`));
  await page.goto(base + '#/demo');
  await page.waitForSelector('.twin-stage canvas', { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/demo-${vp.name}.png`, fullPage: true });
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log(vp.name, 'horizontal overflow px:', scroll);
  if (vp.name === 'desktop') {
    for (const id of ['aging', 'elliott']) {
      await page.selectOption('.twin-controls select', id);
      await page.waitForFunction(() => !document.querySelector('.twin-loading'), null, { timeout: 30000 });
      await page.waitForTimeout(1500);
      const label = await page.textContent('.twin-label.without');
      console.log(id, '->', label);
      await page.screenshot({ path: `${out}/demo-${id}.png` });
    }
    await page.fill('.twin-scrub input', '6');
    await page.waitForTimeout(300);
    console.log('day 6 labels:', await page.textContent('.twin-label.without'), '|', await page.textContent('.twin-label.with'));
    await page.screenshot({ path: `${out}/demo-scrub.png` });
    await page.goto(base + '#/demo/classic');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}/demo-classic.png` });
  }
  await page.close();
}
await browser.close();
console.log(errors.length ? errors.join('\n') : 'no console errors or warnings');
