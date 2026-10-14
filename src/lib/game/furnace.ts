// Furnace logic for Update 2.0
// Simple smelting: input + fuel -> output over time.
// Fuel values from registry ITEMS fuel field.
// Smelting recipes: raw materials + coal -> ingot, sand->glass, etc.

import { getItem } from "./registry";

export interface FurnaceState {
  input: { id: string; count: number } | null;
  fuel: { id: string; count: number } | null;
  output: { id: string; count: number } | null;
  burnTime: number; // remaining burn time in ticks
  burnMax: number;
  cookTime: number; // progress 0..200
  cookMax: number;
}

export function createFurnace(): FurnaceState {
  return { input: null, fuel: null, output: null, burnTime: 0, burnMax: 0, cookTime: 0, cookMax: 200 };
}

// smelting recipes
export const SMELT: Record<string, { out: string; count: number }> = {
  iron_ore: { out: "iron_ingot", count: 1 },
  gold_ore: { out: "gold_ingot", count: 1 },
  copper_ore: { out: "copper_ingot", count: 1 },
  raw_copper: { out: "copper_ingot", count: 1 },
  sand: { out: "glass", count: 1 },
  cobblestone: { out: "stone", count: 1 },
  clay_ball: { out: "brick_item", count: 1 },
  porkchop: { out: "cooked_porkchop", count: 1 },
  beef: { out: "steak", count: 1 },
  coal_ore: { out: "coal", count: 1 }, // convenience
};

export function fuelBurnTicks(id: string): number {
  const def = getItem(id);
  if (!def?.fuel) return 0;
  // fuel is conceptual "80" for coal ~ 1600 ticks (80 sec *20). Scale fuel*20
  return def.fuel * 20;
}

export function canSmelt(inputId: string): boolean {
  return Boolean(SMELT[inputId]);
}

export function tryStartBurn(f: FurnaceState): boolean {
  if (f.burnTime > 0) return true;
  if (!f.fuel || f.fuel.count <= 0) return false;
  if (!f.input || !canSmelt(f.input.id)) return false;
  const out = SMELT[f.input.id];
  if (f.output && f.output.id !== out.out) return false;
  if (f.output && f.output.count >= (getItem(out.out)?.stack ?? 64)) return false;
  const burn = fuelBurnTicks(f.fuel.id);
  if (burn <= 0) return false;
  // consume fuel
  f.fuel.count--;
  if (f.fuel.count <= 0) f.fuel = null;
  f.burnTime = burn;
  f.burnMax = burn;
  return true;
}

export function tickFurnace(f: FurnaceState, dtTicks: number): boolean {
  let changed = false;
  if (f.burnTime > 0) {
    f.burnTime = Math.max(0, f.burnTime - dtTicks);
    changed = true;
  }
  const can = f.input && canSmelt(f.input.id);
  const outDef = can ? SMELT[f.input!.id] : null;
  const outputFull = outDef && f.output && f.output.id === outDef.out && f.output.count >= (getItem(outDef.out)?.stack ?? 64);
  const blockedOutput = outDef && f.output && f.output.id !== outDef.out;

  if (can && !outputFull && !blockedOutput) {
    if (f.burnTime > 0) {
      f.cookTime += dtTicks;
      if (f.cookTime >= f.cookMax) {
        // produce
        f.cookTime = 0;
        const out = outDef!;
        if (!f.output) f.output = { id: out.out, count: out.count };
        else f.output.count += out.count;
        // consume input
        if (f.input) {
          f.input.count--;
          if (f.input.count <= 0) {
            f.input = null;
            f.cookTime = 0;
          }
        }
        changed = true;
      }
      // try to keep burning if about to expire but still has fuel & input
      if (f.burnTime <= 1 && f.input) tryStartBurn(f);
    } else {
      // try to start
      if (tryStartBurn(f)) changed = true;
      else {
        // not burning, cool down
        if (f.cookTime > 0) {
          f.cookTime = Math.max(0, f.cookTime - dtTicks * 0.5);
          changed = true;
        }
      }
    }
  } else {
    if (f.cookTime !== 0) {
      f.cookTime = 0;
      changed = true;
    }
  }
  return changed;
}
