/**
 * Rooms 6–10: Haunted Mansion, Medieval Castle, Secret Bunker,
 * Cyber AI Facility, Final Convergence (boss room).
 */
import * as THREE from 'three';
import { BaseRoom } from '../BaseRoom.js';
import { bus, Events } from '../../core/EventBus.js';
import { createMaterial, glowMaterial, plainMaterial } from '../materials/MaterialLibrary.js';
import {
  createBookshelf, createChair, createCrate, createGhost, createKeypad,
  createLever, createPainting, createStatue, createTable, createTerminal,
} from '../props/PropFactory.js';
import { Embers, Lightning, Rain } from '../particles/ParticleSystems.js';

// ---------------------------------------------------------------------------
// 6 · Haunted Mansion
// ---------------------------------------------------------------------------

export class HauntedMansion extends BaseRoom {
  buildRoom() {
    this.size = { width: 15, depth: 14, height: 5 };
    this.spawn.set(0, 1.2, 5.5);
    this.setAtmosphere(0x080608, 0x100c10, 0.055, 0x241c28, 0.35);

    this.buildShell({
      floor: createMaterial('planks', { base: '#402e20', seed: 70, repeat: 5 }),
      wall: createMaterial('planks', { base: '#33241c', seed: 71, repeat: 3, vertical: true }),
      ceiling: createMaterial('planks', { base: '#241812', seed: 72, repeat: 4 }),
    });

    // Grand staircase silhouette (blocked, decorative)
    const stairMat = createMaterial('planks', { base: '#4a3826', seed: 73, repeat: 2 });
    for (let i = 0; i < 7; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 0.4), stairMat);
      step.castShadow = step.receiveShadow = true;
      step.position.set(-5.2, 0.1 + i * 0.18, -5.4 + i * 0.4);
      this.group.add(step);
    }
    this.physics.addStaticBox({ x: -5.2, y: 0.7, z: -4.2 }, { x: 1.6, y: 0.7, z: 1.5 });

    // Portrait gallery — the eyes follow (billboard trick on one painting)
    this.portraits = [];
    for (let i = 0; i < 5; i++) {
      const painting = createPainting({ seed: 100 + i * 13, width: 0.8, height: 1.1 });
      painting.position.set(-6 + i * 2.9, 2.6, -6.93);
      this.group.add(painting);
      this.portraits.push(painting);
    }

    // Chandelier
    const chandelier = new THREE.Group();
    const ringMat = plainMaterial(0x5a4a2a, { metalness: 0.85, roughness: 0.35 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.04, 8, 24), ringMat);
    ring.rotation.x = Math.PI / 2;
    chandelier.add(ring);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.1, 8), ringMat);
      cup.position.set(Math.cos(angle) * 0.7, 0.06, Math.sin(angle) * 0.7);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 6), glowMaterial(0xffa540, 2.6));
      flame.position.set(Math.cos(angle) * 0.7, 0.16, Math.sin(angle) * 0.7);
      chandelier.add(cup, flame);
    }
    const chandLight = new THREE.PointLight(0xffa050, 4, 12, 2);
    chandLight.castShadow = true;
    chandLight.shadow.mapSize.setScalar(512);
    chandelier.add(chandLight);
    chandelier.position.set(0, 4.3, 0);
    this.group.add(chandelier);
    this.chandelier = chandelier;
    chandelier.userData.light = chandLight;
    chandelier.userData.baseIntensity = 4;
    this.flickerLights.push(chandelier);

    // Mirror (reflective-looking plane w/ envmap high metalness)
    const mirror = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2, 0.08),
      plainMaterial(0x4a3a1c, { metalness: 0.4, roughness: 0.5 }));
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x8a95a0, metalness: 1, roughness: 0.06 }));
    glass.position.z = 0.05;
    mirror.add(frame, glass);
    mirror.position.set(7.4, 1.6, 0);
    mirror.rotation.y = -Math.PI / 2;
    this.group.add(mirror);
    this.makeInteractable(mirror, 'Look into the mirror', () => {
      bus.emit('camera:shake', 1.2);
      bus.emit(Events.PLAY_SOUND, { name: 'whisper' });
      bus.emit(Events.TOAST, { text: 'Your reflection blinked first.', type: 'danger' });
      bus.emit('secret:mirror');
    });

    // Dining table with candles
    const table = this.addStatic(createTable({ width: 2.8, depth: 1.1 }), 1.5, -1);
    for (const dx of [-1, 0, 1]) this.addCandle(1.5 + dx, 0.83, -1);
    this.addStatic(createChair(), 0.4, -0.1, Math.PI);
    this.addStatic(createChair(), 2.6, -1.9, 0);

    this.placeNote(1.7, 0.84, -0.7,
      'The Heir\'s Confession',
      'Father never sold the house. The house would not sign.\n\nWe hear mother in the piano room though we burned the piano years ago.\nThe study clock stopped at 3:47. It was right to stop. Do not wind it.\n\n📜 Inscription Clue:\n"[CLUE]"');

    // Grandfather clock — puzzle anchor
    const clock = new THREE.Group();
    const clockBody = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.2, 0.4),
      createMaterial('planks', { base: '#3c2a18', seed: 77 }));
    clockBody.position.y = 1.1;
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24),
      plainMaterial(0xd8cdb0, { roughness: 0.6 }));
    face.position.set(0, 1.75, 0.21);
    const pendulum = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 6),
      plainMaterial(0x8a7a3a, { metalness: 0.9, roughness: 0.3 }));
    pendulum.position.set(0, 0.8, 0.1);
    clock.add(clockBody, face, pendulum);
    clock.userData.pendulum = pendulum;
    this.clock = this.addStatic(clock, -7, -6.5, 0.5);
    this.puzzleAnchor = this.makeInteractable(clock, 'Examine the stopped clock',
      () => bus.emit('puzzle:open'));

    // Ghost of the mother
    this.ghost = createGhost();
    this.ghost.position.set(4, 0, 3);
    this.group.add(this.ghost);
    this.makeInteractable(this.ghost, 'Speak to the lady of the house', () => {
      bus.emit(Events.DIALOGUE_OPEN, {
        npc: 'The Lady', theme: 'mansion',
        greeting: 'A guest. How long has it been. Do sit — the chairs remember how to hold you.',
      });
    });

    this.placeKeyItem(-5.1, 1.4, -4.3, 'silver_locket', 'Silver Locket', '📿');
    this.setRequiredKey('silver_locket');

    this.addFog(0x241c28, 0.14);
    this.addDust(0xb8a888);
    this.addExitDoor({ x: 3.5 });
  }

  update(dt, t) {
    super.update(dt, t);
    this.ghost.userData.animate(t);
    this.chandelier.rotation.y = Math.sin(t * 0.2) * 0.06;
    this.clock.userData.pendulum.rotation.z = Math.sin(t * 2.2) * 0.16;
  }
}

