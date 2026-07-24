/**
 * BaseRoom — abstract room class. Handles the common lifecycle:
 *   build() → shell geometry + colliders, exit door, props, particles
 *   update(dt, t) → candle flicker, particles, ghosts, custom hooks
 *   dispose() → full cleanup of GPU + physics resources
 *
 * Subclasses override buildRoom() and can use the many helpers here.
 */
import * as THREE from 'three';
import { Engine } from '../core/Engine.js';
import { bus, Events } from '../core/EventBus.js';
import { createMaterial } from './materials/MaterialLibrary.js';
import {
  createBattery, createCandle, createDoor, createNote, createKey, createTorch,
} from './props/PropFactory.js';
import { DustMotes, GroundFog } from './particles/ParticleSystems.js';

export class BaseRoom {
  /**
   * @param {object} ctx { engine, physics, interactions, definition }
   */
  constructor(ctx) {
    this.engine = ctx.engine;
    this.physics = ctx.physics;
    this.interactions = ctx.interactions;
    this.definition = ctx.definition; // { key, name, theme, chapter }

    this.group = new THREE.Group();
    this.group.name = `room:${this.definition.key}`;
    this.updatables = [];   // {update(dt,t)}
    this.flickerLights = []; // candle/torch groups
    this.exitDoor = null;
    this.exitUnlocked = false;

    /** Room dimensions — subclasses may override before build(). */
    this.size = { width: 12, depth: 12, height: 4 };
    this.spawn = new THREE.Vector3(0, 1.2, this.size.depth / 2 - 2);
  }

  // -- lifecycle ----------------------------------------------------------

  build() {
    this.buildRoom();
    this.placeBattery();
    this.addObjectiveMarkers();
    this.engine.scene.add(this.group);
  }

