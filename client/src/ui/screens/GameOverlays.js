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
import { aiClient } from '../../ai/AIClient.js';
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

const CHAT_STORE_KEY = 'escape_room_chat_v1';
const CHAT_MAX_TURNS = 40;   // per conversation, kept on disk

/** Opening lines used when a spirit is met for the first time in a room. */
const DEFAULT_GREETINGS = {
  library: 'Shhh. The books are listening. Ask what you must — quietly.',
  temple: 'You walk on holy stone. Speak, and the stone will hear you.',
  prison: 'Another one in the block. Ask your questions before the count.',
  laboratory: 'Subject unregistered. State your query; I still keep the logs.',
  hospital: 'Visiting hours ended a long time ago. Ask anyway.',
  mansion: 'The house is awake now. Ask, and mind which room you ask it in.',
  castle: 'You stand in the hall of oaths. Speak plainly, I have no patience left.',
  bunker: 'Channel open. Nobody has spoken on it in decades. Go ahead.',
  cyber: 'Session established. Query me — I have run out of anything else to process.',
  boss: 'You came all this way to ask questions. Ask, then.',
};

/**
 * DialogueBox — the room spirit as a full chatbot.
 *
 * Free-text conversation with the AI backend (falling back to the player's own
 * OpenAI key, then to the offline engine in AIClient). Every turn carries the
 * live room state — mechanism, clue, inventory, objective, battery, sanity —
 * so answers are about *this* room at *this* moment, and the transcript
 * persists per room so the spirit remembers what you already asked it.
 */
