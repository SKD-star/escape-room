/**
 * Overlay screens used during gameplay:
 *  - NoteReader: full-screen aged-paper note/book reading
 *  - DialogueBox: AI NPC conversation with free-text input
 *  - ObjectivesScreen: current + completed objectives
 *  - IntroScreen: animated story intro / chapter cards
 *  - EndingScreen: multiple endings + run stats
 */
import gsap from 'gsap';
import { bus, Events } from '../../core/EventBus.js';
import { api } from '../../net/ApiClient.js';
import { html, screens } from '../ScreenManager.js';
import { escapeHtml, formatTime } from './MenuScreens.js';

// ---------------------------------------------------------------------------
// Note reader
// ---------------------------------------------------------------------------

export class NoteReader {
  constructor(onClose) {
    this.onClose = onClose;
    this.el = html`
      <div id="note-screen">
        <div class="note-paper">
          <h3 class="note-title"></h3>
          <div class="note-body"></div>
        </div>
        <p class="label" style="margin-top:18px">Press <span style="color:var(--accent)">E</span> or click to close</p>
      </div>`;
    this.el.addEventListener('click', () => this.close());
    screens.register('note', this.el);
    bus.on(Events.NOTE_OPEN, ({ title, body }) => this.open(title, body));
  }

  open(title, body) {
    this.el.querySelector('.note-title').textContent = title;
    this.el.querySelector('.note-body').innerHTML = escapeHtml(body).replaceAll('\n', '<br/>');
    screens.show('note');
    bus.emit(Events.PLAY_SOUND, { name: 'paper' });
  }

  close() {
    screens.hide('note');
    this.onClose?.();
  }
}

// ---------------------------------------------------------------------------
// Dialogue with AI NPC
// ---------------------------------------------------------------------------

