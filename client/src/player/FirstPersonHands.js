/**
 * FirstPersonHands — Advanced AAA Dual-Hand Articulated Glove Rig.
 *
 * Renders high-detail left and right gloved arms in first-person view:
 *  - Articulated finger joints with dynamic flex/curl states (Idle, Small Grip, Heavy Cradle, Pointing Press)
 *  - 2nd-order spring-damped inertia for realistic mouse look sway
 *  - Figure-8 dual-phase walking and sprinting bobbing
 *  - Reaching, gripping, button-pressing, and two-phase impulse throw animations
 */
import * as THREE from 'three';
import { gsap } from 'gsap';
import { plainMaterial, glowMaterial } from '../world/materials/MaterialLibrary.js';

export class FirstPersonHands {
  /**
   * @param {import('../core/Engine.js').Engine} engine
   */
  constructor(engine) {
    this.engine = engine;
    this.camera = engine.camera;

    // Main rig root attached to camera
    this.root = new THREE.Group();
    this.camera.add(this.root);

    // Right & Left Arm Groups
    this.rightHand = new THREE.Group();
    this.leftHand = new THREE.Group();
    this.root.add(this.rightHand, this.leftHand);

    // Rest positions relative to camera
    this.rightRestPos = new THREE.Vector3(0.25, -0.25, -0.46);
    this.rightRestRot = new THREE.Euler(-0.15, -0.3, 0.08);

    this.leftRestPos = new THREE.Vector3(-0.25, -0.26, -0.46);
    this.leftRestRot = new THREE.Euler(-0.15, 0.3, -0.08);

    this.rightHand.position.copy(this.rightRestPos);
    this.rightHand.rotation.copy(this.rightRestRot);

    this.leftHand.position.copy(this.leftRestPos);
    this.leftHand.rotation.copy(this.leftRestRot);

    // Finger joint references for procedural flexing
    this.rightFingers = [];
    this.leftFingers = [];

    // Materials
    this.sleeveMat = plainMaterial(0x181c22, { roughness: 0.85, metalness: 0.15 });
    this.gloveMat = plainMaterial(0x322a24, { roughness: 0.65, metalness: 0.3 });
    this.plateMat = plainMaterial(0x22262d, { roughness: 0.4, metalness: 0.7 });
    this.strapMat = plainMaterial(0x121418, { roughness: 0.9 });

    // Build Dual Hand Rigs
    this.buildArm(this.rightHand, true);
    this.buildArm(this.leftHand, false);

    // Initially hide left hand until holding large 2-handed items
    this.leftHand.visible = false;

    // Item container on right hand
    this.heldContainer = new THREE.Group();
    this.heldContainer.position.set(0, 0.05, -0.12);
    this.rightHand.add(this.heldContainer);

    // Item illumination light
    this.itemGlow = new THREE.PointLight(0xffc857, 0, 1.8);
    this.itemGlow.position.set(0, 0.08, -0.08);
    this.rightHand.add(this.itemGlow);

    // Inertia spring physics state
    this.swayX = 0;
    this.swayY = 0;
    this.velX = 0;
    this.velY = 0;
    this.bobTime = 0;
    this.isHolding = false;
    this.fingerState = 'idle';
  }

