/**
 * PauseMenu, Credits, Leaderboard, Achievements, SaveLoad screens.
 * Grouped: they are small, related overlay screens.
 */
import { html, screens } from '../ScreenManager.js';
import { api } from '../../net/ApiClient.js';
import { bus, Events } from '../../core/EventBus.js';
import { ICONS } from '../icons.js';

// ---------------------------------------------------------------------------
// Pause
// ---------------------------------------------------------------------------

export class PauseMenu {
  /** @param {{onResume: Function, onSave: Function, onQuit: Function}} handlers */
  constructor(handlers) {
    this.el = html`
      <div id="pause-menu" class="backdrop">
        <h2 class="heading" style="font-size:2rem;margin-bottom:8px">Paused</h2>
        <p class="subtitle">The room is still waiting</p>
        <nav class="menu-layout">
          <button class="btn btn-menu" data-action="resume">Resume</button>
          <button class="btn btn-menu" data-action="save">Save Game</button>
          <button class="btn btn-menu" data-action="objectives">Objectives</button>
          <button class="btn btn-menu" data-action="journal">Journal</button>
          <button class="btn btn-menu" data-action="manual">Manual</button>
          <button class="btn btn-menu" data-action="settings">Settings</button>
          <button class="btn btn-menu btn-danger" data-action="quit">Quit to Menu</button>
        </nav>
      </div>`;
    this.el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      switch (btn.dataset.action) {
        case 'resume': handlers.onResume(); break;
        case 'save': screens.show('save-load', { mode: 'save' }); break;
        case 'objectives': screens.show('objectives'); break;
        case 'journal': screens.show('journal'); break;
        case 'manual': screens.show('manual', { returnTo: 'pause-menu' }); break;
        case 'settings': screens.show('settings', { returnTo: 'pause-menu' }); break;
        case 'quit': handlers.onQuit(); break;
      }
    });
    screens.register('pause-menu', this.el);
  }
}

// ---------------------------------------------------------------------------
// Credits
// ---------------------------------------------------------------------------

export class CreditsScreen {
  constructor() {
    this.el = html`
      <div id="credits-screen" class="backdrop">
        <div class="glass panel" style="text-align:center">
          <h2 class="heading">Credits</h2>
          <div style="display:flex;flex-direction:column;gap:18px;padding:12px 0">
            <div><p class="label">A Final Year Project</p><p style="font-size:1.1rem">AI Powered Escape Room</p></div>
            <div class="divider"></div>
            <div><p class="label">Engine</p><p>Three.js · Rapier Physics · postprocessing</p></div>
            <div><p class="label">Backend</p><p>Flask · SQLAlchemy · OpenAI</p></div>
            <div><p class="label">Animation & UI</p><p>GSAP · Custom glassmorphism design system</p></div>
            <div><p class="label">Audio</p><p>Procedural WebAudio synthesis</p></div>
            <div class="divider"></div>
            <p style="font-size:0.8rem;color:var(--fg-muted)">All assets generated procedurally — no copyrighted material.<br/>Built with respect for every open-source license involved.</p>
          </div>
          <button class="btn" data-action="back">Back</button>
        </div>
      </div>`;
    this.el.querySelector('[data-action="back"]')
      .addEventListener('click', () => screens.show('main-menu'));
    screens.register('credits', this.el);
  }
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

export class LeaderboardScreen {
  constructor() {
    this.el = html`
      <div id="leaderboard-screen" class="backdrop">
        <div class="glass panel panel-wide">
          <h2 class="heading" style="display:inline-flex;align-items:center;gap:10px">${ICONS.trophy} Hall of Fame</h2>
          <p class="subtitle" style="margin-bottom:12px;font-size:0.75rem">The fastest souls to escape the rooms</p>
          <div class="lb-body" style="min-height:200px"></div>
          <button class="btn" data-action="back" style="align-self:flex-end">Back</button>
        </div>
      </div>`;
    this.body = this.el.querySelector('.lb-body');
    this.el.querySelector('[data-action="back"]')
      .addEventListener('click', () => screens.show('main-menu'));
    screens.register('leaderboard', this.el, { onShow: () => this.load() });
  }

