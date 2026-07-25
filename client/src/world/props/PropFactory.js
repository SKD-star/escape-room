/**
 * PropFactory — procedural 3D props built from primitives + generated
 * materials. Doors, tables, bookshelves, candles, chains, statues,
 * paintings, levers, keypads, beds, crates, barrels, terminals…
 *
 * Every prop is a THREE.Group tagged for shadows; interactables get
 * userData.interactable wired by the room that places them.
 */
import * as THREE from 'three';
import { createMaterial, glowMaterial, plainMaterial } from '../materials/MaterialLibrary.js';

const WOOD_DARK = () => createMaterial('planks', { base: '#3a2a1c', seed: 7, repeat: 1 });
const WOOD_MID = () => createMaterial('planks', { base: '#5a4028', seed: 11, repeat: 1 });
const METAL_RUST = () => createMaterial('metal', { base: '#4a4640', seed: 5, repeat: 1 });

function mesh(geometry, material, { shadow = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  return m;
}

// ---------------------------------------------------------------------------
// Doors & locks
// ---------------------------------------------------------------------------

/** Heavy wooden door with frame; group.userData.open()/close() animate it. */
export function createDoor({ width = 1.1, height = 2.3, metal = false } = {}) {
  const group = new THREE.Group();
  const frameMat = metal ? METAL_RUST() : WOOD_DARK();
  const doorMat = metal ? createMaterial('metal', { base: '#3c4148', seed: 9 }) : WOOD_MID();

  // frame
  const ft = 0.09;
  const left = mesh(new THREE.BoxGeometry(ft, height + ft, 0.22), frameMat);
  left.position.set(-width / 2 - ft / 2, height / 2, 0);
  const right = left.clone(); right.position.x = width / 2 + ft / 2;
  const top = mesh(new THREE.BoxGeometry(width + ft * 2, ft, 0.22), frameMat);
  top.position.set(0, height + ft / 2, 0);
  group.add(left, right, top);

  // door panel pivoted on hinge
  const hinge = new THREE.Group();
  hinge.position.set(-width / 2, 0, 0);
  const panel = mesh(new THREE.BoxGeometry(width, height, 0.07), doorMat);
  panel.position.set(width / 2, height / 2, 0);
  // handle
  const handle = mesh(new THREE.TorusGeometry(0.055, 0.014, 8, 20), plainMaterial(0x8a7a3a, { metalness: 0.9, roughness: 0.35 }));
  handle.position.set(width - 0.12, height / 2, 0.06);
  hinge.add(panel, handle);
  group.add(hinge);

  group.userData.hinge = hinge;
  group.userData.isOpen = false;
  return group;
}

/** Padlock prop for locked things. */
export function createPadlock() {
  const group = new THREE.Group();
  const body = mesh(new THREE.BoxGeometry(0.12, 0.14, 0.05),
    plainMaterial(0x6a6355, { metalness: 0.85, roughness: 0.4 }));
  const shackle = mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 20, Math.PI),
    plainMaterial(0x55504a, { metalness: 0.9, roughness: 0.35 }));
  shackle.position.y = 0.07;
  group.add(body, shackle);
  return group;
}

// ---------------------------------------------------------------------------
// Furniture
// ---------------------------------------------------------------------------

export function createTable({ width = 1.6, depth = 0.8, height = 0.78 } = {}) {
  const group = new THREE.Group();
  const wood = WOOD_MID();
  const top = mesh(new THREE.BoxGeometry(width, 0.05, depth), wood);
  top.position.y = height;
  group.add(top);
  const legGeo = new THREE.BoxGeometry(0.07, height, 0.07);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = mesh(legGeo, wood);
    leg.position.set(sx * (width / 2 - 0.08), height / 2, sz * (depth / 2 - 0.08));
    group.add(leg);
  }
  return group;
}

export function createChair() {
  const group = new THREE.Group();
  const wood = WOOD_DARK();
  const seat = mesh(new THREE.BoxGeometry(0.45, 0.045, 0.45), wood);
  seat.position.y = 0.46;
  const back = mesh(new THREE.BoxGeometry(0.45, 0.5, 0.045), wood);
  back.position.set(0, 0.72, -0.2);
  group.add(seat, back);
  const legGeo = new THREE.BoxGeometry(0.045, 0.46, 0.045);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = mesh(legGeo, wood);
    leg.position.set(sx * 0.19, 0.23, sz * 0.19);
    group.add(leg);
  }
  return group;
}

