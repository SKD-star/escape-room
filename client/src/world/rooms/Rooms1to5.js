/**
 * Rooms 1–5: Haunted Library, Ancient Temple, Forgotten Prison,
 * Abandoned Laboratory, Abandoned Hospital.
 *
 * Each room: unique shell materials, lighting rig, props, particles,
 * story notes, hidden items and a puzzle anchor prop. The PuzzleManager
 * attaches an AI-generated puzzle to `room.puzzleAnchor` after entry.
 */
import * as THREE from 'three';
import { BaseRoom } from '../BaseRoom.js';
import { bus, Events } from '../../core/EventBus.js';
import { createMaterial, glowMaterial, plainMaterial } from '../materials/MaterialLibrary.js';
import {
  createBarrel, createBookshelf, createChain, createChair, createCrate,
  createGhost, createGurney, createKeypad, createLever, createPainting,
  createStatue, createTable, createTerminal,
} from '../props/PropFactory.js';
import { Embers, Lightning, Rain } from '../particles/ParticleSystems.js';

// ---------------------------------------------------------------------------
// 1 · Haunted Library
// ---------------------------------------------------------------------------

export class HauntedLibrary extends BaseRoom {
  buildRoom() {
    this.size = { width: 14, depth: 12, height: 4.6 };
    this.spawn.set(0, 1.2, 4.5);
    this.setAtmosphere(0x1a1510, 0x18120c, 0.03, 0x5a4a36, 1.2);

    this.buildShell({
      floor: createMaterial('planks', { base: '#33261a', seed: 12, repeat: 5 }),
      wall: createMaterial('planks', { base: '#2c2117', seed: 8, repeat: 3, vertical: true }),
      ceiling: createMaterial('planks', { base: '#241a12', seed: 9, repeat: 4 }),
    });

    // Bookshelves lining the walls
    for (let i = 0; i < 4; i++) {
      this.addStatic(createBookshelf({ seed: i * 3 + 1 }), -5.9 + i * 1.5, -5.6, 0);
      this.addStatic(createBookshelf({ seed: i * 5 + 2 }), -5.9 + i * 1.5, 5.6, Math.PI);
    }
    this.addStatic(createBookshelf({ seed: 31 }), -6.7, -2, Math.PI / 2);
    this.addStatic(createBookshelf({ seed: 37 }), -6.7, 0, Math.PI / 2);

    // Secret bookshelf — pulls away when the lever is found
    this.secretShelf = this.addStatic(createBookshelf({ seed: 43 }), 6.7, 1.5, -Math.PI / 2);

    // Reading table with candles + entry note
    const table = this.addStatic(createTable(), 0, 0);
    this.addStatic(createChair(), 0.1, 0.9, Math.PI);
    this.addCandle(-0.5, 0.83, 0.15);
    this.addCandle(0.55, 0.83, -0.2);
    this.placeNote(0, 0.84, 0.1,
      'The Librarian\'s Last Entry',
      'They say every book in this room is a door, and every door is a test.\n\nTo unlock the exit lectern mechanism, inspect and count the physical relic groups in order from the center table to the exit door:\nI. Reading Lecterns in the center\nII. Ancestral Wall Paintings in the gallery\nIII. Lit Candles placed around the room\nIV. Stone Pillars framing the exit door\n\n📜 Inscription Clue:\n"[CLUE]"\n\nAn ancient scroll is tucked inside the 3rd bookshelf in the Whisper Section (marked by the golden beacon) if you need the full cipher.');

    // Golden spotlight over the 3rd Bookshelf in the Whisper Section (-2.9, -5.6)
    const shelfLight = new THREE.PointLight(0xffc857, 2.0, 6, 2);
    shelfLight.position.set(-2.9, 2.2, -4.8);
    this.group.add(shelfLight);

    // Ancient Scroll on the third bookshelf in the Whisper Section (-2.9, 1.25, -4.8)
    this.placeScroll(-2.9, 1.25, -4.8,
      'The Hidden Scroll — Whisper Section Inscription',
      'Unrolling the ancient parchment tucked inside the third bookshelf:\n\n"[CLUE]"\n\nCount each physical relic group in order from center to exit door to reveal the four-digit lock code.');

    // Candelabra ring
    this.addCandle(-4, 0.02, -3);
    this.addCandle(4.2, 0.02, -3.2);
    this.addCandle(3.8, 0.02, 3);
    this.addCandle(-4.5, 0.02, 3.4);

    // Paintings (4 paintings total)
    const p1 = createPainting({ seed: 2 });
    p1.position.set(-3, 2.4, -5.93); this.group.add(p1);
    const p2 = createPainting({ seed: 5 });
    p2.position.set(3, 2.4, -5.93); this.group.add(p2);
    const p3 = createPainting({ seed: 8 });
    p3.position.set(-3, 2.4, 5.93); p3.rotation.y = Math.PI; this.group.add(p3);
    const p4 = createPainting({ seed: 11 });
    p4.position.set(3, 2.4, 5.93); p4.rotation.y = Math.PI; this.group.add(p4);

    // 2 Stone Pillars framing the exit door
    const pil1 = createStatue({ height: 2.2 });
    pil1.position.set(-1.4, 0, -5.5); this.group.add(pil1);
    const pil2 = createStatue({ height: 2.2 });
    pil2.position.set(1.4, 0, -5.5); this.group.add(pil2);

    // Ghost librarian floating near the center table
    this.ghost = createGhost();
    this.ghost.position.set(2.2, 0, 0.5);
    this.group.add(this.ghost);
    this.group.add(this.ghost);
    this.makeInteractable(this.ghost, 'Speak with the librarian', () => {
      bus.emit(Events.DIALOGUE_OPEN, {
        npc: 'The Librarian', theme: 'library',
        greeting: 'Shhh. The books are listening. Ask what you must — quietly.',
      });
    });

    // Key hidden behind the secret shelf area
    this.placeKeyItem(6.5, 0.4, 3.6, 'brass_key', 'Brass Key');
    this.setRequiredKey('brass_key');

    // Hidden lever between shelves opens the secret alcove
    const lever = createLever();
    lever.position.set(-6.9, 1.3, -3.4);
    lever.rotation.y = Math.PI / 2;
    this.group.add(lever);
    this.makeInteractable(lever, 'Pull the hidden lever', (obj) => {
      if (obj.userData.pulled) return;
      obj.userData.pulled = true;
      obj.userData.arm.rotation.x = 0.9;
      bus.emit(Events.PLAY_SOUND, { name: 'lever' });
      bus.emit('camera:shake', 0.6);
      // Slide the secret shelf aside
      const shelf = this.secretShelf;
      const startX = shelf.position.x;
      const t0 = performance.now();
      const slide = () => {
        const p = Math.min(1, (performance.now() - t0) / 2000);
        shelf.position.z = 1.5 + p * 2.2;
        if (p < 1) requestAnimationFrame(slide);
      };
      slide();
      bus.emit(Events.TOAST, { text: 'A shelf grinds aside, revealing an alcove…' });
      bus.emit('secret:found', { room: 'haunted_library' });
    });

    // Puzzle anchor: an ancient lectern
    const lectern = this.addStatic(createTable({ width: 0.7, depth: 0.5, height: 1.05 }), 0, -4.4);
    this.puzzleAnchor = this.makeInteractable(lectern, 'Examine the lectern',
      () => bus.emit('puzzle:open'));

    // Fireplace glow + embers
    const embers = new Embers({ count: 30 });
    embers.points.position.set(6.6, 0.2, -4.5);
    this.group.add(embers.points);
    this.updatables.push(embers);
    const fireLight = new THREE.PointLight(0xff6a22, 3, 8, 2);
    fireLight.position.set(6.4, 0.7, -4.5);
    this.group.add(fireLight);

    this.addDust();
    this.addExitDoor({ x: 0 });
  }

