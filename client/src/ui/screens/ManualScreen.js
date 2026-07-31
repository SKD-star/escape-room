/**
 * ManualScreen — the in-game field manual. A tabbed, spoiler-light guide the
 * player can open from the main menu or the pause menu at any time.
 *
 * Tabs: Overview · Controls · Survival · Puzzles · Chapters · Tips.
 * The Chapters tab is generated from ROOMS so per-level briefings and the
 * difficulty countdown limits stay in sync with the game data automatically.
 */
import { DIFFICULTY_MODES, ROOMS } from '../../config/constants.js';
import { html, screens } from '../ScreenManager.js';
import { escapeHtml } from './MenuScreens.js';

const CONTROLS = [
  ['W A S D', 'Walk'],
  ['Mouse', 'Look around'],
  ['RMB (hold)', 'Focus zoom — read far details'],
  ['Shift (hold)', 'Sprint (drains stamina, and it is loud)'],
  ['C', 'Crouch — slow and quiet'],
  ['Space', 'Jump'],
  ['E', 'Interact — pick up / read / open / talk / solve'],
  ['F', 'Flashlight (throws a held item instead)'],
  ['R', 'Reset a held item’s rotation'],
  ['Tab', 'Inventory'],
  ['T', 'Talk to the room’s spirit — ask it anything, anywhere'],
  ['J', 'Journal — every note you have read'],
  ['Q', 'Objective reminder'],
  ['P', 'Photo mode — save a clean screenshot'],
  ['F5 / F9', 'Quick save / quick load'],
  ['Esc', 'Pause (also releases the mouse)'],
];

const GAMEPAD = [
  ['Left stick', 'Move'],
  ['Right stick', 'Look'],
  ['A / B', 'Jump / Crouch'],
  ['X / Y', 'Interact / Flashlight'],
  ['LT (hold)', 'Focus zoom'],
  ['RB (hold)', 'Sprint'],
  ['Start / Back', 'Pause / Inventory'],
];

const PUZZLES = [
  ['Keypad', 'Enter a digit code. It is hidden in the clue text you find around the room.'],
  ['Riddle', 'Type a one-word answer. Partial matches on longer words are accepted.'],
  ['Sequence', 'Click the symbols in the right order. The clue names where the order begins.'],
];

export class ManualScreen {
  constructor() {
    this.returnTo = 'main-menu';
    this.el = html`
      <div id="manual-screen" class="backdrop">
        <div class="glass panel panel-wide">
          <h2 class="heading">Field Manual</h2>
          <div class="tabs">
            <button class="tab active" data-tab="overview">Overview</button>
            <button class="tab" data-tab="controls">Controls</button>
            <button class="tab" data-tab="survival">Survival</button>
            <button class="tab" data-tab="puzzles">Puzzles</button>
            <button class="tab" data-tab="chapters">Chapters</button>
            <button class="tab" data-tab="tips">Tips</button>
          </div>
          <div class="manual-body"></div>
          <div style="display:flex;gap:12px;justify-content:flex-end">
            <button class="btn" data-action="back">Back</button>
          </div>
        </div>
      </div>`;

    this.body = this.el.querySelector('.manual-body');
    this.el.querySelectorAll('.tab').forEach((tab) =>
      tab.addEventListener('click', () => {
        this.el.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        this.renderTab(tab.dataset.tab);
      }));
    this.el.querySelector('[data-action="back"]')
      .addEventListener('click', () => screens.show(this.returnTo));

    screens.register('manual', this.el, {
      onShow: (payload) => {
        this.returnTo = payload?.returnTo ?? 'main-menu';
        this.el.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', i === 0));
        this.renderTab('overview');
      },
    });
  }

  renderTab(name) {
    const map = {
      overview: () => this.overview(),
      controls: () => this.controls(),
      survival: () => this.survival(),
      puzzles: () => this.puzzles(),
      chapters: () => this.chapters(),
      tips: () => this.tips(),
    };
    this.body.innerHTML = (map[name] ?? map.overview)();
    this.body.scrollTop = 0;
  }

  // -- tabs -----------------------------------------------------------------

  overview() {
    return `
      ${this.section('Where you are', `
        You wake in a haunted library with no memory of arriving. An intelligence
        has locked you inside <strong>ten escape rooms</strong>, each sealed by a
        puzzle it generates fresh for every run. Solve it, escape, survive the
        dark between rooms, and uncover the truth across three endings.`)}
      ${this.section('The loop of every room', `
        <ol class="manual-list">
          <li><strong>Follow the gold diamond 🔶</strong> — it floats over the room’s puzzle. That is always your goal.</li>
          <li><strong>Explore on the way</strong> — read notes (saved to your Journal), grab key items and batteries, and talk to the room’s spirit for hints.</li>
          <li><strong>Solve the puzzle</strong> — press <span class="kbd">E</span> under the gold diamond.</li>
          <li><strong>Follow the green diamond 🟢</strong> — the exit unseals; walk into the next chapter.</li>
        </ol>`)}
      ${this.callout('Open this manual any time from the pause menu. Stuck on a specific lock? The spirit in each room will nudge you.')}`;
  }

