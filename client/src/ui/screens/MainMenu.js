/**
 * MainMenu — title screen with New Game / Continue / Settings / etc.
 */
import gsap from 'gsap';
import { bus, Events } from '../../core/EventBus.js';
import { api } from '../../net/ApiClient.js';
import { html, screens } from '../ScreenManager.js';
import { GAME_VERSION } from '../../config/constants.js';

export class MainMenu {
  /**
   * @param {{onNewGame: Function, onContinue: Function, hasSave: () => boolean}} handlers
   */
  constructor(handlers) {
    this.handlers = handlers;
    this.el = html`
      <div id="main-menu" class="backdrop">
        <h1 class="title-hero">AI Powered<br /><span class="accent">Escape Room</span></h1>
        <p class="subtitle" style="margin-top:12px">Ten rooms · One way out</p>
        <nav class="menu-layout" aria-label="Main menu">
          <button class="btn btn-menu" data-action="new">New Game</button>
          <button class="btn btn-menu" data-action="continue">Continue</button>
          <button class="btn btn-menu" data-action="load">Load Game</button>
          <button class="btn btn-menu" data-action="leaderboard">Leaderboard</button>
          <button class="btn btn-menu" data-action="achievements">Achievements</button>
          <button class="btn btn-menu" data-action="settings">Settings</button>
          <button class="btn btn-menu" data-action="credits">Credits</button>
          <button class="btn btn-menu" data-action="account">Sign In</button>
        </nav>
        <div class="menu-footer">
          <span>v${GAME_VERSION} — Final Year Project</span>
          <span class="account-status"></span>
        </div>
      </div>`;

    this.el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      bus.emit(Events.PLAY_SOUND, { name: 'ui_click' });
      this.onAction(btn.dataset.action);
    });

    screens.register('main-menu', this.el, { onShow: () => this.refresh() });
  }

  refresh() {
    const contBtn = this.el.querySelector('[data-action="continue"]');
    contBtn.disabled = !this.handlers.hasSave();
    const accBtn = this.el.querySelector('[data-action="account"]');
    const status = this.el.querySelector('.account-status');
    if (api.isAuthenticated) {
      accBtn.textContent = 'Sign Out';
      status.textContent = `Signed in as ${api.user?.username ?? 'player'}`;
    } else {
      accBtn.textContent = 'Sign In';
      status.textContent = 'Playing offline — progress saved locally';
    }
    // Slow menu breathing effect on the title
    gsap.to(this.el.querySelector('.title-hero'), {
      opacity: 0.85, duration: 3.2, yoyo: true, repeat: -1, ease: 'sine.inOut',
    });
  }

  onAction(action) {
    switch (action) {
      case 'new': this.handlers.onNewGame(); break;
      case 'continue': this.handlers.onContinue(); break;
      case 'load': screens.show('save-load', { mode: 'load' }); break;
      case 'leaderboard': screens.show('leaderboard'); break;
      case 'achievements': screens.show('achievements'); break;
      case 'settings': screens.show('settings', { returnTo: 'main-menu' }); break;
      case 'credits': screens.show('credits'); break;
      case 'account':
        if (api.isAuthenticated) { api.clearSession(); this.refresh(); }
        else screens.show('auth');
        break;
    }
  }
}
