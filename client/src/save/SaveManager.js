/**
 * SaveManager — local-first save system with cloud sync.
 *
 * Slots: 0 = autosave (checkpoints + timed), 1-3 manual.
 * State: room, playtime, inventory, puzzle state, cleared rooms, flags.
 * Local: localStorage always. Cloud: mirrored via API when signed in.
 */
import { bus, Events } from '../core/EventBus.js';
import { api } from '../net/ApiClient.js';
import { ROOMS } from '../config/constants.js';
import { campaign } from '../config/campaign.js';

const LOCAL_KEY = 'escape_room_saves';
const AUTOSAVE_INTERVAL_S = 120;

export class SaveManager {
  /**
   * @param {object} game — the Game facade (provides captureState/applyState)
   */
  constructor(game) {
    this.game = game;
    this.autosaveTimer = 0;

    bus.on(Events.ROOM_CLEARED, () => this.autosave('checkpoint'));
    bus.on(Events.PUZZLE_SOLVED, () => this.autosave('checkpoint'));
  }

  // -- local storage ------------------------------------------------------

  readLocal() {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
  }

  writeLocal(slots) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(slots));
  }

  // -- public API ---------------------------------------------------------

  /** Merge local + cloud slot listings (cloud wins on newer timestamps). */
  async listSlots() {
    const local = this.readLocal();
    const slots = Object.entries(local).map(([slot, data]) => ({
      slot: Number(slot),
      room_id: data.room_id,
      room_name: campaign.get(data.room_id)?.name ?? ROOMS.find((r) => r.key === data.room_id)?.name,
      playtime_s: data.playtime_s,
      updated_at: data.updated_at,
      source: 'local',
    }));
    if (api.isAuthenticated) {
      const res = await api.listSaves();
      if (res.ok) {
        for (const cloud of res.data.saves) {
          const existing = slots.find((s) => s.slot === cloud.slot);
          const cloudTime = new Date(cloud.updated_at).getTime();
          if (!existing || cloudTime > new Date(existing.updated_at).getTime()) {
            if (existing) Object.assign(existing, cloud, { source: 'cloud' });
            else slots.push({
              ...cloud,
              room_name: campaign.get(cloud.room_id)?.name ?? ROOMS.find((r) => r.key === cloud.room_id)?.name,
              source: 'cloud',
            });
          }
        }
      }
    }
    return slots.sort((a, b) => a.slot - b.slot);
  }

  hasAnySave() {
    return Object.keys(this.readLocal()).length > 0;
  }

  /** @param {number} slot @param {string} type */
  async save(slot, type = 'manual') {
    const state = this.game.captureState();
    const record = {
      room_id: state.roomKey,
      playtime_s: Math.round(state.playtime),
      save_type: type,
      updated_at: new Date().toISOString(),
      state,
    };
    const local = this.readLocal();
    local[slot] = record;
    this.writeLocal(local);

    if (api.isAuthenticated) {
      api.putSave(slot, {
        room_id: record.room_id,
        playtime_s: record.playtime_s,
        save_type: type,
        state_json: JSON.stringify(state),
      });
    }
    bus.emit(Events.SAVE_DONE, { slot, type });
    if (type === 'manual') bus.emit(Events.TOAST, { text: 'Progress etched into the walls.' });
    return record;
  }

  /** @returns {Promise<object|null>} state or null */
  async load(slot) {
    // Prefer cloud if it's newer
    let local = this.readLocal()[slot] ?? null;
    if (api.isAuthenticated) {
      const res = await api.getSave(slot);
      if (res.ok) {
        const cloudTime = new Date(res.data.save.updated_at).getTime();
        if (!local || cloudTime > new Date(local.updated_at).getTime()) {
          try {
            return JSON.parse(res.data.save.state_json);
          } catch { /* fall through to local */ }
        }
      }
    }
    return local?.state ?? null;
  }

  /** Most recent save across all slots (for Continue). */
  latest() {
    const local = this.readLocal();
    let best = null;
    for (const [slot, data] of Object.entries(local)) {
      if (!best || new Date(data.updated_at) > new Date(best.data.updated_at)) {
        best = { slot: Number(slot), data };
      }
    }
    return best;
  }

  autosave(type = 'auto') {
    if (!this.game.isPlaying) return;
    this.save(0, type);
  }

  /** Called each frame from the game loop. */
  update(dt) {
    if (!this.game.isPlaying) return;
    this.autosaveTimer += dt;
    if (this.autosaveTimer >= AUTOSAVE_INTERVAL_S) {
      this.autosaveTimer = 0;
      this.autosave('auto');
    }
  }
}
