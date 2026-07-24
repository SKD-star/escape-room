/**
 * Journal — auto-collects every note the player reads, tagged with the
 * room it was found in. Open with J in-game or from the pause menu.
 * Entries persist inside the save state (Game captures/restores them).
 */
import { ROOMS } from '../../config/constants.js';
import { campaign } from '../../config/campaign.js';
import { bus, Events } from '../../core/EventBus.js';
import { html, screens } from '../ScreenManager.js';
import { escapeHtml } from './MenuScreens.js';

export class JournalScreen {
  /** @param {() => string|null} getCurrentRoom */
  constructor(getCurrentRoom, onClose) {
    this.getCurrentRoom = getCurrentRoom;
    this.onClose = onClose;
    this.entries = []; // { title, body, roomKey }

    this.el = html`
      <div id="journal-screen" class="backdrop">
        <div class="glass panel panel-wide" style="flex-direction:row;gap:0;max-height:80vh">
          <div class="journal-list" style="width:240px;border-right:1px solid var(--border-ghost);overflow-y:auto;padding-right:12px;display:flex;flex-direction:column;gap:6px"></div>
          <div class="journal-read" style="flex:1;padding-left:20px;overflow-y:auto">
            <h3 class="journal-title heading" style="font-size:1.2rem"></h3>
            <p class="journal-room label" style="margin:6px 0 14px"></p>
            <div class="journal-body" style="font-family:var(--font-display);line-height:1.9;color:#c9c2b4"></div>
          </div>
        </div>
        <button class="btn" data-action="close" style="margin-top:14px">Close Journal</button>
      </div>`;
    this.list = this.el.querySelector('.journal-list');
    this.el.querySelector('[data-action="close"]').addEventListener('click', () => this.close());
    screens.register('journal', this.el, {
      onShow: () => {
        // screens.previous = the screen we navigated here from
        // ('pause-menu' via the menu button, or none via the J key)
        this.cameFrom = screens.previous;
        this.render();
      },
    });

    // Auto-collect every note read
    bus.on(Events.NOTE_OPEN, ({ title, body }) => {
      if (this.entries.some((e) => e.title === title)) return;
      this.entries.push({ title, body, roomKey: this.getCurrentRoom() });
      bus.emit('journal:count', this.entries.length);
    });
  }

  close() {
    screens.hide('journal');
    // Opened from the pause menu → go back there; opened with J → resume play
    if (this.cameFrom === 'pause-menu') screens.show('pause-menu');
    else this.onClose?.();
  }

  roomName(key) {
    return campaign.get(key)?.name
      ?? ROOMS.find((r) => r.key === key)?.name
      ?? 'Unknown room';
  }

  render() {
    this.list.innerHTML = '';
    if (!this.entries.length) {
      this.list.innerHTML = '<p style="color:var(--fg-muted);font-size:0.85rem;padding:8px">Nothing collected yet. Read notes in the world — they are kept here.</p>';
      this.show(null);
      return;
    }
    this.entries.forEach((entry, i) => {
      const item = html`
        <button class="btn" style="width:100%;justify-content:flex-start;min-height:40px;padding:8px 12px;font-size:0.8rem;text-transform:none;letter-spacing:0.02em">
          ${escapeHtml(entry.title)}
        </button>`;
      item.addEventListener('click', () => this.show(entry));
      this.list.appendChild(item);
      if (i === 0) this.show(entry);
    });
  }

  show(entry) {
    this.el.querySelector('.journal-title').textContent = entry?.title ?? '';
    this.el.querySelector('.journal-room').textContent = entry ? `Found in ${this.roomName(entry.roomKey)}` : '';
    this.el.querySelector('.journal-body').innerHTML = entry
      ? escapeHtml(entry.body).replaceAll('\n', '<br/>') : '';
  }

  toJSON() { return this.entries; }
  restore(entries) {
    this.entries = Array.isArray(entries) ? entries : [];
    bus.emit('journal:count', this.entries.length);
  }
}
