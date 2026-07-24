/**
 * audit-rooms.js — data-driven room correctness audit (no rendering).
 * Loads each room and inspects the Three.js scene graph for:
 *   - spawn point inside the room
 *   - puzzle anchor / exit door / objective markers present & placed
 *   - props sunk under the floor or poking above the ceiling
 *   - solid props whose bounds punch well outside the walls
 * Reports findings so we fix real geometry issues, not guesses.
 */
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const executablePath = existsSync(CHROME) ? CHROME : EDGE;
const URL = process.env.SMOKE_URL || 'http://localhost:3001';
const KEYS = ['haunted_library', 'ancient_temple', 'prison', 'laboratory', 'hospital',
  'mansion', 'castle', 'bunker', 'cyber_facility', 'boss_room'];

const browser = await puppeteer.launch({
  executablePath, headless: true,
  args: ['--use-gl=angle', '--enable-webgl', '--enable-unsafe-swiftshader',
    '--no-sandbox', '--window-size=800,600', '--mute-audio'],
});
const page = await browser.newPage();
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForFunction(() => document.querySelector('#main-menu')?.classList.contains('visible'), { timeout: 45000 });
await page.click('[data-action="new"]');
await page.waitForFunction(() => document.querySelector('#difficulty-screen')?.classList.contains('visible'), { timeout: 8000 }).catch(() => {});
await page.click('[data-mode="normal"]').catch(() => {});
await page.waitForFunction(() => document.querySelector('#intro-screen')?.classList.contains('visible'), { timeout: 8000 }).catch(() => {});
await page.click('#intro-screen [data-action="skip"]').catch(() => {});
await page.waitForFunction(() => document.querySelector('#hud')?.classList.contains('visible'), { timeout: 30000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 800));

const results = {};
for (const key of KEYS) {
  await page.evaluate(async (k) => { await window.__game.rooms.load(k); }, key);
  await new Promise((r) => setTimeout(r, 700));
  results[key] = await page.evaluate(() => {
    const THREE = window.__THREE || null;
    const room = window.__game.rooms.current;
    const g = room.group;
    const { width: w, depth: d, height: h } = room.size;
    const sp = room.spawn;
    const findings = [];
    const box = new (window.THREE_Box3 || function () {})();
    // Fallback: use bounding boxes via traverse with manual computation
    const Box3 = room.__Box3 || null;
    // Use three from the room's meshes
    const tmpMin = { x: Infinity, y: Infinity, z: Infinity };

    const inBounds = Math.abs(sp.x) <= w / 2 && Math.abs(sp.z) <= d / 2 && sp.y > 0 && sp.y < h;
    if (!inBounds) findings.push(`spawn (${sp.x.toFixed(1)},${sp.y.toFixed(1)},${sp.z.toFixed(1)}) outside room ${w}x${d}x${h}`);
    if (!room.puzzleAnchor) findings.push('NO puzzleAnchor');
    if (!room.exitDoor) findings.push('NO exitDoor');
    if (!room.puzzleMarker) findings.push('NO puzzleMarker');
    if (!room.exitMarker) findings.push('NO exitMarker');

    // Geometry scan using three's Box3 pulled off any mesh's constructor chain
    let sunk = 0, above = 0, outside = 0; const worst = [];
    g.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      // skip invisible aim-assist proxies and hidden meshes — not real geometry
      if (o.material && o.material.visible === false) return;
      if (o.visible === false) return;
      if (o.geometry.boundingBox === null) o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox;
      if (!bb) return;
      // world-space AABB from ALL 8 corners (correct for rotated meshes)
      o.updateWorldMatrix(true, false);
      const lo = { x: Infinity, y: Infinity, z: Infinity };
      const hi = { x: -Infinity, y: -Infinity, z: -Infinity };
      for (let cx = 0; cx < 2; cx++) for (let cy = 0; cy < 2; cy++) for (let cz = 0; cz < 2; cz++) {
        const c = new bb.min.constructor(cx ? bb.max.x : bb.min.x, cy ? bb.max.y : bb.min.y, cz ? bb.max.z : bb.min.z);
        c.applyMatrix4(o.matrixWorld);
        lo.x = Math.min(lo.x, c.x); lo.y = Math.min(lo.y, c.y); lo.z = Math.min(lo.z, c.z);
        hi.x = Math.max(hi.x, c.x); hi.y = Math.max(hi.y, c.y); hi.z = Math.max(hi.z, c.z);
      }
      const size = { x: hi.x - lo.x, y: hi.y - lo.y, z: hi.z - lo.z };
      // ignore the big shell planes & particles (very large single dimension)
      const huge = size.x > w * 0.95 || size.z > d * 0.95;
      if (huge) return;
      if (lo.y < -0.25) { sunk++; if (lo.y < -0.6) worst.push(`sunk y=${lo.y.toFixed(2)} ${o.name || o.type}`); }
      if (hi.y > h + 0.25) { above++; if (hi.y > h + 0.8) worst.push(`above y=${hi.y.toFixed(2)} ${o.name || o.type}`); }
      const outX = hi.x > w / 2 + 0.5 || lo.x < -w / 2 - 0.5;
      const outZ = hi.z > d / 2 + 0.5 || lo.z < -d / 2 - 0.5;
      if (outX || outZ) { outside++; if ((hi.x > w / 2 + 1) || (lo.x < -w / 2 - 1) || (hi.z > d / 2 + 1) || (lo.z < -d / 2 - 1)) worst.push(`outside x[${lo.x.toFixed(1)},${hi.x.toFixed(1)}] z[${lo.z.toFixed(1)},${hi.z.toFixed(1)}] ${o.type}`); }
    });
    if (sunk) findings.push(`${sunk} mesh(es) under floor`);
    if (above) findings.push(`${above} mesh(es) above ceiling`);
    if (outside) findings.push(`${outside} mesh(es) beyond walls`);
    return { findings, worst: worst.slice(0, 8) };
  });
  const r = results[key];
  const flag = r.findings.length ? '⚠' : 'ok';
  console.log(`\n[${flag}] ${key}`);
  for (const f of r.findings) console.log('   -', f);
  for (const wst of r.worst) console.log('      ·', wst);
}

await browser.close();