/** Bookshelf filled with procedural books. May hide a secret lever. */
export function createBookshelf({ width = 1.4, height = 2.2, shelves = 5, seed = 3 } = {}) {
  const group = new THREE.Group();
  const wood = WOOD_DARK();
  const side = new THREE.BoxGeometry(0.05, height, 0.32);
  const l = mesh(side, wood); l.position.set(-width / 2, height / 2, 0);
  const r = mesh(side, wood); r.position.set(width / 2, height / 2, 0);
  const back = mesh(new THREE.BoxGeometry(width, height, 0.02), wood);
  back.position.set(0, height / 2, -0.15);
  group.add(l, r, back);

  let s = seed;
  const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const bookColors = [0x5a2c2c, 0x2c3a5a, 0x3a5a2c, 0x5a4a2c, 0x40304a, 0x30454a];

  for (let i = 0; i <= shelves; i++) {
    const y = (height / shelves) * i;
    const shelf = mesh(new THREE.BoxGeometry(width, 0.035, 0.3), wood);
    shelf.position.set(0, y, 0);
    group.add(shelf);
    if (i === shelves) continue;
    // books
    let x = -width / 2 + 0.06;
    while (x < width / 2 - 0.1) {
      const bw = 0.035 + rand() * 0.035;
      const bh = 0.18 + rand() * 0.1;
      if (rand() < 0.85) {
        const book = mesh(
          new THREE.BoxGeometry(bw, bh, 0.2),
          plainMaterial(bookColors[Math.floor(rand() * bookColors.length)], { roughness: 0.9 }),
        );
        book.position.set(x + bw / 2, y + bh / 2 + 0.02, 0.01);
        book.rotation.z = (rand() - 0.5) * 0.06;
        group.add(book);
      }
      x += bw + 0.006;
    }
  }
  return group;
}

// ---------------------------------------------------------------------------
// Light sources
// ---------------------------------------------------------------------------

/** Candle with flickering point light; userData.flame + userData.light. */
export function createCandle({ height = 0.16, lit = true } = {}) {
  const group = new THREE.Group();
  const wax = mesh(new THREE.CylinderGeometry(0.028, 0.034, height, 10),
    plainMaterial(0xd8cfc0, { roughness: 0.6 }));
  wax.position.y = height / 2;
  group.add(wax);
  if (lit) {
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.016, 0.05, 8),
      glowMaterial(0xffa540, 3),
    );
    flame.position.y = height + 0.03;
    const light = new THREE.PointLight(0xff9540, 2.4, 4.5, 2);
    light.position.y = height + 0.06;
    group.add(flame, light);
    group.userData.flame = flame;
    group.userData.light = light;
    group.userData.baseIntensity = 2.4;
  }
  return group;
}

/** Wall torch. */
export function createTorch() {
  const group = new THREE.Group();
  const stick = mesh(new THREE.CylinderGeometry(0.02, 0.028, 0.5, 8), WOOD_DARK());
  stick.rotation.x = 0.5;
  stick.position.set(0, 0.2, 0.1);
  const bowl = mesh(new THREE.ConeGeometry(0.07, 0.1, 8), METAL_RUST());
  bowl.rotation.x = Math.PI;
  bowl.position.set(0, 0.46, 0.22);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 8), glowMaterial(0xff8530, 3.2));
  flame.position.set(0, 0.56, 0.22);
  const light = new THREE.PointLight(0xff7c33, 3.6, 7, 2);
  light.position.set(0, 0.6, 0.26);
  group.add(stick, bowl, flame, light);
  group.userData.flame = flame;
  group.userData.light = light;
  group.userData.baseIntensity = 3.6;
  return group;
}

// ---------------------------------------------------------------------------
// Decor & story props
// ---------------------------------------------------------------------------

