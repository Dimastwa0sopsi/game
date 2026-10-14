// The voxel game engine: rendering, controls, mining, mobs, chests, day/night.
import * as THREE from "three";
import { Inventory, Slot } from "./inventory";
import { Mob, MOB_STATS } from "./mobs";
import { inWater, moveEntity, raycast } from "./physics";
import { BLOCKS, CHEST_LOOT, getItem, RECIPES } from "./registry";
import { SavePayload, SaveSlot } from "./save";
import { getItemIcon } from "./textures";
import { playSound } from "./sound";
import { CHUNK_SIZE, MobKind, chestLoot, SEA_LEVEL } from "./worldgen";
import { VoxelWorld, blockKey } from "./world";
import { FurnaceState, createFurnace, tickFurnace, SMELT } from "./furnace";
import { ACHIEVEMENTS } from "./achievements";

export type GameMode = "survival" | "creative";

export interface TradeOffer {
  give: { id: string; count: number };
  get: { id: string; count: number };
}

export const TRADES: TradeOffer[] = [
  { give: { id: "wheat", count: 8 }, get: { id: "emerald", count: 1 } },
  { give: { id: "emerald", count: 1 }, get: { id: "bread", count: 4 } },
  { give: { id: "emerald", count: 2 }, get: { id: "torch", count: 8 } },
  { give: { id: "emerald", count: 3 }, get: { id: "iron_pickaxe", count: 1 } },
  { give: { id: "emerald", count: 6 }, get: { id: "diamond", count: 1 } },
  { give: { id: "emerald", count: 4 }, get: { id: "golden_apple", count: 1 } },
];

export interface GameState {
  health: number;
  food: number;
  mode: GameMode;
  slots: Array<Slot | null>;
  selected: number;
  cursor: Slot | null;
  pos: { x: number; y: number; z: number };
  fps: number;
  clock: string;
  dayFraction: number;
  target: string | null;
  biome: string;
  chunks: number;
  mobs: number;
  chestKey: string | null;
  inventoryOpen: boolean;
  paused: boolean;
  dead: boolean;
  tradeOffers: TradeOffer[] | null;
  message: string | null;
  loading: boolean;
  craftable: number[];
  flying: boolean;
  underwater: boolean;
  heldName: string | null;
  progress: number;
  saveState: "idle" | "saving" | "saved";
  furnaceKey: string | null;
  furnace: FurnaceState | null;
  weather: "clear" | "rain";
  sprinting: boolean;
  achievements: Record<string, boolean>;
  toast: { title: string; desc: string } | null;
  xpLevel: number;
  travelled: number;
  version: string;
}

export interface GameOptions {
  canvas: HTMLCanvasElement;
  seed: number;
  mode: GameMode;
  player?: SavePayload["player"] | null;
  edits?: Array<{ x: number; y: number; z: number; block: number }>;
  chests?: Array<{ x: number; y: number; z: number; items: Array<SaveSlot | null> }>;
  furnaces?: Array<{ x: number; y: number; z: number; data: FurnaceState }>;
  onState: (s: GameState) => void;
  onAutoSave: (payload: SavePayload) => void;
}