  update(dt, t) {
    super.update(dt, t);
    this.ghost.userData.animate(t);
    // Ghost drift
    this.ghost.position.x = -3 + Math.sin(t * 0.13) * 2.5;
    this.ghost.position.z = -3 + Math.cos(t * 0.09) * 1.5;
  }
}

// ---------------------------------------------------------------------------
// 2 · Ancient Temple
// ---------------------------------------------------------------------------

export class AncientTemple extends BaseRoom {
  buildRoom() {
    this.size = { width: 14, depth: 16, height: 6 };
    this.spawn.set(0, 1.2, 6.5);
    this.setAtmosphere(0x080a06, 0x0e120a, 0.05, 0x24301c, 0.3);

    const stone = createMaterial('stone', { base: '#6a6353', mortar: '#3a352a', seed: 14, repeat: 4 });
    this.buildShell({
      floor: createMaterial('tiles', { base: '#7a6f58', line: '#3c3628', seed: 15, repeat: 5 }),
      wall: stone,
      ceiling: stone,
    });

    // Colonnade
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const column = new THREE.Mesh(
          new THREE.CylinderGeometry(0.4, 0.46, 6, 12),
          createMaterial('stone', { base: '#75705c', mortar: '#4a463a', seed: 20 + i }),
        );
        column.castShadow = column.receiveShadow = true;
        column.position.set(side * 4.4, 3, -5 + i * 3.4);
        this.group.add(column);
        this.physics.addStaticBox({ x: side * 4.4, y: 3, z: -5 + i * 3.4 }, { x: 0.46, y: 3, z: 0.46 });
      }
    }

    // Central altar with brazier fire
    const altar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.0),
      createMaterial('stone', { base: '#5c5646', mortar: '#332f26', seed: 33 }));
    altar.position.y = 0.45;
    altar.castShadow = altar.receiveShadow = true;
    this.addStatic(altar, 0, -3);

    const brazierFire = new Embers({ count: 60, spread: 0.5 });
    brazierFire.points.position.set(0, 1.0, -3);
    this.group.add(brazierFire.points);
    this.updatables.push(brazierFire);
    const fireLight = new THREE.PointLight(0xff7c2a, 4.5, 12, 2);
    fireLight.position.set(0, 1.6, -3);
    fireLight.castShadow = true;
    fireLight.shadow.mapSize.setScalar(512);
    this.group.add(fireLight);

    // Serpent statues flanking the exit
    this.addStatic(createStatue(), -1.6, -7.2, 0.3);
    this.addStatic(createStatue(), 1.6, -7.2, -0.3);

    // Glowing wall runes (sequence puzzle theming)
    this.runes = [];
    const runeChars = 5;
    for (let i = 0; i < runeChars; i++) {
      const rune = new THREE.Mesh(
        new THREE.PlaneGeometry(0.4, 0.4),
        glowMaterial(0x37d4a0, 0.8),
      );
      rune.position.set(-3 + i * 1.5, 2.6, -7.9);
      this.group.add(rune);
      this.runes.push(rune);
    }

    // Torches
    this.addTorch(-6.8, -2, Math.PI / 2, 2);
    this.addTorch(-6.8, 3, Math.PI / 2, 2);
    this.addTorch(6.8, -2, -Math.PI / 2, 2);
    this.addTorch(6.8, 3, -Math.PI / 2, 2);

    this.placeNote(0.4, 0.92, -2.8,
      'Carved Warning',
      'The serpent swallows the unworthy.\n\n"[CLUE]"\n\nSpeak to the keeper if your courage fails.');

    // Ghost priest
    this.ghost = createGhost();
    this.ghost.position.set(3, 0, 0);
    this.group.add(this.ghost);
    this.makeInteractable(this.ghost, 'Address the temple keeper', () => {
      bus.emit(Events.DIALOGUE_OPEN, {
        npc: 'The Keeper', theme: 'temple',
        greeting: 'You walk on holy stone with unholy footsteps. State your purpose.',
      });
    });

    this.placeKeyItem(-4.3, 0.05, -6.8, 'serpent_idol', 'Serpent Idol', '🐍');
    this.setRequiredKey('serpent_idol');

    this.puzzleAnchor = this.makeInteractable(altar, 'Study the altar',
      () => bus.emit('puzzle:open'));

    this.addFog(0x2a3324, 0.16);
    this.addDust(0xa8c49a);
    this.addExitDoor({ x: 0 });
  }

  update(dt, t) {
    super.update(dt, t);
    this.ghost.userData.animate(t);
    for (let i = 0; i < this.runes.length; i++) {
      this.runes[i].material.emissiveIntensity = 0.5 + Math.sin(t * 1.4 + i * 1.3) * 0.4;
    }
  }
}

