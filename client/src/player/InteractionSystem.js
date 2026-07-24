/**
 * InteractionSystem — raycast-based interaction with world objects.
 *
 * Any mesh with userData.interactable = { label, onInteract, ... } can be
 * targeted. Supports: pick up, inspect (rotate in front of camera),
 * throw, doors, levers, notes, puzzle props.
 */
import * as THREE from 'three';
import { PLAYER } from '../config/constants.js';
import { bus, Events } from '../core/EventBus.js';

export class InteractionSystem {
  /**
   * @param {import('../core/Engine.js').Engine} engine
   * @param {import('../core/PhysicsWorld.js').PhysicsWorld} physics
   */
  constructor(engine, physics) {
    this.engine = engine;
    this.physics = physics;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = PLAYER.INTERACT_DISTANCE;
    this.enabled = false;

    /** @type {THREE.Object3D|null} currently looked-at interactable */
    this.target = null;
    /** @type {THREE.Object3D|null} item held in inspect mode */
    this.inspecting = null;
    this.inspectRotation = { x: 0, y: 0 };
    /** @type {Set<THREE.Object3D>} registered interactable roots */
    this.interactables = new Set();

    document.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.code === 'KeyE') this.interact();
      if (e.code === 'KeyF') this.throwHeld();
      if (e.code === 'KeyR' && this.inspecting) this.resetInspectRotation();
    });
    document.addEventListener('mousemove', (e) => {
      if (this.inspecting && document.pointerLockElement) {
        this.inspectRotation.y += e.movementX * 0.005;
        this.inspectRotation.x += e.movementY * 0.005;
      }
    });
  }

  register(object) {
    this.interactables.add(object);
  }

  unregister(object) {
    this.interactables.delete(object);
    if (this.target === object) {
      this.target = null;
      bus.emit(Events.LOOK_TARGET, null);
    }
  }

  clear() {
    this.interactables.clear();
    this.target = null;
    this.inspecting = null;
    bus.emit(Events.LOOK_TARGET, null);
  }

  update(dt) {
    if (!this.enabled) return;

    // Inspect mode: keep object floating before the camera
    if (this.inspecting) {
      const cam = this.engine.camera;
      const anchor = new THREE.Vector3(0, -0.05, -0.55).applyQuaternion(cam.quaternion).add(cam.position);
      this.inspecting.position.lerp(anchor, 1 - Math.exp(-14 * dt));
      this.inspecting.rotation.x = this.inspectRotation.x;
      this.inspecting.rotation.y = this.inspectRotation.y;
      return;
    }

    // Raycast from screen center — with aim assist: if the exact center
    // misses, sample a small ring around it so small props (keys, notes,
    // batteries) are easy to target.
    const candidates = [...this.interactables];
    let found = this.castAt(0, 0, candidates);
    if (!found) {
      const r = 0.08; // NDC assist radius
      for (const [ox, oy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r * 0.7, r * 0.7], [-r * 0.7, -r * 0.7]]) {
        found = this.castAt(ox, oy, candidates);
        if (found) break;
      }
    }

    if (found !== this.target) {
      this.target = found;
      bus.emit(Events.LOOK_TARGET, found ? found.userData.interactable : null);
    }
  }

  /** Single raycast at an NDC offset; returns the interactable root or null. */
  castAt(x, y, candidates) {
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.engine.camera);
    const hits = this.raycaster.intersectObjects(candidates, true);
    for (const hit of hits) {
      let obj = hit.object;
      while (obj && !obj.userData.interactable) obj = obj.parent;
      if (obj?.userData.interactable) return obj;
    }
    return null;
  }

  interact() {
    // Close inspect mode
    if (this.inspecting) {
      this.stopInspect();
      return;
    }
    if (!this.target) return;
    const meta = this.target.userData.interactable;
    bus.emit(Events.PLAYER_INTERACT, { object: this.target, meta });
    meta.onInteract?.(this.target, this);
  }

  /** Begin rotating an object in front of the camera. */
  startInspect(object) {
    this.inspecting = object;
    this.inspectRotation = { x: 0, y: 0 };
    object.userData.preInspect = {
      position: object.position.clone(),
      rotation: object.rotation.clone(),
      parent: object.parent,
    };
    bus.emit(Events.LOOK_TARGET, { label: 'Press E to put back · R reset · F throw' });
    bus.emit(Events.PLAY_SOUND, { name: 'pickup' });
  }

  stopInspect() {
    const obj = this.inspecting;
    if (!obj) return;
    const prev = obj.userData.preInspect;
    if (prev) {
      obj.position.copy(prev.position);
      obj.rotation.copy(prev.rotation);
    }
    this.inspecting = null;
    bus.emit(Events.LOOK_TARGET, null);
    bus.emit(Events.PLAY_SOUND, { name: 'putdown' });
  }

  /** Throw the currently inspected object with physics. */
  throwHeld() {
    const obj = this.inspecting;
    if (!obj) return;
    this.inspecting = null;

    const cam = this.engine.camera;
    const dir = new THREE.Vector3(0, 0.15, -1).applyQuaternion(cam.quaternion).normalize();

    // Give it a dynamic body if it doesn't have one
    let body = obj.userData.physicsBody;
    if (!body) {
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      body = this.physics.addDynamicBox(obj, {
        x: Math.max(0.04, size.x / 2),
        y: Math.max(0.04, size.y / 2),
        z: Math.max(0.04, size.z / 2),
      }, { mass: 1.5 });
    }
    body.setTranslation({ x: obj.position.x, y: obj.position.y, z: obj.position.z }, true);
    body.setLinvel({ x: dir.x * 7, y: dir.y * 7 + 1.5, z: dir.z * 7 }, true);
    body.setAngvel({ x: Math.random() * 4, y: Math.random() * 4, z: Math.random() * 4 }, true);

    bus.emit(Events.LOOK_TARGET, null);
    bus.emit(Events.PLAY_SOUND, { name: 'throw' });
  }
}
