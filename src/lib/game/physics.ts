// Shared voxel physics: AABB movement, ground checks and DDA raycasting.
import * as THREE from "three";
import { BLOCKS } from "./registry";
import { VoxelWorld } from "./world";

export function isSolidAt(world: VoxelWorld, x: number, y: number, z: number): boolean {
  const b = BLOCKS[world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z))];
  return Boolean(b && b.solid);
}

function boxCollides(world: VoxelWorld, cx: number, feetY: number, cz: number, hw: number, h: number): boolean {
  for (let x = Math.floor(cx - hw); x <= Math.floor(cx + hw); x++) {
    for (let y = Math.floor(feetY); y <= Math.floor(feetY + h); y++) {
      for (let z = Math.floor(cz - hw); z <= Math.floor(cz + hw); z++) {
        const b = BLOCKS[world.getBlock(x, y, z)];
        if (!b || !b.solid) continue;
        if (cx + hw > x && cx - hw < x + 1 && feetY + h > y && feetY < y + 1 && cz + hw > z && cz - hw < z + 1) return true;
      }
    }
  }
  return false;
}

export interface MoveResult {
  onGround: boolean;
  hitWall: boolean;
}

/** Moves an entity (feet position, half-width, height) with per-axis collision resolution. */
export function moveEntity(
  world: VoxelWorld,
  pos: THREE.Vector3,
  vel: THREE.Vector3,
  hw: number,
  h: number,
  dt: number,
): MoveResult {
  let onGround = false;
  let hitWall = false;
  const steps = Math.max(1, Math.ceil((Math.abs(vel.x) + Math.abs(vel.y) + Math.abs(vel.z)) * dt / 0.2));
  const sdt = dt / steps;
  for (let s = 0; s < steps; s++) {
    // vertical
    const dy = vel.y * sdt;
    if (dy !== 0) {
      if (!boxCollides(world, pos.x, pos.y + dy, pos.z, hw, h)) pos.y += dy;
      else {
        if (dy < 0) onGround = true;
        vel.y = 0;
      }
    }
    // horizontal X
    const dx = vel.x * sdt;
    if (dx !== 0) {
      if (!boxCollides(world, pos.x + dx, pos.y, pos.z, hw, h)) pos.x += dx;
      else {
        vel.x = 0;
        hitWall = true;
      }
    }
    // horizontal Z
    const dz = vel.z * sdt;
    if (dz !== 0) {
      if (!boxCollides(world, pos.x, pos.y, pos.z + dz, hw, h)) pos.z += dz;
      else {
        vel.z = 0;
        hitWall = true;
      }
    }
  }
  if (!onGround && boxCollides(world, pos.x, pos.y - 0.08, pos.z, hw, h)) onGround = true;
  return { onGround, hitWall };
}

export function inWater(world: VoxelWorld, pos: THREE.Vector3, h: number): boolean {
  for (const dy of [0.2, h * 0.6]) {
    const id = world.getBlock(Math.floor(pos.x), Math.floor(pos.y + dy), Math.floor(pos.z));
    if (BLOCKS[id]?.liquid) return true;
  }
  return false;
}

export interface RayHit {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  dist: number;
}

/** Amanatides & Woo voxel traversal. */
export function raycast(world: VoxelWorld, origin: THREE.Vector3, dir: THREE.Vector3, maxDist = 6): RayHit | null {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);
  const stepX = Math.sign(dir.x) || 1;
  const stepY = Math.sign(dir.y) || 1;
  const stepZ = Math.sign(dir.z) || 1;
  const tDeltaX = Math.abs(1 / (dir.x || 1e-9));
  const tDeltaY = Math.abs(1 / (dir.y || 1e-9));
  const tDeltaZ = Math.abs(1 / (dir.z || 1e-9));
  const boundX = stepX > 0 ? x + 1 - origin.x : origin.x - x;
  const boundY = stepY > 0 ? y + 1 - origin.y : origin.y - y;
  const boundZ = stepZ > 0 ? z + 1 - origin.z : origin.z - z;
  let tMaxX = tDeltaX * boundX;
  let tMaxY = tDeltaY * boundY;
  let tMaxZ = tDeltaZ * boundZ;
  let nx = 0;
  let ny = 0;
  let nz = 0;
  let dist = 0;
  for (let i = 0; i < 256 && dist <= maxDist; i++) {
    const id = world.getBlock(x, y, z);
    const def = BLOCKS[id];
    if (def && id !== 0 && !def.liquid) return { x, y, z, nx, ny, nz, dist };
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      dist = tMaxX;
      tMaxX += tDeltaX;
      nx = -stepX;
      ny = 0;
      nz = 0;
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      dist = tMaxY;
      tMaxY += tDeltaY;
      nx = 0;
      ny = -stepY;
      nz = 0;
    } else {
      z += stepZ;
      dist = tMaxZ;
      tMaxZ += tDeltaZ;
      nx = 0;
      ny = 0;
      nz = -stepZ;
    }
  }
  return null;
}
