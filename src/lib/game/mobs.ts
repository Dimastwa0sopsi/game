// Mobs: procedural box models, simple AI, animation.
import * as THREE from "three";
import { inWater, moveEntity } from "./physics";
import { getItemIcon } from "./textures";
import { MobKind } from "./worldgen";
import { VoxelWorld } from "./world";

export interface MobStat {
  name: string;
  hp: number;
  speed: number;
  hostile: boolean;
  hw: number;
  h: number;
  damage: number;
  drops: Array<{ id: string; min: number; max: number }>;
}

export const MOB_STATS: Record<MobKind, MobStat> = {
  pig: { name: "Свинья", hp: 10, speed: 1.7, hostile: false, hw: 0.42, h: 0.9, damage: 0, drops: [{ id: "porkchop", min: 1, max: 3 }] },
  cow: { name: "Корова", hp: 12, speed: 1.6, hostile: false, hw: 0.45, h: 1.3, damage: 0, drops: [{ id: "beef", min: 1, max: 3 }, { id: "leather", min: 0, max: 2 }] },
  sheep: { name: "Овца", hp: 10, speed: 1.6, hostile: false, hw: 0.42, h: 1.2, damage: 0, drops: [{ id: "wool", min: 1, max: 2 }] },
  chicken: { name: "Курица", hp: 6, speed: 1.9, hostile: false, hw: 0.28, h: 0.7, damage: 0, drops: [{ id: "feather", min: 1, max: 2 }] },
  zombie: { name: "Зомби", hp: 20, speed: 2.3, hostile: true, hw: 0.35, h: 1.85, damage: 4, drops: [{ id: "rotten_flesh", min: 1, max: 2 }] },
  skeleton: { name: "Скелет", hp: 18, speed: 2.4, hostile: true, hw: 0.35, h: 1.85, damage: 3, drops: [{ id: "bone", min: 1, max: 3 }] },
  villager: { name: "Житель", hp: 20, speed: 1.8, hostile: false, hw: 0.35, h: 1.85, damage: 0, drops: [{ id: "emerald", min: 0, max: 1 }] },
};

const COLORS: Record<MobKind, { body: string; head: string; legs: string; extra?: string }> = {
  pig: { body: "#e79b9b", head: "#eda6a6", legs: "#d68585" },
  cow: { body: "#4a3728", head: "#3a2a1e", legs: "#2f2318", extra: "#f0ece2" },
  sheep: { body: "#f2efe6", head: "#e2d3bd", legs: "#ded6c6" },
  chicken: { body: "#f6f6f6", head: "#fdfdfd", legs: "#e0a63c" },
  zombie: { body: "#2f6b3c", head: "#4d8f4f", legs: "#2b3f6b" },
  skeleton: { body: "#dcdcd2", head: "#eaeae2", legs: "#cfcfc6" },
  villager: { body: "#7a5230", head: "#c99b6c", legs: "#5d3f24" },
};

const faceCache = new Map<MobKind, THREE.CanvasTexture>();

