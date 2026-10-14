// Deterministic world generation: biomes, rivers, lakes, caves, ores, trees, villages.
import { Noise, clamp, mulberry32 } from "./noise";
import { AIR, BLOCKS } from "./registry";

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 72;
export const SEA_LEVEL = 28;

export type Biome = "plains" | "forest" | "desert" | "taiga" | "mountains" | "beach";
export type MobKind = "pig" | "cow" | "sheep" | "chicken" | "zombie" | "villager" | "skeleton";

export interface MobSpawn {
  kind: MobKind;
  x: number;
  y: number;
  z: number;
}

const B = {
  air: 0,
  grass: 1,
  dirt: 2,
  stone: 3,
  cobble: 4,
  sand: 5,
  sandstone: 6,
  gravel: 7,
  oakLog: 8,
  oakLeaves: 9,
  planks: 10,
  water: 11,
  glass: 12,
  coal: 13,
  iron: 14,
  gold: 15,
  diamond: 16,
  bedrock: 17,
  snow: 18,
  ice: 19,
  cactus: 20,
  pumpkin: 21,
  wool: 22,
  bricks: 23,
  bookshelf: 24,
  crafting: 25,
  chest: 26,
  torch: 27,
  sapling: 28,
  flowerRed: 29,
  flowerYellow: 30,
  tallGrass: 31,
  obsidian: 32,
  clay: 33,
  mossy: 34,
  birchLog: 35,
  birchLeaves: 36,
  spruceLog: 37,
  spruceLeaves: 38,
  glowstone: 39,
  stoneBricks: 44,
  melon: 45,
  mushroomRed: 46,
  mushroomBrown: 47,
  deadBush: 48,
  furnace: 49,
  copperOre: 50,
  copperBlock: 51,
  amethystOre: 52,
  amethystBlock: 53,
  lantern: 54,
  berryBush: 55,
  sunflower: 56,
  campfire: 57,
};

export class Chunk {
  blocks: Uint8Array;
  constructor(
    public cx: number,
    public cz: number,
  ) {
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
  }
  get(x: number, y: number, z: number): number {
    if (y < 0 || y >= WORLD_HEIGHT) return AIR;
    return this.blocks[y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x];
  }
  set(x: number, y: number, z: number, id: number) {
    if (y < 0 || y >= WORLD_HEIGHT) return;
    this.blocks[y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x] = id;
  }
}

export class WorldGen {
  height: Noise;
  detail: Noise;
  temp: Noise;
  humid: Noise;
  river: Noise;
  lake: Noise;
  cave: Noise;
  ore: Noise;

  constructor(public seed: number) {
    this.height = new Noise(seed);
    this.detail = new Noise(seed + 7717);
    this.temp = new Noise(seed + 13001);
    this.humid = new Noise(seed + 22013);
    this.river = new Noise(seed + 31417);
    this.lake = new Noise(seed + 44021);
    this.cave = new Noise(seed + 53051);
    this.ore = new Noise(seed + 66047);
  }

  terrainHeight(x: number, z: number): number {
    const continent = this.height.fbm2(x / 300, z / 300, 4);
    const hills = this.detail.fbm2(x / 74, z / 74, 3);
    const mount = this.detail.fbm2(x / 190 + 40, z / 190 - 20, 2);
    let h = SEA_LEVEL + 6 + continent * 18 + hills * 5;
    if (mount > 0.14) h += (mount - 0.14) * 120;
    // rivers carve smooth valleys
    const r = Math.abs(this.river.fbm2(x / 170, z / 170, 2));
    if (r < 0.085) {
      const t = 1 - r / 0.085;
      h = h * (1 - t) + (SEA_LEVEL - 2) * t;
    }
    // lakes: broad shallow depressions
    const l = this.lake.fbm2(x / 130 + 90, z / 130 + 30, 2);
    if (l > 0.26) {
      const t = Math.min(1, (l - 0.26) / 0.14);
      h = h * (1 - t) + (SEA_LEVEL - 2.5) * t;
    }
    return Math.max(2, Math.min(WORLD_HEIGHT - 12, Math.round(h)));
  }

