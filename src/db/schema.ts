import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const worlds = pgTable("worlds", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  seed: integer("seed").notNull(),
  gameMode: text("game_mode").notNull().default("survival"),
  playerState: jsonb("player_state"),
  playSeconds: integer("play_seconds").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const worldBlocks = pgTable(
  "world_blocks",
  {
    id: serial("id").primaryKey(),
    worldId: integer("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    z: integer("z").notNull(),
    block: integer("block").notNull(),
  },
  (table) => [
    uniqueIndex("world_blocks_pos_idx").on(table.worldId, table.x, table.y, table.z),
  ],
);

export const worldChests = pgTable(
  "world_chests",
  {
    id: serial("id").primaryKey(),
    worldId: integer("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    z: integer("z").notNull(),
    items: jsonb("items").notNull(),
  },
  (table) => [uniqueIndex("world_chests_pos_idx").on(table.worldId, table.x, table.y, table.z)],
);

export const worldStats = pgTable(
  "world_stats",
  {
    id: serial("id").primaryKey(),
    worldId: integer("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [uniqueIndex("world_stats_key_idx").on(table.worldId, table.kind)],
);

export const worldFurnaces = pgTable(
  "world_furnaces",
  {
    id: serial("id").primaryKey(),
    worldId: integer("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    z: integer("z").notNull(),
    data: jsonb("data").notNull(),
  },
  (table) => [uniqueIndex("world_furnaces_pos_idx").on(table.worldId, table.x, table.y, table.z)],
);

export type WorldRow = typeof worlds.$inferSelect;
export type WorldBlockRow = typeof worldBlocks.$inferSelect;
export type WorldChestRow = typeof worldChests.$inferSelect;
export type WorldFurnaceRow = typeof worldFurnaces.$inferSelect;
