/**
 * AttemptsTracker — 3-attempt system for the escape room.
 *
 * Players get 3 attempts per RUN (not per room). Each full puzzle
 * submission failure (wrong code entered, wrong riddle answer, wrong
 * sequence completed) costs one attempt. Visual keypress errors (like
 * typing a wrong digit) do NOT cost an attempt.
 *
 * When all 3 attempts are exhausted, the Game Over screen appears and
 * the game resets from Room 1.
 *
 * Events published:
 *   'attempts:begin'     { remaining, max }
 *   'attempts:failed'    { remaining, max }
 *   'attempts:exhausted' { remaining, max }  — all attempts used, Game Over
 *   'attempts:cleared'   { remaining }        — puzzle solved
 *   'attempts:hidden'    {}
 *
 * Events consumed:
 *   Events.PUZZLE_SOLVED       → cleared
 *   'puzzle:submit:failed'     → decrement (full submission failure only)
 *   Events.ROOM_CLEARED        → hide (room completed)
 */
import { bus, Events } from '../core/EventBus.js';

export class AttemptsTracker {
  constructor() {
    this.enabled = false;
    this.maxAttempts = 3;
    this.remaining = this.maxAttempts;
    this.roomKey = null;
    this.exhausted = false;

    // Listen for FULL submission failures only (not per-keypress errors)
    bus.on('puzzle:submit:failed', () => this.onFailed());
    bus.on(Events.PUZZLE_SOLVED, () => this.onSolved());
    bus.on(Events.ROOM_CLEARED, () => this.hide());
  }

  /** Called when entering the first room of a run */
  begin(key) {
    this.roomKey = key;
    // Don't reset remaining on room change — attempts persist across rooms per run
    if (!this.enabled) {
      bus.emit('attempts:hidden');
      return;
    }
    bus.emit('attempts:begin', { remaining: this.remaining, max: this.maxAttempts });
  }

  /** Puzzle solved — clear the tracker for this room */
  onSolved() {
    if (!this.enabled) return;
    bus.emit('attempts:cleared', { remaining: this.remaining });
  }

  /** Full submission failure — decrement attempt count */
  onFailed() {
    if (!this.enabled || this.exhausted) return;
    this.remaining = Math.max(0, this.remaining - 1);
    bus.emit('attempts:failed', { remaining: this.remaining, max: this.maxAttempts });

    if (this.remaining <= 0) {
      this.exhausted = true;
      bus.emit('attempts:exhausted', { remaining: 0, max: this.maxAttempts });
    } else if (this.remaining === 1) {
      bus.emit(Events.TOAST, {
        text: 'Last attempt remaining! One more failure and the run ends.',
        type: 'danger',
        duration: 5000,
      });
    }
  }

  /** Reset for a new run (after Game Over restart) */
  reset() {
    this.remaining = this.maxAttempts;
    this.exhausted = false;
  }

  /** Hide the display (room completed, not failed) */
  hide() {
    bus.emit('attempts:hidden');
  }

  /** Restore from save state */
  restore(data) {
    if (data) {
      this.remaining = data.remaining ?? this.maxAttempts;
      this.exhausted = data.exhausted ?? false;
    }
  }

  toJSON() {
    return {
      remaining: this.remaining,
      exhausted: this.exhausted,
      maxAttempts: this.maxAttempts,
    };
  }
}
