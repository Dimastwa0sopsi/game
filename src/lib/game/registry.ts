// Registry of blocks and items. Pure data: painters live in textures.ts.

export type ToolKind = "pickaxe" | "axe" | "shovel" | "sword" | "hand";

export interface BlockDef {
  id: number;
  item: string; // item id this block places as
  name: string;
  tiles: { top: string; side: string; bottom: string };
  solid: boolean; // collides
  opaque: boolean; // hides neighbour faces
  liquid?: boolean;
  cross?: boolean; // rendered as two crossed quads
  light?: number;
  hardness: number; // seconds with bare hands
  tool: ToolKind;
  minTier?: number; // tool tier required to get a drop
  drops?: string | null;
  dropChance?: number;
  dropFn?: (r: number) => string | null;
  loot?: boolean; // has an inventory when broken (chest)
}

export interface ItemDef {
  id: string;
  name: string;
  block?: number; // block id placed by this item
  stack: number;
  category: "blocks" | "tools" | "combat" | "food" | "materials";
  tool?: { kind: ToolKind; tier: number; speed: number; damage: number; durability: number };
  food?: number;
  heal?: number;
  fuel?: number;
}

export const AIR = 0;

const B: BlockDef[] = [];
function block(def: Partial<BlockDef> & { id: number; item: string; name: string; tiles: BlockDef["tiles"] }) {
  B[def.id] = {
    solid: true,
    opaque: true,
    hardness: 0.6,
    tool: "hand",
    drops: def.item,
    ...def,
  } as BlockDef;
}