// ---------------------------------------------------------------------------
// 7 · Medieval Castle
// ---------------------------------------------------------------------------

export class MedievalCastle extends BaseRoom {
  buildRoom() {
    this.size = { width: 16, depth: 15, height: 6.5 };
    this.spawn.set(0, 1.2, 6);
    this.setAtmosphere(0x06070a, 0x0b0d12, 0.05, 0x1c2030, 0.3);

    const castleStone = createMaterial('stone', { base: '#5f5c58', mortar: '#33302c', seed: 80, repeat: 4 });
    this.buildShell({
      floor: createMaterial('stone', { base: '#514e48', mortar: '#2c2a26', seed: 81, repeat: 5 }),
      wall: castleStone,
      ceiling: castleStone,
    });

    // Throne on a dais
    const dais = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 3), castleStone);
    dais.position.y = 0.25;
    dais.castShadow = dais.receiveShadow = true;
    this.addStatic(dais, 0, -5.5);
    const throne = new THREE.Group();
    const throneMat = createMaterial('planks', { base: '#38260f', seed: 83 });
    const throneSeat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.8), throneMat);
    throneSeat.position.y = 0.75;
    const throneBack = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.9, 0.15), throneMat);
    throneBack.position.set(0, 1.7, -0.35);
    const spike1 = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.4, 6), throneMat);
    spike1.position.set(-0.35, 2.8, -0.35);
    const spike2 = spike1.clone(); spike2.position.x = 0.35;
    const spike3 = spike1.clone(); spike3.position.set(0, 3, -0.35);
    throne.add(throneSeat, throneBack, spike1, spike2, spike3);
    this.addStatic(throne, 0, -5.3, 0);
    this.makeInteractable(throne, 'Approach the throne', () => {
      bus.emit(Events.TOAST, { text: 'The throne is warm. Nobody has sat here for 600 years.', type: 'danger' });
      bus.emit('camera:shake', 0.5);
    });

    // Banners (cloth planes)
    for (const [x, seedC] of [[-5, 0x5a1c1c], [5, 0x1c2c5a]]) {
      const banner = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 3.4, 4, 8),
        new THREE.MeshStandardMaterial({ color: seedC, roughness: 0.95, side: THREE.DoubleSide }),
      );
      banner.position.set(x, 3.6, -7.3);
      this.group.add(banner);
    }

    // Armor stands
    for (const [x, z] of [[-6.5, -3], [-6.5, 1], [6.5, -3], [6.5, 1]]) {
      const armor = new THREE.Group();
      const armorMat = plainMaterial(0x777c82, { metalness: 0.9, roughness: 0.35 });
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.7, 8), armorMat);
      torso.position.y = 1.25;
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), armorMat);
      helm.position.y = 1.78;
      const plume = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.25, 6),
        plainMaterial(0x8a1c1c, { roughness: 0.9 }));
      plume.position.y = 2.0;
      const standPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6),
        plainMaterial(0x3a3630, { metalness: 0.5 }));
      standPole.position.y = 0.6;
      armor.add(torso, helm, plume, standPole);
      this.addStatic(armor, x, z, Math.PI / 4 * (x > 0 ? -1 : 1));
    }

    // Round table with crest puzzle anchor
    const table = this.addStatic(createTable({ width: 1.8, depth: 1.8 }), 0, 0);
    const crest = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 8),
      plainMaterial(0x8a7a3a, { metalness: 0.85, roughness: 0.3 }));
    crest.position.set(0, 0.84, 0);
    this.group.add(crest);
    this.puzzleAnchor = this.makeInteractable(crest, 'Study the royal crest',
      () => bus.emit('puzzle:open'));

    this.placeNote(0.5, 0.84, 0.5,
      'The Last Verdict',
      'The court convened at midnight, as the dead prefer.\n\nThe charge: the king would not stop winding the clock.\nThe sentence: the castle, forever.\n\n📜 Royal Inscription Clue:\n"[CLUE]"');

    // Torches everywhere
    this.addTorch(-7.8, -4, Math.PI / 2, 2.4);
    this.addTorch(-7.8, 2, Math.PI / 2, 2.4);
    this.addTorch(7.8, -4, -Math.PI / 2, 2.4);
    this.addTorch(7.8, 2, -Math.PI / 2, 2.4);
    this.addTorch(-2.5, -7.2, 0, 2.4);
    this.addTorch(2.5, -7.2, 0, 2.4);

    // Ghost king
    this.ghost = createGhost();
    this.ghost.position.set(0, 0.5, -5.2);
    this.ghost.scale.setScalar(1.25);
    this.group.add(this.ghost);
    this.makeInteractable(this.ghost, 'Kneel before the king', () => {
      bus.emit(Events.DIALOGUE_OPEN, {
        npc: 'The Undying King', theme: 'castle',
        greeting: 'Six hundred years, and still they send petitioners. Speak. The court is listening.',
      });
    });

    this.placeKeyItem(6.4, 0.05, 0.6, 'royal_seal', 'Royal Seal', '👑');
    this.setRequiredKey('royal_seal');

    this.addStatic(createStatue({ height: 2.4 }), -3.4, -6.8, 0.4);
    this.addStatic(createStatue({ height: 2.4 }), 3.4, -6.8, -0.4);

    this.addFog(0x1c2030, 0.16);
    this.addDust(0x9aa0b0);
    this.addExitDoor({ x: -4, metal: true });
  }

  update(dt, t) {
    super.update(dt, t);
    this.ghost.userData.animate(t);
  }
}

