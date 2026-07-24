/**
 * HauntSystem — the presence that stalks the player between puzzles.
 *
 * A translucent figure manifests on a randomized timer, drifts toward
 * the player, and dissolves when caught in the flashlight beam for a
 * couple of seconds (or when it reaches you — costing sanity and a
 * scare sting, never death).
 *
 * Escalation: manifests more often the deeper you are in the run and
 * the lower your sanity gets. While manifested it broadcasts
 * 'haunt:proximity' (0..1), which the flashlight uses for interference
 * flicker and the SanitySystem for drain.
 *
 * Also approximates how lit the player is (distance to the room's live
 * flame lights) and publishes 'player:litLevel' for sanity recovery.
 */
import * as THREE from 'three';
import { HAUNT } from '../config/constants.js';
import { campaign } from '../config/campaign.js';
import { difficulty } from '../config/difficulty.js';
import { bus, Events } from '../core/EventBus.js';

export class HauntSystem {
  /**
   * @param {import('../core/Engine.js').Engine} engine
   * @param {import('../player/FPSController.js').FPSController} player
   * @param {import('../player/Flashlight.js').Flashlight} flashlight
   * @param {import('./RoomManager.js').RoomManager} rooms
   */
  constructor(engine, player, flashlight, rooms) {
    this.engine = engine;
    this.player = player;
    this.flashlight = flashlight;
    this.rooms = rooms;

    this.enabled = false;
    this.state = 'dormant'; // dormant | manifesting | hunting | banishing
    this.timer = this.nextDelay(0);
    this.litTime = 0;       // seconds the beam has been on it
    this.opacity = 0;
    this.sanityRatio = 1;
    this.roomIndex = 0;
    this.litAccum = 0;
    this.playerNoise = 0;   // stealth: sprinting is loud, crouching is quiet

    this.figure = this.buildFigure();
    this.figure.visible = false;
    engine.scene.add(this.figure);

    bus.on('sanity:changed', ({ ratio }) => { this.sanityRatio = ratio; });
    bus.on(Events.PLAYER_MOVED, ({ moving, sprinting, crouching }) => {
      this.playerNoise = !moving ? 0.15 : crouching ? 0.3 : sprinting ? 1 : 0.6;
    });
    bus.on(Events.ROOM_ENTERED, ({ key }) => {
      this.roomIndex = Math.max(0, this.rooms.indexOf(key));
      this.banishInstant();
      this.timer = this.nextDelay(this.roomIndex);
    });
    // Never interrupt a puzzle or dialogue mid-thought
    bus.on(Events.GAME_PAUSE, () => { if (this.state === 'hunting') this.banish(); });
    // Running out the room clock (harsh modes) drags it into the open now.
    bus.on('countdown:expired', ({ harsh }) => {
      if (harsh && this.enabled && this.state === 'dormant') this.manifest();
    });
  }