block({ id: 1, item: "grass_block", name: "Дёрн", tiles: { top: "grass_top", side: "grass_side", bottom: "dirt" }, hardness: 0.7, tool: "shovel", drops: "dirt" });
block({ id: 2, item: "dirt", name: "Земля", tiles: { top: "dirt", side: "dirt", bottom: "dirt" }, hardness: 0.6, tool: "shovel" });
block({ id: 3, item: "stone", name: "Камень", tiles: { top: "stone", side: "stone", bottom: "stone" }, hardness: 1.6, tool: "pickaxe", minTier: 1, drops: "cobblestone" });
block({ id: 4, item: "cobblestone", name: "Булыжник", tiles: { top: "cobblestone", side: "cobblestone", bottom: "cobblestone" }, hardness: 1.8, tool: "pickaxe", minTier: 1 });
block({ id: 5, item: "sand", name: "Песок", tiles: { top: "sand", side: "sand", bottom: "sand" }, hardness: 0.5, tool: "shovel" });
block({ id: 6, item: "sandstone", name: "Песчаник", tiles: { top: "sandstone_top", side: "sandstone", bottom: "sandstone_top" }, hardness: 1.2, tool: "pickaxe", minTier: 1 });
block({ id: 7, item: "gravel", name: "Гравий", tiles: { top: "gravel", side: "gravel", bottom: "gravel" }, hardness: 0.7, tool: "shovel" });
block({ id: 8, item: "oak_log", name: "Дубовое бревно", tiles: { top: "log_top", side: "log_side", bottom: "log_top" }, hardness: 1.4, tool: "axe" });
block({ id: 9, item: "oak_leaves", name: "Дубовая листва", tiles: { top: "leaves", side: "leaves", bottom: "leaves" }, hardness: 0.3, opaque: false, dropFn: (r) => (r < 0.25 ? "sapling" : r < 0.32 ? "apple" : r < 0.42 ? "stick" : null) });
block({ id: 10, item: "oak_planks", name: "Доски", tiles: { top: "planks", side: "planks", bottom: "planks" }, hardness: 1.1, tool: "axe" });
block({ id: 11, item: "water", name: "Вода", tiles: { top: "water", side: "water", bottom: "water" }, solid: false, opaque: false, liquid: true, hardness: 0, drops: null });
block({ id: 12, item: "glass", name: "Стекло", tiles: { top: "glass", side: "glass", bottom: "glass" }, opaque: false, hardness: 0.4, drops: null });
block({ id: 13, item: "coal_ore", name: "Угольная руда", tiles: { top: "coal_ore", side: "coal_ore", bottom: "coal_ore" }, hardness: 2.2, tool: "pickaxe", minTier: 1, drops: "coal" });
block({ id: 14, item: "iron_ore", name: "Железная руда", tiles: { top: "iron_ore", side: "iron_ore", bottom: "iron_ore" }, hardness: 2.6, tool: "pickaxe", minTier: 2 });
block({ id: 15, item: "gold_ore", name: "Золотая руда", tiles: { top: "gold_ore", side: "gold_ore", bottom: "gold_ore" }, hardness: 2.8, tool: "pickaxe", minTier: 3 });
block({ id: 16, item: "diamond_ore", name: "Алмазная руда", tiles: { top: "diamond_ore", side: "diamond_ore", bottom: "diamond_ore" }, hardness: 3.2, tool: "pickaxe", minTier: 3, drops: "diamond" });
block({ id: 17, item: "bedrock", name: "Бедрок", tiles: { top: "bedrock", side: "bedrock", bottom: "bedrock" }, hardness: 999, drops: null });
block({ id: 18, item: "snow_block", name: "Снег", tiles: { top: "snow", side: "snow_side", bottom: "dirt" }, hardness: 0.4, tool: "shovel" });
block({ id: 19, item: "ice", name: "Лёд", tiles: { top: "ice", side: "ice", bottom: "ice" }, opaque: false, hardness: 0.6, tool: "pickaxe", drops: null });
block({ id: 20, item: "cactus", name: "Кактус", tiles: { top: "cactus_top", side: "cactus_side", bottom: "cactus_top" }, hardness: 0.5 });
block({ id: 21, item: "pumpkin", name: "Тыква", tiles: { top: "pumpkin_top", side: "pumpkin_side", bottom: "pumpkin_top" }, hardness: 0.9, tool: "axe" });
block({ id: 22, item: "wool", name: "Шерсть", tiles: { top: "wool", side: "wool", bottom: "wool" }, hardness: 0.6 });
block({ id: 23, item: "bricks", name: "Кирпичи", tiles: { top: "bricks", side: "bricks", bottom: "bricks" }, hardness: 2, tool: "pickaxe", minTier: 1 });
block({ id: 24, item: "bookshelf", name: "Книжный шкаф", tiles: { top: "planks", side: "bookshelf", bottom: "planks" }, hardness: 1.4, tool: "axe", drops: "book" });
block({ id: 25, item: "crafting_table", name: "Верстак", tiles: { top: "crafting_top", side: "crafting_side", bottom: "planks" }, hardness: 1.3, tool: "axe" });
block({ id: 26, item: "chest", name: "Сундук", tiles: { top: "chest_top", side: "chest_side", bottom: "chest_top" }, hardness: 1.5, tool: "axe", loot: true });
block({ id: 27, item: "torch", name: "Факел", tiles: { top: "torch", side: "torch", bottom: "torch" }, solid: false, opaque: false, cross: true, light: 14, hardness: 0.1 });
block({ id: 28, item: "sapling", name: "Саженец дуба", tiles: { top: "sapling", side: "sapling", bottom: "sapling" }, solid: false, opaque: false, cross: true, hardness: 0.1 });
block({ id: 29, item: "flower_red", name: "Красный цветок", tiles: { top: "flower_red", side: "flower_red", bottom: "flower_red" }, solid: false, opaque: false, cross: true, hardness: 0.05 });
block({ id: 30, item: "flower_yellow", name: "Жёлтый цветок", tiles: { top: "flower_yellow", side: "flower_yellow", bottom: "flower_yellow" }, solid: false, opaque: false, cross: true, hardness: 0.05 });
block({ id: 31, item: "tall_grass", name: "Трава", tiles: { top: "tall_grass", side: "tall_grass", bottom: "tall_grass" }, solid: false, opaque: false, cross: true, hardness: 0.05, dropFn: () => null });
block({ id: 32, item: "obsidian", name: "Обсидиан", tiles: { top: "obsidian", side: "obsidian", bottom: "obsidian" }, hardness: 6, tool: "pickaxe", minTier: 4 });
block({ id: 33, item: "clay_block", name: "Глина", tiles: { top: "clay", side: "clay", bottom: "clay" }, hardness: 0.7, tool: "shovel", drops: "clay_ball" });
block({ id: 34, item: "mossy_cobblestone", name: "Мшистый булыжник", tiles: { top: "mossy_cobblestone", side: "mossy_cobblestone", bottom: "mossy_cobblestone" }, hardness: 1.8, tool: "pickaxe", minTier: 1 });
block({ id: 35, item: "birch_log", name: "Берёзовое бревно", tiles: { top: "birch_top", side: "birch_side", bottom: "birch_top" }, hardness: 1.4, tool: "axe" });
block({ id: 36, item: "birch_leaves", name: "Берёзовая листва", tiles: { top: "birch_leaves", side: "birch_leaves", bottom: "birch_leaves" }, hardness: 0.3, opaque: false, dropFn: (r) => (r < 0.25 ? "sapling" : r < 0.35 ? "stick" : null) });
block({ id: 37, item: "spruce_log", name: "Еловое бревно", tiles: { top: "spruce_top", side: "spruce_side", bottom: "spruce_top" }, hardness: 1.4, tool: "axe" });
block({ id: 38, item: "spruce_leaves", name: "Еловая листва", tiles: { top: "spruce_leaves", side: "spruce_leaves", bottom: "spruce_leaves" }, hardness: 0.3, opaque: false, dropFn: (r) => (r < 0.25 ? "sapling" : r < 0.35 ? "stick" : null) });
block({ id: 39, item: "glowstone", name: "Светокамень", tiles: { top: "glowstone", side: "glowstone", bottom: "glowstone" }, hardness: 0.5, light: 15 });
block({ id: 40, item: "tnt", name: "ТНТ", tiles: { top: "tnt_top", side: "tnt_side", bottom: "tnt_top" }, hardness: 0.2 });
block({ id: 41, item: "iron_block", name: "Железный блок", tiles: { top: "iron_block", side: "iron_block", bottom: "iron_block" }, hardness: 3.5, tool: "pickaxe", minTier: 2 });
block({ id: 42, item: "gold_block", name: "Золотой блок", tiles: { top: "gold_block", side: "gold_block", bottom: "gold_block" }, hardness: 3, tool: "pickaxe", minTier: 3 });
block({ id: 43, item: "diamond_block", name: "Алмазный блок", tiles: { top: "diamond_block", side: "diamond_block", bottom: "diamond_block" }, hardness: 4, tool: "pickaxe", minTier: 3 });
block({ id: 44, item: "stone_bricks", name: "Каменные кирпичи", tiles: { top: "stone_bricks", side: "stone_bricks", bottom: "stone_bricks" }, hardness: 2, tool: "pickaxe", minTier: 1 });
block({ id: 45, item: "melon", name: "Арбуз", tiles: { top: "melon_top", side: "melon_side", bottom: "melon_top" }, hardness: 0.8, tool: "axe", drops: "melon_slice" });
block({ id: 46, item: "mushroom_red", name: "Мухомор", tiles: { top: "mushroom_red", side: "mushroom_red", bottom: "mushroom_red" }, solid: false, opaque: false, cross: true, hardness: 0.05 });
block({ id: 47, item: "mushroom_brown", name: "Гриб", tiles: { top: "mushroom_brown", side: "mushroom_brown", bottom: "mushroom_brown" }, solid: false, opaque: false, cross: true, hardness: 0.05 });
block({ id: 48, item: "dead_bush", name: "Сухой куст", tiles: { top: "dead_bush", side: "dead_bush", bottom: "dead_bush" }, solid: false, opaque: false, cross: true, hardness: 0.05, dropFn: (r) => (r < 0.5 ? "stick" : null) });
// --- ОБНОВЛЕНИЕ 2.0: новые блоки ---
block({ id: 49, item: "furnace", name: "Печь", tiles: { top: "furnace_top", side: "furnace_side", bottom: "furnace_top" }, hardness: 2.2, tool: "pickaxe", minTier: 1 });
block({ id: 50, item: "copper_ore", name: "Медная руда", tiles: { top: "copper_ore", side: "copper_ore", bottom: "copper_ore" }, hardness: 2.4, tool: "pickaxe", minTier: 2, drops: "raw_copper" });
block({ id: 51, item: "copper_block", name: "Медный блок", tiles: { top: "copper_block", side: "copper_block", bottom: "copper_block" }, hardness: 2.8, tool: "pickaxe", minTier: 2 });
block({ id: 52, item: "amethyst_ore", name: "Аметистовая руда", tiles: { top: "amethyst_ore", side: "amethyst_ore", bottom: "amethyst_ore" }, hardness: 3.0, tool: "pickaxe", minTier: 3, drops: "amethyst_shard" });
block({ id: 53, item: "amethyst_block", name: "Аметистовый блок", tiles: { top: "amethyst_block", side: "amethyst_block", bottom: "amethyst_block" }, hardness: 1.8, light: 7 });
block({ id: 54, item: "lantern", name: "Фонарь", tiles: { top: "lantern", side: "lantern", bottom: "lantern" }, solid: false, opaque: false, cross: true, hardness: 0.4, light: 15 });
block({ id: 55, item: "berry_bush", name: "Ягодный куст", tiles: { top: "berry_bush", side: "berry_bush", bottom: "berry_bush" }, solid: false, opaque: false, cross: true, hardness: 0.3, drops: "sweet_berries", dropFn: (r) => (r < 0.85 ? "sweet_berries" : "stick") });
block({ id: 56, item: "sunflower", name: "Подсолнух", tiles: { top: "sunflower", side: "sunflower", bottom: "sunflower" }, solid: false, opaque: false, cross: true, hardness: 0.05 });
block({ id: 57, item: "campfire", name: "Костёр", tiles: { top: "campfire", side: "campfire", bottom: "campfire" }, hardness: 1.2, tool: "axe", light: 15 });

