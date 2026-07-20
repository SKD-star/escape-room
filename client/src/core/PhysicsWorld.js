/**
 * PhysicsWorld — Rapier 3D (WASM) wrapper.
 * Owns the physics world, fixed-step simulation, and helpers for
 * creating colliders for rooms/props plus the kinematic player body.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

let rapierReady = null;

/** Initialize the WASM module once. */
export function initRapier() {
  if (!rapierReady) rapierReady = RAPIER.init();
  return rapierReady;
}

export class PhysicsWorld {
  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;
    this.accumulator = 0;
    /** @type {Map<RAPIER.RigidBody, THREE.Object3D>} dynamic body → mesh sync */
    this.dynamicPairs = new Map();
  }

  /** Fixed-step update; call every frame with render dt. */
  update(dt) {
    this.accumulator = Math.min(this.accumulator + dt, 0.25);
    while (this.accumulator >= this.world.timestep) {
      this.world.step();
      this.accumulator -= this.world.timestep;
    }
    // Sync dynamic bodies to their meshes
    for (const [body, mesh] of this.dynamicPairs) {
      const t = body.translation();
      const r = body.rotation();
      mesh.position.set(t.x, t.y, t.z);
      mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }

  /** Static cuboid collider (walls, floors, furniture). */
  addStaticBox(position, halfExtents, rotationY = 0) {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(position.x, position.y, position.z)
        .setRotation(quatFromY(rotationY)),
    );
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z),
      body,
    );
    return { body, collider };
  }

  /** Dynamic box tied to a mesh (throwable/pushable props). */
  addDynamicBox(mesh, halfExtents, { mass = 1, restitution = 0.15 } = {}) {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
        .setRotation({
          x: mesh.quaternion.x, y: mesh.quaternion.y,
          z: mesh.quaternion.z, w: mesh.quaternion.w,
        })
        .setLinearDamping(0.15)
        .setAngularDamping(0.4),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
        .setMass(mass)
        .setRestitution(restitution)
        .setFriction(0.8),
      body,
    );
    this.dynamicPairs.set(body, mesh);
    mesh.userData.physicsBody = body;
    return body;
  }

  /** Kinematic character body + Rapier's built-in character controller. */
  createCharacter(position, radius, halfHeight) {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(position.x, position.y, position.z),
    );
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(halfHeight, radius), body,
    );
    // Reuse one controller across room transitions (controllers are not
    // rigid bodies, so they survive clear()).
    if (!this.characterController) {
      const controller = this.world.createCharacterController(0.02);
      controller.setUp({ x: 0, y: 1, z: 0 });
      controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
      controller.enableAutostep(0.35, 0.25, true);
      controller.enableSnapToGround(0.35);
      controller.setApplyImpulsesToDynamicBodies(true);
      this.characterController = controller;
    }
    return { body, collider, controller: this.characterController };
  }

  removeBody(body) {
    this.dynamicPairs.delete(body);
    this.world.removeRigidBody(body);
  }

  /** Remove every body/collider (room transitions). Player is recreated after. */
  clear() {
    this.dynamicPairs.clear();
    const bodies = [];
    this.world.bodies.forEach((b) => bodies.push(b));
    for (const b of bodies) this.world.removeRigidBody(b);
  }
}

function quatFromY(angle) {
  const half = angle / 2;
  return { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) };
}
