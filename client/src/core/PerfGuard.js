/**
 * PerfGuard — runtime performance watchdog.
 * Samples FPS over rolling windows; if the average drops below target
 * on repeated windows it steps the quality preset down one notch
 * (ultra → high → medium → low) and notifies the player once.
 */
import { QUALITY_PRESETS } from '../config/constants.js';
import { settings } from '../config/settings.js';
import { bus, Events } from './EventBus.js';

const ORDER = ['low', 'medium', 'high', 'ultra'];
const TARGET_FPS = 45;
const WINDOW_S = 5;
const BAD_WINDOWS_TO_STEP = 2;

export class PerfGuard {
  constructor() {
    this.frames = 0;
    this.time = 0;
    this.badWindows = 0;
    this.stepped = false;
    this.enabled = true;
  }

  update(dt) {
    if (!this.enabled) return;
    this.frames += 1;
    this.time += dt;
    if (this.time < WINDOW_S) return;

    const avg = this.frames / this.time;
    this.frames = 0;
    this.time = 0;

    if (avg < TARGET_FPS) {
      this.badWindows += 1;
      if (this.badWindows >= BAD_WINDOWS_TO_STEP) {
        this.badWindows = 0;
        this.stepDown(avg);
      }
    } else {
      this.badWindows = 0;
    }
  }

  stepDown(avg) {
    const current = settings.get('quality');
    const idx = ORDER.indexOf(current);
    if (idx <= 0) { this.enabled = false; return; } // already at low
    const next = ORDER[idx - 1];
    settings.set('quality', next);
    bus.emit(Events.TOAST, {
      text: `Performance guard: quality lowered to ${QUALITY_PRESETS[next].label} (${Math.round(avg)} fps)`,
      duration: 4200,
    });
  }
}
