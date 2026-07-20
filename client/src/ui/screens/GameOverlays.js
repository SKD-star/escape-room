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
    this.npc = 'The Warden';
    this.theme = 'library';
    this.history = [];
    this.el = html`
      <div id="dialogue-screen">
        <div class="dialogue-box glass">
          <div class="npc-name"></div>
          <p class="line"></p>
          <div class="dialogue-input">
            <input placeholder="Speak to the spirit…" maxlength="200" aria-label="Your message" />
            <button class="btn btn-primary" data-action="send">Speak</button>
            <button class="btn" data-action="leave">Leave</button>
          </div>
        </div>
      </div>`;
    this.line = this.el.querySelector('.line');
    this.input = this.el.querySelector('input');
    this.el.querySelector('[data-action="send"]').addEventListener('click', () => this.send());
    this.el.querySelector('[data-action="leave"]').addEventListener('click', () => this.close());
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') this.send();
      if (e.key === 'Escape') this.close();
    });
    screens.register('dialogue', this.el);
    bus.on(Events.DIALOGUE_OPEN, (payload) => this.open(payload));
  }

  open({ npc, theme, greeting }) {
    this.npc = npc;
    this.theme = theme;
    this.history = [];
    this.el.querySelector('.npc-name').textContent = npc;
    screens.show('dialogue');
    this.typewrite(greeting ?? 'You dare to speak with the dead…');
    setTimeout(() => this.input.focus(), 100);
  }

  async send() {
    const message = this.input.value.trim();
    if (!message) return;
    this.input.value = '';
    this.history.push({ role: 'user', content: message });
    this.typewrite('…');
    const res = await api.aiDialogue({
      npc: this.npc, theme: this.theme, message, history: this.history,
    });
    const line = res.ok ? res.data.line : 'The spirit fades — its voice cannot reach you now.';
    this.history.push({ role: 'assistant', content: line });
    this.typewrite(line);
    bus.emit(Events.PLAY_SOUND, { name: 'whisper' });
    bus.emit('dialogue:exchanged');
  }

  typewrite(text) {
    gsap.killTweensOf(this.line);
    this.line.textContent = '';
    const chars = [...text];
    const obj = { i: 0 };
    gsap.to(obj, {
      i: chars.length, duration: Math.min(2.4, chars.length * 0.03), ease: 'none',
      onUpdate: () => { this.line.textContent = chars.slice(0, Math.floor(obj.i)).join(''); },
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
        <button class="btn" style="position:absolute;bottom:32px;right:32px" data-action="skip">Skip</button>
      </div>`;
    this.lineEl = this.el.querySelector('.intro-line');
    this.el.querySelector('[data-action="skip"]').addEventListener('click', () => this.finish());
    screens.register('intro', this.el);
  }

  async play(lines) {
    screens.show('intro');
    this.playing = true;
    for (const line of lines) {
      if (!this.playing) return;
      this.lineEl.textContent = line;
      await gsap.timeline()
        .fromTo(this.lineEl, { opacity: 0, filter: 'blur(6px)' },
          { opacity: 1, filter: 'blur(0px)', duration: 1.6, ease: 'power2.out' })
        .to(this.lineEl, { opacity: 0, duration: 1.2, ease: 'power2.in' }, '+=2.4')
        .then(() => {});
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
      <span>Rooms — ${stats.rooms_cleared}/10</span>
      <span>Puzzles — ${stats.puzzles_solved}</span>
      <span>Hints — ${stats.hints_used}</span>`;
    screens.show('ending');
  }
}