  buildFigure() {
    const group = new THREE.Group();
    this.mat = new THREE.MeshStandardMaterial({
      color: 0x1a1620,
      transparent: true,
      opacity: 0,
      emissive: 0x2a1230,
      emissiveIntensity: 0.5,
      depthWrite: false,
      roughness: 1,
    });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.36, 1.7, 12), this.mat);
    body.position.y = 0.85;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), this.mat);
    head.position.y = 1.78;
    // two faint eye points
    this.eyeMat = new THREE.MeshBasicMaterial({
      color: 0xd8c9a0, transparent: true, opacity: 0,
    });
    const eyeGeo = new THREE.SphereGeometry(0.018, 6, 6);
    const e1 = new THREE.Mesh(eyeGeo, this.eyeMat); e1.position.set(-0.06, 1.8, 0.14);
    const e2 = new THREE.Mesh(eyeGeo, this.eyeMat); e2.position.set(0.06, 1.8, 0.14);
    this.glow = new THREE.PointLight(0x4a2a5a, 0, 4, 2);
    this.glow.position.y = 1.4;
    group.add(body, head, e1, e2, this.glow);
    return group;
  }

  /** Time until next manifestation — shorter deeper in, shorter when scared. */
  nextDelay(roomIndex) {
    const rate = difficulty.mode.hauntRate;
    if (rate <= 0) return Infinity; // Story mode: dormant forever
    const depth = roomIndex / Math.max(1, campaign.count - 1); // 0..1 across the campaign
    const fear = 1 - this.sanityRatio;
    const base = HAUNT.DELAY_MAX - depth * (HAUNT.DELAY_MAX - HAUNT.DELAY_MIN);
    return Math.max(HAUNT.DELAY_MIN, base * (1 - fear * 0.4)) * (0.75 + Math.random() * 0.5) / rate;
  }

  banish() {
    if (this.state === 'dormant' || this.state === 'banishing') return;
    this.state = 'banishing';
  }

  banishInstant() {
    this.state = 'dormant';
    this.figure.visible = false;
    this.opacity = 0;
    this.litTime = 0;
    bus.emit('haunt:proximity', 0);
  }

  /** Spawn point: behind the player, at the room's edge. */
  manifest() {
    const room = this.rooms.current;
    if (!room) return;
    const p = this.player.getPosition();
    const behind = new THREE.Vector3(0, 0, 1)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.yaw);
    const hw = room.size.width / 2 - 1;
    const hd = room.size.depth / 2 - 1;
    this.figure.position.set(
      THREE.MathUtils.clamp(p.x + behind.x * 5 + (Math.random() - 0.5) * 3, -hw, hw),
      0,
      THREE.MathUtils.clamp(p.z + behind.z * 5 + (Math.random() - 0.5) * 3, -hd, hd),
    );
    this.figure.visible = true;
    this.state = 'manifesting';
    this.litTime = 0;
    bus.emit(Events.PLAY_SOUND, { name: 'manifest' });
  }

  /** Is the flashlight beam currently on the figure? */
  isInBeam() {
    if (!this.flashlight.on) return false;
    const toFigure = this.figure.position.clone()
      .add(new THREE.Vector3(0, 1.3, 0))
      .sub(this.engine.camera.position);
    const dist = toFigure.length();
    if (dist > 14) return false;
    const angle = toFigure.normalize().angleTo(this.flashlight.aim);
    return angle < 0.4;
  }

  /** Approximate how lit the player is from the room's flame lights. */
  publishLitLevel(dt) {
    this.litAccum += dt;
    if (this.litAccum < 0.5) return;
    this.litAccum = 0;
    const room = this.rooms.current;
    if (!room) return;
    const p = this.player.getPosition();
    let best = 0;
    for (const holder of room.flickerLights) {
      const world = holder.getWorldPosition(new THREE.Vector3());
      const d = world.distanceTo(p);
      best = Math.max(best, 1 - d / 5);
    }
    bus.emit('player:litLevel', Math.max(0, Math.min(1, best)));
  }

  update(dt, t) {
    if (!this.enabled) {
      if (this.figure.visible) this.banishInstant();
      return;
    }
    this.publishLitLevel(dt);

    const p = this.player.getPosition();

    switch (this.state) {
      case 'dormant':
        // stealth: noise accelerates the countdown (sprint = 2x, crouch = ~0.5x)
        this.timer -= dt * (0.4 + this.playerNoise * 1.6);
        if (this.timer <= 0) this.manifest();
        break;

      case 'manifesting':
        this.opacity = Math.min(HAUNT.OPACITY, this.opacity + dt * 0.25);
        if (this.opacity >= HAUNT.OPACITY) this.state = 'hunting';
        break;

      case 'hunting': {
        // drift toward the player: faster unwatched, slower when you're
        // quiet (crouched + still it half-loses you)
        const toPlayer = p.clone().sub(this.figure.position);
        toPlayer.y = 0;
        const dist = toPlayer.length();
        const watched = this.isInBeam();
        const stealth = 0.5 + this.playerNoise * 0.5;
        const speed = (watched ? HAUNT.SPEED * 0.35 : HAUNT.SPEED) * stealth;
        if (dist > 0.1) {
          this.figure.position.addScaledVector(toPlayer.normalize(), speed * dt);
        }

        // light banishes it
        if (watched) {
          this.litTime += dt;
          if (this.litTime >= HAUNT.BANISH_SECONDS) {
            this.banish();
            bus.emit(Events.TOAST, { text: 'It thins under the beam… and is gone. For now.' });
            bus.emit('secret:banish'); // achievement hook
          }
        } else {
          this.litTime = Math.max(0, this.litTime - dt * 2);
        }

        // it reaches you: scare sting, sanity hit, retreat
        if (dist < HAUNT.TOUCH_DISTANCE) {
          bus.emit('camera:shake', 1.6);
          bus.emit(Events.PLAY_SOUND, { name: 'scare' });
          bus.emit('sanity:damage', HAUNT.TOUCH_SANITY_COST);
          this.banish();
        }
        break;
      }

      case 'banishing':
        this.opacity -= dt * 0.9;
        if (this.opacity <= 0) {
          this.banishInstant();
          this.timer = this.nextDelay(this.roomIndex);
        }
        break;
    }

    // -- shared visuals ----------------------------------------------------
    if (this.figure.visible) {
      const flick = 0.85 + Math.sin(t * 17) * 0.1 + Math.random() * 0.05;
      this.mat.opacity = Math.max(0, this.opacity * flick);
      this.eyeMat.opacity = Math.max(0, this.opacity * 1.6 * flick);
      this.glow.intensity = this.opacity * 2.2;
      this.figure.position.y = Math.sin(t * 1.1) * 0.08;
      this.figure.lookAt(p.x, this.figure.position.y, p.z);

      // proximity drives flashlight interference + sanity drain
      const dist = this.figure.position.distanceTo(p);
      const prox = this.state === 'hunting'
        ? Math.max(0, 1 - dist / HAUNT.FEAR_RADIUS) : 0;
      bus.emit('haunt:proximity', prox);
    }
  }
}
