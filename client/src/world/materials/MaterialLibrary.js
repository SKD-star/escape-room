/**
 * MaterialLibrary — procedural PBR materials generated on canvas.
 * Every texture (albedo, roughness variation, normal-ish detail) is
 * synthesized at runtime: zero downloads, zero copyright issues.
 *
 * Techniques: value-noise splatter, plank/brick pattern generators,
 * grunge overlays, normal-map derivation from height via Sobel filter.
 */
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Canvas helpers
// ---------------------------------------------------------------------------

function makeCanvas(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  return [canvas, canvas.getContext('2d', { willReadFrequently: true })];
}

/** Deterministic pseudo-random (mulberry32) so rooms look identical per seed. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Grunge: many soft translucent blobs. */
function grunge(ctx, size, rand, color, count, alpha) {
  for (let i = 0; i < count; i++) {
    const x = rand() * size, y = rand() * size;
    const r = 4 + rand() * size * 0.12;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${color},${alpha * rand()})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/** Fine speckle noise. */
function speckle(ctx, size, rand, strength = 18, count = 9000) {
  for (let i = 0; i < count; i++) {
    const v = Math.floor(rand() * strength);
    ctx.fillStyle = `rgba(${v},${v},${v},${0.16 * rand()})`;
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 1 + rand() * 2);
  }
}

/** Derive a normal map from the luminance of a canvas (Sobel). */
function normalFromCanvas(srcCanvas, strength = 1.4) {
  const size = srcCanvas.width;
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
  const src = srcCtx.getImageData(0, 0, size, size).data;
  const [out, outCtx] = makeCanvas(size);
  const img = outCtx.createImageData(size, size);
  const lum = (x, y) => {
    x = (x + size) % size; y = (y + size) % size;
    const i = (y * size + x) * 4;
    return (src[i] + src[i + 1] + src[i + 2]) / 765;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (lum(x + 1, y) - lum(x - 1, y)) * strength;
      const dy = (lum(x, y + 1) - lum(x, y - 1)) * strength;
      const len = Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len) * 255;
      img.data[i + 3] = 255;
    }
  }
  outCtx.putImageData(img, 0, 0);
  return out;
}

function toTexture(canvas, { srgb = true, repeat = 1 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  return tex;
}

// ---------------------------------------------------------------------------
// Texture generators
// ---------------------------------------------------------------------------

function paintStone(base, mortar, seed, size = 512) {
  const [canvas, ctx] = makeCanvas(size);
  const rand = rng(seed);
  ctx.fillStyle = mortar;
  ctx.fillRect(0, 0, size, size);
  const rows = 6;
  const blockH = size / rows;
  for (let row = 0; row < rows; row++) {
    let x = row % 2 === 0 ? 0 : -size / 8;
    while (x < size) {
      const w = size / 4 + rand() * size / 8;
      const jitter = (rand() - 0.5) * 6;
      const shade = 0.82 + rand() * 0.34;
      ctx.fillStyle = shadeColor(base, shade);
      roundRect(ctx, x + 3, row * blockH + 3 + jitter, w - 6, blockH - 6, 4);
      x += w;
    }
  }
  grunge(ctx, size, rand, '0,0,0', 60, 0.25);
  grunge(ctx, size, rand, '60,70,50', 24, 0.12); // moss
  speckle(ctx, size, rand);
  return canvas;
}

function paintPlanks(base, seed, size = 512, vertical = false) {
  const [canvas, ctx] = makeCanvas(size);
  const rand = rng(seed);
  const planks = 6;
  const w = size / planks;
  for (let p = 0; p < planks; p++) {
    const shade = 0.75 + rand() * 0.4;
    ctx.fillStyle = shadeColor(base, shade);
    if (vertical) ctx.fillRect(p * w, 0, w - 2, size);
    else ctx.fillRect(0, p * w, size, w - 2);
    // wood grain streaks
    ctx.strokeStyle = `rgba(0,0,0,${0.12 + rand() * 0.1})`;
    for (let g = 0; g < 14; g++) {
      ctx.lineWidth = 0.5 + rand();
      ctx.beginPath();
      const off = rand() * w;
      if (vertical) {
        ctx.moveTo(p * w + off, 0);
        ctx.bezierCurveTo(p * w + off + rand() * 8 - 4, size / 3,
          p * w + off + rand() * 8 - 4, size * 2 / 3, p * w + off, size);
      } else {
        ctx.moveTo(0, p * w + off);
        ctx.bezierCurveTo(size / 3, p * w + off + rand() * 8 - 4,
          size * 2 / 3, p * w + off + rand() * 8 - 4, size, p * w + off);
      }
      ctx.stroke();
    }
  }
  grunge(ctx, size, rand, '0,0,0', 40, 0.3);
  return canvas;
}

function paintTiles(base, line, seed, size = 512, tiles = 8) {
  const [canvas, ctx] = makeCanvas(size);
  const rand = rng(seed);
  ctx.fillStyle = line;
  ctx.fillRect(0, 0, size, size);
  const t = size / tiles;
  for (let y = 0; y < tiles; y++) {
    for (let x = 0; x < tiles; x++) {
      const shade = 0.85 + rand() * 0.3;
      ctx.fillStyle = shadeColor(base, shade);
      ctx.fillRect(x * t + 2, y * t + 2, t - 4, t - 4);
      if (rand() < 0.12) { // cracked tile
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x * t + rand() * t, y * t + 2);
        ctx.lineTo(x * t + rand() * t, (y + 1) * t - 2);
        ctx.stroke();
      }
    }
  }
  grunge(ctx, size, rand, '20,16,10', 80, 0.28);
  speckle(ctx, size, rand, 14, 5000);
  return canvas;
}