  /** Build single articulated gloved arm */
  buildArm(armGroup, isRight) {
    const side = isRight ? 1 : -1;

    // 1. Forearm sleeve
    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.046, 0.056, 0.38, 12),
      this.sleeveMat
    );
    sleeve.rotation.x = Math.PI / 2.7;
    sleeve.position.set(0, -0.04, 0.16);
    armGroup.add(sleeve);

    // Sleeve Cuff Ring
    const cuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12),
      this.strapMat
    );
    cuff.rotation.x = Math.PI / 2.7;
    cuff.position.set(0, 0.02, 0.03);
    armGroup.add(cuff);

    // 2. Glove Palm & Knuckle Armor Plate
    const palm = new THREE.Mesh(
      new THREE.BoxGeometry(0.082, 0.036, 0.095),
      this.gloveMat
    );
    palm.position.set(0, 0.035, -0.03);
    armGroup.add(palm);

    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.076, 0.008, 0.045),
      this.plateMat
    );
    plate.position.set(0, 0.056, -0.03);
    armGroup.add(plate);

    // Wrist Strap
    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(0.086, 0.015, 0.025),
      this.strapMat
    );
    strap.position.set(0, 0.036, 0.01);
    armGroup.add(strap);

    // 3. Articulated Jointed Fingers (4 fingers + 1 thumb)
    const fingerStore = isRight ? this.rightFingers : this.leftFingers;
    const fingerOffsetsX = [-0.03, -0.01, 0.01, 0.03];

    for (let f = 0; f < 4; f++) {
      const fingerRoot = new THREE.Group();
      fingerRoot.position.set(fingerOffsetsX[f] * side, 0.036, -0.075);

      // Proximal Phalanx (knuckle segment)
      const seg1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.016, 0.015, 0.038),
        this.gloveMat
      );
      seg1.position.z = -0.019;
      fingerRoot.add(seg1);

      // Distal Phalanx (tip segment)
      const seg2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.015, 0.014, 0.032),
        this.gloveMat
      );
      seg2.position.z = -0.034;
      seg1.add(seg2);

      armGroup.add(fingerRoot);
      fingerStore.push({ root: fingerRoot, seg1, seg2 });
    }

    // Articulated Thumb
    const thumbRoot = new THREE.Group();
    thumbRoot.position.set(-0.044 * side, 0.038, -0.02);
    thumbRoot.rotation.set(-0.2, 0.5 * side, -0.3 * side);

    const thumbSeg1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.016, 0.038),
      this.gloveMat
    );
    thumbSeg1.position.z = -0.019;
    thumbRoot.add(thumbSeg1);

    const thumbSeg2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, 0.014, 0.028),
      this.gloveMat
    );
    thumbSeg2.position.z = -0.032;
    thumbSeg1.add(thumbSeg2);

    armGroup.add(thumbRoot);
    fingerStore.push({ root: thumbRoot, seg1: thumbSeg1, seg2: thumbSeg2 });
  }

  /** Set procedural finger flex angles based on action state */
  setFingerState(state) {
    this.fingerState = state;
    const isGrip = state === 'gripSmall' || state === 'gripLarge';

    this.rightFingers.forEach((f, idx) => {
      if (idx === 4) { // Thumb
        const flex = isGrip ? 0.6 : 0.2;
        gsap.to(f.root.rotation, { x: -0.2, y: 0.4, z: flex, duration: 0.2 });
      } else {
        let flex1 = 0.25;
        let flex2 = 0.35;
        if (state === 'gripSmall') { flex1 = 0.8; flex2 = 0.9; }
        if (state === 'gripLarge') { flex1 = 0.55; flex2 = 0.6; }
        if (state === 'point' && idx === 0) { flex1 = 0.05; flex2 = 0.05; } // Index finger points straight out
        gsap.to(f.root.rotation, { x: flex1, duration: 0.2 });
        gsap.to(f.seg1.rotation, { x: flex2, duration: 0.2 });
      }
    });
  }

  /** 2nd-Order Spring Inertia & Figure-8 Bobbing */
  update(dt, speed = 0, isSprinting = false, mouseX = 0, mouseY = 0) {
    // 2nd-order spring damped mouse sway
    this.velX += (-mouseX * 0.0006 - this.swayX) * 16 * dt;
    this.velY += (mouseY * 0.0006 - this.swayY) * 16 * dt;
    this.velX *= Math.exp(-12 * dt);
    this.velY *= Math.exp(-12 * dt);
    this.swayX += this.velX;
    this.swayY += this.velY;

    // Figure-8 Dual-Hand Bobbing
    if (speed > 0.5) {
      const freq = isSprinting ? 14 : 9;
      const amp = isSprinting ? 0.038 : 0.018;
      this.bobTime += dt * freq;

      const bobX = Math.cos(this.bobTime * 0.5) * amp * 0.85;
      const bobY = Math.abs(Math.sin(this.bobTime)) * amp;

      this.rightHand.position.x = this.rightRestPos.x + this.swayX + bobX;
      this.rightHand.position.y = this.rightRestPos.y + this.swayY + bobY;

      this.leftHand.position.x = this.leftRestPos.x + this.swayX - bobX;
      this.leftHand.position.y = this.leftRestPos.y + this.swayY + bobY;
    } else {
      // Idle Breathing Sway
      this.bobTime += dt * 2;
      const breathY = Math.sin(this.bobTime) * 0.004;

      this.rightHand.position.x = THREE.MathUtils.lerp(this.rightHand.position.x, this.rightRestPos.x + this.swayX, dt * 8);
      this.rightHand.position.y = THREE.MathUtils.lerp(this.rightHand.position.y, this.rightRestPos.y + this.swayY + breathY, dt * 8);

      this.leftHand.position.x = THREE.MathUtils.lerp(this.leftHand.position.x, this.leftRestPos.x + this.swayX, dt * 8);
      this.leftHand.position.y = THREE.MathUtils.lerp(this.leftHand.position.y, this.leftRestPos.y + this.swayY + breathY, dt * 8);
    }
  }

  /** Animate reaching and gripping an item */
  animatePickup() {
    this.isHolding = true;
    this.setFingerState('gripSmall');

    gsap.killTweensOf(this.rightHand.position);
    gsap.killTweensOf(this.rightHand.rotation);

    const tl = gsap.timeline();
    tl.to(this.rightHand.position, { z: -0.34, y: -0.16, duration: 0.12, ease: 'power2.out' })
      .to(this.rightHand.position, {
        x: this.rightRestPos.x, y: this.rightRestPos.y, z: this.rightRestPos.z,
        duration: 0.22, ease: 'back.out(1.4)'
      });

    gsap.to(this.itemGlow, { intensity: 1.5, duration: 0.3 });
  }

  /** Animate index finger pressing a button / keypad */
  animatePress(callback) {
    this.setFingerState('point');
    gsap.killTweensOf(this.rightHand.position);

    const tl = gsap.timeline();
    tl.to(this.rightHand.position, { z: -0.32, y: -0.14, duration: 0.1, ease: 'power2.out' })
      .to(this.rightHand.position, {
        z: this.rightRestPos.z, y: this.rightRestPos.y, duration: 0.18, ease: 'power1.inOut',
        onComplete: () => {
          this.setFingerState('idle');
          if (callback) callback();
        }
      });
  }

  /** Explosive two-phase impulse throw animation */
  animateThrow(callback) {
    gsap.killTweensOf(this.rightHand.position);
    gsap.killTweensOf(this.rightHand.rotation);

    // Phase 1: Wind-up back to shoulder
    // Phase 2: Explosive thrust forward & fingers open
    const tl = gsap.timeline();
    tl.to(this.rightHand.position, { z: -0.4, x: 0.32, y: -0.3, duration: 0.08, ease: 'power1.in' })
      .to(this.rightHand.position, {
        z: -0.88, x: 0.04, y: -0.04, duration: 0.09, ease: 'power4.out',
        onStart: () => this.setFingerState('idle'),
        onComplete: () => {
          this.isHolding = false;
          gsap.to(this.itemGlow, { intensity: 0, duration: 0.2 });
          if (callback) callback();
        }
      })
      .to(this.rightHand.position, {
        x: this.rightRestPos.x, y: this.rightRestPos.y, z: this.rightRestPos.z,
        duration: 0.28, ease: 'power2.out'
      });
  }

  /** Animate lowering hand when dropping an item */
  animateDrop() {
    this.isHolding = false;
    this.setFingerState('idle');

    gsap.killTweensOf(this.rightHand.position);
    gsap.to(this.rightHand.position, { y: -0.48, duration: 0.14, onComplete: () => {
      gsap.to(this.rightHand.position, { y: this.rightRestPos.y, duration: 0.22 });
    }});
    gsap.to(this.itemGlow, { intensity: 0, duration: 0.2 });
  }
}
