/**
 * smoke.js — headless browser smoke test.
 * Loads the game, captures console errors, clicks through
 * New Game → difficulty → intro skip → gameplay, and reports.
 */
import puppeteer from 'puppeteer-core';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const { existsSync } = await import('node:fs');
const executablePath = existsSync(CHROME) ? CHROME : EDGE;

const errors = [];
const warnings = [];

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: [
    '--use-gl=angle', '--enable-webgl', '--enable-unsafe-swiftshader',
    '--no-sandbox', '--window-size=1280,800', '--mute-audio',
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

page.on('console', (msg) => {
  const text = msg.text();
  if (msg.type() === 'error') errors.push(text);
  if (msg.type() === 'warning') warnings.push(text);
});
page.on('pageerror', (err) => errors.push(`PAGEERROR: ${err.message}`));
page.on('requestfailed', (req) => {
  if (!req.url().includes('favicon')) {
    warnings.push(`REQFAIL: ${req.url()} — ${req.failure()?.errorText}`);
  }
});

const URL = process.env.SMOKE_URL || 'http://localhost:3000';
console.log(`[smoke] loading ${URL} …`);
// domcontentloaded (not networkidle2): offline builds keep retrying /api so
// the network never goes fully idle.
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

// Wait for boot: main menu should become visible
const bootOk = await page.waitForFunction(
  () => document.querySelector('#main-menu')?.classList.contains('visible'),
  { timeout: 45000 },
).then(() => true).catch(() => false);
console.log(`[smoke] main menu visible: ${bootOk}`);

if (bootOk) {
  // New Game → difficulty screen
  await page.click('[data-action="new"]');
  const diffOk = await page.waitForFunction(
    () => document.querySelector('#difficulty-screen')?.classList.contains('visible'),
    { timeout: 8000 },
  ).then(() => true).catch(() => false);
  console.log(`[smoke] difficulty screen: ${diffOk}`);

  if (diffOk) {
    await page.click('[data-mode="normal"]');
    // Skip the intro
    await page.waitForFunction(
      () => document.querySelector('#intro-screen')?.classList.contains('visible'),
      { timeout: 8000 },
    ).catch(() => {});
    await page.click('#intro-screen [data-action="skip"]').catch(() => {});
    // Wait for HUD = in-game
    const hudOk = await page.waitForFunction(
      () => document.querySelector('#hud')?.classList.contains('visible'),
      { timeout: 30000 },
    ).then(() => true).catch(() => false);
    console.log(`[smoke] in-game (HUD visible): ${hudOk}`);

    if (hudOk) {
      // Let the game run a few seconds to shake out frame-loop errors
      await new Promise((r) => setTimeout(r, 6000));
      const state = await page.evaluate(() => ({
        state: window.__game?.state,
        room: window.__game?.rooms?.currentKey,
        fps: 'running',
      }));
      console.log('[smoke] game state:', JSON.stringify(state));
    }
  }
}

console.log(`\n[smoke] ${errors.length} console error(s):`);
for (const e of [...new Set(errors)].slice(0, 30)) console.log('  ✗', e.slice(0, 300));
console.log(`[smoke] ${warnings.length} warning(s):`);
for (const w of [...new Set(warnings)].slice(0, 10)) console.log('  ⚠', w.slice(0, 200));

await browser.close();
process.exit(errors.length ? 1 : 0);
