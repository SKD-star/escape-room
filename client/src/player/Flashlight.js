/**
 * Flashlight — handheld light with realistic behavior:
 *  - SpotLight that lags slightly behind the camera (weighty hand feel)
 *  - toggle on F (unless an item is held — then F still throws)
 *  - battery drain, low-battery dimming + stutter flicker
 *  - spectral interference: flickers violently when the Haunt is near
 *  - a fresh cell is scavenged at the entrance of every room
 *
 * Publishes 'flashlight:state' { on, battery } for the HUD.
 */
import * as THREE from 'three';
import { FLASHLIGHT } from '../config/constants.js';
import { difficulty } from '../config/difficulty.js';
import { bus, Events } from '../core/EventBus.js';

export class Flashlight {
  /** Procedural beam cookie: hot core → falloff → subtle outer ring. */
  static beamCookie() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const c = size / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0.0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,250,235,0.85)');
    g.addColorStop(0.62, 'rgba(255,240,210,0.35)');
    g.addColorStop(0.78, 'rgba(255,238,205,0.42)'); // faint ring
    g.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * @param {import('../core/Engine.js').Engine} engine
   * @param {() => boolean} isHoldingItem returns true while inspect mode holds an item
   */
  constructor(engine, isHoldingItem = () => false) {
    this.engine = engine;
    this.isHoldingItem = isHoldingItem;

    this.on = false;
    this.enabled = false;            // gated by game state (playing)
    this.battery = FLASHLIGHT.BATTERY_MAX;
    this.interference = 0;           // 0..1, driven by the HauntSystem
    this.flickerTimer = 0;
    this.flickerDark = false;

    // Beam: main spot + soft fill so the cone doesn't look laser-hard.
    // decay 2 (physical) prevents close surfaces from blowing out white.
    this.spot = new THREE.SpotLight(
      0xfff2d8, 0, FLASHLIGHT.RANGE, FLASHLIGHT.ANGLE, 0.65, 2,
    );
    // Projected cookie: bright core, soft falloff and a faint ring —
    // the beam reads like a real torch instead of a flat cone.
    this.spot.map = Flashlight.beamCookie();
    this.spot.castShadow = engine.quality.shadows;
    this.spot.shadow.mapSize.setScalar(512);
    this.spot.shadow.bias = -0.002;
    this.fill = new THREE.PointLight(0xffedd0, 0, 3.5, 2);

    this.target = new THREE.Object3D();
    engine.scene.add(this.spot, this.spot.target = this.target, this.fill);

    // Lagged aim direction (the "hand" trails the eyes)
    this.aim = new THREE.Vector3(0, 0, -1);

    document.addEventListener('keydown', (e) => {
      if (e.code !== 'KeyF' || !this.enabled) return;
      if (this.isHoldingItem()) return; // F throws the held item instead
      this.toggle();
    });

    // Scavenge a fresh cell when entering a room (keeps the pressure fair)
    bus.on(Events.ROOM_ENTERED, () => {
      if (this.battery < FLASHLIGHT.ROOM_REFILL) {
        this.battery = FLASHLIGHT.ROOM_REFILL;
        bus.emit(Events.TOAST, { text: 'You find a battery near the door. Someone left it. Recently.' });
      }
      this.publish();
    });

    bus.on('haunt:proximity', (level) => { this.interference = level; });
    bus.on('battery:pickup', (amount) => this.addCharge(amount));
  }

  toggle(force = null) {
    const next = force ?? !this.on;
    if (next === this.on) return;
    if (next && this.battery <= 0) {
      bus.emit(Events.PLAY_SOUND, { name: 'flashlight_dead' });
      bus.emit(Events.TOAST, { text: 'Dead. The dark heard the click.', type: 'danger' });
      return;
    }
    this.on = next;
    bus.emit(Events.PLAY_SOUND, { name: 'flashlight_click' });
    this.publish();
  }

  addCharge(amount) {
    this.battery = Math.min(FLASHLIGHT.BATTERY_MAX, this.battery + amount);
    bus.emit(Events.PLAY_SOUND, { name: 'battery' });
    this.publish();
  }

  publish() {
    bus.emit('flashlight:state', {
      on: this.on,
      battery: this.battery / FLASHLIGHT.BATTERY_MAX,
    });
  }

  update(dt) {
    const cam = this.engine.camera;

    // -- battery ----------------------------------------------------------
    if (this.on) {
      this.battery = Math.max(0, this.battery - FLASHLIGHT.DRAIN * difficulty.mode.batteryDrain * dt);
      if (this.battery <= 0) {
        this.on = false;
        bus.emit(Events.PLAY_SOUND, { name: 'flashlight_dead' });
        bus.emit(Events.TOAST, { text: 'The beam gutters out. You are alone with what is left.', type: 'danger' });
      }
      this.publish();
    }

    // -- intensity: dim with battery, stutter at low charge / interference
    const charge = this.battery / FLASHLIGHT.BATTERY_MAX;
    let intensity = this.on ? FLASHLIGHT.INTENSITY * (0.45 + 0.55 * Math.min(1, charge * 3)) : 0;

    const flickerChance = (charge < 0.2 ? 0.05 : 0) + this.interference * 0.22;
    this.flickerTimer -= dt;
    if (this.flickerTimer <= 0) {
      this.flickerDark = Math.random() < flickerChance;
      this.flickerTimer = 0.04 + Math.random() * 0.08;
      if (this.flickerDark && this.on) {
        bus.emit(Events.PLAY_SOUND, { name: 'flashlight_flicker', volume: 0.5 });
      }
    }
    if (this.flickerDark) intensity *= 0.08;

    this.spot.intensity = intensity;
    this.fill.intensity = this.on ? intensity * 0.02 : 0;

    if (!this.on) return;

    // -- weighty lag: aim eases toward where the camera looks -------------
    const lookDir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    this.aim.lerp(lookDir, 1 - Math.exp(-FLASHLIGHT.SWAY_SPEED * dt)).normalize();

    // held slightly low-right of the eyes, like a real hand
    const offset = new THREE.Vector3(0.16, -0.14, 0).applyQuaternion(cam.quaternion);
    this.spot.position.copy(cam.position).add(offset);
    this.fill.position.copy(this.spot.position);
    this.target.position.copy(this.spot.position)
      .addScaledVector(this.aim, FLASHLIGHT.RANGE * 0.8);
  }
}
