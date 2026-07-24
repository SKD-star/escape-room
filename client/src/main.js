/**
 * main.js — application entry point.
 * Builds all UI screens, constructs the Game and boots it.
 */
import { Game } from './Game.js';
import { screens } from './ui/ScreenManager.js';
import { LoadingScreen } from './ui/screens/LoadingScreen.js';
import { MainMenu } from './ui/screens/MainMenu.js';
import { AuthScreen } from './ui/screens/AuthScreen.js';
import { SettingsScreen } from './ui/screens/SettingsScreen.js';
import {
  PauseMenu, CreditsScreen, LeaderboardScreen, AchievementsScreen, SaveLoadScreen,
} from './ui/screens/MenuScreens.js';
import { HUD } from './ui/screens/HUD.js';
import { DifficultyScreen } from './ui/screens/DifficultyScreen.js';
import { ManualScreen } from './ui/screens/ManualScreen.js';
import { JournalScreen } from './ui/screens/JournalScreen.js';
import { StatsScreen } from './ui/screens/StatsScreen.js';
import {
  NoteReader, DialogueBox, ObjectivesScreen, IntroScreen, EndingScreen,
} from './ui/screens/GameOverlays.js';

async function boot() {
  // WebGL2 support gate
  const testCanvas = document.createElement('canvas');
  if (!testCanvas.getContext('webgl2')) {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#e8e6e3;font-family:sans-serif;text-align:center;padding:24px">
        <div>
          <h1 style="margin-bottom:12px">WebGL 2 Required</h1>
          <p>This experience needs a browser with WebGL 2 support (Chrome, Edge, Firefox, Safari 15+).</p>
        </div>
      </div>`;
    return;
  }

  // -- UI construction ----------------------------------------------------
  const loading = new LoadingScreen();
  screens.show('loading');

  /** @type {Game} */
  let game;

  const hud = new HUD();
  const intro = new IntroScreen(() => game.startRun());
  const ending = new EndingScreen(() => game.toMenu());
  const journal = new JournalScreen(
    () => game.rooms?.currentKey,
    () => game.resume(),
  );

  game = new Game({ loading, hud, intro, ending, journal });

  new MainMenu({
    onNewGame: () => screens.show('difficulty'),
    onContinue: () => game.continueGame(),
    hasSave: () => game.saves.hasAnySave(),
  });
  new DifficultyScreen((modeKey) => game.newGame(modeKey));
  new ManualScreen();
  new StatsScreen();
  new AuthScreen();
  new SettingsScreen();
  new PauseMenu({
    onResume: () => game.resume(),
    onSave: () => {},
    onQuit: () => {
      game.saves.autosave('auto');
      game.toMenu();
    },
  });
  new CreditsScreen();
  new LeaderboardScreen();
  new AchievementsScreen();
  new SaveLoadScreen({
    getSlots: () => game.saves.listSlots(),
    onLoad: (slot) => game.loadSlot(slot),
    onSave: (slot) => game.saves.save(slot, 'manual'),
  });
  new NoteReader(() => game.resume());
  new DialogueBox(() => game.resume());
  new ObjectivesScreen();

  // -- boot the engine ----------------------------------------------------
  try {
    await game.init();
  } catch (err) {
    console.error('[Boot] fatal', err);
    loading.setProgress(1, 'Something went wrong — check the console.');
  }

  // Expose for debugging in dev
  if (import.meta.env?.DEV) window.__game = game;
}

boot();
