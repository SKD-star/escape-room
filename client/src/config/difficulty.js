/**
 * Difficulty — holds the active difficulty mode for the current run.
 * Systems read multipliers from here every frame, so switching modes
 * (new game / loaded save) takes effect instantly.
 */
import { DIFFICULTY_MODES } from './constants.js';

let currentKey = 'normal';

export const difficulty = {
  get key() { return currentKey; },
  get mode() { return DIFFICULTY_MODES[currentKey] ?? DIFFICULTY_MODES.normal; },
  set(key) {
    currentKey = DIFFICULTY_MODES[key] ? key : 'normal';
  },
};
