// Procedural 16x16 pixel-art textures: block atlas + inventory item icons.
import * as THREE from "three";
import {
  art,
  blobs,
  border,
  clearAll,
  cols,
  Ctx,
  fill,
  grain,
  hexToRgb,
  rect,
  rows,
  shadeHex,
  speckle,
  toolBase,
} from "./paint";
import { BLOCKS, ITEMS } from "./registry";

export const TILE = 16;
export const ATLAS_COLS = 16;

type Painter = (c: Ctx) => void;

function oreOf(color: string): Painter {
  return (c) => {
    grain(c, "#7e7e7e", 0.16);
    blobs(c, "#6a6a6a", 6, 1, 2);
    blobs(c, color, 5, 1.4, 2.6);
    blobs(c, shadeHex(color, 0.35), 3, 1, 1.4);
  };
}
const rgb = (s: string) => hexToRgb(s);

const BLOCK_PAINTERS: Record<string, Painter> = {
  grass_top: (c) => {
    grain(c, "#5fa33a", 0.16);
    speckle(c, "#4c8a2e", 40);
    speckle(c, "#78bd4c", 30);
  },
  grass_side: (c) => {
    grain(c, "#8b6239", 0.14);
    speckle(c, "#6f4c2b", 30);
    rect(c, 0, 0, c.t, 4, rgb("#5fa33a"));
    for (let x = 0; x < c.t; x++) {
      const h = 3 + Math.floor(c.rng() * 3);
      rect(c, x, 0, 1, h, rgb(x % 3 === 0 ? "#78bd4c" : "#549230"));
    }
  },
  dirt: (c) => {
    grain(c, "#8b6239", 0.15);
    speckle(c, "#6f4c2b", 45);
    speckle(c, "#a1784a", 25);
  },
  stone: (c) => {
    grain(c, "#828282", 0.12);
    blobs(c, "#6f6f6f", 7, 1.5, 3);
    speckle(c, "#959595", 25);
  },
  cobblestone: (c) => {
    grain(c, "#7c7c7c", 0.1);
    blobs(c, "#909090", 9, 2, 3.4);
    blobs(c, "#5f5f5f", 6, 1.5, 2.4);
    cols(c, "#4f4f4f", 5);
    rows(c, "#4f4f4f", 5);
  },
  mossy_cobblestone: (c) => {
    BLOCK_PAINTERS.cobblestone(c);
    blobs(c, "#4f7a35", 8, 1.5, 3);
    speckle(c, "#6da348", 30);
  },
  sand: (c) => {
    grain(c, "#e0d3a0", 0.09);
    speckle(c, "#cfc08a", 30);
    speckle(c, "#f2e8bf", 25);
  },
  sandstone: (c) => {
    grain(c, "#dccb96", 0.06);
    rows(c, "#c4b17c", 5, 1);
    speckle(c, "#e8dcae", 20);
  },
  sandstone_top: (c) => {
    grain(c, "#e3d5a4", 0.07);
    border(c, "#c9b783", 1);
  },
  gravel: (c) => {
    grain(c, "#8a8580", 0.12);
    blobs(c, "#6d6863", 10, 1.4, 2.6);
    blobs(c, "#a9a49d", 9, 1.2, 2.2);
  },
  log_side: (c) => {
    grain(c, "#6d4c2a", 0.1);
    cols(c, "#54391f", 3);
    cols(c, "#7f5c34", 4, 2);
    speckle(c, "#4a3220", 25);
  },
  log_top: (c) => {
    grain(c, "#a57c48", 0.08);
    for (let r = 7; r > 0; r -= 2) {
      c.ctx.strokeStyle = r % 4 === 3 ? "#7d5a30" : "#b98e55";
      c.ctx.lineWidth = 1;
      c.ctx.beginPath();
      c.ctx.arc(8, 8, r, 0, Math.PI * 2);
      c.ctx.stroke();
    }
  },
  birch_side: (c) => {
    grain(c, "#dcd7cd", 0.06);
    speckle(c, "#4a4a44", 14, 1, 1);
    for (let i = 0; i < 4; i++) rect(c, Math.floor(c.rng() * 12), Math.floor(c.rng() * 14), 3 + Math.floor(c.rng() * 3), 1, rgb("#3d3d38"));
  },
  birch_top: (c) => {
    grain(c, "#e3dccb", 0.07);
    c.ctx.strokeStyle = "#b9ac90";
    c.ctx.beginPath();
    c.ctx.arc(8, 8, 6, 0, Math.PI * 2);
    c.ctx.stroke();
    c.ctx.beginPath();
    c.ctx.arc(8, 8, 3, 0, Math.PI * 2);
    c.ctx.stroke();
  },
  birch_leaves: (c) => {
    grain(c, "#6ea244", 0.2);
    speckle(c, "#87bd57", 40);
    speckle(c, "#4d7a2c", 40);
  },
  spruce_side: (c) => {
    grain(c, "#4a3320", 0.1);
    cols(c, "#33220f", 3);
    cols(c, "#5c4128", 4, 2);
  },
  spruce_top: (c) => {
    grain(c, "#7a5a36", 0.08);
    c.ctx.strokeStyle = "#573d22";
    c.ctx.beginPath();
    c.ctx.arc(8, 8, 6, 0, Math.PI * 2);
    c.ctx.stroke();
  },
  spruce_leaves: (c) => {
    grain(c, "#2f5f3a", 0.2);
    speckle(c, "#3f7c49", 45);
    speckle(c, "#1e4426", 40);
  },
  leaves: (c) => {
    grain(c, "#3f8b32", 0.22);
    speckle(c, "#57a844", 45);
    speckle(c, "#2a6a22", 45);
    speckle(c, "#6fc45a", 12);
  },
  planks: (c) => {
    grain(c, "#a5793f", 0.08);
    rows(c, "#7d5727", 4, 1);
    for (let y = 0; y < c.t; y += 4) rect(c, (y / 4) % 2 === 0 ? 7 : 3, y + 1, 1, 3, rgb("#8b6532"));
  },
  water: (c) => {
    clearAll(c);
    grain(c, "#2a5fd6", 0.08);
    blobs(c, "#3a72ee", 6, 2, 4, 0.5);
    speckle(c, "#6f9dff", 20, 1, 0.4);
  },
  glass: (c) => {
    clearAll(c);
    border(c, "#cfe9f2", 1, 0.85);
    rect(c, 2, 2, 4, 1, rgb("#ffffff"), 0.6);
    rect(c, 2, 3, 1, 3, rgb("#ffffff"), 0.45);
  },
  ice: (c) => {
    grain(c, "#9fc9f0", 0.06);
    c.ctx.globalAlpha = 0.55;
    blobs(c, "#c7e4ff", 5, 2, 4);
    c.ctx.globalAlpha = 1;
    speckle(c, "#ffffff", 18, 1, 0.6);
  },
  coal_ore: oreOf("#2a2a2a"),
  iron_ore: oreOf("#d3a486"),
  gold_ore: oreOf("#f2cd55"),
  diamond_ore: oreOf("#54e0d6"),
  bedrock: (c) => {
    grain(c, "#4a4a4a", 0.25);
    blobs(c, "#2a2a2a", 10, 1.5, 3);
    blobs(c, "#6b6b6b", 7, 1.5, 2.5);
  },
  snow: (c) => {
    grain(c, "#f4fbff", 0.04);
    speckle(c, "#dbeeff", 22);
  },
  snow_side: (c) => {
    grain(c, "#8b6239", 0.14);
    speckle(c, "#6f4c2b", 25);
    rect(c, 0, 0, c.t, 4, rgb("#f4fbff"));
    for (let x = 0; x < c.t; x++) rect(c, x, 0, 1, 3 + Math.floor(c.rng() * 2), rgb("#f4fbff"));
  },
  cactus_side: (c) => {
    grain(c, "#3f7a35", 0.08);
    cols(c, "#2f5f28", 4, 1);
    for (let y = 1; y < c.t; y += 4) {
      rect(c, 2, y, 1, 1, rgb("#dfe9c0"));
      rect(c, 12, y + 2, 1, 1, rgb("#dfe9c0"));
    }
  },
  cactus_top: (c) => {
    grain(c, "#48893c", 0.07);
    border(c, "#2f5f28", 1);
  },
  pumpkin_side: (c) => {
    grain(c, "#dd7d20", 0.08);
    cols(c, "#b8611a", 4, 1);
    rect(c, 0, 0, c.t, 1, rgb("#a95414"));
  },
  pumpkin_top: (c) => {
    grain(c, "#d0761d", 0.07);
    c.ctx.strokeStyle = "#8f4c13";
    c.ctx.beginPath();
    c.ctx.arc(8, 8, 5, 0, Math.PI * 2);
    c.ctx.stroke();
    rect(c, 7, 2, 2, 3, rgb("#5d7a2a"));
  },
  wool: (c) => {
    grain(c, "#eeeeee", 0.06);
    blobs(c, "#dedede", 10, 1.5, 2.6);
    speckle(c, "#ffffff", 25);
  },
  bricks: (c) => {
    fill(c, "#9c9c9c");
    for (let y = 0; y < c.t; y += 4) {
      const off = (y / 4) % 2 === 0 ? 0 : 4;
      for (let x = -4; x < c.t; x += 8) rect(c, x + off, y, 7, 3, rgb("#a4553d"));
    }
    speckle(c, "#8f4632", 20, 1, 0.6);
  },
  bookshelf: (c) => {
    BLOCK_PAINTERS.planks(c);
    const bookColors = ["#a33b3b", "#3b5ea3", "#3ba35a", "#a38b3b", "#7b3ba3"];
    for (const y of [2, 9]) {
      rect(c, 1, y, 14, 5, rgb("#6b4a24"));
      for (let x = 2; x < 14; x += 2) rect(c, x, y + (c.rng() < 0.3 ? 1 : 0), 2, 5 - (c.rng() < 0.3 ? 1 : 0), rgb(bookColors[Math.floor(c.rng() * bookColors.length)]));
    }
  },
  crafting_top: (c) => {
    BLOCK_PAINTERS.planks(c);
    border(c, "#6b4a24", 1);
    rect(c, 2, 2, 5, 5, rgb("#8a6230"));
    rect(c, 9, 2, 5, 5, rgb("#8a6230"));
    rect(c, 2, 9, 5, 5, rgb("#8a6230"));
    rect(c, 9, 9, 5, 5, rgb("#8a6230"));
  },
  crafting_side: (c) => {
    BLOCK_PAINTERS.planks(c);
    rect(c, 2, 3, 12, 3, rgb("#7a5427"));
    rect(c, 3, 9, 10, 2, rgb("#c0c0c0"));
    rect(c, 3, 12, 10, 1, rgb("#8a8a8a"));
  },
  chest_side: (c) => {
    grain(c, "#9a6a33", 0.08);
    border(c, "#5d3f1c", 1);
    rows(c, "#5d3f1c", 8, 1);
    rect(c, 0, 6, c.t, 2, rgb("#7a7a7a"));
  },
  chest_top: (c) => {
    grain(c, "#a2733a", 0.08);
    border(c, "#5d3f1c", 1);
    rect(c, 6, 6, 4, 4, rgb("#7a7a7a"));
  },
  torch: (c) =>
    art(
      c,
      [
        "................",
        "................",
        "................",
        ".......oo.......",
        "......oyyo......",
        "......oyyo......",
        ".......yy.......",
        ".......ww.......",
        ".......ww.......",
        ".......ww.......",
        ".......ww.......",
        ".......ww.......",
        ".......ww.......",
        ".......ww.......",
        "................",
        "................",
      ],
      { o: "#ffdf8a", y: "#ff9d2b", w: "#8a5a2b" },
    ),
  sapling: (c) =>
    art(
      c,
      [
        "................",
        ".....gg.........",
        "....gggg........",
        "...gg.ggg.......",
        "...ggg.gg.......",
        "....ggg.........",
        ".....g..........",
        ".....s..........",
        ".....s..........",
        ".....s..........",
        ".....s..........",
        "................",
        "................",
        "................",
        "................",
        "................",
      ],
      { g: "#3f8b32", s: "#6b4a24" },
    ),
  flower_red: (c) =>
    art(
      c,
      [
        "................",
        "................",
        "................",
        "....rr..........",
        "...rRRr..........",
        "...RRRR..........",
        "...rRRr..........",
        "....rr..........",
        ".....s....gg....",
        ".....s..........",
        ".....s..........",
        ".....s..........",
        "................",
        "................",
        "................",
        "................",
      ],
      { r: "#b8302a", R: "#e0554d", s: "#3f8b32", g: "#57a844" },
    ),
  flower_yellow: (c) =>
    art(
      c,
      [
        "................",
        "................",
        "................",
        "....yy..........",
        "...yYYy..........",
        "...YYYY..........",
        "...yYYy..........",
        "....yy..........",
        ".....s..........",
        ".....s..........",
        ".....s..........",
        ".....s..........",
        "................",
        "................",
        "................",
        "................",
      ],
      { y: "#d8c021", Y: "#f6e86a", s: "#3f8b32" },
    ),
  tall_grass: (c) => {
    clearAll(c);
    for (let i = 0; i < 7; i++) {
      const x = 1 + i * 2 + Math.floor(c.rng() * 2);
      const h = 7 + Math.floor(c.rng() * 7);
      const col = c.rng() < 0.5 ? "#4f9a34" : "#3d7d28";
      for (let y = 0; y < h; y++) rect(c, x + (y > h - 4 ? (c.rng() < 0.3 ? 1 : 0) : 0), 15 - y, 1, 1, rgb(col));
    }
  },
  dead_bush: (c) => {
    clearAll(c);
    for (let i = 0; i < 6; i++) {
      const x = 2 + i * 2;
      const h = 5 + Math.floor(c.rng() * 6);
      for (let y = 0; y < h; y++) rect(c, x + (c.rng() < 0.25 ? 1 : 0), 15 - y, 1, 1, rgb("#8a6a3a"));
    }
  },
  obsidian: (c) => {
    grain(c, "#1c1626", 0.3);
    speckle(c, "#3d2f5c", 30);
    speckle(c, "#6b4fa0", 8);
  },
  clay: (c) => {
    grain(c, "#a4a7b5", 0.06);
    blobs(c, "#8f93a3", 8, 2, 3);
  },
  glowstone: (c) => {
    grain(c, "#c8a34a", 0.12);
    blobs(c, "#ffe9a0", 9, 1.6, 3);
    speckle(c, "#fff8d8", 20);
  },
  tnt_side: (c) => {
    grain(c, "#b83a2a", 0.06);
    rect(c, 0, 5, c.t, 6, rgb("#eeeeee"));
    c.ctx.fillStyle = "#222";
    c.ctx.font = "bold 6px monospace";
    c.ctx.fillText("TNT", 2, 10);
    rows(c, "#8a2a1c", 8, 1);
  },
  tnt_top: (c) => {
    grain(c, "#a5341f", 0.07);
    border(c, "#7a2416", 2);
    blobs(c, "#d8d8d8", 4, 1, 2);
  },
  iron_block: (c) => {
    grain(c, "#d8d8d8", 0.05);
    border(c, "#b0b0b0", 1);
    rect(c, 3, 3, 10, 10, rgb("#e6e6e6"));
  },
  gold_block: (c) => {
    grain(c, "#f2cf4a", 0.06);
    border(c, "#c9a72c", 1);
    rect(c, 3, 3, 10, 10, rgb("#ffe066"));
  },
  diamond_block: (c) => {
    grain(c, "#5ee0d6", 0.06);
    border(c, "#35b0a8", 1);
    rect(c, 3, 3, 10, 10, rgb("#8ff2ea"));
  },
  stone_bricks: (c) => {
    grain(c, "#8a8a8a", 0.08);
    rows(c, "#6a6a6a", 8, 1);
    rect(c, 7, 0, 1, 8, rgb("#6a6a6a"));
    rect(c, 3, 8, 1, 8, rgb("#6a6a6a"));
    rect(c, 12, 8, 1, 8, rgb("#6a6a6a"));
  },
  melon_side: (c) => {
    grain(c, "#3f7a2a", 0.08);
    cols(c, "#2c5a1c", 4, 2);
    cols(c, "#5aa336", 4, 1);
    speckle(c, "#1d4212", 20);
  },
  melon_top: (c) => {
    grain(c, "#4f8f33", 0.08);
    c.ctx.strokeStyle = "#2c5a1c";
    c.ctx.beginPath();
    c.ctx.arc(8, 8, 5, 0, Math.PI * 2);
    c.ctx.stroke();
  },
  mushroom_red: (c) =>
    art(
      c,
      [
        "................",
        "................",
        "................",
        "....rrrrrr......",
        "...rwwrrwwr.....",
        "..rrwrrrwrr.....",
        "..rrrrrrrrr.....",
        "...wwwwwwww.....",
        ".....wwww.......",
        ".....wwww.......",
        ".....wwww.......",
        "................",
        "................",
        "................",
        "................",
        "................",
      ],
      { r: "#c0392b", w: "#f3efe4" },
    ),
  mushroom_brown: (c) =>
    art(
      c,
      [
        "................",
        "................",
        "................",
        "....bbbbbb......",
        "..bbbbbbbbbb....",
        "..bbbbbbbbbb....",
        "...bbbbbbbb.....",
        ".....wwwww......",
        ".....wwwww......",
        ".....wwwww......",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
      ],
      { b: "#a5763f", w: "#e6d9bd" },
    ),
  // --- UPDATE 2.0 new blocks ---
  furnace_top: (c) => {
    grain(c, "#6a6a6a", 0.08);
    border(c, "#3a3a3a", 1);
    rect(c, 2, 2, 12, 12, rgb("#5a5a5a"));
    rect(c, 4, 4, 8, 8, rgb("#8a8a8a"));
  },
  furnace_side: (c) => {
    grain(c, "#7a7a7a", 0.08);
    border(c, "#333", 1);
    rect(c, 3, 3, 10, 10, rgb("#525252"));
    rect(c, 5, 6, 6, 4, rgb("#1a1a1a"));
    // furnace window + flame hint
    rect(c, 6, 7, 4, 2, rgb("#ff7a1a"));
    rect(c, 7, 6, 2, 1, rgb("#d8d8d8"));
    rows(c, "#3a3a3a", 8, 1);
  },
  copper_ore: (c) => {
    grain(c, "#7e7e7e", 0.1);
    blobs(c, "#b87333", 6, 1.6, 3);
    blobs(c, "#e6a06e", 3, 1.2, 2);
    speckle(c, "#d68a4a", 12);
  },
  copper_block: (c) => {
    grain(c, "#b86a2f", 0.07);
    border(c, "#8a4a1a", 1);
    rect(c, 2, 2, 12, 12, rgb("#c47a3a"));
    blobs(c, "#e0a46a", 4, 1.5, 2.5);
    // verdigris dots
    speckle(c, "#3f9a80", 8);
  },
  amethyst_ore: (c) => {
    grain(c, "#7e7e7e", 0.1);
    blobs(c, "#9b4fdb", 5, 1.6, 3);
    blobs(c, "#d8b0ff", 3, 1.2, 2);
    speckle(c, "#c89af5", 10);
  },
  amethyst_block: (c) => {
    grain(c, "#7a3fbf", 0.12);
    blobs(c, "#b78aff", 7, 1.8, 3);
    blobs(c, "#d8b8ff", 5, 1.4, 2.4);
    border(c, "#4a2080", 1);
  },
  lantern: (c) =>
    art(
      c,
      [
        "................",
        ".....ggggg......",
        "....gYYYYYg.....",
        "....gYYYYYg.....",
        ".....ggggg......",
        "......mmm.......",
        "......mmm.......",
        "......ooo.......",
        ".......o........",
        ".......o........",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
      ],
      { g: "#2a2a2a", Y: "#ffe9a0", m: "#8a6a2a", o: "#ff9d2b" },
    ),
  berry_bush: (c) => {
    clearAll(c);
    for (let i = 0; i < 5; i++) {
      const x = 2 + i*3;
      rect(c, x, 3, 1, 10, rgb("#3f7a2a"));
      rect(c, x+1, 5, 1, 6, rgb("#5aa336"));
      rect(c, x, 4, 1, 1, rgb(i%2===0?"#c62828":"#2a9a3a"));
    }
    rect(c, 5, 13, 6, 1, rgb("#7a5528"));
  },
  sunflower: (c) =>
    art(
      c,
      [
        "......yy.......",
        ".....yYYy......",
        "....yYYYYy.....",
        "...yYYYYYYy....",
        "....yYYYYy.....",
        ".....yYYy......",
        "......yy.......",
        "......gg.......",
        "......gg.......",
        "......gg.......",
        "......gg.......",
        ".....gSSg......",
        "......gg.......",
        "......gg.......",
        "................",
        "................",
      ],
      { y: "#e0b428", Y: "#fff066", g: "#3f7d28", S: "#5fa33a" },
    ),
  campfire: (c) => {
    grain(c, "#5a3a1a", 0.1);
    blobs(c, "#7a4a1f", 6, 2, 3);
    // logs
    rect(c, 2, 6, 12, 2, rgb("#4a2f0f"));
    rect(c, 3, 10, 10, 2, rgb("#4a2f0f"));
    // flame
    blobs(c, "#ff8c1a", 4, 1.4, 2.2);
    blobs(c, "#ffe066", 3, 1, 1.8);
  },
};

