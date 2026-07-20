/**
 * RoomManager — room registry + lifecycle. Loads/disposes rooms,
 * repositions the player at spawn, publishes room events, and tracks
 * progression through the 10 chapters.
 */
import { ROOMS } from '../config/constants.js';
import { bus, Events } from '../core/EventBus.js';
import {
  HauntedLibrary, AncientTemple, ForgottenPrison,
  AbandonedLaboratory, AbandonedHospital,
} from './rooms/Rooms1to5.js';
import {
  HauntedMansion, MedievalCastle, SecretBunker, CyberFacility, BossRoom,
} from './rooms/Rooms6to10.js';

const ROOM_CLASSES = {
  haunted_library: HauntedLibrary,
  ancient_temple: AncientTemple,
  prison: ForgottenPrison,
  laboratory: AbandonedLaboratory,
  hospital: AbandonedHospital,
  mansion: HauntedMansion,
  castle: MedievalCastle,
  bunker: SecretBunker,
  cyber_facility: CyberFacility,
  boss_room: BossRoom,
};

export class RoomManager {
  /**
   * @param {object} ctx { engine, physics, interactions, player }
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.current = null;
    this.currentIndex = -1;
  }

  get currentKey() {
    return this.current?.definition.key ?? null;
  }

  indexOf(key) {
    return ROOMS.findIndex((r) => r.key === key);
  }

  /**
   * Load room by key. Disposes the previous room first.
   * @returns {Promise<import('./BaseRoom.js').BaseRoom>}
   */
  async load(key) {
    const definition = ROOMS.find((r) => r.key === key);
    const RoomClass = ROOM_CLASSES[key];
    if (!definition || !RoomClass) throw new Error(`Unknown room "${key}"`);

    bus.emit(Events.ROOM_LOADING, definition);

    // Freeze the player during the transition — its body is about to die
    const { player } = this.ctx;
    const wasEnabled = player.enabled;
    player.enabled = false;
    player.body = null;

    if (this.current) {
      this.current.dispose();
      this.current = null;
    } else {
      // First load: clear boot-time physics bodies too
      this.ctx.physics.clear();
    }

    const room = new RoomClass({
      engine: this.ctx.engine,
      physics: this.ctx.physics,
      interactions: this.ctx.interactions,
      definition,
    });
    room.build();

    // Recreate the player character body (physics world was cleared).
    const rebuilt = this.ctx.physics.createCharacter(
      room.spawn, 0.35, (1.75 - 0.7) / 2,
    );
    player.body = rebuilt.body;
    player.collider = rebuilt.collider;
    player.controller = rebuilt.controller;
    player.setPosition(room.spawn.x, room.spawn.y, room.spawn.z, Math.PI);
    player.enabled = wasEnabled;

    this.current = room;
    this.currentIndex = this.indexOf(key);

    bus.emit(Events.ROOM_ENTERED, {
      key, name: definition.name, chapter: definition.chapter, theme: definition.theme,
    });
    return room;
  }

  /** Next room key in progression, or null at the end. */
  nextKey() {
    const next = ROOMS[this.currentIndex + 1];
    return next ? next.key : null;
  }

  update(dt, t) {
    this.current?.update(dt, t);
  }
}
