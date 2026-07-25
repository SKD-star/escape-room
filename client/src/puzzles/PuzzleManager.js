/**
 * PuzzleManager — orchestrates AI-generated puzzles per room.
 *
 * Flow: room entered → fetch puzzle (AI/fallback) → player finds the
 * puzzle anchor → puzzle UI opens (keypad / riddle / sequence) →
 * solved → room exit unlocks → result posted for adaptive difficulty.
 *
 * Clue progression (3-tier):
 *   1. Room entry → brief objective shown in HUD
 *   2. 20s after room entry (or after first failed attempt) → contextual clue toast
 *   3. 50s in (or second failed attempt) → hint button auto-pulses with tooltip
 *
 * Attempt cost: only FULL SUBMISSION failures cost an attempt (entering
 * the wrong code / answer / sequence completely). Partial edits do not.
 */
import gsap from 'gsap';
import { bus, Events } from '../core/EventBus.js';
import { api } from '../net/ApiClient.js';
import { aiClient } from '../ai/AIClient.js';
import { difficulty } from '../config/difficulty.js';
import { html, screens } from '../ui/ScreenManager.js';
import { escapeHtml } from '../ui/screens/MenuScreens.js';

const SYMBOL_ICONS = {
  moon: '☾', eye: '◉', serpent: '§', key: '⚿', skull: '☠',
  flame: '♦', hourglass: '⧗', raven: '♠', star: '★', cross: '✚',
  circle: '◯', triangle: '▲', diamond: '◆', rune: 'ᚠ', wave: '≈',
  spiral: '⟳', omega: 'Ω', infinity: '∞', anchor: '⚓', shield: '⬡',
};

