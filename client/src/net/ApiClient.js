/**
 * ApiClient — thin fetch wrapper with JWT handling and offline tolerance.
 * All server communication funnels through this module; every method
 * resolves to `null` (never throws) when the backend is unreachable so
 * the game keeps working fully offline.
 */
const BASE = '/api';
const TOKEN_KEY = 'escape_room_token';
const USER_KEY = 'escape_room_user';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem(TOKEN_KEY) || null;
    this.user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    this.online = true;
  }

  get isAuthenticated() {
    return Boolean(this.token);
  }

  /** @private */
  async request(method, path, body = null, { auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && this.token) headers.Authorization = `Bearer ${this.token}`;
    try {
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body != null ? JSON.stringify(body) : undefined,
      });
      this.online = true;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, status: res.status, error: data.error || 'Request failed' };
      }
      return { ok: true, status: res.status, data };
    } catch {
      this.online = false;
      return { ok: false, status: 0, error: 'offline' };
    }
  }

  // -- auth ---------------------------------------------------------------

  setSession(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  clearSession() {
    this.token = null;
    this.user = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  async register(username, email, password) {
    const res = await this.request('POST', '/auth/register',
      { username, email, password }, { auth: false });
    if (res.ok) this.setSession(res.data.token, res.data.user);
    return res;
  }

  async login(username, password) {
    const res = await this.request('POST', '/auth/login',
      { username, password }, { auth: false });
    if (res.ok) this.setSession(res.data.token, res.data.user);
    return res;
  }

  forgotPassword(email) {
    return this.request('POST', '/auth/forgot-password', { email }, { auth: false });
  }

  resetPassword(token, password) {
    return this.request('POST', '/auth/reset-password', { token, password }, { auth: false });
  }

  // -- saves --------------------------------------------------------------

  listSaves() { return this.request('GET', '/saves'); }
  getSave(slot) { return this.request('GET', `/saves/${slot}`); }
  putSave(slot, payload) { return this.request('PUT', `/saves/${slot}`, payload); }
  deleteSave(slot) { return this.request('DELETE', `/saves/${slot}`); }

  // -- game data ----------------------------------------------------------

  getLeaderboard() { return this.request('GET', '/leaderboard', null, { auth: false }); }
  submitRun(run) { return this.request('POST', '/leaderboard', run); }
  getAchievements() { return this.request('GET', '/achievements'); }
  unlockAchievement(code) { return this.request('POST', `/achievements/${code}/unlock`); }
  trackEvent(payload) { return this.request('POST', '/analytics', payload); }
  puzzleResult(payload) { return this.request('POST', '/puzzles/result', payload); }
  getSettings() { return this.request('GET', '/settings'); }
  putSettings(settings) { return this.request('PUT', '/settings', { settings }); }

  // -- AI -----------------------------------------------------------------

  aiPuzzle(payload) { return this.request('POST', '/ai/puzzle', payload); }
  aiHint(payload) { return this.request('POST', '/ai/hint', payload); }
  aiDialogue(payload) { return this.request('POST', '/ai/dialogue', payload); }
  aiStory(payload) { return this.request('POST', '/ai/story', payload); }
}

export const api = new ApiClient();
