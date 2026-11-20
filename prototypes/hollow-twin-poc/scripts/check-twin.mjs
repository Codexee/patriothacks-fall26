// Smoke test for the #/demo workstation: loads it at 1440×900 and 375 px, switches disasters and seeds, opens every
// bottom tab and a section card, checks that panels have content and that there are no console errors.
// Usage: node scripts/check-twin.mjs <base url> <out dir>
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:5194/';
const out = process.argv[3] ?? '.';
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const errors = [];
const ready = (page) => page.waitForFunction(() => !document.querySelector('.ws-loading') && document.querySelector('.ws-view canvas'), null, { timeout: 60000 });
const counts = (page) => page.evaluate(() => ({
  charts: document.querySelectorAll('.ws-right .ws-cblock').length,
  paths: document.querySelectorAll('.ws-right svg path').length,
  inspector: document.querySelectorAll('.ws-left .ws-kv tr').length,
  logRows: document.querySelectorAll('.ws-log tbody tr').length,
  status: document.querySelector('.ws-status')?.textContent,
  labels: [...document.querySelectorAll('.ws-label')].map((e) => e.textContent),
}));
for (const vp of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 375, height: 812 }]) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && !m.text().includes('GL Driver'))) errors.push(`${vp.name} ${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${vp.name} pageerror: ${e.message}`));
  await page.goto(base + '#/demo');
  await ready(page);
  await page.click('.ws-btn.primary'); // pause
  await page.fill('.ws-scrub input', '12');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/ws-${vp.name}-twoplants.png`, fullPage: vp.name === 'mobile' });
  console.log(vp.name, 'overflow px:', await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth));
  console.log(vp.name, 'twoplants', JSON.stringify(await counts(page)));
  if (vp.name === 'desktop') {
    for (const id of ['aging', 'baseline']) {
      await page.selectOption('.ws-toolbar select >> nth=0', id);
      await ready(page);
      await page.click('.ws-btn.primary');
      await page.fill('.ws-scrub input', id === 'aging' ? '40' : '20');
      await page.waitForTimeout(400);
      console.log(id, JSON.stringify(await counts(page)));
      await page.screenshot({ path: `${out}/ws-desktop-${id}.png` });
    }
    await page.selectOption('.ws-toolbar select >> nth=1', '3');
    await ready(page);
    await page.click('.ws-btn.primary');
    await page.fill('.ws-scrub input', '20');
    await page.waitForTimeout(300);
    console.log('seed 3', await page.textContent('.ws-status'));
    for (const tab of ['Module output', 'Observations', 'Sections']) {
      await page.click(`.ws-tabs button:has-text("${tab}")`);
      await page.waitForTimeout(200);
      console.log(tab, 'rows', await page.locator('.ws-tabpanel tbody tr').count());
      await page.screenshot({ path: `${out}/ws-tab-${tab.split(' ')[0].toLowerCase()}.png`, clip: { x: 0, y: 560, width: 1440, height: 340 } });
    }
    await page.click('.ws-sections tbody tr >> nth=0');
    await page.waitForTimeout(300);
    console.log('card:', (await page.textContent('.ws-card'))?.slice(0, 160));
    await page.screenshot({ path: `${out}/ws-desktop-card.png` });
    await page.mouse.click(700, 400);
    await page.waitForTimeout(300);
    await page.selectOption('.ws-toolbar select >> nth=3', 'with');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/ws-desktop-withonly.png` });
  }
  await page.close();
}
await browser.close();
console.log(errors.length ? errors.join('\n') : 'no console errors or warnings');
