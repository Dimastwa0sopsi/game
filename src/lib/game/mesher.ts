// Greedy-free voxel mesher: face culling + per-vertex ambient occlusion.
import { BufferAttribute, BufferGeometry } from "three";
import { AIR, BLOCKS } from "./registry";
import { tileIndexOf, uvFor } from "./textures";

interface Corner {
  pos: [number, number, number];
  uv: [number, number];
}

interface Face {
  dir: [number, number, number];
  corners: Corner[];
  shade: number;
  tile: "top" | "side" | "bottom";
}

const FACES: Face[] = [
  {
    dir: [-1, 0, 0],
    corners: [
      { pos: [0, 1, 0], uv: [0, 1] },
      { pos: [0, 0, 0], uv: [0, 0] },
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [0, 0, 1], uv: [1, 0] },
    ],
    shade: 0.76,
    tile: "side",
  },
  {
    dir: [1, 0, 0],
    corners: [
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [1, 0, 1], uv: [0, 0] },
      { pos: [1, 1, 0], uv: [1, 1] },
      { pos: [1, 0, 0], uv: [1, 0] },
    ],
    shade: 0.76,
    tile: "side",
  },
  {
    dir: [0, -1, 0],
    corners: [
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 0], uv: [1, 1] },
      { pos: [0, 0, 0], uv: [0, 1] },
    ],
    shade: 0.5,
    tile: "bottom",
  },
  {
    dir: [0, 1, 0],
    corners: [
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 0] },
    ],
    shade: 1,
    tile: "top",
  },
  {
    dir: [0, 0, -1],
    corners: [
      { pos: [1, 0, 0], uv: [0, 0] },
      { pos: [0, 0, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 1] },
    ],
    shade: 0.62,
    tile: "side",
  },
  {
    dir: [0, 0, 1],
    corners: [
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 1, 1], uv: [0, 1] },
      { pos: [1, 1, 1], uv: [1, 1] },
    ],
    shade: 0.88,
    tile: "side",
  },
];

const TANGENTS: Record<string, [number[], number[]]> = {
  "-1,0,0": [
    [0, 1, 0],
    [0, 0, 1],
  ],
  "1,0,0": [
    [0, 1, 0],
    [0, 0, 1],
  ],
  "0,-1,0": [
    [1, 0, 0],
    [0, 0, 1],
  ],
  "0,1,0": [
    [1, 0, 0],
    [0, 0, 1],
  ],
  "0,0,-1": [
    [1, 0, 0],
    [0, 1, 0],
  ],
  "0,0,1": [
    [1, 0, 0],
    [0, 1, 0],
  ],
};

class Buf {
  pos: number[] = [];
  norm: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  idx: number[] = [];
}

export interface ChunkGeometry {
  solid: BufferGeometry | null;
  cutout: BufferGeometry | null;
  water: BufferGeometry | null;
}

function finish(buf: Buf): BufferGeometry | null {
  if (buf.idx.length === 0) return null;
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(buf.pos), 3));
  g.setAttribute("normal", new BufferAttribute(new Float32Array(buf.norm), 3));
  g.setAttribute("uv", new BufferAttribute(new Float32Array(buf.uv), 2));
  g.setAttribute("color", new BufferAttribute(new Float32Array(buf.col), 3));
  g.setIndex(buf.idx);
  g.computeBoundingSphere();
  return g;
}

