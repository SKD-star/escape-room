/**
 * Game constants + quality presets + room registry metadata.
 */

export const GAME_VERSION = '1.0.0';

export const PLAYER = {
  HEIGHT: 1.75,
  CROUCH_HEIGHT: 0.95,
  RADIUS: 0.35,
  WALK_SPEED: 3.2,
  RUN_SPEED: 5.6,
  CROUCH_SPEED: 1.6,
  JUMP_VELOCITY: 5.2,
  MOUSE_SENSITIVITY: 0.0022,
  INTERACT_DISTANCE: 2.8,
  STAMINA_MAX: 100,
  STAMINA_DRAIN: 22,     // per second while sprinting
  STAMINA_REGEN: 14,     // per second at rest
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
    dof: true,
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
    dof: true,
    filmGrain: true,
    volumetricFog: true,
    particleScale: 1.4,
    maxLights: 12,
    anisotropy: 8,
  },
};

/** Ordered room progression. Theme keys must match server RoomMeta. */
export const ROOMS = [
  { key: 'haunted_library', name: 'The Haunted Library', theme: 'library', chapter: 'Chapter I' },
  { key: 'ancient_temple', name: 'The Ancient Temple', theme: 'temple', chapter: 'Chapter II' },
  { key: 'prison', name: 'The Forgotten Prison', theme: 'prison', chapter: 'Chapter III' },
  { key: 'laboratory', name: 'The Abandoned Laboratory', theme: 'laboratory', chapter: 'Chapter IV' },
  { key: 'hospital', name: 'The Abandoned Hospital', theme: 'hospital', chapter: 'Chapter V' },
  { key: 'mansion', name: 'The Haunted Mansion', theme: 'mansion', chapter: 'Chapter VI' },
  { key: 'castle', name: 'The Medieval Castle', theme: 'castle', chapter: 'Chapter VII' },
  { key: 'bunker', name: 'The Secret Bunker', theme: 'bunker', chapter: 'Chapter VIII' },
  { key: 'cyber_facility', name: 'The Cyber AI Facility', theme: 'cyber', chapter: 'Chapter IX' },
  { key: 'boss_room', name: 'The Final Convergence', theme: 'boss', chapter: 'Finale' },
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
};
