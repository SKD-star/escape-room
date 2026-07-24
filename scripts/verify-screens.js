/**
 * verify-screens.js — responsive overflow check for the full-screen UIs
 * (menu, difficulty, settings, pause) on phone viewports. Flags any visible
 * element whose box spills outside the viewport width/height.
 */
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const executablePath = existsSync(CHROME) ? CHROME : EDGE;
const URL = process.env.SMOKE_URL || 'http://localhost:3001';
const VIEWPORTS = [
  { name: 'phone-landscape', w: 844, h: 390 },
  { name: 'phone-portrait', w: 390, h: 844 },
];

const scanScreen = (screenId, vpW, vpH) => {
  const root = document.getElementById(screenId);
  if (!root || !root.classList.contains('visible')) return { missing: true };
  const bad = [];
  root.querySelectorAll('*').forEach((el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.05) return;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const overRight = r.right - vpW, overLeft = -r.left;
    if (overRight > 2 || overLeft > 2) {
      const cls = (el.className || '').toString().split(' ')[0] || el.tagName.toLowerCase();
      bad.push(`${cls}: x[${r.left | 0}..${r.right | 0}] (vw ${vpW})`);
    }
  });
  // de-dup similar
  return { bad: [...new Set(bad)].slice(0, 8) };
};

const browser = await puppeteer.launch({
  executablePath, headless: true,
  args: ['--use-gl=angle', '--enable-webgl', '--enable-unsafe-swiftshader', '--no-sandbox', '--mute-audio'],
});

let anyFail = false;
for (const vp of VIEWPORTS) {
  const page = await browser.newPage();
  await page.setViewport({ width: vp.w, height: vp.h, hasTouch: true, isMobile: true });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
    const orig = window.matchMedia.bind(window);
    window.matchMedia = (q) => (q.includes('coarse')
      ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }
      : orig(q));
  });
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('#main-menu')?.classList.contains('visible'), { timeout: 45000 });

  const checks = [];
  checks.push(['main-menu', await page.evaluate(scanScreen, 'main-menu', vp.w, vp.h)]);

  // Settings screen
  await page.click('[data-action="settings"]').catch(() => {});
  await new Promise((r) => setTimeout(r, 500));
  checks.push(['settings-screen', await page.evaluate(scanScreen, 'settings-screen', vp.w, vp.h)]);
  // back to menu
  await page.click('#settings-screen [data-action="back"], #settings-screen .btn').catch(() => {});
  await new Promise((r) => setTimeout(r, 400));

  // Difficulty
  await page.evaluate(() => document.querySelector('#main-menu [data-action="new"]')?.click());
  await new Promise((r) => setTimeout(r, 500));
  checks.push(['difficulty-screen', await page.evaluate(scanScreen, 'difficulty-screen', vp.w, vp.h)]);

  // Into the game, then in-game overlays: pause + manual
  const scanVisibleTop = (vpW, vpH, excludeId) => {
    const vis = [...document.querySelectorAll('.screen.visible')].filter((s) => s.id !== 'hud' && s.id !== excludeId);
    const root = vis[vis.length - 1];
    if (!root) return { missing: true, id: '(none visible)' };
    // element sits inside a NON-root scroll region (designed internal scroll)?
    const inScrollRegion = (el) => {
      let p = el.parentElement;
      while (p && p !== root) {
        const os = getComputedStyle(p);
        if ((os.overflowY === 'auto' || os.overflowY === 'scroll') && p.scrollHeight > p.clientHeight + 2) return true;
        p = p.parentElement;
      }
      return false;
    };
    const bad = [];
    root.querySelectorAll('*').forEach((el) => {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.05) return;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      if (inScrollRegion(el)) return; // reachable via internal scroll
      if (r.right - vpW > 2 || -r.left > 2 || r.bottom - vpH > 2 || -r.top > 2) {
        const cls = (el.className || '').toString().split(' ')[0] || el.tagName.toLowerCase();
        bad.push(`${cls}: x[${r.left | 0}..${r.right | 0}] y[${r.top | 0}..${r.bottom | 0}]`);
      }
    });
    return { id: root.id, bad: [...new Set(bad)].slice(0, 8) };
  };

  await page.click('[data-mode="normal"]').catch(() => {});
  await page.waitForFunction(() => document.querySelector('#intro-screen')?.classList.contains('visible'), { timeout: 8000 }).catch(() => {});
  await page.click('#intro-screen [data-action="skip"]').catch(() => {});
  await page.waitForFunction(() => document.querySelector('#hud')?.classList.contains('visible'), { timeout: 30000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 800));

  // Pause
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 500));
  { const res = await page.evaluate(scanVisibleTop, vp.w, vp.h, null); checks.push([res.id || 'pause', res]); }
  // Manual from pause (if a button exists)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.screen.visible button')].find((b) => /manual|field/i.test(b.textContent));
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  { const res = await page.evaluate(scanVisibleTop, vp.w, vp.h, 'pause-menu'); if (!res.missing) checks.push([res.id || 'manual', res]); }

  console.log(`\n=== ${vp.name} (${vp.w}x${vp.h}) ===`);
  for (const [id, res] of checks) {
    if (res.missing) { console.log(`  [skip] ${id} (not shown)`); continue; }
    if (!res.bad || res.bad.length === 0) { console.log(`  [ok]   ${id}`); continue; }
    anyFail = true;
    console.log(`  [⚠]   ${id}`);
    for (const b of res.bad) console.log('        -', b);
  }
  await page.close();
}

await browser.close();
process.exit(anyFail ? 1 : 0);
