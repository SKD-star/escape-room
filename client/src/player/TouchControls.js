/**
 * TouchControls — on-screen controls so the game is fully playable on phones
 * and tablets (no keyboard, mouse or pointer-lock).
 *
 * Design mirrors GamepadInput: it's a thin translation layer. The left
 * virtual joystick writes WASD onto the FPSController's key set, a drag layer
 * on the right rotates the camera (yaw/pitch), and the action buttons call
 * the exact same methods/events the keyboard & gamepad paths use — so every
 * downstream system works unchanged.
 *
 * Visibility follows player.enabled (the single source of truth for "in
 * control"), synced every frame from update().
 */
import { settings } from '../config/settings.js';
import { bus, Events } from '../core/EventBus.js';
import { isTouchDevice } from '../config/device.js';

const JOY_RADIUS = 56;   // px travel of the thumb from centre
const MOVE_THRESHOLD = 0.34;
const LOOK_SENS = 0.0042; // radians per px, scaled by mouseSensitivity

export class TouchControls {
  /**
   * @param {import('./FPSController.js').FPSController} player
   * @param {import('./InteractionSystem.js').InteractionSystem} interactions
   * @param {import('./Flashlight.js').Flashlight} flashlight
   */
  constructor(player, interactions, flashlight) {
    this.player = player;
    this.interactions = interactions;
    this.flashlight = flashlight;

    this.active = false;
    this.enabled = isTouchDevice();

    // active touch identifiers
    this.joyId = null;
    this.lookId = null;
    this.lookLast = { x: 0, y: 0 };
    this.joyOrigin = { x: 0, y: 0 };
    this.crouchOn = false;

    if (this.enabled) this.build();
  }