export class DialogueBox {
  constructor(onClose) {
    this.onClose = onClose;
    this.npc = 'The Librarian';
    this.theme = 'library';
    this.history = [];
    this.isThinking = false;
    this.customApiKey = localStorage.getItem('escape_room_ai_key') || '';

    this.el = html`
      <div id="dialogue-screen" class="backdrop">
        <div class="dialogue-box glass" style="max-width:640px;width:92%;max-height:88vh;display:flex;flex-direction:column;padding:22px;gap:14px;border-radius:16px">
          <!-- Chatbot Header -->
          <div class="dialogue-header" style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-ghost);padding-bottom:14px">
            <div style="display:flex;align-items:center;gap:12px">
              <div style="font-size:1.6rem;background:rgba(212,175,55,0.15);width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:50%;border:1px solid var(--accent);box-shadow:0 0 10px rgba(212,175,55,0.2)">👻</div>
              <div>
                <div style="display:flex;align-items:center;gap:8px">
                  <span class="npc-name" style="font-family:var(--font-display);font-size:1.3rem;color:var(--fg-primary);letter-spacing:0.04em">The Librarian</span>
                  <span class="ai-status-badge" style="font-size:0.68rem;padding:2px 8px;border-radius:12px;background:rgba(74,154,140,0.2);color:#7fc9bc;border:1px solid rgba(74,154,140,0.4)">AI Active</span>
                </div>
                <div style="font-size:0.75rem;color:var(--accent);letter-spacing:0.05em">Full Room Companion & Chatbot</div>
              </div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <button class="btn btn-icon btn-key-toggle" title="Configure AI Key" style="padding:6px 10px;font-size:0.8rem">🔑 AI Key</button>
              <button class="btn btn-icon" data-action="leave" title="Close Dialogue" style="padding:6px 12px;font-size:0.85rem">✕ Leave</button>
            </div>
          </div>

          <!-- API Key Input Panel (Toggleable) -->
          <div class="ai-key-panel" style="display:none;background:rgba(0,0,0,0.5);border:1px solid var(--accent);border-radius:8px;padding:10px 14px;gap:8px;align-items:center">
            <input type="password" class="ai-key-input" placeholder="Paste OpenAI API Key (sk-...)" value="${escapeHtml(this.customApiKey)}" style="flex:1;padding:8px 12px;border-radius:6px;background:#0a0a12;border:1px solid var(--border-ghost);color:#fff;font-size:0.82rem;font-family:monospace" />
            <button class="btn btn-primary btn-save-key" style="padding:8px 14px;font-size:0.8rem">Save Key</button>
          </div>

          <!-- Chat Log Container -->
          <div class="dialogue-log" style="flex:1;overflow-y:auto;min-height:220px;max-height:360px;display:flex;flex-direction:column;gap:12px;padding:8px 4px"></div>

          <!-- Quick Suggestion Chips -->
          <div class="dialogue-suggestions" style="display:flex;gap:8px;flex-wrap:wrap;padding:4px 0"></div>

          <!-- Input Area -->
          <div class="dialogue-input" style="display:flex;gap:10px;align-items:center">
            <input placeholder="Ask the Librarian anything about this room..." maxlength="250" aria-label="Your message to the librarian" style="flex:1;padding:12px 16px;border-radius:8px;background:rgba(0,0,0,0.4);border:1px solid var(--border-ghost);color:#fff;font-family:inherit" />
            <button class="btn btn-primary" data-action="send" style="padding:12px 22px">Ask AI</button>
          </div>
        </div>
      </div>`;

    this.logEl = this.el.querySelector('.dialogue-log');
    this.input = this.el.querySelector('input');
    this.suggestionsEl = this.el.querySelector('.dialogue-suggestions');
    this.keyPanel = this.el.querySelector('.ai-key-panel');
    this.keyInput = this.el.querySelector('.ai-key-input');
    this.statusBadge = this.el.querySelector('.ai-status-badge');

    this.el.querySelector('[data-action="send"]').addEventListener('click', () => this.send());
    this.el.querySelector('[data-action="leave"]').addEventListener('click', () => this.close());

    this.el.querySelector('.btn-key-toggle').addEventListener('click', () => {
      const isVisible = this.keyPanel.style.display !== 'none';
      this.keyPanel.style.display = isVisible ? 'none' : 'flex';
    });

    this.el.querySelector('.btn-save-key').addEventListener('click', () => {
      this.customApiKey = this.keyInput.value.trim();
      if (this.customApiKey) {
        localStorage.setItem('escape_room_ai_key', this.customApiKey);
        this.statusBadge.textContent = 'Custom AI Key Active';
        bus.emit(Events.TOAST, { text: 'Custom AI API key saved!' });
      } else {
        localStorage.removeItem('escape_room_ai_key');
        this.statusBadge.textContent = 'AI Active';
      }
      this.keyPanel.style.display = 'none';
    });

    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') this.send();
      if (e.key === 'Escape') this.close();
    });

    screens.register('dialogue', this.el);
    bus.on(Events.DIALOGUE_OPEN, (payload) => this.open(payload));
  }

  updateSuggestions() {
    const chipsMap = {
      library: [
        { text: 'What is written in the scroll?', label: '📜 Scroll Clue' },
        { text: 'How do I unlock the exit door?', label: '🔐 Exit Lock' },
        { text: 'Who are you and why are you here?', label: '👻 Who are you?' },
      ],
      temple: [
        { text: 'What order do the serpent idols follow?', label: '🐍 Serpent Ritual' },
        { text: 'Where is the offering placed?', label: '🕯️ Offering Place' },
        { text: 'Tell me about the carvings.', label: '🗿 Temple Lore' },
      ],
      prison: [
        { text: 'What do the tally marks on the wall mean?', label: '🔢 Warden\'s Tally' },
        { text: 'How do I open the cell lock?', label: '🔒 Cell Lock' },
        { text: 'Where is the warden\'s key?', label: '🔑 Warden Key' },
      ],
      default: [
        { text: 'What clue is hidden in this room?', label: '🔍 Room Clue' },
        { text: 'How do I solve the current lock?', label: '🔐 Lock Solution' },
        { text: 'Give me a subtle hint.', label: '💡 Nudge' },
      ],
    };

    const chips = chipsMap[this.theme] || chipsMap.default;
    this.suggestionsEl.innerHTML = chips.map((c) => `
      <button class="chip-btn" data-suggest="${escapeHtml(c.text)}">${escapeHtml(c.label)}</button>
    `).join('');

    this.suggestionsEl.querySelectorAll('.chip-btn').forEach((chip) => {
      chip.addEventListener('click', () => {
        const text = chip.dataset.suggest;
        if (text && !this.isThinking) {
          this.input.value = text;
          this.send();
        }
      });
    });
  }

  open({ npc, theme, greeting }) {
    this.npc = npc || 'The Librarian';
    this.theme = theme || 'library';
    this.history = [];
    this.isThinking = false;
    this.logEl.innerHTML = '';
    this.customApiKey = localStorage.getItem('escape_room_ai_key') || '';
    this.keyInput.value = this.customApiKey;

    if (this.customApiKey) {
      this.statusBadge.textContent = 'Custom AI Key Active';
    } else {
      this.statusBadge.textContent = 'AI Active';
    }

    this.el.querySelector('.npc-name').textContent = this.npc;
    this.updateSuggestions();
    screens.show('dialogue');

    const initialGreeting = greeting || 'Shhh... Ask what you will about this room — quiet, now.';
    this.appendMessage('assistant', initialGreeting);
    setTimeout(() => this.input.focus(), 100);
  }

  appendMessage(role, text) {
    const isUser = role === 'user';
    const msgEl = html`
      <div class="chat-msg ${isUser ? 'chat-user' : 'chat-npc'}"
           style="display:flex;flex-direction:column;align-self:${isUser ? 'flex-end' : 'flex-start'};max-width:85%;background:${isUser ? 'rgba(212,175,55,0.18)' : 'rgba(255,255,255,0.06)'};border:1px solid ${isUser ? 'var(--accent)' : 'var(--border-ghost)'};padding:10px 14px;border-radius:${isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px'}">
        <div style="font-size:0.7rem;color:var(--fg-muted);margin-bottom:4px;font-weight:600">${isUser ? 'You' : this.npc}</div>
        <div class="msg-text" style="font-size:0.92rem;line-height:1.5;color:var(--fg-primary)"></div>
      </div>`;

    const textEl = msgEl.querySelector('.msg-text');
    this.logEl.appendChild(msgEl);
    this.scrollToBottom();

    if (isUser) {
      textEl.textContent = text;
    } else {
      this.typewrite(textEl, text);
    }
  }

  scrollToBottom() {
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  async send() {
    const message = this.input.value.trim();
    if (!message || this.isThinking) return;

    this.input.value = '';
    this.isThinking = true;

    // Display user message in chat stream
    this.appendMessage('user', message);
    this.history.push({ role: 'user', content: message });

    // Show thinking indicator
    const thinkingEl = html`
      <div class="chat-msg chat-npc thinking-msg" style="align-self:flex-start;background:rgba(255,255,255,0.06);border:1px solid var(--border-ghost);padding:10px 14px;border-radius:14px 14px 14px 2px">
        <div style="font-size:0.7rem;color:var(--fg-muted);margin-bottom:4px">${this.npc}</div>
        <div style="font-size:0.9rem;color:var(--accent);font-style:italic">Consulting room archives…</div>
      </div>`;
    this.logEl.appendChild(thinkingEl);
    this.scrollToBottom();

    const payload = {
      npc: this.npc,
      theme: this.theme,
      message,
      history: this.history,
    };
    if (this.customApiKey) payload.api_key = this.customApiKey;

    const res = await api.aiDialogue(payload);

    thinkingEl.remove();
    this.isThinking = false;

    const line = res.ok && res.data?.line
      ? res.data.line
      : 'The room whispers back: Observe the items and notes around you for your answer.';

    this.history.push({ role: 'assistant', content: line });
    this.appendMessage('assistant', line);

    bus.emit(Events.PLAY_SOUND, { name: 'whisper' });
    bus.emit('dialogue:exchanged');
  }

  typewrite(targetEl, text) {
    gsap.killTweensOf(targetEl);
    targetEl.textContent = '';
    const chars = [...text];
    const obj = { i: 0 };
    gsap.to(obj, {
      i: chars.length,
      duration: Math.min(2.0, chars.length * 0.025),
      ease: 'none',
      onUpdate: () => {
        targetEl.textContent = chars.slice(0, Math.floor(obj.i)).join('');
        this.scrollToBottom();
      },
    });
  }

  close() {
    screens.hide('dialogue');
    this.onClose?.();
  }
}