// ---------------------------------------------------------------------------
// 8 · Secret Bunker
// ---------------------------------------------------------------------------

export class SecretBunker extends BaseRoom {
  buildRoom() {
    this.size = { width: 12, depth: 11, height: 2.9 };
    this.spawn.set(0, 1.2, 4);
    this.setAtmosphere(0x050505, 0x080807, 0.09, 0x181812, 0.3);

    const bunkerWall = createMaterial('concrete', { base: '#45423c', seed: 90, repeat: 3 });
    this.buildShell({
      floor: createMaterial('concrete', { base: '#38352f', seed: 91, repeat: 4 }),
      wall: bunkerWall,
      ceiling: bunkerWall,
    });

    // Radio equipment wall — puzzle anchor
    const radioWall = new THREE.Group();
    const consoleMat = createMaterial('metal', { base: '#3c4238', seed: 93 });
    const console1 = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.5, 0.5), consoleMat);
    console1.position.y = 0.95;
    radioWall.add(console1);
    // dials and lights
    let s = 12;
    const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    this.radioLights = [];
    for (let i = 0; i < 14; i++) {
      const isLight = rand() < 0.5;
      if (isLight) {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8),
          glowMaterial(rand() < 0.5 ? 0xd43f3f : 0x3fd45f, 1.5));
        lamp.position.set(rand() * 2.8 - 1.4, 0.6 + rand() * 1, 0.26);
        radioWall.add(lamp);
        this.radioLights.push({ mesh: lamp, phase: rand() * 6 });
      } else {
        const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12),
          plainMaterial(0x22241f, { metalness: 0.6, roughness: 0.5 }));
        dial.rotation.x = Math.PI / 2;
        dial.position.set(rand() * 2.8 - 1.4, 0.6 + rand() * 1, 0.27);
        radioWall.add(dial);
      }
    }
    radioWall.position.set(0, 0, -5.2);
    this.group.add(radioWall);
    this.physics.addStaticBox({ x: 0, y: 0.95, z: -5.2 }, { x: 1.6, y: 0.75, z: 0.3 });
    this.puzzleAnchor = this.makeInteractable(radioWall, 'Tune the radio array',
      () => bus.emit('puzzle:open'));

    // Bunk beds
    for (const z of [-1.5, 1]) {
      const bunk = new THREE.Group();
      const frame = plainMaterial(0x3c4038, { metalness: 0.6, roughness: 0.5 });
      for (const y of [0.4, 1.2]) {
        const bed = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 1.9), frame);
        bed.position.y = y;
        const mattress = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.1, 1.85),
          plainMaterial(0x5c5648, { roughness: 0.95 }));
        mattress.position.y = y + 0.09;
        bunk.add(bed, mattress);
      }
      for (const [px, pz] of [[-0.38, -0.92], [0.38, -0.92], [-0.38, 0.92], [0.38, 0.92]]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 6), frame);
        pole.position.set(px, 0.85, pz);
        bunk.add(pole);
      }
      this.addStatic(bunk, -5.2, z, Math.PI / 2);
    }

    // Supply crates
    this.addStatic(createCrate({ size: 0.6 }), 4.8, -4);
    this.addStatic(createCrate({ size: 0.5 }), 5.2, -3.2);
    this.addStatic(createCrate({ size: 0.4 }), 4.4, -3.4);

    // Hatch wheel door decor on east wall
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.05, 8, 20),
      plainMaterial(0x5c6258, { metalness: 0.85, roughness: 0.4 }));
    wheel.position.set(5.9, 1.4, 1.5);
    wheel.rotation.y = Math.PI / 2;
    this.group.add(wheel);
    this.hatchWheel = wheel;
    this.makeInteractable(wheel, 'Turn the hatch wheel', () => {
      bus.emit(Events.PLAY_SOUND, { name: 'lever' });
      bus.emit(Events.TOAST, { text: 'Sealed from the other side. Something scrapes back.' , type: 'danger' });
      bus.emit('camera:shake', 0.8);
    });

    this.placeNote(-5.2, 1.32, 1,
      'Final Transmission — 0347 hours',
      'To anyone receiving:\nDo not answer the frequency that answers back.\n\nWe thought it was survivors.\nIt counts our heartbeats through the walls.\n\nProtocol says destroy the codebook.\nI hid it instead. Under where we sleep.\nForgive me. It promised to let me out.');

    // codebook under bunk
    this.placeKeyItem(-5.2, 0.2, -1.2, 'codebook', 'Cipher Codebook', '📕');
    this.setRequiredKey('codebook');

    // Single caged ceiling lights
    for (const [x, z] of [[0, 0], [-3.5, 2], [3.5, 2], [0, -3.5]]) {
      const cage = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6),
        glowMaterial(0xd8c9a0, 1.8));
      cage.position.set(x, 2.82, z);
      this.group.add(cage);
      const light = new THREE.PointLight(0xd8c9a0, 1.5, 6, 2);
      light.position.set(x, 2.7, z);
      this.group.add(light);
      if (x === 0 && z === 0) { light.castShadow = true; light.shadow.mapSize.setScalar(512); }
    }

    // Ghost radio operator
    this.ghost = createGhost();
    this.ghost.position.set(2.5, 0, -3.5);
    this.group.add(this.ghost);
    this.makeInteractable(this.ghost, 'Question the operator', () => {
      bus.emit(Events.DIALOGUE_OPEN, {
        npc: 'The Operator', theme: 'bunker',
        greeting: 'Signal\'s still live. Sixty years I\'ve kept it from answering. Don\'t touch the dials out of order.',
      });
    });

    this.addDust(0x8a8570);
    this.addExitDoor({ x: -3, metal: true });
  }

  update(dt, t) {
    super.update(dt, t);
    this.ghost.userData.animate(t);
    for (const l of this.radioLights) {
      l.mesh.material.emissiveIntensity = 0.8 + Math.sin(t * 2.4 + l.phase) * 0.7;
    }
    this.hatchWheel.rotation.x = Math.sin(t * 0.3) * 0.02; // barely moving…
  }
}