/** Framed painting with procedural creepy canvas. */
export function createPainting({ width = 0.9, height = 1.2, seed = 1 } = {}) {
  const group = new THREE.Group();
  const frame = mesh(new THREE.BoxGeometry(width + 0.1, height + 0.1, 0.05),
    plainMaterial(0x3a2c18, { roughness: 0.65, metalness: 0.2 }));

  // procedural painting: murky portrait silhouette
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 341;
  const ctx = canvas.getContext('2d');
  let s = seed * 7919;
  const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const grad = ctx.createLinearGradient(0, 0, 0, 341);
  grad.addColorStop(0, `rgb(${30 + rand() * 30 | 0},${25 + rand() * 20 | 0},${20 + rand() * 15 | 0})`);
  grad.addColorStop(1, '#0a0806');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 341);
  // silhouette
  ctx.fillStyle = 'rgba(8,6,5,0.9)';
  ctx.beginPath();
  ctx.ellipse(128, 150 + rand() * 30, 42 + rand() * 14, 55 + rand() * 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(128, 300, 80, 110, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  // faint eyes
  if (rand() < 0.6) {
    ctx.fillStyle = `rgba(${180 + rand() * 60 | 0},${160 | 0},120,0.25)`;
    ctx.beginPath(); ctx.arc(112, 140, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(144, 140, 3, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const art = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }),
  );
  art.position.z = 0.028;
  group.add(frame, art);
  return group;
}

/** Robed statue (cone body + sphere head under a hood). */
export function createStatue({ height = 1.9 } = {}) {
  const group = new THREE.Group();
  const stone = createMaterial('stone', { base: '#6a675e', mortar: '#4a4740', seed: 21, repeat: 1 });
  const base = mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.25, 8), stone);
  base.position.y = 0.125;
  const body = mesh(new THREE.ConeGeometry(0.3, height - 0.5, 8), stone);
  body.position.y = (height - 0.5) / 2 + 0.25;
  const head = mesh(new THREE.SphereGeometry(0.14, 10, 8), stone);
  head.position.y = height - 0.2;
  const hood = mesh(new THREE.ConeGeometry(0.2, 0.35, 8), stone);
  hood.position.y = height - 0.1;
  group.add(base, body, head, hood);
  return group;
}

/** Hanging chain made of torus links. */
export function createChain({ links = 8 } = {}) {
  const group = new THREE.Group();
  const mat = plainMaterial(0x4a463f, { metalness: 0.85, roughness: 0.5 });
  const geo = new THREE.TorusGeometry(0.045, 0.012, 6, 12);
  for (let i = 0; i < links; i++) {
    const link = mesh(geo, mat);
    link.position.y = -i * 0.075;
    link.rotation.y = (i % 2) * Math.PI / 2;
    group.add(link);
  }
  return group;
}

export function createCrate({ size = 0.5 } = {}) {
  const crate = mesh(new THREE.BoxGeometry(size, size, size),
    createMaterial('planks', { base: '#4d3a24', seed: 17, repeat: 1 }));
  crate.position.y = size / 2;
  return crate;
}

export function createBarrel() {
  const barrel = mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.75, 12),
    createMaterial('metal', { base: '#42555a', seed: 23, repeat: 1 }));
  barrel.position.y = 0.375;
  return barrel;
}

/** Lever on a wall plate; userData.pull() animates. */
export function createLever() {
  const group = new THREE.Group();
  const plate = mesh(new THREE.BoxGeometry(0.16, 0.3, 0.04), METAL_RUST());
  const arm = new THREE.Group();
  const rod = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.26, 8),
    plainMaterial(0x777066, { metalness: 0.9, roughness: 0.4 }));
  rod.position.y = 0.13;
  const knob = mesh(new THREE.SphereGeometry(0.032, 10, 8),
    plainMaterial(0x8a2222, { roughness: 0.5 }));
  knob.position.y = 0.26;
  arm.add(rod, knob);
  arm.position.z = 0.03;
  arm.rotation.x = -0.9;
  group.add(plate, arm);
  group.userData.arm = arm;
  return group;
}

/** Wall keypad with glowing screen. */
export function createKeypad() {
  const group = new THREE.Group();
  const body = mesh(new THREE.BoxGeometry(0.22, 0.3, 0.05),
    plainMaterial(0x2c2f33, { metalness: 0.6, roughness: 0.5 }));
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.05),
    glowMaterial(0x28c76a, 1.6),
  );
  screen.position.set(0, 0.09, 0.028);
  group.add(body, screen);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const key = mesh(new THREE.BoxGeometry(0.04, 0.03, 0.012),
        plainMaterial(0x484c52, { roughness: 0.6 }));
      key.position.set((col - 1) * 0.055, 0.015 - row * 0.045, 0.028);
      group.add(key);
    }
  }
  group.userData.screen = screen;
  return group;
}