const ITEM_PAINTERS: Record<string, Painter> = {
  stick: (c) =>
    art(
      c,
      [
        "................",
        "..........ss....",
        ".........ss.....",
        "........ss......",
        ".......ss.......",
        "......ss........",
        ".....ss.........",
        "....ss..........",
        "...ss...........",
        "..ss............",
        "................",
      ],
      { s: "#8a5a2b" },
    ),
  coal: (c) => {
    clearAll(c);
    blobs(c, "#26262b", 4, 2.6, 4);
    speckle(c, "#4b4b55", 12);
  },
  iron_ingot: (c) => {
    clearAll(c);
    art(
      c,
      [
        "................",
        "................",
        "................",
        "....iiiiiiii....",
        "...iIIIIIIIIi...",
        "..iIIIIIIIIIIi..",
        "..iiiiiiiiiii...",
        "................",
      ],
      { i: "#a8a8a8", I: "#e2e2e2" },
    );
  },
  gold_ingot: (c) => {
    clearAll(c);
    art(
      c,
      [
        "................",
        "................",
        "................",
        "....gggggggg....",
        "...gGGGGGGGGg...",
        "..gGGGGGGGGGGg..",
        "..ggggggggggg...",
        "................",
      ],
      { g: "#c9a72c", G: "#ffe066" },
    );
  },
  diamond: (c) =>
    art(
      c,
      [
        "................",
        "................",
        "....dddddd......",
        "...dDDDDDDd.....",
        "..dDDDDDDDDd....",
        "...dDDDDDDd.....",
        "....dDDDDd......",
        ".....dDDd.......",
        "......dd........",
        "................",
      ],
      { d: "#2fa8a0", D: "#7ff0e8" },
    ),
  emerald: (c) =>
    art(
      c,
      [
        "................",
        "................",
        ".....eeee.......",
        "....eEEEEe......",
        "...eEEEEEEe.....",
        "...eEEEEEEe.....",
        "....eEEEEe......",
        ".....eeee.......",
        "................",
      ],
      { e: "#1f8a4c", E: "#43d97f" },
    ),
  flint: (c) => {
    clearAll(c);
    blobs(c, "#33333a", 3, 2.5, 3.6);
    speckle(c, "#5b5b66", 14);
  },
  clay_ball: (c) => {
    clearAll(c);
    blobs(c, "#a4a7b5", 2, 3, 4);
    speckle(c, "#c8ccd8", 10);
  },
  brick_item: (c) => {
    clearAll(c);
    rect(c, 2, 6, 12, 6, rgb("#a4553d"));
    rect(c, 2, 6, 12, 2, rgb("#c26a4d"));
    border(c, "#7d3f2c", 1);
  },
  paper: (c) => {
    clearAll(c);
    rect(c, 3, 2, 10, 12, rgb("#f4f1e6"));
    rows(c, "#d8d3c2", 3, 1);
  },
  book: (c) => {
    clearAll(c);
    rect(c, 3, 2, 10, 12, rgb("#8c3b2f"));
    rect(c, 4, 3, 8, 10, rgb("#f4f1e6"));
    rect(c, 3, 2, 2, 12, rgb("#6b2a21"));
  },
  leather: (c) => {
    clearAll(c);
    blobs(c, "#9a6b3a", 3, 3, 4);
    speckle(c, "#7d5528", 20);
  },
  feather: (c) =>
    art(
      c,
      [
        "..........ww....",
        ".........www....",
        "........wwww....",
        ".......wwwww....",
        "......wwwww.....",
        ".....wwwww......",
        "....wwwww.......",
        "...wwwww........",
        "..swww..........",
        ".ss.............",
      ],
      { w: "#f0f0f0", s: "#bdbdbd" },
    ),
  string: (c) => {
    clearAll(c);
    c.ctx.strokeStyle = "#e6e6e6";
    c.ctx.lineWidth = 1.5;
    c.ctx.beginPath();
    for (let i = 0; i <= 16; i++) c.ctx.lineTo(i, 8 + Math.sin(i * 0.9) * 5);
    c.ctx.stroke();
  },
  bone: (c) =>
    art(
      c,
      [
        "................",
        "..........ww....",
        ".........wwww...",
        "........wwwww...",
        ".......wwww.....",
        "......wwww......",
        ".....wwww.......",
        "....wwww........",
        "...wwwww........",
        "...wwww.........",
        "..ww............",
      ],
      { w: "#efeadb" },
    ),
  gunpowder: (c) => {
    clearAll(c);
    speckle(c, "#4a4a4a", 90);
    speckle(c, "#7a7a7a", 40);
  },
  wheat: (c) =>
    art(
      c,
      [
        "................",
        "....y.y.y.......",
        "....yyyyy.......",
        ".....yyy........",
        "....y.y.y.......",
        ".....yyy........",
        "......s.........",
        "......s.........",
        "......s.........",
        "......s.........",
        "......s.........",
      ],
      { y: "#d8b64a", s: "#7f9a3a" },
    ),
  seeds: (c) => {
    clearAll(c);
    for (let i = 0; i < 9; i++) {
      const x = 3 + Math.floor(c.rng() * 10);
      const y = 3 + Math.floor(c.rng() * 10);
      rect(c, x, y, 2, 1, rgb("#8fae3c"));
    }
  },
  sugar: (c) => {
    clearAll(c);
    speckle(c, "#ffffff", 90);
    speckle(c, "#e6e6e6", 30);
  },
  rotten_flesh: (c) => {
    clearAll(c);
    blobs(c, "#6b4a2a", 3, 3, 4);
    speckle(c, "#4a7a2a", 14);
  },
  apple: (c) =>
    art(
      c,
      [
        "................",
        ".......s........",
        "......s.........",
        "....rrs.rr......",
        "...rrrrrrrr.....",
        "..rrrrrrrrrr....",
        "..rRrrrrrrrr....",
        "..rRrrrrrrrr....",
        "..rrrrrrrrrr....",
        "...rrrrrrrr.....",
        "....rrrrrr......",
        "................",
      ],
      { r: "#c62828", R: "#ef5350", s: "#5d4023" },
    ),
  golden_apple: (c) =>
    art(
      c,
      [
        "................",
        ".......s........",
        "......s.........",
        "....ggs.gg......",
        "...gggggggg.....",
        "..gggggggggg....",
        "..gGgggggggg....",
        "..gGgggggggg....",
        "..gggggggggg....",
        "...gggggggg.....",
        "....gggggg......",
        "................",
      ],
      { g: "#e0b428", G: "#fff0a0", s: "#5d4023" },
    ),
  bread: (c) =>
    art(
      c,
      [
        "................",
        "................",
        "................",
        "...bbbbbbbb.....",
        "..bBBBBBBBBb....",
        ".bBBBBBBBBBBb...",
        ".bbbbbbbbbbbb...",
        "..bbbbbbbbbb....",
        "................",
      ],
      { b: "#b5793a", B: "#e0ab6a" },
    ),
  porkchop: (c) => {
    clearAll(c);
    blobs(c, "#e08a8a", 3, 3, 4);
    speckle(c, "#c96f6f", 25);
    rect(c, 6, 4, 3, 8, rgb("#f4c2c2"));
  },
  cooked_porkchop: (c) => {
    clearAll(c);
    blobs(c, "#b5652f", 3, 3, 4);
    speckle(c, "#8f4c22", 25);
    rect(c, 6, 4, 3, 8, rgb("#d99b5f"));
  },
  beef: (c) => {
    clearAll(c);
    blobs(c, "#c04a4a", 3, 3, 4);
    speckle(c, "#f0d0d0", 18);
  },
  steak: (c) => {
    clearAll(c);
    blobs(c, "#7a4020", 3, 3, 4);
    speckle(c, "#a5602f", 20);
  },
  melon_slice: (c) =>
    art(
      c,
      [
        "................",
        "................",
        "....gggggg......",
        "...grrrrrrg.....",
        "..grrRrrrrrg....",
        "..grrrrrrrrg....",
        "...grrrrrrg.....",
        "....gggggg......",
        "................",
      ],
      { g: "#4f8f33", r: "#e05a4f", R: "#f7a1a1" },
    ),
  bowl: (c) => {
    clearAll(c);
    art(
      c,
      [
        "................",
        "................",
        "................",
        "................",
        "...w........w...",
        "...wwwwwwwww....",
        "....wwwwwww.....",
        ".....wwwww......",
      ],
      { w: "#8a5a2b" },
    );
  },
  mushroom_stew: (c) => {
    clearAll(c);
    art(
      c,
      [
        "................",
        "................",
        "................",
        "...w........w...",
        "...wrrrrrrrrw...",
        "...wwwwwwwwww...",
        "....wwwwwwww....",
        ".....wwwwww.....",
      ],
      { w: "#8a5a2b", r: "#c0392b" },
    );
  },
  bucket: (c) => {
    clearAll(c);
    art(
      c,
      [
        "................",
        "....m......m....",
        ".....m....m.....",
        ".....m....m.....",
        "....mmmmmmm.....",
        "....m.....m.....",
        ".....m...m......",
        ".....mmmmm......",
      ],
      { m: "#c8c8c8" },
    );
  },
  water_bucket: (c) => {
    clearAll(c);
    art(
      c,
      [
        "................",
        "....m......m....",
        ".....m....m.....",
        ".....m....m.....",
        "....mmmmmmm.....",
        "....mwwwwwm.....",
        ".....mwwwm......",
        ".....mmmmm......",
      ],
      { m: "#c8c8c8", w: "#2a5fd6" },
    );
  },
  fishing_rod: (c) =>
    art(
      c,
      [
        "..........ss....",
        ".........ss.....",
        "........ss......",
        ".......ss.......",
        "......ss........",
        ".....ss.........",
        "....ss..........",
        "...ss...........",
        "..ss............",
        "..s.............",
        "..s.............",
      ],
      { s: "#8a5a2b" },
    ),
  compass: (c) => {
    clearAll(c);
    c.ctx.strokeStyle = "#d8d8d8";
    c.ctx.lineWidth = 2;
    c.ctx.beginPath();
    c.ctx.arc(8, 8, 6, 0, Math.PI * 2);
    c.ctx.stroke();
    c.ctx.fillStyle = "#c0392b";
    c.ctx.beginPath();
    c.ctx.moveTo(8, 3);
    c.ctx.lineTo(10, 8);
    c.ctx.lineTo(8, 8);
    c.ctx.fill();
    c.ctx.fillStyle = "#333";
    c.ctx.beginPath();
    c.ctx.moveTo(8, 13);
    c.ctx.lineTo(6, 8);
    c.ctx.lineTo(8, 8);
    c.ctx.fill();
  },
  clock: (c) => {
    clearAll(c);
    c.ctx.strokeStyle = "#e0b428";
    c.ctx.lineWidth = 2;
    c.ctx.beginPath();
    c.ctx.arc(8, 8, 6, 0, Math.PI * 2);
    c.ctx.stroke();
    c.ctx.strokeStyle = "#333";
    c.ctx.beginPath();
    c.ctx.moveTo(8, 8);
    c.ctx.lineTo(8, 4);
    c.ctx.moveTo(8, 8);
    c.ctx.lineTo(11, 9);
    c.ctx.stroke();
  },
  map: (c) => {
    clearAll(c);
    rect(c, 2, 2, 12, 12, rgb("#e8e0c0"));
    rect(c, 3, 8, 10, 4, rgb("#6fa3d8"));
    rect(c, 5, 4, 4, 4, rgb("#5fa33a"));
    rect(c, 10, 5, 2, 3, rgb("#8a8a8a"));
  },
  shears: (c) => {
    clearAll(c);
    c.ctx.strokeStyle = "#dcdcdc";
    c.ctx.lineWidth = 2;
    c.ctx.beginPath();
    c.ctx.moveTo(4, 12);
    c.ctx.lineTo(12, 4);
    c.ctx.moveTo(12, 12);
    c.ctx.lineTo(4, 4);
    c.ctx.stroke();
  },
  raw_copper: (c) => {
    clearAll(c);
    blobs(c, "#b87333", 3, 3, 4);
    speckle(c, "#e6a06e", 18);
    rect(c, 6, 5, 4, 6, rgb("#d68a4a"));
  },
  copper_ingot: (c) => {
    clearAll(c);
    art(c, [
      "................",
      "................",
      "................",
      "....cccccccc....",
      "...cCCCCCCCCc...",
      "..cCCCCCCCCCCc..",
      "..ccccccccccc...",
      "................",
    ], { c: "#a65a22", C: "#d68a4a" });
  },
  amethyst_shard: (c) =>
    art(c, [
      "................",
      ".......aa.......",
      "......aaaa......",
      ".....aAAAAa.....",
      "....aAAAAAAa....",
      ".....aAAAAa.....",
      "......aaaa......",
      ".......aa.......",
      "................",
    ], { a: "#7a3fbf", A: "#b78aff" }),
  sweet_berries: (c) =>
    art(c, [
      "................",
      "................",
      ".....rr.........",
      "....rRRr........",
      "....rRRr...rr...",
      ".....rr...rRRr..",
      "..........rRRr..",
      "...........rr...",
    ], { r: "#c62828", R: "#ef5350" }),
};

