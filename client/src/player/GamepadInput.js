/**
 * GamepadInput — optional controller support (standard mapping).
 *
 * Left stick → move (mapped onto WASD virtual keys)
 * Right stick → look
 * A jump · B crouch (hold) · X interact · Y flashlight
 * LT focus zoom · RB sprint (hold) · Start pause · Back inventory
 *
 * Implemented as a thin translation layer: sticks write directly to the
 * FPSController, buttons synthesize the same events/keys the keyboard
 * path uses, so every downstream system works unchanged.
 */
import { settings } from '../config/settings.js';
import { bus, Events } from '../core/EventBus.js';

const DEADZONE = 0.18;

function dz(v) {
  return Math.abs(v) < DEADZONE ? 0 : (v - Math.sign(v) * DEADZONE) / (1 - DEADZONE);
}

export class GamepadInput {
  /**
   * @param {import('./FPSController.js').FPSController} player
   * @param {import('./InteractionSystem.js').InteractionSystem} interactions
   * @param {import('./Flashlight.js').Flashlight} flashlight
   */
  constructor(player, interactions, flashlight) {
    this.player = player;
    this.interactions = interactions;
    this.flashlight = flashlight;
    this.prev = {}; // previous button state for edge detection
    this.connected = false;

    window.addEventListener('gamepadconnected', (e) => {
      this.connected = true;
      bus.emit(Events.TOAST, { text: `Controller connected — ${e.gamepad.id.slice(0, 40)}` });
    });
    window.addEventListener('gamepaddisconnected', () => { this.connected = false; });
  }

  pressed(pad, i) { return Boolean(pad.buttons[i]?.pressed); }
  justPressed(pad, i) {
    const now = this.pressed(pad, i);
    const was = this.prev[i] ?? false;
    this.prev[i] = now;
    return now && !was;
  }

  update(dt) {
    if (!this.connected || !settings.get('gamepad')) return;
    const pad = navigator.getGamepads?.()[0];
    if (!pad) return;
    const p = this.player;

    // -- look (right stick) ----------------------------------------------
    if (p.enabled) {
      const lookScale = 2.6 * settings.get('mouseSensitivity') * (1 - p.zoom * 0.55);
      const invert = settings.get('invertY') ? -1 : 1;
      p.yaw -= dz(pad.axes[2]) * lookScale * dt;
      p.pitch -= dz(pad.axes[3]) * lookScale * dt * invert;
      p.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, p.pitch));

      // -- move (left stick → virtual WASD) -------------------------------
      const mx = dz(pad.axes[0]);
      const my = dz(pad.axes[1]);
      this.setKey(p, 'KeyD', mx > 0.3); this.setKey(p, 'KeyA', mx < -0.3);
      this.setKey(p, 'KeyS', my > 0.3); this.setKey(p, 'KeyW', my < -0.3);

      // -- held buttons ---------------------------------------------------
      this.setKey(p, 'ShiftLeft', this.pressed(pad, 5));         // RB sprint
      this.setKey(p, 'KeyC', this.pressed(pad, 1));              // B crouch
      this.setKey(p, 'Space', this.pressed(pad, 0));             // A jump
      p.zooming = (pad.buttons[6]?.value ?? 0) > 0.4;            // LT zoom
    }

    // -- edge-triggered buttons -------------------------------------------
    if (this.justPressed(pad, 2) && p.enabled) this.interactions.interact();      // X
    if (this.justPressed(pad, 3) && p.enabled && this.flashlight.enabled
        && !this.interactions.inspecting) this.flashlight.toggle();               // Y
    if (this.justPressed(pad, 9)) bus.emit(Events.GAME_PAUSE);                    // Start
    if (this.justPressed(pad, 8) && p.enabled) bus.emit('inventory:toggle');      // Back
  }

  setKey(player, code, down) {
    if (down) player.keys.add(code);
    else player.keys.delete(code);
  }
}