/** Note/letter lying on a surface. */
export function createNote() {
  const note = mesh(
    new THREE.PlaneGeometry(0.21, 0.29),
    plainMaterial(0xcfc5ae, { roughness: 0.95 }),
  );
  note.rotation.x = -Math.PI / 2;
  return note;
}

/** Ancient rolled parchment scroll prop with red ribbon and soft golden glow. */
export function createScroll() {
  const group = new THREE.Group();
  const parchmentMat = plainMaterial(0xded5c0, { roughness: 0.9, metalness: 0.1 });
  const ribbonMat = plainMaterial(0x8a2222, { roughness: 0.6 });

  const roll = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.28, 12), parchmentMat);
  roll.rotation.z = Math.PI / 2;

  const ribbon = mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.04, 12), ribbonMat);
  ribbon.rotation.z = Math.PI / 2;

  const innerRoll = mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.282, 12),
    plainMaterial(0x6b5c47, { roughness: 0.95 }));
  innerRoll.rotation.z = Math.PI / 2;

  group.add(roll, ribbon, innerRoll);

  const glow = new THREE.PointLight(0xd8b040, 0.9, 2.0, 2);
  glow.position.y = 0.15;
  group.add(glow);

  return group;
}

/** Old-fashioned key. */
export function createKey() {
  const group = new THREE.Group();
  const mat = plainMaterial(0xb08d2a, { metalness: 0.9, roughness: 0.3 });
  const ring = mesh(new THREE.TorusGeometry(0.035, 0.008, 8, 16), mat);
  const shaft = mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.12, 8), mat);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.x = 0.09;
  const tooth1 = mesh(new THREE.BoxGeometry(0.016, 0.028, 0.008), mat);
  tooth1.position.set(0.135, -0.02, 0);
  const tooth2 = tooth1.clone(); tooth2.position.x = 0.115;
  group.add(ring, shaft, tooth1, tooth2);
  return group;
}

/** Flashlight battery cell — collectible; faint glow so it can be spotted. */
export function createBattery() {
  const group = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 10),
    plainMaterial(0x3a4045, { metalness: 0.7, roughness: 0.35 }));
  body.position.y = 0.05;
  const stripe = mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.03, 10),
    glowMaterial(0xd8b040, 0.5));
  stripe.position.y = 0.075;
  const cap = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 8),
    plainMaterial(0x8a8f94, { metalness: 0.9, roughness: 0.3 }));
  cap.position.y = 0.106;
  group.add(body, stripe, cap);
  return group;
}