export class DialogueBox {
  /**
   * @param {() => void} onClose
   * @param {() => object} getContext supplies the live room state each turn
   */
  constructor(onClose, getContext = () => ({})) {
    this.onClose = onClose;
    this.getContext = getContext;
    this.npc = 'The Librarian';
    this.theme = 'library';
    this.history = [];
    this.isThinking = false;
    this.transcripts = this.loadTranscripts();
    // Legacy: players used to paste their own key here. The game now ships
    // with a free one, so drop any stale key left on the device.
    localStorage.removeItem('escape_room_ai_key');

    this.el = html`
      <div id="dialogue-screen" class="backdrop">
        <div class="dialogue-box glass">
          <!-- Chatbot header -->
          <div class="dialogue-header">
            <div class="dialogue-identity">
              <div class="npc-avatar" aria-hidden="true">👻</div>
              <div>
                <div class="npc-title-row">
                  <span class="npc-name">The Librarian</span>
                  <span class="ai-status-badge" title="Where the answers are coming from">AI Active</span>
                </div>
                <div class="npc-subtitle">Room companion — ask anything, freely</div>
              </div>
            </div>
            <div class="dialogue-tools">
              <button class="btn btn-icon btn-clear-chat" title="Forget this conversation">↺</button>
              <button class="btn btn-icon" data-action="leave" title="Close (Esc)">✕</button>
            </div>
          </div>

          <!-- Transcript -->
          <div class="dialogue-log" role="log" aria-live="polite"></div>

          <!-- Follow-up chips, refreshed from every answer -->
          <div class="dialogue-suggestions"></div>

          <!-- Composer -->
          <div class="dialogue-input">
            <textarea class="chat-input" rows="1" maxlength="500" spellcheck="false"
                      aria-label="Your message to the room spirit"
                      placeholder="Ask anything about this room…"></textarea>
            <button class="btn btn-primary btn-send" data-action="send" aria-label="Send">
              <span class="send-label">Ask</span>
            </button>
          </div>
          <div class="dialogue-foot">
            <span><kbd>Enter</kbd> send · <kbd>Shift</kbd>+<kbd>Enter</kbd> new line · <kbd>Esc</kbd> leave</span>
          </div>
        </div>
      </div>`;

    this.logEl = this.el.querySelector('.dialogue-log');
    this.input = this.el.querySelector('.chat-input');
    this.sendBtn = this.el.querySelector('.btn-send');
    this.suggestionsEl = this.el.querySelector('.dialogue-suggestions');
    this.statusBadge = this.el.querySelector('.ai-status-badge');

    this.sendBtn.addEventListener('click', () => this.send());
    this.el.querySelector('[data-action="leave"]').addEventListener('click', () => this.close());
    this.el.querySelector('.btn-clear-chat').addEventListener('click', () => this.clearConversation());

    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.send();
      }
      if (e.key === 'Escape') this.close();
    });
    // Grow the composer with the message, up to a sane ceiling.
    this.input.addEventListener('input', () => {
      this.input.style.height = 'auto';
      this.input.style.height = `${Math.min(120, this.input.scrollHeight)}px`;
    });

    screens.register('dialogue', this.el);
    bus.on(Events.DIALOGUE_OPEN, (payload) => this.open(payload || {}));
  }

  // -- persistence --------------------------------------------------------

  /** @returns {Record<string, Array<{role:string, content:string}>>} */
  loadTranscripts() {
    try {
      const raw = JSON.parse(localStorage.getItem(CHAT_STORE_KEY) || '{}');
      return raw && typeof raw === 'object' ? raw : {};
    } catch {
      return {};
    }
  }

  get conversationKey() { return `${this.theme}::${this.npc}`; }

  saveTranscript() {
    this.transcripts[this.conversationKey] = this.history.slice(-CHAT_MAX_TURNS);
    try {
      localStorage.setItem(CHAT_STORE_KEY, JSON.stringify(this.transcripts));
    } catch { /* quota — the in-memory transcript still works this session */ }
  }

  clearConversation() {
    this.history = [];
    delete this.transcripts[this.conversationKey];
    this.saveTranscript();
    this.logEl.innerHTML = '';
    this.appendMessage('assistant', this.greetingFor(this.theme));
    this.renderSuggestions(this.defaultSuggestions());
    this.input.focus();
  }

  greetingFor(theme) {
    const key = Object.keys(DEFAULT_GREETINGS).find((k) => String(theme).includes(k));
    return DEFAULT_GREETINGS[key] || 'Ask what you will about this room. I have nothing but time.';
  }

  // -- open / close -------------------------------------------------------

  open({ npc, theme, greeting }) {
    this.npc = npc || 'The Librarian';
    this.theme = theme || 'library';
    this.isThinking = false;
    this.el.querySelector('.npc-name').textContent = this.npc;
    this.setStatus('idle');

    // Resume the transcript for this room instead of starting cold.
    this.history = Array.isArray(this.transcripts[this.conversationKey])
      ? this.transcripts[this.conversationKey].slice(-CHAT_MAX_TURNS)
      : [];
    this.logEl.innerHTML = '';

    if (this.history.length) {
      for (const turn of this.history) this.appendMessage(turn.role, turn.content, { instant: true });
      this.appendSystemLine('— you spoke with this one before —', true);
    } else {
      this.appendMessage('assistant', greeting || this.greetingFor(this.theme));
    }

    this.renderSuggestions(this.defaultSuggestions());
    screens.show('dialogue');
    setTimeout(() => this.input.focus(), 100);
  }

  close() {
    this.saveTranscript();
    screens.hide('dialogue');
    this.onClose?.();
  }

  // -- rendering ----------------------------------------------------------

  setStatus(state) {
    const map = {
      idle: ['AI Active', 'ok'],
      thinking: ['Listening…', 'busy'],
      openrouter: ['AI Active', 'ok'],
      openai: ['AI Active', 'ok'],
      server: ['AI Active', 'ok'],
      offline: ['Offline Voice', 'warn'],
      error: ['Connection Lost', 'warn'],
    };
    const [label, cls] = map[state] || map.idle;
    this.statusBadge.textContent = label;
    this.statusBadge.className = `ai-status-badge ${cls}`;
  }

  appendMessage(role, text, { instant = false } = {}) {
    const isUser = role === 'user';
    const msgEl = html`
      <div class="chat-msg ${isUser ? 'chat-user' : 'chat-npc'}">
        <div class="chat-who">${escapeHtml(isUser ? 'You' : this.npc)}</div>
        <div class="msg-text"></div>
      </div>`;

    const textEl = msgEl.querySelector('.msg-text');
    this.logEl.appendChild(msgEl);
    this.scrollToBottom();

    if (isUser || instant) textEl.textContent = text;
    else this.typewrite(textEl, text);
    return msgEl;
  }

  appendSystemLine(text, muted = false) {
    const el = html`<div class="chat-system${muted ? ' muted' : ''}">${escapeHtml(text)}</div>`;
    this.logEl.appendChild(el);
    this.scrollToBottom();
    return el;
  }

  defaultSuggestions() {
    const ctx = this.safeContext();
    const list = ['What should I be looking at?'];
    if (ctx?.puzzle?.type) list.push('How does this mechanism work?');
    if (ctx?.needed_key) list.push('Where is the key hidden?');
    else list.push('What opens the way out?');
    list.push('Who are you?');
    return list.slice(0, 4);
  }

  renderSuggestions(list) {
    const chips = (list || []).filter(Boolean).slice(0, 4);
    this.suggestionsEl.innerHTML = chips
      .map((t) => `<button class="chip-btn" data-suggest="${escapeHtml(t)}">${escapeHtml(t)}</button>`)
      .join('');
    this.suggestionsEl.querySelectorAll('.chip-btn').forEach((chip) => {
      chip.addEventListener('click', () => {
        if (this.isThinking) return;
        this.input.value = chip.dataset.suggest;
        this.send();
      });
    });
  }

  scrollToBottom() {
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  /** Context provider must never break a conversation. */
  safeContext() {
    try {
      return this.getContext?.() || {};
    } catch (err) {
      console.warn('[DialogueBox] context provider failed', err);
      return {};
    }
  }

  // -- the conversation turn ----------------------------------------------

  async send() {
    const message = this.input.value.trim();
    if (!message || this.isThinking) return;

    this.input.value = '';
    this.input.style.height = 'auto';
    this.setThinking(true);

    this.appendMessage('user', message);
    this.history.push({ role: 'user', content: message });

    const thinkingEl = html`
      <div class="chat-msg chat-npc thinking-msg">
        <div class="chat-who">${escapeHtml(this.npc)}</div>
        <div class="typing-dots" aria-label="thinking"><span></span><span></span><span></span></div>
      </div>`;
    this.logEl.appendChild(thinkingEl);
    this.scrollToBottom();

    let reply;
    try {
      reply = await aiClient.getDialogue(
        this.npc,
        this.theme,
        message,
        this.history.slice(0, -1),   // prior turns only; the message is sent separately
        this.safeContext(),
      );
    } catch (err) {
      console.warn('[DialogueBox] turn failed', err);
      reply = null;
    }

    thinkingEl.remove();
    this.setThinking(false);

    if (!reply?.line) {
      this.setStatus('error');
      const failEl = this.appendSystemLine('The voice did not reach you. Tap to try again.');
      failEl.classList.add('chat-retry');
      failEl.addEventListener('click', () => {
        failEl.remove();
        this.history.pop();               // drop the unanswered turn
        this.input.value = message;
        this.send();
      });
      return;
    }

    this.setStatus(reply.provider === 'fallback' || reply.provider === 'offline' ? 'offline' : 'idle');
    this.history.push({ role: 'assistant', content: reply.line });
    this.saveTranscript();
    this.appendMessage('assistant', reply.line);
    this.renderSuggestions(reply.suggestions?.length ? reply.suggestions : this.defaultSuggestions());

    bus.emit(Events.PLAY_SOUND, { name: 'whisper' });
    bus.emit('dialogue:exchanged');
  }

  setThinking(on) {
    this.isThinking = on;
    this.sendBtn.disabled = on;
    this.input.disabled = on;
    this.el.querySelector('.send-label').textContent = on ? '…' : 'Ask';
    if (on) this.setStatus('thinking');
    if (!on) setTimeout(() => this.input.focus(), 30);
  }

  typewrite(targetEl, text) {
    gsap.killTweensOf(targetEl);
    targetEl.textContent = '';
    const chars = [...text];
    const obj = { i: 0 };
    gsap.to(obj, {
      i: chars.length,
      duration: Math.min(2.0, chars.length * 0.018),
      ease: 'none',
      onUpdate: () => {
        targetEl.textContent = chars.slice(0, Math.floor(obj.i)).join('');
        this.scrollToBottom();
      },
    });
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


