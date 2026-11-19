// `npm run films`: renders the 3D twin's film frame (#/film/<id>) for each disaster to an MP4, frame by frame.
// It builds the app and starts `vite preview` (or uses --url), opens each film page in headless Chromium at
// 1920×1080, steps 450 frames (30 fps × 15 s) with window.__film.seek(t), screenshots each frame and pipes the frames
// to ffmpeg: video/assets/footage/<id>.mp4 (H.264, yuv420p, 30 fps, crf 18) plus <id>.json (one point per day).
//
// Options:
//   --url <base>        use a running server (for example http://localhost:5194/) instead of build + preview
//   --only a,b          only these disaster ids
//   --frames <n>        frames per film (default 450; a smaller number is for tests)
//   --gl <mode>         Chromium GL: "default" (the Mac's GPU, through ANGLE/Metal) or "swiftshader" (CPU)
//   --out <dir>         output folder (default: <repo>/video/assets/footage)
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, '..');
const repo = resolve(app, '../..');
const IDS = ['twoplants', 'elliott', 'cascade', 'slowloss', 'aging', 'crowding', 'baseline'];
const FPS = 30;

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const ids = (opt('only', '') || IDS.join(',')).split(',').filter(Boolean);
const frames = Number(opt('frames', String(FPS * 15)));
const gl = opt('gl', 'default');
const out = resolve(opt('out', resolve(repo, 'video/assets/footage')));
let base = opt('url', '');

const run = (cmd, argv, opts = {}) => new Promise((ok, fail) => {
  const p = spawn(cmd, argv, { cwd: app, stdio: 'inherit', ...opts });
  p.on('exit', (code) => (code === 0 ? ok() : fail(new Error(`${cmd} ${argv.join(' ')} exited with ${code}`))));
});

let preview = null;
if (!base) {
  console.log('Building the app…');
  await run('npx', ['vite', 'build']);
  const port = 4179;
  preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { cwd: app, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((ok, fail) => {
    const t = setTimeout(() => fail(new Error('vite preview did not start in 30 s')), 30000);
    preview.stdout.on('data', (d) => { if (String(d).includes(`${port}`)) { clearTimeout(t); ok(); } });
    preview.on('exit', (c) => fail(new Error(`vite preview exited with ${c}`)));
  });
  base = `http://localhost:${port}/`;
}
if (!base.endsWith('/')) base += '/';

const glArgs = gl === 'swiftshader'
  ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  : ['--ignore-gpu-blocklist', '--enable-gpu'];
const browser = await chromium.launch({ args: glArgs });
await mkdir(out, { recursive: true });

const timings = [];
try {
  for (const id of ids) {
    const t0 = Date.now();
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${base}#/film/${id}`);
    await page.waitForFunction(() => !!window.__film, null, { timeout: 30000 });
    await page.evaluate(() => window.__film.ready);
    const meta = await page.evaluate(() => window.__film.meta);
    if (!meta) throw new Error(`${id}: the film page has no meta (${errors.join('; ')})`);

    // The canvas must not be blank: count pixels that differ from the background in the first frame.
    await page.evaluate(() => window.__film.seek(0));
    const lit = await page.evaluate(() => {
      const c = document.querySelector('.film-frame canvas');
      const tmp = document.createElement('canvas');
      tmp.width = 480; tmp.height = 270;
      const g = tmp.getContext('2d');
      g.drawImage(c, 0, 0, 480, 270);
      const px = g.getImageData(0, 0, 480, 270).data;
      let n = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 120) n++;
      return n / (480 * 270);
    });
    if (lit < 0.01) throw new Error(`${id}: the canvas looks blank (${(lit * 100).toFixed(2)}% lit pixels). Try --gl swiftshader.`);

    const mp4 = resolve(out, `${id}.mp4`);
    const ff = spawn('ffmpeg', [
      '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-r', String(FPS), '-movflags', '+faststart', mp4,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const ffDone = new Promise((ok, fail) => ff.on('exit', (c) => (c === 0 ? ok() : fail(new Error(`ffmpeg exited with ${c}`)))));
    for (let i = 0; i < frames; i++) {
      await page.evaluate((t) => window.__film.seek(t), i / FPS);
      const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080 } });
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
      if (i % 90 === 0) process.stdout.write(`  ${id}: frame ${i}/${frames}\n`);
    }
    ff.stdin.end();
    await ffDone;
    await writeFile(resolve(out, `${id}.json`), JSON.stringify(meta, null, 2) + '\n');
    await page.close();
    if (errors.length) console.warn(`  ${id}: page errors: ${errors.join('; ')}`);
    const s = (Date.now() - t0) / 1000;
    timings.push({ id, seed: meta.seed, days: meta.days, seconds: Math.round(s), lit: `${(lit * 100).toFixed(1)}%` });
    console.log(`${id}: seed ${meta.seed}, ${meta.days} days, ${frames} frames in ${s.toFixed(1)} s → ${mp4}`);
  }
} finally {
  await browser.close();
  preview?.kill();
}
console.table(timings);
