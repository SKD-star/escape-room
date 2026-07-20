/**
 * Engine — owns the WebGL renderer, scene graph, camera, postprocessing
 * chain and the frame loop. Quality presets rebuild the composer live.
 *
 * Rendering features:
 *  - ACES filmic tone mapping + physically correct lights (PBR)
 *  - Bloom (UnrealBloom-style selective), SSAO (N8AO-quality via
 *    postprocessing's SSAO), depth of field, chromatic aberration,
 *    vignette, film grain, color grading via HueSaturation/BrightnessContrast
 *  - Procedural environment map for reflections (PMREM)
 */
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {
  BlendFunction, BloomEffect, BrightnessContrastEffect,
  ChromaticAberrationEffect, DepthOfFieldEffect, EffectComposer, EffectPass,
  FXAAEffect, HueSaturationEffect, NoiseEffect, RenderPass, SSAOEffect,
  VignetteEffect,
} from 'postprocessing';
import { QUALITY_PRESETS } from '../config/constants.js';
import { settings } from '../config/settings.js';
import { bus, Events } from './EventBus.js';

export class Engine {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.quality = QUALITY_PRESETS[settings.get('quality')] ?? QUALITY_PRESETS.high;
    RectAreaLightUniformsLib.init(); // required for RectAreaLight (lab fluorescents)

    // -- renderer ---------------------------------------------------------
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      powerPreference: 'high-performance',
      antialias: false, // FXAA in the composer instead
      stencil: false,
      depth: true,
    });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = settings.get('brightness');
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = this.quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // -- scene & camera ---------------------------------------------------
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050508);
    this.camera = new THREE.PerspectiveCamera(
      settings.get('fov'), window.innerWidth / window.innerHeight, 0.05, 120,
    );
    this.camera.position.set(0, 1.7, 0);
    this.scene.add(this.camera);

    // -- environment reflections (procedural studio-less env) -------------
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.setEnvironment(0x0a0a12, 0x1a1626, 0.35);

    // -- postprocessing ---------------------------------------------------
    this.composer = null;
    this.buildComposer();

    // -- loop bookkeeping -------------------------------------------------
    this.clock = new THREE.Clock();
    this.running = false;
    this.updatables = new Set();
    this.fpsFrames = 0;
    this.fpsTime = 0;

    // -- events -----------------------------------------------------------
    window.addEventListener('resize', () => this.onResize());
    bus.on(Events.QUALITY_CHANGED, (name) => this.setQuality(name));
    bus.on('settings:changed', ({ name, value }) => {
      if (name === 'fov') { this.camera.fov = value; this.camera.updateProjectionMatrix(); }
      if (name === 'brightness') this.renderer.toneMappingExposure = value;
    });
    this.onResize();
  }

  /** Procedural gradient environment for PBR reflections. */
  setEnvironment(bottomColor, topColor, intensity = 0.4) {
    const envScene = new THREE.Scene();
    const gradient = new THREE.Mesh(
      new THREE.SphereGeometry(50, 16, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
          top: { value: new THREE.Color(topColor) },
          bottom: { value: new THREE.Color(bottomColor) },
        },
        vertexShader: /* glsl */ `
          varying vec3 vPos;
          void main() {
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 top; uniform vec3 bottom; varying vec3 vPos;
          void main() {
            float h = normalize(vPos).y * 0.5 + 0.5;
            gl_FragColor = vec4(mix(bottom, top, h), 1.0);
          }`,
      }),
    );
    envScene.add(gradient);
    const envMap = this.pmrem.fromScene(envScene, 0.04).texture;
    this.scene.environment = envMap;
    this.scene.environmentIntensity = intensity;
    gradient.geometry.dispose();
    gradient.material.dispose();
  }

  buildComposer() {
    this.composer?.dispose();
    const q = this.quality;

    this.composer = new EffectComposer(this.renderer, {
      frameBufferType: THREE.HalfFloatType, // HDR pipeline
      multisampling: 0,
    });
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    const effects = [];

    if (q.ssao) {
      this.ssao = new SSAOEffect(this.camera, null, {
        blendFunction: BlendFunction.MULTIPLY,
        samples: 16,
        rings: 4,
        radius: 0.14,
        intensity: 2.2,
        luminanceInfluence: 0.6,
        bias: 0.02,
        distanceScaling: true,
      });
      effects.push(this.ssao);
    }

    if (q.bloom) {
      this.bloom = new BloomEffect({
        intensity: 0.85,
        luminanceThreshold: 0.72,
        luminanceSmoothing: 0.25,
        mipmapBlur: true,
        radius: 0.7,
      });
      effects.push(this.bloom);
    }

    if (q.dof) {
      this.dof = new DepthOfFieldEffect(this.camera, {
        focusDistance: 0.02,
        focalLength: 0.06,
        bokehScale: 2.2,
      });
      effects.push(this.dof);
    }

    // Horror color grade: slight desaturation, lifted contrast, cold hue
    effects.push(new HueSaturationEffect({ saturation: -0.14, hue: 0.0 }));
    effects.push(new BrightnessContrastEffect({ brightness: -0.02, contrast: 0.08 }));
    effects.push(new ChromaticAberrationEffect({
      offset: new THREE.Vector2(0.0006, 0.0006),
      radialModulation: true,
      modulationOffset: 0.4,
    }));
    if (q.filmGrain) {
      const noise = new NoiseEffect({ blendFunction: BlendFunction.COLOR_DODGE });
      noise.blendMode.opacity.value = 0.045;
      effects.push(noise);
    }
    effects.push(new VignetteEffect({ darkness: 0.62, offset: 0.28 }));
    effects.push(new FXAAEffect());

    // postprocessing merges consecutive effects into single shader passes
    this.composer.addPass(new EffectPass(this.camera, ...effects));
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  setQuality(name) {
    this.quality = QUALITY_PRESETS[name] ?? QUALITY_PRESETS.high;
    this.renderer.shadowMap.enabled = this.quality.shadows;
    // Force material recompile for shadow toggle
    this.scene.traverse((obj) => { if (obj.material) obj.material.needsUpdate = true; });
    this.buildComposer();
    this.onResize();
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * this.quality.pixelRatio);
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  /** @param {{update: (dt: number, elapsed: number) => void}} system */
  addSystem(system) { this.updatables.add(system); }
  removeSystem(system) { this.updatables.delete(system); }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  stop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  tick() {
    const dt = Math.min(this.clock.getDelta(), 1 / 20); // clamp spiral of death
    const elapsed = this.clock.elapsedTime;

    for (const system of this.updatables) system.update(dt, elapsed);
    bus.emit(Events.FRAME, { dt, elapsed });

    this.composer.render(dt);

    // FPS sampling (published once a second)
    this.fpsFrames += 1;
    this.fpsTime += dt;
    if (this.fpsTime >= 1) {
      bus.emit('engine:fps', Math.round(this.fpsFrames / this.fpsTime));
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
  }

  /** Dispose an object tree (geometry, materials, textures). */
  static dispose(root) {
    root.traverse((obj) => {
      obj.geometry?.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        if (!mat) continue;
        for (const key of Object.keys(mat)) {
          if (mat[key]?.isTexture) mat[key].dispose();
        }
        mat.dispose?.();
      }
    });
  }
}