export const BLOCKS = B;
export const BLOCK_COUNT = B.length;
export const blockById = (id: number): BlockDef | undefined => B[id];

export const ITEMS: Record<string, ItemDef> = {};
function item(def: ItemDef) {
  ITEMS[def.id] = def;
}

// Blocks as items
for (const b of B) {
  if (!b || b.id === AIR) continue;
  if (b.id === 11) continue; // water handled by bucket
  item({
    id: b.item,
    name: b.name,
    block: b.id,
    stack: 64,
    category: "blocks",
  });
}

item({ id: "stick", name: "Палка", stack: 64, category: "materials", fuel: 5 });
item({ id: "coal", name: "Уголь", stack: 64, category: "materials", fuel: 80 });
item({ id: "iron_ingot", name: "Железный слиток", stack: 64, category: "materials" });
item({ id: "gold_ingot", name: "Золотой слиток", stack: 64, category: "materials" });
item({ id: "diamond", name: "Алмаз", stack: 64, category: "materials" });
item({ id: "emerald", name: "Изумруд", stack: 64, category: "materials" });
item({ id: "flint", name: "Кремень", stack: 64, category: "materials" });
item({ id: "clay_ball", name: "Глина", stack: 64, category: "materials" });
item({ id: "brick_item", name: "Кирпич", stack: 64, category: "materials" });
item({ id: "paper", name: "Бумага", stack: 64, category: "materials" });
item({ id: "book", name: "Книга", stack: 64, category: "materials" });
item({ id: "leather", name: "Кожа", stack: 64, category: "materials" });
item({ id: "feather", name: "Перо", stack: 64, category: "materials" });
item({ id: "string", name: "Нить", stack: 64, category: "materials" });
item({ id: "bone", name: "Кость", stack: 64, category: "materials" });
item({ id: "gunpowder", name: "Порох", stack: 64, category: "materials" });
item({ id: "wheat", name: "Пшеница", stack: 64, category: "materials" });
item({ id: "seeds", name: "Семена", stack: 64, category: "materials" });
item({ id: "sugar", name: "Сахар", stack: 64, category: "materials" });
item({ id: "rotten_flesh", name: "Гнилая плоть", stack: 64, category: "materials" });

