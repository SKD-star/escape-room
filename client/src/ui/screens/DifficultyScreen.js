/**
 * DifficultyScreen — mode picker shown before a new run begins.
 * Story / Normal / Nightmare, each with its own tuning multipliers.
 */
import { DIFFICULTY_MODES } from '../../config/constants.js';
import { bus, Events } from '../../core/EventBus.js';
import { html, screens } from '../ScreenManager.js';

export class DifficultyScreen {
  /** @param {(modeKey: string) => void} onPick */
  constructor(onPick) {
    this.el = html`
      <div id="difficulty-screen" class="backdrop">
        <div class="glass panel">
          <h2 class="heading">Choose Your Descent</h2>
          <div class="diff-body" style="display:flex;flex-direction:column;gap:12px"></div>
          <button class="btn" data-action="back" style="align-self:flex-end">Back</button>
        </div>
      </div>`;
    const body = this.el.querySelector('.diff-body');
    for (const [key, mode] of Object.entries(DIFFICULTY_MODES)) {
      const card = html`
        <button class="diff-card ${key === 'normal' ? 'recommended' : ''}" data-mode="${key}">
          <span class="diff-name">${mode.label}${key === 'normal' ? ' · recommended' : ''}</span>
          <span class="diff-blurb">${mode.blurb}</span>
          <span class="diff-mult">score ×${mode.scoreMult}</span>
        </button>`;
      card.addEventListener('click', () => {
        bus.emit(Events.PLAY_SOUND, { name: 'ui_click' });
        onPick(key);
      });
      body.appendChild(card);
    }
    this.el.querySelector('[data-action="back"]')
      .addEventListener('click', () => screens.show('main-menu'));
    screens.register('difficulty', this.el);
  }
}
