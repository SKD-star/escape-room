/**
 * HUD — persistent in-game overlay: crosshair, interact prompt, objective
 * tracker, toasts, stamina bar, room title cards, FPS counter.
 */
import gsap from 'gsap';
import { bus, Events } from '../../core/EventBus.js';
import { settings } from '../../config/settings.js';
import { html, screens } from '../ScreenManager.js';
import { escapeHtml } from './MenuScreens.js';
import { ICONS } from '../icons.js';

export class HUD {
  constructor() {
    this.el = html`
      <div id="hud">
        <div class="hud-crosshair"></div>
        <div class="hud-compass"><div class="tape"></div><div class="tick"></div></div>
        <div class="hud-countdown"><span class="cd-icon">⏱️</span><span class="cd-clock">3:30</span></div>
        <div class="hud-timer"><span class="clock">0:00.0</span><span class="split"></span></div>
        <div class="hud-attempts" title="Attempts remaining this run">
          <span class="attempts-label">ATTEMPTS</span>
          <span class="attempts-pips">
            <span class="attempt-pip active" data-pip="1" aria-label="Attempt 1">☽</span>
            <span class="attempt-pip active" data-pip="2" aria-label="Attempt 2">☽</span>
            <span class="attempt-pip active" data-pip="3" aria-label="Attempt 3">☽</span>
          </span>
        </div>
        <div class="hud-interact-label"><span class="key">E</span><span class="text">Interact</span></div>
        <div class="hud-info-stack">
          <div class="hud-objective glass">
            <div class="label">Objective</div>
            <p class="objective-text">Find a way out.</p>
          </div>
          <div class="hud-briefing glass">
            <div class="label">Briefing</div>
            <p class="brief-text"></p>
            <p class="brief-tip"></p>
          </div>
        </div>
        <div class="hud-room-title"><h2></h2><p></p></div>
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
        <div class="hud-journal-btn glass" title="Open Journal — J">
          <span class="icon">📜</span>
          <span class="journal-label">Journal [J]</span>
          <span class="journal-badge">0</span>
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
    this.attemptsEl = this.el.querySelector('.hud-attempts');
    this.attemptPips = this.el.querySelectorAll('.attempt-pip');
    this.captions = this.el.querySelector('.hud-captions');
    this.journalBtn = this.el.querySelector('.hud-journal-btn');
    this.journalBadge = this.el.querySelector('.journal-badge');
    this.journalBtn?.addEventListener('click', () => screens.show('journal'));

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

    this.countdownEl = this.el.querySelector('.hud-countdown');
    this.countdownClock = this.el.querySelector('.hud-countdown .cd-clock');

    // Per-room difficulty countdown — active in Nightmare mode
    bus.on('countdown:begin', ({ remaining, limit, harsh }) => {
      if (this.countdownEl) {
        this.countdownEl.classList.add('visible');
        this.countdownEl.classList.toggle('harsh', harsh);
        this.renderCountdown(remaining, limit);
      }
    });

    bus.on('countdown:tick', ({ remaining, limit }) => {
      if (this.countdownEl) {
        this.renderCountdown(remaining, limit);
      }
    });

    bus.on('countdown:cleared', () => {
      if (this.countdownEl) {
        this.countdownEl.classList.remove('visible', 'warn', 'urgent');
      }
    });

    bus.on('countdown:hidden', () => {
      if (this.countdownEl) {
        this.countdownEl.classList.remove('visible', 'warn', 'urgent');
      }
    });

    bus.on('journal:count', (count) => {
      if (this.journalBadge) this.journalBadge.textContent = String(count);
    });

    // Attempts tracker — pip icon display (☽ = active, ☠ = lost)
    const updatePips = (remaining) => {
      this.attemptPips.forEach((pip, i) => {
        const alive = i < remaining;
        pip.textContent = alive ? '☽' : '☠';
        pip.classList.toggle('active', alive);
        pip.classList.toggle('lost', !alive);
      });
    };

    bus.on('attempts:begin', ({ remaining }) => {
      this.attemptsEl.classList.remove('visible');
      updatePips(remaining);
    });
    bus.on('attempts:failed', ({ remaining }) => {
      this.attemptsEl.classList.remove('visible');
      updatePips(remaining);
    });
    bus.on('attempts:exhausted', () => {
      updatePips(0);
      this.attemptsEl.classList.add('exhausted');
    });
    bus.on('attempts:cleared', () => {
      this.attemptsEl.classList.remove('visible', 'last-attempt', 'exhausted');
    });
    bus.on('attempts:hidden', () => {
      this.attemptsEl.classList.remove('visible', 'last-attempt', 'exhausted');
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
      this.showObjective(text);
    });

    bus.on(Events.ROOM_ENTERED, ({ name, chapter, brief, tip }) => {
      this.showRoomTitle(name, chapter);
      this.showBriefing(brief, tip);
    });

    bus.on(Events.TOAST, ({ text, type = 'info', duration = 3200 }) =>
      this.toast(text, type, duration));

    bus.on('room:cleared:banner', ({ name }) =>
      this.showRoomClearedBanner(name));

    bus.on(Events.ACHIEVEMENT, ({ title, description }) =>
      this.showAchievementBanner({ title, description }));

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

  showObjective(text) {
    if (!this.objectiveEl) this.objectiveEl = this.el.querySelector('.hud-objective');
    this.objectiveText.textContent = text;
    gsap.killTweensOf(this.objectiveEl);
    this.objectiveEl.classList.add('visible');
    gsap.timeline()
      .fromTo(this.objectiveEl, { opacity: 0, y: -10 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out' })
      .to(this.objectiveEl, { opacity: 0, y: -10, duration: 0.8, ease: 'power2.in',
        onComplete: () => this.objectiveEl.classList.remove('visible') }, '+=4.5');
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
    gsap.killTweensOf(this.roomTitle);
    this.roomTitle.style.display = 'block';

    gsap.timeline()
      .set(this.roomTitle, { opacity: 0, y: 14 })
      .to(this.roomTitle, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out' })
      .to(this.roomTitle, {
        opacity: 0, y: -16, duration: 0.6, ease: 'power2.in',
        onComplete: () => {
          this.roomTitle.style.display = 'none';
        }
      }, '+=1.6');

    setTimeout(() => {
      this.roomTitle.style.display = 'none';
      this.roomTitle.style.opacity = '0';
    }, 2900);
  }

  /** Per-level "how to play this room" card — slides in after the title, holds for 4.5s, fades. */
  showBriefing(brief, tip) {
    if (!brief && !tip) { this.briefing.classList.remove('visible'); return; }
    this.briefText.textContent = brief ?? '';
    this.briefTip.textContent = tip ? `Tip — ${tip}` : '';
    this.briefTip.style.display = tip ? '' : 'none';
    gsap.killTweensOf(this.briefing);
    this.briefing.classList.add('visible');
    gsap.timeline()
      .fromTo(this.briefing, { opacity: 0, y: -10 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out', delay: 0.8 })
      .to(this.briefing, { opacity: 0, y: -10, duration: 0.8, ease: 'power2.in',
        onComplete: () => this.briefing.classList.remove('visible') }, '+=4.5');
  }

  toast(text, type, duration) {
    const toast = html`<div class="toast ${type}">${escapeHtml(text)}</div>`;
    this.toastStack.appendChild(toast);
    setTimeout(() => {
      gsap.to(toast, { opacity: 0, y: -10, duration: 0.4, onComplete: () => toast.remove() });
    }, duration);
  }

  showRoomClearedBanner(name) {
    bus.emit(Events.PLAY_SOUND, { name: 'unlock' });

    const banner = html`
      <div class="room-cleared-banner-popup" style="position:fixed;top:18%;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;align-items:center;gap:6px;background:linear-gradient(135deg, rgba(14, 38, 22, 0.96), rgba(8, 20, 12, 0.98));border:1px solid #37d4a0;box-shadow:0 0 35px rgba(55,212,160,0.5), 0 8px 32px rgba(0,0,0,0.9);padding:18px 38px;border-radius:14px;pointer-events:none;text-align:center">
        <div style="font-size:0.75rem;color:#37d4a0;letter-spacing:0.2em;font-weight:700;text-transform:uppercase">✓ ROOM ESCAPED & CLEARED</div>
        <div style="font-family:var(--font-display);font-size:1.6rem;color:#ffffff;letter-spacing:0.08em">${escapeHtml(name)}</div>
      </div>`;

    document.body.appendChild(banner);

    gsap.timeline()
      .fromTo(banner, { opacity: 0, scale: 0.85, y: -20 }, { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: 'back.out(1.4)' })
      .to(banner, { opacity: 0, scale: 0.9, y: -20, duration: 0.5, ease: 'power2.in', onComplete: () => banner.remove() }, '+=3.5');
  }

  showAchievementBanner({ title, description }) {
    bus.emit(Events.PLAY_SOUND, { name: 'unlock' });

    const banner = html`
      <div class="achievement-banner-popup" style="position:fixed;top:28px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:14px;background:linear-gradient(135deg, rgba(38, 30, 14, 0.96), rgba(16, 14, 8, 0.98));border:1px solid var(--accent);box-shadow:0 0 28px rgba(212,175,55,0.45), 0 8px 32px rgba(0,0,0,0.85);padding:14px 26px;border-radius:12px;min-width:330px;max-width:460px;pointer-events:none">
        <div style="font-size:2.2rem;background:rgba(212,175,55,0.18);width:48px;height:48px;display:flex;align-items:center;justify-content:center;border-radius:50%;border:1px solid var(--accent);box-shadow:0 0 12px rgba(212,175,55,0.3)">🏆</div>
        <div style="display:flex;flex-direction:column;gap:2px">
          <div style="font-size:0.7rem;color:var(--accent);letter-spacing:0.16em;font-weight:700;text-transform:uppercase">🏆 Achievement Unlocked</div>
          <div style="font-family:var(--font-display);font-size:1.12rem;color:#ffffff;letter-spacing:0.04em">${escapeHtml(title || 'Achievement Unlocked')}</div>
          <div style="font-size:0.82rem;color:var(--fg-secondary)">${escapeHtml(description || 'Feat accomplished across all runs')}</div>
        </div>
      </div>`;

    document.body.appendChild(banner);

    gsap.timeline()
      .fromTo(banner, { opacity: 0, y: -45, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.65, ease: 'back.out(1.4)' })
      .to(banner, { opacity: 0, y: -30, scale: 0.95, duration: 0.5, ease: 'power2.in', onComplete: () => banner.remove() }, '+=4.2');
  }
}
