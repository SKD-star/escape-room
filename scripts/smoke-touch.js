/**
 * smoke-touch.js — mobile/touch smoke test.
 * Forces touch detection, loads the game in a landscape phone viewport,
 * plays into a room, and asserts the on-screen touch controls appear.
 */
import puppeteer from 'puppeteer-core';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const { existsSync } = await import('node:fs');
const executablePath = existsSync(CHROME) ? CHROME : EDGE;
const URL = process.env.SMOKE_URL || 'http://localhost:3001';

const errors = [];
const browser = await puppeteer.launch({
  executablePath, headless: true,
  args: ['--use-gl=angle', '--enable-webgl', '--enable-unsafe-swiftshader',
    '--no-sandbox', '--window-size=900,420', '--mute-audio'],
});
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 420, hasTouch: true, isMobile: true });

// Force touch/coarse-pointer detection before any app code runs
await page.evaluateOnNewDocument(() => {
  Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
  const orig = window.matchMedia.bind(window);
  window.matchMedia = (q) => (q.includes('coarse')
    ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }
    : orig(q));
});

page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));

console.log(`[touch] loading ${URL} …`);
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });

const boot = await page.waitForFunction(
  () => document.querySelector('#main-menu')?.classList.contains('visible'),
  { timeout: 45000 }).then(() => true).catch(() => false);
console.log('[touch] menu visible:', boot);

let touchVisible = false, controlsPresent = false;
if (boot) {
  await page.click('[data-action="new"]');
  await page.waitForFunction(
    () => document.querySelector('#difficulty-screen')?.classList.contains('visible'),
    { timeout: 8000 }).catch(() => {});
  await page.click('[data-mode="normal"]').catch(() => {});
  await page.waitForFunction(
    () => document.querySelector('#intro-screen')?.classList.contains('visible'),
    { timeout: 8000 }).catch(() => {});
  await page.click('#intro-screen [data-action="skip"]').catch(() => {});
  const hud = await page.waitForFunction(
    () => document.querySelector('#hud')?.classList.contains('visible'),
    { timeout: 30000 }).then(() => true).catch(() => false);
  console.log('[touch] in-game (HUD):', hud);

  if (hud) {
    await new Promise((r) => setTimeout(r, 2500));
    const res = await page.evaluate(() => {
      const tc = document.getElementById('touch-controls');
      return {
        present: !!tc,
        visible: !!tc && tc.classList.contains('visible'),
        joy: !!document.querySelector('.tc-joy'),
        interact: !!document.querySelector('.tc-interact'),
        look: !!document.querySelector('.tc-look'),
      };
    });
    controlsPresent = res.present && res.joy && res.interact && res.look;
    touchVisible = res.visible;
    console.log('[touch] controls:', JSON.stringify(res));

    // Tap the interact button to confirm it accepts input without throwing
    const box = await page.evaluate(() => {
      const b = document.querySelector('.tc-interact')?.getBoundingClientRect();
      return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null;
    });
    if (box) { await page.touchscreen.tap(box.x, box.y); console.log('[touch] tapped interact'); }
    await new Promise((r) => setTimeout(r, 800));
  }
}

console.log(`\n[touch] ${errors.length} console error(s):`);
for (const e of [...new Set(errors)].slice(0, 20)) console.log('  x', e.slice(0, 240));

const ok = boot && controlsPresent && touchVisible && errors.length === 0;
console.log(`\n[touch] RESULT: ${ok ? 'PASS' : 'FAIL'} (controls present=${controlsPresent}, visible=${touchVisible})`);
await browser.close();
process.exit(ok ? 0 : 1);
