/**
 * Game — top-level orchestrator. Owns all systems, game flow state
 * machine (menu → intro → playing ⇄ paused → ending), progression,
 * achievements and analytics.
 */
import { bus, Events } from './core/EventBus.js';
import { Engine } from './core/Engine.js';
import { PerfGuard } from './core/PerfGuard.js';
import { PhysicsWorld, initRapier } from './core/PhysicsWorld.js';
import { FPSController } from './player/FPSController.js';
import { InteractionSystem } from './player/InteractionSystem.js';
import { RoomManager } from './world/RoomManager.js';
import { PuzzleManager } from './puzzles/PuzzleManager.js';
import { Inventory } from './inventory/Inventory.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { SaveManager } from './save/SaveManager.js';
import { api } from './net/ApiClient.js';
import { aiClient } from './ai/AIClient.js';
import { settings } from './config/settings.js';
import { ROOMS } from './config/constants.js';
import { screens } from './ui/ScreenManager.js';

const INTRO_LINES = [
  'You wake to the smell of old paper and candle smoke.',
  'The last thing you remember is agreeing to test something. A system. A study. The details slide away when you reach for them.',
  'A voice — not heard, exactly, more like remembered in real time — says:',
  '"Ten rooms. Each one will ask you a question shaped like a lock."',
  '"Answer well. I am learning from you."',
];

export class Game {
  constructor(ui) {
    this.ui = ui; // { loading, hud, intro, ending }
    this.state = 'boot'; // boot | menu | intro | playing | paused | ending
    this.sessionId = crypto.randomUUID?.() ?? String(Date.now());

    // Run stats
    this.stats = this.freshStats();

    this.engine = null;
    this.physics = null;
    this.player = null;
    this.interactions = null;
    this.rooms = null;
    this.puzzles = null;
    this.inventory = null;
    this.audio = new AudioEngine();
    this.saves = new SaveManager(this);

    this.flags = {}; // story flags: secrets found, dialogue counts, etc.
  }

  freshStats() {
    return {
      playtime: 0,
      rooms_cleared: 0,
      puzzles_solved: 0,
      hints_used: 0,
      notes_read: 0,
      items_collected: 0,
      dialogues: 0,
      secrets_found: 0,
    };
  }

  get isPlaying() { return this.state === 'playing'; }

  // -- boot ---------------------------------------------------------------

  async init() {
    const canvas = document.getElementById('game-canvas');

    this.ui.loading.setProgress(0.1, 'Waking the renderer…');
    this.engine = new Engine(canvas);

    this.ui.loading.setProgress(0.35, 'Binding physical laws…');
    await initRapier();
    this.physics = new PhysicsWorld();

    this.ui.loading.setProgress(0.6, 'Assembling the vessel…');
    this.player = new FPSController(this.engine, this.physics);
    this.interactions = new InteractionSystem(this.engine, this.physics);
    this.rooms = new RoomManager({
      engine: this.engine,
      physics: this.physics,
      interactions: this.interactions,
      player: this.player,
    });
    this.puzzles = new PuzzleManager();
    this.inventory = new Inventory();

    this.ui.loading.setProgress(0.85, 'Listening for whispers…');
    this.bindEvents();
    this.bindKeys();
    await settings.pullCloud();

    // Frame systems
    this.perfGuard = new PerfGuard();
    this.engine.addSystem({ update: (dt) => this.physics.update(dt) });
    this.engine.addSystem({ update: (dt) => this.player.update(dt) });
    this.engine.addSystem({ update: (dt) => this.interactions.update(dt) });
    this.engine.addSystem({ update: (dt, t) => this.rooms.update(dt, t) });
    this.engine.addSystem({ update: (dt) => this.perfGuard.update(dt) });
    this.engine.addSystem({
      update: (dt) => {
        if (this.isPlaying) this.stats.playtime += dt;
        this.saves.update(dt);
      },
    });
    this.engine.start();

    this.ui.loading.setProgress(1, 'Ready.');
    await new Promise((r) => setTimeout(r, 500));
    this.toMenu();
    this.track('session_started');
  }