  // -- DOM ----------------------------------------------------------------
  build() {
    const root = document.getElementById('ui-root') || document.body;
    const el = document.createElement('div');
    el.id = 'touch-controls';
    el.className = 'touch-controls';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <div class="tc-look" data-tc="look"></div>
      <div class="tc-joy" data-tc="joy">
        <div class="tc-joy-base"></div>
        <div class="tc-joy-thumb"></div>
      </div>
      <div class="tc-actions">
        <button class="tc-btn tc-torch" data-tc="torch" aria-label="Flashlight">🔦</button>
        <button class="tc-btn tc-jump" data-tc="jump" aria-label="Jump">JUMP</button>
        <button class="tc-btn tc-sprint" data-tc="sprint" aria-label="Sprint">RUN</button>
        <button class="tc-btn tc-crouch" data-tc="crouch" aria-label="Crouch">CROUCH</button>
        <button class="tc-btn tc-interact" data-tc="interact" aria-label="Interact">E</button>
      </div>
      <div class="tc-top-btns">
        <button class="tc-btn tc-mini" data-tc="inventory" aria-label="Inventory">🎒</button>
        <button class="tc-btn tc-mini" data-tc="pause" aria-label="Menu">☰</button>
      </div>
    `;
    root.appendChild(el);
    this.el = el;
    // Tag the document so the HUD switches to its touch layout regardless of
    // screen width (phones AND tablets), independent of fragile media queries.
    document.body.classList.add('touch-mode');

    // Portrait "rotate your device" hint (armed only during gameplay)
    const hint = document.createElement('div');
    hint.id = 'orientation-hint';
    hint.innerHTML =
      `<div class="rot">📱</div><p>Rotate your device to <strong>landscape</strong> for the best view.</p>`;
    (document.getElementById('ui-root') || document.body).appendChild(hint);
    this.hint = hint;

    this.joy = el.querySelector('.tc-joy');
    this.joyThumb = el.querySelector('.tc-joy-thumb');
    this.lookLayer = el.querySelector('.tc-look');

    this.bindJoystick();
    this.bindLook();
    this.bindButtons();
    this.hide();
  }

  // -- left joystick → virtual WASD (like the gamepad left stick) ----------
  bindJoystick() {
    const start = (e) => {
      if (this.joyId !== null) return;
      const t = e.changedTouches[0];
      this.joyId = t.identifier;
      const r = this.joy.getBoundingClientRect();
      this.joyOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      this.moveJoy(t);
      e.preventDefault();
      e.stopPropagation();
    };
    const move = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joyId) { this.moveJoy(t); e.preventDefault(); }
      }
    };
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joyId) { this.resetJoy(); e.preventDefault(); }
      }
    };
    this.joy.addEventListener('touchstart', start, { passive: false });
    this.joy.addEventListener('touchmove', move, { passive: false });
    this.joy.addEventListener('touchend', end, { passive: false });
    this.joy.addEventListener('touchcancel', end, { passive: false });
  }

  moveJoy(t) {
    let dx = t.clientX - this.joyOrigin.x;
    let dy = t.clientY - this.joyOrigin.y;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(len, JOY_RADIUS);
    const nx = (dx / len) * (clamped / JOY_RADIUS); // -1..1
    const ny = (dy / len) * (clamped / JOY_RADIUS);
    this.joyThumb.style.transform =
      `translate(${(dx / len) * clamped}px, ${(dy / len) * clamped}px)`;

    const p = this.player;
    this.setKey('KeyD', nx > MOVE_THRESHOLD);
    this.setKey('KeyA', nx < -MOVE_THRESHOLD);
    this.setKey('KeyS', ny > MOVE_THRESHOLD);
    this.setKey('KeyW', ny < -MOVE_THRESHOLD);
  }

  resetJoy() {
    this.joyId = null;
    this.joyThumb.style.transform = 'translate(0,0)';
    this.setKey('KeyW', false); this.setKey('KeyS', false);
    this.setKey('KeyA', false); this.setKey('KeyD', false);
  }

  // -- right side drag → look ---------------------------------------------
  bindLook() {
    const start = (e) => {
      if (this.lookId !== null) return;
      const t = e.changedTouches[0];
      this.lookId = t.identifier;
      this.lookLast = { x: t.clientX, y: t.clientY };
      e.preventDefault();
    };
    const move = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== this.lookId) continue;
        const dx = t.clientX - this.lookLast.x;
        const dy = t.clientY - this.lookLast.y;
        this.lookLast = { x: t.clientX, y: t.clientY };
        const p = this.player;
        if (!p.enabled) return;
        const sens = LOOK_SENS * settings.get('mouseSensitivity') * (1 - p.zoom * 0.5);
        const invert = settings.get('invertY') ? -1 : 1;
        p.yaw -= dx * sens;
        p.pitch -= dy * sens * invert;
        p.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, p.pitch));

        // dragging also rotates an inspected object (parity with mouse-look)
        if (this.interactions.inspecting) {
          this.interactions.inspectRotation.y += dx * 0.006;
          this.interactions.inspectRotation.x += dy * 0.006;
        }
        e.preventDefault();
      }
    };
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.lookId) this.lookId = null;
      }
    };
    this.lookLayer.addEventListener('touchstart', start, { passive: false });
    this.lookLayer.addEventListener('touchmove', move, { passive: false });
    this.lookLayer.addEventListener('touchend', end, { passive: false });
    this.lookLayer.addEventListener('touchcancel', end, { passive: false });
  }

  // -- action buttons → same calls as keyboard/gamepad --------------------
  bindButtons() {
    const on = (sel, handler, hold = false) => {
      const btn = this.el.querySelector(sel);
      if (!btn) return;
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault(); e.stopPropagation();
        btn.classList.add('pressed');
        handler(true);
      }, { passive: false });
      const release = (e) => {
        e.preventDefault();
        btn.classList.remove('pressed');
        if (hold) handler(false);
      };
      btn.addEventListener('touchend', release, { passive: false });
      btn.addEventListener('touchcancel', release, { passive: false });
    };

    on('[data-tc="interact"]', (down) => { if (down) this.interactions.interact(); });
    on('[data-tc="torch"]', (down) => {
      if (down && this.flashlight.enabled && !this.interactions.inspecting) this.flashlight.toggle();
    });
    on('[data-tc="jump"]', (down) => this.setKey('Space', down), true);
    on('[data-tc="sprint"]', (down) => this.setKey('ShiftLeft', down), true);
    on('[data-tc="crouch"]', (down) => {
      if (!down) return;
      this.crouchOn = !this.crouchOn;
      this.setKey('KeyC', this.crouchOn);
      this.el.querySelector('[data-tc="crouch"]').classList.toggle('active', this.crouchOn);
    });
    on('[data-tc="inventory"]', (down) => { if (down) bus.emit('inventory:toggle'); });
    on('[data-tc="pause"]', (down) => { if (down) bus.emit(Events.GAME_PAUSE); });
  }

  setKey(code, down) {
    if (down) this.player.keys.add(code);
    else this.player.keys.delete(code);
  }

  // -- visibility ---------------------------------------------------------
  show() {
    if (this.el) { this.el.classList.add('visible'); this.active = true; }
    this.hint?.classList.add('armed');
  }
  hide() {
    if (!this.el) return;
    this.el.classList.remove('visible');
    this.hint?.classList.remove('armed');
    this.active = false;
    // release any keys the joystick/buttons were holding
    this.resetJoy();
    this.crouchOn = false;
    this.setKey('Space', false); this.setKey('ShiftLeft', false); this.setKey('KeyC', false);
    this.el.querySelector('[data-tc="crouch"]')?.classList.remove('active');
  }

  /** Sync visibility to the controller state each frame. */
  update() {
    if (!this.enabled) return;
    const shouldShow = this.player.enabled;
    if (shouldShow && !this.active) this.show();
    else if (!shouldShow && this.active) this.hide();
  }
}
