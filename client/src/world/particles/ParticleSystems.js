/**
 * ParticleSystems — GPU-friendly Points-based effects:
 * dust motes, volumetric-looking fog planes, fire embers, rain, and a
 * lightning flash controller. All scale with the quality preset.
 */
import * as THREE from 'three';
import { QUALITY_PRESETS } from '../../config/constants.js';
import { settings } from '../../config/settings.js';

function particleTexture(soft = true) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(soft ? 0.4 : 0.7, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(canvas);
}

const SOFT_TEX = particleTexture(true);

function qualityScale() {
  return (QUALITY_PRESETS[settings.get('quality')] ?? QUALITY_PRESETS.high).particleScale;
}

// ---------------------------------------------------------------------------

/** Floating dust motes in a box volume. */
export class DustMotes {
  constructor({ count = 220, bounds = new THREE.Vector3(8, 4, 8), color = 0xc9bfa8 } = {}) {
    const n = Math.floor(count * qualityScale());
    this.bounds = bounds;
    const positions = new Float32Array(n * 3);
    this.speeds = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      positions[i * 3] = (Math.random() - 0.5) * bounds.x;
      positions[i * 3 + 1] = Math.random() * bounds.y;
      positions[i * 3 + 2] = (Math.random() - 0.5) * bounds.z;
      this.speeds[i] = 0.02 + Math.random() * 0.05;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      map: SOFT_TEX, color, size: 0.03, transparent: true, opacity: 0.35,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
  }

  update(dt, t) {
    const pos = this.points.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + this.speeds[i] * dt;
      if (y > this.bounds.y) y = 0;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(t * 0.5 + i) * 0.0006);
    }
    pos.needsUpdate = true;
  }
}

/** Layered translucent fog planes that slowly drift (fake volumetrics). */
export class GroundFog {
  constructor({ size = 14, layers = 4, color = 0x3a4148, height = 0.5, opacity = 0.14 } = {}) {
    this.group = new THREE.Group();
    this.layers = [];
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * 128, y = Math.random() * 128, r = 20 + Math.random() * 40;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.16)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    }
    const tex = new THREE.CanvasTexture(canvas);
    for (let i = 0; i < layers; i++) {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({
          map: tex, color, transparent: true, opacity: opacity * (1 - i / layers),
          depthWrite: false, blending: THREE.NormalBlending,
        }),
      );
      plane.rotation.x = -Math.PI / 2;
      plane.position.y = 0.06 + (i / layers) * height;
      plane.userData.speed = 0.008 + Math.random() * 0.02;
      plane.userData.dir = Math.random() * Math.PI * 2;
      this.group.add(plane);
      this.layers.push(plane);
    }
  }

  update(dt) {
    for (const plane of this.layers) {
      plane.position.x += Math.cos(plane.userData.dir) * plane.userData.speed * dt * 8;
      plane.position.z += Math.sin(plane.userData.dir) * plane.userData.speed * dt * 8;
      if (Math.abs(plane.position.x) > 2) plane.userData.dir += Math.PI;
      plane.rotation.z += dt * 0.02;
    }
  }
}

/** Rising fire embers above a point (braziers, fires). */
export class Embers {
  constructor({ count = 40, color = 0xff7a28, spread = 0.3, riseHeight = 1.6 } = {}) {
    const n = Math.max(6, Math.floor(count * qualityScale()));
    this.spread = spread;
    this.riseHeight = riseHeight;
    const positions = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.life[i] = Math.random();
      positions[i * 3] = (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = Math.random() * riseHeight;
      positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      map: SOFT_TEX, color, size: 0.045, transparent: true, opacity: 0.85,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.points.frustumCulled = false;
  }

  update(dt) {
    const pos = this.points.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      this.life[i] += dt * (0.3 + (i % 5) * 0.08);
      if (this.life[i] > 1) {
        this.life[i] = 0;
        pos.setX(i, (Math.random() - 0.5) * this.spread);
        pos.setZ(i, (Math.random() - 0.5) * this.spread);
      }
      pos.setY(i, this.life[i] * this.riseHeight);
      pos.setX(i, pos.getX(i) + Math.sin(this.life[i] * 9 + i) * 0.002);
    }
    pos.needsUpdate = true;
  }
}

/** Rain streaks inside a volume (for windows / exteriors). */
export class Rain {
  constructor({ count = 500, bounds = new THREE.Vector3(12, 6, 12) } = {}) {
    const n = Math.floor(count * qualityScale());
    this.bounds = bounds;
    const positions = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      positions[i * 3] = (Math.random() - 0.5) * bounds.x;
      positions[i * 3 + 1] = Math.random() * bounds.y;
      positions[i * 3 + 2] = (Math.random() - 0.5) * bounds.z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0x8ea6b8, size: 0.02, transparent: true, opacity: 0.5,
      depthWrite: false,
    }));
    this.points.frustumCulled = false;
  }

  update(dt) {
    const pos = this.points.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - dt * (7 + (i % 7));
      if (y < 0) y = this.bounds.y;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  }
}

/**
 * LightningController — random ambient flashes via a directional light.
 * Pairs with thunder sound events on the bus.
 */
export class Lightning {
  constructor(scene, { color = 0xbfd4ff, interval = [6, 16] } = {}) {
    this.light = new THREE.DirectionalLight(color, 0);
    this.light.position.set(3, 10, -4);
    scene.add(this.light);
    this.interval = interval;
    this.timer = this.nextDelay();
    this.flashing = 0;
    /** @type {(intensity:number)=>void} called on each strike */
    this.onStrike = null;
  }

  nextDelay() {
    return this.interval[0] + Math.random() * (this.interval[1] - this.interval[0]);
  }

  update(dt) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.flashing = 0.28 + Math.random() * 0.2;
      this.timer = this.nextDelay();
      this.onStrike?.(this.flashing);
    }
    if (this.flashing > 0) {
      this.flashing -= dt;
      // stuttering flash pattern
      this.light.intensity = Math.random() < 0.6 ? 2.6 + Math.random() * 2 : 0.3;
      if (this.flashing <= 0) this.light.intensity = 0;
    }
  }
}
