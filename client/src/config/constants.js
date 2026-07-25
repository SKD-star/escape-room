/**
 * Game constants + quality presets + room registry metadata.
 */

export const GAME_VERSION = '1.0.0';

/**
 * Difficulty modes — multipliers over the base tuning constants.
 * Chosen at New Game; persisted in the save state.
 */
/**
 * `countdown` drives the per-room LevelTimer:
 *   - null            → no countdown at all (relaxed).
 *   - { mult, harsh } → limit = room.par × mult. When it hits zero the run
 *                       enters "overtime": harsh modes drain sanity fast and
 *                       summon the presence; lenient modes only nag.
 * Harder modes get a tighter multiplier AND a crueler overtime — that is the
 * "different timer in a harder level".
 */
export const DIFFICULTY_MODES = {
  story: {
    label: 'Story',
    blurb: 'For the puzzles and the lore. The presence stays dormant, sanity is gentle, batteries last. No clock.',
    sanityDrain: 0.4, hauntRate: 0,   batteryDrain: 0.5, puzzleBias: -0.15, scoreMult: 0.75,
    countdown: null,
  },
  normal: {
    label: 'Normal',
    blurb: 'The intended experience. The dark is patient, but it is not idle. A generous room clock keeps you moving.',
    sanityDrain: 1,   hauntRate: 1,   batteryDrain: 1,   puzzleBias: 0,     scoreMult: 1,
    countdown: { mult: 1.5, harsh: false, overtimeDrain: 1 },
  },
  nightmare: {
    label: 'Nightmare',
    blurb: 'It manifests often, the beam gutters fast, and your grip slips quickly. The room clock is a hard deadline — run it out and the room restarts. Full score bonus.',
    sanityDrain: 1.6, hauntRate: 1.8, batteryDrain: 1.7, puzzleBias: 0.2,   scoreMult: 1.5,
    countdown: { mult: 0.85, harsh: true, overtimeDrain: 3, failOnTimeout: true },
  },
};

export const PLAYER = {
  HEIGHT: 1.75,
  CROUCH_HEIGHT: 0.95,
  RADIUS: 0.35,
  WALK_SPEED: 3.2,
  RUN_SPEED: 5.6,
  CROUCH_SPEED: 1.6,
  JUMP_VELOCITY: 5.2,
  MOUSE_SENSITIVITY: 0.0022,
  INTERACT_DISTANCE: 3.4,
  STAMINA_MAX: 100,
  STAMINA_DRAIN: 22,     // per second while sprinting
  STAMINA_REGEN: 14,     // per second at rest
};

export const FLASHLIGHT = {
  BATTERY_MAX: 100,
  ROOM_REFILL: 60,       // charge floor granted at each room entrance
  DRAIN: 1.6,            // per second while on (~62s of continuous light)
  INTENSITY: 24,         // balanced: bright reach without washing out near walls
  RANGE: 22,
  ANGLE: Math.PI / 5,
  SWAY_SPEED: 9,         // how fast the beam catches up to the eyes
};

export const SANITY = {
  MAX: 100,
  DRAIN_DARK: 1.1,       // per second unlit with the light off
  DRAIN_HAUNT: 4.5,      // per second scaled by haunt proximity
  RECOVER_LIT: 2.2,      // per second in light
  RESTORE_PUZZLE: 18,
  RESTORE_ROOM: 25,
  RESTORE_SECRET: 10,
};

export const HAUNT = {
  DELAY_MIN: 35,         // seconds between manifestations (deep run)
  DELAY_MAX: 100,        // (early run)
  SPEED: 0.85,           // drift speed toward the player, m/s
  OPACITY: 0.55,
  BANISH_SECONDS: 2.2,   // beam-on-target time to dissolve it
  TOUCH_DISTANCE: 1.1,
  TOUCH_SANITY_COST: 22,
  FEAR_RADIUS: 8,        // proximity effects ramp inside this radius
};

/** Footstep surface per room theme — drives procedural footstep synthesis. */
export const THEME_SURFACE = {
  library: 'wood',
  temple: 'stone',
  prison: 'stone',
  laboratory: 'tile',
  hospital: 'tile',
  mansion: 'wood',
  castle: 'stone',
  bunker: 'metal',
  cyber: 'metal',
  boss: 'stone',
};

export const QUALITY_PRESETS = {
  low: {
    label: 'Low',
    pixelRatio: 0.75,
    shadows: false,
    shadowMapSize: 512,
    bloom: true,
    ssao: false,
    dof: false,
    filmGrain: false,
    volumetricFog: false,
    particleScale: 0.35,
    maxLights: 4,
    anisotropy: 1,
  },
  medium: {
    label: 'Medium',
    pixelRatio: 1,
    shadows: true,
    shadowMapSize: 1024,
    bloom: true,
    ssao: false,
    dof: false,
    filmGrain: true,
    volumetricFog: true,
    particleScale: 0.65,
    maxLights: 6,
    anisotropy: 2,
  },
  high: {
    label: 'High',
    pixelRatio: 1,
    shadows: true,
    shadowMapSize: 2048,
    bloom: true,
    ssao: true,
    dof: false,          // DOF off by default — it blurs the whole view
    filmGrain: true,
    volumetricFog: true,
    particleScale: 1,
    maxLights: 8,
    anisotropy: 4,
  },
  ultra: {
    label: 'Ultra',
    pixelRatio: Math.min(window.devicePixelRatio, 2),
    shadows: true,
    shadowMapSize: 2048,
    bloom: true,
    ssao: true,
    dof: false,
    filmGrain: true,
    volumetricFog: true,
    particleScale: 1.4,
    maxLights: 12,
    anisotropy: 8,
  },
};