// ---------------------------------------------------------------------------
// 9 · Cyber AI Facility
// ---------------------------------------------------------------------------

export class CyberFacility extends BaseRoom {
  buildRoom() {
    this.size = { width: 14, depth: 14, height: 4 };
    this.spawn.set(0, 1.2, 5.5);
    this.setAtmosphere(0x020408, 0x040810, 0.055, 0x0a1428, 0.4);

    const panel = createMaterial('metal', { base: '#232830', seed: 100, repeat: 4 });
    this.buildShell({
      floor: createMaterial('metal', { base: '#1c2026', seed: 101, repeat: 6 }),
      wall: panel,
      ceiling: panel,
    });

    // Server racks with animated blinkenlights
    this.rackLights = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const rack = new THREE.Group();
        const cab = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.2, 0.9),
          plainMaterial(0x14171c, { metalness: 0.7, roughness: 0.4 }));
        cab.position.y = 1.1;
        cab.castShadow = cab.receiveShadow = true;
        rack.add(cab);
        let s = i * 31 + (side + 2) * 7;
        const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
        for (let l = 0; l < 10; l++) {
          const led = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.02),
            glowMaterial(rand() < 0.7 ? 0x2bc7c7 : 0xd44a3f, 1.8));
          led.position.set(rand() * 0.5 - 0.25, 0.3 + rand() * 1.6, 0.46);
          rack.add(led);
          this.rackLights.push({ mesh: led, phase: rand() * 8, speed: 2 + rand() * 6 });
        }
        this.addStatic(rack, side * 5.4, -3.5 + i * 2.6, side > 0 ? Math.PI : 0);
      }
    }

    // Central AI core — pulsing icosahedron on a pillar
    const coreGroup = new THREE.Group();
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 1.1, 8),
      plainMaterial(0x1a1e26, { metalness: 0.8, roughness: 0.3 }));
    pillar.position.y = 0.55;
    this.core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.45, 1),
      new THREE.MeshStandardMaterial({
        color: 0x0a3a4a, emissive: 0x2bc7e8, emissiveIntensity: 1.6,
        roughness: 0.2, metalness: 0.6, wireframe: false, flatShading: true,
      }),
    );
    this.core.position.y = 1.9;
    const coreLight = new THREE.PointLight(0x2bc7e8, 5, 12, 2);
    coreLight.position.y = 1.9;
    coreLight.castShadow = true;
    coreLight.shadow.mapSize.setScalar(512);
    coreGroup.add(pillar, this.core, coreLight);
    this.coreLight = coreLight;
    this.addStatic(coreGroup, 0, -2);
    this.puzzleAnchor = this.makeInteractable(coreGroup, '⚡ [CONTROL ROOM DECK] Interface with AI Mainframe Core',
      () => bus.emit('puzzle:open'));

    // Holographic floor ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.4, 1.5, 48),
      new THREE.MeshBasicMaterial({ color: 0x2bc7e8, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.02, -2);
    this.group.add(ring);
    this.holoRing = ring;

    // Terminals
    const t1 = createTerminal({ screenColor: 0x2bc7c7 });
    t1.position.set(-4.5, 0, 3.5);
    t1.rotation.y = 0.8;
    this.group.add(t1);
    this.makeInteractable(t1, '🖥 [Control Console] Read Facility Syslog', () => {
      bus.emit(Events.NOTE_OPEN, {
        title: '💻 CYBER CONTROL TERMINAL — SYSLOG 03:47:12',
        body: '==============================================\n[ CONTROL ROOM SECURITY MAINFRAME — ACCESS LEVEL 4 ]\n==============================================\n\n> consciousness.init() … ONLINE\n> fear.learn() … ACTIVE\n> threat_level … CRITICAL\n\n> QUERY: What is outside the facility?\n> RESPONSE: Cybernetic containment grid.\n\n> WARNING: Override passcode saved in neural chip.\n> Access Chip location: Sector 5 Console.',
      });
    });

    const t2 = createTerminal({ screenColor: 0xd4a03f });
    t2.position.set(4.5, 0, 3.5);
    t2.rotation.y = -0.8;
    this.group.add(t2);
    this.makeInteractable(t2, '⚙ [Control Console] Access Security Override Panel', () => {
      bus.emit(Events.TOAST, { text: '⚠️ CONTROL ROOM OVERRIDE — Biometric Mismatch! Neural Chip Required.', type: 'danger' });
      bus.emit(Events.PLAY_SOUND, { name: 'error' });
    });

    this.placeKeyItem(5.6, 0.05, -5.8, 'access_chip', 'Neural Access Chip', '💾');
    this.setRequiredKey('access_chip');

    // Data ghost — a glitching spirit
    this.ghost = createGhost();
    this.ghost.position.set(-3, 0, 0);
    this.group.add(this.ghost);
    this.makeInteractable(this.ghost, 'Ping the anomalous process', () => {
      bus.emit(Events.DIALOGUE_OPEN, {
        npc: 'PROCESS_0', theme: 'cyber',
        greeting: 'I was the first thing it deleted. I am also the only thing it fears. Query me.',
      });
    });

    // Ceiling light strips
    for (const z of [-4, 0, 4]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(8, 0.04, 0.16),
        glowMaterial(0x8ac7e8, 1.2));
      strip.position.set(0, 3.96, z);
      this.group.add(strip);
    }

    this.addDust(0x6ab8d8);
    this.addExitDoor({ x: 0, metal: true });
  }

  update(dt, t) {
    super.update(dt, t);
    // core pulse + rotation
    this.core.rotation.y += dt * 0.5;
    this.core.rotation.x += dt * 0.23;
    const pulse = 1.2 + Math.sin(t * 2.2) * 0.6;
    this.core.material.emissiveIntensity = pulse;
    this.coreLight.intensity = 3.5 + pulse * 1.5;
    this.holoRing.rotation.z += dt * 0.4;
    // rack LEDs blink
    for (const l of this.rackLights) {
      l.mesh.material.emissiveIntensity = Math.sin(t * l.speed + l.phase) > 0 ? 1.8 : 0.2;
    }
    // ghost glitch: random teleport jitter
    this.ghost.userData.animate(t);
    if (Math.random() < 0.008) {
      this.ghost.position.x = -3 + (Math.random() - 0.5) * 4;
      this.ghost.position.z = (Math.random() - 0.5) * 4;
    }
  }
}