  // -- flow ---------------------------------------------------------------

  toMenu() {
    this.state = 'menu';
    this.player.disable();
    this.audio.stopAmbience?.();
    screens.show('main-menu');
  }

  async newGame() {
    this.audio.start();
    this.stats = this.freshStats();
    this.flags = {};
    this.inventory.restore([]);
    this.state = 'intro';
    screens.hide('main-menu');
    await this.ui.intro.play(INTRO_LINES);
    // intro's onDone calls startRun
  }

  async startRun(roomKey = ROOMS[0].key) {
    this.state = 'playing';
    screens.hideAll();
    screens.show('loading');
    await screens.fadeTransition(async () => {
      await this.rooms.load(roomKey);
      screens.hideAll();
      screens.show('hud');
      bus.emit(Events.AMBIENCE_CHANGE, this.rooms.current.definition.theme);
    });
    this.player.enable();
    this.track('room_entered', { room_id: roomKey });

    // AI story beat on entry
    aiClient.getStory(this.rooms.current.definition.theme, {
      rooms_cleared: this.stats.rooms_cleared,
    }).then(({ text }) => {
      bus.emit(Events.TOAST, { text, duration: 7000 });
    });
  }

  async continueGame() {
    this.audio.start();
    const latest = this.saves.latest();
    if (!latest) return this.newGame();
    const state = await this.saves.load(latest.slot);
    if (state) this.applyState(state);
  }

  async loadSlot(slot) {
    this.audio.start();
    const state = await this.saves.load(slot);
    if (state) this.applyState(state);
    else bus.emit(Events.TOAST, { text: 'That memory is empty.', type: 'danger' });
  }

  pause(soft = false) {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.player.disable();
    if (!soft) screens.show('pause-menu');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    screens.hideAll();
    screens.show('hud');
    this.player.enable();
  }

  async advanceRoom() {
    const next = this.rooms.nextKey();
    this.stats.rooms_cleared += 1;

    // Achievements
    this.unlock('first_escape');
    if (this.stats.rooms_cleared >= 5) this.unlock('half_way');
    if (this.puzzles.hintsUsed === 0) this.unlock('no_hints');

    if (!next) return this.finishGame();

    this.player.disable();
    await screens.fadeTransition(async () => {
      await this.rooms.load(next);
      bus.emit(Events.AMBIENCE_CHANGE, this.rooms.current.definition.theme);
    });
    this.state = 'playing';
    this.player.enable();
    this.saves.autosave('checkpoint');
    this.track('room_entered', { room_id: next });

    aiClient.getStory(this.rooms.current.definition.theme, {
      rooms_cleared: this.stats.rooms_cleared,
    }).then(({ text }) => bus.emit(Events.TOAST, { text, duration: 7000 }));
  }

  finishGame() {
    this.state = 'ending';
    this.player.disable();

    // Ending logic: true ending needs the combined memento + enough dialogue;
    // dark ending triggers if many hints were leaned on.
    let ending = 'standard';
    if (this.inventory.has('memento') || this.inventory.has('decoded_chip')) ending = 'true';
    else if (this.stats.hints_used > 12) ending = 'dark';

    if (ending === 'true') this.unlock('true_ending');
    this.unlock('survivor');

    const run = {
      completion_time_s: Math.round(this.stats.playtime),
      rooms_cleared: this.stats.rooms_cleared,
      puzzles_solved: this.stats.puzzles_solved,
      hints_used: this.stats.hints_used,
      ending,
    };
    api.submitRun(run);
    this.track('ending_reached', { ending });

    this.ui.ending.show(ending, {
      playtime_s: run.completion_time_s,
      rooms_cleared: run.rooms_cleared,
      puzzles_solved: run.puzzles_solved,
      hints_used: run.hints_used,
    });
  }