  biomeAt(x: number, z: number, h: number): Biome {
    if (h <= SEA_LEVEL + 1) return "beach";
    if (h > SEA_LEVEL + 22) return "mountains";
    const t = this.temp.fbm2(x / 380 + 11, z / 380 + 11, 2);
    const m = this.humid.fbm2(x / 340 - 31, z / 340 - 31, 2);
    if (t > 0.24 && m < 0.08) return "desert";
    if (t < -0.26) return "taiga";
    if (m > 0.1) return "forest";
    return "plains";
  }

  private isCave(x: number, y: number, z: number, surface: number): boolean {
    if (y < 3 || y > surface - 2) return false;
    const n = this.cave.fbm3(x / 42, y / 24, z / 42, 2);
    const n2 = this.cave.noise3(x / 18 + 300, y / 14, z / 18 - 300);
    if (Math.abs(n) < 0.055 + 0.02 * (1 - y / WORLD_HEIGHT)) return true;
    if (Math.abs(n2) < 0.035) return true;
    return false;
  }

  private oreAt(x: number, y: number, z: number): number {
    const n = this.ore.noise3(x / 9, y / 9, z / 9);
    if (n > 0.72) {
      if (y < 14 && n > 0.86) return B.diamond;
      if (y < 24 && n > 0.83) return B.gold;
      if (y < 42 && n > 0.79) return B.iron;
      // copper appears higher (y 22..52) with its own threshold
      if (y > 22 && y < 52 && n > 0.78) return B.copperOre;
      // amethyst deeper (y 8..28) rare
      if (y < 28 && y > 5 && n > 0.84) return B.amethystOre;
      return B.coal;
    }
    const g = this.ore.noise3(x / 6 + 200, y / 6, z / 6 - 200);
    if (g > 0.86) return y < 30 ? B.gravel : B.clay;
    // extra copper pockets
    const c = this.ore.noise3(x / 7 + 400, y / 7, z / 7 - 400);
    if (c > 0.82 && y > 18 && y < 48) return B.copperOre;
    return B.stone;
  }

