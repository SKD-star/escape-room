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
import { Flashlight } from './player/Flashlight.js';
import { GamepadInput } from './player/GamepadInput.js';
import { TouchControls } from './player/TouchControls.js';
import { SanitySystem } from './player/SanitySystem.js';
import { SpeedrunTimer } from './player/SpeedrunTimer.js';
import { LevelTimer } from './player/LevelTimer.js';
import { AttemptsTracker } from './player/AttemptsTracker.js';
import { InteractionSystem } from './player/InteractionSystem.js';
import { FirstPersonHands } from './player/FirstPersonHands.js';
import { RoomManager } from './world/RoomManager.js';
import { HauntSystem } from './world/HauntSystem.js';
import { PuzzleManager } from './puzzles/PuzzleManager.js';
import { Inventory } from './inventory/Inventory.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { SaveManager } from './save/SaveManager.js';
import { api } from './net/ApiClient.js';
import { aiClient } from './ai/AIClient.js';
import { settings } from './config/settings.js';
import { difficulty } from './config/difficulty.js';
import { progression } from './player/ProgressionManager.js';
import { campaign } from './config/campaign.js';
import { ROOMS, FLASHLIGHT } from './config/constants.js';
import { screens } from './ui/ScreenManager.js';
import { lifetimeStats } from './ui/screens/StatsScreen.js';