export function buildChunkGeometry(
  get: (x: number, y: number, z: number) => number,
  ox: number,
  oz: number,
): ChunkGeometry {
  const solid = new Buf();
  const cutout = new Buf();
  const water = new Buf();

  const isOpaque = (x: number, y: number, z: number) => {
    const b = BLOCKS[get(x, y, z)];
    return Boolean(b && b.opaque);
  };
  const isSolidBlock = (x: number, y: number, z: number) => {
    const b = BLOCKS[get(x, y, z)];
    return Boolean(b && b.solid);
  };

  for (let y = 0; y < 72; y++) {
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const id = get(ox + x, y, oz + z);
        if (id === AIR) continue;
        const def = BLOCKS[id];
        if (!def) continue;

        if (def.cross) {
          const tile = tileIndexOf(def.tiles.side);
          const { u0, v0, u1, v1 } = uvFor(tile);
          const buf = cutout;
          const quads: Array<Array<[number, number, number]>> = [
            [
              [0.08, 0, 0.08],
              [0.92, 0, 0.92],
            ],
            [
              [0.92, 0, 0.08],
              [0.08, 0, 0.92],
            ],
          ];
          for (const [a, b] of quads) {
            const base = buf.pos.length / 3;
            const verts: Array<[number, number, number]> = [
              [a[0], 0, a[2]],
              [b[0], 0, b[2]],
              [a[0], 1, a[2]],
              [b[0], 1, b[2]],
            ];
            const uvs: Array<[number, number]> = [
              [u0, v0],
              [u1, v0],
              [u0, v1],
              [u1, v1],
            ];
            for (let i = 0; i < 4; i++) {
              buf.pos.push(ox + x + verts[i][0], y + verts[i][1], oz + z + verts[i][2]);
              buf.norm.push(0, 1, 0);
              buf.uv.push(uvs[i][0], uvs[i][1]);
              buf.col.push(1, 1, 1);
            }
            buf.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
            buf.idx.push(base + 2, base + 1, base, base + 3, base + 1, base + 2);
          }
          continue;
        }

        const isWater = Boolean(def.liquid);
        const buf = isWater ? water : solid;

        for (const face of FACES) {
          const nx = ox + x + face.dir[0];
          const ny = y + face.dir[1];
          const nz = oz + z + face.dir[2];
          const neighbour = get(nx, ny, nz);
          const nDef = BLOCKS[neighbour];
          if (nDef && nDef.opaque) continue;
          if (isWater && neighbour === id) continue;
          if (!isWater && nDef && nDef.liquid && face.dir[1] === -1) continue;
          if (isWater && face.dir[1] !== 1 && nDef && nDef.liquid) continue;

          const tileName = def.tiles[face.tile];
          const tile = tileIndexOf(tileName);
          const { u0, v0, u1, v1 } = uvFor(tile);
          const [ua, va] = TANGENTS[`${face.dir[0]},${face.dir[1]},${face.dir[2]}`];
          const base = buf.pos.length / 3;
          const aos: number[] = [];
          for (const corner of face.corners) {
            const du = corner.pos[ua[0]] || corner.pos[ua[1]] || corner.pos[ua[2]] ? 1 : -1;
            const dv = corner.pos[va[0]] || corner.pos[va[1]] || corner.pos[va[2]] ? 1 : -1;
            const s1 = isSolidBlock(nx + ua[0] * du, ny + ua[1] * du, nz + ua[2] * du) ? 1 : 0;
            const s2 = isSolidBlock(nx + va[0] * dv, ny + va[1] * dv, nz + va[2] * dv) ? 1 : 0;
            const cn = isSolidBlock(nx + ua[0] * du + va[0] * dv, ny + ua[1] * du + va[1] * dv, nz + ua[2] * du + va[2] * dv) ? 1 : 0;
            const occ = s1 && s2 ? 3 : s1 + s2 + cn;
            const ao = 1 - occ * 0.13;
            aos.push(ao);
            const shade = face.shade * ao;
            buf.pos.push(ox + x + corner.pos[0], y + corner.pos[1] - (isWater && face.dir[1] === 1 ? 0.12 : 0), oz + z + corner.pos[2]);
            buf.norm.push(face.dir[0], face.dir[1], face.dir[2]);
            buf.uv.push(corner.uv[0] ? u1 : u0, corner.uv[1] ? v1 : v0);
            buf.col.push(shade, shade, shade);
          }
          if (aos[0] + aos[3] > aos[1] + aos[2]) {
            buf.idx.push(base, base + 1, base + 3, base, base + 3, base + 2);
          } else {
            buf.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
          }
        }
      }
    }
  }

  return { solid: finish(solid), cutout: finish(cutout), water: finish(water) };
}