function toolPainter(id: string): Painter | undefined {
  const mats: Record<string, string> = { wooden: "#a4763f", stone: "#8d8d8d", iron: "#e2e2e2", diamond: "#4fe3da" };
  const m = id.split("_")[0];
  const kind = id.split("_")[1];
  const color = mats[m];
  if (!color || !kind) return undefined;
  return (c) => {
    toolBase(c, "#8a5a2b");
    if (kind === "pickaxe") {
      for (let x = 3; x <= 13; x++) {
        const y = 3 + Math.round(Math.abs(x - 8) * 0.35);
        rect(c, x, y, 1, 2, rgb(color));
        rect(c, x, y, 1, 1, rgb(shadeHex(color, 0.3)));
      }
    } else if (kind === "axe") {
      for (let y = 1; y <= 7; y++) {
        const w = 6 - Math.abs(y - 3);
        rect(c, 8, y, Math.max(2, w), 1, rgb(color));
      }
      rect(c, 8, 1, 2, 2, rgb(shadeHex(color, 0.3)));
    } else if (kind === "shovel") {
      for (let y = 1; y <= 5; y++) rect(c, 8, y, 4, 1, rgb(color));
      rect(c, 8, 1, 4, 1, rgb(shadeHex(color, 0.3)));
    } else if (kind === "sword") {
      clearAll(c);
      for (let i = 0; i < 9; i++) {
        rect(c, 12 - i, 3 + i, 2, 2, rgb(color));
        rect(c, 12 - i, 3 + i, 1, 1, rgb(shadeHex(color, 0.4)));
      }
      rect(c, 3, 11, 4, 1, rgb("#6b4a24"));
      rect(c, 4, 12, 1, 3, rgb("#8a5a2b"));
      rect(c, 2, 12, 2, 2, rgb("#c8c8c8"));
    }
  };
}