item({ id: "raw_copper", name: "Сырая медь", stack: 64, category: "materials" });
item({ id: "copper_ingot", name: "Медный слиток", stack: 64, category: "materials" });
item({ id: "amethyst_shard", name: "Осколок аметиста", stack: 64, category: "materials" });
item({ id: "sweet_berries", name: "Сладкие ягоды", stack: 64, category: "food", food: 3 });
item({ id: "apple", name: "Яблоко", stack: 64, category: "food", food: 4 });
item({ id: "golden_apple", name: "Золотое яблоко", stack: 16, category: "food", food: 6, heal: 8 });
item({ id: "bread", name: "Хлеб", stack: 64, category: "food", food: 5 });
item({ id: "porkchop", name: "Сырая свинина", stack: 64, category: "food", food: 3 });
item({ id: "cooked_porkchop", name: "Жареная свинина", stack: 64, category: "food", food: 8 });
item({ id: "beef", name: "Сырая говядина", stack: 64, category: "food", food: 3 });
item({ id: "steak", name: "Стейк", stack: 64, category: "food", food: 8 });
item({ id: "melon_slice", name: "Долька арбуза", stack: 64, category: "food", food: 2 });
item({ id: "mushroom_stew", name: "Тушёные грибы", stack: 1, category: "food", food: 6 });
item({ id: "bucket", name: "Ведро", stack: 1, category: "tools" });
item({ id: "water_bucket", name: "Ведро воды", stack: 1, category: "tools", block: 11 });
item({ id: "fishing_rod", name: "Удочка", stack: 1, category: "tools" });
item({ id: "compass", name: "Компас", stack: 1, category: "tools" });
item({ id: "clock", name: "Часы", stack: 1, category: "tools" });
item({ id: "map", name: "Карта", stack: 1, category: "tools" });
item({ id: "shears", name: "Ножницы", stack: 1, category: "tools" });