export const ACHIEVEMENT_INFO = {
  first_escape: { title: 'First Steps', desc: 'Escaped your first room' },
  room_1_cleared: { title: 'Library Scholar', desc: 'Escaped the Haunted Library' },
  room_2_cleared: { title: 'Temple Explorer', desc: 'Escaped the Ancient Temple' },
  room_3_cleared: { title: 'Jailbreaker', desc: 'Escaped the Forgotten Prison' },
  room_4_cleared: { title: 'Mad Scientist', desc: 'Escaped the Abandoned Laboratory' },
  room_5_cleared: { title: 'Discharged', desc: 'Escaped the Abandoned Hospital' },
  room_6_cleared: { title: 'Lord of the Manor', desc: 'Escaped the Haunted Mansion' },
  room_7_cleared: { title: 'King\'s Ransom', desc: 'Escaped the Medieval Castle' },
  room_8_cleared: { title: 'Bunker Buster', desc: 'Escaped the Secret Bunker' },
  room_9_cleared: { title: 'System Override', desc: 'Escaped the Cyber AI Facility' },
  room_10_cleared: { title: 'Master Escapist', desc: 'Conquered the Final Convergence' },
  half_way: { title: 'Halfway to Freedom', desc: 'Cleared 5 rooms' },
  survivor: { title: 'Survivor', desc: 'Escaped all 10 rooms' },
  no_hints: { title: 'Purist', desc: 'Cleared a room without using any hints' },
  speed_demon: { title: 'Speed Demon', desc: 'Cleared a room in under 3 minutes' },
  puzzle_master: { title: 'Puzzle Master', desc: 'Solved 50 puzzles' },
  collector: { title: 'Collector', desc: 'Picked up 25 items across your journey' },
  bookworm: { title: 'Bookworm', desc: 'Read 10 notes or books' },
  ghost_whisperer: { title: 'Ghost Whisperer', desc: 'Had 10 conversations with spirits' },
  secret_finder: { title: 'Behind the Walls', desc: 'Discovered a secret room' },
  light_bearer: { title: 'Light Bearer', desc: 'Banished the presence with your flashlight' },
  true_ending: { title: 'The Whole Truth', desc: 'Reached the true ending' },
};

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
    this.roomEnteredAt = 0; // wall clock stamp, fed to the AI companion
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
    this.hands = new FirstPersonHands(this.engine);
    this.interactions = new InteractionSystem(this.engine, this.physics, this.hands);
    this.flashlight = new Flashlight(this.engine, () => Boolean(this.interactions.inspecting));
    this.sanity = new SanitySystem(this.engine, this.flashlight);
    this.inventory = new Inventory();
    this.rooms = new RoomManager({
      engine: this.engine,
      physics: this.physics,
      interactions: this.interactions,
      player: this.player,
      inventory: this.inventory, // injected so door callbacks can validate key ownership
    });
    this.haunt = new HauntSystem(this.engine, this.player, this.flashlight, this.rooms);
    this.gamepad = new GamepadInput(this.player, this.interactions, this.flashlight);
    this.touch = new TouchControls(this.player, this.interactions, this.flashlight);
    this.timer = new SpeedrunTimer();
    this.levelTimer = new LevelTimer();
    this.attemptsTracker = new AttemptsTracker();
    this.puzzles = new PuzzleManager();

    this.ui.loading.setProgress(0.85, 'Listening for whispers…');
    this.bindEvents();
    this.bindKeys();
    await settings.pullCloud();

    // Frame systems
    this.perfGuard = new PerfGuard();
    this.engine.addSystem({ update: (dt) => this.physics.update(dt) });
    this.engine.addSystem({ update: (dt) => this.player.update(dt) });
    this.engine.addSystem({ update: (dt) => this.interactions.update(dt) });
    this.engine.addSystem({ update: (dt) => this.flashlight.update(dt) });
    this.engine.addSystem({ update: (dt) => this.sanity.update(dt) });
    this.engine.addSystem({ update: (dt, t) => this.haunt.update(dt, t) });
    this.engine.addSystem({ update: (dt, t) => this.rooms.update(dt, t) });
    this.engine.addSystem({ update: (dt) => this.gamepad.update(dt) });
    this.engine.addSystem({ update: (dt) => this.touch.update(dt) });
    this.engine.addSystem({ update: (dt) => this.levelTimer.update(dt) });
    this.engine.addSystem({ update: (dt) => this.perfGuard.update(dt) });
    this.engine.addSystem({
      update: (dt) => {
        if (this.isPlaying) {
          this.stats.playtime += dt;
          lifetimeStats.addPlaytime(dt);
        }
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
    this.setSystemsActive(false);
    this.audio.stopAmbience?.();
    screens.show('main-menu');
  }

  /** Gate the survival-layer systems on the playing state + settings. */
  setSystemsActive(active) {
    this.interactions.enabled = active;
    this.flashlight.enabled = active;
    this.sanity.enabled = active && settings.get('sanityFx');
    this.haunt.enabled = active && settings.get('hauntEnabled');
    this.levelTimer.enabled = active;
    this.attemptsTracker.enabled = active && difficulty.key !== 'story';
    if (active) this.levelTimer.frozen = false;
    if (!active && this.flashlight.on) this.flashlight.toggle(false);
  }

  async newGame(modeKey = 'normal') {
    this.audio.start();
    this.audio.startBGM();
    difficulty.set(modeKey);
    await campaign.load(); // pull the live room order/roster from the admin
    this.stats = this.freshStats();
    this.flags = {};
    this.inventory.restore([]);
    this.sanity.reset();
    this.attemptsTracker.reset();
    this.ui.journal?.restore([]);
    this.timer.start();
    bus.emit('stats:runStarted');
    this.state = 'intro';
    screens.hide('main-menu');
    screens.hide('difficulty');
    await this.ui.intro.play(INTRO_LINES);
    // intro's onDone calls startRun
  }

  async startRun(roomKey) {
    this.state = 'playing';
    await campaign.ensure();
    const key = roomKey ?? campaign.first() ?? ROOMS[0].key;
    screens.hideAll();
    screens.show('loading');
    try {
      await screens.fadeTransition(async () => {
        await this.rooms.load(key);
        bus.emit(Events.AMBIENCE_CHANGE, this.rooms.current.definition.theme);
      });
    } catch (err) {
      console.error('[Game] room load failed', err);
      bus.emit(Events.TOAST, { text: 'The room resists… retrying.', type: 'danger' });
      await this.rooms.load(key); // one retry; if this throws we surface it
    } finally {
      screens.hideAll();
      screens.show('hud');
    }
    this.player.enable();
    this.setSystemsActive(true);
    this.levelTimer.begin(this.rooms.currentKey);
    this.attemptsTracker.begin(this.rooms.currentKey);
    this.track('room_entered', { room_id: key });

    // First-room onboarding: light raised for you, and a hint about it
    if (this.stats.rooms_cleared === 0) {
      setTimeout(() => {
        if (this.isPlaying && !this.flashlight.on) this.flashlight.toggle(true);
      }, 1500);
      setTimeout(() => {
        if (this.isPlaying) {
          bus.emit(Events.TOAST, { text: 'Flashlight raised — press F to toggle it. The gold light marks your goal.', duration: 6000 });
        }
      }, 4000);
    }

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
    this.interactions.enabled = false;
    this.haunt.enabled = false;
    this.sanity.enabled = false;
    // A hard pause (Esc menu) freezes the room clock; a soft pause for a
    // puzzle does NOT — the deadline keeps running while you solve.
    if (!soft) { this.levelTimer.frozen = true; screens.show('pause-menu'); }
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    screens.hideAll();
    screens.show('hud');
    this.player.enable();
    this.setSystemsActive(true);
    this.levelTimer.frozen = false;
  }

  async advanceRoom() {
    // Record mode and room completion
    progression.recordCompletion(this.rooms.currentKey, difficulty.key);

    const roomName = this.rooms.current?.definition?.name || 'Room';
    bus.emit('room:cleared:banner', { name: roomName });

    const next = this.rooms.nextKey();
    this.stats.rooms_cleared += 1;

    // Achievements (unlock specific room achievement for the level cleared)
    const roomList = campaign.list || ROOMS;
    const roomIndex = roomList.findIndex((r) => r.key === this.rooms.currentKey);
    const roomLevel = roomIndex >= 0 ? roomIndex + 1 : this.stats.rooms_cleared;
    this.unlock(`room_${roomLevel}_cleared`, true);

    if (this.stats.rooms_cleared === 1) this.unlock('first_escape', true);
    if (this.stats.rooms_cleared >= 5) this.unlock('half_way', true);
    if (this.puzzles.hintsUsed === 0) this.unlock('no_hints', true);

    if (!next) return this.finishGame();

    this.player.disable();
    try {
      await screens.fadeTransition(async () => {
        await this.rooms.load(next);
        bus.emit(Events.AMBIENCE_CHANGE, this.rooms.current.definition.theme);
      });
    } catch (err) {
      console.error('[Game] room transition failed', err);
      await this.rooms.load(next); // one retry
    } finally {
      screens.hideAll();
      screens.show('hud');
    }
    this.state = 'playing';
    this.player.enable();
    this.setSystemsActive(true);
    this.levelTimer.begin(this.rooms.currentKey);
    this.saves.autosave('checkpoint');
    this.track('room_entered', { room_id: next });

    aiClient.getStory(this.rooms.current.definition.theme, {
      rooms_cleared: this.stats.rooms_cleared,
    }).then(({ text }) => bus.emit(Events.TOAST, { text, duration: 7000 }));
  }

  /**
   * Nightmare hard deadline: the room clock ran out. Reload the SAME room
   * fresh — a new puzzle is generated and the timer resets. Cleared rooms are
   * untouched, so this costs the current room's progress only, never the run.
   */
  async failRoom() {
    if (this.state !== 'playing' && this.state !== 'paused') return;
    if (this._failing) return;
    this._failing = true;

    const key = this.rooms.currentKey;
    this.player.disable();
    this.setSystemsActive(false);
    bus.emit(Events.PLAY_SOUND, { name: 'error' });
    bus.emit(Events.TOAST, {
      text: 'You ran out of time. The room folds back on itself…',
      type: 'danger', duration: 4200,
    });

    try {
      await screens.fadeTransition(async () => {
        await this.rooms.load(key);
        bus.emit(Events.AMBIENCE_CHANGE, this.rooms.current.definition.theme);
      });
    } catch (err) {
      console.error('[Game] room restart failed', err);
      await this.rooms.load(key); // one retry
    } finally {
      screens.hideAll();
      screens.show('hud');
    }

    this.state = 'playing';
    this.player.enable();
    this.setSystemsActive(true);
    this.levelTimer.begin(this.rooms.currentKey);
    this.track('room_timeout', { room_id: key });
    this._failing = false;
  }

  /**
   * Full game restart — called when all 3 attempts are exhausted.
   * Resets all state (inventory, puzzles, stats, flags) and starts over from Room 1.
   * Per design: "When all three attempts are exhausted — show Game Over, reset all progress."
   */
  async restartRoom() {
    if (this._restarting) return;
    this._restarting = true;

    // Full run reset
    this.stats = this.freshStats();
    this.flags = {};
    this.inventory.restore([]);
    this.sanity.reset();
    this.ui.journal?.restore([]);
    this.timer.start();

    const firstKey = campaign.first() ?? ROOMS[0].key;

    this.player.disable();
    this.setSystemsActive(false);
    bus.emit(Events.PLAY_SOUND, { name: 'error' });
    bus.emit(Events.TOAST, {
      text: 'Starting over from the beginning…',
      type: 'danger', duration: 3000,
    });

    try {
      await screens.fadeTransition(async () => {
        await this.rooms.load(firstKey);
        bus.emit(Events.AMBIENCE_CHANGE, this.rooms.current.definition.theme);
      });
    } catch (err) {
      console.error('[Game] full restart failed', err);
      await this.rooms.load(firstKey);
    } finally {
      screens.hideAll();
      screens.show('hud');
    }

    this.state = 'playing';
    this.player.enable();
    this.setSystemsActive(true);
    this.levelTimer.begin(this.rooms.currentKey);
    this.attemptsTracker.begin(this.rooms.currentKey);
    this.track('run_restart', { from_room: this.rooms.currentKey });
    this._restarting = false;
  }


  finishGame() {
    progression.recordCompletion(this.rooms.currentKey, difficulty.key);
    this.state = 'ending';
    this.player.disable();
    this.setSystemsActive(false);

    // Ending logic: true ending needs the combined memento + enough dialogue;
    // dark ending triggers if many hints were leaned on or sanity collapsed.
    let ending = 'standard';
    if (this.inventory.has('memento') || this.inventory.has('decoded_chip')) ending = 'true';
    else if (this.stats.hints_used > 12 || this.sanity.lowestSeen <= 5) ending = 'dark';

    if (ending === 'true') this.unlock('true_ending');
    this.unlock('survivor');

    const run = {
      completion_time_s: Math.round(this.stats.playtime),
      rooms_cleared: this.stats.rooms_cleared,
      puzzles_solved: this.stats.puzzles_solved,
      hints_used: this.stats.hints_used,
      ending,
      difficulty: difficulty.key,
    };
    api.submitRun(run);
    this.track('ending_reached', { ending, difficulty: difficulty.key });
    bus.emit('stats:ending', ending);
    this.timer.stop();

    this.ui.ending.show(ending, {
      playtime_s: run.completion_time_s,
      rooms_cleared: run.rooms_cleared,
      puzzles_solved: run.puzzles_solved,
      hints_used: run.hints_used,
      total: campaign.count,
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
      sanity: { value: this.sanity.value, lowestSeen: this.sanity.lowestSeen },
      flashlight: { battery: this.flashlight.battery },
      difficulty: difficulty.key,
      journal: this.ui.journal?.toJSON() ?? [],
      timer: this.timer.elapsed,
    };
  }

  async applyState(state) {
    this.stats = { ...this.freshStats(), ...state.stats, playtime: state.playtime ?? 0 };
    this.flags = state.flags ?? {};
    this.inventory.restore(state.inventory);
    difficulty.set(state.difficulty ?? 'normal');
    this.ui.journal?.restore(state.journal ?? []);
    this.timer.start();
    this.timer.restore(state.timer ?? state.playtime ?? 0);
    if (state.sanity) {
      this.sanity.value = state.sanity.value ?? 100;
      this.sanity.lowestSeen = state.sanity.lowestSeen ?? this.sanity.value;
      this.sanity.publish();
    } else {
      this.sanity.reset();
    }
    if (state.flashlight) {
      this.flashlight.battery = state.flashlight.battery ?? 100;
      this.flashlight.publish();
    }
    await campaign.ensure();
    await this.startRun(state.roomKey);
    this.puzzles.restore(state.puzzle);
    if (state.puzzle?.solved) this.rooms.current?.unlockExit();
  }

  // -- achievements & analytics ------------------------------------------

  unlock(code, force = false) {
    const local = JSON.parse(localStorage.getItem('escape_room_achievements') || '[]');
    const isNew = !local.includes(code);
    if (isNew) {
      local.push(code);
      localStorage.setItem('escape_room_achievements', JSON.stringify(local));
    }

    if (isNew || force) {
      const info = ACHIEVEMENT_INFO[code] || {
        title: code.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        desc: 'Feat accomplished across all runs',
      };

      bus.emit(Events.ACHIEVEMENT, { code, title: info.title, description: info.desc });
    }

    if (isNew) {
      api.unlockAchievement(code);
    }
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
      // Check if player has the required key before unlocking exit
      this.rooms.current?.unlockExit(this.inventory);
      if (timeS < 180) this.unlock('speed_demon');
      if (this.stats.puzzles_solved >= 50) this.unlock('puzzle_master');
      this.track('puzzle_solved', { time_s: timeS, hints: hintsUsed });
    });

    bus.on(Events.ROOM_CLEARED, () => this.advanceRoom());

    // Nightmare hard deadline hit zero → restart the room.
    bus.on('countdown:timeout', () => this.failRoom());

    bus.on(Events.ITEM_ADDED, () => {
      this.stats.items_collected += 1;
      if (this.stats.items_collected >= 25) this.unlock('collector');
      this.rooms.current?.checkKeyCollected(this.inventory);
      this.track('item_collected');
    });

    bus.on(Events.NOTE_OPEN, () => {
      this.stats.notes_read += 1;
      if (this.stats.notes_read >= 10) this.unlock('bookworm');
      this.levelTimer.frozen = true; // reading is optional — pause the clock
      this.pause(true);
    });

    bus.on(Events.DIALOGUE_OPEN, () => {
      this.levelTimer.frozen = true; // talking is optional — pause the clock
      this.pause(true);
    });

    // Summon the room spirit from anywhere (T key / touch chat button), so the
    // companion is a chatbot you can always reach, not a one-off prop.
    bus.on('librarian:open', () => this.openLibrarian());
    bus.on(Events.ROOM_ENTERED, () => { this.roomEnteredAt = performance.now(); });
    bus.on('dialogue:exchanged', () => {
      this.stats.dialogues += 1;
      if (this.stats.dialogues >= 10) this.unlock('ghost_whisperer');
    });

    bus.on('secret:found', () => {
      this.stats.secrets_found += 1;
      this.unlock('secret_finder');
      this.track('secret_found');
    });

    bus.on('sanity:damage', (amount) => {
      this.sanity.drain(amount);
      this.track('haunt_touched');
    });

    bus.on('secret:banish', () => {
      this.flags.banishes = (this.flags.banishes ?? 0) + 1;
      this.unlock('light_bearer');
      this.track('haunt_banished');
    });

    bus.on(Events.HINT_REQUESTED, () => this.track('hint_requested'));

    bus.on('inventory:toggle', () => {
      if (this.state === 'playing') this.inventory.openUI();
      else if (screens.current === 'inventory') this.inventory.closeUI();
    });

    bus.on(Events.PUZZLE_FAILED, () => this.track('puzzle_failed'));

    // Attempts exhausted → allow room restart
    bus.on('attempts:exhausted', () => {
      this.pause(true);
      bus.emit(Events.TOAST, {
        text: 'Press R to restart the room with a new puzzle.',
        type: 'danger',
        duration: 8000,
      });
    });
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
      if (e.code === 'KeyJ') {
        if (this.state === 'playing') {
          this.pause(true);
          screens.show('journal');
        } else if (screens.current === 'journal') {
          this.ui.journal.close();
        }
      }
      if (e.code === 'KeyT') {
        if (this.state === 'playing') this.openLibrarian();
        else if (screens.current === 'dialogue') this.ui.dialogue?.close();
      }
      if (e.code === 'KeyR') {
        if (this.attemptsTracker.exhausted || screens.current === 'room-locked') {
          screens.hide('room-locked');
          this.restartRoom();
        }
      }
      if (e.code === 'F5') {
        e.preventDefault();
        if (this.state === 'playing') this.saves.save(1, 'manual');
      }
      if (e.code === 'F9') {
        e.preventDefault();
        if (this.state === 'playing' || this.state === 'paused') {
          this.loadSlot(1);
        }
      }
    });
  }

  // -- room companion (AI chatbot) ----------------------------------------

  /** The spirit that answers in each theme. */
  static SPIRITS = {
    library: 'The Librarian',
    temple: 'The Keeper',
    prison: 'Prisoner 47',
    laboratory: 'Dr. Halvorsen',
    hospital: 'The Night Nurse',
    mansion: 'The Lady',
    castle: 'The Undying King',
    bunker: 'The Operator',
    cyber: 'PROCESS_0',
    boss: 'The Convergence',
  };

  /** Open the chatbot for whichever spirit haunts the current room. */
  openLibrarian() {
    if (this.state !== 'playing') return;
    const theme = this.rooms.current?.definition?.theme || 'library';
    bus.emit(Events.DIALOGUE_OPEN, {
      npc: Game.SPIRITS[theme] || 'The Librarian',
      theme,
    });
  }

  /**
   * Live room state handed to the chatbot on every turn. This is what makes
   * the companion answer about *this* room right now instead of guessing:
   * the mechanism and its clue, what the player carries, what the door still
   * wants, what is interactable, and how the run is going.
   */
  chatContext() {
    const def = this.rooms?.current?.definition ?? {};
    const room = this.rooms?.current;
    const puzzle = this.puzzles?.puzzle ?? null;

    // The literal answer travels with a "never say it verbatim" instruction —
    // it lets the spirit grade its hints instead of bluffing.
    let solution = '';
    if (puzzle) {
      if (puzzle.code) solution = String(puzzle.code);
      else if (Array.isArray(puzzle.sequence)) solution = puzzle.sequence.join(' ');
      else if (puzzle.answer) solution = String(puzzle.answer);
    }

    const landmarks = [];
    for (const obj of this.interactions?.interactables ?? []) {
      const label = obj?.userData?.interactable?.label;
      if (label && !landmarks.includes(label)) landmarks.push(label);
    }

    return {
      room_name: def.name,
      chapter: def.chapter,
      brief: def.brief,
      objective: this.puzzles?.solved
        ? 'The mechanism is solved — reach the exit.'
        : 'Find the clues in the room and solve the mechanism.',
      puzzle: puzzle ? {
        type: puzzle.type,
        title: puzzle.title,
        clue: puzzle.clue,
        riddle: puzzle.riddle,
        solution,
        solved: Boolean(this.puzzles?.solved),
      } : null,
      inventory: (this.inventory?.items ?? []).map((i) => i.name),
      needed_key: room?.requiredKeyItem ? room.requiredKeyItem.replaceAll('_', ' ') : '',
      landmarks: landmarks.slice(0, 14),
      notes: (this.ui.journal?.entries ?? [])
        .filter((e) => e.roomKey === this.rooms?.currentKey)
        .map((e) => `${e.title}: ${e.body}`),
      sanity: this.sanity?.ratio,
      battery: this.flashlight ? this.flashlight.battery / FLASHLIGHT.BATTERY_MAX : null,
      flashlight_on: Boolean(this.flashlight?.on),
      time_in_room_s: this.roomEnteredAt
        ? Math.round((performance.now() - this.roomEnteredAt) / 1000)
        : 0,
      failed_attempts: this.puzzles?.attempts ?? 0,
      hints_used: this.puzzles?.hintsUsed ?? 0,
      difficulty: difficulty.mode?.label,
      rooms_cleared: this.stats.rooms_cleared,
    };
  }
}