function fallbackPainter(id: string): Painter {
  return (c) => {
    clearAll(c);
    c.ctx.fillStyle = "#b45";
    c.ctx.fillRect(2, 2, 12, 12);
    c.ctx.fillStyle = "#fff";
    c.ctx.font = "bold 9px monospace";
    c.ctx.fillText(id.slice(0, 2).toUpperCase(), 3, 11);
  };
}

export function painterForItem(id: string): Painter {
  return ITEM_PAINTERS[id] ?? toolPainter(id) ?? fallbackPainter(id);
}

let atlasCache: { canvas: HTMLCanvasElement; tiles: Record<string, number>; count: number } | null = null;

export function tilePainters(): Record<string, Painter> {
  return BLOCK_PAINTERS;
}

export function getAtlas() {
  if (atlasCache) return atlasCache;
  const names = new Set<string>();
  for (const b of BLOCKS) {
    if (!b) continue;
    names.add(b.tiles.top);
    names.add(b.tiles.side);
    names.add(b.tiles.bottom);
  }
  const list = [...names];
  const size = ATLAS_COLS * TILE;
  const rowsCount = Math.ceil(list.length / ATLAS_COLS);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = rowsCount * TILE;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const tiles: Record<string, number> = {};
  list.forEach((name, i) => {
    const tileCanvas = document.createElement("canvas");
    tileCanvas.width = TILE;
    tileCanvas.height = TILE;
    const tctx = tileCanvas.getContext("2d")!;
    let seed = 0;
    for (let k = 0; k < name.length; k++) seed = (seed * 31 + name.charCodeAt(k)) >>> 0;
    const painter = BLOCK_PAINTERS[name] ?? fallbackPainter(name);
    painter({ ctx: tctx, rng: mulberry(seed), t: TILE });
    const tx = (i % ATLAS_COLS) * TILE;
    const ty = Math.floor(i / ATLAS_COLS) * TILE;
    ctx.drawImage(tileCanvas, tx, ty);
    tiles[name] = i;
  });
  atlasCache = { canvas, tiles, count: list.length };
  return atlasCache;
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let atlasTexture: THREE.CanvasTexture | null = null;
export function getAtlasTexture(): THREE.CanvasTexture {
  if (atlasTexture) return atlasTexture;
  const tex = new THREE.CanvasTexture(getAtlas().canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  atlasTexture = tex;
  return tex;
}

export function uvFor(tile: number) {
  const cols = ATLAS_COLS;
  const totalRows = Math.ceil(getAtlas().count / cols);
  const col = tile % cols;
  const row = Math.floor(tile / cols);
  const u0 = col / cols;
  const v0 = 1 - (row + 1) / totalRows;
  return { u0, v0, u1: u0 + 1 / cols, v1: v0 + 1 / totalRows };
}

export function tileIndexOf(name: string): number {
  return getAtlas().tiles[name] ?? 0;
}

const iconCache = new Map<string, string>();

/** 64x64 data-url icon for the HUD/inventory. */
export function getItemIcon(id: string): string {
  const cached = iconCache.get(id);
  if (cached) return cached;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const def = ITEMS[id];
  const rng = mulberry(id.split("").reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7));

  const paintTile = (name: string, target: HTMLCanvasElement) => {
    const tc = target.getContext("2d")!;
    (BLOCK_PAINTERS[name] ?? fallbackPainter(name))({ ctx: tc, rng, t: TILE });
  };

  if (def?.block) {
    const b = BLOCKS[def.block];
    const s = 32;
    const cx = size / 2;
    const cy = size / 2 - s / 2 + 6;
    const tmp = document.createElement("canvas");
    tmp.width = TILE;
    tmp.height = TILE;
    if (b?.cross) {
      paintTile(b.tiles.side, tmp);
      ctx.drawImage(tmp, 6, 6, size - 12, size - 12);
    } else {
      // top face
      paintTile(b.tiles.top, tmp);
      ctx.save();
      ctx.setTransform(s / 2 / TILE, (s / 2) / TILE, -s / 2 / TILE, (s / 2) / TILE, cx, cy);
      ctx.drawImage(tmp, 0, 0);
      ctx.restore();
      // left face
      paintTile(b.tiles.side, tmp);
      ctx.save();
      ctx.setTransform(s / 2 / TILE, (s / 2) / TILE, 0, s / TILE, cx - s / 2, cy);
      ctx.drawImage(tmp, 0, 0);
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, TILE, TILE);
      ctx.restore();
      // right face
      paintTile(b.tiles.side, tmp);
      ctx.save();
      ctx.setTransform(s / 2 / TILE, (-s / 2) / TILE, 0, s / TILE, cx, cy + s / 2);
      ctx.drawImage(tmp, 0, 0);
      ctx.globalAlpha = 0.36;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, TILE, TILE);
      ctx.restore();
    }
  } else {
    const tmp = document.createElement("canvas");
    tmp.width = TILE;
    tmp.height = TILE;
    painterForItem(id)({ ctx: tmp.getContext("2d")!, rng, t: TILE });
    ctx.drawImage(tmp, 4, 4, size - 8, size - 8);
  }

  const url = canvas.toDataURL("image/png");
  iconCache.set(id, url);
  return url;
}
