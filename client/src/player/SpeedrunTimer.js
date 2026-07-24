/**
 * SpeedrunTimer — run clock + per-room splits with local personal bests.
 * Enabled via the showTimer setting. Splits are recorded on ROOM_CLEARED
 * and compared against localStorage PBs (delta shown green/red).
 * Publishes 'timer:tick' and 'timer:split' for the HUD.
 */
import { bus, Events } from '../core/EventBus.js';

const PB_KEY = 'escape_room_pb_splits';

export class SpeedrunTimer {
  constructor() {
    this.running = false;
    this.elapsed = 0;
    this.roomStart = 0;
    this.tickAccum = 0;
    this.pb = JSON.parse(localStorage.getItem(PB_KEY) || '{}');

    bus.on(Events.ROOM_CLEARED, ({ key }) => this.split(key));
  }

  start() {
    this.running = true;
    this.elapsed = 0;
    this.roomStart = 0;
  }

  stop() { this.running = false; }

  restore(elapsed) {
    this.elapsed = elapsed ?? 0;
    this.roomStart = this.elapsed;
  }

  split(roomKey) {
    if (!this.running) return;
    const time = this.elapsed - this.roomStart;
    this.roomStart = this.elapsed;
    const best = this.pb[roomKey];
    const delta = best != null ? time - best : null;
    if (best == null || time < best) {
      this.pb[roomKey] = time;
      localStorage.setItem(PB_KEY, JSON.stringify(this.pb));
    }
    bus.emit('timer:split', { roomKey, time, delta, isPB: best == null || time < best });
  }

  update(dt) {
    if (!this.running) return;
    this.elapsed += dt;
    this.tickAccum += dt;
    if (this.tickAccum >= 0.05) {
      this.tickAccum = 0;
      bus.emit('timer:tick', this.elapsed);
    }
  }
}

export function formatSplit(s) {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1).padStart(4, '0');
  return `${m}:${sec}`;
}