const MATERIALS: Array<{ key: string; name: string; tier: number; speed: number; dmg: number; dur: number; color: string }> = [
  { key: "wooden", name: "Деревянн", tier: 1, speed: 2.2, dmg: 2, dur: 60, color: "#a4763f" },
  { key: "stone", name: "Каменн", tier: 2, speed: 4.5, dmg: 3, dur: 132, color: "#8d8d8d" },
  { key: "iron", name: "Железн", tier: 3, speed: 7, dmg: 4, dur: 251, color: "#dcdcdc" },
  { key: "diamond", name: "Алмазн", tier: 4, speed: 10, dmg: 5, dur: 1562, color: "#4fe3da" },
];
const TOOL_KINDS: Array<{ key: Exclude<ToolKind, "hand">; name: string; base: number }> = [
  { key: "pickaxe", name: "ая кирка", base: 1 },
  { key: "axe", name: "ый топор", base: 3 },
  { key: "shovel", name: "ая лопата", base: 1 },
  { key: "sword", name: "ый меч", base: 4 },
];
for (const m of MATERIALS) {
  for (const k of TOOL_KINDS) {
    const isSword = k.key === "sword";
    item({
      id: `${m.key}_${k.key}`,
      name: `${m.name}${k.name}`,
      stack: 1,
      category: isSword ? "combat" : "tools",
      tool: {
        kind: k.key,
        tier: m.tier,
        speed: isSword ? m.speed * 0.6 : m.speed,
        damage: m.dmg + k.base,
        durability: m.dur,
      },
    });
  }
}

export const ITEM_ORDER = Object.keys(ITEMS);
export const getItem = (id: string): ItemDef | undefined => ITEMS[id];
export const isBlockItem = (id: string) => Boolean(ITEMS[id]?.block);

/** Creative inventory tabs */
export const CREATIVE_TABS: Array<{ key: ItemDef["category"]; name: string }> = [
  { key: "blocks", name: "Блоки" },
  { key: "tools", name: "Инструменты" },
  { key: "combat", name: "Бой" },
  { key: "food", name: "Еда" },
  { key: "materials", name: "Материалы" },
];

