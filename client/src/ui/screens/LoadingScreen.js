/**
 * LoadingScreen — shown during boot and room transitions.
 */
import { LOADING_TIPS } from '../../config/constants.js';
import { html, screens } from '../ScreenManager.js';

export class LoadingScreen {
  constructor() {
    this.el = html`
      <div id="loading-screen" class="backdrop">
        <div class="loading-inner">
          <div class="loading-sigil"></div>
          <h1 class="title-hero" style="font-size:1.6rem">AI Powered <span class="accent">Escape Room</span></h1>
          <div class="loading-bar"><div class="fill"></div></div>
          <div class="label loading-status">Awakening…</div>
          <p class="loading-tip"></p>
        </div>
      </div>`;
    this.fill = this.el.querySelector('.fill');
    this.status = this.el.querySelector('.loading-status');
    this.tip = this.el.querySelector('.loading-tip');
    this.tipTimer = null;
    screens.register('loading', this.el, {
      onShow: () => this.startTips(),
      onHide: () => clearInterval(this.tipTimer),
    });
  }

  startTips() {
    const next = () => {
      this.tip.textContent = LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)];
    };
    next();
    clearInterval(this.tipTimer);
    this.tipTimer = setInterval(next, 4200);
  }

  /** @param {number} ratio 0..1 @param {string} [label] */
  setProgress(ratio, label) {
    this.fill.style.width = `${Math.round(ratio * 100)}%`;
    if (label) this.status.textContent = label;
  }
}