  async load() {
    this.body.innerHTML = '<p style="color:var(--fg-muted);text-align:center;padding:40px">⏳ Consulting the archives…</p>';
    const res = await api.getLeaderboard();
    if (!res.ok) {
      this.body.innerHTML = '<p style="color:var(--fg-muted);text-align:center;padding:40px">🔮 The archives are unreachable (offline mode).</p>';
      return;
    }
    const rows = res.data.leaderboard;
    if (!rows.length) {
      this.body.innerHTML = '<p style="color:var(--fg-muted);text-align:center;padding:40px">⚰️ No souls have escaped yet. Be the first.</p>';
      return;
    }
    const rankBadges = ['🥇 Gold', '🥈 Silver', '🥉 Bronze'];
    this.body.innerHTML = `
      <div style="overflow-x:auto">
      <table class="leaderboard-table">
        <thead><tr>
          <th class="lb-rank">Rank</th><th class="lb-player">Player</th><th class="lb-score">Score</th>
          <th class="lb-time">Time</th><th class="lb-rooms">Rooms</th><th class="lb-ending">Ending</th>
        </tr></thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr class="lb-row ${i < 3 ? 'lb-top' : ''}" style="animation-delay:${i * 40}ms">
              <td class="lb-rank">${i < 3 ? rankBadges[i] : `#${i + 1}`}</td>
              <td class="lb-player">${escapeHtml(r.username)}</td>
              <td class="lb-score">${r.score.toLocaleString()}</td>
              <td class="lb-time">${formatTime(r.completion_time_s)}</td>
              <td class="lb-rooms">${r.rooms_cleared}/10</td>
              <td class="lb-ending ${r.ending === 'true' ? 'lb-true' : r.ending === 'dark' ? 'lb-dark' : ''}">${escapeHtml(r.ending)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      </div>`;
  }
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export class AchievementsScreen {
  constructor() {
    this.el = html`
      <div id="achievements-screen" class="backdrop">
        <div class="glass panel panel-wide">
          <h2 class="heading" style="display:inline-flex;align-items:center;gap:10px">${ICONS.medal} Achievements</h2>
          <p class="subtitle" style="margin-bottom:12px;font-size:0.75rem">Feats accomplished across all runs</p>
          <div class="ach-body inventory-grid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))"></div>
          <button class="btn" data-action="back" style="align-self:flex-end">Back</button>
        </div>
      </div>`;
    this.body = this.el.querySelector('.ach-body');
    this.el.querySelector('[data-action="back"]')
      .addEventListener('click', () => screens.show('main-menu'));
    screens.register('achievements', this.el, { onShow: () => this.load() });
  }

  async load() {
    const res = await api.getAchievements();
    const local = JSON.parse(localStorage.getItem('escape_room_achievements') || '[]');
    let list = res.ok ? res.data.achievements : [];
    if (!list.length) {
      list = local.map((code) => ({ code, title: code, description: '', unlocked: true, points: 0, secret: false }));
    }
    if (!list.length) {
      this.body.innerHTML = '<p style="color:var(--fg-muted);text-align:center;padding:40px">📜 Play online to view the full achievement list.</p>';
      return;
    }
    const achievementIcons = {
      first_escape: ICONS.swords, collector: ICONS.key, bookworm: ICONS.book, ghost_whisperer: ICONS.star,
      secret_finder: ICONS.star, light_bearer: ICONS.star, survivor: ICONS.medal, true_ending: ICONS.trophy,
      speed_demon: ICONS.star, puzzle_master: ICONS.trophy, no_hints: ICONS.medal, half_way: ICONS.medal,
    };
    this.body.innerHTML = '';
    for (const a of list) {
      const hidden = a.secret && !a.unlocked;
      const icon = achievementIcons[a.code] || ICONS.medal;
      this.body.appendChild(html`
        <div class="ach-card ${a.unlocked ? 'unlocked' : 'locked'}">
          <div class="ach-icon">${hidden ? '?' : icon}</div>
          <div class="ach-info">
            <div class="ach-title">${hidden ? '???' : escapeHtml(a.title)}</div>
            <div class="ach-desc">${hidden ? 'A secret remains hidden.' : escapeHtml(a.description || 'No description')}</div>
          </div>
          <div class="ach-points">${a.points || 0} pts</div>
        </div>`);
    }
  }
}

// ---------------------------------------------------------------------------
// Save / Load
// ---------------------------------------------------------------------------

export class SaveLoadScreen {
  /** @param {{onLoad: Function, onSave: Function, getSlots: Function}} handlers */
  constructor(handlers) {
    this.handlers = handlers;
    this.mode = 'load';
    this.el = html`
      <div id="saveload-screen" class="backdrop">
        <div class="glass panel">
          <h2 class="heading sl-title">Load Game</h2>
          <div class="sl-body" style="display:flex;flex-direction:column;gap:10px"></div>
          <button class="btn" data-action="back" style="align-self:flex-end">Back</button>
        </div>
      </div>`;
    this.body = this.el.querySelector('.sl-body');
    this.title = this.el.querySelector('.sl-title');
    this.el.querySelector('[data-action="back"]').addEventListener('click', () => {
      screens.show(this.mode === 'save' ? 'pause-menu' : 'main-menu');
    });
    screens.register('save-load', this.el, {
      onShow: (payload) => {
        this.mode = payload?.mode ?? 'load';
        this.title.textContent = this.mode === 'save' ? 'Save Game' : 'Load Game';
        this.render();
      },
    });
  }

  async render() {
    this.body.innerHTML = '<p style="color:var(--fg-muted)">Reading save slots…</p>';
    const slots = await this.handlers.getSlots();
    this.body.innerHTML = '';
    for (let i = 0; i <= 3; i++) {
      const slot = slots.find((s) => s.slot === i);
      const isAuto = i === 0;
      const label = isAuto ? 'Autosave' : `Slot ${i}`;
      const detail = slot
        ? `${slot.room_name ?? slot.room_id} · ${formatTime(slot.playtime_s)} · ${new Date(slot.updated_at).toLocaleString()}`
        : 'Empty';
      const row = html`
        <button class="btn" style="width:100%;justify-content:space-between;min-height:64px" ${(!slot && this.mode === 'load') || (isAuto && this.mode === 'save') ? 'disabled' : ''}>
          <span style="font-family:var(--font-display);letter-spacing:0.12em">${label}</span>
          <span style="font-size:0.75rem;color:var(--fg-muted);text-transform:none;letter-spacing:0">${detail}</span>
        </button>`;
      row.addEventListener('click', () => {
        if (this.mode === 'save') this.handlers.onSave(i).then(() => this.render());
        else this.handlers.onLoad(i);
      });
      this.body.appendChild(row);
    }
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

export function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}:${String(s).padStart(2, '0')}`;
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
