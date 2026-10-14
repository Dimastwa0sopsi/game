// Deterministic PRNG + Perlin noise used by the world generator.

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function smooth(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export class Noise {
  private perm: Uint8Array;

  constructor(seed: number) {
    const rand = mulberry32(seed);
    const p = new Uint8Array(512);
    const base = new Uint8Array(256);
    for (let i = 0; i < 256; i++) base[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = base[i];
      base[i] = base[j];
      base[j] = tmp;
    }
    for (let i = 0; i < 512; i++) p[i] = base[i & 255];
    this.perm = p;
  }

  private grad2(hash: number, x: number, y: number) {
    switch (hash & 7) {
      case 0:
        return x + y;
      case 1:
        return x - y;
      case 2:
        return -x + y;
      case 3:
        return -x - y;
      case 4:
        return x;
      case 5:
        return -x;
      case 6:
        return y;
      default:
        return -y;
    }
  }

  private grad3(hash: number, x: number, y: number, z: number) {
    switch (hash & 15) {
      case 0:
        return x + y;
      case 1:
        return -x + y;
      case 2:
        return x - y;
      case 3:
        return -x - y;
      case 4:
        return x + z;
      case 5:
        return -x + z;
      case 6:
        return x - z;
      case 7:
        return -x - z;
      case 8:
        return y + z;
      case 9:
        return -y + z;
      case 10:
        return y - z;
      case 11:
        return -y - z;
      case 12:
        return x + y;
      case 13:
        return -y + z;
      case 14:
        return -x + y;
      default:
        return -y - z;
    }
  }

  noise2(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = smooth(xf);
    const v = smooth(yf);
    const p = this.perm;
    const aa = p[p[X] + Y];
    const ab = p[p[X] + Y + 1];
    const ba = p[p[X + 1] + Y];
    const bb = p[p[X + 1] + Y + 1];
    const x1 = lerp(this.grad2(aa, xf, yf), this.grad2(ba, xf - 1, yf), u);
    const x2 = lerp(this.grad2(ab, xf, yf - 1), this.grad2(bb, xf - 1, yf - 1), u);
    return lerp(x1, x2, v);
  }

  noise3(x: number, y: number, z: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);
    const u = smooth(xf);
    const v = smooth(yf);
    const w = smooth(zf);
    const p = this.perm;
    const aaa = p[p[p[X] + Y] + Z];
    const aba = p[p[p[X] + Y + 1] + Z];
    const aab = p[p[p[X] + Y] + Z + 1];
    const abb = p[p[p[X] + Y + 1] + Z + 1];
    const baa = p[p[p[X + 1] + Y] + Z];
    const bba = p[p[p[X + 1] + Y + 1] + Z];
    const bab = p[p[p[X + 1] + Y] + Z + 1];
    const bbb = p[p[p[X + 1] + Y + 1] + Z + 1];
    const x1 = lerp(this.grad3(aaa, xf, yf, zf), this.grad3(baa, xf - 1, yf, zf), u);
    const x2 = lerp(this.grad3(aba, xf, yf - 1, zf), this.grad3(bba, xf - 1, yf - 1, zf), u);
    const x3 = lerp(this.grad3(aab, xf, yf, zf - 1), this.grad3(bab, xf - 1, yf, zf - 1), u);
    const x4 = lerp(this.grad3(abb, xf, yf - 1, zf - 1), this.grad3(bbb, xf - 1, yf - 1, zf - 1), u);
    return lerp(lerp(x1, x2, v), lerp(x3, x4, v), w);
  }

  fbm2(x: number, y: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise2(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  fbm3(x: number, y: number, z: number, octaves = 3): number {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise3(x * freq, y * freq, z * freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  }
}

export const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);
export const lerpNum = lerp;