  /**
   * Floating glowing markers so targets are always findable:
   *  - gold diamond above the puzzle anchor ("solve me")
   *  - green diamond above the exit door once unlocked ("go here")
   * Both bob/spin in update(); the exit marker starts hidden.
   */
  addObjectiveMarkers() {
    const makeMarker = (color) => {
      const group = new THREE.Group();
      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.09),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
      );
      const halo = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.14),
        new THREE.MeshBasicMaterial({
          color, transparent: true, opacity: 0.25, depthWrite: false,
        }),
      );
      const light = new THREE.PointLight(color, 1.6, 3, 2);
      group.add(core, halo, light);
      group.userData.core = core;
      group.userData.halo = halo;
      return group;
    };

    if (this.puzzleAnchor) {
      const box = new THREE.Box3().setFromObject(this.puzzleAnchor);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      // generous invisible hit volume — puzzle anchors must be easy to aim at
      const proxy = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(size.x, size.y, size.z) / 2 + 0.3, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      this.puzzleAnchor.worldToLocal(proxy.position.copy(center));
      this.puzzleAnchor.add(proxy);

      this.puzzleMarker = makeMarker(0xf0c040);
      this.puzzleMarker.position.set(center.x, box.max.y + 0.45, center.z);
      this.group.add(this.puzzleMarker);
    }
    if (this.exitDoor) {
      this.exitMarker = makeMarker(0x40e080);
      this.exitMarker.position.copy(this.exitDoor.position).add(new THREE.Vector3(0, 2.6, 0.3));
      this.exitMarker.visible = false;
      this.group.add(this.exitMarker);
    }
  }

  /** Override in subclasses. */
  buildRoom() {}

  update(dt, t) {
    // Candle/torch flicker
    for (const holder of this.flickerLights) {
      const light = holder.userData.light;
      if (!light) continue;
      const base = holder.userData.baseIntensity ?? 2;
      light.intensity = base * (0.82 + Math.sin(t * 9 + holder.id) * 0.09
        + Math.sin(t * 23 + holder.id * 2) * 0.06 + Math.random() * 0.04);
      const flame = holder.userData.flame;
      if (flame) {
        flame.scale.setScalar(0.9 + Math.sin(t * 12 + holder.id) * 0.12);
      }
    }
    // Objective markers: bob + spin + pulse, fading out as you approach
    const camPos = this.engine.camera.position;
    for (const marker of [this.puzzleMarker, this.exitMarker]) {
      if (!marker?.visible) continue;
      marker.position.y += Math.sin(t * 2.2) * 0.0018;
      marker.rotation.y = t * 1.4;
      const pulse = 0.85 + Math.sin(t * 3.1) * 0.2;
      // fade: full at 5m+, gone under 2m (you're there — stop shouting)
      const dist = marker.position.distanceTo(camPos);
      const fade = THREE.MathUtils.clamp((dist - 2) / 3, 0, 1);
      marker.userData.core.material.opacity = 0.9 * pulse * fade;
      marker.userData.halo.material.opacity = 0.25 * fade;
      marker.userData.halo.scale.setScalar(1 + Math.sin(t * 3.1) * 0.18);
    }
    for (const u of this.updatables) u.update(dt, t);
  }

  dispose() {
    this.engine.scene.remove(this.group);
    Engine.dispose(this.group);
    this.interactions.clear();
    this.physics.clear();
    this.updatables.length = 0;
    this.flickerLights.length = 0;
  }

  // -- shell builders -----------------------------------------------------

  /**
   * Build floor, ceiling and 4 walls with colliders.
   * @param {object} mats { floor, wall, ceiling } three materials
   */
  buildShell(mats) {
    const { width: w, depth: d, height: h } = this.size;

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mats.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);
    this.physics.addStaticBox({ x: 0, y: -0.1, z: 0 }, { x: w / 2, y: 0.1, z: d / 2 });

    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mats.ceiling);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = h;
    this.group.add(ceiling);
    this.physics.addStaticBox({ x: 0, y: h + 0.1, z: 0 }, { x: w / 2, y: 0.1, z: d / 2 });

    const wallDefs = [
      { pos: [0, h / 2, -d / 2], rot: 0, size: [w, h] },          // north
      { pos: [0, h / 2, d / 2], rot: Math.PI, size: [w, h] },     // south
      { pos: [-w / 2, h / 2, 0], rot: Math.PI / 2, size: [d, h] }, // west
      { pos: [w / 2, h / 2, 0], rot: -Math.PI / 2, size: [d, h] }, // east
    ];
    for (const def of wallDefs) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(def.size[0], def.size[1]), mats.wall);
      wall.position.set(...def.pos);
      wall.rotation.y = def.rot;
      wall.receiveShadow = true;
      this.group.add(wall);
      // collider slightly behind the visual plane
      const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), def.rot);
      this.physics.addStaticBox(
        {
          x: def.pos[0] - normal.x * 0.1,
          y: def.pos[1],
          z: def.pos[2] - normal.z * 0.1,
        },
        {
          x: Math.abs(Math.cos(def.rot)) * def.size[0] / 2 + Math.abs(Math.sin(def.rot)) * 0.1 + 0.05,
          y: def.size[1] / 2,
          z: Math.abs(Math.sin(def.rot)) * def.size[0] / 2 + Math.abs(Math.cos(def.rot)) * 0.1 + 0.05,
        },
      );
    }
  }

  /** Default theme materials — subclasses often pass their own. */
  themeMaterials() {
    return {
      floor: createMaterial('planks', { base: '#3c2e1e', seed: 2, repeat: 4 }),
      wall: createMaterial('stone', { base: '#57504a', mortar: '#2c2822', seed: 3, repeat: 3 }),
      ceiling: createMaterial('concrete', { base: '#3a362f', seed: 4, repeat: 3 }),
    };
  }

  // -- prop helpers -------------------------------------------------------

  /** Place object, add box collider matching its bounds. */
  addStatic(object, x, z, rotY = 0) {
    object.position.set(x, object.position.y, z);
    object.rotation.y = rotY;
    this.group.add(object);
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    if (size.x > 0.15 && size.z > 0.15 && size.y > 0.3) {
      this.physics.addStaticBox(center, { x: size.x / 2, y: size.y / 2, z: size.z / 2 }, 0);
    }
    return object;
  }

  addCandle(x, y, z) {
    const candle = createCandle();
    candle.position.set(x, y, z);
    this.group.add(candle);
    this.flickerLights.push(candle);
    return candle;
  }

  addTorch(x, z, rotY = 0, y = 1.4) {
    const torch = createTorch();
    torch.position.set(x, y, z);
    torch.rotation.y = rotY;
    this.group.add(torch);
    this.flickerLights.push(torch);
    return torch;
  }

  addDust(color = 0xc9bfa8) {
    const dust = new DustMotes({
      bounds: new THREE.Vector3(this.size.width - 1, this.size.height - 0.5, this.size.depth - 1),
      color,
    });
    dust.points.position.y = 0.2;
    this.group.add(dust.points);
    this.updatables.push(dust);
    return dust;
  }

  addFog(color = 0x3a4148, opacity = 0.14) {
    const fog = new GroundFog({
      size: Math.max(this.size.width, this.size.depth) + 2, color, opacity,
    });
    this.group.add(fog.group);
    this.updatables.push(fog);
    return fog;
  }

  /** Scene fog + background tint for atmosphere. */
  setAtmosphere(bgColor, fogColor, fogDensity = 0.055, ambient = 0x1c1a24, ambientIntensity = 0.35) {
    this.engine.scene.background = new THREE.Color(bgColor);
    // Halve the requested fog density: rooms are small, dense fog just
    // turns the far wall into mud.
    this.engine.scene.fog = new THREE.FogExp2(fogColor, fogDensity * 0.55);
    const amb = new THREE.AmbientLight(ambient, ambientIntensity + 0.85);
    this.group.add(amb);
    // Strong hemisphere fill keeps the whole room readable while candles
    // and torches still provide the warm mood highlights.
    const hemi = new THREE.HemisphereLight(0x4a5068, 0x241c12, 1.1);
    this.group.add(hemi);
  }

  // -- exit door ----------------------------------------------------------

  /**
   * Standard exit door on the north wall. Locked until unlockExit().
   */
  addExitDoor({ x = 0, z = null, rotY = 0, metal = false } = {}) {
    const door = createDoor({ metal });
    const dz = z ?? -this.size.depth / 2 + 0.12;
    door.position.set(x, 0, dz);
    door.rotation.y = rotY;
    this.group.add(door);
    this.exitDoor = door;
    // collider blocks passage until opened
    this.exitCollider = this.physics.addStaticBox(
      { x, y: 1.2, z: dz }, { x: 0.65, y: 1.2, z: 0.12 }, rotY,
    );

    door.userData.interactable = {
      label: 'Locked — solve the room',
      onInteract: () => {
        if (this.exitUnlocked) this.openExit();
        else {
          bus.emit(Events.PLAY_SOUND, { name: 'locked' });
          bus.emit(Events.TOAST, { text: 'The door is sealed. The room is not done with you.', type: 'danger' });
        }
      },
    };
    this.interactions.register(door);
    return door;
  }

  unlockExit() {
    this.exitUnlocked = true;
    if (this.exitDoor) {
      this.exitDoor.userData.interactable.label = 'Open the way forward';
    }
    // marker handoff: puzzle done → guide to the exit
    if (this.puzzleMarker) this.puzzleMarker.visible = false;
    if (this.exitMarker) this.exitMarker.visible = true;
    bus.emit(Events.PLAY_SOUND, { name: 'unlock' });
    bus.emit(Events.TOAST, { text: 'Something heavy releases inside the exit door.' });
    bus.emit(Events.OBJECTIVE_CHANGED, 'Escape through the unsealed door — follow the green light.');
  }

  openExit() {
    if (this.exitDoor.userData.isOpen) return;
    this.exitDoor.userData.isOpen = true;
    bus.emit(Events.PLAY_SOUND, { name: 'door_open' });
    // swing animation done manually (GSAP not needed for hinge)
    const hinge = this.exitDoor.userData.hinge;
    const start = performance.now();
    const animate = () => {
      const p = Math.min(1, (performance.now() - start) / 1200);
      hinge.rotation.y = -p * p * (Math.PI / 2 + 0.2);
      if (p < 1) requestAnimationFrame(animate);
      else {
        if (this.exitCollider) this.physics.world.removeRigidBody(this.exitCollider.body);
        bus.emit(Events.ROOM_CLEARED, { key: this.definition.key });
      }
    };
    animate();
  }

  // -- interactable helpers ----------------------------------------------

  /** Readable note on a surface. */
  placeNote(x, y, z, title, body, rotY = 0) {
    const note = createNote();
    note.position.set(x, y, z);
    note.rotation.z = rotY;
    this.addHitProxy(note, 0.3, 0);
    this.group.add(note);
    note.userData.interactable = {
      label: 'Read note',
      onInteract: () => bus.emit(Events.NOTE_OPEN, { title, body }),
    };
    this.interactions.register(note);
    return note;
  }

  /**
   * Hidden battery cell — one per room, tucked into a corner picked by a
   * deterministic hash of the room key (same spot every run, findable in
   * guides). Restores 45% charge on pickup.
   */
  placeBattery() {
    let h = 0;
    for (const c of this.definition.key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const corners = [
      [this.size.width / 2 - 0.7, this.size.depth / 2 - 0.7],
      [-this.size.width / 2 + 0.7, this.size.depth / 2 - 0.7],
      [this.size.width / 2 - 0.7, -this.size.depth / 2 + 0.7],
      [-this.size.width / 2 + 0.7, -this.size.depth / 2 + 0.7],
    ];
    const [x, z] = corners[h % corners.length];
    const battery = createBattery();
    battery.position.set(x, 0, z);
    battery.rotation.z = Math.PI / 2;
    battery.rotation.y = (h % 7) * 0.9;
    this.addHitProxy(battery, 0.35, 0.05);
    this.group.add(battery);
    this.makeInteractable(battery, 'Take the battery', (obj) => {
      this.group.remove(obj);
      this.interactions.unregister(obj);
      bus.emit('battery:pickup', 45);
      bus.emit(Events.TOAST, { text: 'A battery, still warm. Warm from what?' });
    });
  }

  /** Invisible sphere that makes small pickups easy to aim at. */
  addHitProxy(object, radius = 0.35, y = 0.1) {
    const proxy = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    proxy.position.y = y;
    object.add(proxy);
    return object;
  }

  /** Collectible key item. */
  placeKeyItem(x, y, z, itemId, itemName, icon = '🗝') {
    const key = createKey();
    key.position.set(x, y, z);
    key.rotation.x = -Math.PI / 2.2;
    this.addHitProxy(key, 0.4, 0);
    // soft gold shimmer so collectibles catch the eye
    const glow = new THREE.PointLight(0xd8b040, 0.8, 1.6, 2);
    glow.position.y = 0.15;
    key.add(glow);
    this.group.add(key);
    key.userData.interactable = {
      label: `Take ${itemName}`,
      onInteract: (obj) => {
        this.group.remove(obj);
        this.interactions.unregister(obj);
        bus.emit(Events.ITEM_ADDED, { id: itemId, name: itemName, icon });
      },
    };
    this.interactions.register(key);
    return key;
  }

  /** Generic interactable registration shorthand. */
  makeInteractable(object, label, onInteract) {
    object.userData.interactable = { label, onInteract };
    this.interactions.register(object);
    return object;
  }
}
