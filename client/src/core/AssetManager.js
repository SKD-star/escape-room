/**
 * AssetManager — GLTF/GLB (with Draco), HDR and texture loading with
 * progress reporting, caching and graceful failure. The game generates
 * its world procedurally, but any GLB dropped into /assets/models is
 * loadable through here for easy visual upgrades.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

export class AssetManager {
  constructor() {
    this.manager = new THREE.LoadingManager();
    this.cache = new Map();

    this.gltfLoader = new GLTFLoader(this.manager);
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    this.gltfLoader.setDRACOLoader(draco);

    this.textureLoader = new THREE.TextureLoader(this.manager);
    this.rgbeLoader = new RGBELoader(this.manager);

    /** @type {(ratio: number, url: string) => void} */
    this.onProgress = null;
    this.manager.onProgress = (url, loaded, total) => {
      this.onProgress?.(total ? loaded / total : 1, url);
    };
  }

  /**
   * Load a GLB/GLTF model. Returns the scene root (cloned from cache).
   * @param {string} url
   * @returns {Promise<THREE.Group|null>}
   */
  async loadModel(url) {
    if (this.cache.has(url)) return this.cache.get(url).scene.clone(true);
    try {
      const gltf = await this.gltfLoader.loadAsync(url);
      gltf.scene.traverse((obj) => {
        if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; }
      });
      this.cache.set(url, gltf);
      return gltf.scene.clone(true);
    } catch (err) {
      console.warn(`[Assets] failed to load model ${url}`, err);
      return null;
    }
  }

  /** @returns {Promise<THREE.Texture|null>} */
  async loadTexture(url, { srgb = true, repeat = 1 } = {}) {
    const key = `tex:${url}`;
    if (this.cache.has(key)) return this.cache.get(key);
    try {
      const tex = await this.textureLoader.loadAsync(url);
      if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeat, repeat);
      this.cache.set(key, tex);
      return tex;
    } catch {
      console.warn(`[Assets] failed to load texture ${url}`);
      return null;
    }
  }

  /** Load an equirect HDR for environment lighting. */
  async loadHDR(url) {
    const key = `hdr:${url}`;
    if (this.cache.has(key)) return this.cache.get(key);
    try {
      const tex = await this.rgbeLoader.loadAsync(url);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      this.cache.set(key, tex);
      return tex;
    } catch {
      console.warn(`[Assets] failed to load HDR ${url}`);
      return null;
    }
  }

  clear() {
    for (const [, value] of this.cache) {
      if (value?.isTexture) value.dispose();
    }
    this.cache.clear();
  }
}

export const assets = new AssetManager();
