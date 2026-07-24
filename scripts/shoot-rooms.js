/**
 * shoot-rooms.js — capture a first-person screenshot of every room so we can
 * eyeball polish/accuracy. Starts a normal game, then jumps room→room via
 * the exposed window.__game API. Writes PNGs to scripts/_shots/.
 */
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const executablePath = existsSync(CHROME) ? CHROME : EDGE;
const URL = process.env.SMOKE_URL || 'http://localhost:3001';
const OUT = 'scripts/_shots';
mkdirSync(OUT, { recursive: true });

const KEYS = ['haunted_library', 'ancient_temple', 'prison', 'laboratory', 'hospital',
  'mansion', 'castle', 'bunker', 'cyber_facility', 'boss_room'];

const browser = await puppeteer.launch({
  executablePath, headless: true,
  args: ['--use-gl=angle', '--enable-webgl', '--enable-unsafe-swiftshader',
    '--no-sandbox', '--window-size=1280,720', '--mute-audio'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForFunction(() => document.querySelector('#main-menu')?.classList.contains('visible'), { timeout: 45000 });
// Start a normal game to bring all systems + lighting online
await page.click('[data-action="new"]');
await page.waitForFunction(() => document.querySelector('#difficulty-screen')?.classList.contains('visible'), { timeout: 8000 }).catch(() => {});
await page.click('[data-mode="normal"]').catch(() => {});
await page.waitForFunction(() => document.querySelector('#intro-screen')?.classList.contains('visible'), { timeout: 8000 }).catch(() => {});
await page.click('#intro-screen [data-action="skip"]').catch(() => {});
await page.waitForFunction(() => document.querySelector('#hud')?.classList.contains('visible'), { timeout: 30000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 1500));

for (const key of KEYS) {
  const loaded = await page.evaluate(async (k) => {
    const g = window.__game;
    try { await g.rooms.load(k); g.player.enabled = true; return true; }
    catch (e) { return String(e); }
  }, key);
  // let the room build, lighting settle, a couple frames of flicker
  await new Promise((r) => setTimeout(r, 1400));
  // sweep to look slightly toward content, capture two angles
  for (const [i, yaw] of [[0, 0], [1, Math.PI]]) {
    await page.evaluate((y) => { window.__game.player.yaw = y; }, yaw);
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: `${OUT}/${key}_${i}.png` });
  }
  console.log(`[shot] ${key}: ${loaded === true ? 'ok' : loaded}`);
}

console.log(`[shot] page errors: ${errors.length}`);
for (const e of [...new Set(errors)].slice(0, 10)) console.log('  x', e.slice(0, 200));
await browser.close();
