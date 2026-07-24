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
        <div class="menu-shell">
          <header class="menu-head">
            <h1 class="title-hero">AI Powered<br /><span class="accent">Escape Room</span></h1>
            <p class="subtitle">Ten rooms · One way out</p>
          </header>
          <nav class="menu-layout" aria-label="Main menu">
            <div class="menu-primary">
              <button class="btn btn-menu" data-action="new">▶ New Game</button>
              <button class="btn btn-menu" data-action="continue">Continue</button>
              <button class="btn btn-menu" data-action="load">Load Game</button>
            </div>
            <div class="menu-secondary">
              <button class="btn btn-tile" data-action="leaderboard">🏆<span>Leaderboard</span></button>
              <button class="btn btn-tile" data-action="achievements">🎖<span>Achievements</span></button>
              <button class="btn btn-tile" data-action="stats">📊<span>Statistics</span></button>
              <button class="btn btn-tile" data-action="manual">📖<span>Manual</span></button>
              <button class="btn btn-tile" data-action="settings">⚙<span>Settings</span></button>
              <button class="btn btn-tile" data-action="credits">✒<span>Credits</span></button>
              <button class="btn btn-tile" data-action="account">👤<span class="account-label">Sign In</span></button>
            </div>
          </nav>
          <footer class="menu-footer">
            <span>v${GAME_VERSION} · Final Year Project</span>
            <span class="account-status"></span>
          </footer>
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
    const accLabel = this.el.querySelector('.account-label');
    const status = this.el.querySelector('.account-status');
    if (api.isAuthenticated) {
      accLabel.textContent = 'Sign Out';
      status.textContent = `Signed in as ${api.user?.username ?? 'player'}`;
    } else {
      accLabel.textContent = 'Sign In';
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
      case 'stats': screens.show('stats'); break;
      case 'manual': screens.show('manual', { returnTo: 'main-menu' }); break;
      case 'settings': screens.show('settings', { returnTo: 'main-menu' }); break;
      case 'credits': screens.show('credits'); break;
      case 'account':
        if (api.isAuthenticated) { api.clearSession(); this.refresh(); }
        else screens.show('auth');
        break;
    }
  }
}
