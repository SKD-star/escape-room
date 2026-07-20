/**
 * ScreenManager — owns every DOM screen (menus, HUD, overlays).
 * Screens register themselves with a name; only one "modal" screen is
 * visible at a time, while persistent layers (HUD) can stay mounted.
 */
import gsap from 'gsap';
import { bus, Events } from '../core/EventBus.js';

class ScreenManager {
  constructor() {
    this.root = document.getElementById('ui-root');
    /** @type {Map<string, {el: HTMLElement, onShow?: Function, onHide?: Function, persistent?: boolean}>} */
    this.screens = new Map();
    this.current = null;
    this.fadeEl = document.createElement('div');
    this.fadeEl.className = 'fade-black';
    document.body.appendChild(this.fadeEl);
  }

  /**
   * @param {string} name
   * @param {HTMLElement} el
   * @param {{onShow?: Function, onHide?: Function, persistent?: boolean}} [hooks]
   */
  register(name, el, hooks = {}) {
    el.classList.add('screen');
    el.dataset.screen = name;
    this.root.appendChild(el);
    this.screens.set(name, { el, ...hooks });
  }

  /** Show a screen (hiding the current non-persistent one). */
  show(name, payload) {
    const next = this.screens.get(name);
    if (!next) return console.warn(`[UI] unknown screen "${name}"`);

    if (this.current && this.current !== name) {
      const prev = this.screens.get(this.current);
      prev?.el.classList.remove('visible');
      prev?.onHide?.();
    }
    this.current = name;
    next.el.classList.add('visible');
    next.onShow?.(payload);
    bus.emit(Events.SCREEN_CHANGED, name);

    // Subtle entrance animation on direct children
    gsap.fromTo(
      next.el.children,
      { y: 18, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: 'expo.out', overwrite: true }
    );
  }

  hide(name) {
    const screen = this.screens.get(name);
    if (!screen) return;
    screen.el.classList.remove('visible');
    screen.onHide?.();
    if (this.current === name) this.current = null;
  }

  hideAll() {
    for (const [name] of this.screens) this.hide(name);
  }

  /** Cinematic fade to black, run fn, fade back. */
  async fadeTransition(fn) {
    this.fadeEl.classList.add('active');
    await new Promise((r) => setTimeout(r, 950));
    await fn?.();
    this.fadeEl.classList.remove('active');
  }
}

export const screens = new ScreenManager();

/** Utility: build an element from an HTML string. */
export function html(strings, ...values) {
  const template = document.createElement('template');
  template.innerHTML = String.raw(strings, ...values).trim();
  return template.content.firstElementChild;
}
