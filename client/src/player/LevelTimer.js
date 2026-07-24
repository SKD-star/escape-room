/**
 * LevelTimer — the per-room countdown that only harder difficulties impose.
 *
 * Story mode has no clock. Normal gets a generous room limit whose expiry
 * merely nags. Nightmare gets a tight limit whose expiry turns the room
 * hostile: sanity bleeds and the presence is summoned (see HauntSystem).
 * The limit itself scales per level (later rooms allow more base time via
 * ROOMS[].par), so the pressure "reads" different in every chapter.
 *
 * The clock never kills — solving the puzzle stops it, and running out only
 * feeds the existing dread systems. It stops on PUZZLE_SOLVED (the room's win
 * condition) and hides between rooms.
 *
 * Publishes for the HUD:
 *   'countdown:begin'   { remaining, limit, harsh }
 *   'countdown:tick'    { remaining, limit }
 *   'countdown:expired' { harsh }
 *   'countdown:cleared' { remaining, expired }
 *   'countdown:hidden'
 * And 'sanity:drain' (a clean channel SanitySystem consumes) during overtime.
 */
import { bus, Events } from '../core/EventBus.js';
import { difficulty } from '../config/difficulty.js';
import { settings } from '../config/settings.js';
import { campaign } from '../config/campaign.js';

export class LevelTimer {
  constructor() {
    this.enabled = false;     // gated by Game to the playing state
    this.frozen = false;      // paused in menus / notes / dialogue (NOT during a puzzle)
    this.running = false;
    this.limit = 0;
    this.remaining = 0;
    this.expired = false;
    this.tickAccum = 0;
    this.overtimeAccum = 0;

    // begin() is called explicitly by Game once the room is loaded AND the
    // playing systems are active (enabling order matters), not on ROOM_ENTERED.
    bus.on(Events.PUZZLE_SOLVED, () => this.bankSolve());
    bus.on(Events.ROOM_CLEARED, () => this.hide());
  }

  /** The active difficulty's countdown config, or null if this mode has none. */
  get config() { return difficulty.mode.countdown; }

  /** Whether a countdown should run at all right now. */
  get active() {
    return this.enabled && Boolean(this.config) && settings.get('countdownTimer');
  }

  begin(key) {
    const room = campaign.get(key);
    const cfg = this.config;
    if (!room || !cfg || !this.active) {
      this.running = false;
      bus.emit('countdown:hidden');
      return;
    }
    this.limit = Math.max(30, Math.round((room.par ?? 240) * (cfg.mult ?? 1)));
    this.remaining = this.limit;
    this.expired = false;
    this.tickAccum = 0;
    this.overtimeAccum = 0;
    this.running = true;
    bus.emit('countdown:begin', { remaining: this.remaining, limit: this.limit, harsh: !!cfg.harsh });
  }

  /** Puzzle solved: stop the clock and report how it went (banked time / overtime). */
  bankSolve() {
    if (!this.running) return;
    this.running = false;
    bus.emit('countdown:cleared', {
      remaining: Math.max(0, Math.round(this.remaining)),
      expired: this.expired,
    });
  }

  /** Leave the room / no countdown this room: clear the HUD. */
  hide() {
    this.running = false;
    bus.emit('countdown:hidden');
  }

  update(dt) {
    if (!this.running || !this.active || this.frozen) return;

    this.remaining -= dt;

    this.tickAccum += dt;
    if (this.tickAccum >= 0.1) {
      this.tickAccum = 0;
      bus.emit('countdown:tick', { remaining: this.remaining, limit: this.limit });
    }

    if (this.remaining <= 0 && !this.expired) {
      this.expired = true;
      const cfg = this.config;

      // Hard deadline (Nightmare): fail the room. Stop here — Game restarts it.
      if (cfg.failOnTimeout) {
        this.running = false;
        bus.emit('countdown:timeout');
        return;
      }

      // Soft deadline (Normal): overtime, no fail.
      bus.emit('countdown:expired', { harsh: !!cfg.harsh });
      bus.emit(Events.TOAST, {
        text: 'You are over the clock. Steady your hands and finish it.',
        type: 'danger',
        duration: 5200,
      });
    }

    // Overtime: bleed sanity in one-second chunks (soft deadline only).
    if (this.expired) {
      const rate = this.config.overtimeDrain ?? 1;
      this.overtimeAccum += dt;
      while (this.overtimeAccum >= 1) {
        this.overtimeAccum -= 1;
        bus.emit('sanity:drain', rate);
      }
    }
  }
}
