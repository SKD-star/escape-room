/**
 * device.js — runtime input/environment detection.
 *
 * A single source of truth so every system agrees on whether the primary
 * input is touch. We treat a device as "touch" when it exposes touch points
 * AND its primary pointer is coarse — this excludes touchscreen laptops that
 * are really driven by a mouse/trackpad (they keep the desktop experience).
 */

let _forcedTouch = null; // manual override (Settings), null = auto

export function isTouchDevice() {
  if (_forcedTouch !== null) return _forcedTouch;
  const hasTouch = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  return hasTouch && coarse;
}

/** Force touch controls on/off (e.g. from a settings toggle). */
export function setForcedTouch(value) {
  _forcedTouch = value; // true | false | null
}

/** Coarse pointer regardless of override — used for CSS-ish decisions. */
export function isCoarsePointer() {
  return window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
}
