/**
 * FPSController — realistic first-person controller.
 *
 * Features: pointer lock mouse-look, WASD walk/run/crouch, jump, gravity
 * via Rapier character controller, stamina, head bob, breathing sway,
 * camera shake, footstep events, smooth crouch transitions.
 */
import * as THREE from 'three';
import { PLAYER } from '../config/constants.js';
import { settings } from '../config/settings.js';
import { bus, Events } from '../core/EventBus.js';
import { isTouchDevice } from '../config/device.js';

const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  crouch: ['KeyC', 'ControlLeft'],
  jump: ['Space'],
};

export class FPSController {
  /**
   * @param {import('../core/Engine.js').Engine} engine
   * @param {import('../core/PhysicsWorld.js').PhysicsWorld} physics
   */
  constructor(engine, physics) {
    this.engine = engine;
    this.camera = engine.camera;
    this.physics = physics;

    // Character physics
    const { body, collider, controller } = physics.createCharacter(
      new THREE.Vector3(0, PLAYER.HEIGHT, 4),
      PLAYER.RADIUS,
      (PLAYER.HEIGHT - PLAYER.RADIUS * 2) / 2,
    );
    this.body = body;
    this.collider = collider;
    this.controller = controller;

    // State
    this.enabled = false;
    this.keys = new Set();
    this.yaw = 0;
    this.pitch = 0;
    this.velocityY = 0;
    this.grounded = false;
    this.crouching = false;
    this.currentHeight = PLAYER.HEIGHT;
    this.stamina = PLAYER.STAMINA_MAX;
    this.bobPhase = 0;
    this.stepAccum = 0;
    this.shake = 0;
    this.moveSpeed = 0;
    this.roll = 0;          // strafe camera tilt
    this.landDip = 0;       // camera dip after landing
    this.fallTime = 0;      // airtime for landing weight
    this.fovKick = 0;       // sprint FOV widening
    this.zooming = false;   // RMB focus zoom
    this.zoom = 0;          // 0..1 zoom blend

    this.bindEvents();
  }

