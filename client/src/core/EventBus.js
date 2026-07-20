/**
 * EventBus — global publish/subscribe hub.
 * Decouples UI ↔ engine ↔ gameplay systems. Every cross-module
 * communication in the game flows through here.
 */
class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this.listeners = new Map();
  }

  /**
   * @param {string} event
   * @param {Function} handler
   * @returns {() => void} unsubscribe function
   */
  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  once(event, handler) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      handler(...args);
    };
    return this.on(event, wrapper);
  }

  off(event, handler) {
    this.listeners.get(event)?.delete(handler);
  }

  emit(event, payload) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] handler error for "${event}"`, err);
      }
    }
  }
}

/** Singleton bus shared by the whole client. */
export const bus = new EventBus();

/** Well-known event names (documentation + typo safety). */
export const Events = {
  // Engine lifecycle
  ENGINE_READY: 'engine:ready',
  FRAME: 'engine:frame',
  QUALITY_CHANGED: 'engine:quality',
  // Game flow
  GAME_START: 'game:start',
  GAME_PAUSE: 'game:pause',
  GAME_RESUME: 'game:resume',
  GAME_OVER: 'game:over',
  ROOM_LOADING: 'room:loading',
  ROOM_ENTERED: 'room:entered',
  ROOM_CLEARED: 'room:cleared',
  // Player
  PLAYER_MOVED: 'player:moved',
  PLAYER_INTERACT: 'player:interact',
  LOOK_TARGET: 'player:lookTarget',
  // Puzzles
  PUZZLE_STARTED: 'puzzle:started',
  PUZZLE_SOLVED: 'puzzle:solved',
  PUZZLE_FAILED: 'puzzle:failed',
  HINT_REQUESTED: 'hint:requested',
  OBJECTIVE_CHANGED: 'objective:changed',
  // Inventory
  ITEM_ADDED: 'inventory:added',
  ITEM_USED: 'inventory:used',
  ITEM_SELECTED: 'inventory:selected',
  // UI
  SCREEN_CHANGED: 'ui:screen',
  TOAST: 'ui:toast',
  NOTE_OPEN: 'ui:note',
  DIALOGUE_OPEN: 'ui:dialogue',
  // Audio
  PLAY_SOUND: 'audio:play',
  AMBIENCE_CHANGE: 'audio:ambience',
  // Save
  SAVE_REQUESTED: 'save:requested',
  SAVE_DONE: 'save:done',
  ACHIEVEMENT: 'achievement:unlocked',
};
