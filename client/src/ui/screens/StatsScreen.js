/**
 * StatsScreen — lifetime statistics, aggregated locally across every
 * session (localStorage) and shown from the main menu.
 * The tracker half listens to game events; the screen half renders.
 */
import { bus, Events } from '../../core/EventBus.js';
import { html, screens } from '../ScreenManager.js';
import { formatTime } from './MenuScreens.js';

const KEY = 'escape_room_lifetime_stats';

const FRESH = {
  playtime_s: 0, runs_started: 0, runs_finished: 0,
  rooms_cleared: 0, puzzles_solved: 0, puzzles_failed: 0, hints_used: 0,
  notes_read: 0, items_collected: 0, dialogues: 0, secrets_found: 0,
  haunts_banished: 0, haunts_touched: 0, deaths_of_light: 0,
  endings: { standard: 0, true: 0, dark: 0 },
};

class LifetimeStats {
  constructor() {
    this.data = { ...FRESH, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    this.data.endings = { ...FRESH.endings, ...(this.data.endings ?? {}) };
    this.saveAccum = 0;

    bus.on(Events.PUZZLE_SOLVED, () => this.bump('puzzles_solved'));
    bus.on(Events.PUZZLE_FAILED, () => this.bump('puzzles_failed'));
    bus.on(Events.HINT_REQUESTED, () => this.bump('hints_used'));
    bus.on(Events.NOTE_OPEN, () => this.bump('notes_read'));
    bus.on(Events.ITEM_ADDED, () => this.bump('items_collected'));
    bus.on(Events.ROOM_CLEARED, () => this.bump('rooms_cleared'));
    bus.on('dialogue:exchanged', () => this.bump('dialogues'));
    bus.on('secret:found', () => this.bump('secrets_found'));
    bus.on('secret:banish', () => this.bump('haunts_banished'));
    bus.on('sanity:damage', () => this.bump('haunts_touched'));
    bus.on('stats:runStarted', () => this.bump('runs_started'));
    bus.on('stats:ending', (ending) => {
      this.bump('runs_finished');
      this.data.endings[ending] = (this.data.endings[ending] ?? 0) + 1;
      this.save();
    });
  }

  bump(field, amount = 1) {
    this.data[field] = (this.data[field] ?? 0) + amount;
    this.save();
  }

  /** Called once per second of playtime from Game's frame system. */
  addPlaytime(dt) {
    this.data.playtime_s += dt;
    this.saveAccum += dt;
    if (this.saveAccum > 30) { this.saveAccum = 0; this.save(); }
  }

  save() { localStorage.setItem(KEY, JSON.stringify(this.data)); }
}

export const lifetimeStats = new LifetimeStats();

export class StatsScreen {
  constructor() {
    this.el = html`
      <div id="stats-screen" class="backdrop">
        <div class="glass panel panel-wide">
          <h2 class="heading">Lifetime Statistics</h2>
          <div class="stats-body inventory-grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))"></div>
          <button class="btn" data-action="back" style="align-self:flex-end">Back</button>
        </div>
      </div>`;
    this.body = this.el.querySelector('.stats-body');
    this.el.querySelector('[data-action="back"]')
      .addEventListener('click', () => screens.show('main-menu'));
    screens.register('stats', this.el, { onShow: () => this.render() });
  }

  render() {
    const d = lifetimeStats.data;
    const rows = [
      ['Time in the rooms', formatTime(Math.floor(d.playtime_s))],
      ['Runs started', d.runs_started],
      ['Runs finished', d.runs_finished],
      ['Rooms escaped', d.rooms_cleared],
      ['Puzzles solved', d.puzzles_solved],
      ['Puzzles failed', d.puzzles_failed],
      ['Hints begged for', d.hints_used],
      ['Notes read', d.notes_read],
      ['Items pocketed', d.items_collected],
      ['Words with the dead', d.dialogues],
      ['Secrets uncovered', d.secrets_found],
      ['Presences banished', d.haunts_banished],
      ['Times it touched you', d.haunts_touched],
      ['Endings — standard', d.endings.standard],
      ['Endings — true', d.endings.true],
      ['Endings — dark', d.endings.dark],
    ];
    this.body.innerHTML = rows.map(([label, value]) => `
      <div class="inv-slot" style="aspect-ratio:auto;padding:14px;align-items:flex-start;cursor:default">
        <div class="label">${label}</div>
        <div style="font-family:var(--font-mono);font-size:1.4rem;color:var(--accent)">${value}</div>
      </div>`).join('');
  }
}