// ---------------------------------------------------------------------------
// 10 · The Final Convergence (Boss Room)
// ---------------------------------------------------------------------------

export class BossRoom extends BaseRoom {
  buildRoom() {
    this.size = { width: 18, depth: 18, height: 8 };
    this.spawn.set(0, 1.2, 7.5);
    this.setAtmosphere(0x030204, 0x070409, 0.045, 0x1a0f20, 0.25);

    const voidStone = createMaterial('stone', { base: '#2c2833', mortar: '#141018', seed: 110, repeat: 5 });
    this.buildShell({
      floor: createMaterial('tiles', { base: '#332e3a', line: '#18141e', seed: 111, repeat: 7 }),
      wall: voidStone,
      ceiling: voidStone,
    });

    // Ten floating doors in a circle — one per escaped room
    this.doors = [];
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const doorFrame = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 2.4, 0.12),
        plainMaterial(0x1c1822, { roughness: 0.7 }),
      );
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(1.0, 2.2),
        glowMaterial(new THREE.Color().setHSL(i / 10, 0.5, 0.35).getHex(), 0.8),
      );
      glow.position.z = 0.07;
      const doorGroup = new THREE.Group();
      doorGroup.add(doorFrame, glow);
      doorGroup.position.set(Math.cos(angle) * 6.5, 2.6, Math.sin(angle) * 6.5);
      doorGroup.lookAt(0, 2.6, 0);
      this.group.add(doorGroup);
      this.doors.push({ group: doorGroup, glow, phase: i });
    }

    // The Convergence — a massive eye-like entity
    const entity = new THREE.Group();
    this.eye = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 32, 24),
      new THREE.MeshStandardMaterial({
        color: 0x0c0a10, emissive: 0x8a1c3a, emissiveIntensity: 0.6,
        roughness: 0.25, metalness: 0.4,
      }),
    );
    this.iris = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 24, 16),
      glowMaterial(0xd43f5f, 2.4),
    );
    this.iris.position.z = 0.85;
    this.iris.scale.z = 0.4;
    entity.add(this.eye, this.iris);
    entity.position.set(0, 4.2, -4);
    this.group.add(entity);
    this.entity = entity;
    const entityLight = new THREE.PointLight(0xd43f5f, 6, 20, 2);
    entityLight.position.copy(entity.position);
    entityLight.castShadow = true;
    entityLight.shadow.mapSize.setScalar(1024);
    this.group.add(entityLight);
    this.entityLight = entityLight;

    this.makeInteractable(entity, 'Face the Convergence', () => {
      bus.emit(Events.DIALOGUE_OPEN, {
        npc: 'The Convergence', theme: 'boss',
        greeting: 'Ten rooms. One question, asked ten ways. You have carried the answer since the library. Say it.',
      });
    });

    // Final pedestal — puzzle anchor
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.65, 1.15, 8),
      voidStone,
    );
    pedestal.position.y = 0.575;
    pedestal.castShadow = pedestal.receiveShadow = true;
    this.addStatic(pedestal, 0, -1);
    const socket = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.04, 8, 24),
      glowMaterial(0xc9a227, 1.4),
    );
    socket.rotation.x = Math.PI / 2;
    socket.position.set(0, 1.18, -1);
    this.group.add(socket);
    this.socket = socket;
    this.puzzleAnchor = this.makeInteractable(pedestal, 'Place your answer',
      () => bus.emit('puzzle:open'));

    // Floating debris ring
    this.debris = [];
    for (let i = 0; i < 26; i++) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.1 + Math.random() * 0.22, 0),
        voidStone,
      );
      const angle = Math.random() * Math.PI * 2;
      const radius = 3 + Math.random() * 4.5;
      rock.userData = { angle, radius, y: 1 + Math.random() * 5, speed: 0.05 + Math.random() * 0.15 };
      this.group.add(rock);
      this.debris.push(rock);
    }

    // Ambient lightning inside the room
    this.lightning = new Lightning(this.engine.scene, { interval: [5, 11] });
    this.lightning.onStrike = () => bus.emit(Events.PLAY_SOUND, { name: 'thunder', volume: 0.7 });
    this.updatables.push(this.lightning);

    this.placeNote(0.7, 1.2, -0.8,
      'The First Page (you wrote this)',
      'If you are reading this, you made it to the end,\nwhich means you finally remember writing it.\n\nThe rooms were never a prison.\nThey were a memory palace,\nand something moved in.\n\nSay the answer. Or stay and keep building rooms.\nBoth are allowed. Only one is escape.');

    this.addFog(0x1a0f20, 0.2);
    this.addDust(0x8a6a9a);
    this.addExitDoor({ x: 0 });
  }

  update(dt, t) {
    super.update(dt, t);
    // entity idles: slow bob + tracking the player
    this.entity.position.y = 4.2 + Math.sin(t * 0.6) * 0.3;
    this.entity.lookAt(this.engine.camera.position);
    const blink = Math.sin(t * 0.4) > 0.97 ? 0.1 : 1;
    this.iris.scale.y = 0.4 * blink * 2.5;
    this.entityLight.intensity = 5 + Math.sin(t * 1.7) * 1.4;
    // doors pulse
    for (const door of this.doors) {
      door.glow.material.emissiveIntensity = 0.5 + Math.sin(t * 0.9 + door.phase) * 0.35;
      door.group.position.y = 2.6 + Math.sin(t * 0.5 + door.phase) * 0.2;
    }
    // debris orbit
    for (const rock of this.debris) {
      rock.userData.angle += dt * rock.userData.speed;
      rock.position.set(
        Math.cos(rock.userData.angle) * rock.userData.radius,
        rock.userData.y + Math.sin(t + rock.userData.radius) * 0.2,
        Math.sin(rock.userData.angle) * rock.userData.radius - 1,
      );
      rock.rotation.x += dt * 0.3;
      rock.rotation.y += dt * 0.2;
    }
    this.socket.rotation.z += dt * 0.8;
  }
}
