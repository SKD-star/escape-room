/**
 * PuzzleManager — orchestrates AI-generated puzzles per room.
 *
 * Flow: room entered → fetch puzzle (AI/fallback) → player finds the
 * puzzle anchor → puzzle UI opens (keypad / riddle / sequence) →
 * solved → room exit unlocks → result posted for adaptive difficulty.
 *
 * The keypad's code is embedded diegetically: it appears as a "clue"
 * scattered via toast/note when the player interacts with themed props.
 */
import gsap from 'gsap';
import { bus, Events } from '../core/EventBus.js';
import { api } from '../net/ApiClient.js';
import { aiClient } from '../ai/AIClient.js';
import { html, screens } from '../ui/ScreenManager.js';
import { escapeHtml } from '../ui/screens/MenuScreens.js';

const SYMBOL_ICONS = {
  moon: '☾', eye: '◉', serpent: '§', key: '⚿', skull: '☠',
  flame: '♦', hourglass: '⧗', raven: '♠',
};

export class PuzzleManager {
  constructor() {
    this.puzzle = null;
    this.roomKey = null;
    this.theme = null;
    this.solved = false;
    this.hintsUsed = 0;
    this.startedAt = 0;
    this.attempts = 0;
    this.sequencePick = [];

    this.buildUI();

    bus.on(Events.ROOM_ENTERED, ({ key, theme }) => this.prepare(key, theme));
    bus.on('puzzle:open', () => this.open());
  }

  // -- lifecycle ----------------------------------------------------------

  async prepare(roomKey, theme) {
    this.roomKey = roomKey;
    this.theme = theme;
    this.solved = false;
    this.hintsUsed = 0;
    this.attempts = 0;
    this.puzzle = null;
    this.sequencePick = [];
    // Fetch in the background so it's ready when the player finds the anchor
    this.puzzle = await aiClient.getPuzzle(theme, roomKey, 0.5);
    this.startedAt = performance.now();
    bus.emit(Events.OBJECTIVE_CHANGED, 'Explore the room. Something here holds the way out.');

    // Scatter the clue into the world after a delay (diegetic hint)
    setTimeout(() => {
      if (!this.solved && this.puzzle?.clue) {
        bus.emit(Events.TOAST, { text: `A whisper: "${this.puzzle.clue}"`, duration: 6000 });
      }
    }, 45000);
  }

  open() {
    if (this.solved) {
      bus.emit(Events.TOAST, { text: 'This mechanism has already yielded.' });
      return;
    }
    if (!this.puzzle) {
      bus.emit(Events.TOAST, { text: 'The mechanism is still waking… try again in a moment.' });
      return;
    }
    bus.emit(Events.PUZZLE_STARTED, this.puzzle);
    this.renderPuzzle();
    screens.show('puzzle');
    bus.emit(Events.GAME_PAUSE, { soft: true }); // releases pointer lock, keeps world visible
  }

  close() {
    screens.hide('puzzle');
    bus.emit(Events.GAME_RESUME);
  }

  // -- UI -----------------------------------------------------------------

  buildUI() {
    this.el = html`
      <div id="puzzle-screen" class="backdrop">
        <div class="glass panel puzzle-panel">
          <h2 class="heading puzzle-title"></h2>
          <p class="puzzle-narrative" style="color:var(--fg-secondary);font-style:italic"></p>
          <div class="puzzle-body"></div>
          <p class="field-error puzzle-feedback" aria-live="polite"></p>
          <div style="display:flex;gap:12px;justify-content:center">
            <button class="btn" data-action="hint">Request Hint</button>
            <button class="btn" data-action="close">Step Back</button>
          </div>
          <p class="puzzle-hint" style="font-size:0.85rem;color:var(--spectral-bright);min-height:1.4em"></p>
        </div>
      </div>`;
    this.body = this.el.querySelector('.puzzle-body');
    this.feedback = this.el.querySelector('.puzzle-feedback');
    this.hintEl = this.el.querySelector('.puzzle-hint');
    this.el.querySelector('[data-action="close"]').addEventListener('click', () => this.close());
    this.el.querySelector('[data-action="hint"]').addEventListener('click', () => this.requestHint());
    screens.register('puzzle', this.el);
  }

  renderPuzzle() {
    const p = this.puzzle;
    this.el.querySelector('.puzzle-title').textContent = p.title ?? 'The Mechanism';
    this.el.querySelector('.puzzle-narrative').textContent = p.narrative ?? '';
    this.feedback.textContent = '';
    this.hintEl.textContent = '';
    this.body.innerHTML = '';

    if (p.type === 'keypad') this.renderKeypad();
    else if (p.type === 'riddle') this.renderRiddle();
    else this.renderSequence();
  }

  renderKeypad() {
    const display = html`<div class="keypad-display" aria-live="polite">····</div>`;
    const grid = html`<div class="keypad-grid"></div>`;
    let entry = '';
    const code = String(this.puzzle.code ?? '');

    const refresh = () => {
      display.textContent = entry.length ? entry : '····';
    };
    for (const label of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⏎']) {
      const btn = html`<button class="btn">${label}</button>`;
      btn.addEventListener('click', () => {
        bus.emit(Events.PLAY_SOUND, { name: 'keypad' });
        if (label === 'C') entry = '';
        else if (label === '⏎') {
          if (entry === code) this.success(display);
          else this.fail(display, () => { entry = ''; refresh(); });
          return;
        } else if (entry.length < 8) entry += label;
        refresh();
      });
      grid.appendChild(btn);
    }
    this.body.append(display, grid);
  }

