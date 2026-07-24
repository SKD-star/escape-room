/**
 * Campaign — the active, ordered list of playable rooms.
 *
 * The admin dashboard owns the real campaign: order, which rooms are enabled,
 * and any custom rooms an admin adds. On New Game / Continue the client pulls
 * that list from the server (`GET /api/rooms`) and plays it in that order.
 *
 * Each server room is merged with the rich built-in data in `constants.ROOMS`
 * (chapter, par time, briefing, tip) when the key matches; custom rooms get
 * sensible synthesized defaults. If the server is unreachable (offline mode)
 * or returns nothing, we fall back to the built-in 10-room list so the game
 * always has a campaign to run.
 *
 * Rooms without a bespoke 3D level are played in the environment of their
 * theme — see RoomManager's theme→class mapping.
 */
import { ROOMS } from './constants.js';
import { api } from '../net/ApiClient.js';

const DEFAULT_PAR = 260;

class Campaign {
  constructor() {
    /** @type {Array<object>|null} */
    this._list = null; // null until loaded; getters fall back to ROOMS
  }

  /** The active room list (built-in list until a server load succeeds). */
  get list() { return this._list ?? ROOMS; }
  get count() { return this.list.length; }
  get loaded() { return this._list !== null; }

  /** Load once if not already loaded. */
  async ensure() {
    if (!this._list) await this.load();
    return this.list;
  }

  /** (Re)fetch the campaign from the server. Always resolves — never throws. */
  async load() {
    const res = await api.getRooms();
    const rooms = res?.ok && Array.isArray(res.data?.rooms) ? res.data.rooms : null;
    if (rooms && rooms.length) {
      this._list = rooms.map((r, i) => this._merge(r, i));
    } else {
      // Offline / empty DB → built-in campaign.
      this._list = ROOMS.map((r) => ({ ...r }));
    }
    return this._list;
  }

  /** Merge a server room with built-in data, or synthesize a custom room. */
  _merge(server, index) {
    const builtin = ROOMS.find((r) => r.key === server.key);
    if (builtin) {
      return {
        ...builtin,
        name: server.name || builtin.name,
        theme: server.theme || builtin.theme,
      };
    }
    // Custom admin room: no built-in level → play it via its theme.
    return {
      key: server.key,
      name: server.name || server.key,
      theme: server.theme || 'library',
      chapter: `Chapter ${index + 1}`,
      par: DEFAULT_PAR,
      brief: server.story
        || 'A chamber the keeper added to the sequence. Find the mechanism beneath the gold light.',
      tip: 'Follow the gold diamond, read everything you find, and solve the lock.',
      custom: true,
    };
  }

  first() { return this.list[0]?.key ?? null; }
  get(key) { return this.list.find((r) => r.key === key); }
  indexOf(key) { return this.list.findIndex((r) => r.key === key); }

  /** Next room key in the active order, or null at the end. */
  nextKey(key) {
    const next = this.list[this.indexOf(key) + 1];
    return next ? next.key : null;
  }
}

export const campaign = new Campaign();
