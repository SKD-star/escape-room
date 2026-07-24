/**
 * verify-mobile.js — strict mobile HUD + touch-control overlap audit.
 * Emulates a real touch device (coarse pointer, hasTouch) so the SAME CSS
 * paths as a phone/tablet apply. Forces every HUD widget visible, then checks
 * ALL visible HUD + touch controls for pairwise overlap and out-of-viewport,
 * across several real device sizes (landscape + portrait).
 */
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const executablePath = existsSync(CHROME) ? CHROME : EDGE;
const URL = process.env.SMOKE_URL || 'http://localhost:3001';

const SIZES = [
  { name: 'lg-phone-ls', w: 932, h: 430 },
  { name: 'pixel-ls', w: 915, h: 412 },
  { name: 'iphone-ls', w: 844, h: 390 },
  { name: 'small-ls', w: 740, h: 360 },
  { name: 'se-ls', w: 667, h: 375 },
  { name: 'tablet-ls', w: 1024, h: 768 },
  { name: 'phone-pt', w: 390, h: 844 },
  { name: 'small-pt', w: 360, h: 740 },
];

// selectors that should never overlap each other (look layer & containers excluded)
const SEL = {
  objective: '.hud-objective', title: '.hud-room-title', briefing: '.hud-briefing',
  toasts: '.hud-toast-stack', stamina: '.hud-stamina', sanity: '.hud-sanity',
  flashlight: '.hud-flashlight', compass: '.hud-compass', timer: '.hud-timer',
  countdown: '.hud-countdown',
  joy: '.tc-joy', sprint: '.tc-sprint', crouch: '.tc-crouch',
  interact: '.tc-interact', jump: '.tc-jump', torch: '.tc-torch',
  pause: '.tc-top-btns',
};

const browser = await puppeteer.launch({
  executablePath, headless: true,
  args: ['--use-gl=angle', '--enable-webgl', '--enable-unsafe-swiftshader', '--no-sandbox', '--mute-audio'],
});

let anyFail = false;
for (const vp of SIZES) {
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
  await page.click('[data-mode="nightmare"]').catch(() => page.click('[data-mode="normal"]').catch(() => {}));
  await page.waitForFunction(() => document.querySelector('#intro-screen')?.classList.contains('visible'), { timeout: 8000 }).catch(() => {});
  await page.click('#intro-screen [data-action="skip"]').catch(() => {});
  await page.waitForFunction(() => document.querySelector('#hud')?.classList.contains('visible'), { timeout: 30000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1500));

  const report = await page.evaluate((SEL, VP) => {
    // Portrait shows a full-screen "rotate device" hint that covers play.
    const hint = document.getElementById('orientation-hint');
    if (hint && getComputedStyle(hint).display !== 'none') {
      const r = hint.getBoundingClientRect();
      if (r.width >= VP.w - 2 && r.height >= VP.h - 2) return { covered: true, problems: [], present: [] };
    }
    // Force every conditional HUD widget visible for measurement
    const show = (q, ...cls) => { const e = document.querySelector(q); if (e) e.classList.add('visible', ...cls); };
    show('.hud-stamina'); show('.hud-sanity'); show('.hud-flashlight', 'on');
    show('.hud-compass'); show('.hud-timer'); show('.hud-countdown');
    const rt = document.querySelector('.hud-room-title');
    if (rt) { rt.style.opacity = 1; rt.querySelector('h2').textContent = 'THE HAUNTED LIBRARY'; rt.querySelector('p').textContent = 'CHAPTER I'; }
    const brf = document.querySelector('.hud-briefing');
    if (brf) { brf.classList.add('visible'); brf.style.opacity = 1; }
    const ts = document.querySelector('.hud-toast-stack');
    if (ts) ts.innerHTML = '<div class="toast">Flashlight raised — press F to toggle it.</div>';

    const rect = (q) => {
      const e = document.querySelector(q);
      if (!e) return null;
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.05) return null;
      const r = e.getBoundingClientRect();
      return (r.width > 1 && r.height > 1) ? r : null;
    };
    const rects = {};
    for (const [k, q] of Object.entries(SEL)) rects[k] = rect(q);

    const ov = (a, b) => {
      if (!a || !b) return 0;
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return x * y;
    };
    const keys = Object.keys(SEL);
    const problems = [];
    for (const [k, r] of Object.entries(rects)) {
      if (!r) continue;
      if (r.right > VP.w + 2 || r.left < -2 || r.bottom > VP.h + 2 || r.top < -2)
        problems.push(`OFFSCREEN ${k}: x[${r.left | 0}..${r.right | 0}] y[${r.top | 0}..${r.bottom | 0}]`);
    }
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const area = ov(rects[keys[i]], rects[keys[j]]);
        if (area > 180) problems.push(`OVERLAP ${keys[i]}×${keys[j]} = ${area | 0}`);
      }
    }
    return { problems, present: keys.filter((k) => rects[k]) };
  }, SEL, vp);

  if (report.covered) { console.log(`\n[ok] ${vp.name} (${vp.w}x${vp.h}) — portrait: rotate-device hint covers play`); await page.close(); continue; }
  const ok = report.problems.length === 0;
  if (!ok) anyFail = true;
  console.log(`\n[${ok ? 'ok' : '⚠'}] ${vp.name} (${vp.w}x${vp.h})`);
  for (const p of report.problems) console.log('   -', p);
  await page.close();
}

await browser.close();
process.exit(anyFail ? 1 : 0);
