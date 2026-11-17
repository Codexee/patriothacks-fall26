// PROTOTYPE driver: opens the bench page in the system Chrome for each config and saves results.json.
// Usage: npx vite (in another shell), then: node run-bench.mjs
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const CONFIGS = [
  ['edge', 'quint8', 'wasm'], ['edge', 'fp32', 'wasm'], ['edge', 'fp32', 'webgpu'], ['edge', 'fp16', 'webgpu'],
  ['small', 'quint8', 'wasm'], ['small', 'fp32', 'wasm'], ['small', 'fp32', 'webgpu'],
  ['edge', 'quint8', 'wasm', 1], // single thread: worst case (no cross-origin isolation, weak laptop)
  ['edge', 'quint8', 'wasm', 0, 0.3], ['small', 'quint8', 'wasm', 0, 0.3], // lower threshold: recall check
];

const browser = await chromium.launch({
  channel: 'chrome', headless: process.env.HEADLESS !== '0',
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU'],
});
const results = [];
for (const [model, dtype, ep, threads, th] of CONFIGS) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('  pageerror', e.message));
  const url = `http://localhost:5199/?auto=1&model=${model}&dtype=${dtype}&ep=${ep}${threads ? `&threads=${threads}` : ''}${th ? `&th=${th}` : ''}`;
  console.log('→', model, dtype, ep, threads || 'all threads', 'th=' + (th || 0.5));
  await page.goto(url);
  try {
    await page.waitForFunction(() => window.__result || window.__error, null, { timeout: 300_000 });
  } catch { console.log('  timeout'); }
  const r = await page.evaluate(() => window.__result || { error: window.__error });
  const text = await page.locator('#out').textContent();
  console.log(text.split('\n').map((l) => '  ' + l).join('\n'));
  results.push({ model, dtype, ep, threads: threads || 'all', th: th || 0.5, ...r });
  await page.close();
}
await browser.close();
writeFileSync('results.json', JSON.stringify(results, null, 2));
console.log('saved results.json');