  renderRiddle() {
    const riddle = html`<p style="font-size:1.1rem;line-height:1.9;font-family:var(--font-display)">${escapeHtml(this.puzzle.riddle ?? '')}</p>`;
    const row = html`
      <div class="dialogue-input" style="margin-top:20px">
        <input placeholder="Your answer…" maxlength="40" aria-label="Riddle answer" />
        <button class="btn btn-primary">Answer</button>
      </div>`;
    const input = row.querySelector('input');
    const check = () => {
      const guess = input.value.trim().toLowerCase();
      const answer = String(this.puzzle.answer ?? '').trim().toLowerCase();
      if (!guess) return;
      if (guess === answer || (answer.length > 3 && guess.includes(answer))) {
        this.success(input);
      } else {
        this.fail(input, () => { input.value = ''; });
      }
    };
    row.querySelector('button').addEventListener('click', check);
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') check();
    });
    this.body.append(riddle, row);
    setTimeout(() => input.focus(), 80);
  }

  renderSequence() {
    const seq = this.puzzle.sequence ?? [];
    this.sequencePick = [];
    const info = html`<p class="label">Restore the order — ${seq.length} marks</p>`;
    const picked = html`<div class="keypad-display" style="font-size:1.4rem"></div>`;
    const rowEl = html`<div class="symbol-row"></div>`;
    const shuffled = [...seq].sort(() => Math.random() - 0.5);

    const refresh = () => {
      picked.textContent = this.sequencePick.map((s) => SYMBOL_ICONS[s] ?? s[0].toUpperCase()).join(' ');
    };
    for (const symbol of shuffled) {
      const btn = html`<button class="symbol-btn" title="${symbol}">${SYMBOL_ICONS[symbol] ?? symbol[0].toUpperCase()}</button>`;
      btn.addEventListener('click', () => {
        if (btn.classList.contains('picked')) return;
        bus.emit(Events.PLAY_SOUND, { name: 'keypad' });
        btn.classList.add('picked');
        this.sequencePick.push(symbol);
        refresh();
        if (this.sequencePick.length === seq.length) {
          const correct = this.sequencePick.every((s, i) => s === seq[i]);
          if (correct) this.success(picked);
          else this.fail(picked, () => {
            this.sequencePick = [];
            rowEl.querySelectorAll('.symbol-btn').forEach((b) => b.classList.remove('picked'));
            refresh();
          });
        }
      });
      rowEl.appendChild(btn);
    }
    this.body.append(info, picked, rowEl);
  }

  // -- outcome ------------------------------------------------------------

  success(anchorEl) {
    this.solved = true;
    anchorEl.classList?.add('success');
    this.feedback.style.color = 'var(--success)';
    this.feedback.textContent = 'The mechanism yields.';
    bus.emit(Events.PLAY_SOUND, { name: 'success' });
    bus.emit(Events.PUZZLE_SOLVED, {
      roomKey: this.roomKey,
      puzzle: this.puzzle,
      timeS: Math.round((performance.now() - this.startedAt) / 1000),
      hintsUsed: this.hintsUsed,
    });
    // Report for adaptive difficulty (fire-and-forget)
    api.puzzleResult({
      room_id: this.roomKey,
      puzzle_type: this.puzzle.type,
      difficulty: this.puzzle.difficulty ?? 0.5,
      solved: true,
      solve_time_s: Math.round((performance.now() - this.startedAt) / 1000),
      hints_used: this.hintsUsed,
      ai_generated: this.puzzle.provider === 'openai',
    });
    setTimeout(() => this.close(), 1400);
  }

  fail(anchorEl, reset) {
    this.attempts += 1;
    anchorEl.classList?.add('error');
    this.feedback.style.color = 'var(--blood-bright)';
    this.feedback.textContent = 'The room disagrees.';
    bus.emit(Events.PLAY_SOUND, { name: 'error' });
    bus.emit('camera:shake', 0.4);
    bus.emit(Events.PUZZLE_FAILED, { roomKey: this.roomKey, attempts: this.attempts });
    setTimeout(() => {
      anchorEl.classList?.remove('error');
      this.feedback.textContent = '';
      reset?.();
    }, 900);
    if (this.attempts % 4 === 0) {
      api.puzzleResult({
        room_id: this.roomKey,
        puzzle_type: this.puzzle.type,
        difficulty: this.puzzle.difficulty ?? 0.5,
        solved: false,
        solve_time_s: Math.round((performance.now() - this.startedAt) / 1000),
        hints_used: this.hintsUsed,
        ai_generated: this.puzzle.provider === 'openai',
      });
    }
  }

  async requestHint() {
    const tier = Math.min(2, this.hintsUsed);
    this.hintsUsed += 1;
    bus.emit(Events.HINT_REQUESTED, { tier });
    this.hintEl.textContent = 'The spirits consider…';
    const hint = await aiClient.getHint(this.puzzle, tier);
    this.hintEl.textContent = hint;
    gsap.fromTo(this.hintEl, { opacity: 0 }, { opacity: 1, duration: 0.8 });
  }

  /** Serialize for save games. */
  toJSON() {
    return {
      roomKey: this.roomKey,
      solved: this.solved,
      hintsUsed: this.hintsUsed,
      puzzle: this.puzzle,
    };
  }

  restore(data) {
    if (!data) return;
    if (data.roomKey === this.roomKey && data.puzzle) {
      this.puzzle = data.puzzle;
      this.solved = data.solved;
      this.hintsUsed = data.hintsUsed ?? 0;
    }
  }
}