function faceTexture(kind: MobKind): THREE.CanvasTexture {
  const cached = faceCache.get(kind);
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext("2d")!;
  const col = COLORS[kind];
  ctx.fillStyle = col.head;
  ctx.fillRect(0, 0, 16, 16);
  const dark = "#221c1a";
  const eye = (x: number, y: number, w = 3, h = 3, color = dark) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  if (kind === "pig") {
    eye(3, 5, 2, 2);
    eye(11, 5, 2, 2);
    ctx.fillStyle = "#d97f8a";
    ctx.fillRect(5, 9, 6, 4);
    ctx.fillStyle = "#a4556a";
    ctx.fillRect(6, 10, 1, 2);
    ctx.fillRect(9, 10, 1, 2);
  } else if (kind === "cow") {
    eye(2, 5, 3, 3);
    eye(11, 5, 3, 3);
    ctx.fillStyle = "#f0ece2";
    ctx.fillRect(4, 10, 8, 5);
    ctx.fillStyle = "#5d4a3a";
    ctx.fillRect(5, 11, 2, 2);
    ctx.fillRect(9, 11, 2, 2);
  } else if (kind === "sheep") {
    eye(3, 6, 3, 3, "#3b3b3b");
    eye(10, 6, 3, 3, "#3b3b3b");
    ctx.fillStyle = "#e8b8c8";
    ctx.fillRect(6, 11, 4, 3);
  } else if (kind === "chicken") {
    eye(3, 5, 2, 2);
    eye(11, 5, 2, 2);
    ctx.fillStyle = "#e8a13c";
    ctx.fillRect(6, 9, 4, 3);
    ctx.fillStyle = "#c6363b";
    ctx.fillRect(6, 12, 4, 3);
  } else if (kind === "zombie") {
    ctx.fillStyle = "#1b2a1c";
    ctx.fillRect(2, 5, 4, 3);
    ctx.fillRect(10, 5, 4, 3);
    ctx.fillStyle = "#16241a";
    ctx.fillRect(6, 11, 4, 2);
  } else if (kind === "skeleton") {
    ctx.fillStyle = "#2b2b2b";
    ctx.fillRect(2, 5, 4, 4);
    ctx.fillRect(10, 5, 4, 4);
    ctx.fillRect(5, 11, 6, 1);
    ctx.fillRect(4, 13, 1, 2);
    ctx.fillRect(11, 13, 1, 2);
  } else {
    ctx.fillStyle = "#3a2a1c";
    ctx.fillRect(2, 4, 12, 2);
    eye(3, 7, 3, 2, "#ffffff");
    eye(10, 7, 3, 2, "#ffffff");
    ctx.fillStyle = "#2b7a3f";
    ctx.fillRect(3, 7, 3, 2);
    ctx.fillRect(10, 7, 3, 2);
    ctx.fillStyle = "#a5763f";
    ctx.fillRect(6, 9, 4, 4);
    ctx.fillStyle = "#6b4a2a";
    ctx.fillRect(5, 14, 6, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  faceCache.set(kind, tex);
  return tex;
}

function box(w: number, h: number, d: number, color: string): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  return mesh;
}

export class Mob {
  group = new THREE.Group();
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  hp: number;
  yaw = 0;
  wanderTimer = 0;
  targetYaw = 0;
  attackCd = 0;
  hurtTime = 0;
  animTime = 0;
  legs: THREE.Object3D[] = [];
  arms: THREE.Object3D[] = [];
  headPivot = new THREE.Object3D();
  dead = false;
  onGround = false;
  home = new THREE.Vector3();
  fleeing = 0;
  stat: MobStat;

  constructor(public kind: MobKind, x: number, y: number, z: number) {
    const s = MOB_STATS[kind];
    this.stat = s;
    this.hp = s.hp;
    this.pos.set(x, y, z);
    this.home.set(x, y, z);
    this.build();
    this.group.position.copy(this.pos);
  }

  private build() {
    const col = COLORS[this.kind];
    const g = this.group;
    if (this.kind === "pig" || this.kind === "cow" || this.kind === "sheep" || this.kind === "chicken") {
      const scale = this.kind === "chicken" ? 0.62 : 1;
      const body = box(0.9 * scale, 0.8 * scale, 1.35 * scale, col.body);
      body.position.y = 0.75 * scale;
      g.add(body);
      if (this.kind === "cow") {
        const patch = box(0.92 * scale, 0.35 * scale, 0.6 * scale, col.extra ?? "#fff");
        patch.position.set(0, 0.85 * scale, 0.2 * scale);
        g.add(patch);
      }
      if (this.kind === "sheep") {
        const wool = box(1.05 * scale, 0.9 * scale, 1.15 * scale, "#fbf8f0");
        wool.position.y = 0.8 * scale;
        g.add(wool);
      }
      const head = box(0.65 * scale, 0.65 * scale, 0.6 * scale, col.head);
      head.position.set(0, 0.95 * scale, -0.9 * scale);
      this.headPivot.add(head);
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(0.6 * scale, 0.6 * scale),
        new THREE.MeshLambertMaterial({ map: faceTexture(this.kind), transparent: true }),
      );
      face.position.set(0, 0.95 * scale, -1.21 * scale);
      face.rotation.y = Math.PI;
      this.headPivot.add(face);
      g.add(this.headPivot);
      const legH = 0.45 * scale;
      for (const [lx, lz] of [
        [-0.28, -0.42],
        [0.28, -0.42],
        [-0.28, 0.42],
        [0.28, 0.42],
      ]) {
        const pivot = new THREE.Object3D();
        const leg = box(0.24 * scale, legH, 0.24 * scale, col.legs);
        leg.position.y = -legH / 2;
        pivot.add(leg);
        pivot.position.set(lx * scale, 0.45 * scale, lz * scale);
        this.legs.push(pivot);
        g.add(pivot);
      }
    } else {
      const humanoid = this.kind === "villager";
      const bodyH = humanoid ? 0.95 : 0.85;
      const body = box(0.62, bodyH, 0.36, col.body);
      body.position.y = 1.05;
      g.add(body);
      const head = box(0.56, 0.56, 0.56, col.head);
      head.position.y = 1.78;
      this.headPivot.add(head);
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(0.52, 0.52),
        new THREE.MeshLambertMaterial({ map: faceTexture(this.kind), transparent: true }),
      );
      face.position.set(0, 1.78, -0.29);
      face.rotation.y = Math.PI;
      this.headPivot.add(face);
      g.add(this.headPivot);
      if (humanoid) {
        const robe = box(0.66, 0.5, 0.4, col.legs);
        robe.position.y = 0.55;
        g.add(robe);
        const arms = box(0.78, 0.2, 0.2, col.body);
        arms.position.set(0, 1.35, 0);
        this.arms.push(arms);
        g.add(arms);
      } else {
        for (const side of [-1, 1]) {
          const pivot = new THREE.Object3D();
          const arm = box(0.2, 0.72, 0.2, this.kind === "zombie" ? col.body : "#dcdcd2");
          arm.position.y = -0.36;
          pivot.add(arm);
          pivot.position.set(side * 0.42, 1.45, 0);
          if (this.kind === "zombie") pivot.rotation.x = -1.4;
          this.arms.push(pivot);
          g.add(pivot);
        }
        for (const side of [-1, 1]) {
          const pivot = new THREE.Object3D();
          const leg = box(0.22, 0.75, 0.22, col.legs);
          leg.position.y = -0.37;
          pivot.add(leg);
          pivot.position.set(side * 0.16, 0.72, 0);
          this.legs.push(pivot);
          g.add(pivot);
        }
        if (this.kind === "skeleton") {
          const bow = box(0.1, 0.6, 0.1, "#8a5a2b");
          bow.position.set(0.42, 1.1, -0.25);
          g.add(bow);
        }
      }
    }
  }

  update(dt: number, world: VoxelWorld, playerPos: THREE.Vector3, hurtPlayer: (dmg: number) => void, isNight: boolean) {
    const s = this.stat;
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.hurtTime = Math.max(0, this.hurtTime - dt);
    const toPlayer = new THREE.Vector3().subVectors(playerPos, this.pos);
    const dist = toPlayer.length();

    let moving = false;
    let speed = s.speed;

    if (s.hostile && (isNight || dist < 16) && dist < 28) {
      this.targetYaw = Math.atan2(toPlayer.x, toPlayer.z);
      if (dist > 1.5) moving = true;
      if (dist < 1.9 && this.attackCd <= 0) {
        hurtPlayer(s.damage);
        this.attackCd = 1.2;
      }
      speed *= 1.15;
    } else {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 2 + Math.random() * 5;
        if (Math.random() < 0.35) this.targetYaw += Math.PI * (Math.random() - 0.5);
        else this.targetYaw = Math.random() * Math.PI * 2;
      }
      const homeDist = this.pos.distanceTo(this.home);
      if (homeDist > 22) {
        this.targetYaw = Math.atan2(this.home.x - this.pos.x, this.home.z - this.pos.z);
        moving = true;
      } else {
        moving = Math.random() < 0.75;
      }
      if (this.fleeing > 0) {
        this.fleeing -= dt;
        this.targetYaw = Math.atan2(-toPlayer.x, -toPlayer.z);
        moving = true;
        speed *= 1.8;
      }
    }

    // smooth turn
    let diff = this.targetYaw - this.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.yaw += Math.max(-4 * dt, Math.min(4 * dt, diff));
    this.group.rotation.y = this.yaw + Math.PI;

    const water = inWater(world, this.pos, s.h);
    if (moving) {
      this.vel.x = -Math.sin(this.yaw) * speed;
      this.vel.z = -Math.cos(this.yaw) * speed;
    } else {
      this.vel.x *= 0.6;
      this.vel.z *= 0.6;
    }
    this.vel.y -= (water ? 9 : 26) * dt;
    if (water) this.vel.y = Math.max(this.vel.y, 2.2);
    const res = moveEntity(world, this.pos, this.vel, s.hw, s.h, dt);
    this.onGround = res.onGround;
    if (res.hitWall && res.onGround) this.vel.y = 8.2;
    if (this.pos.y < -8) this.dead = true;

    // animation
    const planar = Math.hypot(this.vel.x, this.vel.z);
    this.animTime += dt * (2 + planar * 3);
    const swing = Math.sin(this.animTime * 3) * Math.min(0.8, planar * 0.5);
    this.legs.forEach((leg, i) => {
      leg.rotation.x = swing * (i % 2 === 0 ? 1 : -1);
    });
    this.arms.forEach((arm, i) => {
      if (this.kind === "zombie") return;
      arm.rotation.x = swing * (i % 2 === 0 ? -1 : 1);
    });
    if (!s.hostile && dist < 6) {
      this.headPivot.rotation.y = Math.max(-0.8, Math.min(0.8, Math.atan2(toPlayer.x, toPlayer.z) - this.yaw));
    } else {
      this.headPivot.rotation.y *= 0.9;
    }

    // hurt flash
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const mat = mesh.material as THREE.MeshLambertMaterial | undefined;
      if (mat && mat.emissive) mat.emissive.setRGB(this.hurtTime > 0 ? 0.45 : 0, 0, 0);
    });

    this.group.position.copy(this.pos);
  }

  hurt(dmg: number, fromDir: THREE.Vector3): boolean {
    this.hp -= dmg;
    this.hurtTime = 0.35;
    this.vel.y = 4.5;
    const push = new THREE.Vector3(fromDir.x, 0, fromDir.z).normalize().multiplyScalar(4);
    this.pos.add(push.clone().multiplyScalar(0.08));
    this.fleeing = this.stat.hostile ? 0 : 3;
    if (this.hp <= 0) {
      this.dead = true;
      return true;
    }
    return false;
  }

  rollDrops(): Array<{ id: string; count: number }> {
    return this.stat.drops
      .map((d) => ({ id: d.id, count: d.min + Math.floor(Math.random() * (d.max - d.min + 1)) }))
      .filter((d) => d.count > 0);
  }
}

export function mobIcon(kind: MobKind): string {
  switch (kind) {
    case "pig":
      return getItemIcon("porkchop");
    case "cow":
      return getItemIcon("beef");
    case "sheep":
      return getItemIcon("wool");
    case "chicken":
      return getItemIcon("feather");
    case "zombie":
      return getItemIcon("rotten_flesh");
    case "skeleton":
      return getItemIcon("bone");
    default:
      return getItemIcon("emerald");
  }
}