function paintMetal(base, seed, size = 512) {
  const [canvas, ctx] = makeCanvas(size);
  const rand = rng(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  // brushed streaks
  for (let i = 0; i < 260; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${0.02 + rand() * 0.04})`;
    ctx.lineWidth = 0.5 + rand() * 1.2;
    const y = rand() * size;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y + (rand() - 0.5) * 6); ctx.stroke();
  }
  // rust patches
  grunge(ctx, size, rand, '96,48,18', 46, 0.4);
  grunge(ctx, size, rand, '50,26,10', 30, 0.35);
  speckle(ctx, size, rand, 26, 4000);
  return canvas;
}

function paintConcrete(base, seed, size = 512) {
  const [canvas, ctx] = makeCanvas(size);
  const rand = rng(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  grunge(ctx, size, rand, '255,255,255', 50, 0.05);
  grunge(ctx, size, rand, '0,0,0', 90, 0.22);
  speckle(ctx, size, rand, 30, 12000);
  // hairline cracks
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  for (let c = 0; c < 5; c++) {
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    let x = rand() * size, y = rand() * size;
    ctx.moveTo(x, y);
    for (let s = 0; s < 8; s++) {
      x += (rand() - 0.5) * 60; y += rand() * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return canvas;
}

function shadeColor(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * factor) | 0;
  const g = Math.min(255, ((n >> 8) & 255) * factor) | 0;
  const b = Math.min(255, (n & 255) * factor) | 0;
  return `rgb(${r},${g},${b})`;
}

/** Filled rounded rectangle (uses current fillStyle). */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const cache = new Map();

/**
 * @param {string} kind stone|planks|tiles|metal|concrete
 * @param {object} opts { base, mortar/line, seed, repeat, roughness, metalness, normalStrength }
 * @returns {THREE.MeshStandardMaterial}
 */
export function createMaterial(kind, opts = {}) {
  const key = `${kind}:${JSON.stringify(opts)}`;
  if (cache.has(key)) return cache.get(key);

  const seed = opts.seed ?? 1;
  const repeat = opts.repeat ?? 2;
  let canvas;
  let defaults = { roughness: 0.9, metalness: 0.0 };

  switch (kind) {
    case 'stone':
      canvas = paintStone(opts.base ?? '#5a5248', opts.mortar ?? '#2e2a24', seed);
      break;
    case 'planks':
      canvas = paintPlanks(opts.base ?? '#4a3626', seed, 512, opts.vertical);
      defaults.roughness = 0.82;
      break;
    case 'tiles':
      canvas = paintTiles(opts.base ?? '#7a7568', opts.line ?? '#35322c', seed);
      defaults.roughness = 0.55;
      break;
    case 'metal':
      canvas = paintMetal(opts.base ?? '#4d5257', seed);
      defaults = { roughness: 0.45, metalness: 0.85 };
      break;
    case 'concrete':
    default:
      canvas = paintConcrete(opts.base ?? '#565049', seed);
      break;
  }

  const material = new THREE.MeshStandardMaterial({
    map: toTexture(canvas, { repeat }),
    normalMap: toTexture(normalFromCanvas(canvas, opts.normalStrength ?? 1.4),
      { srgb: false, repeat }),
    roughness: opts.roughness ?? defaults.roughness,
    metalness: opts.metalness ?? defaults.metalness,
  });
  cache.set(key, material);
  return material;
}

/** Simple colored standard material (props, trim). */
export function plainMaterial(color, { roughness = 0.8, metalness = 0, emissive = 0x000000, emissiveIntensity = 1 } = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness, metalness, emissive, emissiveIntensity,
  });
}

/** Glowing material for candle flames, runes, screens. */
export function glowMaterial(color, intensity = 2.2) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 1,
    metalness: 0,
  });
}
