// Shared save-state types (safe to import from server code).
export interface SaveSlot {
  id: string;
  count: number;
  durability?: number;
}

export interface SavePayload {
  player: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    health: number;
    food: number;
    mode: "survival" | "creative";
    time: number;
    flying: boolean;
    slots: Array<SaveSlot | null>;
    selected: number;
  };
  edits: Array<{ x: number; y: number; z: number; block: number }>;
  chests: Array<{ x: number; y: number; z: number; items: Array<SaveSlot | null>; deleted?: boolean }>;
  furnaces?: Array<{ x: number; y: number; z: number; data: any; deleted?: boolean }>;
  playSeconds: number;
}

export interface WorldSummary {
  id: number;
  name: string;
  seed: number;
  gameMode: "survival" | "creative";
  playSeconds: number;
  createdAt: string;
  updatedAt: string;
  blockCount?: number;
}

export interface WorldLoadResponse {
  world: WorldSummary;
  player: SavePayload["player"] | null;
  edits: Array<{ x: number; y: number; z: number; block: number }>;
  chests: Array<{ x: number; y: number; z: number; items: Array<SaveSlot | null>; deleted?: boolean }>;
  furnaces?: Array<{ x: number; y: number; z: number; data: any; deleted?: boolean }>;
}
