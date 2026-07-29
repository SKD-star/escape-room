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
      // On a static host (no backend), /api/* often resolves to the SPA
      // fallback (index.html, HTTP 200) or an HTML 404 page. Treat any
      // non-JSON response as "offline" so the local fallbacks engage instead
      // of consuming a bogus empty body as a success.
      const ctype = res.headers.get('content-type') || '';
      if (!ctype.includes('application/json')) {
        this.online = false;
        return { ok: false, status: 0, error: 'offline' };
      }
      this.online = true;
      const data = await res.json().catch(() => null);
      if (data == null) {
        this.online = false;
        return { ok: false, status: 0, error: 'offline' };
      }
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

  getRooms() { return this.request('GET', '/rooms', null, { auth: false }); }

  async getLeaderboard() {
    const res = await this.request('GET', '/leaderboard', null, { auth: false });
    const localRuns = JSON.parse(localStorage.getItem('escape_room_local_leaderboard') || '[]');
    if (res.ok && Array.isArray(res.data?.leaderboard)) {
      // Merge local guest runs with server leaderboard entries if needed
      const serverList = res.data.leaderboard;
      const combined = [...serverList];
      for (const loc of localRuns) {
        if (!combined.some(s => s.username === loc.username && s.score === loc.score)) {
          combined.push(loc);
        }
      }
      combined.sort((a, b) => b.score - a.score);
      return { ok: true, status: 200, data: { leaderboard: combined.slice(0, 50) } };
    }
    return { ok: true, status: 200, data: { leaderboard: localRuns.slice(0, 50) } };
  }

  async submitRun(run) {
    // Calculate local score for guest / offline fallback
    const _DIFF_MULT = { story: 0.75, normal: 1.0, nightmare: 1.5 };
    const mult = _DIFF_MULT[run.difficulty] || 1.0;
    const time_s = Math.max(1, run.completion_time_s || 1);
    const rooms = Math.max(0, Math.min(10, run.rooms_cleared || 0));
    const puzzles = Math.max(0, run.puzzles_solved || 0);
    const hints = Math.max(0, run.hints_used || 0);
    const score = Math.max(0, Math.floor((rooms * 1000 + puzzles * 250 - Math.floor(time_s / 6) - hints * 100) * mult));

    const localEntry = {
      username: this.user?.username || 'Guest Escapist',
      completion_time_s: time_s,
      rooms_cleared: rooms,
      puzzles_solved: puzzles,
      hints_used: hints,
      ending: run.ending || 'standard',
      score,
      date: new Date().toISOString(),
    };

    // Save to local storage
    const localRuns = JSON.parse(localStorage.getItem('escape_room_local_leaderboard') || '[]');
    localRuns.push(localEntry);
    localRuns.sort((a, b) => b.score - a.score);
    localStorage.setItem('escape_room_local_leaderboard', JSON.stringify(localRuns.slice(0, 50)));

    if (this.isAuthenticated) {
      return this.request('POST', '/leaderboard', run);
    }
    return { ok: true, status: 201, data: { entry: localEntry, rank: 1 } };
  }

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