// ---------------------------------------------------------------------------
// 3 · Forgotten Prison
// ---------------------------------------------------------------------------

export class ForgottenPrison extends BaseRoom {
  buildRoom() {
    this.size = { width: 16, depth: 12, height: 3.6 };
    this.spawn.set(5.5, 1.2, 4);
    this.setAtmosphere(0x060607, 0x0a0b0d, 0.075, 0x1a1c20, 0.32);

    const wall = createMaterial('stone', { base: '#4c4a48', mortar: '#242322', seed: 40, repeat: 4 });
    this.buildShell({
      floor: createMaterial('concrete', { base: '#3e3c39', seed: 41, repeat: 5 }),
      wall,
      ceiling: wall,
    });

    // Cell block: 4 barred cells along the west/northwest section (x = -6.8 to -1.2)
    const barMat = plainMaterial(0x3c3a36, { metalness: 0.8, roughness: 0.5 });
    for (let c = 0; c < 4; c++) {
      const cellX = -6.5 + c * 1.8;
      // dividing walls between cells
      const divider = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.6, 3), wall);
      divider.position.set(cellX + 0.9, 1.8, -4.5);
      divider.castShadow = divider.receiveShadow = true;
      this.group.add(divider);
      this.physics.addStaticBox({ x: cellX + 0.9, y: 1.8, z: -4.5 }, { x: 0.08, y: 1.8, z: 1.5 });
      // bars across cell front
      for (let b = 0; b < 4; b++) {
        if (c === 2 && b >= 1 && b <= 2) continue; // open gap entrance for Cell 3 key
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 3.6, 6), barMat);
        bar.position.set(cellX + b * 0.4 - 0.6, 1.8, -3);
        this.group.add(bar);
      }
      if (c !== 2) {
        this.physics.addStaticBox({ x: cellX, y: 1.8, z: -3 }, { x: 0.85, y: 1.8, z: 0.05 });
      }
    }

    // Key inside Cell 3
    this.placeKeyItem(-2.9, 0.05, -4.6, 'warden_key', 'Warden\'s Key');
    this.setRequiredKey('warden_key');

    // 4 Hanging chains from ceiling
    for (const [x, z] of [[-3, 1], [2, 2.5], [5, -1], [-5.5, -0.5]]) {
      const chain = createChain({ links: 10 });
      chain.position.set(x, 3.5, z);
      this.group.add(chain);
    }

    // 2 Interrogation tables and 2 chairs in the right wing
    const table1 = this.addStatic(createTable({ width: 1.2, depth: 0.7 }), 3.0, 0.5, 0.4);
    this.addStatic(createChair(), 3.6, 0.5, Math.PI + 0.4);
    const table2 = this.addStatic(createTable({ width: 1.2, depth: 0.7 }), 3.0, -1.8, 0.4);
    this.addStatic(createChair(), 3.6, -1.8, Math.PI + 0.4);

    this.placeNote(3.0, 0.84, 0.4,
      'Incident Report — Cell 3',
      'Prisoner 47 refused to eat again.\nClaims the walls "count with him" at night.\n\n"[CLUE]"\n\nFound his cell empty this morning.\nDoor still locked. Bars intact.');

    // Swinging lamp — the only strong light
    this.lamp = new THREE.Group();
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.8, 6),
      plainMaterial(0x222222));
    cord.position.y = -0.4;
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.18, 12),
      plainMaterial(0x3a3f36, { metalness: 0.6, roughness: 0.4 }));
    shade.position.y = -0.85;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), glowMaterial(0xffd9a0, 2.5));
    bulb.position.y = -0.92;
    this.lampLight = new THREE.SpotLight(0xffd9a0, 20, 14, Math.PI / 3.4, 0.55, 1.6);
    this.lampLight.position.y = -0.9;
    this.lampLight.castShadow = true;
    this.lampLight.shadow.mapSize.setScalar(1024);
    const lampTarget = new THREE.Object3D();
    lampTarget.position.y = -3;
    this.lampLight.target = lampTarget;
    this.lamp.add(cord, shade, bulb, this.lampLight, lampTarget);
    this.lamp.position.set(0, 3.6, 0.5);
    this.group.add(this.lamp);

    // Ghost prisoner
    this.ghost = createGhost();
    this.ghost.position.set(-6, 0, -4.4);
    this.group.add(this.ghost);
    this.makeInteractable(this.ghost, 'Whisper to Prisoner 47', () => {
      bus.emit(Events.DIALOGUE_OPEN, {
        npc: 'Prisoner 47', theme: 'prison',
        greeting: 'They locked the door but forgot the walls. Are you… real?',
      });
    });

    // Puzzle anchor: warden's desk with keypad
    const desk = this.addStatic(createTable({ width: 1.4, depth: 0.8 }), -5.5, 3.8, -0.5);
    const keypad = createKeypad();
    keypad.position.set(-5.5, 1.0, 3.5);
    keypad.rotation.x = -0.5;
    this.group.add(keypad);
    this.puzzleAnchor = this.makeInteractable(keypad, 'Use the cell-block keypad',
      () => bus.emit('puzzle:open'));

    this.addStatic(createCrate({ size: 0.6 }), 6.8, -4.6);
    this.addStatic(createCrate({ size: 0.45 }), 6.3, -3.8);

    this.addFog(0x22252a, 0.18);
    this.addDust(0x8a8f96);
    this.addExitDoor({ x: -3, metal: true });
  }

  update(dt, t) {
    super.update(dt, t);
    this.ghost.userData.animate(t);
    // lamp sways
    this.lamp.rotation.z = Math.sin(t * 0.7) * 0.14;
    this.lamp.rotation.x = Math.cos(t * 0.53) * 0.1;
  }
}

