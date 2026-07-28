/**
 * ProgressionManager — persistent tracking for difficulty mode unlocks
 * and sequential room progression.
 *
 * Rules:
 *   1. Story mode (no attempts limit, no timer) is unlocked by default.
 *   2. Medium mode (Normal, 3-attempt system) is locked until Story mode is completed.
 *   3. Difficult mode (Nightmare, 3-attempt system + countdown timer) is locked until Medium mode is completed.
 *   4. Rooms must be completed in all 3 modes sequentially to unlock the next room.
 *   5. Progress persists across game restarts via LocalStorage.
 */
import { bus } from '../core/EventBus.js';
import { campaign } from '../config/campaign.js';
import { ROOMS } from '../config/constants.js';

const STORAGE_KEY = 'escape_room_progression';

export class ProgressionManager {
  constructor() {
    /** @type {Set<string>} */
    this.completedModes = new Set(); // global completed mode keys across any room/run
    /** @type {Record<string, Set<string>>} */
    this.roomCompletedModes = {}; // roomKey -> Set of completed mode keys
    this.load();
  }

  /** Load persistent unlock data from LocalStorage */
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data.completedModes)) {
        this.completedModes = new Set(data.completedModes);
      }
      if (data.roomCompletedModes && typeof data.roomCompletedModes === 'object') {
        this.roomCompletedModes = {};
        for (const [key, modes] of Object.entries(data.roomCompletedModes)) {
          if (Array.isArray(modes)) {
            this.roomCompletedModes[key] = new Set(modes);
          }
        }
      }
    } catch (err) {
      console.warn('[ProgressionManager] Failed to read progression from storage', err);
    }
  }

  /** Reset all progression to fresh state (only Story mode unlocked) */
  reset() {
    this.completedModes.clear();
    this.roomCompletedModes = {};
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('escape_room_achievements');
    bus.emit('progression:updated', this.toJSON());
  }

  /** Save current unlock data to LocalStorage */
  save() {
    try {
      const roomData = {};
      for (const [key, modes] of Object.entries(this.roomCompletedModes)) {
        roomData[key] = Array.from(modes);
      }
      const data = {
        completedModes: Array.from(this.completedModes),
        roomCompletedModes: roomData,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      bus.emit('progression:updated', this.toJSON());
    } catch (err) {
      console.warn('[ProgressionManager] Failed to save progression', err);
    }
  }

  /**
   * Check if a difficulty mode is unlocked.
   * Mode hierarchy: story -> normal (Medium) -> nightmare (Difficult)
   * @param {string} modeKey
   * @returns {boolean}
   */
  /**
   * Check if a difficulty mode is unlocked.
   * Medium mode (normal) unlocks ONLY when Story mode is FULLY completed across all rooms.
   * Difficult mode (nightmare) unlocks ONLY when Medium mode is FULLY completed across all rooms.
   * @param {string} modeKey
   * @returns {boolean}
   */
  isModeUnlocked(modeKey) {
    if (modeKey === 'story') return true;

    const list = campaign.list || ROOMS;
    const isModeFullyCleared = (targetMode) => {
      if (this.completedModes.has(targetMode)) return true;
      if (!list || list.length === 0) return false;
      return list.every((r) => {
        const modes = this.roomCompletedModes[r.key];
        return modes && modes.has(targetMode);
      });
    };

    if (modeKey === 'normal') {
      return isModeFullyCleared('story');
    }
    if (modeKey === 'nightmare') {
      return isModeFullyCleared('normal');
    }
    return true;
  }

  /**
   * Returns human readable reason if mode is locked, or null if unlocked.
   * @param {string} modeKey
   * @returns {string|null}
   */
  getModeLockReason(modeKey) {
    if (this.isModeUnlocked(modeKey)) return null;
    if (modeKey === 'normal') {
      return 'Complete Story mode to unlock Medium mode.';
    }
    if (modeKey === 'nightmare') {
      return 'Complete Medium mode to unlock Difficult mode.';
    }
    return 'Mode is locked.';
  }

  /**
   * Check if a room is unlocked.
   * First room is always unlocked.
   * Subsequent rooms require the previous room to be completed in ALL THREE modes (Story, Normal, Nightmare).
   * @param {string} roomKey
   * @returns {boolean}
   */
  isRoomUnlocked(roomKey) {
    const list = campaign.list || ROOMS;
    const index = list.findIndex((r) => r.key === roomKey);
    if (index <= 0) return true; // Room 1 is unlocked

    // Check all previous rooms
    for (let i = 0; i < index; i++) {
      const prevKey = list[i].key;
      const modesDone = this.roomCompletedModes[prevKey];
      if (!modesDone || !modesDone.has('story') || !modesDone.has('normal') || !modesDone.has('nightmare')) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get human readable reason if a room is locked, or null if unlocked.
   * @param {string} roomKey
   * @returns {string|null}
   */
  getRoomLockReason(roomKey) {
    if (this.isRoomUnlocked(roomKey)) return null;
    const list = campaign.list || ROOMS;
    const index = list.findIndex((r) => r.key === roomKey);
    if (index > 0) {
      const prevRoom = list[index - 1];
      const prevName = prevRoom.name || prevRoom.key;
      return `Complete all 3 modes (Story, Medium & Difficult) in ${prevName} to unlock this room.`;
    }
    return 'Room is locked.';
  }

  /**
   * Record that a player successfully completed a room on a given difficulty mode.
   * @param {string} roomKey
   * @param {string} modeKey
   */
  recordCompletion(roomKey, modeKey) {
    if (!this.roomCompletedModes[roomKey]) {
      this.roomCompletedModes[roomKey] = new Set();
    }
    const roomModes = this.roomCompletedModes[roomKey];
    const wasRoomComplete = roomModes.has('story') && roomModes.has('normal') && roomModes.has('nightmare');
    roomModes.add(modeKey);

    // If final room cleared, mark mode as fully completed
    const list = campaign.list || ROOMS;
    const isFinalRoom = list.length > 0 && list[list.length - 1].key === roomKey;
    if (isFinalRoom) {
      this.completedModes.add(modeKey);
    }

    this.save();

    const isNowRoomComplete = roomModes.has('story') && roomModes.has('normal') && roomModes.has('nightmare');
    if (!wasRoomComplete && isNowRoomComplete) {
      bus.emit('toast', {
        text: `🏆 Room Mastered! You completed all 3 modes in ${roomKey}. Next room unlocked!`,
        type: 'success',
        duration: 7000,
      });
    }
  }

  toJSON() {
    const roomData = {};
    for (const [key, modes] of Object.entries(this.roomCompletedModes)) {
      roomData[key] = Array.from(modes);
    }
    return {
      completedModes: Array.from(this.completedModes),
      roomCompletedModes: roomData,
    };
  }
}

export const progression = new ProgressionManager();
