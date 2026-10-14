// Chunk management, meshing, block edits and save payloads.
import * as THREE from "three";
import { buildChunkGeometry } from "./mesher";
import { AIR, BLOCKS } from "./registry";
import { Chunk, CHUNK_SIZE, MobSpawn, WorldGen, WORLD_HEIGHT } from "./worldgen";
import { getAtlasTexture } from "./textures";

export const chunkKey = (cx: number, cz: number) => `${cx},${cz}`;
export const blockKey = (x: number, y: number, z: number) => `${x},${y},${z}`;

export interface SavedEdit {
  x: number;
  y: number;
  z: number;
  block: number;
}

export class VoxelWorld {
  gen: WorldGen;
  chunks = new Map<string, Chunk>();
  meshes = new Map<string, THREE.Group>();
  lights = new Map<string, THREE.Vector3[]>();
  edits = new Map<string, number>();
  pendingEdits = new Map<string, number>();
  spawnQueue: MobSpawn[] = [];
  group = new THREE.Group();
  matSolid: THREE.MeshLambertMaterial;
  matCutout: THREE.MeshLambertMaterial;
  matWater: THREE.MeshLambertMaterial;

  constructor(public seed: number) {
    this.gen = new WorldGen(seed);
    const map = getAtlasTexture();
    this.matSolid = new THREE.MeshLambertMaterial({ map, vertexColors: true });
    this.matCutout = new THREE.MeshLambertMaterial({
      map,
      vertexColors: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
    this.matWater = new THREE.MeshLambertMaterial({
      map,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  getBlock(x: number, y: number, z: number): number {
    if (y < 0 || y >= WORLD_HEIGHT) return AIR;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return AIR;
    return chunk.get(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE);
  }

  setBlock(x: number, y: number, z: number, id: number, record = true) {
    if (y < 0 || y >= WORLD_HEIGHT) return;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return;
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    chunk.set(lx, y, lz, id);
    if (record) {
      const k = blockKey(x, y, z);
      this.edits.set(k, id);
      this.pendingEdits.set(k, id);
    }
    this.remesh(cx, cz);
    // neighbouring chunk meshes may need updating on borders
    if (lx === 0) this.remesh(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.remesh(cx + 1, cz);
    if (lz === 0) this.remesh(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.remesh(cx, cz + 1);
  }

  ensureChunk(cx: number, cz: number): Chunk {
    const key = chunkKey(cx, cz);
    const existing = this.chunks.get(key);
    if (existing) return existing;
    const chunk = new Chunk(cx, cz);
    this.gen.generateTerrain(chunk);
    this.gen.generateDecorations(chunk);
    const villagerSpawns = this.gen.generateVillage(chunk);
    for (const s of villagerSpawns) this.spawnQueue.push(s);
    for (const s of this.gen.ambientSpawns(chunk)) this.spawnQueue.push(s);
    // apply saved edits
    for (const [k, v] of this.edits) {
      const parts = k.split(",");
      const ex = Number(parts[0]);
      const ey = Number(parts[1]);
      const ez = Number(parts[2]);
      if (Math.floor(ex / CHUNK_SIZE) === cx && Math.floor(ez / CHUNK_SIZE) === cz) {
        chunk.set(ex - cx * CHUNK_SIZE, ey, ez - cz * CHUNK_SIZE, v);
      }
    }
    this.chunks.set(key, chunk);
    // collect light sources
    const lights: THREE.Vector3[] = [];
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const id = chunk.get(x, y, z);
          if (id === AIR) continue;
          const def = BLOCKS[id];
          if (def?.light) lights.push(new THREE.Vector3(cx * CHUNK_SIZE + x + 0.5, y + 0.5, cz * CHUNK_SIZE + z + 0.5));
        }
      }
    }
    this.lights.set(key, lights);
    return chunk;
  }

  buildMesh(cx: number, cz: number) {
    const key = chunkKey(cx, cz);
    const chunk = this.chunks.get(key);
    if (!chunk) return;
    this.disposeMesh(key);
    const geo = buildChunkGeometry(
      (x, y, z) => {
        const ccx = Math.floor(x / CHUNK_SIZE);
        const ccz = Math.floor(z / CHUNK_SIZE);
        const c = this.chunks.get(chunkKey(ccx, ccz));
        if (!c) return AIR;
        return c.get(x - ccx * CHUNK_SIZE, y, z - ccz * CHUNK_SIZE);
      },
      cx * CHUNK_SIZE,
      cz * CHUNK_SIZE,
    );
    const group = new THREE.Group();
    if (geo.solid) group.add(new THREE.Mesh(geo.solid, this.matSolid));
    if (geo.cutout) group.add(new THREE.Mesh(geo.cutout, this.matCutout));
    if (geo.water) {
      const m = new THREE.Mesh(geo.water, this.matWater);
      m.renderOrder = 2;
      group.add(m);
    }
    group.frustumCulled = true;
    this.meshes.set(key, group);
    this.group.add(group);
  }

  private disposeMesh(key: string) {
    const old = this.meshes.get(key);
    if (!old) return;
    for (const child of old.children) {
      const mesh = child as THREE.Mesh;
      mesh.geometry.dispose();
    }
    this.group.remove(old);
    this.meshes.delete(key);
  }

  private remesh(cx: number, cz: number) {
    if (!this.chunks.has(chunkKey(cx, cz))) return;
    this.buildMesh(cx, cz);
  }

  /** Streams chunks around the player. Returns true when there is work left. */
  update(px: number, pz: number, renderDistance: number, maxWorkMs = 8): boolean {
    const start = performance.now();
    const pcx = Math.floor(px / CHUNK_SIZE);
    const pcz = Math.floor(pz / CHUNK_SIZE);
    // generate missing chunks (closest first)
    const todo: Array<[number, number, number]> = [];
    for (let dx = -renderDistance; dx <= renderDistance; dx++) {
      for (let dz = -renderDistance; dz <= renderDistance; dz++) {
        const dist = dx * dx + dz * dz;
        if (dist > renderDistance * renderDistance + 1) continue;
        const cx = pcx + dx;
        const cz = pcz + dz;
        if (!this.chunks.has(chunkKey(cx, cz))) todo.push([dist, cx, cz]);
      }
    }
    todo.sort((a, b) => a[0] - b[0]);
    for (const [, cx, cz] of todo) {
      this.ensureChunk(cx, cz);
      if (performance.now() - start > maxWorkMs) return true;
    }
    // mesh un-meshed chunks
    let pending = false;
    for (let dx = -renderDistance; dx <= renderDistance && !pending; dx++) {
      for (let dz = -renderDistance; dz <= renderDistance; dz++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        const key = chunkKey(cx, cz);
        if (!this.chunks.has(key) || this.meshes.has(key)) continue;
        this.buildMesh(cx, cz);
        if (performance.now() - start > maxWorkMs) {
          pending = true;
          break;
        }
      }
    }
    // unload far chunks
    const limit = (renderDistance + 2) * CHUNK_SIZE;
    for (const key of [...this.chunks.keys()]) {
      const [cx, cz] = key.split(",").map(Number);
      if (Math.abs(cx * CHUNK_SIZE - px) > limit || Math.abs(cz * CHUNK_SIZE - pz) > limit) {
        this.chunks.delete(key);
        this.disposeMesh(key);
        this.lights.delete(key);
      }
    }
    return pending || todo.length > 0;
  }

  highestSolid(x: number, z: number): number {
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      const b = BLOCKS[this.getBlock(x, y, z)];
      if (b && b.solid) return y;
    }
    return this.gen.terrainHeight(x, z);
  }

  applySavedEdits(list: SavedEdit[]) {
    for (const e of list) {
      this.edits.set(blockKey(e.x, e.y, e.z), e.block);
    }
  }

  takePendingEdits(): SavedEdit[] {
    const out: SavedEdit[] = [];
    for (const [k, block] of this.pendingEdits) {
      const [x, y, z] = k.split(",").map(Number);
      out.push({ x, y, z, block });
    }
    this.pendingEdits.clear();
    return out;
  }
}