  controls() {
    return `
      ${this.section('Keyboard &amp; mouse', this.kvTable(CONTROLS))}
      ${this.section('Gamepad (plug in and play)', this.kvTable(GAMEPAD))}`;
  }

  survival() {
    return `
      ${this.section('🔦 Flashlight', `
        <span class="kbd">F</span> toggles it. It drains battery (~1 minute of
        continuous light), tops up at each room entrance, and refills fully from
        hidden battery pickups. A stuttering beam means a dying battery — or
        something close.`)}
      ${this.section('🧠 Sanity', `
        Darkness erodes your mind: warped vision, a pounding heart, whispers.
        <em>Restore it</em> by standing in light, solving puzzles, escaping rooms
        and finding secrets. Let it hit rock bottom and your run leans toward the
        Dark Ending. You can soften or disable sanity effects in Settings.`)}
      ${this.section('👁 The Presence', `
        A dark figure that manifests on Normal and Nightmare and drifts toward you.
        Hold your flashlight beam on it for about two seconds to banish it. If it
        touches you: a scare and a heavy sanity hit — never death. Sprinting is
        loud and draws it; crouching keeps you quiet.`)}
      ${this.section('⏳ The room clock', `
        A countdown sits at the top of the screen on <strong>Normal</strong> and
        <strong>Nightmare</strong> — each room gives you a time limit that keeps
        ticking even while you work the lock.
        <ul class="manual-list">
          <li><strong>Normal</strong> — a generous, <em>soft</em> clock. Run it out and you enter overtime: sanity bleeds, but you can still finish.</li>
          <li><strong>Nightmare</strong> — a <em>hard deadline</em>. Run it out and the room <strong>restarts</strong>: it reloads with a fresh puzzle and a full timer. Rooms you already escaped stay cleared, so only the current room is lost.</li>
        </ul>
        <strong>Story</strong> mode has no clock, and you can switch the countdown
        off in Settings → Controls → Room Countdown.`)}`;
  }

  puzzles() {
    return `
      ${this.section('The three lock types', this.kvTable(PUZZLES))}
      ${this.section('Hints', `
        Stuck? Press <strong>Request Hint</strong> inside a puzzle — three tiers,
        each more direct. But lean on them: leaning past <strong>12 hints</strong>
        across a whole run bends your story toward the Dark Ending.`)}
      ${this.callout('The clue is always somewhere in the room. Read notes, inspect props, and ask the spirit before you spend a hint.')}`;
  }

  chapters() {
    const rows = ROOMS.map((r, i) => {
      const normal = DIFFICULTY_MODES.normal.countdown;
      const nightmare = DIFFICULTY_MODES.nightmare.countdown;
      const limit = (cfg) => (cfg ? this.mmss(Math.round(r.par * cfg.mult)) : '—');
      return `
        <div class="manual-chapter">
          <div class="mc-head">
            <span class="mc-index">${String(i + 1).padStart(2, '0')}</span>
            <div>
              <div class="mc-name">${escapeHtml(r.name)}</div>
              <div class="mc-chapter">${escapeHtml(r.chapter)}</div>
            </div>
            <div class="mc-times" title="Room time limit by difficulty">
              <span>Story ∞</span>
              <span>Normal ${limit(normal)}</span>
              <span class="mc-hard">Nightmare ${limit(nightmare)}</span>
            </div>
          </div>
          <p class="mc-brief">${escapeHtml(r.brief)}</p>
          <p class="mc-tip"><span class="mc-tip-label">Tip</span> ${escapeHtml(r.tip)}</p>
        </div>`;
    }).join('');
    return `
      <p class="manual-note">A briefing for each of the ten levels — what it is and one honest nudge.
      No answers here; those live in the room. Times shown are the countdown on each difficulty.</p>
      ${rows}`;
  }

  tips() {
    const items = [
      ['Can’t find the puzzle?', 'Look for the floating gold diamond — it is always there. Check the compass and walk around the furniture.'],
      ['E isn’t working?', 'Get within about three metres and centre the crosshair until it turns gold and shows the “E Interact” label.'],
      ['Battery always dying?', 'One battery hides in a corner of every room (+45%). Turn the light off in safe, lit spots to save charge.'],
      ['Too scary?', 'Play Story mode, or turn off The Presence and Sanity Effects in Settings → Controls.'],
      ['Running out of time?', 'Solving the puzzle stops the clock instantly — head to the gold diamond first, explore second. Or disable the countdown in Settings.'],
      ['Want the best ending?', 'Collect key items, combine the right pair in your inventory, talk to the spirits, and go easy on hints.'],
    ];
    return items.map(([q, a]) => this.section(q, a)).join('');
  }

  // -- helpers --------------------------------------------------------------

  section(title, bodyHtml) {
    return `
      <section class="manual-section">
        <h3 class="manual-h">${title}</h3>
        <div class="manual-p">${bodyHtml}</div>
      </section>`;
  }

  callout(text) {
    return `<div class="manual-callout">💡 ${escapeHtml(text)}</div>`;
  }

  kvTable(rows) {
    return `<div class="manual-kv">${rows.map(([k, v]) => `
      <div class="mkv-key">${k}</div><div class="mkv-val">${v}</div>`).join('')}</div>`;
  }

  mmss(seconds) {
    const m = Math.floor(seconds / 60);
    return `${m}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
  }
}