/** Ghost — translucent hooded figure that drifts; userData.animate(t). */
export function createGhost() {
  const group = new THREE.Group();

  // Ethereal translucent material for main body
  const mat = new THREE.MeshStandardMaterial({
    color: 0x64b5f6,
    emissive: 0x1e88e5,
    transparent: true,
    opacity: 0.45,
    emissiveIntensity: 0.9,
    depthWrite: false,
    roughness: 0.3,
    side: THREE.DoubleSide,
  });

  // Inner core glow
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0x90caf9,
    transparent: true,
    opacity: 0.6,
  });

  const body = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.6, 24), mat);
  body.position.y = 0.8;
  const innerCore = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.3, 16), innerMat);
  innerCore.position.y = 0.8;

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 18), mat);
  head.position.y = 1.62;

  group.add(body, innerCore, head);

  // Ethereal glowing spectral eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 12), eyeMat);
  eyeL.position.set(-0.065, 1.65, 0.16);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 12), eyeMat);
  eyeR.position.set(0.065, 1.65, 0.16);
  group.add(eyeL, eyeR);

  // Floating spectral book floating before her
  const bookCoverMat = new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.5 });
  const bookPagesMat = new THREE.MeshBasicMaterial({ color: 0xffecb3 });
  const book = new THREE.Group();
  const cover = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.04, 0.35), bookCoverMat);
  const pages = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.035, 0.33), bookPagesMat);
  book.add(cover, pages);
  book.position.set(0, 1.05, 0.42);
  book.rotation.x = 0.35;
  group.add(book);

  // Floating particle wisps orbiting the ghost librarian
  const wispGeo = new THREE.SphereGeometry(0.03, 8, 8);
  const wispMat = new THREE.MeshBasicMaterial({ color: 0x80deea, transparent: true, opacity: 0.8 });
  const wisps = [];
  for (let i = 0; i < 3; i++) {
    const wisp = new THREE.Mesh(wispGeo, wispMat);
    group.add(wisp);
    wisps.push(wisp);
  }

  // Double floating spectral aura rings at the base
  const auraGeo1 = new THREE.TorusGeometry(0.48, 0.02, 12, 32);
  const auraMat1 = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.5 });
  const aura1 = new THREE.Mesh(auraGeo1, auraMat1);
  aura1.rotation.x = Math.PI / 2;
  aura1.position.y = 0.2;

  const auraGeo2 = new THREE.TorusGeometry(0.35, 0.015, 12, 32);
  const auraMat2 = new THREE.MeshBasicMaterial({ color: 0x80deea, transparent: true, opacity: 0.35 });
  const aura2 = new THREE.Mesh(auraGeo2, auraMat2);
  aura2.rotation.x = Math.PI / 2;
  aura2.position.y = 0.32;
  group.add(aura1, aura2);

  const light = new THREE.PointLight(0x00e5ff, 2.2, 7, 2);
  light.position.y = 1.4;
  group.add(light);

  // Generous hit proxy
  const hit = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.75, 1.5, 4, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  hit.position.y = 0.95;
  group.add(hit);

  group.userData.animate = (t) => {
    group.position.y = Math.sin(t * 0.9) * 0.18;
    group.rotation.y = Math.sin(t * 0.3) * 0.12;
    mat.opacity = 0.35 + Math.abs(Math.sin(t * 0.6)) * 0.2;
    aura1.rotation.z = t * 0.8;
    aura2.rotation.z = -t * 1.2;
    book.position.y = 1.05 + Math.sin(t * 1.8) * 0.04;
    book.rotation.y = Math.sin(t * 0.9) * 0.1;

    wisps.forEach((wisp, i) => {
      const angle = t * 1.5 + (i * Math.PI * 2) / 3;
      wisp.position.x = Math.cos(angle) * 0.55;
      wisp.position.z = Math.sin(angle) * 0.55;
      wisp.position.y = 1.3 + Math.sin(t * 2 + i) * 0.2;
    });

    light.intensity = 1.8 + Math.sin(t * 2.1) * 0.6;
  };

  return group;
}

/** Sci-fi terminal with emissive screen. */
export function createTerminal({ screenColor = 0x2bc7c7 } = {}) {
  const group = new THREE.Group();
  const stand = mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.85, 8),
    plainMaterial(0x30343a, { metalness: 0.7, roughness: 0.4 }));
  stand.position.y = 0.425;
  const screenBox = mesh(new THREE.BoxGeometry(0.6, 0.4, 0.04),
    plainMaterial(0x24272c, { metalness: 0.6, roughness: 0.45 }));
  screenBox.position.y = 1.1;
  screenBox.rotation.x = -0.18;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.34), glowMaterial(screenColor, 1.4));
  screen.position.set(0, 1.1, 0.025);
  screen.rotation.x = -0.18;
  group.add(stand, screenBox, screen);
  group.userData.screen = screen;
  return group;
}

/** Hospital gurney/bed. */
export function createGurney() {
  const group = new THREE.Group();
  const metal = plainMaterial(0x8a8f94, { metalness: 0.8, roughness: 0.35 });
  const frame = mesh(new THREE.BoxGeometry(0.7, 0.06, 1.9), metal);
  frame.position.y = 0.62;
  const mattress = mesh(new THREE.BoxGeometry(0.66, 0.08, 1.85),
    plainMaterial(0x9a9584, { roughness: 0.95 }));
  mattress.position.y = 0.69;
  group.add(frame, mattress);
  const legGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = mesh(legGeo, metal);
    leg.position.set(sx * 0.3, 0.31, sz * 0.85);
    group.add(leg);
  }
  return group;
}
