/**
 * verify-hud.js — measure in-game HUD element rectangles on phone viewports
 * and report overlaps / out-of-viewport panels. Layout works headless even
 * though WebGL doesn't render, so this reliably catches HUD collisions.
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
  { name: 'small-window', w: 900, h: 560 },
];

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
  await page.click('[data-action="new"]');
  await page.waitForFunction(() => document.querySelector('#difficulty-screen')?.classList.contains('visible'), { timeout: 8000 }).catch(() => {});
  await page.click('[data-mode="normal"]').catch(() => {});
  await page.waitForFunction(() => document.querySelector('#intro-screen')?.classList.contains('visible'), { timeout: 8000 }).catch(() => {});
  await page.click('#intro-screen [data-action="skip"]').catch(() => {});
  await page.waitForFunction(() => document.querySelector('#hud')?.classList.contains('visible'), { timeout: 30000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2200)); // briefing in, title still up

  const report = await page.evaluate((VP) => {
    const sel = {
      objective: '.hud-objective', title: '.hud-room-title', briefing: '.hud-briefing',
      toasts: '.hud-toast-stack', joystick: '.tc-joy', interact: '.tc-interact',
      sanity: '.hud-sanity', flashlight: '.hud-flashlight',
    };
    const vis = (el) => {
      if (!el) return false;
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.05) return false;
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    };
    const rects = {};
    for (const [k, q] of Object.entries(sel)) {
      const el = document.querySelector(q);
      rects[k] = (el && vis(el)) ? el.getBoundingClientRect() : null;
    }
    const overlapArea = (a, b) => {
      if (!a || !b) return 0;
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return x * y;
    };
    const problems = [];
    // out of viewport
    for (const [k, r] of Object.entries(rects)) {
      if (!r) continue;
      if (r.right > VP.w + 1 || r.left < -1 || r.bottom > VP.h + 1 || r.top < -1) {
        problems.push(`${k} out of viewport: [${r.left|0},${r.top|0},${r.right|0},${r.bottom|0}] vp ${VP.w}x${VP.h}`);
      }
    }
    // pairwise overlaps that matter
    const pairs = [
      ['objective', 'title'], ['objective', 'briefing'], ['title', 'briefing'],
      ['briefing', 'toasts'], ['briefing', 'joystick'], ['briefing', 'interact'],
      ['objective', 'toasts'], ['toasts', 'title'],
    ];
    for (const [a, b] of pairs) {
      const area = overlapArea(rects[a], rects[b]);
      if (area > 120) problems.push(`OVERLAP ${a}×${b} = ${area | 0}px²`);
    }
    return { problems, present: Object.fromEntries(Object.entries(rects).map(([k, r]) => [k, !!r])) };
  }, vp);

  const ok = report.problems.length === 0;
  if (!ok) anyFail = true;
  console.log(`\n[${ok ? 'ok' : '⚠'}] ${vp.name} (${vp.w}x${vp.h})  present: ${Object.entries(report.present).filter(([, v]) => v).map(([k]) => k).join(', ')}`);
  for (const p of report.problems) console.log('   -', p);
  await page.close();
}

await browser.close();
process.exit(anyFail ? 1 : 0);
