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

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.buses = {};
    this.ambienceNodes = [];
    this.heartbeatTimer = null;
    this.started = false;

    bus.on(Events.PLAY_SOUND, ({ name, volume = 1, position = null }) =>
      this.play(name, volume, position));
    bus.on(Events.AMBIENCE_CHANGE, (theme) => this.setAmbience(theme));
    bus.on('settings:changed', ({ name }) => {
      if (name.endsWith('Volume')) this.applyVolumes();
    });
  }

  /** Must be called from a user gesture. */
  start() {
    if (this.started) return;
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
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.buses.master.gain.value = settings.get('masterVolume');
    this.buses.music.gain.value = settings.get('musicVolume');
    this.buses.sfx.gain.value = settings.get('sfxVolume');
    this.buses.voice.gain.value = settings.get('voiceVolume');
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
  tone({ freq = 220, type = 'sine', attack = 0.01, decay = 0.3, peak = 0.3, slideTo = null, when = 0, out = 'sfx' }) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(
        slideTo, this.ctx.currentTime + when + attack + decay);
    }
    const env = this.envGain(attack, decay, peak, when);
    osc.connect(env).connect(this.buses[out]);
    osc.start(this.ctx.currentTime + when);
    osc.stop(this.ctx.currentTime + when + attack + decay + 0.1);
  }

  // -- sound effects ------------------------------------------------------

  play(name, volume = 1) {
    if (!this.ctx) return;
    const v = volume;
    switch (name) {
      case 'footstep':
        this.noiseBurst({ freq: 180 + Math.random() * 120, q: 1.4, decay: 0.09, peak: 0.24 * v });
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

  // -- ambience -----------------------------------------------------------

  stopAmbience() {
    for (const node of this.ambienceNodes) {
      try { node.stop ? node.stop() : node.disconnect(); } catch { /* already stopped */ }
    }
    this.ambienceNodes = [];
    clearInterval(this.heartbeatTimer);
  }

  /**
   * Layered ambience per room theme:
   *  - low drone (two detuned oscillators through lowpass)
   *  - wind (filtered noise with slow LFO on filter freq)
   *  - occasional heartbeat under high-tension themes
   */
  setAmbience(theme) {
    if (!this.ctx) return;
    this.stopAmbience();

    const themes = {
      library:  { drone: 55,  wind: 500,  tension: 0.2 },
      temple:   { drone: 49,  wind: 380,  tension: 0.3 },
      prison:   { drone: 41,  wind: 620,  tension: 0.45 },
      laboratory:{ drone: 62, wind: 900,  tension: 0.4 },
      hospital: { drone: 44,  wind: 700,  tension: 0.55 },
      mansion:  { drone: 52,  wind: 420,  tension: 0.4 },
      castle:   { drone: 46,  wind: 340,  tension: 0.35 },
      bunker:   { drone: 38,  wind: 1100, tension: 0.6 },
      cyber:    { drone: 70,  wind: 1600, tension: 0.5 },
      boss:     { drone: 33,  wind: 260,  tension: 0.85 },
    };
    const cfg = themes[theme] ?? themes.library;

    // drone
    for (const detune of [0, 3.2]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = cfg.drone + detune;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 160;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.0001;
      gain.gain.exponentialRampToValueAtTime(0.05, this.ctx.currentTime + 4);
      osc.connect(filter).connect(gain).connect(this.buses.music);
      osc.start();
      this.ambienceNodes.push(osc, gain);
    }

    // wind
    const wind = this.ctx.createBufferSource();
    wind.buffer = this.noiseBuffer(4);
    wind.loop = true;
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = cfg.wind;
    windFilter.Q.value = 0.5;
    const windGain = this.ctx.createGain();
    windGain.gain.value = 0.0001;
    windGain.gain.exponentialRampToValueAtTime(0.03, this.ctx.currentTime + 6);
    // LFO modulating the wind filter
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = cfg.wind * 0.4;
    lfo.connect(lfoGain).connect(windFilter.frequency);
    lfo.start();
    wind.connect(windFilter).connect(windGain).connect(this.buses.music);
    wind.start();
    this.ambienceNodes.push(wind, lfo, windGain);

    // heartbeat under tension
    if (cfg.tension > 0.5) {
      this.heartbeatTimer = setInterval(() => {
        this.play('heartbeat', cfg.tension * 0.7);
      }, 1400 - cfg.tension * 500);
    }
  }
}
