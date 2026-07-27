/**
 * AudioEngine — fully procedural horror soundscape via WebAudio.
 * No audio files needed: every sound (footsteps, doors, whispers, wind,
 * thunder, heartbeat, UI) is synthesized. 3D positioning uses a
 * PannerNode graph; per-room ambience layers filtered noise + drones.
 *
 * Volumes route: master ← { music, sfx, voice } gain buses.
 */
import { bus, Events } from '../core/EventBus.js';
import { settings } from '../config/settings.js';
import { THEME_SURFACE } from '../config/constants.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.buses = {};
    this.ambienceNodes = [];
    this.heartbeatTimer = null;
    this.started = false;
    this.surface = 'stone'; // per-room footstep material

    bus.on(Events.PLAY_SOUND, ({ name, volume = 1, position = null }) =>
      this.play(name, volume, position));
    bus.on(Events.AMBIENCE_CHANGE, (theme) => {
      this.surface = THEME_SURFACE[theme] ?? 'stone';
      this.setAmbience(theme);
    });
    // Dynamic tension layer: dissonant pad that swells with haunt proximity
    bus.on('haunt:proximity', (level) => this.setTension(level));
    bus.on('settings:changed', ({ name }) => {
      if (name.endsWith('Volume') || name === 'audioMuted') this.applyVolumes();
    });

    // Auto-start audio and BGM on any initial user gesture
    const enableAudio = () => {
      this.start();
      document.removeEventListener('click', enableAudio);
      document.removeEventListener('keydown', enableAudio);
      document.removeEventListener('pointerdown', enableAudio);
    };
    document.addEventListener('click', enableAudio);
    document.addEventListener('keydown', enableAudio);
    document.addEventListener('pointerdown', enableAudio);
  }

  /** Must be called from a user gesture. */
  start() {
    if (this.started) {
      if (this.bgmAudio?.paused) this.bgmAudio.play().catch(() => {});
      return;
    }
    this.started = true;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    const master = this.ctx.createGain();
    master.connect(this.ctx.destination);
    this.buses.master = master;
    for (const busName of ['music', 'sfx', 'voice']) {
      const gain = this.ctx.createGain();
      gain.connect(master);
      this.buses[busName] = gain;
    }
    this.applyVolumes();
    this.startBGM();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const muted = settings.get('audioMuted');
    this.buses.master.gain.value = muted ? 0 : settings.get('masterVolume');
    this.buses.music.gain.value = muted ? 0 : settings.get('musicVolume');
    this.buses.sfx.gain.value = muted ? 0 : settings.get('sfxVolume');
    this.buses.voice.gain.value = muted ? 0 : settings.get('voiceVolume');
    if (this.bgmGain) {
      this.bgmGain.gain.value = muted ? 0 : settings.get('musicVolume') * 0.15;
    }
  }

  /** Convenience mute/unmute toggle — persisted via settings. */
  setMuted(muted) {
    settings.set('audioMuted', muted);
  }

  // -- synthesis helpers --------------------------------------------------

  noiseBuffer(seconds = 2) {
    const rate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, rate * seconds, rate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  envGain(attack, decay, peak = 1, when = 0) {
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime + when;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.001), t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return gain;
  }

  /** Short filtered-noise burst (steps, impacts, paper). */
  noiseBurst({ freq = 800, q = 1, attack = 0.005, decay = 0.12, peak = 0.5, type = 'bandpass', when = 0, out = 'sfx' }) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.5);
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const env = this.envGain(attack, decay, peak, when);
    src.connect(filter).connect(env).connect(this.buses[out]);
    src.start(this.ctx.currentTime + when);
    src.stop(this.ctx.currentTime + when + attack + decay + 0.1);
  }

  /** Tonal blip/drone. */
  tone({ freq = 220, type = 'sine', attack = 0.01, decay = 0.3, peak = 0.3, slideTo = null, when = 0, out = 'sfx', loop = false }) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(
        slideTo, this.ctx.currentTime + when + attack + decay);
    }
    const env = this.envGain(attack, decay, peak, when);
    osc.connect(env).connect(this.buses[out]);
    if (loop) osc.loop = true;
    osc.start(this.ctx.currentTime + when);
    osc.stop(this.ctx.currentTime + when + attack + decay + 0.1);
    return { osc, env };
  }

  // -- sound effects ------------------------------------------------------

  play(name, volume = 1) {
    if (!this.ctx) return;
    const v = volume;
    switch (name) {
      case 'footstep': {
        // Per-surface synthesis: wood knocks, stone scuffs, tile clicks,
        // metal rings faintly.
        const surfaces = {
          wood: { freq: 140 + Math.random() * 80, q: 1.1, decay: 0.11, peak: 0.26, knock: 90 },
          stone: { freq: 220 + Math.random() * 120, q: 1.6, decay: 0.09, peak: 0.24, knock: 0 },
          tile: { freq: 900 + Math.random() * 400, q: 2.4, decay: 0.06, peak: 0.18, knock: 0 },
          metal: { freq: 320 + Math.random() * 90, q: 4, decay: 0.16, peak: 0.2, knock: 0, ring: 480 },
        };
        const s = surfaces[this.surface] ?? surfaces.stone;
        this.noiseBurst({ freq: s.freq, q: s.q, decay: s.decay, peak: s.peak * v });
        if (s.knock) this.tone({ freq: s.knock, type: 'sine', decay: 0.07, peak: 0.1 * v });
        if (s.ring) this.tone({ freq: s.ring + Math.random() * 60, type: 'sine', decay: 0.22, peak: 0.03 * v });
        break;
      }
      case 'land':
        this.noiseBurst({ freq: 150, q: 1, decay: 0.16, peak: 0.35 * v });
        this.tone({ freq: 60, type: 'sine', decay: 0.18, peak: 0.25 * v });
        break;
      case 'flashlight_click':
        this.noiseBurst({ freq: 2600, q: 4, attack: 0.001, decay: 0.03, peak: 0.22 * v });
        this.tone({ freq: 1200, type: 'square', decay: 0.02, peak: 0.05 * v });
        break;
      case 'flashlight_flicker':
        this.noiseBurst({ freq: 3400, q: 6, attack: 0.001, decay: 0.02, peak: 0.05 * v });
        break;
      case 'flashlight_dead':
        this.tone({ freq: 620, type: 'square', decay: 0.05, peak: 0.08 * v });
        this.tone({ freq: 240, type: 'square', decay: 0.12, peak: 0.06 * v, when: 0.07 });
        break;
      case 'battery':
        this.tone({ freq: 660, type: 'triangle', decay: 0.12, peak: 0.14 * v, slideTo: 990 });
        break;
      case 'scare': {
        // dissonant sting: detuned saws + rumble, short and violent
        for (const f of [190, 197, 288]) {
          this.tone({ freq: f, type: 'sawtooth', attack: 0.01, decay: 0.9, peak: 0.16 * v, out: 'voice' });
        }
        this.noiseBurst({ freq: 90, q: 0.8, attack: 0.01, decay: 1.1, peak: 0.4 * v, type: 'lowpass' });
        break;
      }
      case 'manifest':
        // reversed-feeling swell: rising filtered noise + minor-second dyad
        this.noiseBurst({ freq: 600, q: 0.6, attack: 1.4, decay: 0.4, peak: 0.12 * v, type: 'bandpass', out: 'voice' });
        this.tone({ freq: 220, type: 'sine', attack: 1.2, decay: 0.8, peak: 0.07 * v, out: 'voice' });
        this.tone({ freq: 233, type: 'sine', attack: 1.2, decay: 0.8, peak: 0.07 * v, out: 'voice' });
        break;
      case 'camera_shutter':
        this.noiseBurst({ freq: 3000, q: 3, attack: 0.001, decay: 0.04, peak: 0.2 * v });
        this.noiseBurst({ freq: 1800, q: 2, attack: 0.001, decay: 0.05, peak: 0.12 * v, when: 0.06 });
        break;
      case 'jump':
        this.noiseBurst({ freq: 300, decay: 0.15, peak: 0.2 * v });
        break;
      case 'ui_click':
        this.tone({ freq: 640, type: 'triangle', decay: 0.06, peak: 0.12 * v });
        break;
      case 'keypad':
        this.tone({ freq: 880 + Math.random() * 220, type: 'square', decay: 0.05, peak: 0.07 * v });
        break;
      case 'pickup':
        this.tone({ freq: 520, type: 'triangle', decay: 0.18, peak: 0.16 * v, slideTo: 760 });
        break;
      case 'putdown':
      case 'throw':
        this.noiseBurst({ freq: 420, decay: 0.1, peak: 0.18 * v });
        break;
      case 'paper':
        this.noiseBurst({ freq: 2400, q: 0.6, decay: 0.22, peak: 0.14 * v, type: 'highpass' });
        break;
      case 'locked':
        this.noiseBurst({ freq: 240, q: 3, decay: 0.16, peak: 0.3 * v });
        this.tone({ freq: 110, type: 'square', decay: 0.14, peak: 0.1 * v, when: 0.05 });
        break;
      case 'unlock':
        this.tone({ freq: 330, type: 'triangle', decay: 0.1, peak: 0.2 * v });
        this.noiseBurst({ freq: 900, decay: 0.2, peak: 0.2 * v, when: 0.12 });
        this.tone({ freq: 494, type: 'triangle', decay: 0.4, peak: 0.16 * v, when: 0.2 });
        break;
      case 'door_open': {
        // long creak: detuned saw sweep + noise
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(90, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 1.6);
        const env = this.envGain(0.2, 1.8, 0.07 * v);
        osc.connect(env).connect(this.buses.sfx);
        osc.start(); osc.stop(this.ctx.currentTime + 2.2);
        this.noiseBurst({ freq: 160, decay: 1.2, peak: 0.1 * v, q: 2 });
        break;
      }
      case 'lever':
        this.noiseBurst({ freq: 320, q: 2, decay: 0.3, peak: 0.3 * v });
        this.tone({ freq: 82, type: 'square', decay: 0.5, peak: 0.14 * v, when: 0.15 });
        break;
      case 'success':
        for (let i = 0; i < 3; i++) {
          this.tone({ freq: 392 * Math.pow(1.26, i), type: 'sine', decay: 0.5, peak: 0.14 * v, when: i * 0.12, out: 'music' });
        }
        break;
      case 'error':
        this.tone({ freq: 138, type: 'sawtooth', decay: 0.3, peak: 0.16 * v });
        this.tone({ freq: 130, type: 'sawtooth', decay: 0.35, peak: 0.14 * v, when: 0.04 });
        break;
      case 'whisper':
        // breathy filtered noise sweep
        this.noiseBurst({ freq: 3200, q: 0.4, attack: 0.3, decay: 1.1, peak: 0.05 * v, type: 'bandpass', out: 'voice' });
        this.noiseBurst({ freq: 1800, q: 0.5, attack: 0.5, decay: 0.9, peak: 0.04 * v, when: 0.4, out: 'voice' });
        break;
      case 'thunder': {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer(3);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 2.6);
        const env = this.envGain(0.04, 2.8, 0.5 * v);
        src.connect(filter).connect(env).connect(this.buses.sfx);
        src.start();
        src.stop(this.ctx.currentTime + 3);
        break;
      }
      case 'heartbeat':
        this.tone({ freq: 55, type: 'sine', decay: 0.16, peak: 0.5 * v });
        this.tone({ freq: 48, type: 'sine', decay: 0.14, peak: 0.35 * v, when: 0.28 });
        break;
      default:
        this.tone({ freq: 440, decay: 0.1, peak: 0.08 * v });
    }
  }

  // -- ambience -------------------------------------------------------
  /**
   * BGM — Official Escape Room Soundtrack ("bgm.mp4").
   * Routes through WebAudio music gain bus with loop and volume controls.
   */
  startBGM() {
    if (this.bgmAudio) {
      if (this.bgmAudio.paused) {
        this.bgmAudio.play().catch((err) => {
          console.warn('[AudioEngine] BGM resume waiting for gesture:', err);
        });
      }
      return;
    }

    const audio = new Audio('/soundtrack.mp4');
    audio.loop = true;
    audio.crossOrigin = 'anonymous';

    if (this.ctx) {
      try {
        const source = this.ctx.createMediaElementSource(audio);
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = settings.get('musicVolume') * 0.45;
        source.connect(this.bgmGain);
        this.bgmGain.connect(this.buses.music);
      } catch (err) {
        console.warn('[AudioEngine] MediaElementSource fallback:', err);
      }
    }

    audio.play().catch((err) => {
      console.warn('[AudioEngine] Autoplay waiting for gesture:', err);
    });

    this.bgmAudio = audio;

    // Listen for music volume changes
    this._bgmVolHandler = bus.on('settings:changed', ({ name }) => {
      if (name === 'musicVolume' || name === 'masterVolume' || name === 'audioMuted') {
        if (this.bgmGain) {
          const muted = settings.get('audioMuted');
          this.bgmGain.gain.value = muted ? 0 : settings.get('musicVolume') * 0.45;
        }
      }
    });
  }

  stopBGM() {
    if (this._bgmVolHandler) {
      this._bgmVolHandler();
      this._bgmVolHandler = null;
    }
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio = null;
    }
    if (this.bgmGain) {
      try { this.bgmGain.disconnect(); } catch { /* */ }
      this.bgmGain = null;
    }
  }

  /**
   * Tension pad: two detuned oscillators a tritone apart whose gain follows
   * the presence's proximity. Created lazily, reused across rooms.
   */
  setTension(level) {
    // Disabled: Only soundtrack.mp4 plays in background per design
  }

  stopAmbience() {
    for (const node of this.ambienceNodes) {
      try { node.stop ? node.stop() : node.disconnect(); } catch { /* already stopped */ }
    }
    this.ambienceNodes = [];
    clearInterval(this.heartbeatTimer);
  }

  /**
   * Only soundtrack.mp4 plays in background — procedural synth drones disabled.
   */
  setAmbience(theme) {
    if (!this.ctx) return;
    this.stopAmbience();
  }
}
