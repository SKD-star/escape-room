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
        <div class="hud-compass"><div class="tape"></div><div class="tick"></div></div>
        <div class="hud-timer"><span class="clock">0:00.0</span><span class="split"></span></div>
        <div class="hud-countdown" title="Room time limit"><span class="cd-icon">⏳</span><span class="cd-clock">0:00</span></div>
        <div class="hud-interact-label"><span class="key">E</span><span class="text">Interact</span></div>
        <div class="hud-objective glass">
          <div class="label">Objective</div>
          <p class="objective-text">Find a way out.</p>
        </div>
        <div class="hud-room-title"><h2></h2><p></p></div>
        <div class="hud-briefing glass">
          <div class="label">Briefing</div>
          <p class="brief-text"></p>
          <p class="brief-tip"></p>
        </div>
        <div class="hud-toast-stack"></div>
        <div class="hud-captions"></div>
        <div class="hud-stamina"><div class="fill" style="width:100%"></div></div>
        <div class="hud-sanity" title="Sanity">
          <div class="eye"><div class="pupil"></div></div>
          <div class="sanity-bar"><div class="fill" style="height:100%"></div></div>
        </div>
        <div class="hud-flashlight" title="Flashlight — F">
          <span class="icon">🔦</span>
          <div class="battery"><div class="fill" style="width:100%"></div></div>
        </div>
        <div class="hud-fps">-- fps</div>
      </div>`;

    this.crosshair = this.el.querySelector('.hud-crosshair');
    this.interactLabel = this.el.querySelector('.hud-interact-label');
    this.interactText = this.el.querySelector('.hud-interact-label .text');
    this.objectiveText = this.el.querySelector('.objective-text');
    this.roomTitle = this.el.querySelector('.hud-room-title');
    this.briefing = this.el.querySelector('.hud-briefing');
    this.briefText = this.el.querySelector('.hud-briefing .brief-text');
    this.briefTip = this.el.querySelector('.hud-briefing .brief-tip');
    this.toastStack = this.el.querySelector('.hud-toast-stack');
    this.stamina = this.el.querySelector('.hud-stamina');
    this.staminaFill = this.el.querySelector('.hud-stamina .fill');
    this.sanityEl = this.el.querySelector('.hud-sanity');
    this.sanityFill = this.el.querySelector('.hud-sanity .sanity-bar .fill');
    this.flashlightEl = this.el.querySelector('.hud-flashlight');
    this.batteryFill = this.el.querySelector('.hud-flashlight .battery .fill');
    this.fpsEl = this.el.querySelector('.hud-fps');
    this.compass = this.el.querySelector('.hud-compass');
    this.compassTape = this.el.querySelector('.hud-compass .tape');
    this.timerEl = this.el.querySelector('.hud-timer');
    this.timerClock = this.el.querySelector('.hud-timer .clock');
    this.timerSplit = this.el.querySelector('.hud-timer .split');
    this.countdownEl = this.el.querySelector('.hud-countdown');
    this.countdownClock = this.el.querySelector('.hud-countdown .cd-clock');
    this.captions = this.el.querySelector('.hud-captions');
    this.buildCompassTape();

    screens.register('hud', this.el, { persistent: true });
    this.bind();
  }

  /** Tape strip: cardinal points repeated 3× so the wrap never shows. */
  buildCompassTape() {
    const points = ['N', '·', 'NE', '·', 'E', '·', 'SE', '·', 'S', '·', 'SW', '·', 'W', '·', 'NW', '·'];
    let inner = '';
    for (let rep = 0; rep < 3; rep++) {
      for (const p of points) {
        inner += `<span class="${p === '·' ? 'dot' : 'pt'}${p === 'N' ? ' north' : ''}">${p}</span>`;
      }
    }
    this.compassTape.innerHTML = inner;
    this.segPx = 28; // width of one 22.5° segment (must match CSS)
  }

  bind() {
    bus.on(Events.LOOK_TARGET, (target) => {
      const active = Boolean(target);
      this.crosshair.classList.toggle('interact', active);
      this.interactLabel.classList.toggle('visible', active);
      if (target) this.interactText.textContent = target.label ?? 'Interact';
    });

    bus.on(Events.PLAYER_MOVED, ({ yaw }) => {
      if (!settings.get('showCompass')) { this.compass.classList.remove('visible'); return; }
      this.compass.classList.add('visible');
      // yaw 0 faces north (-Z); one full turn = 16 segments
      const degrees = ((-yaw * 180 / Math.PI) % 360 + 360) % 360;
      const offset = (degrees / 22.5) * this.segPx;
      // center on the middle repetition
      this.compassTape.style.transform =
        `translateX(${-(16 * this.segPx) - offset + this.compass.clientWidth / 2 - this.segPx / 2}px)`;
    });

    bus.on('timer:tick', (elapsed) => {
      if (!settings.get('showTimer')) { this.timerEl.classList.remove('visible'); return; }
      this.timerEl.classList.add('visible');
      const m = Math.floor(elapsed / 60);
      this.timerClock.textContent = `${m}:${(elapsed % 60).toFixed(1).padStart(4, '0')}`;
    });

    bus.on('timer:split', ({ time, delta, isPB }) => {
      if (!settings.get('showTimer')) return;
      const m = Math.floor(time / 60);
      const base = `${m}:${(time % 60).toFixed(1).padStart(4, '0')}`;
      const d = delta == null ? ' — first clear'
        : ` (${delta <= 0 ? '−' : '+'}${Math.abs(delta).toFixed(1)}s)`;
      this.timerSplit.textContent = base + d;
      this.timerSplit.style.color = isPB ? 'var(--success)' : 'var(--blood-bright)';
      gsap.fromTo(this.timerSplit, { opacity: 1 }, { opacity: 0, duration: 1.2, delay: 4 });
    });

    // Per-room difficulty countdown (Normal / Nightmare)
    bus.on('countdown:begin', ({ remaining, limit, harsh }) => {
      this.countdownEl.classList.add('visible');
      this.countdownEl.classList.toggle('harsh', !!harsh);
      this.countdownEl.classList.remove('warn', 'urgent', 'over', 'timeout', 'banked');
      this.renderCountdown(remaining, limit);
    });

    bus.on('countdown:tick', ({ remaining, limit }) => this.renderCountdown(remaining, limit));

    bus.on('countdown:expired', () => {
      this.countdownEl.classList.remove('warn', 'urgent');
      this.countdownEl.classList.add('over');
    });

    bus.on('countdown:timeout', () => {
      this.countdownEl.classList.remove('warn', 'urgent', 'banked');
      this.countdownEl.classList.add('visible', 'over', 'timeout');
      this.countdownClock.textContent = 'TIME UP';
    });

    bus.on('countdown:cleared', ({ remaining, expired }) => {
      // Flash the outcome, then retire the pill until the next room.
      this.countdownEl.classList.remove('warn', 'urgent', 'over');
      this.countdownClock.textContent = expired ? 'CLEARED' : this.formatCountdown(remaining);
      this.countdownEl.classList.toggle('banked', !expired);
      setTimeout(() => this.countdownEl.classList.remove('visible', 'banked'), 1700);
    });

    bus.on('countdown:hidden', () => {
      this.countdownEl.classList.remove('visible', 'warn', 'urgent', 'over', 'timeout', 'banked', 'harsh');
    });

    // Accessibility: caption world sounds
    bus.on(Events.PLAY_SOUND, ({ name }) => {
      if (!settings.get('soundCaptions')) return;
      const captions = {
        whisper: '[whispering]', heartbeat: '[heartbeat]', thunder: '[thunder]',
        manifest: '[something arrives]', scare: '[violent sting]',
        door_open: '[door creaks open]', unlock: '[lock releases]', locked: '[locked rattle]',
        lever: '[lever thrown]', footstep: null, land: '[thud]',
        flashlight_dead: '[battery dies]',
      };
      const text = captions[name];
      if (text === undefined || text === null) return;
      this.caption(text);
    });

    bus.on(Events.OBJECTIVE_CHANGED, (text) => {
      gsap.fromTo(this.objectiveText, { opacity: 0 }, { opacity: 1, duration: 0.6 });
      this.objectiveText.textContent = text;
    });

    bus.on(Events.ROOM_ENTERED, ({ name, chapter, brief, tip }) => {
      this.showRoomTitle(name, chapter);
      this.showBriefing(brief, tip);
    });

    bus.on(Events.TOAST, ({ text, type = 'info', duration = 3200 }) =>
      this.toast(text, type, duration));

    bus.on(Events.ACHIEVEMENT, ({ title }) =>
      this.toast(`Achievement unlocked — ${title}`, 'achievement', 4200));

    bus.on('player:stamina', ({ ratio, active }) => {
      this.stamina.classList.toggle('visible', active || ratio < 0.999);
      this.staminaFill.style.width = `${Math.round(ratio * 100)}%`;
    });

    bus.on('sanity:changed', ({ ratio }) => {
      this.sanityEl.classList.toggle('visible', ratio < 0.98);
      this.sanityEl.classList.toggle('critical', ratio < 0.3);
      this.sanityFill.style.height = `${Math.round(ratio * 100)}%`;
    });

    bus.on('flashlight:state', ({ on, battery }) => {
      this.flashlightEl.classList.toggle('on', on);
      this.flashlightEl.classList.toggle('visible', on || battery < 0.999);
      this.flashlightEl.classList.toggle('low', battery < 0.25);
      this.batteryFill.style.width = `${Math.round(battery * 100)}%`;
    });

    bus.on('engine:fps', (fps) => {
      if (!settings.get('showFps')) { this.fpsEl.classList.remove('visible'); return; }
      this.fpsEl.classList.add('visible');
      this.fpsEl.textContent = `${fps} fps`;
    });
  }

  formatCountdown(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }

  /** Update the countdown text + urgency class from the remaining ratio. */
  renderCountdown(remaining, limit) {
    if (remaining > 0) this.countdownClock.textContent = this.formatCountdown(remaining);
    if (remaining <= 0) return; // 'over' state owns the display after expiry
    const ratio = limit > 0 ? remaining / limit : 1;
    this.countdownEl.classList.toggle('urgent', ratio <= 0.15);
    this.countdownEl.classList.toggle('warn', ratio > 0.15 && ratio <= 0.35);
  }

  caption(text) {
    // Reuse the last caption element if it shows the same text (avoid spam)
    const last = this.captions.lastElementChild;
    if (last?.textContent === text) return;
    const cap = html`<div class="caption">${escapeHtml(text)}</div>`;
    this.captions.appendChild(cap);
    while (this.captions.children.length > 3) this.captions.firstElementChild.remove();
    setTimeout(() => {
      gsap.to(cap, { opacity: 0, duration: 0.5, onComplete: () => cap.remove() });
    }, 2600);
  }

  showRoomTitle(name, chapter) {
    this.roomTitle.querySelector('h2').textContent = name;
    this.roomTitle.querySelector('p').textContent = chapter ?? '';
    gsap.timeline()
      .set(this.roomTitle, { opacity: 0, y: 14 })
      .to(this.roomTitle, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out' })
      .to(this.roomTitle, { opacity: 0, duration: 1.4, ease: 'power2.in' }, '+=2.6');
  }

  /** Per-level "how to play this room" card — slides in after the title, holds, fades. */
  showBriefing(brief, tip) {
    if (!brief && !tip) { this.briefing.classList.remove('visible'); return; }
    this.briefText.textContent = brief ?? '';
    this.briefTip.textContent = tip ? `Tip — ${tip}` : '';
    this.briefTip.style.display = tip ? '' : 'none';
    gsap.killTweensOf(this.briefing);
    this.briefing.classList.add('visible');
    gsap.timeline()
      .fromTo(this.briefing, { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.7, ease: 'expo.out', delay: 1.4 })
      .to(this.briefing, { opacity: 0, x: -12, duration: 1.0, ease: 'power2.in',
        onComplete: () => this.briefing.classList.remove('visible') }, '+=9');
  }

  toast(text, type, duration) {
    const toast = html`<div class="toast ${type}">${escapeHtml(text)}</div>`;
    this.toastStack.appendChild(toast);
    setTimeout(() => {
      gsap.to(toast, { opacity: 0, y: -10, duration: 0.4, onComplete: () => toast.remove() });
    }, duration);
  }
}
