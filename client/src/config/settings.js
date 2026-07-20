/**
 * Settings store — persisted to localStorage, synced to cloud when
 * authenticated. Emits QUALITY_CHANGED / settings events on change.
 */
import { DEFAULT_SETTINGS } from '../config/constants.js';
import { bus, Events } from '../core/EventBus.js';
import { api } from '../net/ApiClient.js';

const KEY = 'escape_room_settings';

class SettingsStore {
  constructor() {
    this.values = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  }

  get(name) {
    return this.values[name];
  }

  set(name, value) {
    this.values[name] = value;
    localStorage.setItem(KEY, JSON.stringify(this.values));
    bus.emit('settings:changed', { name, value });
    if (name === 'quality') bus.emit(Events.QUALITY_CHANGED, value);
    // Fire-and-forget cloud sync
    if (api.isAuthenticated) api.putSettings(this.values);
  }

  async pullCloud() {
    if (!api.isAuthenticated) return;
    const res = await api.getSettings();
    if (res?.ok && res.data.settings && Object.keys(res.data.settings).length) {
      this.values = { ...DEFAULT_SETTINGS, ...res.data.settings };
      localStorage.setItem(KEY, JSON.stringify(this.values));
    }
  }
}

export const settings = new SettingsStore();
