import * as THREE from 'three';
import { PLAYER } from '../config/constants.js';
import { bus, Events } from '../core/EventBus.js';

export class InteractionSystem {
  /**
   * @param {import('../core/Engine.js').Engine} engine
   * @param {import('../core/PhysicsWorld.js').PhysicsWorld} physics
   * @param {import('./FirstPersonHands.js').FirstPersonHands} hands
   */
  constructor(engine, physics, hands = null) {
    this.engine = engine;
    this.physics = physics;
    this.hands = hands;
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
      if (e.code === 'KeyF') {
        if (this.inspecting) this.throwHeld();
        else if (this.target) this.interact();
      }
      if (e.code === 'KeyR' && this.inspecting) this.resetInspectRotation();
    });
    document.addEventListener('mousemove', (e) => {
      if (this.inspecting && document.pointerLockElement) {
        this.inspectRotation.y += e.movementX * 0.005;
        this.inspectRotation.x += e.movementY * 0.005;
      }
      if (this.hands) {
        this.hands.update(0.016, 0, false, e.movementX, e.movementY);
      }
    });
    document.addEventListener('mousedown', (e) => {
      if (!this.enabled || !document.pointerLockElement) return;
      // Left-Click: Throw held object
      if (e.button === 0 && this.inspecting) {
        this.throwHeld();
      }
      // Right-Click: Pick up targeted object or drop held object
      if (e.button === 2) {
        if (this.inspecting) {
          this.stopInspect();
        } else if (this.target) {
          this.interact();
        }
      }
    });
  }

  setHands(hands) {
    this.hands = hands;
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

  update(dt, playerSpeed = 0, isSprinting = false) {
    if (!this.enabled) return;

    if (this.hands) {
      this.hands.update(dt, playerSpeed, isSprinting);
    }

    // Inspect mode: keep object floating before the camera & gloved hand
    if (this.inspecting) {
      const cam = this.engine.camera;
      const anchor = new THREE.Vector3(0.18, -0.15, -0.48).applyQuaternion(cam.quaternion).add(cam.position);
      this.inspecting.position.lerp(anchor, 1 - Math.exp(-18 * dt));
      this.inspecting.rotation.x = this.inspectRotation.x;
      this.inspecting.rotation.y = this.inspectRotation.y;
      return;
    }

    // Raycast from screen center with aim assist
    const candidates = [...this.interactables];
    let found = this.castAt(0, 0, candidates);
    if (!found) {
      const r = 0.08;
      for (const [ox, oy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r * 0.7, r * 0.7], [-r * 0.7, -r * 0.7]]) {
        found = this.castAt(ox, oy, candidates);
        if (found) break;
      }
    }

    if (found !== this.target) {
      if (this.target) this._clearHighlight(this.target);
      this.target = found;
      if (this.target) this._applyHighlight(this.target);
      bus.emit(Events.LOOK_TARGET, found ? found.userData.interactable : null);
    }
  }

  _applyHighlight(obj) {
    if (!obj) return;
    obj.traverse((child) => {
      if (child.isMesh && child.material && child.material.emissive) {
        if (child.userData.origEmissive === undefined) {
          child.userData.origEmissive = child.material.emissive.getHex();
          child.userData.origIntensity = child.material.emissiveIntensity ?? 1;
        }
        // Small items (note, key, scroll) get warm 0.25 glow; large props get subtle 0.08 glow
        const radius = child.geometry?.boundingSphere?.radius ?? 1;
        const isSmallItem = radius < 0.35 || child.name?.includes('note') || child.name?.includes('key');
        const glowColor = isSmallItem ? 0xd8b040 : 0x3a3220;
        const intensity = isSmallItem ? 0.35 : 0.08;

        child.material.emissive.setHex(glowColor);
        child.material.emissiveIntensity = intensity;
      }
    });
  }

  _clearHighlight(obj) {
    if (!obj) return;
    obj.traverse((child) => {
      if (child.isMesh && child.material && child.material.emissive && child.userData.origEmissive !== undefined) {
        child.material.emissive.setHex(child.userData.origEmissive);
        child.material.emissiveIntensity = child.userData.origIntensity;
      }
    });
  }

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
    if (this.inspecting) {
      this.stopInspect();
      return;
    }
    if (!this.target) return;
    const meta = this.target.userData.interactable;
    bus.emit(Events.PLAYER_INTERACT, { object: this.target, meta });
    meta.onInteract?.(this.target, this);
  }

  /** Begin holding an object in the 3D hand */
  startInspect(object) {
    this.inspecting = object;
    this.inspectRotation = { x: 0, y: 0 };
    object.userData.preInspect = {
      position: object.position.clone(),
      rotation: object.rotation.clone(),
      parent: object.parent,
    };
    if (this.hands) this.hands.animatePickup();
    bus.emit(Events.LOOK_TARGET, { label: 'Hold object [LMB / F: Throw · RMB / E: Put Back]' });
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
    if (this.hands) this.hands.animateDrop();
    this.inspecting = null;
    bus.emit(Events.LOOK_TARGET, null);
    bus.emit(Events.PLAY_SOUND, { name: 'putdown' });
  }

  /** Throw the currently held object with physics impulse and 3D punch animation */
  throwHeld() {
    const obj = this.inspecting;
    if (!obj) return;

    const performThrow = () => {
      this.inspecting = null;
      const cam = this.engine.camera;
      const dir = new THREE.Vector3(0, 0.2, -1).applyQuaternion(cam.quaternion).normalize();

      let body = obj.userData.physicsBody;
      if (!body && this.physics) {
        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        body = this.physics.addDynamicBox(obj, {
          x: Math.max(0.06, size.x / 2),
          y: Math.max(0.06, size.y / 2),
          z: Math.max(0.06, size.z / 2),
        }, { mass: 2.0 });
      }

      if (body) {
        body.setTranslation({ x: obj.position.x, y: obj.position.y, z: obj.position.z }, true);
        body.setLinvel({ x: dir.x * 10, y: dir.y * 10 + 2.0, z: dir.z * 10 }, true);
        body.setAngvel({ x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 8, z: (Math.random() - 0.5) * 8 }, true);
      }

      bus.emit(Events.LOOK_TARGET, null);
      bus.emit(Events.PLAY_SOUND, { name: 'throw' });
    };

    if (this.hands) {
      this.hands.animateThrow(performThrow);
    } else {
      performThrow();
    }
  }
}
