/**
 * DifficultyScreen — mode picker shown before a new run begins.
 * Features persistent progression locks:
 *  - Story Mode: Unlocked initially (unlimited attempts, no timer).
 *  - Medium Mode: Locked until Story mode is completed.
 *  - Difficult Mode: Locked until Medium mode is completed.
 * Displays lock icons 🔒 and unlock messages for locked modes.
 */
import { DIFFICULTY_MODES } from '../../config/constants.js';
import { bus, Events } from '../../core/EventBus.js';
import { html, screens } from '../ScreenManager.js';
import { progression } from '../../player/ProgressionManager.js';

export class DifficultyScreen {
  /** @param {(modeKey: string) => void} onPick */
  constructor(onPick) {
    this.onPick = onPick;
    this.el = html`
      <div id="difficulty-screen" class="backdrop">
        <div class="glass panel" style="max-width:540px;width:90%">
          <h2 class="heading">Choose Difficulty Mode</h2>
          <p class="subtitle" style="margin-bottom:14px">Complete modes sequentially to unlock higher difficulties & progress.</p>
          <div class="diff-body" style="display:flex;flex-direction:column;gap:14px"></div>
          <button class="btn" data-action="back" style="align-self:flex-end;margin-top:14px">Back</button>
        </div>
      </div>`;

    this.body = this.el.querySelector('.diff-body');
    this.el.querySelector('[data-action="back"]')
      .addEventListener('click', () => screens.show('main-menu'));

    screens.register('difficulty', this.el, {
      onShow: () => this.render(),
    });
  }

  render() {
    this.body.innerHTML = '';

    for (const [key, mode] of Object.entries(DIFFICULTY_MODES)) {
      const unlocked = progression.isModeUnlocked(key);
      const lockReason = progression.getModeLockReason(key);

      const card = html`
        <button class="diff-card ${unlocked ? (key === 'normal' ? 'recommended' : '') : 'locked'}"
                data-mode="${key}"
                style="${!unlocked ? 'opacity:0.65;position:relative;border:1px dashed rgba(255,255,255,0.25);cursor:not-allowed;' : ''}">
          <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
            <span class="diff-name" style="display:inline-flex;align-items:center;gap:6px">
              ${!unlocked ? '<span style="font-size:1.1rem">🔒</span>' : ''}
              ${mode.label}
              ${unlocked && key === 'normal' ? ' · recommended' : ''}
            </span>
            <span class="diff-mult">score ×${mode.scoreMult}</span>
          </div>
          <span class="diff-blurb" style="text-align:left">${mode.blurb}</span>
          ${!unlocked ? `
            <div class="diff-lock-msg" style="color:var(--accent);font-size:0.8rem;margin-top:4px;display:flex;align-items:center;gap:4px">
              <span>🔒 ${lockReason}</span>
            </div>
          ` : ''}
        </button>`;

      card.addEventListener('click', () => {
        if (!unlocked) {
          bus.emit(Events.PLAY_SOUND, { name: 'error' });
          bus.emit(Events.TOAST, {
            text: `🔒 ${lockReason}`,
            type: 'danger',
            duration: 4500,
          });
          return;
        }

        bus.emit(Events.PLAY_SOUND, { name: 'ui_click' });
        this.onPick(key);
      });

      this.body.appendChild(card);
    }
  }
}