  /** Generates terrain (no structures) into the chunk. */
  generateTerrain(chunk: Chunk) {
    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = ox + lx;
        const wz = oz + lz;
        const h = this.terrainHeight(wx, wz);
        const biome = this.biomeAt(wx, wz, h);
        for (let y = 0; y <= Math.max(h, SEA_LEVEL); y++) {
          let id = AIR;
          if (y <= h) {
            if (y === 0 || (y < 3 && this.ore.noise3(wx, y, wz) > 0)) id = B.bedrock;
            else if (y === h) {
              if (biome === "desert" || biome === "beach") id = B.sand;
              else if (biome === "taiga") id = B.snow;
              else if (biome === "mountains") id = h > SEA_LEVEL + 30 ? B.snow : B.stone;
              else id = B.grass;
            } else if (y > h - 4) {
              if (biome === "desert" || biome === "beach") id = y > h - 3 ? B.sand : B.sandstone;
              else if (biome === "mountains") id = B.stone;
              else id = B.dirt;
            } else {
              id = this.oreAt(wx, y, wz);
            }
            if (id !== B.bedrock && this.isCave(wx, y, wz, h)) id = AIR;
          } else if (y <= SEA_LEVEL) {
            id = biome === "taiga" && y === SEA_LEVEL ? B.ice : B.water;
          }
          if (id !== AIR) chunk.set(lx, y, lz, id);
        }
        // clay under fresh water
        if (h < SEA_LEVEL && h > SEA_LEVEL - 5) {
          if (this.lake.noise2(wx / 12, wz / 12) > 0.4) chunk.set(lx, h, lz, B.clay);
        }
      }
    }
  }

  /** Trees, plants and cacti. */
  generateDecorations(chunk: Chunk) {
    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;
    const rng = mulberry32((this.seed ^ (chunk.cx * 341873128) ^ (chunk.cz * 132897987)) >>> 0);
    const centerBiome = this.biomeAt(ox + 8, oz + 8, this.terrainHeight(ox + 8, oz + 8));
    const treeAttempts = centerBiome === "forest" ? 16 : centerBiome === "taiga" ? 11 : centerBiome === "plains" ? 2 : 0;
    for (let i = 0; i < treeAttempts; i++) {
      const lx = Math.floor(rng() * CHUNK_SIZE);
      const lz = Math.floor(rng() * CHUNK_SIZE);
      const wx = ox + lx;
      const wz = oz + lz;
      const h = this.terrainHeight(wx, wz);
      if (h <= SEA_LEVEL) continue;
      const top = chunk.get(lx, h, lz);
      if (top !== B.grass && top !== B.snow) continue;
      const biome = this.biomeAt(wx, wz, h);
      const r = rng();
      if (biome === "taiga" || r < 0.2) this.spruce(chunk, lx, h + 1, lz, rng);
      else if (r < 0.4) this.birch(chunk, lx, h + 1, lz, rng);
      else this.oak(chunk, lx, h + 1, lz, rng);
    }
    // cacti / dead bushes in deserts
    if (centerBiome === "desert") {
      for (let i = 0; i < 6; i++) {
        const lx = Math.floor(rng() * CHUNK_SIZE);
        const lz = Math.floor(rng() * CHUNK_SIZE);
        const h = this.terrainHeight(ox + lx, oz + lz);
        if (h <= SEA_LEVEL) continue;
        if (chunk.get(lx, h, lz) !== B.sand) continue;
        const kind = rng();
        const th = 1 + Math.floor(rng() * 3);
        if (kind < 0.55) for (let k = 0; k < th; k++) chunk.set(lx, h + 1 + k, lz, B.cactus);
        else chunk.set(lx, h + 1, lz, B.deadBush);
      }
    }
    // grass, flowers, mushrooms, pumpkins
    const plantCount = centerBiome === "desert" ? 0 : 14;
    for (let i = 0; i < plantCount; i++) {
      const lx = Math.floor(rng() * CHUNK_SIZE);
      const lz = Math.floor(rng() * CHUNK_SIZE);
      const h = this.terrainHeight(ox + lx, oz + lz);
      if (h <= SEA_LEVEL) continue;
      if (chunk.get(lx, h, lz) !== B.grass) continue;
      if (chunk.get(lx, h + 1, lz) !== AIR) continue;
      const r = rng();
      if (r < 0.62) chunk.set(lx, h + 1, lz, B.tallGrass);
      else if (r < 0.74) chunk.set(lx, h + 1, lz, rng() < 0.5 ? B.flowerRed : B.flowerYellow);
      else if (r < 0.8 && centerBiome === "forest") chunk.set(lx, h + 1, lz, rng() < 0.5 ? B.mushroomRed : B.mushroomBrown);
      else if (r < 0.83) chunk.set(lx, h + 1, lz, B.pumpkin);
      else if (r < 0.87) chunk.set(lx, h + 1, lz, B.melon);
      else if (r < 0.93) chunk.set(lx, h + 1, lz, B.sapling);
    }
    // --- UPDATE 2.0: berry bushes and sunflowers ---
    if (centerBiome === "plains" || centerBiome === "forest") {
      for (let i = 0; i < 4; i++) {
        const lx = Math.floor(rng() * CHUNK_SIZE);
        const lz = Math.floor(rng() * CHUNK_SIZE);
        const h = this.terrainHeight(ox + lx, oz + lz);
        if (h <= SEA_LEVEL) continue;
        if (chunk.get(lx, h, lz) !== B.grass) continue;
        if (chunk.get(lx, h + 1, lz) !== AIR) continue;
        if (rng() < 0.5) chunk.set(lx, h + 1, lz, B.berryBush);
        else if (rng() < 0.35) chunk.set(lx, h + 1, lz, B.sunflower);
      }
    }
    // amethyst geodes rare underground
    if (rng() < 0.12) {
      const gx = Math.floor(rng() * CHUNK_SIZE);
      const gz = Math.floor(rng() * CHUNK_SIZE);
      const gy = 12 + Math.floor(rng() * 18);
      this.geode(chunk, gx, gy, gz, rng);
    }
  }

  private treeBlock(chunk: Chunk, x: number, y: number, z: number, id: number, replaceAir = true) {
    if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) return;
    if (y < 0 || y >= WORLD_HEIGHT) return;
    const cur = chunk.get(x, y, z);
    if (replaceAir && cur !== AIR && cur !== B.tallGrass && cur !== B.flowerRed && cur !== B.flowerYellow) return;
    chunk.set(x, y, z, id);
  }

  oak(chunk: Chunk, x: number, y: number, z: number, rng: () => number) {
    const h = 4 + Math.floor(rng() * 3);
    for (let k = 0; k < h; k++) this.treeBlock(chunk, x, y + k, z, B.oakLog, false);
    for (let dy = -2; dy <= 1; dy++) {
      const r = dy <= -1 ? 2 : 1;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (dx === 0 && dz === 0 && dy < 1) continue;
          if (Math.abs(dx) === r && Math.abs(dz) === r && rng() < 0.6) continue;
          this.treeBlock(chunk, x + dx, y + h - 1 + dy, z + dz, B.oakLeaves);
        }
      }
    }
  }

  birch(chunk: Chunk, x: number, y: number, z: number, rng: () => number) {
    const h = 5 + Math.floor(rng() * 3);
    for (let k = 0; k < h; k++) this.treeBlock(chunk, x, y + k, z, B.birchLog, false);
    for (let dy = -2; dy <= 1; dy++) {
      const r = dy === 1 ? 0 : dy === 0 ? 1 : 2;
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++) {
          if (dx === 0 && dz === 0 && dy < 1) continue;
          this.treeBlock(chunk, x + dx, y + h - 1 + dy, z + dz, B.birchLeaves);
        }
    }
  }

  spruce(chunk: Chunk, x: number, y: number, z: number, rng: () => number) {
    const h = 6 + Math.floor(rng() * 4);
    for (let k = 0; k < h; k++) this.treeBlock(chunk, x, y + k, z, B.spruceLog, false);
    let r = 2;
    for (let dy = h - 1; dy >= 2; dy--) {
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) + Math.abs(dz) > r + 1) continue;
          this.treeBlock(chunk, x + dx, y + dy, z + dz, B.spruceLeaves);
        }
      r = r === 2 ? 1 : r === 1 ? 2 : 1;
      if (dy % 3 === 0) r = 1;
    }
    this.treeBlock(chunk, x, y + h, z, B.spruceLeaves);
  }

  private geode(chunk: Chunk, cx: number, cy: number, cz: number, rng: () => number) {
    const r = 3 + Math.floor(rng() * 2);
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dz = -r; dz <= r; dz++) {
          const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
          if (d > r) continue;
          const x = cx + dx;
          const y = cy + dy;
          const z = cz + dz;
          if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) continue;
          if (y < 5 || y >= WORLD_HEIGHT) continue;
          // shell
          if (d > r - 1.2) {
            if (chunk.get(x, y, z) !== AIR) chunk.set(x, y, z, 3); // stone shell
          } else if (d > r - 2.2) {
            chunk.set(x, y, z, B.amethystBlock);
          } else {
            if (rng() < 0.7) chunk.set(x, y, z, B.amethystOre);
            else if (rng() < 0.5) chunk.set(x, y, z, B.air); // hollow
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------- villages
  villageCell(cx: number, cz: number) {
    const CELL = 10; // in chunks
    const ccx = Math.floor(cx / CELL);
    const ccz = Math.floor(cz / CELL);
    const rng = mulberry32((this.seed ^ (ccx * 668265263) ^ (ccz * 374761393)) >>> 0);
    const has = rng() < 0.55;
    const jitterX = Math.floor((rng() - 0.5) * 40);
    const jitterZ = Math.floor((rng() - 0.5) * 40);
    const centerWorldX = ccx * CELL * CHUNK_SIZE + (CELL * CHUNK_SIZE) / 2 + jitterX;
    const centerWorldZ = ccz * CELL * CHUNK_SIZE + (CELL * CHUNK_SIZE) / 2 + jitterZ;
    return { has, ccx, ccz, x: centerWorldX, z: centerWorldZ, rng, cellChunks: CELL };
  }

  private houseLayout(index: number, center: { x: number; z: number }, rng: () => number) {
    const angle = (index / 7) * Math.PI * 2 + rng() * 0.6;
    const dist = 14 + rng() * 34;
    return {
      x: Math.round(center.x + Math.cos(angle) * dist),
      z: Math.round(center.z + Math.sin(angle) * dist),
      w: 7 + Math.floor(rng() * 3),
      d: 7 + Math.floor(rng() * 3),
      chest: rng() < 0.75,
      index,
    };
  }

  /** Writes village structures overlapping this chunk, returns villager spawn points. */
  generateVillage(chunk: Chunk): MobSpawn[] {
    const spawns: MobSpawn[] = [];
    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;
    const CELL = 10;
    for (let dcx = -1; dcx <= 1; dcx++) {
      for (let dcz = -1; dcz <= 1; dcz++) {
        const cell = this.villageCell(chunk.cx + dcx * CELL, chunk.cz + dcz * CELL);
        if (!cell.has) continue;
        if (Math.abs(cell.x - (ox + 8)) > 110 || Math.abs(cell.z - (oz + 8)) > 110) continue;
        const vrng = mulberry32((this.seed ^ (cell.ccx * 92837111) ^ (cell.ccz * 689287499)) >>> 0);
        // center well
        this.buildWell(chunk, cell.x, cell.z);
        const count = 4 + Math.floor(vrng() * 4);
        for (let i = 0; i < count; i++) {
          const layout = this.houseLayout(i, cell, vrng);
          const ground = this.villageGround(layout.x, layout.z, layout.w, layout.d);
          if (!ground) continue;
          this.buildHouse(chunk, layout, ground.y, vrng);
          // gravel path towards the well
          this.buildPath(chunk, layout.x, layout.z, cell.x, cell.z, ground.y);
          const sx = layout.x;
          const sz = layout.z;
          if (sx >= ox && sx < ox + CHUNK_SIZE && sz >= oz && sz < oz + CHUNK_SIZE) {
            spawns.push({ kind: "villager", x: sx + 0.5, y: ground.y + 1.2, z: sz + 0.5 });
          }
        }
        // farm plot
        const fx = cell.x + Math.round((vrng() - 0.5) * 40);
        const fz = cell.z + Math.round((vrng() - 0.5) * 40);
        const fg = this.villageGround(fx, fz, 7, 5);
        if (fg) this.buildFarm(chunk, fx, fz, fg.y);
      }
    }
    return spawns;
  }

  /** Flat-enough ground level for a rectangle, or null. */
  private villageGround(x: number, z: number, w: number, d: number): { y: number } | null {
    const samples: number[] = [];
    for (const [dx, dz] of [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [-w / 2, d / 2],
      [w / 2, d / 2],
      [0, 0],
    ]) {
      const h = this.terrainHeight(Math.round(x + dx), Math.round(z + dz));
      if (h <= SEA_LEVEL) return null;
      samples.push(h);
    }
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    if (max - min > 4) return null;
    return { y: Math.round((min + max) / 2) };
  }

  private put(chunk: Chunk, wx: number, y: number, wz: number, id: number, force = true) {
    const lx = wx - chunk.cx * CHUNK_SIZE;
    const lz = wz - chunk.cz * CHUNK_SIZE;
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return;
    if (y < 0 || y >= WORLD_HEIGHT) return;
    if (!force && chunk.get(lx, y, lz) !== AIR) return;
    chunk.set(lx, y, lz, id);
  }

  private buildWell(chunk: Chunk, x: number, z: number) {
    const ground = this.villageGround(x, z, 4, 4);
    if (!ground) return;
    const y = ground.y;
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++) {
        const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
        this.put(chunk, x + dx, y, z + dz, edge ? B.cobble : B.water);
        if (edge) {
          this.put(chunk, x + dx, y + 1, z + dz, B.cobble);
          if ((Math.abs(dx) === 2 && Math.abs(dz) === 2) || (dx === 0 && dz === 2) || (dx === 2 && dz === 0) || (dx === 0 && dz === -2) || (dx === -2 && dz === 0))
            this.put(chunk, x + dx, y + 2, z + dz, B.cobble);
        }
      }
    this.put(chunk, x, y + 3, z, B.cobble);
    for (const [dx, dz] of [
      [-1, 0],
      [1, 0],
    ]) {
      this.put(chunk, x + dx, y + 3, z, B.oakLog, false);
      this.put(chunk, x + dx, y + 4, z, B.oakLog, false);
    }
    for (let dx = -2; dx <= 2; dx++) this.put(chunk, x + dx, y + 5, z, B.planks);
    this.put(chunk, x, y + 4, z, B.glowstone);
  }

  private buildHouse(chunk: Chunk, layout: { x: number; z: number; w: number; d: number; chest: boolean }, y: number, rng: () => number) {
    const { x, z, w, d } = layout;
    const hx = Math.floor(w / 2);
    const hz = Math.floor(d / 2);
    const wallH = 4;
    const log = rng() < 0.5 ? B.oakLog : B.birchLog;
    for (let dx = -hx; dx <= hx; dx++) {
      for (let dz = -hz; dz <= hz; dz++) {
        // foundation + floor
        this.put(chunk, x + dx, y - 1, z + dz, B.cobble);
        this.put(chunk, x + dx, y, z + dz, B.planks);
        const onEdge = dx === -hx || dx === hx || dz === -hz || dz === hz;
        for (let k = 1; k <= wallH; k++) {
          if (!onEdge) continue;
          const corner = (dx === -hx || dx === hx) && (dz === -hz || dz === hz);
          let id = corner ? log : B.planks;
          const midX = dx === 0 && dz === hz;
          const midZ = dz === 0 && dx === hx;
          const isDoor = (midX || midZ) && k <= 2;
          const isWindow = k === 2 && ((dz === hz && Math.abs(dx) === 2) || (dx === hx && Math.abs(dz) === 2) || (dz === -hz && Math.abs(dx) === 2) || (dx === -hx && Math.abs(dz) === 2));
          if (isDoor) id = AIR;
          else if (isWindow) id = B.glass;
          this.put(chunk, x + dx, y + k, z + dz, id);
        }
        // roof
        this.put(chunk, x + dx, y + wallH + 1, z + dz, B.planks);
      }
    }
    // roof rim + light + furniture
    for (let dx = -hx - 1; dx <= hx + 1; dx++) {
      this.put(chunk, x + dx, y + wallH + 1, z - hz - 1, log);
      this.put(chunk, x + dx, y + wallH + 1, z + hz + 1, log);
    }
    for (let dz = -hz - 1; dz <= hz + 1; dz++) {
      this.put(chunk, x - hx - 1, y + wallH + 1, z + dz, log);
      this.put(chunk, x + hx + 1, y + wallH + 1, z + dz, log);
    }
    const fx = x - hx + 1;
    const fz = z - hz + 1;
    this.put(chunk, fx, y + 1, fz, B.crafting);
    this.put(chunk, fx + 1, y + 1, fz, B.bookshelf);
    this.put(chunk, fx, y + 1, fz + 1, B.furnace);
    this.put(chunk, x + hx - 1, y + wallH, z + hz - 1, B.torch, false);
    this.put(chunk, x + hx - 2, y + 1, z - hz + 1, B.lantern, false);
    this.put(chunk, x, y + 1, z + hz - 1, rng() < 0.4 ? B.melon : B.pumpkin, false);
    if (layout.chest) {
      this.put(chunk, x + hx - 1, y + 1, z - hz + 1, B.chest);
    }
    if (rng() < 0.35) this.put(chunk, x + hx - 1, y + 1, z + hz - 1, B.chest);
    if (rng() < 0.5) this.put(chunk, x, y + 1, z, B.campfire, false);
  }

  private buildPath(chunk: Chunk, x1: number, z1: number, x2: number, z2: number, y: number) {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(z2 - z1));
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const px = Math.round(x1 + (x2 - x1) * t);
      const pz = Math.round(z1 + (z2 - z1) * t);
      for (const [dx, dz] of [
        [0, 0],
        [1, 0],
        [0, 1],
      ]) {
        const h = this.terrainHeight(px + dx, pz + dz);
        if (Math.abs(h - y) > 3) continue;
        this.put(chunk, px + dx, h, pz + dz, B.gravel);
        this.put(chunk, px + dx, h + 1, pz + dz, AIR);
      }
    }
  }

  private buildFarm(chunk: Chunk, x: number, z: number, y: number) {
    for (let dx = -3; dx <= 3; dx++)
      for (let dz = -2; dz <= 2; dz++) {
        this.put(chunk, x + dx, y, z + dz, dz === 0 ? B.water : B.dirt);
        this.put(chunk, x + dx, y + 1, z + dz, dz === 0 ? AIR : dx % 2 === 0 ? B.tallGrass : B.flowerYellow);
      }
    for (let dx = -4; dx <= 4; dx++) {
      this.put(chunk, x + dx, y + 1, z - 3, B.oakLog);
      this.put(chunk, x + dx, y + 1, z + 3, B.oakLog);
    }
  }

  /** Ambient mob spawn hints for a chunk (village villagers handled separately). */
  ambientSpawns(chunk: Chunk): MobSpawn[] {
    const spawns: MobSpawn[] = [];
    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;
    const rng = mulberry32((this.seed ^ (chunk.cx * 8191) ^ (chunk.cz * 131071) ^ 0x5bf03635) >>> 0);
    if (rng() > 0.22) return spawns;
    const lx = Math.floor(rng() * CHUNK_SIZE);
    const lz = Math.floor(rng() * CHUNK_SIZE);
    const h = this.terrainHeight(ox + lx, oz + lz);
    if (h <= SEA_LEVEL + 1) return spawns;
    const kinds: MobKind[] = ["pig", "cow", "sheep", "chicken"];
    const kind = kinds[Math.floor(rng() * kinds.length)];
    const n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const x = ox + clamp(lx + Math.floor((rng() - 0.5) * 6), 0, CHUNK_SIZE - 1);
      const z = oz + clamp(lz + Math.floor((rng() - 0.5) * 6), 0, CHUNK_SIZE - 1);
      spawns.push({ kind, x: x + 0.5, y: this.terrainHeight(x, z) + 1.4, z: z + 0.5 });
    }
    return spawns;
  }
}

/** Deterministic loot for village chests (used when the chest was never opened). */
export function chestLoot(seed: number, x: number, y: number, z: number, lootTable: Array<{ id: string; min: number; max: number; weight: number }>) {
  const rng = mulberry32((seed ^ (x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0);
  const slots: Array<{ id: string; count: number } | null> = new Array(27).fill(null);
  const totalWeight = lootTable.reduce((s, l) => s + l.weight, 0);
  const rolls = 4 + Math.floor(rng() * 5);
  for (let i = 0; i < rolls; i++) {
    let r = rng() * totalWeight;
    let pick = lootTable[0];
    for (const entry of lootTable) {
      r -= entry.weight;
      if (r <= 0) {
        pick = entry;
        break;
      }
    }
    let slot = Math.floor(rng() * slots.length);
    for (let k = 0; k < slots.length; k++) {
      const s = (slot + k) % slots.length;
      if (!slots[s]) {
        slots[s] = { id: pick.id, count: pick.min + Math.floor(rng() * (pick.max - pick.min + 1)) };
        break;
      }
    }
  }
  return slots;
}

export function isSolid(id: number) {
  const b = BLOCKS[id];
  return Boolean(b && b.solid);
}