const SYMBOL_NAMES = {
  moon: 'Moon', eye: 'Eye', serpent: 'Serpent', key: 'Key', skull: 'Skull',
  flame: 'Flame', hourglass: 'Hourglass', raven: 'Raven', star: 'Star',
  cross: 'Cross', circle: 'Circle', triangle: 'Triangle', diamond: 'Diamond',
  rune: 'Rune', wave: 'Wave', spiral: 'Spiral', omega: 'Omega',
  infinity: 'Infinity', anchor: 'Anchor', shield: 'Shield',
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
    this._clueTimers = [];

    this.buildUI();

    bus.on(Events.ROOM_ENTERED, ({ key, theme }) => this.prepare(key, theme));
    bus.on('puzzle:open', () => this.open());
  }

  // -- lifecycle ----------------------------------------------------------

  async prepare(roomKey, theme) {
    // Clear old clue timers
    for (const t of this._clueTimers) clearTimeout(t);
    this._clueTimers = [];

    this.roomKey = roomKey;
    this.theme = theme;
    this.solved = false;
    this.hintsUsed = 0;
    this.attempts = 0;
    this.puzzle = null;
    this.sequencePick = [];
    this._submitFailed = 0; // track submission failures for progressive hints

    const base = Math.max(0.05, Math.min(0.95, 0.5 + difficulty.mode.puzzleBias));
    this.puzzle = await aiClient.getPuzzle(theme, roomKey, base);
    if (this.puzzle) {
      if (this.puzzle.type === 'sequence' && Array.isArray(this.puzzle.sequence)) {
        const names = this.puzzle.sequence.map((s) => s.charAt(0).toUpperCase() + s.slice(1));
        this.puzzle.clue = `Sacred Ritual Sequence Order: 1. ${names[0]} ➔ 2. ${names[1]} ➔ 3. ${names[2]} ➔ 4. ${names[3] || names[2]}`;
      } else if (this.puzzle.type === 'keypad' && this.puzzle.code) {
        this.puzzle.clue = `Observe the room features in order:\nI. Reading Lecterns in the center\nII. Paintings hanging on the walls\nIII. Candles lit around the room\nIV. Stone Pillars framing the exit door`;
      } else if (this.puzzle.type === 'riddle' && this.puzzle.riddle) {
        this.puzzle.clue = `Riddle Inscription: "${this.puzzle.riddle}" (Answer: "${(this.puzzle.answer || '').toUpperCase()}")`;
      }
    }
    this.startedAt = performance.now();
    bus.emit('puzzle:clue:ready', { roomKey, clue: this.puzzle?.clue });
    bus.emit(Events.OBJECTIVE_CHANGED, 'Explore the room to find clues, then solve the mechanism.');

    // Progressive clue system:
    // Tier 1 — after 2.5s, a clear thematic clue whisper toast
    this._clueTimers.push(setTimeout(() => {
      if (!this.solved && this.puzzle?.clue) {
        bus.emit(Events.TOAST, {
          text: `📜 Whispered Clue: "${this.puzzle.clue}"`,
          type: 'info',
          duration: 9000,
        });
      }
    }, 2500));

    // Tier 2 — after 40s, pulse the hint button in the puzzle UI
    this._clueTimers.push(setTimeout(() => {
      if (!this.solved) {
        bus.emit(Events.TOAST, {
          text: 'Struggling? Interact with the mechanism and click the Hint button.',
          duration: 5000,
        });
        this._pulseHintButton();
      }
    }, 40000));
  }

  _pulseHintButton() {
    const hintBtn = this.el?.querySelector('[data-action="hint"]');
    if (hintBtn) {
      hintBtn.classList.add('pulse-attention');
      setTimeout(() => hintBtn.classList.remove('pulse-attention'), 4000);
    }
  }

  open() {
    if (this.solved) {
      bus.emit(Events.TOAST, { text: 'This mechanism has already yielded.' });
      return;
    }
    if (!this.puzzle) {
      // Instant synchronous fallback so the mechanism NEVER blocks the player
      this.puzzle = {
        type: 'keypad',
        title: 'The Librarian\'s Lock',
        narrative: 'A heavy brass keypad seals the exit. Observe the room\'s physical relics.',
        code: '1462',
        clue: 'Observe the room features in order:\nI. Reading Lecterns in the center\nII. Paintings hanging on the walls\nIII. Candles lit around the room\nIV. Stone Pillars framing the exit door',
      };
      bus.emit('puzzle:clue:ready', { roomKey: this.roomKey, clue: this.puzzle.clue });
    }
    bus.emit(Events.PUZZLE_STARTED, this.puzzle);
    this.renderPuzzle();
    screens.show('puzzle');
    bus.emit(Events.GAME_PAUSE, { soft: true });
  }

  close() {
    screens.hide('puzzle');
    bus.emit(Events.GAME_RESUME);
  }

  // -- UI -----------------------------------------------------------------

  buildUI() {
    this.el = html`
      <div id="puzzle-screen" class="backdrop">
        <div class="puzzle-panel">
          <div class="puzzle-scanlines"></div>
          <div class="puzzle-header">
            <div class="puzzle-status-bar">
              <span class="puzzle-type-badge">MECHANISM</span>
              <span class="puzzle-attempts-indicator" aria-label="Attempts remaining">
                <span class="attempt-pip" data-pip="1"></span>
                <span class="attempt-pip" data-pip="2"></span>
                <span class="attempt-pip" data-pip="3"></span>
              </span>
            </div>
            <h2 class="puzzle-title"></h2>
            <p class="puzzle-narrative"></p>
            <div class="puzzle-clue-banner">
              <span class="clue-icon">📜</span>
              <span class="clue-text"></span>
            </div>
          </div>
          <div class="puzzle-body"></div>
          <p class="puzzle-feedback" aria-live="polite"></p>
          <div class="puzzle-actions">
            <button class="btn btn-ghost" data-action="hint">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              Hint
            </button>
            <button class="btn btn-ghost" data-action="close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
              Step Back
            </button>
          </div>
          <p class="puzzle-hint" aria-live="polite"></p>
        </div>
      </div>`;

    this.body = this.el.querySelector('.puzzle-body');
    this.feedback = this.el.querySelector('.puzzle-feedback');
    this.hintEl = this.el.querySelector('.puzzle-hint');
    this.el.querySelector('[data-action="close"]').addEventListener('click', () => this.close());
    this.el.querySelector('[data-action="hint"]').addEventListener('click', () => this.requestHint());

    // Listen to attempts updates to refresh pip indicators
    bus.on('attempts:begin', ({ remaining }) => this._updatePips(remaining));
    bus.on('attempts:failed', ({ remaining }) => this._updatePips(remaining));
    bus.on('attempts:exhausted', () => this._updatePips(0));

    screens.register('puzzle', this.el);
  }

  _updatePips(remaining) {
    const pips = this.el.querySelectorAll('.attempt-pip');
    pips.forEach((pip, i) => {
      pip.classList.toggle('active', i < remaining);
      pip.classList.toggle('lost', i >= remaining);
    });
  }

  renderPuzzle() {
    const p = this.puzzle;
    const typeBadge = this.el.querySelector('.puzzle-type-badge');
    typeBadge.textContent = p.type === 'keypad' ? 'KEYPAD LOCK' : p.type === 'riddle' ? 'RIDDLE' : 'SEQUENCE';
    this.el.querySelector('.puzzle-title').textContent = p.title ?? 'The Mechanism';
    this.el.querySelector('.puzzle-narrative').textContent = p.narrative ?? '';

    const clueBanner = this.el.querySelector('.puzzle-clue-banner');
    if (p.clue) {
      clueBanner.querySelector('.clue-text').textContent = `Clue: "${p.clue}"`;
      clueBanner.style.display = 'flex';
    } else {
      clueBanner.style.display = 'none';
    }

    this.feedback.textContent = '';
    this.feedback.className = 'puzzle-feedback';
    this.hintEl.textContent = '';
    this.body.innerHTML = '';

    if (p.type === 'keypad') this.renderKeypad();
    else if (p.type === 'riddle') this.renderRiddle();
    else this.renderSequence();

    // Animate panel in
    gsap.fromTo(this.el.querySelector('.puzzle-panel'),
      { opacity: 0, y: 32, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'expo.out' });
  }

  renderKeypad() {
    const display = html`<div class="keypad-display" aria-live="polite" aria-label="Entered code">
      <span class="keypad-display-dots">· · · ·</span>
    </div>`;
    const grid = html`<div class="keypad-grid"></div>`;
    let entry = '';
    const code = String(this.puzzle.code ?? '');

    const refresh = () => {
      const dots = display.querySelector('.keypad-display-dots');
      if (entry.length) {
        dots.textContent = entry.split('').map(() => '●').join(' ');
        dots.classList.add('has-entry');
      } else {
        dots.textContent = '· · · ·';
        dots.classList.remove('has-entry');
      }
    };

    const labels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '↵'];
    for (const label of labels) {
      const btn = html`<button class="keypad-btn ${label === 'C' ? 'keypad-clear' : label === '↵' ? 'keypad-enter' : ''}" aria-label="${label === '↵' ? 'Enter' : label === 'C' ? 'Clear' : label}">${label}</button>`;
      btn.addEventListener('click', () => {
        bus.emit(Events.PLAY_SOUND, { name: 'keypad' });
        if (label === 'C') {
          entry = '';
        } else if (label === '↵') {
          if (!entry) return;
          if (entry === code) {
            this.success(display);
          } else {
            // Only full submission failures cost an attempt
            this.fail(display, () => { entry = ''; refresh(); });
          }
          return;
        } else if (entry.length < 8) {
          entry += label;
        }
        refresh();
      });
      grid.appendChild(btn);
    }
    this.body.append(display, grid);
  }

  renderRiddle() {
    const riddle = html`<div class="riddle-text">${escapeHtml(this.puzzle.riddle ?? '')}</div>`;
    const row = html`
      <div class="riddle-input-row">
        <input class="riddle-input" placeholder="Speak your answer…" maxlength="60" aria-label="Riddle answer" />
        <button class="btn btn-primary riddle-submit">Answer</button>
      </div>`;
    const input = row.querySelector('input');
    const check = () => {
      const guess = input.value.trim().toLowerCase();
      const answer = String(this.puzzle.answer ?? '').trim().toLowerCase();
      if (!guess) return;
      if (guess === answer || (answer.length > 3 && guess.includes(answer))) {
        this.success(input);
      } else {
        // Full submission — costs an attempt
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

    const info = html`<p class="sequence-info">Restore the correct order — select all ${seq.length} marks</p>`;
    const clueBox = this.puzzle.clue
      ? html`<div class="sequence-clue">Clue: ${escapeHtml(this.puzzle.clue)}</div>`
      : html`<div></div>`;

    const pickedDisplay = html`<div class="sequence-picked" aria-live="polite" aria-label="Selected order"></div>`;
    const symbolGrid = html`<div class="symbol-grid"></div>`;

    const shuffle = [...seq].sort(() => Math.random() - 0.5);

    const refresh = () => {
      pickedDisplay.innerHTML = this.sequencePick.length
        ? this.sequencePick.map((s) => `<span class="picked-symbol">${SYMBOL_ICONS[s] ?? s[0]?.toUpperCase() ?? '?'}</span>`).join('')
        : '<span class="picked-placeholder">— select symbols in order —</span>';
    };
    refresh();

    for (const symbol of shuffle) {
      const icon = SYMBOL_ICONS[symbol] ?? symbol[0]?.toUpperCase() ?? '?';
      const name = SYMBOL_NAMES[symbol] ?? symbol;
      const btn = html`<button class="symbol-card" title="${name}" aria-label="${name}">
        <span class="symbol-card-icon">${icon}</span>
        <span class="symbol-card-name">${name}</span>
      </button>`;
      btn.addEventListener('click', () => {
        if (btn.classList.contains('picked') || this.solved) return;
        bus.emit(Events.PLAY_SOUND, { name: 'keypad' });
        btn.classList.add('picked');
        this.sequencePick.push(symbol);
        refresh();
        if (this.sequencePick.length === seq.length) {
          const correct = this.sequencePick.every((s, i) => s === seq[i]);
          if (correct) {
            this.success(pickedDisplay);
          } else {
            // Full sequence submitted wrongly — costs an attempt
            this.fail(pickedDisplay, () => {
              this.sequencePick = [];
              symbolGrid.querySelectorAll('.symbol-card').forEach((b) => b.classList.remove('picked'));
              refresh();
            });
          }
        }
      });
      symbolGrid.appendChild(btn);
    }
    this.body.append(info, clueBox, pickedDisplay, symbolGrid);
  }

  // -- outcome ------------------------------------------------------------

  success(anchorEl) {
    this.solved = true;
    anchorEl.classList?.add('success');
    this.feedback.className = 'puzzle-feedback success';
    this.feedback.textContent = '✓ The mechanism yields.';
    bus.emit(Events.PLAY_SOUND, { name: 'success' });
    bus.emit(Events.PUZZLE_SOLVED, {
      roomKey: this.roomKey,
      puzzle: this.puzzle,
      timeS: Math.round((performance.now() - this.startedAt) / 1000),
      hintsUsed: this.hintsUsed,
    });
    api.puzzleResult({
      room_id: this.roomKey,
      puzzle_type: this.puzzle.type,
      difficulty: this.puzzle.difficulty ?? 0.5,
      solved: true,
      solve_time_s: Math.round((performance.now() - this.startedAt) / 1000),
      hints_used: this.hintsUsed,
      ai_generated: this.puzzle.provider === 'openai',
    });
    setTimeout(() => this.close(), 1600);
  }

  fail(anchorEl, reset) {
    this.attempts += 1;
    anchorEl.classList?.add('error');
    this.feedback.className = 'puzzle-feedback error';
    this.feedback.textContent = '✗ Incorrect. The room pushes back.';
    bus.emit(Events.PLAY_SOUND, { name: 'error' });
    bus.emit('camera:shake', 0.4);

    // Emit the proper submission failure event (costs an attempt)
    bus.emit('puzzle:submit:failed', { roomKey: this.roomKey, attempts: this.attempts });
    bus.emit(Events.PUZZLE_FAILED, { roomKey: this.roomKey, attempts: this.attempts });

    // After 2nd failure, show a nudge
    if (this.attempts === 2) {
      setTimeout(() => {
        if (!this.solved && this.puzzle?.clue) {
          bus.emit(Events.TOAST, { text: `Remember: "${this.puzzle.clue}"`, duration: 6000 });
          this._pulseHintButton();
        }
      }, 1200);
    }

    setTimeout(() => {
      anchorEl.classList?.remove('error');
      this.feedback.textContent = '';
      this.feedback.className = 'puzzle-feedback';
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
    if (this.puzzle?.clue) {
      this.hintEl.textContent = this.puzzle.clue;
    } else {
      this.hintEl.textContent = 'The spirits consider…';
      const hint = await aiClient.getHint(this.puzzle, tier);
      this.hintEl.textContent = hint;
    }
    gsap.fromTo(this.hintEl, { opacity: 0 }, { opacity: 1, duration: 0.8 });
  }

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