// ---------------------------------------------------------------------------
// 4 · Abandoned Laboratory
// ---------------------------------------------------------------------------

export class AbandonedLaboratory extends BaseRoom {
  buildRoom() {
    this.size = { width: 14, depth: 12, height: 3.4 };
    this.spawn.set(0, 1.2, 4.5);
    this.setAtmosphere(0x040807, 0x07100d, 0.07, 0x14201c, 0.4);

    this.buildShell({
      floor: createMaterial('tiles', { base: '#5c625e', line: '#2c302d', seed: 50, repeat: 6 }),
      wall: createMaterial('tiles', { base: '#697068', line: '#333733', seed: 51, repeat: 4 }),
      ceiling: createMaterial('concrete', { base: '#3c403c', seed: 52, repeat: 4 }),
    });

    // Specimen tanks along the west wall — glowing green cylinders
    this.tanks = [];
    for (let i = 0; i < 4; i++) {
      const tankGroup = new THREE.Group();
      const glass = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 1.9, 16, 1, true),
        new THREE.MeshPhysicalMaterial({
          color: 0x9fd8c0, transparent: true, opacity: 0.18,
          roughness: 0.1, metalness: 0, transmission: 0.6, side: THREE.DoubleSide,
        }),
      );
      glass.position.y = 1.15;
      const fluidLight = new THREE.PointLight(0x3fd88a, 1.8, 4.5, 2);
      fluidLight.position.y = 1.2;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.18, 16),
        plainMaterial(0x3a4040, { metalness: 0.7, roughness: 0.4 }));
      cap.position.y = 2.2;
      const base = cap.clone(); base.position.y = 0.1;
      // silhouette inside
      const thing = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.14, 0.5, 4, 8),
        plainMaterial(0x11241c, { roughness: 1 }),
      );
      thing.position.y = 1.1;
      thing.rotation.z = 0.2 + i * 0.3;
      tankGroup.add(glass, fluidLight, cap, base, thing);
      tankGroup.position.set(-6.4, 0, -4 + i * 2.6);
      this.group.add(tankGroup);
      this.physics.addStaticBox({ x: -6.4, y: 1.2, z: -4 + i * 2.6 }, { x: 0.5, y: 1.2, z: 0.5 });
      this.tanks.push({ group: tankGroup, light: fluidLight, phase: i * 1.7 });
    }

    // Lab benches with equipment
    const bench1 = this.addStatic(createTable({ width: 2.4, depth: 0.9, height: 0.9 }), 0, -1);
    this.addStatic(createTable({ width: 2.4, depth: 0.9, height: 0.9 }), 0, 2);
    // beakers (glass cylinders)
    for (const [x, z, h] of [[-0.8, -1.1, 0.16], [0.2, -0.8, 0.22], [0.9, -1.2, 0.12]]) {
      const beaker = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.06, h, 10),
        new THREE.MeshPhysicalMaterial({
          color: 0xcfe8dc, transparent: true, opacity: 0.35, roughness: 0.05, transmission: 0.5,
        }),
      );
      beaker.position.set(x, 0.95 + h / 2, z);
      this.group.add(beaker);
    }

    // Flickering fluorescent light
    this.fluoro = new THREE.RectAreaLight(0xcfe8e0, 2.4, 3.4, 0.3);
    this.fluoro.position.set(0, 3.35, 0.5);
    this.fluoro.lookAt(0, 0, 0.5);
    this.group.add(this.fluoro);
    const tube = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.06, 0.3), glowMaterial(0xcfe8e0, 1.4));
    tube.position.set(0, 3.36, 0.5);
    this.group.add(tube);
    this.tubeMat = tube.material;

    this.placeNote(0.4, 0.96, 2.1,
      'Research Log — Day 214',
      'Subject 47 shows accelerated regeneration.\nDr. Halvorsen insists we continue.\n\n"[CLUE]"\n\nIf the tanks go dark, do not stay to see what wakes up.');

    // Terminal — puzzle anchor
    const terminal = createTerminal({ screenColor: 0x2bc78a });
    terminal.position.set(5.8, 0, -3.5);
    terminal.rotation.y = -0.7;
    this.group.add(terminal);
    this.physics.addStaticBox({ x: 5.8, y: 0.8, z: -3.5 }, { x: 0.35, y: 0.8, z: 0.3 });
    this.puzzleAnchor = this.makeInteractable(terminal, 'Access the terminal',
      () => bus.emit('puzzle:open'));

    // Ghost scientist
    this.ghost = createGhost();
    this.ghost.position.set(4, 0, 2);
    this.group.add(this.ghost);
    this.makeInteractable(this.ghost, 'Question Dr. Halvorsen', () => {
      bus.emit(Events.DIALOGUE_OPEN, {
        npc: 'Dr. Halvorsen', theme: 'laboratory',
        greeting: 'You should not have opened that door. But since you are here — help me finish.',
      });
    });

    this.placeKeyItem(-6.35, 0.28, 3.4, 'vial_serum', 'Serum Vial', '🧪');
    this.setRequiredKey('vial_serum');

    this.addStatic(createBarrel(), 6.5, 4.2);
    this.addStatic(createBarrel(), 5.8, 4.6);

    this.addDust(0x9fd8c0);
    this.addExitDoor({ x: 0, metal: true });
  }

  update(dt, t) {
    super.update(dt, t);
    this.ghost.userData.animate(t);
    // tank glow pulse
    for (const tank of this.tanks) {
      tank.light.intensity = 1.5 + Math.sin(t * 1.2 + tank.phase) * 0.5;
    }
    // fluorescent flicker: occasionally dies
    const flick = Math.random() < 0.015 ? 0.1 : 1;
    this.fluoro.intensity = 2.4 * flick * (0.9 + Math.random() * 0.1);
    this.tubeMat.emissiveIntensity = 1.4 * flick;
  }
}