  // -- save state ---------------------------------------------------------

  captureState() {
    return {
      version: 1,
      roomKey: this.rooms.currentKey,
      playtime: this.stats.playtime,
      stats: this.stats,
      flags: this.flags,
      inventory: this.inventory.toJSON(),
      puzzle: this.puzzles.toJSON(),
    };
  }

  async applyState(state) {
    this.stats = { ...this.freshStats(), ...state.stats, playtime: state.playtime ?? 0 };
    this.flags = state.flags ?? {};
    this.inventory.restore(state.inventory);
    await this.startRun(state.roomKey ?? ROOMS[0].key);
    this.puzzles.restore(state.puzzle);
    if (state.puzzle?.solved) this.rooms.current?.unlockExit();
  }

  // -- achievements & analytics ------------------------------------------

  unlock(code) {
    const local = JSON.parse(localStorage.getItem('escape_room_achievements') || '[]');
    if (local.includes(code)) return;
    local.push(code);
    localStorage.setItem('escape_room_achievements', JSON.stringify(local));
    api.unlockAchievement(code).then((res) => {
      const title = res.ok ? res.data.unlocked.title : code.replaceAll('_', ' ');
      bus.emit(Events.ACHIEVEMENT, { title });
    });
  }

  track(eventType, payload = {}) {
    api.trackEvent({
      event_type: eventType,
      session_id: this.sessionId,
      room_id: this.rooms?.currentKey,
      payload,
    });
  }

  // -- event wiring -------------------------------------------------------

  bindEvents() {
    bus.on(Events.GAME_PAUSE, (opts) => this.pause(opts?.soft));
    bus.on(Events.GAME_RESUME, () => this.resume());

    bus.on(Events.PUZZLE_SOLVED, ({ timeS, hintsUsed }) => {
      this.stats.puzzles_solved += 1;
      this.stats.hints_used += hintsUsed;
      this.rooms.current?.unlockExit();
      if (timeS < 180) this.unlock('speed_demon');
      if (this.stats.puzzles_solved >= 50) this.unlock('puzzle_master');
      this.track('puzzle_solved', { time_s: timeS, hints: hintsUsed });
    });

    bus.on(Events.ROOM_CLEARED, () => this.advanceRoom());

    bus.on(Events.ITEM_ADDED, () => {
      this.stats.items_collected += 1;
      if (this.stats.items_collected >= 25) this.unlock('collector');
      this.track('item_collected');
    });

    bus.on(Events.NOTE_OPEN, () => {
      this.stats.notes_read += 1;
      if (this.stats.notes_read >= 10) this.unlock('bookworm');
      this.pause(true);
    });

    bus.on(Events.DIALOGUE_OPEN, () => this.pause(true));
    bus.on('dialogue:exchanged', () => {
      this.stats.dialogues += 1;
      if (this.stats.dialogues >= 10) this.unlock('ghost_whisperer');
    });

    bus.on('secret:found', () => {
      this.stats.secrets_found += 1;
      this.unlock('secret_finder');
      this.track('secret_found');
    });

    bus.on(Events.HINT_REQUESTED, () => this.track('hint_requested'));

    bus.on(Events.PUZZLE_FAILED, () => this.track('puzzle_failed'));
  }

  bindKeys() {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused' && screens.current === 'pause-menu') this.resume();
      }
      if (e.code === 'Tab') {
        e.preventDefault();
        if (this.state === 'playing') this.inventory.openUI();
        else if (screens.current === 'inventory') this.inventory.closeUI();
      }
      if (e.code === 'KeyQ' && this.state === 'playing') {
        bus.emit(Events.TOAST, { text: 'Objective — check the pause menu for details.' });
      }
      if (e.code === 'F5') {
        e.preventDefault();
        if (this.state === 'playing') this.saves.save(1, 'manual');
      }
    });
  }
}