/**
 * Ordered room progression. Theme keys must match server RoomMeta.
 * Per room:
 *   par   — target solve time in seconds; the LevelTimer's countdown is
 *           par × the difficulty's countdown.mult. Climbs with complexity.
 *   brief — spoiler-light "how this level works", shown on entry + in the manual.
 *   tip   — one concrete nudge toward the puzzle, no answer given.
 */
export const ROOMS = [
  {
    key: 'haunted_library', name: 'The Haunted Library', theme: 'library', chapter: 'Chapter I', par: 210,
    brief: 'A reading room where the books remember more than you do. The lock wants something written on the shelves.',
    tip: 'Read every note and spine — the clue is in the words, not behind them.',
  },
  {
    key: 'ancient_temple', name: 'The Ancient Temple', theme: 'temple', chapter: 'Chapter II', par: 225,
    brief: 'A place of ritual. The carvings were meant to be obeyed in a particular order.',
    tip: 'Find where the sequence starts, then follow the symbols the walls give you.',
  },
  {
    key: 'prison', name: 'The Forgotten Prison', theme: 'prison', chapter: 'Chapter III', par: 240,
    brief: 'Cells, tallies, and a warden who counted everything. Numbers are scratched into the stone for a reason.',
    tip: 'Count what the prisoners left behind — the records add up to a code.',
  },
  {
    key: 'laboratory', name: 'The Abandoned Laboratory', theme: 'laboratory', chapter: 'Chapter IV', par: 255,
    brief: 'An experiment that outlived its makers. The lab kept meticulous logs before the end.',
    tip: 'Each log pairs a label to a value — line them up to read the answer.',
  },
  {
    key: 'hospital', name: 'The Abandoned Hospital', theme: 'hospital', chapter: 'Chapter V', par: 270,
    brief: 'Wards, charts, and one patient whose file was never closed. The digits you need are on the paperwork.',
    tip: 'Cross-reference the charts and tags — a room or patient number is the key.',
  },
  {
    key: 'mansion', name: 'The Haunted Mansion', theme: 'mansion', chapter: 'Chapter VI', par: 285,
    brief: 'A family home with a secret it never spoke aloud. The portraits are watching, and telling.',
    tip: 'Trace the family through the portraits — a name or date unlocks the way.',
  },
  {
    key: 'castle', name: 'The Medieval Castle', theme: 'castle', chapter: 'Chapter VII', par: 300,
    brief: 'Stone halls hung with heraldry. The banners were raised in an order that once meant something.',
    tip: 'The crests and banners fall in a set order — restore it.',
  },
  {
    key: 'bunker', name: 'The Secret Bunker', theme: 'bunker', chapter: 'Chapter VIII', par: 315,
    brief: 'A cold-war hideout sealed from the inside. Its keepers trusted dials and logbooks over memory.',
    tip: 'The logbooks and dials point at the same code — read them together.',
  },
  {
    key: 'cyber_facility', name: 'The Cyber AI Facility', theme: 'cyber', chapter: 'Chapter IX', par: 330,
    brief: 'The birthplace of the intelligence that trapped you. The terminals still answer — if you ask well.',
    tip: 'Talk to the machine and read its logs; it leaks more than it means to.',
  },
  {
    key: 'boss_room', name: 'The Final Convergence', theme: 'boss', chapter: 'Finale', par: 360,
    brief: 'Everything folds together here. The finale asks you to remember every room that came before.',
    tip: 'Recall what solved the earlier rooms — the convergence echoes them all.',
  },
];

export const LOADING_TIPS = [
  'The candles burn in a specific order. Someone is watching which ones you notice.',
  'Not every locked door needs a key. Some need an apology.',
  'If the whispers get louder, you are getting closer. Or it is.',
  'Items can be combined. The dead left instructions — read everything.',
  'Sprinting drains stamina. Fear drains it faster.',
  'The spirits answer questions. Choose your words carefully.',
  'Secret rooms hide behind the walls that sound different.',
  'Your choices echo. There is more than one way out — and more than one ending.',
];

export const DEFAULT_SETTINGS = {
  // audio
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 0.9,
  voiceVolume: 0.8,
  audioMuted: false,     // global mute toggle
  // video
  quality: 'high',
  fov: 75,
  brightness: 1.0,
  motionBlur: false,
  showFps: false,
  // controls
  mouseSensitivity: 1.0,
  invertY: false,
  headBob: true,
  // gameplay
  subtitles: true,
  hints: true,
  sanityFx: true,        // sanity-driven visual/audio distortion
  hauntEnabled: true,    // the stalking presence
  soundCaptions: false,  // accessibility: caption world sounds
  showCompass: true,     // HUD compass tape
  showTimer: false,      // speedrun timer + splits
  countdownTimer: false, // per-room difficulty countdown (disabled — using attempts system)
  gamepad: true,         // poll connected gamepads
};