// ---------------------------------------------------------------------------
// Objectives
// ---------------------------------------------------------------------------

export class ObjectivesScreen {
  constructor() {
    this.objectives = [];
    this.el = html`
      <div id="objectives-screen" class="backdrop">
        <div class="glass panel">
          <h2 class="heading">Objectives</h2>
          <div class="obj-body" style="display:flex;flex-direction:column;gap:10px"></div>
          <button class="btn" data-action="back" style="align-self:flex-end">Back</button>
        </div>
      </div>`;
    this.body = this.el.querySelector('.obj-body');
    this.el.querySelector('[data-action="back"]')
      .addEventListener('click', () => screens.show('pause-menu'));
    screens.register('objectives', this.el, { onShow: () => this.render() });

    bus.on('objectives:set', (list) => { this.objectives = list; });
  }

  render() {
    this.body.innerHTML = this.objectives.length
      ? this.objectives.map((o) => `
          <div style="display:flex;gap:12px;align-items:center;padding:10px;border:1px solid var(--border-ghost);border-radius:8px;${o.done ? 'opacity:0.5' : ''}">
            <span style="color:${o.done ? 'var(--success)' : 'var(--accent)'};font-size:1.1rem">${o.done ? '✓' : '◈'}</span>
            <span style="${o.done ? 'text-decoration:line-through' : ''}">${escapeHtml(o.text)}</span>
          </div>`).join('')
      : '<p style="color:var(--fg-muted)">No objectives yet.</p>';
  }
}

