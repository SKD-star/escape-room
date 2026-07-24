/**
 * SanitySystem — the player's grip on reality, 0..100.
 *
 * Drains in darkness and near the Haunt; recovers in light, on puzzle
 * solves and room escapes. Low sanity feeds back into the world:
 *  - post FX: chromatic aberration + vignette breathe wider
 *  - audio: heartbeat quickens, whispers intrude
 *  - camera: slow tremor below 25%
 *
 * Publishes 'sanity:changed' { value, ratio } for the HUD.
 * Never kills the player — this is dread, not a health bar — but the
 * dark ending counts how far you let it fall.
 */
import { SANITY } from '../config/constants.js';
import { difficulty } from '../config/difficulty.js';
import { bus, Events } from '../core/EventBus.js';

export class SanitySystem {
  /**
   * @param {import('../core/Engine.js').Engine} engine
   * @param {import('./Flashlight.js').Flashlight} flashlight
   */
  constructor(engine, flashlight) {
    this.engine = engine;
    this.flashlight = flashlight;

    this.value = SANITY.MAX;
    this.enabled = false;
    this.hauntLevel = 0;          // 0..1 from HauntSystem
    this.litLevel = 0.5;          // how lit the player's spot is (approx.)
    this.heartbeatAccum = 0;
    this.whisperAccum = 0;
    this.lowestSeen = SANITY.MAX; // recorded for the ending logic
    this.publishAccum = 0;

    bus.on('haunt:proximity', (level) => { this.hauntLevel = level; });
    bus.on('player:litLevel', (level) => { this.litLevel = level; });
    // Overtime on the room clock bleeds sanity (see LevelTimer).
    bus.on('sanity:drain', (amount) => { if (this.enabled) this.drain(amount); });

    // Relief moments claw sanity back
    bus.on(Events.PUZZLE_SOLVED, () => this.restore(SANITY.RESTORE_PUZZLE));
    bus.on(Events.ROOM_CLEARED, () => this.restore(SANITY.RESTORE_ROOM));
    bus.on('secret:found', () => this.restore(SANITY.RESTORE_SECRET));
  }

  reset() {
    this.value = SANITY.MAX;
    this.lowestSeen = SANITY.MAX;
    this.hauntLevel = 0;
    this.publish();
  }

  restore(amount) {
    this.value = Math.min(SANITY.MAX, this.value + amount);
    this.publish();
  }

  drain(amount) {
    this.value = Math.max(0, this.value - amount);
    this.lowestSeen = Math.min(this.lowestSeen, this.value);
    this.publish();
  }

  publish() {
    bus.emit('sanity:changed', { value: this.value, ratio: this.value / SANITY.MAX });
  }

  get ratio() { return this.value / SANITY.MAX; }

  update(dt) {
    if (!this.enabled) return;

    // -- drain / recover --------------------------------------------------
    const drainMult = difficulty.mode.sanityDrain;
    const inLight = this.flashlight.on || this.litLevel > 0.45;
    let delta = inLight ? SANITY.RECOVER_LIT : -SANITY.DRAIN_DARK * drainMult;
    delta -= this.hauntLevel * SANITY.DRAIN_HAUNT * drainMult;
    this.value = Math.max(0, Math.min(SANITY.MAX, this.value + delta * dt));
    this.lowestSeen = Math.min(this.lowestSeen, this.value);

    this.publishAccum += dt;
    if (this.publishAccum > 0.25) { this.publishAccum = 0; this.publish(); }

    const fear = 1 - this.ratio; // 0 calm .. 1 broken

    // -- post FX breathing -------------------------------------------------
    const chroma = this.engine.chroma;
    if (chroma) {
      const base = 0.0003;
      const throb = fear > 0.4 ? Math.sin(performance.now() * 0.004) * 0.0012 * fear : 0;
      const mag = base + fear * 0.0022 + Math.abs(throb);
      chroma.offset.set(mag, mag);
    }
    if (this.engine.vignette) {
      this.engine.vignette.darkness = 0.42 + fear * 0.28;
    }

    // -- heartbeat: silent until 60%, then quickens -----------------------
    if (fear > 0.4) {
      const period = 1.35 - fear * 0.75; // 1.35s .. 0.6s
      this.heartbeatAccum += dt;
      if (this.heartbeatAccum >= period) {
        this.heartbeatAccum = 0;
        bus.emit(Events.PLAY_SOUND, { name: 'heartbeat', volume: 0.3 + fear * 0.7 });
      }
    }

    // -- whispers intrude below 40% ---------------------------------------
    if (fear > 0.6) {
      this.whisperAccum += dt;
      if (this.whisperAccum > 7 - fear * 4) {
        this.whisperAccum = 0;
        bus.emit(Events.PLAY_SOUND, { name: 'whisper', volume: fear });
      }
    }

    // -- tremor below 25% --------------------------------------------------
    if (fear > 0.75 && Math.random() < dt * 1.5) {
      bus.emit('camera:shake', 0.15 * fear);
    }
  }
}