// ---------------------------------------------------------------------------
// 5 · Abandoned Hospital
// ---------------------------------------------------------------------------

export class AbandonedHospital extends BaseRoom {
  buildRoom() {
    this.size = { width: 15, depth: 13, height: 3.4 };
    this.spawn.set(0, 1.2, 5);
    this.setAtmosphere(0x070606, 0x0d0b0b, 0.065, 0x201c1c, 0.35);

    this.buildShell({
      floor: createMaterial('tiles', { base: '#6a6258', line: '#38332c', seed: 60, repeat: 7 }),
      wall: createMaterial('concrete', { base: '#5c554e', seed: 61, repeat: 4 }),
      ceiling: createMaterial('concrete', { base: '#413c37', seed: 62, repeat: 4 }),
    });

    // Ward: rows of gurneys, one overturned
    const spots = [[-4.5, -3.5, 0], [-1.5, -3.5, 0], [1.5, -3.5, 0], [4.5, -3.5, 0.2],
      [-4.5, 0, 0], [1.5, 0, -0.15]];
    for (const [x, z, tilt] of spots) {
      const gurney = createGurney();
      gurney.rotation.z = tilt;
      this.addStatic(gurney, x, z);
    }
    // overturned gurney
    const flipped = createGurney();
    flipped.rotation.z = Math.PI / 2.2;
    flipped.position.y = 0.3;
    this.addStatic(flipped, 4.5, 0.5, 1.2);

    // Curtain dividers (translucent planes)
    for (const [x, z] of [[-3, -2], [0, -2], [3, -2]]) {
      const curtain = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, 2.2, 8, 1),
        new THREE.MeshStandardMaterial({
          color: 0x8a8578, transparent: true, opacity: 0.55,
          side: THREE.DoubleSide, roughness: 1,
        }),
      );
      // slight wave in the geometry
      const posAttr = curtain.geometry.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        posAttr.setZ(i, Math.sin(posAttr.getX(i) * 3) * 0.08);
      }
      curtain.position.set(x, 1.35, z);
      this.group.add(curtain);
    }

    // Heart monitor with flat line that occasionally blips
    const monitor = createTerminal({ screenColor: 0x2bd45f });
    monitor.scale.setScalar(0.7);
    monitor.position.set(-6.6, 0, -1);
    monitor.rotation.y = Math.PI / 2;
    this.group.add(monitor);
    this.monitorScreen = monitor.userData.screen;

    this.placeNote(-1.5, 0.74, -3.4,
      'Patient Chart — East Ward',
      'Patient: [name water-damaged]\nAdmitted: for observation.\n\n"[CLUE]"\n\nNurse\'s addendum: It keeps pressing the call button. We unplugged the call button.');

    // Wheelchair (built from primitives)
    const wheelchair = new THREE.Group();
    const wcMetal = plainMaterial(0x6a6f74, { metalness: 0.8, roughness: 0.4 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.04, 0.45), plainMaterial(0x2c2a26));
    seat.position.y = 0.5;
    const wheelGeo = new THREE.TorusGeometry(0.28, 0.02, 8, 24);
    const w1 = new THREE.Mesh(wheelGeo, wcMetal); w1.position.set(-0.26, 0.28, 0);
    const w2 = new THREE.Mesh(wheelGeo, wcMetal); w2.position.set(0.26, 0.28, 0);
    const backRest = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 0.04), plainMaterial(0x2c2a26));
    backRest.position.set(0, 0.85, -0.22);
    wheelchair.add(seat, w1, w2, backRest);
    this.wheelchair = this.addStatic(wheelchair, 5.5, 3.8, -0.8);

    // Morgue drawers — puzzle anchor wall
    const morgue = new THREE.Group();
    const drawerMat = createMaterial('metal', { base: '#585e63', seed: 65 });
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.55, 0.06), drawerMat);
        drawer.position.set(col * 0.78 - 0.78, 0.5 + row * 0.6, 0);
        morgue.add(drawer);
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.03),
          plainMaterial(0x8a8f94, { metalness: 0.9, roughness: 0.3 }));
        handle.position.set(col * 0.78 - 0.78, 0.42 + row * 0.6, 0.045);
        morgue.add(handle);
      }
    }
    morgue.position.set(0, 0, -6.4);
    this.group.add(morgue);
    this.physics.addStaticBox({ x: 0, y: 1.2, z: -6.4 }, { x: 1.3, y: 1.2, z: 0.1 });
    this.puzzleAnchor = this.makeInteractable(morgue, 'Inspect the morgue drawers',
      () => bus.emit('puzzle:open'));

    // Ghost nurse
    this.ghost = createGhost();
    this.ghost.position.set(-5, 0, 3);
    this.group.add(this.ghost);
    this.makeInteractable(this.ghost, 'Approach the night nurse', () => {
      bus.emit(Events.DIALOGUE_OPEN, {
        npc: 'The Night Nurse', theme: 'hospital',
        greeting: 'Visiting hours ended in 1972. I will make an exception. Once.',
      });
    });

    this.placeKeyItem(4.6, 0.76, 0.4, 'morgue_tag', 'Morgue Tag', '🏷');
    this.setRequiredKey('morgue_tag');

    // Sickly green emergency light + swinging lamp
    const emergency = new THREE.PointLight(0x3fd45f, 1.2, 9, 2);
    emergency.position.set(6.8, 3, -5.5);
    this.group.add(emergency);
    this.emergencyLight = emergency;

    this.addCandle(-1.4, 0.74, -3.6);
    this.addFog(0x1c2020, 0.2);
    this.addDust(0x9aa08e);
    this.addExitDoor({ x: 3, metal: true });
  }

  update(dt, t) {
    super.update(dt, t);
    this.ghost.userData.animate(t);
    this.ghost.position.x = -5 + Math.sin(t * 0.07) * 3;
    // monitor blip
    this.monitorScreen.material.emissiveIntensity =
      Math.sin(t * 2.4) > 0.985 ? 3 : 0.7;
    // emergency light slow pulse
    this.emergencyLight.intensity = 0.9 + Math.sin(t * 0.8) * 0.4;
  }
}