// ---------------------------------------------------------------------------
// Intro cinematic (text-driven, GSAP-animated)
// ---------------------------------------------------------------------------

export class IntroScreen {
  constructor(onDone) {
    this.onDone = onDone;
    this.el = html`
      <div id="intro-screen" style="background:#000">
        <div class="intro-line" style="font-family:var(--font-display);font-size:clamp(1.2rem,3vw,2rem);letter-spacing:0.1em;text-align:center;max-width:820px;padding:0 24px;line-height:2"></div>
        <div class="intro-dots" style="position:absolute;bottom:44px;left:50%;transform:translateX(-50%);display:flex;gap:10px"></div>
        <p class="label" style="position:absolute;bottom:32px;left:32px">Click — next line · Esc — skip</p>
        <button class="btn" style="position:absolute;bottom:32px;right:32px" data-action="skip">Skip ▸</button>
      </div>`;
    this.lineEl = this.el.querySelector('.intro-line');
    this.dotsEl = this.el.querySelector('.intro-dots');
    this.el.querySelector('[data-action="skip"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.finish();
    });
    // click anywhere → advance to the next line immediately
    this.el.addEventListener('click', () => { this.advance = true; });
    document.addEventListener('keydown', (e) => {
      if (!this.playing) return;
      // consume the key so it can't also trigger pause/inventory handlers
      e.stopImmediatePropagation();
      e.preventDefault();
      if (e.code === 'Escape') this.finish();
      else this.advance = true; // any key advances a line
    }, true); // capture phase: runs before the Game's own key handlers
    screens.register('intro', this.el);
  }

  renderDots(total, current) {
    this.dotsEl.innerHTML = '';
    for (let i = 0; i < total; i++) {
      this.dotsEl.appendChild(html`<span style="width:8px;height:8px;border-radius:50%;background:${i <= current ? 'var(--accent)' : 'rgba(232,230,227,0.18)'};transition:background 300ms"></span>`);
    }
  }

  /** Wait until ms elapsed OR the player asked to advance/skip. */
  wait(ms) {
    return new Promise((resolve) => {
      const start = performance.now();
      const tick = () => {
        if (!this.playing || this.advance || performance.now() - start >= ms) return resolve();
        setTimeout(tick, 80); // setTimeout (not rAF) — keeps running in background tabs
      };
      tick();
    });
  }

  async play(lines) {
    screens.show('intro');
    this.playing = true;
    for (let i = 0; i < lines.length; i++) {
      if (!this.playing) return;
      this.advance = false;
      this.renderDots(lines.length, i);
      this.lineEl.textContent = lines[i];
      gsap.killTweensOf(this.lineEl);
      gsap.fromTo(this.lineEl, { opacity: 0, filter: 'blur(6px)' },
        { opacity: 1, filter: 'blur(0px)', duration: 1.0, ease: 'power2.out' });
      await this.wait(4200); // hold; click/key cuts it short
      if (!this.playing) return;
      gsap.to(this.lineEl, { opacity: 0, duration: 0.5, ease: 'power2.in' });
      await this.wait(500);
    }
    this.finish();
  }

  finish() {
    if (!this.playing) return;
    this.playing = false;
    gsap.killTweensOf(this.lineEl);
    this.onDone?.();
  }
}

// ---------------------------------------------------------------------------
// Ending screen
// ---------------------------------------------------------------------------