/** Simple shapeless crafting recipes: ingredient id -> count */
export interface Recipe {
  out: string;
  count: number;
  need: Record<string, number>;
}
export const RECIPES: Recipe[] = [
  { out: "oak_planks", count: 4, need: { oak_log: 1 } },
  { out: "oak_planks", count: 4, need: { birch_log: 1 } },
  { out: "oak_planks", count: 4, need: { spruce_log: 1 } },
  { out: "stick", count: 4, need: { oak_planks: 2 } },
  { out: "crafting_table", count: 1, need: { oak_planks: 4 } },
  { out: "chest", count: 1, need: { oak_planks: 8 } },
  { out: "torch", count: 4, need: { coal: 1, stick: 1 } },
  { out: "bookshelf", count: 1, need: { oak_planks: 6, book: 3 } },
  { out: "book", count: 1, need: { paper: 3, leather: 1 } },
  { out: "paper", count: 3, need: { tall_grass: 3 } },
  { out: "bread", count: 1, need: { wheat: 3 } },
  { out: "glass", count: 1, need: { sand: 1, coal: 1 } },
  { out: "bricks", count: 1, need: { brick_item: 4 } },
  { out: "brick_item", count: 1, need: { clay_ball: 1, coal: 1 } },
  { out: "stone_bricks", count: 4, need: { stone: 4 } },
  { out: "sandstone", count: 1, need: { sand: 4 } },
  { out: "iron_ingot", count: 1, need: { iron_ore: 1, coal: 1 } },
  { out: "gold_ingot", count: 1, need: { gold_ore: 1, coal: 1 } },
  { out: "iron_block", count: 1, need: { iron_ingot: 9 } },
  { out: "gold_block", count: 1, need: { gold_ingot: 9 } },
  { out: "diamond_block", count: 1, need: { diamond: 9 } },
  { out: "iron_ingot", count: 9, need: { iron_block: 1 } },
  { out: "bucket", count: 1, need: { iron_ingot: 3 } },
  { out: "fishing_rod", count: 1, need: { stick: 3, string: 2 } },
  { out: "shears", count: 1, need: { iron_ingot: 2 } },
  { out: "tnt", count: 1, need: { gunpowder: 5, sand: 4 } },
  { out: "mushroom_stew", count: 1, need: { mushroom_red: 1, mushroom_brown: 1, bowl: 1 } },
  { out: "bowl", count: 4, need: { oak_planks: 3 } },
  { out: "glowstone", count: 1, need: { gold_ingot: 1, torch: 4 } },
  { out: "mossy_cobblestone", count: 1, need: { cobblestone: 1, tall_grass: 1 } },
  { out: "melon_slice", count: 6, need: { melon: 1 } },
  { out: "obsidian", count: 1, need: { stone: 4, diamond: 1 } },
  { out: "compass", count: 1, need: { iron_ingot: 4 } },
  { out: "clock", count: 1, need: { gold_ingot: 4 } },
  { out: "map", count: 1, need: { paper: 8, compass: 1 } },
  { out: "cooked_porkchop", count: 1, need: { porkchop: 1, coal: 1 } },
  { out: "steak", count: 1, need: { beef: 1, coal: 1 } },
  { out: "golden_apple", count: 1, need: { apple: 1, gold_ingot: 4 } },
  { out: "wool", count: 1, need: { string: 4 } },
  { out: "furnace", count: 1, need: { cobblestone: 8 } },
  { out: "copper_ingot", count: 1, need: { raw_copper: 1, coal: 1 } },
  { out: "copper_block", count: 1, need: { copper_ingot: 9 } },
  { out: "copper_ingot", count: 9, need: { copper_block: 1 } },
  { out: "amethyst_block", count: 1, need: { amethyst_shard: 4 } },
  { out: "amethyst_shard", count: 4, need: { amethyst_block: 1 } },
  { out: "lantern", count: 1, need: { torch: 1, iron_ingot: 1 } },
  { out: "campfire", count: 1, need: { oak_log: 3, coal: 1, stick: 3 } },
  { out: "sweet_berries", count: 2, need: { berry_bush: 1 } },
];
for (const m of MATERIALS) {
  const head: Record<string, number> = {};
  if (m.key === "wooden") head.oak_planks = 3;
  else if (m.key === "stone") head.cobblestone = 3;
  else if (m.key === "iron") head.iron_ingot = 3;
  else head.diamond = 3;
  RECIPES.push({ out: `${m.key}_pickaxe`, count: 1, need: { ...head, stick: 2 } });
  RECIPES.push({ out: `${m.key}_axe`, count: 1, need: { ...head, stick: 2 } });
  RECIPES.push({ out: `${m.key}_shovel`, count: 1, need: { ...head, stick: 1 } });
  RECIPES.push({ out: `${m.key}_sword`, count: 1, need: { ...head, stick: 1 } });
}

/** Loot tables used for village chests */
export const CHEST_LOOT: Array<{ id: string; min: number; max: number; weight: number }> = [
  { id: "bread", min: 1, max: 4, weight: 10 },
  { id: "apple", min: 1, max: 3, weight: 8 },
  { id: "iron_ingot", min: 1, max: 3, weight: 7 },
  { id: "gold_ingot", min: 1, max: 2, weight: 4 },
  { id: "coal", min: 2, max: 6, weight: 9 },
  { id: "torch", min: 2, max: 8, weight: 8 },
  { id: "diamond", min: 1, max: 2, weight: 2 },
  { id: "emerald", min: 1, max: 3, weight: 3 },
  { id: "sapling", min: 1, max: 3, weight: 5 },
  { id: "bucket", min: 1, max: 1, weight: 3 },
  { id: "seeds", min: 2, max: 5, weight: 6 },
  { id: "iron_pickaxe", min: 1, max: 1, weight: 2 },
  { id: "book", min: 1, max: 2, weight: 4 },
  { id: "gunpowder", min: 1, max: 3, weight: 3 },
  { id: "raw_copper", min: 2, max: 5, weight: 6 },
  { id: "amethyst_shard", min: 1, max: 3, weight: 5 },
  { id: "sweet_berries", min: 3, max: 6, weight: 7 },
  { id: "lantern", min: 1, max: 2, weight: 3 },
  { id: "copper_ingot", min: 1, max: 3, weight: 4 },
];
