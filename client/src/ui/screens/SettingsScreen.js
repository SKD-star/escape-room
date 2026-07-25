/**
 * SettingsScreen — audio / video / controls tabs.
 */
import { QUALITY_PRESETS } from '../../config/constants.js';
import { settings } from '../../config/settings.js';
import { html, screens } from '../ScreenManager.js';

const TABS = {
  audio: [
    { key: 'audioMuted', name: 'Mute All Audio', desc: 'Silence everything instantly — persists on restart', type: 'toggle' },
    { key: 'masterVolume', name: 'Master Volume', desc: 'Overall game audio loudness', type: 'range' },
    { key: 'musicVolume', name: 'Background Music (BGM)', desc: 'Adjust background music volume level', type: 'range' },
    { key: 'sfxVolume', name: 'Sound Effects (SFX)', desc: 'Footsteps, doors, levers & puzzles', type: 'range' },
    { key: 'voiceVolume', name: 'Voices & Narration', desc: 'Spirits and story narration', type: 'range' },
  ],
  video: [
    { key: 'quality', name: 'Graphics Quality', desc: 'Shadows, effects, resolution', type: 'select', options: Object.keys(QUALITY_PRESETS) },
    { key: 'fov', name: 'Field of View', desc: 'Camera lens angle', type: 'range', min: 60, max: 100, step: 1 },
    { key: 'brightness', name: 'Brightness', desc: 'Gamma adjustment', type: 'range', min: 0.5, max: 1.6, step: 0.05 },
    { key: 'motionBlur', name: 'Motion Blur', desc: 'Camera motion smearing', type: 'toggle' },
    { key: 'showFps', name: 'FPS Counter', desc: 'Show performance overlay', type: 'toggle' },
  ],
  controls: [
    { key: 'mouseSensitivity', name: 'Mouse Sensitivity', desc: 'Look speed', type: 'range', min: 0.2, max: 3, step: 0.05 },
    { key: 'invertY', name: 'Invert Y-Axis', desc: 'Flip vertical look', type: 'toggle' },
    { key: 'headBob', name: 'Head Bob', desc: 'Camera sway while walking', type: 'toggle' },
    { key: 'subtitles', name: 'Subtitles', desc: 'Show spoken lines as text', type: 'toggle' },
    { key: 'hints', name: 'AI Hints', desc: 'Allow requesting hints from the spirits', type: 'toggle' },
    { key: 'sanityFx', name: 'Sanity Effects', desc: 'Fear-driven visual and audio distortion', type: 'toggle' },
    { key: 'hauntEnabled', name: 'The Presence', desc: 'The entity that stalks between puzzles', type: 'toggle' },
    { key: 'soundCaptions', name: 'Sound Captions', desc: 'Caption important world sounds (accessibility)', type: 'toggle' },
    { key: 'showCompass', name: 'Compass', desc: 'Direction tape at the top of the screen', type: 'toggle' },
    { key: 'showTimer', name: 'Speedrun Timer', desc: 'Run clock with per-room PB splits', type: 'toggle' },
    { key: 'gamepad', name: 'Controller Support', desc: 'Use a connected gamepad', type: 'toggle' },
  ],
};


const KEYBINDS = [
  ['W A S D', 'Move'], ['Mouse', 'Look'], ['RMB (hold)', 'Focus zoom'],
  ['Shift', 'Sprint'], ['C', 'Crouch'],
  ['Space', 'Jump'], ['E', 'Interact'], ['R', 'Rotate held item'], ['F', 'Flashlight / Throw held item'],
  ['Tab', 'Inventory'], ['J', 'Journal'], ['P', 'Photo mode'], ['Q', 'Objectives'],
  ['F5', 'Quick save'], ['F9', 'Quick load'], ['Esc', 'Pause'],
];

export class SettingsScreen {
  constructor() {
    this.returnTo = 'main-menu';
    this.el = html`
      <div id="settings-screen" class="backdrop">
        <div class="glass panel">
          <h2 class="heading">Settings</h2>
          <div class="tabs">
            <button class="tab active" data-tab="audio">Audio</button>
            <button class="tab" data-tab="video">Video</button>
            <button class="tab" data-tab="controls">Controls</button>
            <button class="tab" data-tab="keybinds">Key Bindings</button>
          </div>
          <div class="settings-body"></div>
          <div style="display:flex;gap:12px;justify-content:flex-end">
            <button class="btn" data-action="back">Back</button>
          </div>
        </div>
      </div>`;

    this.body = this.el.querySelector('.settings-body');
    this.el.querySelectorAll('.tab').forEach((tab) =>
      tab.addEventListener('click', () => {
        this.el.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        this.renderTab(tab.dataset.tab);
      }));
    this.el.querySelector('[data-action="back"]')
      .addEventListener('click', () => screens.show(this.returnTo));

    screens.register('settings', this.el, {
      onShow: (payload) => {
        this.returnTo = payload?.returnTo ?? 'main-menu';
        this.renderTab('audio');
      },
    });
  }

  renderTab(tabName) {
    this.body.innerHTML = '';
    if (tabName === 'keybinds') {
      for (const [key, action] of KEYBINDS) {
        this.body.appendChild(html`
          <div class="settings-row">
            <div class="info"><div class="name">${action}</div></div>
            <div class="control"><span class="key" style="font-family:var(--font-mono);color:var(--accent);border:1px solid var(--border-accent);border-radius:4px;padding:2px 12px;font-size:0.8rem">${key}</span></div>
          </div>`);
      }
      return;
    }
    for (const item of TABS[tabName]) this.body.appendChild(this.buildRow(item));
  }

  buildRow(item) {
    const value = settings.get(item.key);
    const row = html`
      <div class="settings-row">
        <div class="info">
          <div class="name">${item.name}</div>
          <div class="desc">${item.desc}</div>
        </div>
        <div class="control"></div>
      </div>`;
    const control = row.querySelector('.control');

    if (item.type === 'range') {
      const min = item.min ?? 0, max = item.max ?? 1, step = item.step ?? 0.05;
      const input = html`<input type="range" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${item.name}" />`;
      const display = html`<span class="value">${this.format(item, value)}</span>`;
      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        settings.set(item.key, v);
        display.textContent = this.format(item, v);
      });
      control.append(input, display);
    } else if (item.type === 'toggle') {
      const toggle = html`<button class="toggle" role="switch" aria-checked="${value}" aria-label="${item.name}"></button>`;
      toggle.addEventListener('click', () => {
        const next = !(settings.get(item.key));
        settings.set(item.key, next);
        toggle.setAttribute('aria-checked', String(next));
      });
      control.appendChild(toggle);
    } else if (item.type === 'select') {
      const select = html`<select aria-label="${item.name}">
        ${item.options.map((o) => `<option value="${o}" ${o === value ? 'selected' : ''}>${QUALITY_PRESETS[o]?.label ?? o}</option>`).join('')}
      </select>`;
      select.addEventListener('change', () => settings.set(item.key, select.value));
      control.appendChild(select);
    }
    return row;
  }

  format(item, v) {
    if (item.key === 'fov') return `${Math.round(v)}°`;
    if (item.max > 1) return v.toFixed(2);
    return `${Math.round(v * 100)}%`;
  }
}