const ENDINGS = {
  standard: {
    title: 'The Way Out',
    text: 'The final door opens onto grey morning light. You are free — but freedom has a texture now, and it feels thinner than it used to. Some part of you is still solving.',
  },
  true: {
    title: 'The Whole Truth',
    text: 'You did not escape the rooms. You remembered building them. The intelligence that guided you was never artificial — it was the version of you that stayed behind, and it is finally at peace.',
  },
  dark: {
    title: 'The Eleventh Room',
    text: 'The door closes behind you into a room you have seen before — the first one. But the puzzles remember your answers now, and they have had time to prepare.',
  },
};

export class EndingScreen {
  constructor(onMenu) {
    this.el = html`
      <div id="ending-screen" style="background:#000">
        <div style="text-align:center;max-width:720px;padding:0 24px;display:flex;flex-direction:column;gap:24px">
          <p class="subtitle ending-kind"></p>
          <h2 class="title-hero ending-title" style="font-size:clamp(1.8rem,4vw,3rem)"></h2>
          <p class="ending-text" style="line-height:2;color:var(--fg-secondary)"></p>
          <div class="ending-stats kbd-hint"></div>
          <button class="btn btn-primary" data-action="menu" style="align-self:center">Return to the Beginning</button>
        </div>
      </div>`;
    this.el.querySelector('[data-action="menu"]').addEventListener('click', () => onMenu());
    screens.register('ending', this.el);
  }

  show(endingKey, stats) {
    const ending = ENDINGS[endingKey] ?? ENDINGS.standard;
    this.el.querySelector('.ending-kind').textContent =
      endingKey === 'true' ? 'True Ending' : endingKey === 'dark' ? 'Dark Ending' : 'Ending';
    this.el.querySelector('.ending-title').textContent = ending.title;
    this.el.querySelector('.ending-text').textContent = ending.text;
    this.el.querySelector('.ending-stats').innerHTML = `
      <span>Time — ${formatTime(stats.playtime_s)}</span>
      <span>Rooms — ${stats.rooms_cleared}/${stats.total ?? 10}</span>
      <span>Puzzles — ${stats.puzzles_solved}</span>
      <span>Hints — ${stats.hints_used}</span>`;
    screens.show('ending');
  }
}

// ---------------------------------------------------------------------------
// Game Over — 3 Attempts Exhausted
// ---------------------------------------------------------------------------

export class RoomLockedModal {
  constructor(onRestart, onQuit) {
    this.onRestart = onRestart;
    this.onQuit = onQuit;
    this.el = html`
      <div id="room-locked-screen" class="backdrop gameover-backdrop">
        <div class="gameover-panel glass">
          <div class="gameover-glitch-title">
            <span aria-hidden="true">GAME OVER</span>
            <span class="gameover-main-title">GAME OVER</span>
          </div>
          <div class="gameover-skulls" aria-label="All 3 attempts exhausted">
            <span class="gameover-skull lost" aria-hidden="true">☠</span>
            <span class="gameover-skull lost" aria-hidden="true">☠</span>
            <span class="gameover-skull lost" aria-hidden="true">☠</span>
          </div>
          <p class="gameover-body">
            All three attempts have been consumed.<br/>
            The escape room remembers everything.<br/>
            You must start again from the very beginning.
          </p>
          <div class="gameover-actions">
            <button class="btn btn-primary gameover-restart" data-action="restart">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              Start Over
            </button>
            <button class="btn gameover-quit" data-action="quit">
              Quit to Menu
            </button>
          </div>
          <p class="gameover-hint">All progress will be reset.</p>
        </div>
      </div>`;

    this.el.querySelector('[data-action="restart"]').addEventListener('click', () => {
      screens.hide('room-locked');
      this.onRestart?.();
    });
    this.el.querySelector('[data-action="quit"]').addEventListener('click', () => {
      screens.hide('room-locked');
      this.onQuit?.();
    });

    screens.register('room-locked', this.el);

    bus.on('attempts:exhausted', () => {
      screens.show('room-locked');
      bus.emit(Events.PLAY_SOUND, { name: 'error' });
      bus.emit(Events.GAME_PAUSE, { soft: true });

      // Animate skulls in
      setTimeout(() => {
        const skulls = this.el.querySelectorAll('.gameover-skull');
        skulls.forEach((s, i) => setTimeout(() => s.classList.add('animate'), i * 180));
      }, 100);

      // Automatic restart from Room 1 after 2.5 seconds (no manual button press needed)
      setTimeout(() => {
        screens.hide('room-locked');
        this.onRestart?.();
      }, 2500);
    });
  }
}


