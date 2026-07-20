/**
 * HUD — persistent in-game overlay: crosshair, interact prompt, objective
 * tracker, toasts, stamina bar, room title cards, FPS counter.
 */
import gsap from 'gsap';
import { bus, Events } from '../../core/EventBus.js';
import { settings } from '../../config/settings.js';
import { html, screens } from '../ScreenManager.js';
import { escapeHtml } from './MenuScreens.js';

export class HUD {
  constructor() {
    this.el = html`
      <div id="hud">
        <div class="hud-crosshair"></div>
        <div class="hud-interact-label"><span class="key">E</span><span class="text">Interact</span></div>
        <div class="hud-objective glass">
          <div class="label">Objective</div>
          <p class="objective-text">Find a way out.</p>
        </div>
        <div class="hud-room-title"><h2></h2><p></p></div>
        <div class="hud-toast-stack"></div>
        <div class="hud-stamina"><div class="fill" style="width:100%"></div></div>
        <div class="hud-fps">-- fps</div>
      </div>`;

    this.crosshair = this.el.querySelector('.hud-crosshair');
    this.interactLabel = this.el.querySelector('.hud-interact-label');
    this.interactText = this.el.querySelector('.hud-interact-label .text');
    this.objectiveText = this.el.querySelector('.objective-text');
    this.roomTitle = this.el.querySelector('.hud-room-title');
    this.toastStack = this.el.querySelector('.hud-toast-stack');
    this.stamina = this.el.querySelector('.hud-stamina');
    this.staminaFill = this.el.querySelector('.hud-stamina .fill');
    this.fpsEl = this.el.querySelector('.hud-fps');

    screens.register('hud', this.el, { persistent: true });
    this.bind();
  }

  bind() {
    bus.on(Events.LOOK_TARGET, (target) => {
      const active = Boolean(target);
      this.crosshair.classList.toggle('interact', active);
      this.interactLabel.classList.toggle('visible', active);
      if (target) this.interactText.textContent = target.label ?? 'Interact';
    });

    bus.on(Events.OBJECTIVE_CHANGED, (text) => {
      gsap.fromTo(this.objectiveText, { opacity: 0 }, { opacity: 1, duration: 0.6 });
      this.objectiveText.textContent = text;
    });

    bus.on(Events.ROOM_ENTERED, ({ name, chapter }) => this.showRoomTitle(name, chapter));

    bus.on(Events.TOAST, ({ text, type = 'info', duration = 3200 }) =>
      this.toast(text, type, duration));

    bus.on(Events.ACHIEVEMENT, ({ title }) =>
      this.toast(`Achievement unlocked — ${title}`, 'achievement', 4200));

    bus.on('player:stamina', ({ ratio, active }) => {
      this.stamina.classList.toggle('visible', active || ratio < 0.999);
      this.staminaFill.style.width = `${Math.round(ratio * 100)}%`;
    });

    bus.on('engine:fps', (fps) => {
      if (!settings.get('showFps')) { this.fpsEl.classList.remove('visible'); return; }
      this.fpsEl.classList.add('visible');
      this.fpsEl.textContent = `${fps} fps`;
    });
  }

  showRoomTitle(name, chapter) {
    this.roomTitle.querySelector('h2').textContent = name;
    this.roomTitle.querySelector('p').textContent = chapter ?? '';
    gsap.timeline()
      .set(this.roomTitle, { opacity: 0, y: 14 })
      .to(this.roomTitle, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out' })
      .to(this.roomTitle, { opacity: 0, duration: 1.4, ease: 'power2.in' }, '+=2.6');
  }

  toast(text, type, duration) {
    const toast = html`<div class="toast ${type}">${escapeHtml(text)}</div>`;
    this.toastStack.appendChild(toast);
    setTimeout(() => {
      gsap.to(toast, { opacity: 0, y: -10, duration: 0.4, onComplete: () => toast.remove() });
    }, duration);
  }
}
