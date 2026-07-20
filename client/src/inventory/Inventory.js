/**
 * Inventory — item model + grid UI (Tab). Items support inspect
 * descriptions and pairwise combination recipes.
 */
import { bus, Events } from '../core/EventBus.js';
import { html, screens } from '../ui/ScreenManager.js';
import { escapeHtml } from '../ui/screens/MenuScreens.js';

/** Combination recipes: sorted pair key → result item. */
const RECIPES = {
  'brass_key+silver_locket': {
    id: 'memento', name: 'Locketed Key', icon: '🔐',
    description: 'The key fits inside the locket perfectly, as if they were made as one. It hums.',
  },
  'cipher_codebook+access_chip': {
    id: 'decoded_chip', name: 'Decoded Chip', icon: '🧩',
    description: 'The old cipher unlocks the chip\'s partitions. Coordinates, dates… and your name.',
  },
};

const DESCRIPTIONS = {
  brass_key: 'Old brass, warm to the touch. The bow is shaped like a closed eye.',
  warden_key: 'Heavy iron. Seven notches — one for each cell, or each prisoner kept past death.',
  serpent_idol: 'A coiled serpent of green stone. Its eyes follow slower than you move.',
  vial_serum: 'Faintly luminous liquid. The label reads only: "47 — FINAL DOSE".',
  morgue_tag: 'A toe tag, blank on one side. Your handwriting on the other.',
  silver_locket: 'It won\'t open. Something inside taps twice whenever you stop walking.',
  royal_seal: 'The royal crest, worn smooth by six hundred years of dead men\'s thumbs.',
  codebook: 'Hand-written cipher tables. The final page is a letter of apology.',
  access_chip: 'Military-grade neural interface chip. It is warm. It is always warm.',
};

export class Inventory {
  constructor() {
    /** @type {Array<{id: string, name: string, icon: string}>} */
    this.items = [];
    this.selected = null;
    this.combineArm = null;

    this.buildUI();
    bus.on(Events.ITEM_ADDED, (item) => this.add(item));
  }

  // -- model --------------------------------------------------------------

  add(item) {
    if (this.items.some((i) => i.id === item.id)) return;
    this.items.push(item);
    bus.emit(Events.PLAY_SOUND, { name: 'pickup' });
    bus.emit(Events.TOAST, { text: `Collected — ${item.name}` });
    bus.emit('inventory:count', this.items.length);
    if (screens.current === 'inventory') this.render();
  }

  has(id) {
    return this.items.some((i) => i.id === id);
  }

  remove(id) {
    this.items = this.items.filter((i) => i.id !== id);
  }

  toJSON() { return this.items; }
  restore(items) { this.items = Array.isArray(items) ? items : []; }

  // -- UI -----------------------------------------------------------------

  buildUI() {
    this.el = html`
      <div id="inventory-screen" class="backdrop">
        <div class="glass panel panel-wide">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h2 class="heading">Inventory</h2>
            <span class="label inv-count"></span>
          </div>
          <div class="inventory-grid"></div>
          <div class="inv-detail" style="min-height:72px;padding:14px;border:1px solid var(--border-ghost);border-radius:8px">
            <p style="color:var(--fg-muted);font-size:0.9rem">Select an item to inspect it. Select a second to attempt a combination.</p>
          </div>
          <button class="btn" data-action="close" style="align-self:flex-end">Close (Tab)</button>
        </div>
      </div>`;
    this.grid = this.el.querySelector('.inventory-grid');
    this.detail = this.el.querySelector('.inv-detail');
    this.el.querySelector('[data-action="close"]').addEventListener('click', () => this.closeUI());
    screens.register('inventory', this.el, { onShow: () => this.render() });
  }

  openUI() {
    screens.show('inventory');
    bus.emit(Events.GAME_PAUSE, { soft: true });
  }

  closeUI() {
    screens.hide('inventory');
    bus.emit(Events.GAME_RESUME);
  }

  render() {
    this.el.querySelector('.inv-count').textContent = `${this.items.length} items`;
    this.grid.innerHTML = '';
    if (!this.items.length) {
      this.grid.innerHTML = '<p style="color:var(--fg-muted);grid-column:1/-1">Your hands are empty. The rooms will fix that.</p>';
      return;
    }
    for (const item of this.items) {
      const slot = html`
        <button class="inv-slot ${this.selected === item.id ? 'selected' : ''}">
          <span class="icon">${item.icon ?? '▣'}</span>
          <span class="name">${escapeHtml(item.name)}</span>
        </button>`;
      slot.addEventListener('click', () => this.select(item));
      this.grid.appendChild(slot);
    }
  }

  select(item) {
    bus.emit(Events.PLAY_SOUND, { name: 'ui_click' });
    if (this.combineArm && this.combineArm !== item.id) {
      this.tryCombine(this.combineArm, item.id);
      this.combineArm = null;
      this.selected = null;
      this.render();
      return;
    }
    this.selected = item.id;
    this.combineArm = item.id;
    this.detail.innerHTML = `
      <p style="color:var(--accent);font-family:var(--font-display);letter-spacing:0.1em">${escapeHtml(item.name)}</p>
      <p style="font-size:0.9rem;color:var(--fg-secondary);margin-top:6px">${escapeHtml(DESCRIPTIONS[item.id] ?? 'An object with a history you can feel but not read.')}</p>`;
    this.render();
    bus.emit(Events.ITEM_SELECTED, item);
  }

  tryCombine(idA, idB) {
    const key = [idA, idB].sort().join('+');
    const recipe = RECIPES[key];
    if (!recipe) {
      this.detail.innerHTML = '<p style="color:var(--fg-muted)">These refuse each other.</p>';
      bus.emit(Events.PLAY_SOUND, { name: 'error' });
      return;
    }
    this.remove(idA);
    this.remove(idB);
    this.add({ id: recipe.id, name: recipe.name, icon: recipe.icon });
    DESCRIPTIONS[recipe.id] = recipe.description;
    this.detail.innerHTML = `
      <p style="color:var(--accent)">${escapeHtml(recipe.name)} created.</p>
      <p style="font-size:0.9rem;color:var(--fg-secondary)">${escapeHtml(recipe.description)}</p>`;
    bus.emit(Events.PLAY_SOUND, { name: 'success' });
    bus.emit('inventory:combined', recipe.id);
  }
}