  bindEvents() {
    document.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      this.keys.add(e.code);
      if (KEYS.jump.includes(e.code)) e.preventDefault();
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));

    document.addEventListener('mousemove', (e) => {
      if (!this.enabled || document.pointerLockElement === null) return;
      const sens = PLAYER.MOUSE_SENSITIVITY * settings.get('mouseSensitivity')
        * (1 - this.zoom * 0.55); // steadier aim while focusing
      const invert = settings.get('invertY') ? -1 : 1;
      this.yaw -= e.movementX * sens;
      this.pitch -= e.movementY * sens * invert;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
    });

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === null && this.enabled) {
        bus.emit(Events.GAME_PAUSE);
      }
    });

    // Focus zoom: hold right mouse to lean in and study details
    document.addEventListener('mousedown', (e) => {
      if (e.button === 2 && this.enabled && document.pointerLockElement) this.zooming = true;
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.zooming = false;
    });
    document.addEventListener('contextmenu', (e) => {
      if (this.enabled || document.pointerLockElement) e.preventDefault();
    });

    bus.on('camera:shake', (strength = 1) => { this.shake = Math.min(2, this.shake + strength); });
  }

  isDown(action) {
    return KEYS[action].some((code) => this.keys.has(code));
  }

  enable() {
    this.enabled = true;
    this.requestLock();
  }

  /**
   * Pointer lock needs a recent user gesture. When the intro ends on its
   * own timer there is none, so the request rejects — in that case show a
   * "click to look around" prompt and retry on the next click.
   */
  requestLock() {
    // Touch devices don't use pointer lock — TouchControls drives look/move.
    if (isTouchDevice()) return;
    if (document.pointerLockElement) return;
    const attempt = this.engine.canvas.requestPointerLock?.();
    // Chrome returns a promise that rejects without a fresh gesture
    Promise.resolve(attempt).catch(() => {
      bus.emit(Events.TOAST, { text: 'Click anywhere to take control.', duration: 5000 });
    });
    if (!this.clickToLockBound) {
      this.clickToLockBound = true;
      document.addEventListener('mousedown', () => {
        if (this.enabled && !document.pointerLockElement) {
          this.engine.canvas.requestPointerLock?.();
        }
      });
    }
  }

  disable() {
    this.enabled = false;
    this.keys.clear();
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** Teleport the player (room spawns, load game). */
  setPosition(x, y, z, yaw = 0) {
    this.body.setNextKinematicTranslation({ x, y, z });
    this.body.setTranslation({ x, y, z }, true);
    this.yaw = yaw;
    this.pitch = 0;
    this.velocityY = 0;
  }

  getPosition() {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  update(dt) {
    if (!this.enabled || !this.body) return;

    // -- crouch (smooth height change) -----------------------------------
    const wantCrouch = this.isDown('crouch');
    this.crouching = wantCrouch;
    const targetHeight = wantCrouch ? PLAYER.CROUCH_HEIGHT : PLAYER.HEIGHT;
    this.currentHeight = THREE.MathUtils.damp(this.currentHeight, targetHeight, 12, dt);

    // -- movement input ---------------------------------------------------
    const input = new THREE.Vector3(
      (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0),
      0,
      (this.isDown('back') ? 1 : 0) - (this.isDown('forward') ? 1 : 0),
    );
    const moving = input.lengthSq() > 0;
    if (moving) input.normalize();

    // -- sprint & stamina -------------------------------------------------
    const wantSprint = this.isDown('sprint') && moving && !this.crouching && this.stamina > 1;
    if (wantSprint) {
      this.stamina = Math.max(0, this.stamina - PLAYER.STAMINA_DRAIN * dt);
    } else {
      this.stamina = Math.min(PLAYER.STAMINA_MAX, this.stamina + PLAYER.STAMINA_REGEN * dt);
    }
    bus.emit('player:stamina', {
      ratio: this.stamina / PLAYER.STAMINA_MAX,
      active: wantSprint,
    });

    const speed = this.crouching ? PLAYER.CROUCH_SPEED
      : wantSprint ? PLAYER.RUN_SPEED : PLAYER.WALK_SPEED;
    this.moveSpeed = moving ? speed : 0;

    // Rotate input by yaw
    input.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    // -- gravity & jump ---------------------------------------------------
    if (this.grounded && this.isDown('jump') && !this.crouching) {
      this.velocityY = PLAYER.JUMP_VELOCITY;
      bus.emit(Events.PLAY_SOUND, { name: 'jump' });
    }
    this.velocityY -= 9.81 * dt * 1.6; // slightly heavy gravity feels better
    this.velocityY = Math.max(this.velocityY, -25);

    // -- move through Rapier character controller -------------------------
    const desired = {
      x: input.x * speed * dt,
      y: this.velocityY * dt,
      z: input.z * speed * dt,
    };
    this.controller.computeColliderMovement(this.collider, desired);
    const corrected = this.controller.computedMovement();
    const pos = this.body.translation();
    this.body.setNextKinematicTranslation({
      x: pos.x + corrected.x,
      y: pos.y + corrected.y,
      z: pos.z + corrected.z,
    });

    const wasGrounded = this.grounded;
    this.grounded = this.controller.computedGrounded();
    if (!this.grounded) this.fallTime += dt;
    if (this.grounded && !wasGrounded && this.fallTime > 0.18) {
      // landing: thud + camera dip scaled by airtime
      const weight = Math.min(1, this.fallTime / 0.8);
      this.landDip = Math.max(this.landDip, 0.05 + weight * 0.09);
      bus.emit(Events.PLAY_SOUND, { name: 'land', volume: 0.4 + weight * 0.6 });
      if (weight > 0.6) bus.emit('camera:shake', weight * 0.5);
    }
    if (this.grounded) this.fallTime = 0;
    if (this.grounded && this.velocityY < 0) this.velocityY = -0.5;

    // -- camera placement -------------------------------------------------
    const eyeY = pos.y + this.currentHeight / 2 - 0.08;
    let bobX = 0, bobY = 0;

    if (settings.get('headBob') && moving && this.grounded) {
      this.bobPhase += dt * (wantSprint ? 11 : this.crouching ? 5 : 7.5);
      bobY = Math.sin(this.bobPhase * 2) * 0.028 * (wantSprint ? 1.5 : 1);
      bobX = Math.cos(this.bobPhase) * 0.018;

      // footstep events on bob cycle
      this.stepAccum += dt * (wantSprint ? 11 : 7.5);
      if (this.stepAccum > Math.PI * 2) {
        this.stepAccum = 0;
        bus.emit(Events.PLAY_SOUND, { name: 'footstep', volume: wantSprint ? 1 : 0.6 });
      }
    } else {
      this.bobPhase = 0;
    }

    // breathing sway (always, subtle)
    const breath = Math.sin(performance.now() * 0.0011) * 0.006;

    // landing dip recovery
    this.landDip = THREE.MathUtils.damp(this.landDip, 0, 9, dt);

    // strafe roll: lean slightly into sideways motion
    const strafe = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
    const targetRoll = moving && this.grounded ? -strafe * 0.018 : 0;
    this.roll = THREE.MathUtils.damp(this.roll, targetRoll, 8, dt);

    // sprint FOV kick (speed sensation) + focus zoom (RMB narrows the lens)
    const targetKick = wantSprint ? 5 : 0;
    this.fovKick = THREE.MathUtils.damp(this.fovKick, targetKick, 5, dt);
    this.zoom = THREE.MathUtils.damp(this.zoom, this.zooming ? 1 : 0, 10, dt);
    const baseFov = settings.get('fov');
    const fov = (baseFov + this.fovKick) * (1 - this.zoom * 0.45);
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }

    // camera shake decay
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const shakeX = (Math.random() - 0.5) * this.shake * 0.05;
    const shakeY = (Math.random() - 0.5) * this.shake * 0.05;

    this.camera.position.set(
      pos.x + bobX + shakeX,
      eyeY + bobY + breath + shakeY - this.landDip,
      pos.z,
    );
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, this.roll, 'YXZ'));

    bus.emit(Events.PLAYER_MOVED, {
      position: this.camera.position,
      yaw: this.yaw,
      moving,
      sprinting: wantSprint,
      crouching: this.crouching,
    });
  }
}