const DAY_LENGTH = 600; // seconds for a full cycle
const UPDATE_VERSION = "2.0.0 — Новые горизонты";
const EYE_HEIGHT = 1.62;
const PLAYER_HW = 0.3;
const PLAYER_H = 1.8;
const MAX_HEALTH = 20;
const MAX_FOOD = 20;

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  world: VoxelWorld;
  inventory = new Inventory();
  chests = new Map<string, Array<Slot | null>>();
  dirtyChests = new Set<string>();
  deletedChests = new Set<string>();
  furnaces = new Map<string, FurnaceState>();
  dirtyFurnaces = new Set<string>();
  deletedFurnaces = new Set<string>();
  openFurnaceKey: string | null = null;
  mobs: Mob[] = [];
  mode: GameMode;
  pos = new THREE.Vector3(8, 60, 8);
  vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  health = MAX_HEALTH;
  food = MAX_FOOD;
  flying = false;
  onGround = false;
  time = 0.28;
  ui = { paused: false, inventoryOpen: false, dead: false };
  openChestKey: string | null = null;
  tradeTarget: Mob | null = null;
  message: string | null = null;
  weather: "clear" | "rain" = "clear";
  rainGroup: THREE.Points | null = null;
  cloudGroup: THREE.Group | null = null;
  achievements: Record<string, boolean> = {};
  toast: { title: string; desc: string } | null = null;
  toastTimer = 0;
  sprinting = false;
  travelled = 0;
  xpLevel = 0;
  blockedBreaks = 0;
  lastPos = new THREE.Vector3();
  weatherTimer = 0;
  messageTimer = 0;
  saveState: "idle" | "saving" | "saved" = "idle";
  renderDistance = 4;
  private keys = new Set<string>();
  private mouseDown = [false, false, false];
  private highlight: THREE.LineSegments;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private torchLights: THREE.PointLight[] = [];
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;
  private mineTarget: { x: number; y: number; z: number } | null = null;
  private mineProgress = 0;
  private mineTime = 1;
  private stateTimer = 0;
  private saveTimer = 0;
  private lightTimer = 0;
  private hostileTimer = 0;
  private fps = 60;
  private playSeconds = 0;
  private fallStart: number | null = null;
  private air = 1;
  private lastSpaceTap = 0;
  private opts: GameOptions;
  private targetHit: ReturnType<typeof raycast> = null;
  private targetMob: Mob | null = null;
  private locked = false;

  constructor(opts: GameOptions) {
    this.opts = opts;
    this.mode = opts.mode;
    this.world = new VoxelWorld(opts.seed);
    if (opts.edits) this.world.applySavedEdits(opts.edits);
    for (const c of opts.chests ?? []) this.chests.set(blockKey(c.x, c.y, c.z), c.items.map((s) => (s ? { ...s } : null)));
    for (const f of (opts as any).furnaces ?? []) this.furnaces.set(blockKey(f.x, f.y, f.z), f.data ?? createFurnace());

    this.renderer = new THREE.WebGLRenderer({ canvas: opts.canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 800);
    this.scene.fog = new THREE.Fog(0x9ed4ff, this.renderDistance * CHUNK_SIZE * 0.55, this.renderDistance * CHUNK_SIZE + 8);

    this.hemi = new THREE.HemisphereLight(0xbfe4ff, 0x4a6b3a, 1.05);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff3d0, 1.15);
    this.sun.position.set(60, 120, 40);
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xffb066, 0, 14, 2);
      this.torchLights.push(l);
      this.scene.add(l);
    }
    this.scene.add(this.world.group);
    this.cloudGroup = this.createClouds();
    this.scene.add(this.cloudGroup);
    this.rainGroup = this.createRain();
    this.scene.add(this.rainGroup);

    const box = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(box),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 }),
    );
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    if (opts.player) {
      this.pos.set(opts.player.x, opts.player.y, opts.player.z);
      this.yaw = opts.player.yaw;
      this.pitch = opts.player.pitch;
      this.health = opts.player.health ?? MAX_HEALTH;
      this.food = opts.player.food ?? MAX_FOOD;
      this.time = opts.player.time ?? 0.28;
      this.flying = Boolean(opts.player.flying);
      this.mode = opts.player.mode ?? opts.mode;
      this.inventory.load({ slots: opts.player.slots, selected: opts.player.selected });
      this.playSeconds = 0;
    } else {
      this.giveStarterKit();
    }
    this.bindEvents();
  }

  private giveStarterKit() {
    this.inventory.add("wooden_pickaxe", 1);
    this.inventory.add("wooden_axe", 1);
    this.inventory.add("wooden_sword", 1);
    this.inventory.add("torch", 16);
    this.inventory.add("bread", 5);
    this.inventory.add("oak_planks", 32);
    this.inventory.add("furnace", 2);
    this.inventory.add("lantern", 4);
    if (this.mode === "creative") {
      this.inventory.add("diamond_pickaxe", 1);
      this.inventory.add("chest", 8);
      this.inventory.add("glowstone", 32);
      this.inventory.add("copper_block", 16);
      this.inventory.add("amethyst_block", 16);
      this.inventory.add("campfire", 8);
    }
  }

  // ------------------------------------------------------------------ events
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === "F3") e.preventDefault();
    if (["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9"].includes(e.code)) {
      this.inventory.selected = Number(e.code.slice(5)) - 1;
      this.inventory.touch();
    }
    if (e.code === "KeyE") {
      this.toggleInventory();
      e.preventDefault();
    }
    if (e.code === "KeyF" && this.mode === "creative") {
      this.flying = !this.flying;
      this.notify(this.flying ? "Полёт включён" : "Полёт выключен");
    }
    if (e.code === "Space") {
      const now = performance.now();
      if (this.mode === "creative" && now - this.lastSpaceTap < 320) {
        this.flying = !this.flying;
        this.vel.y = 0;
      }
      this.lastSpaceTap = now;
    }
    if (e.code === "Escape") {
      if (this.ui.inventoryOpen) this.toggleInventory();
      else this.setPaused(true);
    }
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);

  private onMouseMove = (e: MouseEvent) => {
    if (!this.locked) return;
    this.yaw -= e.movementX * 0.0022;
    this.pitch -= e.movementY * 0.0022;
    const lim = Math.PI / 2 - 0.01;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  };

  private onMouseDown = (e: MouseEvent) => {
    if (!this.locked) return;
    this.mouseDown[e.button] = true;
    if (e.button === 2) this.useItem();
    if (e.button === 1) this.pickBlock();
  };

  private onMouseUp = (e: MouseEvent) => {
    this.mouseDown[e.button] = false;
    if (e.button === 0) {
      this.mineTarget = null;
      this.mineProgress = 0;
    }
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.locked) return;
    const dir = Math.sign(e.deltaY);
    this.inventory.selected = (this.inventory.selected + dir + 9) % 9;
    this.inventory.touch();
  };

  private onPointerLockChange = () => {
    this.locked = document.pointerLockElement === this.opts.canvas;
    if (!this.locked && !this.ui.inventoryOpen && !this.openChestKey) this.setPaused(true);
    this.pushState();
  };

  private onResize = () => {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  };

  private onContextMenu = (e: Event) => e.preventDefault();

  private bindEvents() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("resize", this.onResize);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    this.opts.canvas.addEventListener("mousedown", this.onMouseDown);
    this.opts.canvas.addEventListener("wheel", this.onWheel, { passive: true });
    this.opts.canvas.addEventListener("contextmenu", this.onContextMenu);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    this.opts.canvas.removeEventListener("mousedown", this.onMouseDown);
    this.opts.canvas.removeEventListener("wheel", this.onWheel);
    this.opts.canvas.removeEventListener("contextmenu", this.onContextMenu);
    this.renderer.dispose();
  }

  // -------------------------------------------------------------- public API
  start() {
    // pre-generate the spawn area so the player does not fall through the world
    const spawnX = Math.floor(this.pos.x);
    const spawnZ = Math.floor(this.pos.z);
    const pcx = Math.floor(spawnX / CHUNK_SIZE);
    const pcz = Math.floor(spawnZ / CHUNK_SIZE);
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) this.world.ensureChunk(pcx + dx, pcz + dz);
    if (!this.opts.player) {
      const y = this.world.highestSolid(spawnX, spawnZ) + 2.2;
      this.pos.set(spawnX + 0.5, Math.max(y, SEA_LEVEL + 2), spawnZ + 0.5);
    }
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) this.world.buildMesh(pcx + dx, pcz + dz);
    this.clock.start();
    const loop = () => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      this.frame();
    };
    loop();
    this.pushState();
  }

  requestLock() {
    try {
      const res = this.opts.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (res && typeof res.catch === "function") res.catch(() => undefined);
    } catch {
      /* browser may refuse if called too soon after exit */
    }
  }

  setPaused(v: boolean) {
    this.ui.paused = v;
    if (v && document.pointerLockElement === this.opts.canvas) document.exitPointerLock();
    this.pushState();
  }

  toggleInventory() {
    this.ui.inventoryOpen = !this.ui.inventoryOpen;
    if (!this.ui.inventoryOpen) this.stashCursor();
    if (this.ui.inventoryOpen) {
      if (document.pointerLockElement === this.opts.canvas) document.exitPointerLock();
    } else if (this.openChestKey) {
      this.openChestKey = null;
    }
    this.pushState();
  }

  setSelected(i: number) {
    this.inventory.selected = Math.max(0, Math.min(8, i));
    this.inventory.touch();
    this.pushState();
  }

  clickSlot(index: number, right: boolean, shift: boolean) {
    if (shift) this.inventory.quickMove(index);
    else this.inventory.clickSlot(index, right);
    this.pushState();
  }

  clickCursor() {
    this.inventory.cursor = null;
    this.pushState();
  }

  craft(index: number) {
    const recipe = RECIPES[index];
    if (!recipe) return;
    playSound("click");
    if (this.inventory.craft(recipe)) {
      this.notify(`Создано: ${getItem(recipe.out)?.name ?? recipe.out} x${recipe.count}`);
      if (recipe.out === "crafting_table") this.unlock("craft_table");
      if (recipe.out === "furnace") this.unlock("furnace");
      if (recipe.out === "lantern") this.unlock("lantern");
      if (recipe.out === "copper_block" || recipe.out === "copper_ingot") this.unlock("copper");
    } else this.notify("Не хватает материалов");
    this.pushState();
  }

  craftable(): number[] {
    return this.inventory.findCraftable();
  }

  giveCreative(id: string) {
    this.inventory.add(id, 1);
    this.pushState();
  }

  setMode(mode: GameMode) {
    this.mode = mode;
    if (mode === "survival") this.flying = false;
    this.notify(mode === "creative" ? "Творческий режим" : "Режим выживания");
    this.pushState();
  }

  setRenderDistance(d: number) {
    this.renderDistance = Math.max(3, Math.min(9, d));
    (this.scene.fog as THREE.Fog).near = this.renderDistance * CHUNK_SIZE * 0.55;
    (this.scene.fog as THREE.Fog).far = this.renderDistance * CHUNK_SIZE + 8;
    this.camera.far = this.renderDistance * CHUNK_SIZE + 120;
    this.camera.updateProjectionMatrix();
  }

  notify(text: string) {
    this.message = text;
    this.messageTimer = 2.6;
  }

  openChest(key: string) {
    if (!this.chests.has(key)) {
      const [x, y, z] = key.split(",").map(Number);
      this.chests.set(key, chestLoot(this.world.seed, x, y, z, CHEST_LOOT));
    }
    this.openChestKey = key;
    this.dirtyChests.add(key);
    this.ui.inventoryOpen = false;
    if (document.pointerLockElement === this.opts.canvas) document.exitPointerLock();
    this.pushState();
  }

  closeChest() {
    this.openChestKey = null;
    this.stashCursor();
    this.pushState();
  }

  /** Never lose the stack held by the mouse when a window closes. */
  stashCursor() {
    const cursor = this.inventory.cursor;
    if (!cursor) return;
    const left = this.inventory.add(cursor.id, cursor.count);
    this.inventory.cursor = null;
    if (left > 0) this.notify("Предметы не поместились в инвентарь");
  }

  clickChest(index: number, right: boolean, shift: boolean) {
    if (!this.openChestKey) return;
    const chest = this.chests.get(this.openChestKey);
    if (!chest) return;
    const slot = chest[index];
    const inv = this.inventory;
    if (shift) {
      if (!slot) return;
      const left = inv.add(slot.id, slot.count);
      if (left === 0) chest[index] = null;
      else slot.count = left;
      inv.touch();
    } else {
      const tmp = inv.cursor;
      if (inv.cursor && slot && slot.id === inv.cursor.id) {
        const max = getItem(slot.id)?.stack ?? 64;
        const put = Math.min(max - slot.count, inv.cursor.count);
        slot.count += put;
        inv.cursor.count -= put;
        if (inv.cursor.count <= 0) inv.cursor = null;
      } else {
        inv.cursor = slot;
        chest[index] = tmp;
      }
      inv.touch();
    }
    this.dirtyChests.add(this.openChestKey);
    this.pushState();
  }

  takeChestAll() {
    if (!this.openChestKey) return;
    const chest = this.chests.get(this.openChestKey);
    if (!chest) return;
    chest.forEach((s, i) => {
      if (!s) return;
      const left = this.inventory.add(s.id, s.count);
      chest[i] = left > 0 ? { ...s, count: left } : null;
    });
    this.dirtyChests.add(this.openChestKey);
    this.pushState();
  }

  tryTrade(index: number) {
    const offer = TRADES[index];
    if (!offer || !this.tradeTarget) return;
    if (!this.inventory.consume(offer.give.id, offer.give.count)) {
      this.notify("Не хватает предметов для обмена");
      this.pushState();
      return;
    }
    playSound("pop");
    this.inventory.add(offer.get.id, offer.get.count);
    this.notify(`Обмен: ${getItem(offer.get.id)?.name} x${offer.get.count}`);
    this.unlock("trade");
    this.pushState();
  }

  closeTrade() {
    this.tradeTarget = null;
    this.stashCursor();
    this.pushState();
  }

  respawn() {
    this.health = MAX_HEALTH;
    this.food = MAX_FOOD;
    this.ui.dead = false;
    const x = Math.floor(this.pos.x);
    const z = Math.floor(this.pos.z);
    const y = this.world.highestSolid(x, z) + 2.2;
    this.pos.set(x + 0.5, Math.max(y, SEA_LEVEL + 2), z + 0.5);
    this.vel.set(0, 0, 0);
    if (this.mode === "survival") this.giveStarterKit();
    this.pushState();
  }

  savePayload(): SavePayload {
    return {
      player: {
        x: this.pos.x,
        y: this.pos.y,
        z: this.pos.z,
        yaw: this.yaw,
        pitch: this.pitch,
        health: this.health,
        food: this.food,
        mode: this.mode,
        time: this.time,
        flying: this.flying,
        slots: this.inventory.slots.map((s) => (s ? { ...s } : null)),
        selected: this.inventory.selected,
      },
      edits: this.world.takePendingEdits(),
      chests: [
        ...[...this.deletedChests].map((k) => {
          const [x, y, z] = k.split(",").map(Number);
          return { x, y, z, items: [] as Array<SaveSlot | null>, deleted: true };
        }),
        ...[...this.dirtyChests]
          .map((k) => {
            const [x, y, z] = k.split(",").map(Number);
            const items = this.chests.get(k) ?? [];
            return { x, y, z, items: items.map((s) => (s ? { ...s } : null)) };
          })
          .filter((c) => c.items.some(Boolean)),
      ],
      playSeconds: Math.round(this.playSeconds),
      // Update 2.0: furnaces persisted via extra field (handled by API separately)
      furnaces: [
        ...[...this.deletedFurnaces].map((k) => {
          const [x, y, z] = k.split(",").map(Number);
          return { x, y, z, data: null as any, deleted: true };
        }),
        ...[...this.dirtyFurnaces].map((k) => {
          const [x, y, z] = k.split(",").map(Number);
          const data = this.furnaces.get(k) ?? createFurnace();
          return { x, y, z, data };
        }),
      ],
    } as SavePayload & { furnaces: any[] };
  }

  flushSave() {
    this.opts.onAutoSave(this.savePayload());
  }

  // ----------------------- UPDATE 2.0 API -----------------------
  openFurnace(key: string) {
    if (!this.furnaces.has(key)) this.furnaces.set(key, createFurnace());
    this.openFurnaceKey = key;
    this.dirtyFurnaces.add(key);
    this.ui.inventoryOpen = false;
    if (document.pointerLockElement === this.opts.canvas) document.exitPointerLock();
    this.pushState();
  }
  closeFurnace() {
    this.openFurnaceKey = null;
    this.stashCursor();
    this.pushState();
  }
  clickFurnace(slot: 0 | 1 | 2, right: boolean, shift: boolean) {
    if (!this.openFurnaceKey) return;
    const f = this.furnaces.get(this.openFurnaceKey);
    if (!f) return;
    const inv = this.inventory;
    const getF = () => (slot === 0 ? f.input : slot === 1 ? f.fuel : f.output);
    const setF = (v: { id: string; count: number } | null) => {
      if (slot === 0) f.input = v;
      else if (slot === 1) f.fuel = v;
      else f.output = v;
    };
    if (shift) {
      if (slot === 2 && f.output) {
        const left = inv.add(f.output.id, f.output.count);
        if (left === 0) f.output = null;
        else f.output.count = left;
        inv.touch();
        this.unlock("furnace_smelt");
      } else {
        const cur = getF();
        if (cur) {
          const left = inv.add(cur.id, cur.count);
          if (left === 0) setF(null);
          else cur.count = left;
        }
      }
    } else {
      const cursor = inv.cursor;
      const cur = getF();
      if (!cursor && cur) {
        inv.cursor = cur;
        setF(null);
      } else if (cursor && !cur) {
        // validate fuel/input
        if (slot === 1 && !(getItem(cursor.id)?.fuel)) {
          // only fuel allowed in fuel slot
          this.notify("Сюда можно только топливо (уголь, палки...)");
          return;
        }
        if (slot === 0 && cursor.id === "copper_block") {
          // allow? just generic input
        }
        if (slot === 2) {
          // output slot is take-only
          return;
        }
        setF(cursor);
        inv.cursor = null;
      } else if (cursor && cur && cur.id === cursor.id && slot !== 2) {
        const max = getItem(cur.id)?.stack ?? 64;
        const put = Math.min(max - cur.count, cursor.count);
        cur.count += put;
        cursor.count -= put;
        if (cursor.count <= 0) inv.cursor = null;
      } else if (cursor && cur) {
        inv.cursor = cur;
        setF(cursor);
      }
    }
    this.dirtyFurnaces.add(this.openFurnaceKey);
    this.pushState();
  }
  takeFurnaceOutput() {
    if (!this.openFurnaceKey) return;
    const f = this.furnaces.get(this.openFurnaceKey);
    if (!f?.output) return;
    const left = this.inventory.add(f.output.id, f.output.count);
    if (left === 0) {
      f.output = null;
      this.unlock("furnace_smelt");
    } else f.output.count = left;
    this.dirtyFurnaces.add(this.openFurnaceKey);
    this.pushState();
  }
  setWeather(w: "clear" | "rain") {
    this.weather = w;
    if (this.rainGroup) this.rainGroup.visible = w === "rain";
    this.notify(w === "rain" ? "Начался дождь" : "Дождь закончился");
    this.pushState();
  }
  toggleWeather() {
    this.setWeather(this.weather === "rain" ? "clear" : "rain");
  }
  private createClouds(): THREE.Group {
    const g = new THREE.Group();
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.52 });
    // simple pseudo-cloud blobs
    const noise = (x: number, z: number) => Math.sin(x*0.11)*Math.cos(z*0.11) + Math.sin(x*0.05+z*0.02)*0.5;
    for (let i = 0; i < 18; i++) {
      const x = (Math.random() - 0.5) * 220;
      const z = (Math.random() - 0.5) * 220;
      const y = 62 + Math.random()*6;
      const group = new THREE.Group();
      const count = 3 + Math.floor(Math.random()*4);
      for (let k = 0; k < count; k++) {
        const bx = (Math.random()-0.5)*10;
        const bz = (Math.random()-0.5)*8;
        const by = (Math.random()-0.5)*2;
        const sx = 7 + Math.random()*8;
        const sy = 3 + Math.random()*2;
        const sz = 6 + Math.random()*7;
        const box = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), cloudMat);
        box.position.set(bx, by, bz);
        group.add(box);
      }
      group.position.set(x, y, z);
      g.add(group);
    }
    return g;
  }
  private createRain(): THREE.Points {
    const count = 2600;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count*3);
    const vel = new Float32Array(count);
    for (let i=0;i<count;i++) {
      pos[i*3] = (Math.random()-0.5)*160;
      pos[i*3+1] = Math.random()*80 + 30;
      pos[i*3+2] = (Math.random()-0.5)*160;
      vel[i] = 30 + Math.random()*12;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos,3));
    geo.setAttribute("velocity", new THREE.BufferAttribute(vel,1));
    const mat = new THREE.PointsMaterial({ color: 0xaac8ff, size: 0.18, transparent: true, opacity: 0.55, depthWrite: false });
    const points = new THREE.Points(geo, mat);
    points.visible = false;
    points.frustumCulled = false;
    return points;
  }
  private updateRain(dt: number) {
    if (!this.rainGroup || this.weather !== "rain") return;
    const pos = this.rainGroup.geometry.getAttribute("position") as THREE.BufferAttribute;
    const vel = this.rainGroup.geometry.getAttribute("velocity") as THREE.BufferAttribute;
    for (let i=0;i<pos.count;i++) {
      let y = pos.getY(i);
      y -= vel.getX(i) * dt;
      if (y < this.pos.y - 20) {
        y = this.pos.y + 30 + Math.random()*30;
        pos.setX(i, this.pos.x + (Math.random()-0.5)*100);
        pos.setZ(i, this.pos.z + (Math.random()-0.5)*100);
      }
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    // centre rain around player
    this.rainGroup.position.set(0, 0, 0);
  }
  private updateClouds(dt: number) {
    if (!this.cloudGroup) return;
    this.cloudGroup.position.x += dt * 0.9;
    this.cloudGroup.position.z += dt * 0.35;
    // wrap clouds (simple)
    if (this.cloudGroup.position.x > 80) this.cloudGroup.position.x = -80;
    if (this.cloudGroup.position.z > 80) this.cloudGroup.position.z = -80;
  }
  private updateFurnaces(dt: number) {
    const ticks = dt * 20; // 20 ticks per sec
    for (const [k, f] of this.furnaces) {
      if (tickFurnace(f, ticks)) {
        this.dirtyFurnaces.add(k);
        if (this.openFurnaceKey === k) this.pushState();
      }
    }
  }
  unlock(id: string) {
    if (this.achievements[id]) return;
    this.achievements[id] = true;
    const ach = ACHIEVEMENTS.find(a=>a.id===id);
    if (ach) {
      this.toast = { title: ach.name, desc: ach.desc };
      this.toastTimer = 4.0;
      playSound("pop", 1.1);
    }
    this.pushState();
  }
  private checkExplorer() {
    const dx = this.pos.x - this.lastPos.x;
    const dz = this.pos.z - this.lastPos.z;
    this.travelled += Math.sqrt(dx*dx + dz*dz);
    this.lastPos.copy(this.pos);
    if (this.travelled > 1000) this.unlock("explorer");
  }
  setSprint(v: boolean) {
    this.sprinting = v;
  }

  // ----------------------------------------------------------------- helpers
  private notifyState() {
    this.pushState();
  }

  private pushState() {
    const held = this.inventory.held();
    const hit = this.targetHit;
    const targetDef = hit ? BLOCKS[this.world.getBlock(hit.x, hit.y, hit.z)] : undefined;
    const hours = Math.floor(((this.time * 24) + 6) % 24);
    const minutes = Math.floor((((this.time * 24) + 6) % 1) * 60);
    this.opts.onState({
      health: this.health,
      food: this.food,
      mode: this.mode,
      slots: this.inventory.slots.map((s) => (s ? { ...s } : null)),
      selected: this.inventory.selected,
      cursor: this.inventory.cursor ? { ...this.inventory.cursor } : null,
      pos: { x: this.pos.x, y: this.pos.y, z: this.pos.z },
      fps: Math.round(this.fps),
      clock: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
      dayFraction: this.time,
      target: targetDef?.name ?? null,
      biome: this.world.gen.biomeAt(Math.floor(this.pos.x), Math.floor(this.pos.z), this.world.gen.terrainHeight(Math.floor(this.pos.x), Math.floor(this.pos.z))),
      chunks: this.world.chunks.size,
      mobs: this.mobs.length,
      chestKey: this.openChestKey,
      inventoryOpen: this.ui.inventoryOpen,
      paused: this.ui.paused,
      dead: this.ui.dead,
      tradeOffers: this.tradeTarget ? TRADES : null,
      message: this.message,
      loading: this.loading,
      craftable: this.inventory.findCraftable(),
      flying: this.flying,
      underwater: BLOCKS[this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + EYE_HEIGHT), Math.floor(this.pos.z))]?.liquid ?? false,
      heldName: held ? getItem(held.id)?.name ?? held.id : null,
      progress: this.mineTime > 0 ? this.mineProgress / this.mineTime : 0,
      saveState: this.saveState,
      furnaceKey: this.openFurnaceKey,
      furnace: this.openFurnaceKey ? (this.furnaces.get(this.openFurnaceKey) ?? null) : null,
      weather: this.weather,
      sprinting: this.sprinting,
      achievements: { ...this.achievements },
      toast: this.toast,
      xpLevel: this.xpLevel,
      travelled: Math.round(this.travelled),
      version: UPDATE_VERSION,
    });
  }

  private dropItem(id: string, count: number) {
    void id;
    void count;
  }

  private damage(amount: number) {
    if (this.mode === "creative" || this.ui.dead) return;
    playSound("hurt", 0.9 + Math.random() * 0.2);
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.ui.dead = true;
      this.setPaused(true);
    }
    this.notifyState();
  }

  private isNight() {
    return this.time > 0.5;
  }

  private pickBlock() {
    const hit = this.targetHit;
    if (!hit) return;
    const id = this.world.getBlock(hit.x, hit.y, hit.z);
    const def = BLOCKS[id];
    if (!def) return;
    for (let i = 0; i < 9; i++) {
      if (this.inventory.slots[i]?.id === def.item) {
        this.setSelected(i);
        return;
      }
    }
    if (this.mode === "creative") {
      this.inventory.add(def.item, 1);
      this.notifyState();
    }
  }

  private useItem() {
    // chest / villager interaction first
    const hit = this.targetHit;
    if (hit) {
      const id = this.world.getBlock(hit.x, hit.y, hit.z);
      if (id === 26) {
        this.openChest(blockKey(hit.x, hit.y, hit.z));
        return;
      }
      if (id === 49) {
        this.openFurnace(blockKey(hit.x, hit.y, hit.z));
        return;
      }
      if (id === 25) {
        this.ui.inventoryOpen = true;
        if (document.pointerLockElement === this.opts.canvas) document.exitPointerLock();
        this.notifyState();
        return;
      }
      // berry bush harvest
      if (id === 55) {
        this.world.setBlock(hit.x, hit.y, hit.z, 0);
        this.inventory.add("sweet_berries", 1 + Math.floor(Math.random()*2));
        playSound("pop", 1.2);
        this.notifyState();
        this.unlock("copper");
        return;
      }
    }
    // villager trade
    let nearest: Mob | null = null;
    let bestDist = 3.2;
    for (const mob of this.mobs) {
      if (mob.kind !== "villager") continue;
      const d = mob.pos.distanceTo(this.pos);
      if (d < bestDist) {
        bestDist = d;
        nearest = mob;
      }
    }
    if (nearest) {
      this.tradeTarget = nearest;
      if (document.pointerLockElement === this.opts.canvas) document.exitPointerLock();
      this.notifyState();
      return;
    }

    const held = this.inventory.held();
    if (!held) return;
    const def = getItem(held.id);
    if (def?.food) {
      if (this.food >= MAX_FOOD && this.health >= MAX_HEALTH) return;
      this.food = Math.min(MAX_FOOD, this.food + def.food);
      if (def.heal) this.health = Math.min(MAX_HEALTH, this.health + def.heal);
      if (held.id === "mushroom_stew") this.inventory.slots[this.inventory.selected] = null;
      else if (held.count <= 1) this.inventory.slots[this.inventory.selected] = null;
      else held.count--;
      this.inventory.touch();
      playSound("eat");
      this.notifyState();
      return;
    }
    if (!def?.block) return;
    if (!hit) return;
    const px = hit.x + hit.nx;
    const py = hit.y + hit.ny;
    const pz = hit.z + hit.nz;
    const existing = this.world.getBlock(px, py, pz);
    if (existing !== 0 && !BLOCKS[existing]?.liquid && !BLOCKS[existing]?.cross) return;
    const blockDef = BLOCKS[def.block];
    if (blockDef?.cross && !BLOCKS[this.world.getBlock(px, py - 1, pz)]?.solid) return;
    // do not place inside the player
    if (blockDef?.solid) {
      const overlapX = Math.abs(px + 0.5 - this.pos.x) < 0.5 + PLAYER_HW;
      const overlapZ = Math.abs(pz + 0.5 - this.pos.z) < 0.5 + PLAYER_HW;
      const overlapY = py + 1 > this.pos.y && py < this.pos.y + PLAYER_H;
      if (overlapX && overlapZ && overlapY) return;
    }
    this.world.setBlock(px, py, pz, def.block);
    playSound("place", 0.9 + Math.random() * 0.3);
    if (def.block === 26) this.dirtyChests.add(blockKey(px, py, pz));
    if (this.mode === "survival") {
      if (held.id === "water_bucket") this.inventory.slots[this.inventory.selected] = { id: "bucket", count: 1 };
      else if (held.count <= 1) this.inventory.slots[this.inventory.selected] = null;
      else held.count--;
      this.inventory.touch();
    }
    this.notifyState();
  }

  private attack() {
    const dir = this.forward();
    const origin = this.eye();
    let best: Mob | null = null;
    let bestDist = 4;
    for (const mob of this.mobs) {
      const toMob = new THREE.Vector3().subVectors(mob.pos, origin);
      const proj = toMob.dot(dir);
      if (proj < 0 || proj > bestDist) continue;
      const perp = toMob.clone().sub(dir.clone().multiplyScalar(proj)).length();
      if (perp < 0.85) {
        best = mob;
        bestDist = proj;
      }
    }
    if (!best) return false;
    const held = this.inventory.held();
    const tool = held ? getItem(held.id)?.tool : undefined;
    const dmg = tool ? tool.damage : 1;
    playSound("hurt", 1.3);
    const killed = best.hurt(dmg, dir);
    if (this.mode === "survival") this.inventory.damageHeld(1);
    if (killed) {
      for (const drop of best.rollDrops()) this.inventory.add(drop.id, drop.count);
      this.notify(`${MOB_STATS[best.kind].name} побеждена`);
      this.scene.remove(best.group);
      this.mobs = this.mobs.filter((m) => m !== best);
    }
    this.notifyState();
    return true;
  }

  private forward() {
    return new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  private eye() {
    return new THREE.Vector3(this.pos.x, this.pos.y + EYE_HEIGHT, this.pos.z);
  }

  private startMining(hit: NonNullable<ReturnType<typeof raycast>>) {
    const id = this.world.getBlock(hit.x, hit.y, hit.z);
    const def = BLOCKS[id];
    if (!def || def.hardness > 100) {
      this.mineTarget = null;
      return;
    }
    if (this.mode === "creative") {
      this.breakBlock(hit.x, hit.y, hit.z);
      this.mineTarget = null;
      return;
    }
    if (this.mineTarget?.x !== hit.x || this.mineTarget.y !== hit.y || this.mineTarget.z !== hit.z) {
      this.mineTarget = { x: hit.x, y: hit.y, z: hit.z };
      this.mineProgress = 0;
      const held = this.inventory.held();
      const tool = held ? getItem(held.id)?.tool : undefined;
      const rightTool = tool && tool.kind === def.tool;
      const tier = tool ? tool.tier : 0;
      let speed = rightTool ? tool!.speed : 1;
      if (def.minTier && tier < def.minTier) speed *= 0.28;
      this.mineTime = Math.max(0.05, def.hardness / speed);
    }
  }

  private breakBlock(x: number, y: number, z: number) {
    const id = this.world.getBlock(x, y, z);
    const def = BLOCKS[id];
    if (!def) return;
    if (def.loot) {
      const key = blockKey(x, y, z);
      this.chests.delete(key);
      this.dirtyChests.delete(key);
      this.deletedChests.add(key);
    }
    if (id === 49) {
      const key = blockKey(x, y, z);
      this.furnaces.delete(key);
      this.dirtyFurnaces.delete(key);
      this.deletedFurnaces.add(key);
      if (this.openFurnaceKey === key) this.openFurnaceKey = null;
    }
    this.world.setBlock(x, y, z, 0);
    playSound("dig", 0.8 + Math.random() * 0.4);
    if (this.mode === "survival") {
      let drop: string | null = def.drops ?? null;
      if (def.dropFn) drop = def.dropFn(Math.random());
      if (def.minTier) {
        const held = this.inventory.held();
        const tool = held ? getItem(held.id)?.tool : undefined;
        if (!tool || tool.tier < def.minTier) drop = null;
      }
      if (drop) {
        this.inventory.add(drop, 1);
        // achievements
        if (drop === "copper_ingot" || drop === "raw_copper") this.unlock("copper");
        if (drop === "amethyst_shard") this.unlock("amethyst");
        if (drop === "diamond") this.unlock("diamonds");
      }
      if (def.tool !== "hand" && def.hardness >= 0.4) this.inventory.damageHeld(1);
      this.blockedBreaks++;
      if (this.blockedBreaks === 1) this.unlock("first_block");
      if (id === 50 || id === 52) this.xpLevel = Math.min(30, this.xpLevel + 1);
    } else {
      // creative still counts copper etc for achievements
      if (id === 50) this.unlock("copper");
      if (id === 52) this.unlock("amethyst");
    }
    // gravity-ish: sand/gravel above falls
    for (let dy = 1; dy < 4; dy++) {
      const above = this.world.getBlock(x, y + dy, z);
      if (above === 5 || above === 7) {
        this.world.setBlock(x, y + dy, z, 0);
        this.world.setBlock(x, y + dy - 1, z, above);
      } else break;
    }
    this.notifyState();
  }

  // ------------------------------------------------------------------- frame
  private frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.fps = this.fps * 0.92 + (1 / Math.max(dt, 0.0001)) * 0.08;
    const uiOpen = this.ui.paused || this.ui.dead || this.ui.inventoryOpen || Boolean(this.openChestKey) || Boolean(this.openFurnaceKey) || Boolean(this.tradeTarget);
    if (!uiOpen) {
      this.playSeconds += dt;
      this.updateTime(dt);
      this.updatePlayer(dt);
      this.updateMobs(dt);
      this.updateMining(dt);
      this.updateSurvival(dt);
    } else {
      this.keys.clear();
      this.mouseDown = [false, false, false];
      this.mineTarget = null;
      this.mineProgress = 0;
    }
    const pending = this.world.update(this.pos.x, this.pos.z, this.renderDistance, 7);
    this.loading = pending;
    this.spawnMobs(dt, pending);
    this.updateCamera();
    this.updateSky();
    this.lightTimer -= dt;
    if (this.lightTimer <= 0) {
      this.lightTimer = 0.5;
      this.updateTorchLights();
    }
    // Update 2.0 systems
    this.updateRain(dt);
    this.updateClouds(dt);
    this.updateFurnaces(dt);
    this.checkExplorer();
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast = null;
    }
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      // auto weather change occasionally
      this.weatherTimer = 80 + Math.random()*120;
      if (Math.random() < 0.22) this.weather = this.weather === "clear" ? "rain" : "clear";
      if (this.rainGroup) this.rainGroup.visible = this.weather === "rain";
    }
    this.messageTimer -= dt;
    if (this.messageTimer <= 0 && this.message) this.message = null;
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) {
      this.stateTimer = 0.12;
      this.targetHit = raycast(this.world, this.eye(), this.forward(), 6);
      this.highlight.visible = Boolean(this.targetHit);
      if (this.targetHit) this.highlight.position.set(this.targetHit.x + 0.5, this.targetHit.y + 0.5, this.targetHit.z + 0.5);
      this.pushState();
    }
    this.saveTimer -= dt;
    if (this.saveTimer <= 0) {
      this.saveTimer = 20;
      this.saveState = "saving";
      this.flushSave();
      setTimeout(() => {
        this.saveState = "saved";
        this.pushState();
      }, 400);
    }
    this.renderer.render(this.scene, this.camera);
  }

  private updateTime(dt: number) {
    this.time = (this.time + dt / DAY_LENGTH) % 1;
  }

  private updateCamera() {
    const eye = this.eye();
    this.camera.position.copy(eye);
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }

  private updateSky() {
    const t = this.time;
    const angle = t * Math.PI * 2;
    const sunHeight = Math.sin(angle);
    this.sun.position.set(Math.cos(angle) * 120 + this.pos.x, sunHeight * 140 + this.pos.y, 40 + this.pos.z);
    this.sun.target.position.copy(this.pos);
    const day = Math.max(0, Math.min(1, sunHeight * 2 + 0.35));
    const nightColor = new THREE.Color(0x0a0f24);
    const dayColor = new THREE.Color(0x8fd0ff);
    const duskColor = new THREE.Color(0xff9d5c);
    const dusk = Math.max(0, 1 - Math.abs(sunHeight) * 3.2);
    const sky = nightColor.clone().lerp(dayColor, day).lerp(duskColor, dusk * 0.55);
    this.scene.background = sky;
    (this.scene.fog as THREE.Fog).color = sky;
    this.sun.intensity = 0.15 + day * 1.15;
    this.hemi.intensity = 0.25 + day * 0.85;
    this.hemi.color.copy(sky).lerp(new THREE.Color(0xffffff), 0.35);
  }

  private updateTorchLights() {
    const candidates: THREE.Vector3[] = [];
    for (const lights of this.world.lights.values()) {
      for (const p of lights) {
        if (p.distanceToSquared(this.pos) < 900) candidates.push(p);
      }
    }
    candidates.sort((a, b) => a.distanceToSquared(this.pos) - b.distanceToSquared(this.pos));
    this.torchLights.forEach((light, i) => {
      const p = candidates[i];
      if (p) {
        light.position.copy(p);
        light.intensity = 6;
      } else {
        light.intensity = 0;
      }
    });
  }

  private updatePlayer(dt: number) {
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3();
    if (this.keys.has("KeyW")) wish.add(forward);
    if (this.keys.has("KeyS")) wish.sub(forward);
    if (this.keys.has("KeyD")) wish.add(right);
    if (this.keys.has("KeyA")) wish.sub(right);
    const wantsSprint = (this.keys.has("ShiftLeft") || this.keys.has("ControlLeft")) && this.keys.has("KeyW") && !this.flying && wish.lengthSq() > 0;
    this.sprinting = Boolean(wantsSprint && this.food > 2);
    const sprint = this.sprinting;
    const sneak = this.keys.has("KeyC");
    let speed = this.flying ? 12 : sprint ? 7.4 : 4.6;
    if (sneak && !this.flying) speed = 2.1;
    const water = inWater(this.world, this.pos, PLAYER_H);
    if (water && !this.flying) speed *= 0.55;
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);

    const accel = this.onGround || this.flying ? 14 : 5;
    this.vel.x += (wish.x - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (wish.z - this.vel.z) * Math.min(1, accel * dt);

    if (this.flying) {
      const up = (this.keys.has("Space") ? 1 : 0) - (this.keys.has("ShiftLeft") ? 1 : 0);
      this.vel.y += (up * 9 - this.vel.y) * Math.min(1, 10 * dt);
    } else {
      this.vel.y -= (water ? 8 : 27) * dt;
      if (this.keys.has("Space")) {
        if (water) this.vel.y = 4.2;
        else if (this.onGround) {
          this.vel.y = 8.6;
          this.food = Math.max(0, this.food - 0.02);
        }
      }
      if (water) this.vel.y = Math.max(this.vel.y, -2.4);
    }

    const wasAir = !this.onGround;
    const res = moveEntity(this.world, this.pos, this.vel, PLAYER_HW, PLAYER_H, dt);
    this.onGround = res.onGround;

    // fall damage
    if (!this.onGround) {
      if (this.fallStart === null || this.pos.y > this.fallStart) this.fallStart = this.pos.y;
    } else {
      if (wasAir && this.fallStart !== null && !water && !this.flying) {
        const fall = this.fallStart - this.pos.y;
        if (fall > 3.5) this.damage(Math.floor((fall - 3) * 1.3));
      }
      this.fallStart = null;
    }
    if (this.sprinting) this.food = Math.max(0, this.food - dt * 0.09);
    if (this.pos.y < -12) this.damage(20);
    if (this.mode === "creative" && this.pos.y < -40) {
      const y = this.world.highestSolid(Math.floor(this.pos.x), Math.floor(this.pos.z)) + 2;
      this.pos.y = y;
      this.vel.set(0, 0, 0);
    }
  }

  private updateSurvival(dt: number) {
    if (this.mode === "creative") return;
    this.food = Math.max(0, this.food - dt * 0.035);
    const head = BLOCKS[this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + EYE_HEIGHT), Math.floor(this.pos.z))];
    if (head?.liquid) {
      this.air -= dt / 12;
      if (this.air <= 0) {
        this.air = 1;
        this.damage(2);
      }
    } else this.air = Math.min(1, this.air + dt / 2);
    if (this.food > 14 && this.health < MAX_HEALTH) {
      this.regenTimer = (this.regenTimer ?? 0) + dt;
      if (this.regenTimer > 4) {
        this.regenTimer = 0;
        this.health = Math.min(MAX_HEALTH, this.health + 1);
        this.food = Math.max(0, this.food - 0.4);
      }
    }
    if (this.food <= 0) {
      this.starveTimer = (this.starveTimer ?? 0) + dt;
      if (this.starveTimer > 6) {
        this.starveTimer = 0;
        this.damage(1);
      }
    }
  }

  private regenTimer = 0;
  private starveTimer = 0;

  private updateMining(dt: number) {
    if (this.mouseDown[0]) {
      const liveHit = raycast(this.world, this.eye(), this.forward(), 6);
      if (!this.attackedThisPress) {
        // one melee attempt per press: hitting a mob blocks mining
        this.attackedThisPress = true;
        if (this.attack()) return;
      }
      if (liveHit) this.startMining(liveHit);
      else {
        this.mineTarget = null;
        this.mineProgress = 0;
      }
      if (this.mineTarget) {
        this.mineProgress += dt;
        if (this.mineProgress >= this.mineTime) {
          this.breakBlock(this.mineTarget.x, this.mineTarget.y, this.mineTarget.z);
          this.mineTarget = null;
          this.mineProgress = 0;
        }
      }
    } else {
      this.attackedThisPress = false;
      this.mineTarget = null;
      this.mineProgress = 0;
    }
  }

  private attackedThisPress = false;
  private loading = true;

  private updateMobs(dt: number) {
    const isNight = this.isNight();
    for (const mob of this.mobs) {
      mob.update(dt, this.world, this.pos, (dmg) => this.damage(dmg), isNight);
    }
    const before = this.mobs.length;
    this.mobs = this.mobs.filter((m) => {
      if (m.dead) {
        this.scene.remove(m.group);
        return false;
      }
      if (m.pos.distanceTo(this.pos) > 90) {
        this.scene.remove(m.group);
        return false;
      }
      return true;
    });
    if (this.mobs.length !== before) this.notifyState();
  }

  private spawnMobs(dt: number, pending: boolean) {
    void pending;
    // consume chunk spawn hints
    const queue = this.world.spawnQueue;
    for (let i = queue.length - 1; i >= 0; i--) {
      const s = queue[i];
      const d = Math.hypot(s.x - this.pos.x, s.z - this.pos.z);
      if (d > 120) {
        queue.splice(i, 1);
        continue;
      }
      if (d > 40 || d < 6) continue;
      if (s.kind === "villager") {
        if (this.mobs.some((m) => m.kind === "villager" && m.pos.distanceTo(new THREE.Vector3(s.x, s.y, s.z)) < 24)) {
          queue.splice(i, 1);
          continue;
        }
      } else if (this.mobs.filter((m) => !MOB_STATS[m.kind].hostile).length >= 22) {
        continue;
      }
      this.addMob(s.kind, s.x, s.y, s.z);
      queue.splice(i, 1);
    }
    // night hostiles
    this.hostileTimer -= dt;
    if (this.hostileTimer <= 0) {
      this.hostileTimer = 4;
      if (this.isNight() && this.mode === "survival" && this.mobs.filter((m) => MOB_STATS[m.kind].hostile).length < 8) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 16 + Math.random() * 14;
        const x = Math.floor(this.pos.x + Math.cos(angle) * dist);
        const z = Math.floor(this.pos.z + Math.sin(angle) * dist);
        const y = this.world.highestSolid(x, z) + 1.6;
        if (y > SEA_LEVEL - 4) this.addMob(Math.random() < 0.7 ? "zombie" : "skeleton", x + 0.5, y, z + 0.5);
      }
    }
  }

  private addMob(kind: MobKind, x: number, y: number, z: number) {
    if (this.mobs.length > 40) return;
    const mob = new Mob(kind, x, y, z);
    this.mobs.push(mob);
    this.scene.add(mob.group);
  }

  /** icons for HUD (used by React) */
  icon(id: string) {
    return getItemIcon(id);
  }
}
